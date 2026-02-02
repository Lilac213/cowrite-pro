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
    const {
      coreThesis,
      paragraphStructure,
      relationWithPrevious,
      selectedMaterials,
    } = await req.json();

    if (!coreThesis || !paragraphStructure) {
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

    // 构建支撑材料部分
    let materialsSection = '';
    if (selectedMaterials && selectedMaterials.length > 0) {
      materialsSection = '\n【作者选定的支撑材料】\n';
      selectedMaterials.forEach((material: any) => {
        materialsSection += `- ${material.sub_claim}：\n`;
        material.materials.forEach((m: any) => {
          materialsSection += `  * ${m.type}：${m.content}\n`;
        });
      });
    }

    const prompt = `你是写作系统中的【成文与润色模块】。

现在逻辑结构已经确认无误，你的任务是将其转写为自然、连贯的段落文本。

【输入】
- 文章核心论点：${coreThesis}
- 当前段落的完整结构：
  - input_assumption：${paragraphStructure.input_assumption || '无'}
  - core_claim：${paragraphStructure.core_claim}
  - sub_claims：
${paragraphStructure.sub_claims?.map((sc: string, i: number) => `    ${i + 1}. ${sc}`).join('\n') || ''}
  - output_state：${paragraphStructure.output_state || '无'}
${materialsSection}
- 段落与上一段的关系说明：${relationWithPrevious || '首段'}

【你的任务】
1. 将结构转写为一段通顺、自然的文字
2. 必要时加入过渡句，但只用于承接逻辑
3. 保持语气与全文一致

【约束】
- 不新增任何观点或论据
- 不夸大、不总结全文
- 严格忠于输入结构

请直接返回生成的段落文本，不需要JSON格式。`;

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

    // 清理文本（移除可能的markdown标记）
    let cleanedText = fullText.trim();
    cleanedText = cleanedText.replace(/^```.*\n?/gm, '').replace(/```$/gm, '');

    return new Response(
      JSON.stringify({ text: cleanedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate final text error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '生成失败，请重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
