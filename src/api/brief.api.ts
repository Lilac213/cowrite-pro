import { supabase } from '@/db/supabase';
import { apiJson } from './http';
import type { Brief } from '@/types';

const supabaseClient = supabase as any;

export async function getBrief(projectId: string) {
  const { data, error } = await supabaseClient
    .from('briefs')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data as Brief | null;
}

export async function createBrief(brief: Omit<Brief, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseClient
    .from('briefs')
    .insert(brief)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建 brief 失败');
  return data as Brief;
}

export async function updateBrief(briefId: string, updates: Partial<Brief>) {
  const { data, error } = await supabaseClient
    .from('briefs')
    .update(updates)
    .eq('id', briefId)
    .select();
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? (data[0] as Brief) : null;
}

export async function callBriefAgent(projectId: string, topic: string, userInput: string) {
  return apiJson('/api/brief-agent', { project_id: projectId, topic, user_input: userInput });
}
