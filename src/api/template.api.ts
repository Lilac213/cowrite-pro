import { supabase } from '@/db/supabase';
import { apiJson } from './http';
import type { Template } from '@/types';

const supabaseClient = supabase as any;

export async function getTemplates(userId: string) {
  const { data, error } = await supabaseClient
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Template[];
}

export async function createTemplate(template: Omit<Template, 'id' | 'created_at'>) {
  const { data, error } = await supabaseClient
    .from('templates')
    .insert(template)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建模板失败');
  return data as Template;
}

export async function updateTemplate(templateId: string, updates: Partial<Template>) {
  const { data, error } = await supabaseClient
    .from('templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新模板失败');
  return data as Template;
}

export async function deleteTemplate(templateId: string) {
  const { error } = await supabaseClient.from('templates').delete().eq('id', templateId);
  if (error) throw error;
}

export async function generateTemplateRules(description: string) {
  const data = await apiJson<{ result: any }>(
    '/api/llm/generate',
    {
      prompt: description,
      schema: {
        required: ['meta', 'page', 'styles', 'structure', 'forbidden_direct_formatting']
      }
    },
    true
  );
  return data.result;
}
