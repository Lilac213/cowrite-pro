/**
 * Research Agent
 * 资料搜索与整理 Agent
 * 包含两个函数：
 * 1. research_retrieval - 资料搜索
 * 2. research_synthesis - 资料整理
 * 产出：research_pack
 */

import { runLLMAgent } from '../runtime/LLMRuntime.ts';
import {
  type ResearchSource,
  type SynthesizedInsight,
  type ResearchPack,
  researchPackSchema
} from '../schemas/researchSchema.ts';
import { type WritingBrief } from '../schemas/briefSchema.ts';

// ============ 资料搜索函数 ============

export interface RetrievalInput {
  writing_brief: WritingBrief;
  personal_materials?: any[];  // 个人资料库
  search_depth?: 'shallow' | 'medium' | 'deep';
}

/**
 * 个人资料智能筛选
 * 实现需求#8：关键词匹配 + Top-K 选取 + 摘要压缩
 */
function filterPersonalMaterials(
  materials: any[],
  writing_brief: WritingBrief,
  topK: number = 8
): any[] {
  if (!materials || materials.length === 0) return [];
  
  const keywords = [
    writing_brief.topic,
    ...writing_brief.confirmed_insights,
    ...(writing_brief.keywords || [])
  ];
  
  // 关键词匹配评分
  const scored = materials.map(material => {
    let score = 0;
    const content = (material.content || '').toLowerCase();
    const title = (material.title || '').toLowerCase();
    
    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();
      if (title.includes(kw)) score += 3;
      if (content.includes(kw)) score += 1;
    }
    
    return { material, score };
  });
  
  // 按分数排序，取 Top-K
  const topMaterials = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.material);
  
  // 摘要压缩：只保留前 500 字
  return topMaterials.map(material => ({
    ...material,
    content: material.content.substring(0, 500) + (material.content.length > 500 ? '...' : ''),
    is_compressed: material.content.length > 500
  }));
}

/**
 * 构建 Retrieval Prompt
 */
function buildRetrievalPrompt(input: RetrievalInput, filteredPersonalMaterials: any[]): string {
  const { writing_brief } = input;
  
  return `你是一个专业的资料搜索分析师。你的任务是根据写作需求，分析需要搜索的资料方向。

【写作需求】
主题：${writing_brief.topic}
核心论点：${writing_brief.user_core_thesis}
关键洞察：${writing_brief.confirmed_insights.join('；')}
文档类型：${writing_brief.requirement_meta.document_type}
目标受众：${writing_brief.requirement_meta.target_audience}

【个人资料库（已筛选 Top-${filteredPersonalMaterials.length}）】
${filteredPersonalMaterials.length > 0 ? filteredPersonalMaterials.map((m, i) => 
  `${i + 1}. ${m.title || '无标题'}\n   摘要：${m.content.substring(0, 200)}...`
).join('\n') : '（无相关个人资料）'}

【你的任务】
1. 分析需要搜索的资料类型和方向
2. 为每个洞察点生成搜索关键词
3. 评估个人资料的相关性和可信度
4. 生成资料搜索计划

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "researchAgent",
    "function": "retrieval",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"search_queries\\":[\\"..\\"],\\"personal_material_ids\\":[\\"..\\"],\\"search_directions\\":[\\"..\\"]}"
}

【关键规则】
1. 禁止使用中文标点符号
2. search_queries 包含 5-10 个搜索关键词
3. personal_material_ids 包含相关的个人资料 ID
4. search_directions 描述每个方向的搜索重点

现在请生成资料搜索计划：`;
}

/**
 * 运行资料搜索
 */
export async function runResearchRetrieval(input: RetrievalInput): Promise<any> {
  // 智能筛选个人资料（需求#8）
  const filteredPersonalMaterials = filterPersonalMaterials(
    input.personal_materials || [],
    input.writing_brief,
    8  // Top-8
  );
  
  console.log(`[researchAgent] 个人资料筛选：${input.personal_materials?.length || 0} -> ${filteredPersonalMaterials.length}`);
  
  const prompt = buildRetrievalPrompt(input, filteredPersonalMaterials);
  
  const result = await runLLMAgent({
    agentName: 'researchAgent',
    prompt,
    schema: {
      required: ['search_queries', 'search_directions'],
      optional: ['personal_material_ids']
    },
    model: 'gemini-2.5-flash',
    temperature: 0.3,
  });
  
  return {
    ...result.data,
    filtered_personal_materials: filteredPersonalMaterials
  };
}

