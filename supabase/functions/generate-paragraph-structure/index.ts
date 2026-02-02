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
      currentArgumentBlock,
      blockTask,
      previousParagraphTask,
      relationWithPrevious,
      newInformation,
      referenceContent,
      authorMaterials,
      retrievedData,
    } = await req.json();

    if (!coreThesis || !currentArgumentBlock) {
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

    // 构建输入素材部分
    let materialsSection = '';
    if (referenceContent) {
      materialsSection += `- 参考内容（如有）：\n${referenceContent}\n`;
    }
    if (authorMaterials) {
      materialsSection += `- 作者个人素材（如有）：\n${authorMaterials}\n`;
    }
    if (retrievedData) {
      materialsSection += `- 检索资料摘要（如有）：\n${retrievedData}\n`;
    }

    const prompt = `你是写作系统中的【段落级推理模块】。

你只负责生成"段落的论证结构"，而不是正文。

【文章级约束】
- 核心论点：${coreThesis}
- 当前段落所属论证块：${currentArgumentBlock}
- 该论证块的论证任务：${blockTask || '展开论证'}

【段落关系信息】
- 上一段完成的论证任务：${previousParagraphTask || '无（首段）'}
- 当前段与上一段的关系：
  ${relationWithPrevious || '承接'}
- 当前段新增的信息是什么：${newInformation || '待确定'}

【输入素材】
${materialsSection || '- 无'}

【你的任务】
按以下顺序输出段落结构：
1. input_assumption（承接前文的前提）
2. core_claim（本段要证明的核心主张）
3. sub_claims（1–3 条分论据）
4. output_state（为下一段铺垫的逻辑出口）

【输出格式】
input_assumption：
core_claim：
- sub_claim 1：
- sub_claim 2：
- sub_claim 3（如有）：
output_state：

【约束】
- 不生成完整句段
- 不引入案例、数据
- 所有内容必须服务于文章级论证块

请将输出转换为JSON格式返回：
{
  "input_assumption": "承接前文的前提",
  "core_claim": "本段要证明的核心主张",
  "sub_claims": [
    "分论据1",
    "分论据2",
    "分论据3（如有）"
  ],
  "output_state": "为下一段铺垫的逻辑出口"
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
    let structure;
    try {
      structure = JSON.parse(fullText);
    } catch (e) {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        structure = JSON.parse(jsonMatch[1]);
      } else {
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          structure = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法解析返回的JSON结构');
        }
      }
    }

    if (!structure.core_claim || !structure.sub_claims) {
      throw new Error('返回的结构缺少必要字段');
    }

    return new Response(
      JSON.stringify(structure),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate paragraph structure error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '生成失败，请重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
