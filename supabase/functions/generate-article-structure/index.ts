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
    const body = await req.json();
    
    // 支持两种输入格式：
    // 1. 新格式：{ input: StructureAgentInput }
    // 2. 旧格式（兼容）：{ topic, requirements, referenceArticles, materials, writingSummary }
    let input: StructureAgentInput;
    let inputJson: string;
    
    if (body.input) {
      // 新格式
      input = body.input;
      inputJson = JSON.stringify(input, null, 2);
    } else {
      // 旧格式 - 转换为新格式（用于向后兼容）
      const { topic, requirements, referenceArticles, materials, writingSummary } = body;
      
      if (!topic) {
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
          confirmedInsights.push({
            id: `ref_${index + 1}`,
            category: '参考文章',
            content: `${article.title}: ${article.content.substring(0, 300)}`,
            source_insight_id: `ref_${index + 1}`
          });
        });
      }
      
      if (materials && materials.length > 0) {
        materials.forEach((material: any, index: number) => {
          confirmedInsights.push({
            id: `mat_${index + 1}`,
            category: '作者素材',
            content: `${material.title}: ${material.content.substring(0, 200)}`,
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
    }

    if (!input.topic) {
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
- 仅以 JSON 输出
- 结构生成后必须停在等待用户确认状态
- 不得进入写作阶段

请严格按照以下 JSON 格式输出：
{
  "core_thesis": "核心论点（一句话）",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "论证任务说明（要证明什么）",
      "order": 1,
      "relation": "与前一块的关系（起始论证块 / 递进 / 并列 / 因果 / 对比等）",
      "derived_from": ["insight_1", "insight_2"],
      "user_editable": true
    }
  ],
  "structure_relations": "整体结构关系说明",
  "status": "awaiting_user_confirmation",
  "allowed_user_actions": ["edit_core_thesis", "delete_block", "reorder_blocks"]
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
