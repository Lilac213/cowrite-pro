import { supabase } from '@/db/supabase';
import type { Draft } from '@/types';

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
    .insert(draft as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Draft;
}

export async function updateDraft(draftId: string, updates: Partial<Draft>) {
  const { data, error } = await supabase
    .from('drafts')
    .update(updates as any)
    .eq('id', draftId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Draft;
}

export async function callDraftAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('draft-agent', {
    body: { project_id: projectId }
  });
  if (error) throw error;
  return data;
}

export async function callReviewAgent(projectId: string) {
  const { data, error } = await supabase.functions.invoke('review-agent', {
    body: { project_id: projectId }
  });
  if (error) throw error;
  return data;
}
