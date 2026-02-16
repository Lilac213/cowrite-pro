import { supabase } from '@/db/supabase';
import type { ReferenceArticle } from '@/types';

export async function getReferenceArticles(userId: string, projectId?: string) {
  let query = supabase.from('reference_articles').select('*').eq('user_id', userId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ReferenceArticle[];
}

export async function createReferenceArticle(article: Omit<ReferenceArticle, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('reference_articles')
    .insert(article as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ReferenceArticle;
}

export async function updateReferenceArticle(articleId: string, updates: Partial<ReferenceArticle>) {
  const { data, error } = await supabase
    .from('reference_articles')
    .update(updates as any)
    .eq('id', articleId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ReferenceArticle;
}

export async function deleteReferenceArticle(articleId: string) {
  const { error } = await supabase.from('reference_articles').delete().eq('id', articleId);
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
