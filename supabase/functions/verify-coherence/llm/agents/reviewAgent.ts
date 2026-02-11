/**
 * Review Agent
 * 内容审校 Agent
 * 综合现有的三个 review prompts
 * 产出：结构化审校报告
 */

import { runLLMAgent } from '../runtime/LLMRuntime.ts';
import { type ReviewPayload, reviewSchema } from '../schemas/reviewSchema.ts';
import { type DraftPayload } from '../schemas/draftSchema.ts';
import { type WritingBrief } from '../schemas/briefSchema.ts';

export interface ReviewInput {
  writing_brief: WritingBrief;
  draft: DraftPayload;  // 强制依赖
}

/**
 * 构建 Review Agent Prompt
 */
function buildReviewPrompt(input: ReviewInput): string {
  const { writing_brief, draft } = input;
  
  // 强制检查依赖
  if (!draft || !draft.draft_blocks || draft.draft_blocks.length === 0) {
    throw new Error('Review Agent 强制依赖 draft，但未提供或为空');
  }
  
  return `你是一个专业的内容审校师。你的任务是全面审校草稿，从逻辑、引用、风格、语法四个维度进行评估。

【写作需求】
主题：${writing_brief.topic}
核心论点：${writing_brief.user_core_thesis}
文档类型：${writing_brief.requirement_meta.document_type}
目标受众：${writing_brief.requirement_meta.target_audience}
引用风格：${writing_brief.requirement_meta.citation_style}
语气：${writing_brief.requirement_meta.tone}

【草稿内容】
总段落数：${draft.draft_blocks.length}
总字数：${draft.total_word_count}
全局连贯性：${draft.global_coherence_score}

段落内容：
${draft.draft_blocks.map((block, i) => 
  `${i + 1}. [${block.block_id}] ${block.content.substring(0, 200)}...
   引用数：${block.citations.length}
   连贯性：${block.coherence_score}`
).join('\n')}

【你的任务】
请从以下四个维度全面审校：

1. **逻辑审校**
   - 论证是否严密
   - 论点是否支撑核心论点
   - 是否存在逻辑跳跃或矛盾
   - 段落之间的衔接是否自然

2. **引用审校**
   - 引用是否充分
   - 引用是否准确
   - 是否存在过度引用或引用不足
   - 引用格式是否符合要求（${writing_brief.requirement_meta.citation_style}）

3. **风格审校**
   - 语气是否符合要求（${writing_brief.requirement_meta.tone}）
   - 是否适合目标受众（${writing_brief.requirement_meta.target_audience}）
   - 用词是否恰当
   - 是否存在冗余或啰嗦

4. **语法审校**
   - 是否存在语法错误
   - 标点符号使用是否正确
   - 句子结构是否清晰
   - 是否存在错别字

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "reviewAgent",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"logic_issues\\":[{\\"block_id\\":\\"block_1\\",\\"issue_type\\":\\"逻辑跳跃\\",\\"severity\\":\\"medium\\",\\"description\\":\\"段落2到段落3之间缺少过渡\\",\\"suggestion\\":\\"建议添加过渡句\\"}],\\"citation_issues\\":[],\\"style_issues\\":[],\\"grammar_issues\\":[],\\"redundancy_score\\":0.15,\\"suggested_rewrites\\":[{\\"block_id\\":\\"block_1\\",\\"original_text\\":\\"原文\\",\\"suggested_text\\":\\"建议改写\\",\\"reason\\":\\"原因\\"}],\\"overall_quality\\":{\\"logic_score\\":0.85,\\"citation_score\\":0.9,\\"style_score\\":0.88,\\"grammar_score\\":0.95,\\"overall_score\\":0.89},\\"pass\\":true,\\"review_notes\\":\\"整体质量良好\\"}"
}

【关键规则】
1. 禁止使用中文标点符号
2. 每个 issue 必须包含：block_id, issue_type, severity, description
3. severity 从以下选择：high / medium / low
4. 如果没有问题，对应数组为空 []
5. redundancy_score 范围：0-1，越高越冗余
6. overall_quality 中所有 score 范围：0-1
7. pass 为 true 表示通过审校，false 表示需要修改
8. 如果 overall_score < 0.7，pass 应为 false

【评分标准】
- logic_score: 逻辑严密性（0.9+ 优秀，0.7-0.9 良好，<0.7 需改进）
- citation_score: 引用充分性和准确性
- style_score: 风格适配度
- grammar_score: 语法正确性
- overall_score: 综合评分（四项平均）

【审校重点】
- 高优先级：逻辑问题、引用缺失、严重语法错误
- 中优先级：风格不符、冗余表达、引用格式
- 低优先级：用词优化、细微调整

现在请进行全面审校：`;
}

/**
 * 运行 Review Agent
 */
export async function runReviewAgent(input: ReviewInput): Promise<ReviewPayload> {
  // 前置检查：确保有 draft
  if (!input.draft || !input.draft.draft_blocks || input.draft.draft_blocks.length === 0) {
    throw new Error('Review Agent 强制依赖 draft，但未提供或为空');
  }
  
  console.log(`[reviewAgent] 审校 ${input.draft.draft_blocks.length} 个段落`);
  console.log(`[reviewAgent] 总字数：${input.draft.total_word_count}`);
  
  const prompt = buildReviewPrompt(input);
  
  const result = await runLLMAgent<ReviewPayload>({
    agentName: 'reviewAgent',
    prompt,
    schema: reviewSchema,
    model: 'gemini-2.0-flash-exp',
    temperature: 0.2,  // 低温度以确保客观评估
  });
  
  // 统计问题数量
  const totalIssues = 
    result.data.logic_issues.length +
    result.data.citation_issues.length +
    result.data.style_issues.length +
    result.data.grammar_issues.length;
  
  console.log(`[reviewAgent] 发现 ${totalIssues} 个问题`);
  console.log(`[reviewAgent] 逻辑问题：${result.data.logic_issues.length}`);
  console.log(`[reviewAgent] 引用问题：${result.data.citation_issues.length}`);
  console.log(`[reviewAgent] 风格问题：${result.data.style_issues.length}`);
  console.log(`[reviewAgent] 语法问题：${result.data.grammar_issues.length}`);
  console.log(`[reviewAgent] 综合评分：${result.data.overall_quality.overall_score}`);
  console.log(`[reviewAgent] 是否通过：${result.data.pass ? '是' : '否'}`);
  
  return result.data;
}
