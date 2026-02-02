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

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建上下文
    let context = `【写作目标/主题】\n${topic}\n\n`;
    
    if (requirements) {
      context += `【目标读者和要求】\n${JSON.stringify(requirements, null, 2)}\n\n`;
    }

    if (referenceArticles && referenceArticles.length > 0) {
      context += `【参考文章摘要】\n`;
      referenceArticles.forEach((article: any, index: number) => {
        context += `${index + 1}. ${article.title}\n${article.content.substring(0, 500)}...\n\n`;
      });
    }

    if (materials && materials.length > 0) {
      context += `【作者已有观点或素材】\n`;
      materials.forEach((material: any, index: number) => {
        context += `${index + 1}. ${material.title}\n${material.content.substring(0, 300)}...\n\n`;
      });
    }

    const prompt = `你是写作系统中的「文章级论证架构模块」。

请基于以下输入，构建文章的整体论证结构，而不是生成正文内容。

${context}

【你的任务】
1. 提炼文章的「核心论点」（一句话）
2. 拆分 3–5 个一级论证块（章节级）
3. 说明每个论证块的作用（为什么需要这一块）
4. 标注论证块之间的关系（并列 / 递进 / 因果 / 对比）

【输出格式要求】
请严格按照以下JSON格式返回：
{
  "core_thesis": "核心论点（一句话）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "该论证块的作用说明",
      "order": 1,
      "relation": "与前一块的关系（递进/并列/因果/对比）"
    }
  ]
}

【约束】
- 不生成具体段落
- 不引用案例、数据或研究
- 输出应稳定、抽象、可编辑
- 论证块之间要有清晰的逻辑关系
- 确保整体结构完整（引入→展开→总结）`;

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
      // 尝试直接解析
      structure = JSON.parse(fullText);
    } catch (e) {
      // 尝试从markdown代码块中提取
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        structure = JSON.parse(jsonMatch[1]);
      } else {
        // 尝试查找JSON对象
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          structure = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法解析返回的JSON结构');
        }
      }
    }

    // 确保返回的结构包含必要字段
    if (!structure.core_thesis || !structure.argument_blocks) {
      throw new Error('返回的结构缺少必要字段');
    }

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
