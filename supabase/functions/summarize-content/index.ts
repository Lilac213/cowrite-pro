import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

async function getQwenApiKey(): Promise<string | null> {
  return Deno.env.get("DASHSCOPE_API_KEY") || null;
}

async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  try {
    console.log("尝试调用内置 Gemini 模型...");
    const response = await callGemini(options);
    console.log("✓ Gemini 调用成功");
    return response;
  } catch (geminiError) {
    console.warn("Gemini 调用失败，尝试回退到 Qwen:", geminiError);
    
    try {
      const apiKey = await getQwenApiKey();
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

const SUMMARIZE_PROMPT = `你是一位专业的内容分析专家。请分析以下文本内容，提取关键信息。

任务：
1. 生成简洁的摘要（100-200字）
2. 提取3-8个关键标签（关键词），用于后续检索

要求：
- 摘要应准确概括核心观点和案例
- 标签应具体、有代表性，便于检索
- 标签格式：["标签1", "标签2", "标签3"]

请以 JSON 格式返回：
{
  "summary": "摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}

文本内容：
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content) {
      throw new Error('缺少必需参数：content');
    }

    // 调用统一的 LLM 客户端（优先 Gemini，回退 Qwen）
    console.log("调用 LLM 生成摘要...");
    const llmResult = await callLLM({
      messages: [
        {
          role: 'user',
          content: SUMMARIZE_PROMPT + content,
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    console.log(`LLM 调用成功，使用模型: ${llmResult.model}`);
    const resultText = llmResult.content;

    // 解析 JSON 响应
    let result;
    try {
      // 尝试提取 JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 JSON 响应');
      }
    } catch (parseError) {
      console.error('JSON 解析错误:', parseError);
      // 如果解析失败，返回默认结果
      result = {
        summary: resultText.substring(0, 200),
        tags: [],
      };
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('摘要生成错误:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
