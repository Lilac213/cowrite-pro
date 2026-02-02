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
    const { coreThesis, paragraphs } = await req.json();

    if (!coreThesis || !paragraphs || !Array.isArray(paragraphs)) {
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

    // 构建段落列表
    let paragraphList = '';
    paragraphs.forEach((para: any, index: number) => {
      paragraphList += `段落 ${index + 1}：\n`;
      paragraphList += `  - input_assumption: ${para.input_assumption || '无'}\n`;
      paragraphList += `  - core_claim: ${para.core_claim}\n`;
      paragraphList += `  - output_state: ${para.output_state || '无'}\n\n`;
    });

    const prompt = `你是写作系统中的【段落连贯性校验模块】。

请对以下段落结构进行逻辑诊断，不要改写任何内容。

【输入】
- 文章核心论点：${coreThesis}
- 段落结构列表（每段包含：
  input_assumption / core_claim / output_state）

${paragraphList}

【你的任务】
逐段分析并输出：
1. 本段的论证角色
2. 与上一段的关系是否清晰
3. 是否存在逻辑跳跃、重复或断裂
4. 是否需要显式过渡（是 / 否 + 原因）

【输出格式】
段落 X：
- 论证角色：
- 连贯性判断：通过 / 有问题
- 问题说明（如有）：
- 是否建议增加过渡：是 / 否

【约束】
- 不生成正文
- 不提出具体改写文本

请将输出转换为JSON格式返回：
{
  "coherence_check": [
    {
      "paragraph_index": 1,
      "role": "论证角色",
      "coherence_status": "通过/有问题",
      "issues": "问题说明（如有）",
      "needs_transition": "是/否",
      "transition_reason": "原因说明"
    }
  ],
  "overall_assessment": "整体连贯性评价"
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

    if (!result.coherence_check) {
      throw new Error('返回的结构缺少必要字段');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify coherence error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '校验失败，请重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
