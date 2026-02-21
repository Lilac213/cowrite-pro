import { supabase } from '@/db/supabase';
import { apiJson } from './http';
import type { Draft } from '@/types';

const supabaseClient = supabase as any;

export async function getDrafts(projectId: string) {
  const { data, error } = await supabaseClient
    .from('drafts')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Draft[];
}

export async function getLatestDraft(projectId: string) {
  const { data, error } = await supabaseClient
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
  const { data, error } = await supabaseClient
    .from('drafts')
    .insert(draft)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建 draft 失败');
  return data as Draft;
}

export async function updateDraft(draftId: string, updates: Partial<Draft>) {
  const { data, error } = await supabaseClient
    .from('drafts')
    .update(updates)
    .eq('id', draftId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新 draft 失败');
  return data as Draft;
}

export async function callDraftAgent(projectId: string) {
  return apiJson('/api/draft-agent', { project_id: projectId }, true);
}

export async function callDraftContentAgent(projectId: string) {
  return apiJson('/api/draft/generate-content', { project_id: projectId }, true);
}

export async function callDraftAnalysisAgent(draftId: string) {
  return apiJson('/api/draft/analyze-structure', { draft_id: draftId }, true);
}

export async function callReviewAgent(projectId: string) {
  return apiJson('/api/review-agent', { project_id: projectId }, true);
}
