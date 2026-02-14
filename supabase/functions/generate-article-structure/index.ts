import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parseEnvelope } from '../_shared/llm/runtime/parseEnvelope.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // 判断是否有确认的洞察，决定使用哪种prompt
    const hasInsights = input.confirmed_insights && input.confirmed_insights.length > 0;
    console.log('[generate-article-structure] 是否有确认的洞察:', hasInsights);
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

    // 根据是否有洞察选择不同的prompt
    let prompt: string;
    
    if (!hasInsights) {
      // 简单模式：仅基于需求文档生成结构
      console.log('[generate-article-structure] 使用简单模式（无研究洞察）');
      
      const requirementsText = body.requirements ? JSON.stringify(body.requirements, null, 2) : '无具体要求';
      
      prompt = `你是写作系统中的「文章级论证架构模块」。

请基于以下输入，构建文章的整体论证结构，而不是生成正文内容。

【输入】
选题：${input.topic}
写作要求：${requirementsText}

【你的任务】
1. 提炼文章的「核心论点」（一句话）
2. 拆分 3–5 个一级论证块（章节级）
3. 说明每个论证块的作用（为什么需要这一块）
4. 标注论证块之间的关系（并列 / 递进 / 因果 / 对比）

【输出格式】
- 核心论点：
- 论证结构：
  - 论证块 A：
    - 作用：
  - 论证块 B：
    - 作用：
  - …
- 结构关系说明：

【约束】
- 不生成具体段落
- 不引用案例、数据或研究
- 输出应稳定、抽象、可编辑

【输出要求 - 信封模式】
你必须严格输出一个固定结构的JSON对象, 且只能包含以下两个字段:
- type: 固定值 "generate_article_structure"
- payload: 字符串类型, 内容是文章结构JSON的字符串形式

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
  "type": "generate_article_structure",
  "payload": "{\"core_thesis\":\"示例论点\",\"argument_blocks\":[]}"
}

payload字符串内部应包含的结构:
{
  "core_thesis": "核心论点（一句话，不能包含换行符）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题（不能包含换行符）",
      "description": "该论证块的作用（不能包含换行符）",
      "order": 1,
      "relation": "与前一块的关系（起始论证块 / 递进 / 并列 / 因果 / 对比等）",
      "derived_from": [],
      "user_editable": true
    }
  ],
  "structure_relations": "结构关系说明（不能包含换行符）",
  "status": "awaiting_user_confirmation",
  "allowed_user_actions": ["edit_core_thesis", "delete_block", "reorder_blocks"]
}`;
    } else {
      // 复杂模式：基于研究洞察生成结构
      console.log('[generate-article-structure] 使用复杂模式（有研究洞察）');
      
      prompt = `你是 CoWrite 的【文章级论证架构 Agent（User-Gated）】。

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
【输出要求 - 信封模式】
────────────────
你必须严格输出一个固定结构的JSON对象, 且只能包含以下两个字段:
- type: 固定值 "generate_article_structure"
- payload: 字符串类型, 内容是文章结构JSON的字符串形式

重要规则:
1. 外层JSON必须始终合法, 只有type和payload两个字段
2. payload是字符串, 不是JSON对象, 需要将内部JSON转换为字符串
3. 不要在外层JSON之外输出任何文字
4. 不要使用markdown代码块
5. 如果无法生成内容, payload可以是空字符串
6. 结构生成后必须停在等待用户确认状态, 不得进入写作阶段
7. 禁止使用中文标点符号（""''：，等），必须使用英文标点符号
8. 所有字符串必须使用英文双引号 "

输出格式示例:
{
  "type": "generate_article_structure",
  "payload": "{\"core_thesis\":\"示例论点\",\"argument_blocks\":[]}"
}

payload字符串内部应包含的结构（注意：derived_from 数组中的值必须是字符串）:
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
}`;
    }

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

    // 使用新的解析器（含JSON修复功能）
    let structure;
    try {
      console.log('[generate-article-structure] 开始解析JSON');
      structure = await parseEnvelope(fullText);
      console.log('[generate-article-structure] JSON解析成功');
    } catch (error) {
      console.error('[generate-article-structure] JSON解析失败:', error);
      console.error('[generate-article-structure] 完整响应文本:', fullText);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ 
          error: `JSON解析失败: ${errorMsg}`,
          details: {
            type: error instanceof Error ? error.constructor.name : 'Error',
            stack: error instanceof Error ? error.stack : undefined
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-article-structure] JSON解析完成，验证必要字段');
    console.log('[generate-article-structure] 解析结果类型:', typeof structure);
    console.log('[generate-article-structure] 解析结果内容:', JSON.stringify(structure, null, 2));
    
    // 确保返回的结构包含必要字段
    const missingFields = [];
    if (!structure.core_thesis) missingFields.push('core_thesis');
    if (!structure.argument_blocks) missingFields.push('argument_blocks');
    
    if (missingFields.length > 0) {
      console.error('[generate-article-structure] ❌ 返回的结构缺少必要字段:', missingFields.join(', '));
      console.error('[generate-article-structure] 实际字段列表:', Object.keys(structure).join(', '));
      console.error('[generate-article-structure] 完整结构内容:', JSON.stringify(structure, null, 2));
      throw new Error(`返回的结构缺少必要字段: ${missingFields.join(', ')}。实际字段: ${Object.keys(structure).join(', ')}`);
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
