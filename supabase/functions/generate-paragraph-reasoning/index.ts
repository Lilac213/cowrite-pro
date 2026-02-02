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

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建上下文
    let context = `【段落摘要】\n${paragraphSummary}\n\n`;
    
    if (articleStructure) {
      context += `【文章核心论点】\n${articleStructure.core_thesis}\n\n`;
    }

    if (argumentBlock) {
      context += `【所属论证块】\n${argumentBlock.title}\n${argumentBlock.description}\n\n`;
    }

    if (referenceArticles && referenceArticles.length > 0) {
      context += `【参考文章】\n`;
      referenceArticles.forEach((article: any, index: number) => {
        context += `${index + 1}. ${article.title}\n${article.content.substring(0, 400)}...\n\n`;
      });
    }

    if (materials && materials.length > 0) {
      context += `【个人素材】\n`;
      materials.forEach((material: any, index: number) => {
        context += `${index + 1}. ${material.title}\n${material.content.substring(0, 300)}...\n\n`;
      });
    }

    if (knowledgeBase && knowledgeBase.length > 0) {
      context += `【资料查询结果】\n`;
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

请严格按照以下JSON格式返回：
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
    let reasoning;
    try {
      reasoning = JSON.parse(fullText);
    } catch (e) {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        reasoning = JSON.parse(jsonMatch[1]);
      } else {
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          reasoning = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法解析返回的JSON结构');
        }
      }
    }

    if (!reasoning.main_argument || !reasoning.sub_arguments || !reasoning.conclusion) {
      throw new Error('返回的结构缺少必要字段');
    }

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
