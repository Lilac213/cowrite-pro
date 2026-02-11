import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * 清理JSON字符串，移除控制字符和修复常见问题
 */
function cleanJsonString(jsonStr: string): string {
  return jsonStr
    // 移除markdown代码块标记
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    // 替换中文标点为英文标点（JSON中必须使用英文标点）
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    // 移除所有控制字符（除了空格、换行、制表符）
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // 将换行符和制表符替换为空格（在JSON字符串值内）
    .replace(/(?<!\\)(\\r|\\n|\\t)/g, ' ')
    // 移除多余的逗号（在}或]之前）
    .replace(/,(\s*[}\]])/g, '$1')
    // 修复缺失的逗号（在}或]之后，下一个"之前）
    .replace(/([}\]])(\s*)(")/g, '$1,$2$3')
    // 合并多个空格
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 尝试多种策略解析JSON
 */
function parseJsonWithFallback(text: string): any {
  // 先记录原始文本的前200个字符用于调试
  console.log('[parseJsonWithFallback] 原始文本前200字符:', text.substring(0, 200));
  console.log('[parseJsonWithFallback] 文本长度:', text.length);
  console.log('[parseJsonWithFallback] 是否包含```:', text.includes('```'));
  
  const strategies = [
    // 策略1: 直接解析原始文本
    () => {
      console.log('[策略1] 尝试直接解析原始文本');
      return JSON.parse(text);
    },
    
    // 策略2: 从markdown代码块提取（优先处理，因为LLM经常返回代码块）
    () => {
      console.log('[策略2] 尝试从markdown代码块提取');
      // 匹配 ```json ... ``` 或 ``` ... ```
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        console.log('[策略2] 找到代码块，内容前100字符:', jsonMatch[1].substring(0, 100));
        const extracted = jsonMatch[1].trim();
        // 清理并解析
        const cleaned = cleanJsonString(extracted);
        console.log('[策略2] 清理后前100字符:', cleaned.substring(0, 100));
        return JSON.parse(cleaned);
      }
      throw new Error('未找到markdown代码块');
    },
    
    // 策略3: 清理整个文本后解析
    () => {
      console.log('[策略3] 尝试清理整个文本后解析');
      const cleaned = cleanJsonString(text);
      console.log('[策略3] 清理后前100字符:', cleaned.substring(0, 100));
      return JSON.parse(cleaned);
    },
    
    // 策略4: 提取JSON对象边界
    () => {
      console.log('[策略4] 尝试提取JSON对象边界');
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = text.substring(jsonStart, jsonEnd + 1);
        console.log('[策略4] 提取的JSON前100字符:', jsonStr.substring(0, 100));
        const cleaned = cleanJsonString(jsonStr);
        console.log('[策略4] 清理后前100字符:', cleaned.substring(0, 100));
        return JSON.parse(cleaned);
      }
      throw new Error('未找到有效的JSON对象边界');
    }
  ];
  
  const errors: string[] = [];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`[parseJsonWithFallback] 尝试策略 ${i + 1}`);
      const result = strategies[i]();
      console.log(`[parseJsonWithFallback] 策略 ${i + 1} 成功`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`策略${i + 1}: ${errorMsg}`);
      console.log(`[parseJsonWithFallback] 策略 ${i + 1} 失败: ${errorMsg}`);
    }
  }
  
  throw new Error(`所有解析策略均失败:\n${errors.join('\n')}`);
}

// 输入接口定义
interface StructureAgentInput {
  topic: string;
  user_core_thesis?: string | null;
  confirmed_insights: Array<{
    id: string;
    category: string;
    content: string;
    source_insight_id: string;
  }>;
  context_flags: {
    confirmed_insight_count: number;
    contradictions_or_gaps_present: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-article-structure] ========== 收到请求 ==========');
    const body = await req.json();
    console.log('[generate-article-structure] 请求体:', JSON.stringify(body, null, 2));
    
    // 支持两种输入格式：
    // 1. 新格式：{ input: StructureAgentInput }
    // 2. 旧格式（兼容）：{ topic, requirements, referenceArticles, materials, writingSummary }
    let input: StructureAgentInput;
    let inputJson: string;
    
