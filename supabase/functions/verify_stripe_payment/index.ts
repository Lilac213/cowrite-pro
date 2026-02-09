import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// 更新订单状态为已完成并增加用户点数
async function updateOrderStatus(
  sessionId: string,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, status, user_id, items")
    .eq("stripe_session_id", sessionId)
    .single();

  if (fetchError || !order) {
    console.error("查询订单失败:", fetchError);
    return false;
  }

  if (order.status === "completed") {
    return true;
  }

  if (order.status !== "pending") {
    console.error(`订单状态为${order.status},无法完成支付`);
    return false;
  }

  // 计算总点数
  const totalCredits = order.items.reduce((sum: number, item: any) => {
    return sum + (item.credits * item.quantity);
  }, 0);

  // 开始事务：更新订单状态和用户点数
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      customer_email: session.customer_details?.email,
      customer_name: session.customer_details?.name,
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq("id", order.id)
    .eq("status", "pending");

  if (orderError) {
    console.error("更新订单失败:", orderError);
    return false;
  }

  // 获取用户当前点数
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("available_credits")
    .eq("id", order.user_id)
    .single();

  if (profileError || !profile) {
    console.error("查询用户失败:", profileError);
    return false;
  }

  // 增加用户点数
  const { error: creditsError } = await supabase
    .from("profiles")
    .update({
      available_credits: profile.available_credits + totalCredits,
    })
    .eq("id", order.user_id);

  if (creditsError) {
    console.error("更新用户点数失败:", creditsError);
    return false;
  }

  console.log(`订单 ${order.id} 完成，用户 ${order.user_id} 增加 ${totalCredits} 点数`);
  return true;
}

// ========== 主入口 ==========
Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("缺少session_id参数");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY未配置");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return ok({
        verified: false,
        status: session.payment_status,
        sessionId: session.id,
      });
    }

    const orderUpdated = await updateOrderStatus(sessionId, session);

    return ok({
      verified: true,
      status: "paid",
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      orderUpdated,
    });
  } catch (error) {
    console.error("验证支付失败:", error);
    return fail(error instanceof Error ? error.message : "验证支付失败", 500);
  }
});
