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
    const { topic, requirements, referenceArticles, materials } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: '缺少主题信息' }),
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
    let context = `主题：${topic}\n\n`;
    
    if (requirements) {
      context += `要求：${JSON.stringify(requirements, null, 2)}\n\n`;
    }

    if (referenceArticles && referenceArticles.length > 0) {
      context += `参考文章：\n`;
      referenceArticles.forEach((article: any, index: number) => {
        context += `${index + 1}. ${article.title}\n${article.content.substring(0, 500)}...\n\n`;
      });
    }

    if (materials && materials.length > 0) {
      context += `个人素材：\n`;
      materials.forEach((material: any, index: number) => {
        context += `${index + 1}. ${material.title}\n${material.content.substring(0, 300)}...\n\n`;
      });
    }

    const prompt = `你是一位专业的论证结构设计专家。请根据以下信息，设计一个文章级的论证结构。

${context}

请设计一个清晰的论证结构，包括：
1. 核心论点（core_thesis）：一句话概括文章要证明什么
2. 论证块（argument_blocks）：3-5个论证块，每个包含：
   - title: 论证块标题
   - description: 该论证块的作用和要证明的内容
   - order: 顺序编号

要求：
- 论证块之间要有逻辑递进关系
- 每个论证块的作用要明确
- 不涉及具体案例或数据，只关注论证方向
- 确保整体结构完整（引入→展开→总结）

请以JSON格式返回，格式如下：
{
  "core_thesis": "核心论点",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "论证块描述",
      "order": 1
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
            content: '你是一位专业的论证结构设计专家，擅长设计清晰的文章论证框架。',
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
    const structure = JSON.parse(result.choices[0].message.content);

    return new Response(
      JSON.stringify(structure),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
