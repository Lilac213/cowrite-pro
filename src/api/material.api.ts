import { supabase } from '@/db/supabase';
import type { Material, RetrievedMaterial } from '@/types';

const supabaseClient = supabase as any;

export async function getMaterials(userId: string, projectId?: string) {
  let query = supabaseClient.from('materials').select('*').eq('user_id', userId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Material[];
}

export async function createMaterial(material: Omit<Material, 'id' | 'created_at'>) {
  const { data, error } = await supabaseClient.from('materials').insert(material).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建素材失败');
  return data as Material;
}

export async function updateMaterial(materialId: string, updates: Partial<Material>) {
  const { data, error } = await supabaseClient
    .from('materials')
    .update(updates)
    .eq('id', materialId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('更新素材失败');
  return data as Material;
}

export async function deleteMaterial(materialId: string) {
  const { error } = await supabaseClient.from('materials').delete().eq('id', materialId);
  if (error) throw error;
}

export async function searchMaterials(userId: string, keyword: string) {
  const { data, error } = await supabaseClient
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,keywords.cs.{${keyword}}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Material[];
}

export async function searchMaterialsByTags(userId: string, tags: string[]) {
  const { data, error } = await supabaseClient
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .overlaps('keywords', tags)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Material[];
}

export async function batchSaveRetrievedMaterials(materials: Array<Omit<RetrievedMaterial, 'id' | 'created_at'>>) {
  const { data, error } = await supabaseClient.from('retrieved_materials').insert(materials).select();
  if (error) throw error;
  return data;
}

export async function getRetrievedMaterials(sessionId: string): Promise<RetrievedMaterial[]> {
  const { data, error } = await supabaseClient
    .from('retrieved_materials')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as RetrievedMaterial[];
}

export async function updateMaterialSelection(materialId: string, isSelected: boolean) {
  const { error } = await supabaseClient
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('id', materialId);
  if (error) throw error;
}

export async function batchUpdateMaterialSelection(selections: Array<{ id: string; is_selected: boolean }>) {
  await Promise.all(selections.map(({ id, is_selected }) => updateMaterialSelection(id, is_selected)));
}
