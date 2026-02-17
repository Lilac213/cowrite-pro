import { runLLMAgent } from '../runtime/LLMRuntime.js';
import { type ArgumentOutline, structureSchema } from '../schemas/structureSchema.js';
import { type WritingBrief } from '../schemas/briefSchema.js';
import { type ResearchPack } from '../schemas/researchSchema.js';

export interface StructureInput {
  writing_brief: WritingBrief;
  research_pack: ResearchPack;
}

function buildStructurePrompt(input: StructureInput): string {
  const { writing_brief, research_pack } = input;

  if (!research_pack || !research_pack.insights || research_pack.insights.length === 0) {
    throw new Error('Structure Agent 必须依赖 research_pack，但 research_pack 为空或无效');
  }

  return `你是一个专业的文章结构设计师。你的任务是根据写作需求和资料包，设计文章的论证结构。

【写作需求】
主题：${writing_brief.topic}
核心论点：${writing_brief.user_core_thesis}
关键洞察：${writing_brief.confirmed_insights.join('；')}
文档类型：${writing_brief.requirement_meta.document_type}
目标字数：${writing_brief.requirement_meta.max_word_count}

【资料包（Research Pack）】
总资料数：${research_pack.sources.length}
总洞察数：${research_pack.insights.length}

可用洞察列表：
${research_pack.insights.map((insight, i) => 
  `[${insight.id}] ${insight.category}: ${insight.content.substring(0, 100)}...
   来源：${insight.supporting_source_ids.join(', ')}
   证据强度：${insight.evidence_strength}`
).join('\n')}

【你的任务】
1. 设计 3-6 个论证模块（argument_blocks）
2. 每个模块必须基于资料包中的洞察
3. 每个模块必须标明 derived_from（洞察 ID）和 citation_ids（资料 ID）
4. 确保覆盖所有关键洞察
5. 设计合理的逻辑结构（因果/递进/总分/并列/对比）

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "structureAgent",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"core_thesis\\":\\"..\\",\\"argument_blocks\\":[{\\"block_id\\":\\"block_1\\",\\"title\\":\\"..\\",\\"main_argument\\":\\"..\\",\\"derived_from\\":[\\"insight_1\\",\\"insight_2\\"],\\"citation_ids\\":[\\"source_1\\",\\"source_2\\"],\\"supporting_points\\":[\\"..\\"],\\"estimated_word_count\\":500,\\"order\\":1}],\\"coverage_check\\":{\\"covered_insights\\":[\\"insight_1\\"],\\"unused_insights\\":[\\"insight_5\\"],\\"coverage_percentage\\":0.8},\\"logical_pattern\\":\\"递进\\",\\"estimated_word_distribution\\":{\\"block_1\\":500},\\"total_estimated_words\\":3000}"
}

【关键规则 - 强制要求】
1. 禁止使用中文标点符号
2. 每个 block 的 derived_from 不能为空（至少包含 1 个 insight ID）
3. 每个 block 的 citation_ids 不能为空（至少包含 1 个 source ID）
4. derived_from 中的 ID 必须来自上面的洞察列表
5. citation_ids 必须来自 research_pack.sources
6. coverage_check 必须列出已覆盖和未使用的洞察
7. logical_pattern 从以下选择：因果 / 递进 / 总分 / 并列 / 对比
8. estimated_word_distribution 的总和应接近 max_word_count

【验证检查】
- 如果任何 block 的 derived_from 为空，输出将被拒绝
- 如果任何 block 的 citation_ids 为空，输出将被拒绝
- 确保所有引用的 ID 都存在于资料包中

现在请生成文章结构：`;
}

export async function runStructureAgent(input: StructureInput): Promise<ArgumentOutline> {
  if (!input.research_pack || !input.research_pack.insights || input.research_pack.insights.length === 0) {
    throw new Error('Structure Agent 强制依赖 research_pack，但未提供或为空');
  }

  const prompt = buildStructurePrompt(input);

  const result = await runLLMAgent<ArgumentOutline>({
    agentName: 'structureAgent',
    prompt,
    schema: structureSchema,
    model: 'gemini-2.5-flash',
    temperature: 0.4,
  });

  for (const block of result.data.argument_blocks) {
    if (!block.derived_from || block.derived_from.length === 0) {
      throw new Error(`Block ${block.block_id} 违反规则：derived_from 为空`);
    }
    if (!block.citation_ids || block.citation_ids.length === 0) {
      throw new Error(`Block ${block.block_id} 违反规则：citation_ids 为空`);
    }
  }

  return result.data;
}
