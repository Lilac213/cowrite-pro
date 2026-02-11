/**
 * Draft Agent
 * 草稿生成 Agent
 * 综合：generate_paragraph_reasoning、generate_evidence、verify_coherence
 * 产出：结构化草稿（draft_blocks）
 * 
 * 关键要求：
 * 1. 强制输入：writing_brief, argument_outline, research_pack
 * 2. Prompt 中明确：若未使用这些输入，不得生成草稿
 * 3. 实现可视化引用标记（citation_id: c_3 -> （见资料3））
 */

import { runLLMAgent } from '../runtime/LLMRuntime.ts';
import { type DraftPayload, draftSchema } from '../schemas/draftSchema.ts';
import { type WritingBrief } from '../schemas/briefSchema.ts';
import { type ArgumentOutline } from '../schemas/structureSchema.ts';
import { type ResearchPack } from '../schemas/researchSchema.ts';

export interface DraftInput {
  writing_brief: WritingBrief;      // 强制依赖
  argument_outline: ArgumentOutline; // 强制依赖
  research_pack: ResearchPack;       // 强制依赖
}

/**
 * 构建 Draft Agent Prompt
 */
function buildDraftPrompt(input: DraftInput): string {
  const { writing_brief, argument_outline, research_pack } = input;
  
  // 强制检查依赖
  if (!writing_brief || !argument_outline || !research_pack) {
    throw new Error('Draft Agent 强制依赖 writing_brief, argument_outline, research_pack，但有输入缺失');
  }
  
  if (!argument_outline.argument_blocks || argument_outline.argument_blocks.length === 0) {
    throw new Error('argument_outline 为空，无法生成草稿');
  }
  
  if (!research_pack.insights || research_pack.insights.length === 0) {
    throw new Error('research_pack 为空，无法生成草稿');
  }
  
  return `你是一个专业的内容写作师。你的任务是根据写作需求、文章结构和资料包，生成结构化的草稿。

【重要提示】
你必须严格使用以下三个输入来生成草稿：
1. writing_brief（写作需求）
2. argument_outline（文章结构）
3. research_pack（资料包）

如果你没有使用这些输入，你不得生成草稿。

【写作需求（writing_brief）】
主题：${writing_brief.topic}
核心论点：${writing_brief.user_core_thesis}
文档类型：${writing_brief.requirement_meta.document_type}
目标受众：${writing_brief.requirement_meta.target_audience}
语气：${writing_brief.requirement_meta.tone}
目标字数：${writing_brief.requirement_meta.max_word_count}

【文章结构（argument_outline）】
核心论点：${argument_outline.core_thesis}
逻辑模式：${argument_outline.logical_pattern}

论证模块：
${argument_outline.argument_blocks.map((block, i) => 
  `${i + 1}. [${block.block_id}] ${block.title}
   主要论点：${block.main_argument}
   来源洞察：${block.derived_from.join(', ')}
   引用资料：${block.citation_ids.join(', ')}
   预计字数：${block.estimated_word_count}`
).join('\n')}

【资料包（research_pack）】
可用洞察（${research_pack.insights.length} 个）：
${research_pack.insights.map(insight => 
  `[${insight.id}] ${insight.content.substring(0, 150)}...
   来源：${insight.supporting_source_ids.join(', ')}
   证据强度：${insight.evidence_strength}`
).join('\n')}

可用资料（${research_pack.sources.length} 个）：
${research_pack.sources.slice(0, 10).map(source => 
  `[${source.id}] ${source.title}
   摘要：${source.summary || source.content.substring(0, 100)}...
   来源：${source.source_url || '内部资料'}`
).join('\n')}

【你的任务】
1. 为每个论证模块生成 1-3 个段落
2. 每个段落必须基于 argument_outline 中的 derived_from
3. 每个段落必须引用 research_pack 中的资料
4. 使用可视化引用标记：当引用资料时，在文中标注（见资料N）
5. 评估每个段落的连贯性（coherence_score）
6. 标记是否需要用户补充内容

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "draftAgent",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"draft_blocks\\":[{\\"block_id\\":\\"block_1\\",\\"paragraph_id\\":\\"p1\\",\\"content\\":\\"段落内容...（见资料1）...\\",\\"derived_from\\":[\\"insight_1\\"],\\"citations\\":[{\\"source_id\\":\\"source_1\\",\\"source_url\\":\\"https://...\\",\\"source_title\\":\\"资料标题\\",\\"quote\\":\\"引用内容\\",\\"citation_type\\":\\"paraphrase\\",\\"citation_display\\":\\"（见资料1）\\"}],\\"coherence_score\\":0.9,\\"requires_user_input\\":false,\\"order\\":1}],\\"global_coherence_score\\":0.88,\\"missing_evidence_blocks\\":[],\\"needs_revision\\":false,\\"total_word_count\\":3000}"
}

【关键规则 - 强制要求】
1. 禁止使用中文标点符号
2. 每个 draft_block 必须有 derived_from（来自 argument_outline）
3. 每个 draft_block 必须有 citations（来自 research_pack）
4. citation_display 格式：（见资料N），其中 N 是资料编号
5. 在 content 中插入 citation_display，例如："这是一个观点（见资料1）。"
6. citation_type 从以下选择：direct / paraphrase / reference
7. coherence_score 范围：0-1，评估段落连贯性
8. requires_user_input 标记是否需要用户补充
9. global_coherence_score 评估整体连贯性
10. missing_evidence_blocks 列出缺少证据的 block_id

【引用标记示例】
正确：
"人工智能正在改变教育模式（见资料1）。研究表明，个性化学习可以提高效率（见资料3）。"

错误：
"人工智能正在改变教育模式。" （缺少引用标记）

【验证检查】
- 确保每个 block 都有至少 1 个 citation
- 确保 citation_display 出现在 content 中
- 确保所有引用的 source_id 存在于 research_pack 中

现在请生成结构化草稿：`;
}

