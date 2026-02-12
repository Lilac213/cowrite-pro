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
    const { articleTopic, coreClaim, subClaim } = await req.json();

    if (!articleTopic || !coreClaim || !subClaim) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
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

    const prompt = `你是写作系统中的【论据与支撑材料模块】。

【上下文】
- 文章主题：${articleTopic}
- 当前段落 core_claim：${coreClaim}
- 当前 sub_claim（仅针对这一条）：${subClaim}

【你的任务】
为该分论据提供 1–3 条【可选支撑材料】。

支撑材料类型可包括：
- 行业 / 写作实践案例
- 数据或研究结论（如不确定请标注）
- 类比或通俗解释

【输出格式】
sub_claim：
可选支撑材料：
- 类型：
  内容：
- 类型：
  内容：

【约束】
- 明确标注不确定性
- 不生成结论性判断
- 不假设作者一定会使用

请将输出转换为JSON格式返回：
{
  "sub_claim": "${subClaim}",
  "supporting_materials": [
    {
      "type": "案例/数据/类比",
      "content": "具体内容",
      "uncertainty": "如有不确定性请标注"
    }
  ]
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
        result = JSON.parse(jsonMatch[1]);
      } else {
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          result = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法解析返回的JSON结构');
        }
      }
    }

    console.log('[generate-evidence] 验证返回结构');
    console.log('[generate-evidence] 返回数据类型:', typeof result);
    console.log('[generate-evidence] 返回数据内容:', JSON.stringify(result, null, 2));
    
    if (!result.supporting_materials) {
      console.error('[generate-evidence] ❌ 返回的结构缺少必要字段: supporting_materials');
      console.error('[generate-evidence] 实际字段列表:', Object.keys(result).join(', '));
      console.error('[generate-evidence] 完整结构内容:', JSON.stringify(result, null, 2));
      throw new Error(`返回的结构缺少必要字段: supporting_materials。实际字段: ${Object.keys(result).join(', ')}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate evidence error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '生成失败，请重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