    if (body.input) {
      // 新格式
      console.log('[generate-article-structure] 使用新格式输入');
      input = body.input;
      
      // 清理输入数据，移除控制字符
      if (input.confirmed_insights) {
        input.confirmed_insights = input.confirmed_insights.map(insight => ({
          ...insight,
          content: (insight.content || '')
            .replace(/[\x00-\x1F\x7F]/g, ' ')  // 移除所有控制字符
            .replace(/\s+/g, ' ')               // 合并多个空格
            .trim()
            .substring(0, 500)                  // 限制长度
        }));
      }
      
      inputJson = JSON.stringify(input, null, 2);
      console.log('[generate-article-structure] 输入数据（已清理）:', inputJson.substring(0, 1000));
    } else {
      // 旧格式 - 转换为新格式（用于向后兼容）
      console.log('[generate-article-structure] 使用旧格式输入（兼容模式）');
      const { topic, requirements, referenceArticles, materials, writingSummary } = body;
      
      if (!topic) {
        console.error('[generate-article-structure] 错误: 缺少主题信息');
        return new Response(
          JSON.stringify({ error: '缺少主题信息或输入数据' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 构建兼容的输入
      const confirmedInsights: any[] = [];
      
      if (writingSummary && writingSummary.ready_to_cite) {
        confirmedInsights.push({
          id: 'legacy_1',
          category: '研究摘要',
          content: writingSummary.ready_to_cite,
          source_insight_id: 'legacy_1'
        });
      }
      
      if (referenceArticles && referenceArticles.length > 0) {
        referenceArticles.forEach((article: any, index: number) => {
          // 安全地截取内容，避免JSON解析错误
          const safeContent = (article.content || '').substring(0, 300).replace(/[\n\r]/g, ' ');
          confirmedInsights.push({
            id: `ref_${index + 1}`,
            category: '参考文章',
            content: `${article.title || '无标题'}: ${safeContent}`,
            source_insight_id: `ref_${index + 1}`
          });
        });
      }
      
      if (materials && materials.length > 0) {
        materials.forEach((material: any, index: number) => {
          // 安全地截取内容，避免JSON解析错误
          const safeContent = (material.content || '').substring(0, 200).replace(/[\n\r]/g, ' ');
          confirmedInsights.push({
            id: `mat_${index + 1}`,
            category: '作者素材',
            content: `${material.title || '无标题'}: ${safeContent}`,
            source_insight_id: `mat_${index + 1}`
          });
        });
      }

      input = {
        topic,
        user_core_thesis: null,
        confirmed_insights: confirmedInsights,
        context_flags: {
          confirmed_insight_count: confirmedInsights.length,
          contradictions_or_gaps_present: false
        }
      };
      
      inputJson = JSON.stringify(input, null, 2);
      console.log('[generate-article-structure] 转换后的输入数据:', inputJson);
    }

    if (!input.topic) {
      console.error('[generate-article-structure] 错误: 输入数据缺少主题');
      return new Response(
        JSON.stringify({ error: '缺少主题信息' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!input.confirmed_insights || input.confirmed_insights.length === 0) {
      console.error('[generate-article-structure] 错误: 没有确认的洞察');
      return new Response(
        JSON.stringify({ error: '没有确认的研究洞察，无法生成文章结构' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-article-structure] 验证通过，准备调用 LLM');
    console.log('[generate-article-structure] 主题:', input.topic);
    console.log('[generate-article-structure] 确认的洞察数量:', input.confirmed_insights.length);

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      console.error('[generate-article-structure] 错误: API密钥未配置');
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `你是 CoWrite 的【文章级论证架构 Agent（User-Gated）】。

你的职责不是写文章，而是：
基于【用户已确认的研究洞察】，生成一份【可编辑、可确认的文章论证结构草案】。

────────────────
🔒 输入前提（强制）
────────────────
- 你只能使用 user 已确认（confirmed）的洞察
- 任何 pending / optional / ignored 的内容一律不可使用
- 不允许引入新观点、新材料或隐含前提
- 若已确认洞察不足以支撑结构，必须明确指出，而不是补全

────────────────
【输入】
────────────────
以下是结构化 JSON 数据，请严格按字段理解：

${inputJson}

────────────────
【你的任务】
────────────────
1. 基于 confirmed_insights，提炼文章核心论点（一句话）
   - 若 user_core_thesis 已提供，必须完全服从
2. 拆分 3–5 个一级论证块（章节级）
3. 为每个论证块明确"论证任务"（说明要证明什么，而不是写什么）
4. 说明论证块之间的逻辑关系（递进 / 并列 / 因果 / 对比 等）

────────────────
🔒 结构边界
────────────────
- 不生成正文内容
- 不展开案例、数据或引用
- 不处理研究冲突与空白（除非已被升级为 confirmed_insight）
- 输出必须保持高度可编辑性，便于用户删除或重排

────────────────
【输出要求】
────────────────
- 仅以 JSON 输出，不要包含任何其他文字说明
- 确保 JSON 格式完全正确，可以被 JSON.parse() 直接解析
- 所有字符串值必须正确转义，不能包含未转义的引号、换行符、制表符等控制字符
- 字符串中的换行请使用 \\n，制表符使用 \\t，引号使用 \\"
- 结构生成后必须停在等待用户确认状态
- 不得进入写作阶段

请严格按照以下 JSON 格式输出（注意：derived_from 数组中的值必须是字符串）：
{
  "core_thesis": "核心论点（一句话，不能包含换行符）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题（不能包含换行符）",
      "description": "论证任务说明（要证明什么，不能包含换行符）",
      "order": 1,
      "relation": "与前一块的关系（起始论证块 / 递进 / 并列 / 因果 / 对比等）",
      "derived_from": ["insight_id_1", "insight_id_2"],
      "user_editable": true
    }
  ],
  "structure_relations": "整体结构关系说明（不能包含换行符）",
  "status": "awaiting_user_confirmation",
  "allowed_user_actions": ["edit_core_thesis", "delete_block", "reorder_blocks"]
}

重要提示：
1. 必须使用英文标点符号：冒号用 : 不用 ：，逗号用 , 不用 ，，引号用 " 不用 " 或 "
2. 所有字符串中的引号必须转义为 \\"
3. 所有字符串中的换行符必须转义为 \\n
4. 所有字符串中的制表符必须转义为 \\t
5. derived_from 数组中只能包含字符串类型的 insight ID
6. 不要在 JSON 外添加任何解释性文字
7. 不要使用 markdown 代码块包裹 JSON（不要用三个反引号）
8. 直接输出纯 JSON，确保可以被 JSON.parse() 直接解析，没有语法错误

示例（注意使用英文标点）:
{
  "core_thesis": "这是核心论点",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "标题",
      "description": "描述",
      "order": 1,
      "relation": "起始论证块",
      "derived_from": ["insight_1"],
      "user_editable": true
    }
  ]
}`;

    console.log('[generate-article-structure] 开始调用 Gemini API');
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
        ],
        generationConfig: {
          temperature: 0.3,  // 降低温度以获得更稳定的输出
          maxOutputTokens: 4096,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-article-structure] API请求失败:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-article-structure] API响应成功，开始读取流式数据');
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

    console.log('[generate-article-structure] 流式数据读取完成，总长度:', fullText.length);
    console.log('[generate-article-structure] 原始响应内容（前500字符）:', fullText.substring(0, 500));

    // 使用多策略解析JSON
    let structure;
    try {
      console.log('[generate-article-structure] 开始解析JSON');
      structure = parseJsonWithFallback(fullText);
      console.log('[generate-article-structure] JSON解析成功');
    } catch (error) {
      console.error('[generate-article-structure] JSON解析失败:', error);
      console.error('[generate-article-structure] 完整响应文本:', fullText);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`JSON解析失败: ${errorMsg}`);
    }

    console.log('[generate-article-structure] JSON解析完成，验证必要字段');
    // 确保返回的结构包含必要字段
    if (!structure.core_thesis || !structure.argument_blocks) {
      console.error('[generate-article-structure] 返回的结构缺少必要字段');
      console.error('[generate-article-structure] 结构内容:', JSON.stringify(structure, null, 2));
      throw new Error('返回的结构缺少必要字段');
    }

    console.log('[generate-article-structure] 核心论点:', structure.core_thesis);
    console.log('[generate-article-structure] 论证块数量:', structure.argument_blocks.length);

    // 确保包含新格式的必要字段
    if (!structure.status) {
      structure.status = 'awaiting_user_confirmation';
    }
    if (!structure.allowed_user_actions) {
      structure.allowed_user_actions = ['edit_core_thesis', 'delete_block', 'reorder_blocks'];
    }

    // 确保每个 argument_block 包含必要字段
    structure.argument_blocks = structure.argument_blocks.map((block: any, index: number) => ({
      id: block.id || `block_${index + 1}`,
      title: block.title,
      description: block.description,
      order: block.order || index + 1,
      relation: block.relation || '',
      derived_from: block.derived_from || [],
      user_editable: block.user_editable !== false
    }));

    console.log('[generate-article-structure] 结构数据处理完成');
    console.log('[generate-article-structure] 最终结构:', JSON.stringify(structure, null, 2));
    console.log('[generate-article-structure] ========== 请求处理成功 ==========');

    return new Response(
      JSON.stringify(structure),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-article-structure] ========== 发生错误 ==========');
    console.error('[generate-article-structure] 错误类型:', error.constructor.name);
    console.error('[generate-article-structure] 错误消息:', error.message);
    console.error('[generate-article-structure] 错误堆栈:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: {
          type: error.constructor.name,
          stack: error.stack
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
