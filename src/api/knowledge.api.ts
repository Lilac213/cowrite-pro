import { supabase } from '@/db/supabase';
import type { KnowledgeBase } from '@/types';

const supabaseClient = supabase as any;

export async function getKnowledgeBase(projectId: string) {
  const { data, error } = await supabaseClient
    .from('knowledge_base')
    .select('*')
    .eq('project_id', projectId)
    .order('collected_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as KnowledgeBase[];
}

export async function createKnowledgeBase(knowledge: Omit<KnowledgeBase, 'id' | 'created_at'>) {
  const { data, error } = await supabaseClient
    .from('knowledge_base')
    .insert(knowledge)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建知识库失败');
  return data as KnowledgeBase;
}

export async function updateKnowledgeBase(knowledgeId: string, updates: Partial<KnowledgeBase>) {
  const { data, error } = await supabaseClient
    .from('knowledge_base')
    .update(updates)
    .eq('id', knowledgeId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新知识库失败');
  return data as KnowledgeBase;
}

export async function deleteKnowledgeBase(knowledgeId: string) {
  const { error } = await supabaseClient.from('knowledge_base').delete().eq('id', knowledgeId);
  if (error) throw error;
}

export async function clearProjectKnowledge(projectId: string) {
  const { error } = await supabaseClient.from('knowledge_base').delete().eq('project_id', projectId);
  if (error) throw error;
}
