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
      paragraphSummary,
      articleStructure,
      argumentBlock,
      referenceArticles,
      materials,
      knowledgeBase,
    } = await req.json();

    if (!paragraphSummary) {
      return new Response(
        JSON.stringify({ error: '缺少段落摘要信息' }),
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
    let context = `段落摘要：${paragraphSummary}\n\n`;
    
    if (articleStructure) {
      context += `文章核心论点：${articleStructure.core_thesis}\n\n`;
    }

    if (argumentBlock) {
      context += `所属论证块：${argumentBlock.title}\n${argumentBlock.description}\n\n`;
    }

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

    const prompt = `你是一位专业的论证结构设计专家。请根据以下信息，为这个段落设计论证结构。

${context}

请设计段落级的论证结构，包括：
1. 总论据（main_argument）：该段落的核心论点，一句话
2. 分论据（sub_arguments）：2-3个分论据，每个包含：
   - content: 分论据内容
   - order: 顺序编号
3. 小总结（conclusion）：对该段落论证的总结

要求：
- 只提炼观点结构，不生成完整段落文本
- 不使用修辞与文采，只关注论证逻辑
- 分论据之间要有逻辑关系（递进或并列）
- 必须与文章级论证结构保持一致
- 不虚构具体案例或数据

请以JSON格式返回，格式如下：
{
  "main_argument": "总论据",
  "sub_arguments": [
    {
      "id": "sub_1",
      "content": "分论据内容",
      "order": 1
    }
  ],
  "conclusion": "小总结"
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
            content: '你是一位专业的论证结构设计专家，擅长提炼论证要点和逻辑结构。',
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
    const reasoning = JSON.parse(result.choices[0].message.content);

    return new Response(
      JSON.stringify(reasoning),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
