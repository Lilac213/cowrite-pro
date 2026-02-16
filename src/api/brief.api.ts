import { supabase } from '@/db/supabase';
import type { Brief } from '@/types';

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
    .insert(brief as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Brief;
}

export async function updateBrief(briefId: string, updates: Partial<Brief>) {
  const { data, error } = await supabase
    .from('briefs')
    .update(updates as any)
    .eq('id', briefId)
    .select();
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? (data[0] as Brief) : null;
}

export async function callBriefAgent(projectId: string, topic: string, userInput: string) {
  const { data, error } = await supabase.functions.invoke('brief-agent', {
    body: { project_id: projectId, topic, user_input: userInput }
  });
  if (error) throw error;
  return data;
}
