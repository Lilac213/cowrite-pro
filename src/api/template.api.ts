import { supabase } from '@/db/supabase';
import type { Template } from '@/types';

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
    .insert(template as any)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Template;
}

export async function updateTemplate(templateId: string, updates: Partial<Template>) {
  const { data, error } = await supabase
    .from('templates')
    .update(updates as any)
    .eq('id', templateId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Template;
}

export async function deleteTemplate(templateId: string) {
  const { error } = await supabase.from('templates').delete().eq('id', templateId);
  if (error) throw error;
}

export async function generateTemplateRules(description: string) {
  const { data, error } = await supabase.functions.invoke('llm-generate', {
    body: { prompt: description }
  });
  if (error) throw error;
  return JSON.parse(data.result);
}
