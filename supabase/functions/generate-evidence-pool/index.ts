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
      subArguments,
      referenceArticles,
      materials,
      knowledgeBase,
    } = await req.json();

    if (!subArguments || subArguments.length === 0) {
      return new Response(
        JSON.stringify({ error: '缺少分论据信息' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LLM_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LLM API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建上下文
    let context = `分论据列表：\n`;
    subArguments.forEach((arg: any, index: number) => {
      context += `${index + 1}. ${arg.content}\n`;
    });
    context += '\n';

    if (referenceArticles && referenceArticles.length > 0) {
      context += `参考文章：\n`;
      referenceArticles.forEach((article: any, index: number) => {
        context += `${index + 1}. ${article.title}\n${article.content.substring(0, 400)}...\n\n`;
      });
    }

    if (materials && materials.length > 0) {
      context += `个人素材：\n`;
      materials.forEach((material: any, index: number) => {
        context += `${index + 1}. ${material.title}\n${material.content.substring(0, 300)}...\n\n`;
      });
    }

    if (knowledgeBase && knowledgeBase.length > 0) {
      context += `资料查询结果：\n`;
      knowledgeBase.forEach((item: any, index: number) => {
        context += `${index + 1}. ${item.title}\n${item.content.substring(0, 300)}...\n\n`;
      });
    }

    const prompt = `你是一位专业的论证支撑专家。请为每个分论据提供可选的支撑材料。

${context}

请为每条分论据提供1-3条候选支撑材料，类型包括：
- case: 行业或真实案例
- data: 数据或研究结论（如不确定需标注）
- analogy: 类比或通俗解释

要求：
- 支撑材料要与分论据直接相关
- 如果是数据或研究结论，必须标注不确定性
- 不虚构明确事实或具体来源
- 提供的是候选材料，作者可选择是否采用

请以JSON格式返回，格式如下：
{
  "evidence_pool": [
    {
      "id": "evidence_1",
      "sub_argument_id": "sub_1",
      "type": "case",
      "content": "支撑材料内容",
      "source": "来源（可选）",
      "uncertainty": "不确定性说明（可选）",
      "selected": false
    }
  ]
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的论证支撑专家，擅长为论点提供恰当的支撑材料。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `LLM API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const evidenceData = JSON.parse(result.choices[0].message.content);

    return new Response(
      JSON.stringify(evidenceData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