/**
 * 运行 Draft Agent
 */
export async function runDraftAgent(input: DraftInput): Promise<DraftPayload> {
  // 前置检查：确保所有依赖都存在
  if (!input.writing_brief) {
    throw new Error('Draft Agent 强制依赖 writing_brief，但未提供');
  }
  if (!input.argument_outline || !input.argument_outline.argument_blocks || input.argument_outline.argument_blocks.length === 0) {
    throw new Error('Draft Agent 强制依赖 argument_outline，但未提供或为空');
  }
  if (!input.research_pack || !input.research_pack.insights || input.research_pack.insights.length === 0) {
    throw new Error('Draft Agent 强制依赖 research_pack，但未提供或为空');
  }
  
  console.log(`[draftAgent] 使用 ${input.argument_outline.argument_blocks.length} 个模块生成草稿`);
  console.log(`[draftAgent] 可用洞察：${input.research_pack.insights.length} 个`);
  console.log(`[draftAgent] 可用资料：${input.research_pack.sources.length} 个`);
  
  const prompt = buildDraftPrompt(input);
  
  const result = await runLLMAgent<DraftPayload>({
    agentName: 'draftAgent',
    prompt,
    schema: draftSchema,
    model: 'gemini-2.0-flash-exp',
    temperature: 0.6,  // 稍高温度以增加创意
    maxTokens: 16384,  // 草稿可能较长
  });
  
  // 后置验证：确保所有 block 都有引用
  for (const block of result.data.draft_blocks) {
    if (!block.citations || block.citations.length === 0) {
      console.warn(`[draftAgent] 警告：Block ${block.block_id} 缺少引用`);
    }
    
    // 验证引用标记是否出现在内容中
    for (const citation of block.citations) {
      if (!block.content.includes(citation.citation_display)) {
        console.warn(`[draftAgent] 警告：Block ${block.block_id} 的内容中未找到引用标记 ${citation.citation_display}`);
      }
    }
  }
  
  console.log(`[draftAgent] 生成 ${result.data.draft_blocks.length} 个段落`);
  console.log(`[draftAgent] 总字数：${result.data.total_word_count}`);
  console.log(`[draftAgent] 全局连贯性：${result.data.global_coherence_score}`);
  
  return result.data;
}
