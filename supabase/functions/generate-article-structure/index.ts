import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
      inputJson = JSON.stringify(input, null, 2);
      console.log('[generate-article-structure] 输入数据:', inputJson);
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
- 确保 JSON 格式正确，所有字符串值必须正确转义
- 结构生成后必须停在等待用户确认状态
- 不得进入写作阶段

请严格按照以下 JSON 格式输出（注意：derived_from 数组中的值必须是字符串）：
{
  "core_thesis": "核心论点（一句话）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "论证任务说明（要证明什么）",
      "order": 1,
      "relation": "与前一块的关系（起始论证块 / 递进 / 并列 / 因果 / 对比等）",
      "derived_from": ["insight_id_1", "insight_id_2"],
      "user_editable": true
    }
  ],
  "structure_relations": "整体结构关系说明",
  "status": "awaiting_user_confirmation",
  "allowed_user_actions": ["edit_core_thesis", "delete_block", "reorder_blocks"]
}

重要提示：
1. 所有字符串中的引号必须转义
2. derived_from 数组中只能包含字符串类型的 insight ID
3. 不要在 JSON 外添加任何解释性文字
4. 确保 JSON 可以被直接解析`;

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
        ]
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

    // 提取JSON内容
    let structure;
    try {
      console.log('[generate-article-structure] 尝试直接解析JSON');
      // 尝试直接解析
      structure = JSON.parse(fullText);
      console.log('[generate-article-structure] 直接解析成功');
    } catch (e) {
      console.log('[generate-article-structure] 直接解析失败，尝试从markdown代码块提取');
      // 尝试从markdown代码块中提取
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        console.log('[generate-article-structure] 找到代码块，尝试解析');
        try {
          structure = JSON.parse(jsonMatch[1]);
          console.log('[generate-article-structure] 代码块解析成功');
        } catch (parseError) {
          console.error('[generate-article-structure] 代码块解析失败:', parseError);
          console.error('[generate-article-structure] 代码块内容:', jsonMatch[1].substring(0, 500));
          throw new Error(`JSON解析失败: ${parseError.message}`);
        }
      } else {
        console.log('[generate-article-structure] 未找到代码块，尝试查找JSON对象');
        // 尝试查找JSON对象
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = fullText.substring(jsonStart, jsonEnd + 1);
          console.log('[generate-article-structure] 提取的JSON字符串（前200字符）:', jsonStr.substring(0, 200));
          try {
            structure = JSON.parse(jsonStr);
            console.log('[generate-article-structure] JSON对象解析成功');
          } catch (parseError) {
            console.error('[generate-article-structure] JSON对象解析失败:', parseError);
            console.error('[generate-article-structure] JSON字符串（前500字符）:', jsonStr.substring(0, 500));
            throw new Error(`JSON解析失败: ${parseError.message}`);
          }
        } else {
          console.error('[generate-article-structure] 无法找到有效的JSON结构');
          console.error('[generate-article-structure] 完整响应:', fullText);
          throw new Error('无法解析返回的JSON结构');
        }
      }
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
