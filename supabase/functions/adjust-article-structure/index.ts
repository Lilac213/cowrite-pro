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
    const { coreThesis, argumentBlocks, operation, blockIndex } = await req.json();

    if (!coreThesis || !argumentBlocks) {
      return new Response(
        JSON.stringify({ error: '缺少核心论点或论证块信息' }),
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

    // 构建当前结构描述
    let currentStructure = `核心论点：${coreThesis}\n\n当前论证块：\n`;
    argumentBlocks.forEach((block: any, index: number) => {
      currentStructure += `${index + 1}. ${block.title}\n   作用：${block.description}\n`;
    });

    let taskDescription = '';
    if (operation === 'add') {
      taskDescription = `用户在位置 ${blockIndex + 1} 添加了一个新的论证块。请为这个新论证块生成合适的标题和作用说明，并确保与前后论证块的逻辑关系流畅。同时检查最后一个论证块是否为总结性质（复述总论点/总结升华/展望未来），如果不是，请调整最后一个论证块使其成为合适的结尾。`;
    } else if (operation === 'delete') {
      taskDescription = `用户删除了位置 ${blockIndex + 1} 的论证块。请调整剩余论证块的关系说明，确保整体论证流畅。同时确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
    } else if (operation === 'modify') {
      taskDescription = `用户修改了位置 ${blockIndex + 1} 的论证块。请检查并调整相邻论证块的关系说明，确保整体论证连贯。同时确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
    } else {
      taskDescription = `请检查整体论证结构的连贯性，确保论证块之间的关系清晰，并确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
    }

    const prompt = `你是写作系统中的「文章级论证架构调整模块」。

【当前结构】
${currentStructure}

【调整任务】
${taskDescription}

【要求】
1. 保持核心论点不变
2. 确保论证块之间的逻辑关系清晰（并列/递进/因果/对比）
3. 最后一个论证块必须是总结性质：复述总论点、总结升华或展望未来
4. 整体结构应该完整：引入→展开→总结
5. 不生成具体段落内容
6. 输出应稳定、抽象、可编辑

请返回调整后的完整结构，JSON格式：
{
  "core_thesis": "核心论点（保持不变）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "该论证块的作用",
      "order": 1,
      "relation": "与前一块的关系"
    }
  ],
  "structure_relations": "整体结构关系说明"
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
