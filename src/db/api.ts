import { supabase } from './supabase';
import type {
  Profile,
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
} from '@/types';

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
  const { data, error } = await supabase.functions.invoke<{ result: string }>('llm-generate', {
    body: { prompt, context, systemMessage },
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('未收到响应');
  return data.result;
}

export async function callWebSearch(query: string) {
  const { data, error } = await supabase.functions.invoke<{ results: SearchResult[] }>('web-search', {
    body: { query },
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('未收到响应');
  return data.results;
}
