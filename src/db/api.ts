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
    .upsert({ 
      config_key: configKey, 
      config_value: configValue,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'config_key' 
    })
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

// ============ Academic Search Workflow API 已移除 ============

// ============ 混合搜索工作流已移除 ============

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
 * 1. 先搜索本地素材库和参考文章库（快速返回）
 * 2. 调用 Research Retrieval Agent 检索外部资料
 */
export async function agentDrivenResearchWorkflow(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string) {
  // 检查并扣除点数（资料查询+整理需要3点）
  if (userId) {
    const hasCredits = await checkResearchLimit(userId);
    if (!hasCredits) {
      throw new Error('点数不足，资料查询和整理需要3点');
    }
    // 扣除点数
    await deductResearchCredits(userId);
  }

  // 提取搜索关键词
  const searchKeywords = extractKeywords(requirementsDoc);

  // 第一步：并行搜索本地素材库和参考文章库（快速返回）
  let localMaterials: any[] = [];
  let localReferences: any[] = [];
  
  if (userId && searchKeywords.length > 0) {
    try {
      const [materials, references] = await Promise.all([
        searchMaterialsByTags(userId, searchKeywords.slice(0, 5)),
        searchReferencesByTags(userId, searchKeywords.slice(0, 5)),
      ]);
      localMaterials = materials || [];
      localReferences = references || [];
      console.log('[agentDrivenResearchWorkflow] 本地素材搜索结果:', localMaterials.length, '条');
      console.log('[agentDrivenResearchWorkflow] 参考文章搜索结果:', localReferences.length, '条');
    } catch (error) {
      console.error('[agentDrivenResearchWorkflow] 本地搜索失败:', error);
    }
  }

  // 第二步：调用外部 Research Retrieval Agent 检索资料
  const retrievalResults = await researchRetrievalAgent(requirementsDoc, projectId, userId, sessionId);

  // 第三步：将搜索结果保存到数据库（如果有 sessionId）
  if (sessionId && retrievalResults) {
    console.log('[agentDrivenResearchWorkflow] 开始保存搜索结果到数据库，sessionId:', sessionId);
    
    const materialsToSave: Array<Omit<RetrievedMaterial, 'id' | 'created_at'>> = [];
    
    // 保存学术来源
    if (retrievalResults.academic_sources?.length > 0) {
      for (const source of retrievalResults.academic_sources) {
        // 将 authors 字符串转为数组
        let authorsArray: string[] = [];
        if (source.authors) {
          authorsArray = source.authors.split(/[,;、，]/).map((a: string) => a.trim()).filter((a: string) => a);
        }
        
        // 确保 citation_count 是有效整数
        let citationCount = 0;
        if (source.citation_count !== undefined && source.citation_count !== null && source.citation_count !== '') {
          citationCount = parseInt(String(source.citation_count), 10) || 0;
        }
        
        materialsToSave.push({
          session_id: sessionId,
          project_id: projectId,
          user_id: userId,
          source_type: 'academic',
          title: source.title || '',
          url: source.url || '',
          abstract: source.full_text || source.extracted_content?.join('\n') || '',
          full_text: source.full_text || '',
          authors: authorsArray,
          year: source.year || '',
          citation_count: citationCount,
          is_selected: false,
          metadata: { original_source: 'GoogleScholar' },
        });
      }
    }
    
    // 保存新闻来源
    if (retrievalResults.news_sources?.length > 0) {
      for (const source of retrievalResults.news_sources) {
        materialsToSave.push({
          session_id: sessionId,
          project_id: projectId,
          user_id: userId,
          source_type: 'news',
          title: source.title || '',
          url: source.url || '',
          abstract: source.full_text || source.extracted_content?.join('\n') || '',
          full_text: source.full_text || '',
          published_at: source.published_at || '',
          is_selected: false,
          metadata: { original_source: 'GoogleNews', source: source.source },
        });
      }
    }
    
    // 保存网络来源
    if (retrievalResults.web_sources?.length > 0) {
      for (const source of retrievalResults.web_sources) {
        materialsToSave.push({
          session_id: sessionId,
          project_id: projectId,
          user_id: userId,
          source_type: 'web',
          title: source.title || '',
          url: source.url || '',
          abstract: source.full_text || source.extracted_content?.join('\n') || '',
          full_text: source.full_text || '',
          is_selected: false,
          metadata: { original_source: 'WebSearch', site_name: source.site_name },
        });
      }
    }
    
    // 批量保存到数据库
    if (materialsToSave.length > 0) {
      try {
        await batchSaveRetrievedMaterials(materialsToSave);
        console.log('[agentDrivenResearchWorkflow] 成功保存', materialsToSave.length, '条资料到数据库');
      } catch (error) {
        console.error('[agentDrivenResearchWorkflow] 保存资料失败:', error);
      }
    }
  }

  // 合并本地和外部结果
  const combinedResults = {
    ...retrievalResults,
    localMaterials,
    localReferences,
  };

  return {
    retrievalResults: combinedResults,
    synthesisResults: null,
  };
}

