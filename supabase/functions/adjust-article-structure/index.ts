import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 提取JSON对象 - 只保留第一个 { 到最后一个 } 之间的内容
 */
function extractJSONObject(rawText: string): string {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('未在LLM输出中找到JSON对象（缺少 { 或 }）');
  }
  
  if (lastBrace <= firstBrace) {
    throw new Error('JSON对象边界无效（} 在 { 之前）');
  }
  
  return rawText.slice(firstBrace, lastBrace + 1);
}

/**
 * 解析JSON - 先提取边界，再解析
 */
function parseJsonSafely(rawText: string): any {
  console.log('[parseJson] 原始文本长度:', rawText.length);
  
  try {
    // Step 1: 提取JSON对象边界
    const jsonText = extractJSONObject(rawText);
    console.log('[parseJson] 提取后长度:', jsonText.length);
    
    // Step 2: 解析JSON
    const result = JSON.parse(jsonText);
    console.log('[parseJson] 解析成功');
    return result;
  } catch (error) {
    console.error('[parseJson] 解析失败:', error);
    console.error('[parseJson] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

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
}

重要提示：
1. 必须输出纯JSON, 不要包含markdown代码块
2. 所有字符串字段中禁止出现中文引号, 中文逗号, 中文冒号或任何全角标点符号
3. 确保JSON格式完全正确, 可以被JSON.parse()直接解析`;

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
      structure = parseJsonSafely(fullText);
    } catch (error) {
      console.error('[adjust-article-structure] JSON解析失败:', error);
      return new Response(
        JSON.stringify({ 
          error: `JSON解析失败: ${error instanceof Error ? error.message : String(error)}`,
          raw_output: fullText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!structure.core_thesis || !structure.argument_blocks) {
      console.error('Missing required fields in structure:', structure);
      throw new Error(`返回的结构缺少必要字段。当前结构: ${JSON.stringify(structure)}`);
    }

    // 确保保留原始的block id，并为新增的块生成新ID
    if (argumentBlocks && Array.isArray(argumentBlocks)) {
      const timestamp = Date.now();
      structure.argument_blocks = structure.argument_blocks.map((block: any, index: number) => {
        // 尝试通过标题匹配原始块
        const matchedOriginal = argumentBlocks.find((orig: any) => 
          orig.title === block.title || orig.description === block.description
        );
        
        // 如果找到匹配的原始块，保留其ID；否则生成新ID
        const blockId = matchedOriginal?.id || `block_${timestamp}_${index}`;
        
        return {
          ...block,
          id: blockId,
          order: index + 1,
        };
      });
    }

    return new Response(
      JSON.stringify(structure),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Adjust structure error:', error);
    const errorMessage = error instanceof Error ? error.message : '调整失败，请重试';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