// ============ 资料整理函数 ============

export interface SynthesisInput {
  writing_brief: WritingBrief;
  retrieved_sources: any[];  // 搜索到的资料
  personal_materials: any[];  // 筛选后的个人资料
}

/**
 * 构建 Synthesis Prompt
 */
function buildSynthesisPrompt(input: SynthesisInput): string {
  const { writing_brief, retrieved_sources, personal_materials } = input;
  
  return `你是一个专业的资料整理分析师。你的任务是将搜索到的资料整理成结构化的洞察（insights）。

【写作需求】
主题：${writing_brief.topic}
核心论点：${writing_brief.user_core_thesis}
关键洞察：${writing_brief.confirmed_insights.join('；')}

【外部资料（${retrieved_sources.length} 条）】
${retrieved_sources.slice(0, 10).map((s, i) => 
  `${i + 1}. [${s.id}] ${s.title}\n   ${s.summary || s.content.substring(0, 200)}`
).join('\n')}

【个人资料（${personal_materials.length} 条）】
${personal_materials.map((m, i) => 
  `${i + 1}. [${m.id}] ${m.title || '无标题'}\n   ${m.content.substring(0, 200)}`
).join('\n')}

【你的任务】
1. 将资料整理成 5-10 个结构化洞察
2. 每个洞察必须标明来源（supporting_source_ids）
3. 评估每个洞察的证据强度（strong/medium/weak）
4. 标记引用类型（direct/paraphrase/background）
5. 评估可信度和风险

【输出要求 - 信封模式】
{
  "meta": {
    "agent": "researchAgent",
    "function": "synthesis",
    "timestamp": "当前时间ISO格式"
  },
  "payload": "{\\"insights\\":[{\\"id\\":\\"insight_1\\",\\"category\\":\\"..\\",\\"content\\":\\"..\\",\\"supporting_source_ids\\":[\\"..\\"],\\"citability\\":\\"direct\\",\\"evidence_strength\\":\\"strong\\",\\"risk_flag\\":false,\\"confidence_score\\":0.9}],\\"summary\\":{\\"total_insights\\":5,\\"coverage_score\\":0.85,\\"quality_score\\":0.9}}"
}

【关键规则】
1. 禁止使用中文标点符号
2. 每个 insight 必须有 supporting_source_ids（不能为空）
3. citability 从以下选择：direct / paraphrase / background
4. evidence_strength 从以下选择：strong / medium / weak
5. confidence_score 范围：0-1
6. risk_flag 标记是否存在争议或不确定性

现在请整理资料并生成洞察：`;
}

/**
 * 运行资料整理
 */
export async function runResearchSynthesis(input: SynthesisInput): Promise<SynthesizedInsight[]> {
  const prompt = buildSynthesisPrompt(input);
  
  const result = await runLLMAgent({
    agentName: 'researchAgent',
    prompt,
    schema: {
      required: ['insights', 'summary'],
      validate: (data: any) => {
        if (!Array.isArray(data.insights)) return false;
        for (const insight of data.insights) {
          if (!insight.id || !insight.category || !insight.content) return false;
          if (!Array.isArray(insight.supporting_source_ids) || insight.supporting_source_ids.length === 0) {
            console.error('Insight missing supporting_source_ids:', insight.id);
            return false;
          }
        }
        return true;
      }
    },
    model: 'gemini-2.5-flash',
    temperature: 0.3,
  });
  
  return result.data.insights;
}

// ============ 统一输出 research_pack ============

/**
 * 生成完整的 research_pack
 */
export function buildResearchPack(
  sources: ResearchSource[],
  insights: SynthesizedInsight[]
): ResearchPack {
  return {
    sources,
    insights,
    summary: {
      total_sources: sources.length,
      total_insights: insights.length,
      coverage_score: insights.length > 0 ? Math.min(insights.length / 5, 1) : 0,
      quality_score: insights.reduce((sum, i) => sum + i.confidence_score, 0) / Math.max(insights.length, 1)
    }
  };
}