// 从需求文档中提取搜索关键词
function extractKeywords(requirementsDoc: any): string[] {
  const keywords: string[] = [];
  
  if (requirementsDoc.主题) {
    keywords.push(requirementsDoc.主题);
  }
  if (requirementsDoc.关键要点) {
    keywords.push(...requirementsDoc.关键要点);
  }
  if (requirementsDoc.核心观点) {
    keywords.push(...requirementsDoc.核心观点);
  }
  
  // 去重并返回
  return [...new Set(keywords)].filter(k => k && k.length > 0);
}

// ============ 旧的混合搜索工作流已移除 ============

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

// 验证并使用邀请码（支持多次使用，点数叠加）
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

  // 更新用户点数（叠加）
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      available_credits: profile.available_credits + inviteCode.credits,
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

// 增加项目创建次数
export async function incrementProjectCount(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');

  const { error } = await supabase
    .from('profiles')
    .update({ projects_created: profile.projects_created + 1 })
    .eq('id', userId);

  if (error) throw error;
}

// 管理员为用户配置点数
export async function setUserCredits(userId: string, credits: number): Promise<void> {
  // -1 表示无限点数
  const updateData = credits === -1 
    ? { available_credits: 0, unlimited_credits: true }
    : { available_credits: credits, unlimited_credits: false };
  
  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) throw error;
}

// 检查用户是否可以进行资料查询和整理（需要3点）
export async function checkResearchLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  console.log('[checkResearchLimit] profile:', profile);
  console.log('[checkResearchLimit] unlimited_credits:', profile?.unlimited_credits);
  console.log('[checkResearchLimit] available_credits:', profile?.available_credits);
  if (!profile) return false;
  // 管理员无限点数
  if (profile.unlimited_credits) return true;
  // 普通用户检查点数（资料查询+整理需要3点）
  return profile.available_credits >= 3;
}

// 扣除资料查询和整理的点数（3点）
export async function deductResearchCredits(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  // 管理员无限点数，不扣除
  if (profile.unlimited_credits) {
    return;
  }

  // 普通用户检查点数
  if (profile.available_credits < 3) {
    throw new Error('点数不足，资料查询和整理需要3点');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      available_credits: profile.available_credits - 3,
    })
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
export async function getOrCreateWritingSession(projectId: string, userId?: string): Promise<WritingSession> {
  // 先尝试获取现有会话（获取最新的一个）
  const { data: existing, error: fetchError } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
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
      user_id: userId,
      current_stage: 'research',
      locked_core_thesis: false,
      locked_structure: false,
    })
    .select()
    .single();

  if (error) {
    // 如果是唯一约束冲突（可能是并发创建），重新获取
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('writing_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (retryError) throw retryError;
      return retry as WritingSession;
    }
    throw error;
  }
  
  return data as WritingSession;
}

