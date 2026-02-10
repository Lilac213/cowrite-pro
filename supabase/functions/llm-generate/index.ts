import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ 统一的 LLM 调用客户端 ============
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMCallOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  content: string;
  model: string;
}

async function callGemini(options: LLMCallOptions): Promise<LLMResponse> {
  const geminiUrl = "https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:generateContent";
  
  const systemInstruction = options.messages.find(m => m.role === 'system')?.content || '';
  const contents = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 4096,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return { content, model: 'gemini-2.5-flash' };
}

async function callQwen(options: LLMCallOptions, apiKey: string): Promise<LLMResponse> {
  const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-plus",
      input: {
        messages: options.messages,
      },
      parameters: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.output?.text || data.output?.choices?.[0]?.message?.content || '';
  
  return { content, model: 'qwen-plus' };
}

async function getQwenApiKey(supabaseClient: any): Promise<string | null> {
  const { data: configData } = await supabaseClient
    .from("system_config")
    .select("config_value")
    .eq("config_key", "llm_api_key")
    .maybeSingle();
  
  return configData?.config_value || Deno.env.get("DASHSCOPE_API_KEY") || null;
}

async function callLLM(options: LLMCallOptions, supabaseClient: any): Promise<LLMResponse> {
  try {
    console.log("尝试调用内置 Gemini 模型...");
    const response = await callGemini(options);
    console.log("✓ Gemini 调用成功");
    return response;
  } catch (geminiError) {
    console.warn("Gemini 调用失败，尝试回退到 Qwen:", geminiError);
    
    try {
      const apiKey = await getQwenApiKey(supabaseClient);
      if (!apiKey) {
        throw new Error(
          "Gemini 调用失败，且未配置 Qwen API 密钥。" +
          "请在管理面板的「系统配置」→「LLM 配置」中配置阿里云 DashScope API 密钥。"
        );
      }
      
      console.log("尝试调用用户配置的 Qwen 模型...");
      const response = await callQwen(options, apiKey);
      console.log("✓ Qwen 调用成功（回退）");
      return response;
    } catch (qwenError) {
      console.error("Qwen 调用也失败:", qwenError);
      throw new Error(`LLM 调用失败：Gemini 和 Qwen 均不可用`);
    }
  }
}
// ============ End of LLM Client ============

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 获取用户认证信息
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 解析请求体
    const { prompt, context, systemMessage } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '缺少 prompt 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建消息数组
    const messages = [
      ...(systemMessage ? [{ role: 'system' as const, content: systemMessage }] : []),
      ...(context ? [{ role: 'user' as const, content: context }] : []),
      { role: 'user' as const, content: prompt },
    ];

    // 调用统一的 LLM 客户端（优先 Gemini，回退 Qwen）
    console.log("调用 LLM 生成内容...");
    const llmResult = await callLLM({
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    }, supabaseClient);

    console.log(`LLM 调用成功，使用模型: ${llmResult.model}`);
    let result = llmResult.content;
    
    // 清理可能的 markdown 代码块标记
    result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("LLM 生成错误:", error);
    return new Response(
      JSON.stringify({ error: error.message || '生成失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
