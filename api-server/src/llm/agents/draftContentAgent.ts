import { runLLMAgent } from '../runtime/LLMRuntime.js';
import { type DraftPayload, draftSchema } from '../schemas/draftSchema.js';
import { type WritingBrief } from '../schemas/briefSchema.js';
import { type ArgumentOutline } from '../schemas/structureSchema.js';
import { type ResearchPack } from '../schemas/researchSchema.js';

export interface DraftInput {
  writing_brief: WritingBrief;
  argument_outline: ArgumentOutline;
  research_pack: ResearchPack;
}

function buildDraftContentPrompt(input: DraftInput): string {
  const { writing_brief, argument_outline, research_pack } = input;

  if (!writing_brief || !argument_outline || !research_pack) {
    throw new Error('Draft Agent 强制依赖 writing_brief, argument_outline, research_pack，但有输入缺失');
  }

  if (!argument_outline.argument_blocks || argument_outline.argument_blocks.length === 0) {
    throw new Error('argument_outline 为空，无法生成草稿');
  }

  if (!research_pack.insights || research_pack.insights.length === 0) {
    throw new Error('research_pack 为空，无法生成草稿');
  }

  return `你是一个专业的内容写作师。你的任务是根据写作需求、文章结构和资料包，生成结构化的草稿内容。

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
   证据强度：${insight.evidence_strength}
   参考文献：${(insight.references || []).map(ref => `[${ref.id}] ${ref.title}`).join(', ')}`
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
4. 使用可视化引用标记：当引用资料时，在文中标注[资料N]
5. 评估每个段落的连贯性（coherence_score）
6. 标记是否需要用户补充内容

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "draftContentAgent",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\"draft_blocks\":[{\"block_id\":\"block_1\",\"paragraph_id\":\"p1\",\"content\":\"段落内容...[资料1]...\",\"derived_from\":[\"insight_1\"],\"citations\":[{\"source_id\":\"source_1\",\"source_url\":\"https://...\",\"source_title\":\"资料标题\",\"source_abstract\":\"资料摘要\",\"quote\":\"引用内容\",\"citation_type\":\"paraphrase\",\"citation_display\":\"[资料1]\",\"relevance_score\":0.95}],\"coherence_score\":0.9,\"requires_user_input\":false,\"order\":1}],\"global_coherence_score\":0.88,\"missing_evidence_blocks\":[],\"needs_revision\":false,\"total_word_count\":3000}"
}

【关键规则 - 强制要求】
1. 语言要求：必须与 argument_outline 中使用的语言保持一致（如果结构是中文，正文必须是中文；如果结构是英文，正文必须是英文）。
2. 禁止使用中文标点符号（如果正文是英文）。
3. 每个 draft_block 必须有 derived_from（来自 argument_outline）
4.95. 每个 draft_block 必须有 citations（来自 research_pack），并包含完整信息（source_id, source_title, source_abstract, source_url, relevance_score）
96. citation_display 格式：[资料N]，其中 N 是资料编号
6. 在 content 中插入 citation_display，例如："这是一个观点[资料1]。"
`;
}

export async function runDraftContentAgent(input: DraftInput): Promise<DraftPayload> {
  const prompt = buildDraftContentPrompt(input);
  
  const result = await runLLMAgent({
    agentName: 'draftContentAgent',
    prompt,
    schema: draftSchema,
    temperature: 0.7
  });

  return result.data as DraftPayload;
}
