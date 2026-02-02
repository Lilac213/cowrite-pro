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

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建上下文
    let context = `【分论据列表】\n`;
    subArguments.forEach((arg: any, index: number) => {
      context += `${index + 1}. (ID: ${arg.id}) ${arg.content}\n`;
    });
    context += '\n';

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

请严格按照以下JSON格式返回：
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
    let evidenceData;
    try {
      evidenceData = JSON.parse(fullText);
    } catch (e) {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        evidenceData = JSON.parse(jsonMatch[1]);
      } else {
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          evidenceData = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法解析返回的JSON结构');
        }
      }
    }

    if (!evidenceData.evidence_pool) {
      throw new Error('返回的结构缺少evidence_pool字段');
    }

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
