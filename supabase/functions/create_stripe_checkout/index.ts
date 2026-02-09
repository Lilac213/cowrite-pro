import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const successUrlPath = '/payment-success?session_id={CHECKOUT_SESSION_ID}';
const cancelUrlPath = '/settings';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  credits: number;
}

interface CheckoutRequest {
  items: OrderItem[];
  currency?: string;
  payment_method_types?: string[];
}

// 成功响应
function ok(data: any): Response {
  return new Response(
    JSON.stringify({ code: "SUCCESS", message: "成功", data }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

// 失败响应
function fail(msg: string, code = 400): Response {
  return new Response(
    JSON.stringify({ code: "FAIL", message: msg }),
    {
      status: code,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

// 校验请求参数
function validateCheckoutRequest(request: CheckoutRequest): void {
  if (!request.items?.length) {
    throw new Error("商品不能为空");
  }
  for (const item of request.items) {
    if (!item.name || item.price <= 0 || item.quantity <= 0 || item.credits <= 0) {
      throw new Error("商品信息无效");
    }
  }
}

// 格式化订单商品并计算总金额
function processOrderItems(items: OrderItem[]) {
  const formattedItems = items.map(item => ({
    name: item.name.trim(),
    price: Math.round(item.price * 100),
    quantity: item.quantity,
    credits: item.credits,
  }));
  const totalAmount = formattedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return { formattedItems, totalAmount };
}

// 创建订单和支付会话
async function createCheckoutSession(
  stripe: Stripe,
  userId: string,
  items: OrderItem[],
  currency: string,
  paymentMethods: string[],
  origin: string
) {
  const { formattedItems, totalAmount } = processOrderItems(items);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      items: formattedItems,
      total_amount: totalAmount / 100,
      currency: currency.toLowerCase(),
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`创建订单失败: ${error.message}`);

  const session = await stripe.checkout.sessions.create({
    line_items: items.map(item => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: item.name,
          description: `${item.credits} 点数`,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    })),
    mode: "payment",
    success_url: `${origin}${successUrlPath}`,
    cancel_url: `${origin}${cancelUrlPath}`,
    payment_method_types: paymentMethods,
    metadata: {
      order_id: order.id,
      user_id: userId,
    },
  });

  await supabase
    .from("orders")
    .update({
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq("id", order.id);

  return { order, session };
}

// ========== 主入口 ==========
Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const request = await req.json();
    validateCheckoutRequest(request);

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
      throw new Error("未登录");
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error("用户验证失败");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY未配置");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "";
    const { order, session } = await createCheckoutSession(
      stripe,
      user.id,
      request.items,
      request.currency || 'cny',
      request.payment_method_types || ['card', 'alipay', 'wechat_pay'],
      origin
    );

    return ok({
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    });
  } catch (error) {
    console.error("创建支付会话失败:", error);
    return fail(error instanceof Error ? error.message : "支付处理失败", 500);
  }
});
