import { runLLMAgent } from '../runtime/LLMRuntime.js';
import { type DraftPayload, type DraftBlock } from '../schemas/draftSchema.js';
import { type WritingBrief } from '../schemas/briefSchema.js';
import { type ArgumentOutline } from '../schemas/structureSchema.js';

export interface DraftAnalysisInput {
  draft_payload: DraftPayload;
  writing_brief: WritingBrief;
  argument_outline: ArgumentOutline;
}

export interface AnnotationResult {
  paragraph_id: string;
  paragraph_type: '引言' | '文献综述' | '观点提出' | '对比分析' | '方法说明' | '结论' | '其他';
  development_logic: string;
  editing_suggestions: string;
  viewpoint_generation: '文献直接观点' | '多文献综合' | '基于数据的推导' | '模型逻辑推演';
}

export interface AnalysisPayload {
  annotations: AnnotationResult[];
}

const analysisSchema = {
  required: ['annotations'],
  defaults: {
    annotations: []
  },
  validate: (data: any) => {
    if (!Array.isArray(data.annotations)) return false;
    for (const item of data.annotations) {
      if (!item.paragraph_id || !item.development_logic || !item.editing_suggestions) return false;
    }
    return true;
  }
};

function buildDraftAnalysisPrompt(input: DraftAnalysisInput): string {
  const { draft_payload, writing_brief, argument_outline } = input;

  return `你是一个专业的写作教练（Writing Coach）。你的任务是分析已经生成的文章草稿，为每一段落生成"Coaching Rail"（协作教练）内容。

【写作背景】
主题：${writing_brief.topic}
核心论点：${argument_outline.core_thesis}
目标受众：${writing_brief.requirement_meta.target_audience}
语气：${writing_brief.requirement_meta.tone}

【文章草稿内容】
${draft_payload.draft_blocks.map(block => 
  `[ID: ${block.paragraph_id}]
   内容：${block.content.substring(0, 300)}...
   引用：${(block.citations || []).map(c => c.source_title).join(', ')}`
).join('\n\n')}

【你的任务】
为每个段落（paragraph_id）生成以下分析内容（请严格遵守 JSON 结构）：
1. paragraph_type (段落类型): 必须是以下之一 ['引言', '文献综述', '观点提出', '对比分析', '方法说明', '结论', '其他']
2. development_logic (段落逻辑): 解释该段落为什么这样写？它在全文逻辑中起什么作用？（例如：采用"现状-挑战-必然性"结构，为了增强紧迫感；或者作为论据支撑上一段观点）
3. editing_suggestions (建议补充): 建议用户可以补充什么个人化内容？（例如：建议补充关于合规风险的实际案例；或者建议插入个人的行业观察）
4. viewpoint_generation (观点生成方式): 必须是以下之一 ['文献直接观点', '多文献综合', '基于数据的推导', '模型逻辑推演']

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "draftAnalysisAgent",
    "timestamp": "ISO时间"
  },
  "payload": "{\"annotations\":[{\"paragraph_id\":\"p1\",\"paragraph_type\":\"引言\",\"development_logic\":\"该段落作为引言...\",\"editing_suggestions\":\"建议补充...\",\"viewpoint_generation\":\"文献直接观点\"}]}"
}
`;
}

export async function runDraftAnalysisAgent(input: DraftAnalysisInput): Promise<AnalysisPayload> {
  const prompt = buildDraftAnalysisPrompt(input);
  
  const result = await runLLMAgent({
    agentName: 'draftAnalysisAgent',
    prompt,
    schema: analysisSchema,
    temperature: 0.5
  });

  return result.data as AnalysisPayload;
}
