import { supabase } from '@/db/supabase';
import type { Project } from '@/types';

const supabaseClient = supabase as any;

export async function getProjects(userId: string) {
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Project[];
}

export async function getProject(projectId: string) {
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

export async function createProject(userId: string, title: string) {
  const { data, error } = await supabaseClient
    .from('projects')
    .insert({ user_id: userId, title })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建项目失败');
  return data as Project;
}

export async function updateProject(projectId: string, updates: Partial<Project>) {
  const { data, error } = await supabaseClient
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新项目失败');
  return data as Project;
}

export async function deleteProject(projectId: string) {
  const { error } = await supabaseClient.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function updateArticleArgumentStructure(projectId: string, structure: any) {
  const { data, error } = await supabaseClient
    .from('projects')
    .update({ article_argument_structure: structure })
    .eq('id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markProjectAsCompleted(projectId: string) {
  const { error } = await supabaseClient
    .from('projects')
    .update({ is_completed: true })
    .eq('id', projectId);
  if (error) throw error;
}

export async function incrementResearchRefreshCount(projectId: string) {
  const { data: project, error: fetchError } = await supabaseClient
    .from('projects')
    .select('research_refreshed_count')
    .eq('id', projectId)
    .single();
  if (fetchError) throw fetchError;

  const newCount = (project.research_refreshed_count || 0) + 1;
  const { error: updateError } = await supabaseClient
    .from('projects')
    .update({ research_refreshed_count: newCount })
    .eq('id', projectId);
  if (updateError) throw updateError;
  return newCount;
}
