import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiKey = Deno.env.get('LLM_API_KEY');
    const apiUrl = Deno.env.get('LLM_API_URL') || 'https://api.openai.com/v1/chat/completions';
    const model = Deno.env.get('LLM_MODEL') || 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error('未配置 LLM API 密钥');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: SUMMARIZE_PROMPT + content,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`LLM API 错误: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const resultText = data.choices[0]?.message?.content || '';

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
