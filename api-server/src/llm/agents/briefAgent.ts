import { runLLMAgent } from '../runtime/LLMRuntime.js';
import { type WritingBrief, briefSchema } from '../schemas/briefSchema.js';

export interface BriefInput {
  topic: string;
  user_input: string;
  context?: string;
}

function buildBriefPrompt(input: BriefInput): string {
  return `你是一个专业的写作需求分析师。你的任务是根据用户输入，生成一份完整的写作需求文档（writing_brief）。

【用户输入】
主题：${input.topic}
详细描述：${input.user_input}
${input.context ? `背景信息：${input.context}` : ''}

【你的任务】
1. 分析用户的写作意图和核心论点
2. 提取关键洞察点（confirmed_insights）
3. 确定文档类型、目标受众、写作深度等元数据
4. 生成完整的 writing_brief

【输出要求 - 信封模式】
你必须严格输出以下JSON格式：

{
  "meta": {
    "agent": "briefAgent",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"topic\\":\\"..\\",\\"user_core_thesis\\":\\"..\\",\\"confirmed_insights\\":[\\"..\\"],\\"requirement_meta\\":{\\"document_type\\":\\"..\\",\\"target_audience\\":\\"..\\",\\"writing_depth\\":\\"..\\",\\"citation_style\\":\\"..\\",\\"language\\":\\"zh-CN\\",\\"max_word_count\\":3000,\\"seo_mode\\":false,\\"tone\\":\\"..\\"}}"
}

【关键规则】
1. 禁止使用中文标点符号（""''：，等）
2. 必须使用英文双引号 "
3. payload 是字符串，内部引号必须转义为 \\"
4. confirmed_insights 至少包含 3-5 个关键洞察点
5. document_type 从以下选择：academic / blog / report / speech / article
6. target_audience 必须具体明确（例如："大学生"、"企业管理者"、"技术开发者"）
7. writing_depth 从以下选择：浅 / 中 / 深
8. citation_style 从以下选择：APA / MLA / Chicago / none
9. tone 描述文章语气（例如："专业严谨"、"轻松活泼"、"客观中立"）
10. max_word_count 根据主题复杂度设定（一般 2000-5000）

【示例输出】
{
  "meta": {
    "agent": "briefAgent",
    "timestamp": "2026-02-11T10:00:00Z"
  },
  "payload": "{\\"topic\\":\\"人工智能对教育的影响\\",\\"user_core_thesis\\":\\"人工智能技术正在深刻改变传统教育模式，带来个性化学习和教学效率提升\\",\\"confirmed_insights\\":[\\"AI可以实现个性化学习路径定制\\",\\"智能辅导系统提高学习效率\\",\\"教师角色从知识传授者转变为学习引导者\\",\\"需要关注教育公平性问题\\"],\\"requirement_meta\\":{\\"document_type\\":\\"article\\",\\"target_audience\\":\\"教育工作者和家长\\",\\"writing_depth\\":\\"中\\",\\"citation_style\\":\\"none\\",\\"language\\":\\"zh-CN\\",\\"max_word_count\\":3000,\\"seo_mode\\":false,\\"tone\\":\\"客观分析，兼具专业性和可读性\\"}}"
}

现在请生成 writing_brief：`;
}

export async function runBriefAgent(input: BriefInput): Promise<WritingBrief> {
  const prompt = buildBriefPrompt(input);

  const result = await runLLMAgent<WritingBrief>({
    agentName: 'briefAgent',
    prompt,
    schema: briefSchema,
    model: 'gemini-2.5-flash',
    temperature: 0.4,
  });

  return result.data;
}