// 获取写作会话
export async function getWritingSession(projectId: string): Promise<WritingSession | null> {
  const { data, error } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as WritingSession | null;
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

// 调用研究综合 Agent（支持新旧两种格式）
export async function callResearchSynthesisAgent(
  projectIdOrInput: string | {
    writing_requirements: {
      topic: string;
      target_audience?: string;
      writing_purpose?: string;
      key_points?: string[];
    };
    raw_materials: Array<{
      title: string;
      source: string;
      source_url?: string;
      content: string;
    }>;
  },
  sessionId?: string
): Promise<SynthesisResult> {
  let body: any;
  
  if (typeof projectIdOrInput === 'string') {
    // 旧格式：projectId
    console.log('[callResearchSynthesisAgent] 使用旧格式（projectId）:', { projectId: projectIdOrInput, sessionId });
    body = { projectId: projectIdOrInput, sessionId };
  } else {
    // 新格式：ResearchSynthesisInput
    console.log('[callResearchSynthesisAgent] 使用新格式（input）');
    body = { input: projectIdOrInput, sessionId };
  }
  
  const { data, error } = await supabase.functions.invoke('research-synthesis-agent', {
    body,
  });

  if (error) {
    console.error('[callResearchSynthesisAgent] Edge Function 错误:', error);
    console.error('[callResearchSynthesisAgent] 错误详情:', JSON.stringify(error, null, 2));
    
    // 尝试获取更详细的错误信息
    if (error.context) {
      console.error('[callResearchSynthesisAgent] 错误上下文:', error.context);
      try {
        const contextText = await error.context.text();
        console.error('[callResearchSynthesisAgent] 上下文文本:', contextText);
        
        // 尝试解析 JSON 错误响应
        try {
          const errorData = JSON.parse(contextText);
          throw new Error(
            `资料整理失败: ${errorData.error || error.message}\n` +
            `详情: ${errorData.details ? JSON.stringify(errorData.details, null, 2) : '无'}\n` +
            `时间: ${errorData.timestamp || '未知'}`
          );
        } catch (parseError) {
          // 如果不是 JSON，直接使用文本
          throw new Error(`资料整理失败: ${contextText || error.message}`);
        }
      } catch (textError) {
        console.error('[callResearchSynthesisAgent] 无法读取上下文文本:', textError);
      }
    }
    
    throw new Error(`资料整理失败: ${error.message || 'Edge Function 调用失败'}`);
  }
  
  console.log('[callResearchSynthesisAgent] 返回数据:', data);
  
  // 保存 synthesis_result 到 writing_sessions
  if (sessionId && data) {
    try {
      const { error: updateError } = await supabase
        .from('writing_sessions')
        .update({
          synthesis_result: {
            thought: data.thought,
            input: body.input || { projectId: body.projectId },
            synthesis: data.synthesis,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('[callResearchSynthesisAgent] 保存 synthesis_result 失败:', updateError);
      } else {
        console.log('[callResearchSynthesisAgent] synthesis_result 已保存到 writing_sessions');
      }
    } catch (saveError) {
      console.error('[callResearchSynthesisAgent] 保存 synthesis_result 异常:', saveError);
    }
  }
  
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

// ==================== 文章结构生成 ====================

// 调用文章结构生成 Agent（基于用户确认的洞察）
export async function callArticleStructureAgent(
  sessionId: string,
  projectId: string
): Promise<any> {
  console.log('[callArticleStructureAgent] ========== 开始生成文章结构 ==========');
  console.log('[callArticleStructureAgent] sessionId:', sessionId);
  console.log('[callArticleStructureAgent] projectId:', projectId);

  try {
    // 1. 获取项目信息
    console.log('[callArticleStructureAgent] 步骤1: 获取项目信息');
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }
    console.log('[callArticleStructureAgent] 项目标题:', project.title);

    // 2. 获取需求文档
    console.log('[callArticleStructureAgent] 步骤2: 获取需求文档');
    const brief = await getBrief(projectId);
    let requirements: any = {};
    try {
      if (brief?.requirements) {
        requirements = typeof brief.requirements === 'string' 
          ? JSON.parse(brief.requirements) 
          : brief.requirements;
      }
    } catch (e) {
      console.warn('[callArticleStructureAgent] 解析需求文档失败:', e);
      requirements = {};
    }
    console.log('[callArticleStructureAgent] 需求主题:', requirements.topic || '未设置');

    // 3. 获取所有研究洞察和空白
    console.log('[callArticleStructureAgent] 步骤3: 获取研究洞察和空白');
    const allInsights = await getResearchInsights(sessionId);
    const allGaps = await getResearchGaps(sessionId);

    console.log('[callArticleStructureAgent] 总洞察数:', allInsights.length);
    console.log('[callArticleStructureAgent] 总空白数:', allGaps.length);
    
    // 详细输出每条洞察的决策状态
    console.log('[callArticleStructureAgent] 洞察详情:');
    allInsights.forEach((insight, index) => {
      console.log(`  [${index + 1}] ID: ${insight.id}, 决策: ${insight.user_decision}, 分类: ${insight.category}`);
      console.log(`      内容: ${insight.insight.substring(0, 100)}...`);
    });
    
    const decisionDistribution = {
      adopt: allInsights.filter(i => i.user_decision === 'adopt').length,
      downgrade: allInsights.filter(i => i.user_decision === 'downgrade').length,
      reject: allInsights.filter(i => i.user_decision === 'reject').length,
      pending: allInsights.filter(i => i.user_decision === 'pending').length,
    };
    console.log('[callArticleStructureAgent] 洞察决策分布:', decisionDistribution);

    // 4. 内容筛选（非常重要）：只保留用户采用的洞察
    console.log('[callArticleStructureAgent] 步骤4: 内容筛选');
    console.log('[callArticleStructureAgent] 筛选规则: 只保留 user_decision === "adopt" 的洞察');
    
    const adoptedInsights = allInsights.filter(i => i.user_decision === 'adopt');
    const respondGaps = allGaps.filter(g => g.user_decision === 'respond');

    console.log('[callArticleStructureAgent] 采用的洞察数:', adoptedInsights.length);
    console.log('[callArticleStructureAgent] 需要处理的空白数:', respondGaps.length);
    
    if (adoptedInsights.length > 0) {
      console.log('[callArticleStructureAgent] 采用的洞察列表:');
      adoptedInsights.forEach((insight, index) => {
        console.log(`  [${index + 1}] ${insight.category}: ${insight.insight.substring(0, 80)}...`);
      });
    }

    if (adoptedInsights.length === 0) {
      const totalInsights = allInsights.length;
      const downgradedCount = decisionDistribution.downgrade;
      const rejectedCount = decisionDistribution.reject;
      const pendingCount = decisionDistribution.pending;
      
      const errorMsg = 
        `没有已采用的研究洞察，无法生成文章结构。\n` +
        `当前状态：总计 ${totalInsights} 条洞察，` +
        `其中 ${pendingCount} 条待决策，${downgradedCount} 条降级为背景，${rejectedCount} 条已排除。\n` +
        `请至少选择一条洞察为"必须使用"。`;
      
      console.error('[callArticleStructureAgent] 错误:', errorMsg);
      throw new Error(errorMsg);
    }

    // 5. 构建输入 JSON
    console.log('[callArticleStructureAgent] 步骤5: 构建输入数据');
    const structureInput = {
      topic: requirements.topic || project.title,
      user_core_thesis: null,
      confirmed_insights: adoptedInsights.map(insight => ({
        id: insight.id,
        category: insight.category,
        content: insight.insight,
        source_insight_id: insight.insight_id
      })),
      context_flags: {
        confirmed_insight_count: adoptedInsights.length,
        contradictions_or_gaps_present: respondGaps.length > 0
      }
    };

    console.log('[callArticleStructureAgent] 输入数据结构:');
    console.log('  - topic:', structureInput.topic);
    console.log('  - confirmed_insights 数量:', structureInput.confirmed_insights.length);
    console.log('  - contradictions_or_gaps_present:', structureInput.context_flags.contradictions_or_gaps_present);
    console.log('[callArticleStructureAgent] 完整输入 JSON:', JSON.stringify(structureInput, null, 2));

    // 6. 调用 Edge Function
    console.log('[callArticleStructureAgent] 步骤6: 调用 generate-article-structure Edge Function');
    const { data, error } = await supabase.functions.invoke('generate-article-structure', {
      body: { input: structureInput }
    });

    if (error) {
      console.error('[callArticleStructureAgent] Edge Function 错误:', error);
      console.error('[callArticleStructureAgent] 错误详情:', JSON.stringify(error, null, 2));
      
      // 尝试获取更详细的错误信息
      if (error.context) {
        try {
          const errorText = await error.context.text();
          console.error('[callArticleStructureAgent] 错误响应内容:', errorText);
          throw new Error(`文章结构生成失败: ${errorText}`);
        } catch (e) {
          console.error('[callArticleStructureAgent] 无法读取错误响应:', e);
        }
      }
      
      throw new Error(`文章结构生成失败: ${error.message || 'Edge Function 调用失败'}`);
    }

    console.log('[callArticleStructureAgent] Edge Function 调用成功');
    console.log('[callArticleStructureAgent] 返回数据:', JSON.stringify(data, null, 2));

    // 7. 保存结构结果到 session
    console.log('[callArticleStructureAgent] 步骤7: 保存结构结果到数据库');
    const { error: updateError } = await supabase
      .from('writing_sessions')
      .update({
        structure_result: data,
        current_stage: 'structure',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[callArticleStructureAgent] 保存结构失败:', updateError);
      throw updateError;
    }

    console.log('[callArticleStructureAgent] ========== 文章结构生成完成 ==========');
    return data;
  } catch (error: any) {
    console.error('[callArticleStructureAgent] ========== 发生错误 ==========');
    console.error('[callArticleStructureAgent] 错误类型:', error.constructor.name);
    console.error('[callArticleStructureAgent] 错误消息:', error.message);
    console.error('[callArticleStructureAgent] 错误堆栈:', error.stack);
    throw error;
  }
}

// 获取会话的文章结构结果
export async function getStructureResult(sessionId: string): Promise<any> {
  const { data, error } = await supabase
    .from('writing_sessions')
    .select('structure_result')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data?.structure_result || null;
}

// 更新文章结构结果
export async function updateStructureResult(sessionId: string, structureResult: any): Promise<void> {
  const { error } = await supabase
    .from('writing_sessions')
    .update({
      structure_result: structureResult,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) throw error;
}

// ==================== 检索资料管理 ====================

// 获取会话的所有检索资料
export async function getRetrievedMaterials(sessionId: string): Promise<RetrievedMaterial[]> {
  console.log('[getRetrievedMaterials] 开始查询，sessionId:', sessionId);
  
  const { data, error } = await supabase
    .from('retrieved_materials')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getRetrievedMaterials] 查询失败:', error);
    throw error;
  }
  
  console.log('[getRetrievedMaterials] 查询成功，数据:', data);
  console.log('[getRetrievedMaterials] 数据数量:', data?.length || 0);
  
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

// 更新检索资料的选中状态
export async function updateRetrievedMaterialSelection(
  materialId: string,
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('id', materialId);

  if (error) {
    console.error('[updateRetrievedMaterialSelection] 更新失败:', error);
    throw error;
  }
  console.log('[updateRetrievedMaterialSelection] 更新成功:', materialId, isSelected);
}

// 批量更新检索资料的选中状态
export async function batchUpdateRetrievedMaterialSelection(
  sessionId: string,
  materialIds: string[],
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('session_id', sessionId)
    .in('id', materialIds);

  if (error) {
    console.error('[batchUpdateRetrievedMaterialSelection] 批量更新失败:', error);
    throw error;
  }
  console.log('[batchUpdateRetrievedMaterialSelection] 批量更新成功:', materialIds.length, '条资料');
}

// ============ New Agent API ============

/**
 * 调用 brief-agent 生成需求文档
 */
export async function callBriefAgent(projectId: string, topic: string, userInput: string) {
  const { data, error } = await supabase.functions.invoke('brief-agent', {
    body: { project_id: projectId, topic, user_input: userInput }
  });

  if (error) throw error;
  return data;
}

/**
 * 调用 structure-agent 生成文章结构
 */
export async function callStructureAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('structure-agent', {
    body: { project_id: projectId }
  });

  if (error) throw error;
  return data;
}

/**
 * 调用 draft-agent 生成草稿
 */
export async function callDraftAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('draft-agent', {
    body: { project_id: projectId }
  });

  if (error) throw error;
  return data;
}

/**
 * 调用 review-agent 进行审校
 */
export async function callReviewAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('review-agent', {
    body: { project_id: projectId }
  });

  if (error) throw error;
  return data;
}

/**
 * 扣除用户点数
 */
export async function deductUserPoints(userId: string, points: number, reason: string) {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('available_credits')
    .eq('id', userId)
    .single();

  if (fetchError) throw fetchError;

  const newBalance = (profile.available_credits || 0) - points;
  if (newBalance < 0) {
    throw new Error('点数不足');
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ available_credits: newBalance })
    .eq('id', userId);

  if (updateError) throw updateError;

  console.log(`[deductUserPoints] 用户 ${userId} 扣除 ${points} 点，原因：${reason}`);
  
  return newBalance;
}

/**
 * 标记项目为已完成
 */
export async function markProjectAsCompleted(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .update({ is_completed: true })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * 增加项目的资料刷新次数
 */
export async function incrementResearchRefreshCount(projectId: string) {
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('research_refreshed_count')
    .eq('id', projectId)
    .single();

  if (fetchError) throw fetchError;

  const newCount = (project.research_refreshed_count || 0) + 1;

  const { error: updateError } = await supabase
    .from('projects')
    .update({ research_refreshed_count: newCount })
    .eq('id', projectId);

  if (updateError) throw updateError;

  return newCount;
}

