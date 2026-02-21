import { supabase } from '@/db/supabase';
import { apiJson } from './http';
import type { Outline } from '@/types';

const supabaseClient = supabase as any;

export async function getOutlines(projectId: string) {
  const { data, error } = await supabaseClient
    .from('outlines')
    .select('*')
    .eq('project_id', projectId)
    .order('paragraph_order', { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Outline[];
}

export async function createOutline(outline: Omit<Outline, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseClient
    .from('outlines')
    .insert(outline)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建大纲失败');
  return data as Outline;
}

export async function updateOutline(outlineId: string, updates: Partial<Outline>) {
  const { data, error } = await supabaseClient
    .from('outlines')
    .update(updates)
    .eq('id', outlineId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新大纲失败');
  return data as Outline;
}

export async function deleteOutline(outlineId: string) {
  const { error } = await supabaseClient.from('outlines').delete().eq('id', outlineId);
  if (error) throw error;
}

export async function batchCreateOutlines(outlines: Array<Omit<Outline, 'id' | 'created_at' | 'updated_at'>>) {
  const { data, error } = await supabaseClient.from('outlines').insert(outlines).select();
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Outline[];
}

export async function callStructureAgent(projectId: string) {
  return apiJson('/api/structure-agent', { project_id: projectId }, true);
}
