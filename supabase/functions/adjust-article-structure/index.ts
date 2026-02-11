import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 字符归一化清洗 - 将中文标点符号转换为英文标点
 */
function normalizeJsonString(raw: string): string {
  return raw
    .replace(/[""]/g, '"')      // 中文双引号 → 英文双引号
    .replace(/['']/g, "'")      // 中文单引号 → 英文单引号
    .replace(/：/g, ':')        // 中文冒号 → 英文冒号
    .replace(/，/g, ',')        // 中文逗号 → 英文逗号
    .replace(/（/g, '(')        // 中文左括号 → 英文左括号
    .replace(/）/g, ')')        // 中文右括号 → 英文右括号
    .replace(/\u00A0/g, ' ')    // 不可见空格 → 普通空格
    .replace(/\u200B/g, '')     // 零宽字符 → 删除
    .replace(/\uFEFF/g, '');    // BOM字符 → 删除
}

/**
 * 提取第一个JSON对象 - 防止前后文本污染
 */
function extractFirstJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('未找到JSON对象');
  }
  return match[0];
}

/**
 * 解析信封模式JSON - 三层防护策略
 */
function parseEnvelopeJson(rawText: string): any {
  console.log('[parseEnvelope] 原始文本长度:', rawText.length);
  
  try {
    // Step 1: 提取第一个JSON块
    const extracted = extractFirstJsonBlock(rawText);
    
    // Step 2: 字符归一化清洗
    const normalized = normalizeJsonString(extracted);
    
    // Step 3: 解析外层信封
    const envelope = JSON.parse(normalized);
    console.log('[parseEnvelope] 外层信封解析成功, type:', envelope.type);
    
    // Step 4: 验证信封结构
    if (!envelope.type || typeof envelope.payload !== 'string') {
      throw new Error('信封格式无效: 缺少 type 或 payload 不是字符串');
    }
    
    // Step 5: 归一化并解析 payload 字符串
    if (!envelope.payload || envelope.payload.trim() === '') {
      console.warn('[parseEnvelope] payload 为空');
      return null;
    }
    
    const payloadNormalized = normalizeJsonString(envelope.payload);
    const content = JSON.parse(payloadNormalized);
    console.log('[parseEnvelope] payload 解析成功');
    
    return content;
  } catch (error) {
    console.error('[parseEnvelope] 解析失败:', error);
    console.error('[parseEnvelope] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`信封JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
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

【输出要求 - 信封模式】
你必须严格输出一个固定结构的JSON对象, 且只能包含以下两个字段:
- type: 固定值 "adjust_article_structure"
- payload: 字符串类型, 内容是调整后结构JSON的字符串形式

重要规则:
1. 外层JSON必须始终合法, 只有type和payload两个字段
2. payload是字符串, 不是JSON对象, 需要将内部JSON转换为字符串
3. 不要在外层JSON之外输出任何文字
4. 不要使用markdown代码块
5. 如果无法生成内容, payload可以是空字符串
6. 禁止使用中文标点符号（""''：，等），必须使用英文标点符号
7. 所有字符串必须使用英文双引号 "

输出格式示例:
{
  "type": "adjust_article_structure",
  "payload": "{\"core_thesis\":\"示例\",\"argument_blocks\":[]}"
}

payload字符串内部应包含的结构:
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
      structure = parseEnvelopeJson(fullText);
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
