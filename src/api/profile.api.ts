import { supabase } from '@/db/supabase';
import type { Profile } from '@/types';

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates as any)
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Profile;
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Profile[];
}

export async function setUserCredits(userId: string, credits: number) {
  const updateData = credits === -1 
    ? { available_credits: 0, unlimited_credits: true }
    : { available_credits: credits, unlimited_credits: false };
  const { error } = await supabase.from('profiles').update(updateData as any).eq('id', userId);
  if (error) throw error;
}
