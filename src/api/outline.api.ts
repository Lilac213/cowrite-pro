import { supabase } from '@/db/supabase';
import type { Outline } from '@/types';

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
    .insert(outline as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Outline;
}

export async function updateOutline(outlineId: string, updates: Partial<Outline>) {
  const { data, error } = await supabase
    .from('outlines')
    .update(updates as any)
    .eq('id', outlineId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Outline;
}

export async function deleteOutline(outlineId: string) {
  const { error } = await supabase.from('outlines').delete().eq('id', outlineId);
  if (error) throw error;
}

export async function batchCreateOutlines(outlines: Array<Omit<Outline, 'id' | 'created_at' | 'updated_at'>>) {
  const { data, error } = await supabase.from('outlines').insert(outlines as any).select();
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Outline[];
}

export async function callStructureAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('structure-agent', {
    body: { project_id: projectId }
  });
  if (error) throw error;
  return data;
}
