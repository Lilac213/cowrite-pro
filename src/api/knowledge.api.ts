import { supabase } from '@/db/supabase';
import type { KnowledgeBase } from '@/types';

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
    .insert(knowledge as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as KnowledgeBase;
}

export async function updateKnowledgeBase(knowledgeId: string, updates: Partial<KnowledgeBase>) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .update(updates as any)
    .eq('id', knowledgeId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as KnowledgeBase;
}

export async function deleteKnowledgeBase(knowledgeId: string) {
  const { error } = await supabase.from('knowledge_base').delete().eq('id', knowledgeId);
  if (error) throw error;
}

export async function clearProjectKnowledge(projectId: string) {
  const { error } = await supabase.from('knowledge_base').delete().eq('project_id', projectId);
  if (error) throw error;
}
