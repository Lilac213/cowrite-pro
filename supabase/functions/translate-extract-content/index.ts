import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: '缺少内容' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 检测语言并提取数据和观点
    const prompt = `请分析以下内容，如果是英文内容，请提炼出数据和观点并翻译成中文；如果是中文内容，直接提炼数据和观点。

标题：${title || '无标题'}

内容：
${content}

请按照以下 JSON 格式返回：
{
  "language": "en/zh",
  "translated_title": "翻译后的标题（如果是英文）或原标题",
  "data_points": [
    {
      "original": "原始数据（如果是英文）",
      "translated": "翻译后的数据",
      "context": "数据的上下文说明"
    }
  ],
  "viewpoints": [
    {
      "original": "原始观点（如果是英文）",
      "translated": "翻译后的观点",
      "supporting_evidence": "支持证据"
    }
  ],
  "summary": "内容摘要（中文）"
}`;

    const response = await fetch('https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.candidates && jsonData.candidates[0]?.content?.parts) {
                const text = jsonData.candidates[0].content.parts[0]?.text || '';
                fullText += text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 提取JSON内容
    let result;
    try {
      result = JSON.parse(fullText);
    } catch (e) {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (e2) {
          throw new Error(`无法解析JSON: ${jsonMatch[1].substring(0, 100)}...`);
        }
      } else {
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = fullText.substring(jsonStart, jsonEnd + 1);
          try {
            result = JSON.parse(jsonStr);
          } catch (e3) {
            throw new Error(`无法解析返回的JSON结构。返回内容: ${fullText.substring(0, 200)}...`);
          }
        } else {
          throw new Error(`响应中未找到JSON结构。返回内容: ${fullText.substring(0, 200)}...`);
        }
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Translation error:', error);
    const errorMessage = error instanceof Error ? error.message : '翻译提取失败，请重试';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
