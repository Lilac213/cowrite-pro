import { supabase } from './supabase';
import { TEMPLATE_GENERATION_PROMPT } from '@/constants/prompts';
import type {
  Profile,
  SystemConfig,
  Project,
  Brief,
  KnowledgeBase,
  Outline,
  ReferenceArticle,
  Material,
  Draft,
  Review,
  Template,
  SearchResult,
  ReferenceLibrary,
  InvitationCode,
  Order,
  WritingSession,
  WritingStage,
  ResearchInsight,
  ResearchGap,
  UserDecision,
  SynthesisResult,
  RetrievedMaterial,
  SourceType,
} from '@/types';

// ============ System Config API ============
export async function getSystemConfig() {
  const { data, error } = await supabase
    .from('system_config')
    .select('*');

  if (error) throw error;
  return data as SystemConfig[];
}

export async function updateSystemConfig(configKey: string, configValue: string) {
  const { data, error } = await supabase
    .from('system_config')
    .update({ config_value: configValue })
    .eq('config_key', configKey)
    .select()
    .single();

  if (error) throw error;
  return data as SystemConfig;
}

// ============ Profile API ============
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Profile;
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Profile[];
}

// ============ Project API ============
export async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Project[];
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as Project | null;
}

export async function createProject(userId: string, title: string) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, title })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(projectId: string, updates: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

// ============ Brief API ============
export async function getBrief(projectId: string) {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as Brief | null;
}

export async function createBrief(brief: Omit<Brief, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('briefs')
    .insert(brief)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Brief;
}

export async function updateBrief(briefId: string, updates: Partial<Brief>) {
  const { data, error } = await supabase
    .from('briefs')
    .update(updates)
    .eq('id', briefId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Brief;
}

// ============ Knowledge Base API ============
export async function getKnowledgeBase(projectId: string) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('project_id', projectId)
    .order('collected_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as KnowledgeBase[];
}

export async function createKnowledgeBase(knowledge: Omit<KnowledgeBase, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert(knowledge)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as KnowledgeBase;
}

export async function updateKnowledgeBase(knowledgeId: string, updates: Partial<KnowledgeBase>) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .update(updates)
    .eq('id', knowledgeId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as KnowledgeBase;
}

export async function deleteKnowledgeBase(knowledgeId: string) {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', knowledgeId);

  if (error) throw error;
}

/**
 * 清空项目的所有知识库
 */
export async function clearProjectKnowledge(projectId: string) {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('project_id', projectId);

  if (error) throw error;
}

// ============ Outline API ============
export async function getOutlines(projectId: string) {
  const { data, error } = await supabase
    .from('outlines')
    .select('*')
    .eq('project_id', projectId)
    .order('paragraph_order', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Outline[];
}

export async function createOutline(outline: Omit<Outline, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('outlines')
    .insert(outline)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Outline;
}

export async function updateOutline(outlineId: string, updates: Partial<Outline>) {
  const { data, error } = await supabase
    .from('outlines')
    .update(updates)
    .eq('id', outlineId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Outline;
}

export async function deleteOutline(outlineId: string) {
  const { error } = await supabase
    .from('outlines')
    .delete()
    .eq('id', outlineId);

  if (error) throw error;
}

export async function batchCreateOutlines(outlines: Array<Omit<Outline, 'id' | 'created_at' | 'updated_at'>>) {
  const { data, error } = await supabase
    .from('outlines')
    .insert(outlines)
    .select();

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Outline[];
}

// ============ Reference Article API ============
export async function getReferenceArticles(userId: string, projectId?: string) {
  let query = supabase
    .from('reference_articles')
    .select('*')
    .eq('user_id', userId);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ReferenceArticle[];
}

export async function createReferenceArticle(article: Omit<ReferenceArticle, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('reference_articles')
    .insert(article)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as ReferenceArticle;
}

export async function updateReferenceArticle(articleId: string, updates: Partial<ReferenceArticle>) {
  const { data, error } = await supabase
    .from('reference_articles')
    .update(updates)
    .eq('id', articleId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as ReferenceArticle;
}

export async function deleteReferenceArticle(articleId: string) {
  const { error } = await supabase
    .from('reference_articles')
    .delete()
    .eq('id', articleId);

  if (error) throw error;
}

export async function searchReferenceArticles(userId: string, keyword: string) {
  const { data, error } = await supabase
    .from('reference_articles')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,keywords.cs.{${keyword}}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ReferenceArticle[];
}

// ============ Material API ============
export async function getMaterials(userId: string, projectId?: string) {
  let query = supabase
    .from('materials')
    .select('*')
    .eq('user_id', userId);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Material[];
}

export async function createMaterial(material: Omit<Material, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Material;
}

export async function updateMaterial(materialId: string, updates: Partial<Material>) {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', materialId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Material;
}

export async function deleteMaterial(materialId: string) {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', materialId);

  if (error) throw error;
}

export async function searchMaterials(userId: string, keyword: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,keywords.cs.{${keyword}}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Material[];
}

// ============ Draft API ============
export async function getDrafts(projectId: string) {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Draft[];
}

export async function getLatestDraft(projectId: string) {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Draft | null;
}

export async function createDraft(draft: Omit<Draft, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('drafts')
    .insert(draft)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Draft;
}

export async function updateDraft(draftId: string, updates: Partial<Draft>) {
  const { data, error } = await supabase
    .from('drafts')
    .update(updates)
    .eq('id', draftId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Draft;
}

// ============ Review API ============
export async function getReviews(projectId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('project_id', projectId)
    .order('review_round', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Review[];
}

export async function getReview(projectId: string, round: 1 | 2 | 3) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('project_id', projectId)
    .eq('review_round', round)
    .maybeSingle();

  if (error) throw error;
  return data as Review | null;
}

export async function createReview(review: Omit<Review, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('reviews')
    .insert(review)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Review;
}

export async function updateReview(reviewId: string, updates: Partial<Review>) {
  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Review;
}

// ============ Template API ============
export async function getTemplates(userId: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Template[];
}

export async function createTemplate(template: Omit<Template, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('templates')
    .insert(template)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Template;
}

export async function updateTemplate(templateId: string, updates: Partial<Template>) {
  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Template;
}

export async function deleteTemplate(templateId: string) {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;
}

// ============ Edge Function API ============
export async function callLLMGenerate(prompt: string, context?: string, systemMessage?: string) {
  const { data, error } = await supabase.functions.invoke<{ result?: string; error?: string }>('llm-generate', {
    body: { prompt, context, systemMessage },
  });

  if (error) {
    // 尝试从 error.context 中提取更详细的错误信息
    if (error.context && typeof error.context === 'object') {
      const contextError = await error.context.text?.();
      if (contextError) {
        try {
          const parsed = JSON.parse(contextError);
          throw new Error(parsed.error || error.message);
        } catch {
          throw new Error(contextError || error.message);
        }
      }
    }
    throw new Error(error.message);
  }
  
  // 检查响应中的错误
  if (data && 'error' in data && data.error) {
    throw new Error(data.error);
  }
  
  if (!data || !data.result) throw new Error('未收到响应');
  return data.result;
}

export async function callWebSearch(query: string) {
  const { data, error } = await supabase.functions.invoke<{ results?: SearchResult[]; error?: string }>('web-search', {
    body: { query },
  });

  if (error) {
    // 尝试从 error.context 中提取更详细的错误信息
    if (error.context && typeof error.context === 'object') {
      const contextError = await error.context.text?.();
      if (contextError) {
        try {
          const parsed = JSON.parse(contextError);
          throw new Error(parsed.error || error.message);
        } catch {
          throw new Error(contextError || error.message);
        }
      }
    }
    throw new Error(error.message);
  }
  
  // 检查响应中的错误
  if (data && 'error' in data && data.error) {
    throw new Error(data.error);
  }
  
  if (!data || !data.results) throw new Error('未收到响应');
  return data.results;
}

// ============ AI Assistant API ============

// AI 生成模板规则
export async function generateTemplateRules(description: string) {
  const systemMessage = TEMPLATE_GENERATION_PROMPT.replace('{{USER_INPUT}}', description);

  const result = await callLLMGenerate(description, '', systemMessage);
  return JSON.parse(result);
}

// AI 分析参考文章
export async function analyzeReferenceArticle(title: string, content: string) {
  const prompt = `请分析以下文章，提取关键信息：

标题：${title}

内容：
${content}

请以 JSON 格式返回：
{
  "core_points": ["核心观点1", "核心观点2", "核心观点3"],
  "structure": {
    "introduction": "引言概要",
    "main_sections": ["主要章节1", "主要章节2"],
    "conclusion": "结论概要"
  },
  "borrowable_segments": [
    {
      "content": "可借鉴的段落内容",
      "usage": "适用场景说明"
    }
  ],
  "tags": ["标签1", "标签2", "标签3"]
}`;

  const result = await callLLMGenerate(prompt);
  return JSON.parse(result);
}

// AI 整理素材库
export async function organizeMaterials(materials: Material[]) {
  const prompt = `请分析以下素材，提供整理建议：

${materials.map((m, i) => `${i + 1}. ${m.title}\n${m.content.substring(0, 200)}...`).join('\n\n')}

请以 JSON 格式返回：
{
  "auto_tags": {
    "material_id": ["标签1", "标签2"]
  },
  "similar_groups": [
    {
      "material_ids": ["id1", "id2"],
      "reason": "相似原因"
    }
  ],
  "article_suggestions": [
    {
      "title": "建议文章标题",
      "material_ids": ["id1", "id2", "id3"],
      "outline": "文章大纲"
    }
  ]
}`;

  const result = await callLLMGenerate(prompt);
  return JSON.parse(result);
}

// 更新素材关联项目
export async function linkMaterialToProjects(materialId: string, projectIds: string[]) {
  const { data, error } = await supabase
    .from('materials')
    .update({ 
      project_ids: projectIds,
      status: projectIds.length > 0 ? 'in_project' : 'unused',
      updated_at: new Date().toISOString()
    })
    .eq('id', materialId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Material;
}

// 更新素材标签
export async function updateMaterialTags(materialId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('materials')
    .update({ 
      tags,
      updated_at: new Date().toISOString()
    })
    .eq('id', materialId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Material;
}

// 更新参考文章 AI 分析结果
export async function updateReferenceAnalysis(articleId: string, analysis: any) {
  const { data, error } = await supabase
    .from('reference_articles')
    .update({ 
      ai_analysis: analysis,
      tags: analysis.tags || [],
      updated_at: new Date().toISOString()
    })
    .eq('id', articleId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as ReferenceArticle;
}

// 按标签筛选素材
export async function getMaterialsByTags(userId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .contains('tags', tags)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Material[];
}

// 按标签筛选参考文章
export async function getReferencesByTags(userId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('reference_articles')
    .select('*')
    .eq('user_id', userId)
    .contains('tags', tags)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ReferenceArticle[];
}

// ============ Academic Search Workflow API ============

// P1: 中文需求 → 英文学术关键词
export async function academicSearchRewriting(userQueryZh: string) {
  const systemMessage = `你是一名学术搜索专家。

请将以下【中文研究需求】转写为【用于英文学术数据库（如 OpenAlex）检索的关键词】。

要求：
1. 使用学术界常见术语，而不是直译
2. 关键词需覆盖研究对象 + 技术方法
3. 关键词数量 3–6 个
4. 必须为英文
5. 不要解释

输出格式（JSON）：
{
  "main_keywords": [],
  "related_keywords": []
}`;

  const result = await callLLMGenerate(userQueryZh, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析学术关键词');
  }
}

// P2: 学术搜索意图澄清
export async function searchScopeClarifier(academicKeywords: string[]) {
  const systemMessage = `你是一名科研助理。

请基于以下学术搜索关键词，判断用户的【研究关注重点】更偏向哪一类（可多选）：

A. 方法与技术原理
B. 应用场景与实践
C. 性能评估与对比
D. 挑战、限制与问题
E. 研究趋势与综述

输出 JSON，不要解释：
{
  "focus": []
}`;

  const prompt = `关键词：${academicKeywords.join(', ')}`;
  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析搜索意图');
  }
}

// P3: Top N 论文筛选
export async function topPaperSelector(searchTopic: string, papers: any[]) {
  const systemMessage = `你是一名学术研究助理。

请从以下论文中筛选出【最能代表该研究主题的 Top N 篇论文】。

筛选标准：
1. 与研究主题高度相关
2. 发表时间较新（优先近 3–5 年）
3. 具有一定引用影响力
4. 内容具有代表性，而非细分噪声

要求：
- 选择 3–6 篇
- 不要改写论文内容
- 输出被选论文的 index（从 0 开始）

输出格式（JSON）：
{
  "selected_indexes": []
}`;

  const prompt = `研究主题：${searchTopic}

论文列表：
${JSON.stringify(papers, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析论文筛选结果');
  }
}

// P4: 结构化学术摘要
export async function academicConsensusExtractor(selectedPapers: any[]) {
  const systemMessage = `你是一名学术研究助理。

请基于以下论文摘要，提炼【学术研究共识要点】。

要求：
1. 仅基于提供的论文摘要内容
2. 不引入外部知识
3. 不进行推测或预测
4. 使用客观、中性表述
5. 输出 3–6 条
6. 每条不超过 40 字
7. 不出现"本文认为 / 我们认为"等主观表达

输出格式（JSON 数组）：
[
  "要点1",
  "要点2"
]`;

  const prompt = `论文数据：
${JSON.stringify(selectedPapers, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析学术共识要点');
  }
}

// P5: CoWrite 输入整理
export async function cowriteInputFormatter(consensusPoints: string[]) {
  const systemMessage = `你是一名专业写作助手。

请将以下【学术共识要点】整理为【可供 CoWrite 使用的结构化写作素材】。

要求：
1. 不新增研究结论
2. 保持学术严谨
3. 用于后续专业写作或论文背景撰写

输出结构（JSON）：
{
  "research_background": "",
  "technical_progress": [],
  "open_challenges": []
}`;

  const prompt = `学术共识要点：
${JSON.stringify(consensusPoints, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析 CoWrite 输入格式');
  }
}

// ============ 混合搜索工作流 ============

// P1: 搜索意图拆解（学术 vs 实时）
export async function searchIntentDecomposer(userQueryZh: string) {
  const systemMessage = `你是一名研究型搜索专家。

请分析以下【中文需求】，判断其中涉及的研究意图，
并拆解为【学术搜索意图】与【实时网页搜索意图】。

要求：
1. 学术意图：偏向理论、方法、研究共识
2. 网页意图：偏向行业动态、产品、政策、实践
3. 两类都可能为空或同时存在
4. 不要解释

输出格式（JSON）：
{
  "academic_intent": "",
  "web_intent": ""
}`;

  const prompt = `中文需求：
${userQueryZh}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析搜索意图');
  }
}

// P2: 学术搜索转写（给 OpenAlex）
export async function academicSearchRewritingV2(academicIntent: string) {
  if (!academicIntent || academicIntent.trim() === '') {
    return { main_keywords: [], related_keywords: [] };
  }

  const systemMessage = `你是一名学术搜索专家。

请将以下【学术搜索意图】转写为
【用于英文学术数据库（如 OpenAlex）检索的关键词】。

要求：
1. 使用学术界常见术语
2. 覆盖研究对象 + 方法
3. 关键词 3–6 个
4. 英文输出
5. 不要解释

输出格式（JSON）：
{
  "main_keywords": [],
  "related_keywords": []
}`;

  const prompt = `学术搜索意图：
${academicIntent}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析学术关键词');
  }
}

// P3: 实时网页搜索转写（给 Tavily）
export async function webSearchRewriting(webIntent: string) {
  if (!webIntent || webIntent.trim() === '') {
    return { queries: [] };
  }

  const systemMessage = `你是一名实时信息检索专家。

请将以下【网页搜索意图】转写为
【适合实时网页搜索引擎（如 Tavily）使用的英文查询语句】。

要求：
1. 偏向自然语言，而非学术术语
2. 可包含行业、产品、应用、趋势等词
3. 不超过 2 条搜索 query
4. 英文输出
5. 不要解释

输出格式（JSON）：
{
  "queries": []
}`;

  const prompt = `网页搜索意图：
${webIntent}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析网页搜索查询');
  }
}

// P4: 跨源搜索结果筛选与对齐
export async function crossSourceAligner(academicResults: any[], webResults: any[]) {
  const systemMessage = `你是一名研究整合助手。

请基于以下两类搜索结果：
1. 学术论文结果（OpenAlex）
2. 实时网页搜索结果（Tavily）

完成以下任务：
- 识别两类内容中【主题一致的部分】
- 标记哪些网页内容是对学术研究的现实补充
- 剔除明显无关或噪声内容

要求：
1. 不合并写作
2. 仅做筛选与分类
3. 输出结构化结果

输出格式（JSON）：
{
  "academic_core": [],
  "web_supporting": [],
  "discarded": []
}`;

  const prompt = `学术论文结果：
${JSON.stringify(academicResults, null, 2)}

网页搜索结果：
${JSON.stringify(webResults, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析跨源对齐结果');
  }
}

// P5: 跨源结构化摘要
export async function crossSourceStructuredSummary(academicCore: any[], webSupporting: any[]) {
  const systemMessage = `你是一名专业研究助手。

请基于以下【学术核心内容】与【网页补充内容】，整理
【可供专业写作使用的结构化研究素材】。

要求：
1. 学术内容与网页内容分开展示
2. 不新增结论
3. 不将网页内容表述为学术共识
4. 中文输出

输出格式（JSON）：
{
  "academic_consensus": [],
  "industry_practice": [],
  "recent_trends": []
}`;

  const prompt = `学术核心内容：
${JSON.stringify(academicCore, null, 2)}

网页补充内容：
${JSON.stringify(webSupporting, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析跨源结构化摘要');
  }
}

// P6: 最终写作级摘要生成（综合学术和实时信息）
export async function generateWritingSummary(selectedKnowledge: any[]) {
  const systemMessage = `你是 CoWrite 的"研究摘要生成模块"。

基于已筛选的高质量来源，请完成以下任务：

1️⃣ 用 **中立、专业、可引用的语言** 总结核心观点  
2️⃣ 明确区分：
   - 学术共识
   - 行业实践 / 现实应用
3️⃣ 避免编造结论，不确定的地方需标注

输出结构必须包含：

{
  "background_summary": "...",
  "academic_insights": [
    {
      "point": "...",
      "evidence_source": "academic"
    }
  ],
  "industry_insights": [
    {
      "point": "...",
      "evidence_source": "industry"
    }
  ],
  "open_questions_or_debates": [
    "..."
  ],
  "suggested_writing_angles": [
    "..."
  ]
}`;

  const prompt = `已筛选的高质量来源：
${JSON.stringify(selectedKnowledge, null, 2)}`;

  const result = await callLLMGenerate(prompt, '', systemMessage);
  
  try {
    return JSON.parse(result);
  } catch (e) {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析写作摘要');
  }
}

// ============ 新的 Agent 驱动的搜索工作流 ============

/**
 * Research Retrieval Agent - 资料检索 Agent
 * 负责在 5 个数据源中检索相关资料
 */
export async function researchRetrievalAgent(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string) {
  console.log('[researchRetrievalAgent] 开始调用，需求文档:', requirementsDoc);
  console.log('[researchRetrievalAgent] projectId:', projectId);
  console.log('[researchRetrievalAgent] userId:', userId);
  console.log('[researchRetrievalAgent] sessionId:', sessionId);
  console.log('[researchRetrievalAgent] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('[researchRetrievalAgent] Supabase Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  try {
    console.log('[researchRetrievalAgent] 准备调用 Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('research-retrieval-agent', {
      body: { requirementsDoc, projectId, userId, sessionId },
    });

    console.log('[researchRetrievalAgent] Edge Function 调用完成');
    console.log('[researchRetrievalAgent] Edge Function 响应:', { data, error });

    if (error) {
      console.error('Research Retrieval Agent Error:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', Object.keys(error));
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // 尝试提取详细错误信息
      let errorMessage = error.message || '资料检索失败';
      
      // 如果有 context，尝试提取更详细的错误
      if (error.context) {
        try {
          const contextText = typeof error.context === 'string' 
            ? error.context 
            : await error.context.text?.();
          
          if (contextText) {
            console.error('Error context text:', contextText);
            try {
              const contextJson = JSON.parse(contextText);
              errorMessage = contextJson.error || contextText;
            } catch {
              errorMessage = contextText;
            }
          }
        } catch (e) {
          console.error('提取错误上下文失败:', e);
        }
      }
      
      // 如果返回的 data 中包含错误信息
      if (data && typeof data === 'object' && 'error' in data) {
        errorMessage = data.error;
        console.error('Data contains error:', errorMessage);
      }
      
      throw new Error(errorMessage);
    }

    // 检查返回的数据结构
    if (!data) {
      console.error('[researchRetrievalAgent] 返回数据为空');
      throw new Error('资料检索返回数据为空');
    }

    // 如果返回的是 { success: true, data: {...}, logs: [...] } 格式，提取 data 和 logs 字段
    if (data.success && data.data) {
      console.log('[researchRetrievalAgent] 提取 data 字段:', data.data);
      return {
        ...data.data,
        logs: data.logs || []
      };
    }

    // 否则直接返回
    console.log('[researchRetrievalAgent] 直接返回 data:', data);
    return data;
  } catch (error: any) {
    console.error('[researchRetrievalAgent] Caught exception:', error);
    console.error('[researchRetrievalAgent] Exception message:', error.message);
    console.error('[researchRetrievalAgent] Exception stack:', error.stack);
    console.error('[researchRetrievalAgent] Exception name:', error.name);
    throw error;
  }
}

/**
 * Research Synthesis Agent - 资料整理 Agent
 * 负责将检索结果转化为中文、结构化的写作素材
 */
export async function researchSynthesisAgent(retrievalResults: any, requirementsDoc: any) {
  console.log('[researchSynthesisAgent] 开始调用');
  console.log('  - retrievalResults:', retrievalResults);
  console.log('  - requirementsDoc:', requirementsDoc);
  
  const { data, error } = await supabase.functions.invoke('research-synthesis-agent', {
    body: { retrievalResults, requirementsDoc },
  });

  console.log('[researchSynthesisAgent] Edge Function 响应:', { data, error });

  if (error) {
    console.error('Research Synthesis Agent Error:', error);
    
    // 尝试提取详细错误信息
    let errorMessage = error.message || '资料整理失败';
    
    // 如果有 context，尝试提取更详细的错误
    if (error.context) {
      try {
        const contextText = typeof error.context === 'string' 
          ? error.context 
          : await error.context.text?.();
        
        if (contextText) {
          try {
            const contextJson = JSON.parse(contextText);
            errorMessage = contextJson.error || contextText;
          } catch {
            errorMessage = contextText;
          }
        }
      } catch (e) {
        console.error('提取错误上下文失败:', e);
      }
    }
    
    // 如果返回的 data 中包含错误信息
    if (data && typeof data === 'object' && 'error' in data) {
      errorMessage = data.error;
    }
    
    throw new Error(errorMessage);
  }

  // 检查返回的数据结构
  if (!data) {
    console.error('[researchSynthesisAgent] 返回数据为空');
    throw new Error('资料整理返回数据为空');
  }

  // 如果返回的是 { success: true, data: {...}, logs: [...] } 格式，提取 data 和 logs 字段
  if (data.success && data.data) {
    console.log('[researchSynthesisAgent] 提取 data 字段:', data.data);
    return {
      ...data.data,
      logs: data.logs || []
    };
  }

  // 否则直接返回
  console.log('[researchSynthesisAgent] 直接返回 data:', data);
  return data;
}

/**
 * 完整的 Agent 驱动的研究工作流
 * 1. 调用 Research Retrieval Agent 检索资料
 * 2. 调用 Research Synthesis Agent 整理资料
 */
export async function agentDrivenResearchWorkflow(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string) {
  // 第一步：资料检索
  const retrievalResults = await researchRetrievalAgent(requirementsDoc, projectId, userId, sessionId);

  // 不再自动调用综合分析，等待用户选择资料后再调用
  return {
    retrievalResults,
    synthesisResults: null, // 暂时不返回综合结果
  };
}

// ============ 旧的混合搜索工作流（保留用于兼容）============

// 完整的混合搜索工作流
export async function academicSearchWorkflow(userQueryZh: string) {
  // P1: 搜索意图拆解
  const intentDecomposition = await searchIntentDecomposer(userQueryZh);
  const { academic_intent, web_intent } = intentDecomposition;
  
  // P2: 学术搜索转写
  const academicKeywords = await academicSearchRewritingV2(academic_intent);
  
  // P3: 实时网页搜索转写
  const webQueries = await webSearchRewriting(web_intent);
  
  // 执行搜索
  const searchPromises: Promise<any>[] = [];
  
  // Google Scholar 搜索（如果有学术意图）
  if (academicKeywords.main_keywords.length > 0) {
    const allKeywords = [...academicKeywords.main_keywords, ...academicKeywords.related_keywords];
    const searchQuery = allKeywords.join(' ');
    searchPromises.push(
      searchGoogleScholar(searchQuery).catch(() => ({ papers: [] }))
    );
  } else {
    searchPromises.push(Promise.resolve({ papers: [] }));
  }
  
  // TheNews + Smart Search 搜索（如果有网页意图）
  if (webQueries.queries.length > 0) {
    // 使用第一个查询同时搜索 TheNews 和 Smart Search
    const query = webQueries.queries[0];
    searchPromises.push(
      Promise.all([
        searchTheNews(query).catch(() => ({ papers: [], summary: '', sources: [] })),
        searchSmartSearch(query).catch(() => ({ papers: [], summary: '', sources: [] })),
      ]).then(([newsResults, webResults]) => {
        // 合并两个搜索结果
        return {
          papers: [...(newsResults.papers || []), ...(webResults.papers || [])],
          summary: newsResults.summary || webResults.summary || '',
          sources: [...(newsResults.sources || []), ...(webResults.sources || [])],
        };
      })
    );
  } else {
    searchPromises.push(Promise.resolve({ papers: [], summary: '', sources: [] }));
  }
  
  const [scholarResults, webResults] = await Promise.all(searchPromises);
  
  // 提取结果
  const academicPapers = scholarResults.papers || [];
  const webPapers = webResults.papers || [];
  
  // 如果两边都没有结果，直接返回
  if (academicPapers.length === 0 && webPapers.length === 0) {
    return {
      intentDecomposition,
      academicKeywords,
      webQueries,
      academicPapers: [],
      webPapers: [],
      alignedResults: null,
      structuredSummary: null,
    };
  }
  
  // P4: 跨源结果筛选与对齐
  const alignedResults = await crossSourceAligner(academicPapers, webPapers);
  
  // P5: 跨源结构化摘要
  const structuredSummary = await crossSourceStructuredSummary(
    alignedResults.academic_core,
    alignedResults.web_supporting
  );
  
  return {
    intentDecomposition,
    academicKeywords,
    webQueries,
    academicPapers: alignedResults.academic_core,
    webPapers: alignedResults.web_supporting,
    alignedResults,
    structuredSummary,
  };
}

// Google Scholar 搜索（学术论文）
async function searchGoogleScholar(query: string) {
  const { data, error } = await supabase.functions.invoke('google-scholar-search', {
    body: { query, yearStart: '2020', yearEnd: new Date().getFullYear().toString(), limit: 10 },
  });
  
  if (error) throw error;
  return data;
}

// TheNews 搜索（新闻资讯）
async function searchTheNews(query: string) {
  const { data, error } = await supabase.functions.invoke('thenews-search', {
    body: { query, limit: 10 },
  });
  
  if (error) throw error;
  return data;
}

// Smart Search 搜索（网页搜索）
async function searchSmartSearch(query: string) {
  const { data, error } = await supabase.functions.invoke('smart-search', {
    body: { query, count: 10, freshness: 'Month' },
  });
  
  if (error) throw error;
  return data;
}

// ============ Project History API ============
export async function saveProjectHistory(projectId: string, stage: string, data: any) {
  const { data: historyData, error } = await supabase
    .from('project_history')
    .insert({
      project_id: projectId,
      stage,
      data,
    })
    .select()
    .single();

  if (error) throw error;
  return historyData;
}

export async function getProjectHistory(projectId: string) {
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getProjectHistoryByStage(projectId: string, stage: string) {
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .eq('stage', stage)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ============ Document Parsing API ============
export async function parseDocument(fileUrl: string, fileType: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('parse-document', {
    body: { fileUrl, fileType },
  });

  if (error) throw error;
  return data.text;
}

// ============ Content Summarization API ============
export async function summarizeContent(content: string): Promise<{ summary: string; tags: string[] }> {
  const { data, error } = await supabase.functions.invoke('summarize-content', {
    body: { content },
  });

  if (error) throw error;
  return data;
}

// ============ Tag-based Search API ============
export async function searchMaterialsByTags(userId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .overlaps('keywords', tags)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Material[];
}

export async function searchReferencesByTags(userId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('reference_articles')
    .select('*')
    .eq('user_id', userId)
    .overlaps('keywords', tags)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ReferenceArticle[];
}

export async function searchTemplatesByTags(userId: string, tags: string[]) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .overlaps('tags', tags)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Template[];
}

// ============ Reference Library API ============
export async function saveToReferenceLibrary(
  userId: string,
  item: {
    title: string;
    content: string;
    source?: string;
    source_url?: string;
    keywords?: string[];
    published_at?: string;
  }
) {
  const { data, error } = await supabase
    .from('reference_library')
    .insert({
      user_id: userId,
      ...item,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getReferenceLibrary(userId: string) {
  const { data, error } = await supabase
    .from('reference_library')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteFromReferenceLibrary(id: string) {
  const { error } = await supabase
    .from('reference_library')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ Article Argument Structure API ============
export async function updateArticleArgumentStructure(
  projectId: string,
  structure: {
    core_thesis: string;
    argument_blocks: Array<{
      id: string;
      title: string;
      description: string;
      order: number;
    }>;
  }
) {
  const { data, error } = await supabase
    .from('projects')
    .update({ article_argument_structure: structure })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ Outline Reasoning Structure API ============
export async function updateOutlineReasoningStructure(
  outlineId: string,
  reasoning: {
    main_argument: string;
    sub_arguments: Array<{
      id: string;
      content: string;
      order: number;
    }>;
    conclusion: string;
  }
) {
  const { data, error } = await supabase
    .from('outlines')
    .update({ reasoning_structure: reasoning })
    .eq('id', outlineId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOutlineEvidencePool(
  outlineId: string,
  evidencePool: Array<{
    id: string;
    sub_argument_id: string;
    type: 'case' | 'data' | 'analogy';
    content: string;
    source?: string;
    uncertainty?: string;
    selected: boolean;
  }>
) {
  const { data, error } = await supabase
    .from('outlines')
    .update({ evidence_pool: evidencePool })
    .eq('id', outlineId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reorderOutlines(
  projectId: string,
  outlines: Array<{ id: string; paragraph_order: number }>
) {
  const updates = outlines.map((outline) =>
    supabase
      .from('outlines')
      .update({ paragraph_order: outline.paragraph_order })
      .eq('id', outline.id)
  );

  await Promise.all(updates);
}

// ============ Invitation Code API ============
// 生成随机8位邀请码
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 创建邀请码
export async function createInvitationCode(credits: number): Promise<InvitationCode> {
  const code = generateInvitationCode();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('invitation_codes')
    .insert({
      code,
      credits,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as InvitationCode;
}

// 获取所有邀请码（管理员）
export async function getAllInvitationCodes(): Promise<InvitationCode[]> {
  const { data, error } = await supabase
    .from('invitation_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as InvitationCode[];
}

// 验证并使用邀请码
export async function useInvitationCode(code: string, userId: string): Promise<void> {
  // 查询邀请码
  const { data: inviteCode, error: fetchError } = await supabase
    .from('invitation_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!inviteCode) throw new Error('邀请码不存在或已失效');

  // 更新用户点数
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      available_credits: profile.available_credits + inviteCode.credits,
      invitation_code: code,
    })
    .eq('id', userId);

  if (updateError) throw updateError;

  // 增加邀请码使用次数
  const { error: incrementError } = await supabase
    .from('invitation_codes')
    .update({ used_count: inviteCode.used_count + 1 })
    .eq('id', inviteCode.id);

  if (incrementError) throw incrementError;
}

// 停用邀请码
export async function deactivateInvitationCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('invitation_codes')
    .update({ is_active: false })
    .eq('id', codeId);

  if (error) throw error;
}

// 检查用户是否可以使用AI降重工具（检查点数）
export async function checkAIReducerLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  // 管理员无限点数
  if (profile.unlimited_credits) return true;
  // 普通用户检查点数
  return profile.available_credits > 0;
}

// 增加AI降重使用次数并扣除点数
export async function incrementAIReducerUsage(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  // 管理员无限点数，只增加使用次数
  if (profile.unlimited_credits) {
    const { error } = await supabase
      .from('profiles')
      .update({ ai_reducer_used: profile.ai_reducer_used + 1 })
      .eq('id', userId);
    if (error) throw error;
    return;
  }

  // 普通用户检查点数
  if (profile.available_credits <= 0) {
    throw new Error('点数不足，请购买点数');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      ai_reducer_used: profile.ai_reducer_used + 1,
      available_credits: profile.available_credits - 1,
    })
    .eq('id', userId);

  if (error) throw error;
}

// 检查用户是否可以创建项目（检查点数）
export async function checkProjectLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  // 管理员无限点数
  if (profile.unlimited_credits) return true;
  // 普通用户检查点数
  return profile.available_credits > 0;
}

// 增加项目创建次数并扣除点数
export async function incrementProjectCount(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  // 管理员无限点数，只增加使用次数
  if (profile.unlimited_credits) {
    const { error } = await supabase
      .from('profiles')
      .update({ projects_created: profile.projects_created + 1 })
      .eq('id', userId);
    if (error) throw error;
    return;
  }

  // 普通用户检查点数
  if (profile.available_credits <= 0) {
    throw new Error('点数不足，请购买点数');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      projects_created: profile.projects_created + 1,
      available_credits: profile.available_credits - 1,
    })
    .eq('id', userId);

  if (error) throw error;
}

// 管理员为用户配置点数
export async function setUserCredits(userId: string, credits: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ available_credits: credits })
    .eq('id', userId);

  if (error) throw error;
}

// 获取用户订单列表
export async function getUserOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Order[];
}

// 获取订单详情
export async function getOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data as Order | null;
}

// ==================== 写作会话管理 ====================

// 获取或创建写作会话
export async function getOrCreateWritingSession(projectId: string): Promise<WritingSession> {
  // 先尝试获取现有会话
  const { data: existing, error: fetchError } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  
  if (existing) {
    return existing as WritingSession;
  }

  // 创建新会话
  const { data, error } = await supabase
    .from('writing_sessions')
    .insert({
      project_id: projectId,
      current_stage: 'research',
      locked_core_thesis: false,
      locked_structure: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WritingSession;
}

// 更新写作会话阶段
export async function updateWritingSessionStage(
  sessionId: string,
  stage: WritingStage
): Promise<void> {
  const { error } = await supabase
    .from('writing_sessions')
    .update({
      current_stage: stage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

// 调用研究综合 Agent
export async function callResearchSynthesisAgent(
  projectId: string,
  sessionId?: string
): Promise<SynthesisResult> {
  const { data, error } = await supabase.functions.invoke('research-synthesis-agent', {
    body: { projectId, sessionId },
  });

  if (error) throw error;
  return data as SynthesisResult;
}

// 获取研究洞察
export async function getResearchInsights(sessionId: string): Promise<ResearchInsight[]> {
  const { data, error } = await supabase
    .from('research_insights')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ResearchInsight[];
}

// 获取研究空白/矛盾
export async function getResearchGaps(sessionId: string): Promise<ResearchGap[]> {
  const { data, error } = await supabase
    .from('research_gaps')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ResearchGap[];
}

// 更新研究洞察的用户决策
export async function updateInsightDecision(
  insightId: string,
  decision: UserDecision
): Promise<void> {
  const { error } = await supabase
    .from('research_insights')
    .update({ user_decision: decision })
    .eq('id', insightId);

  if (error) throw error;
}

// 批量更新研究洞察决策
export async function batchUpdateInsightDecisions(
  decisions: Array<{ id: string; decision: UserDecision }>
): Promise<void> {
  const promises = decisions.map(({ id, decision }) =>
    updateInsightDecision(id, decision)
  );
  await Promise.all(promises);
}

// 更新研究空白的用户决策
export async function updateGapDecision(
  gapId: string,
  decision: 'respond' | 'ignore'
): Promise<void> {
  const { error } = await supabase
    .from('research_gaps')
    .update({ user_decision: decision })
    .eq('id', gapId);

  if (error) throw error;
}

// 检查研究阶段是否完成（所有决策都已做出）
export async function isResearchStageComplete(sessionId: string): Promise<boolean> {
  const insights = await getResearchInsights(sessionId);
  const gaps = await getResearchGaps(sessionId);

  const allInsightsDecided = insights.every(i => i.user_decision !== 'pending');
  const allGapsDecided = gaps.every(g => g.user_decision !== 'pending');

  return allInsightsDecided && allGapsDecided;
}

// ==================== 检索资料管理 ====================

// 获取会话的所有检索资料
export async function getRetrievedMaterials(sessionId: string): Promise<RetrievedMaterial[]> {
  const { data, error } = await supabase
    .from('retrieved_materials')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as RetrievedMaterial[];
}

// 获取选中的检索资料
export async function getSelectedMaterials(sessionId: string): Promise<RetrievedMaterial[]> {
  const { data, error } = await supabase
    .from('retrieved_materials')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_selected', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as RetrievedMaterial[];
}

// 更新资料选择状态
export async function updateMaterialSelection(
  materialId: string,
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('id', materialId);

  if (error) throw error;
}

// 批量更新资料选择状态
export async function batchUpdateMaterialSelection(
  selections: Array<{ id: string; is_selected: boolean }>
): Promise<void> {
  const promises = selections.map(({ id, is_selected }) =>
    updateMaterialSelection(id, is_selected)
  );
  await Promise.all(promises);
}

// 清空会话的检索资料
export async function clearRetrievedMaterials(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .delete()
    .eq('session_id', sessionId);

  if (error) throw error;
}

// 保存检索资料
export async function saveRetrievedMaterial(material: Omit<RetrievedMaterial, 'id' | 'created_at'>): Promise<RetrievedMaterial> {
  const { data, error } = await supabase
    .from('retrieved_materials')
    .insert(material)
    .select()
    .single();

  if (error) throw error;
  return data as RetrievedMaterial;
}

// 批量保存检索资料
export async function batchSaveRetrievedMaterials(
  materials: Array<Omit<RetrievedMaterial, 'id' | 'created_at'>>
): Promise<RetrievedMaterial[]> {
  const { data, error } = await supabase
    .from('retrieved_materials')
    .insert(materials)
    .select();

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as RetrievedMaterial[];
}


