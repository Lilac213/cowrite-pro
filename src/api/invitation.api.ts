import { supabase } from '@/db/supabase';
import type { InvitationCode } from '@/types';
import { getProfile } from './profile.api';

const supabaseClient = supabase as any;

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createInvitationCode(credits: number): Promise<InvitationCode> {
  const code = generateInvitationCode();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabaseClient
    .from('invitation_codes')
    .insert({ code, credits, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('创建邀请码失败');
  return data as InvitationCode;
}

export async function getAllInvitationCodes(): Promise<InvitationCode[]> {
  const { data, error } = await supabaseClient
    .from('invitation_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as InvitationCode[];
}

export async function useInvitationCode(code: string, userId: string): Promise<void> {
  const { data: inviteCode, error: fetchError } = await supabaseClient
    .from('invitation_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!inviteCode) throw new Error('邀请码不存在或已失效');

  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');

  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ available_credits: profile.available_credits + inviteCode.credits })
    .eq('id', userId);
  if (updateError) throw updateError;

  const { error: incrementError } = await supabaseClient
    .from('invitation_codes')
    .update({ used_count: inviteCode.used_count + 1 })
    .eq('id', inviteCode.id);
  if (incrementError) throw incrementError;
}

export async function deactivateInvitationCode(codeId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('invitation_codes')
    .update({ is_active: false })
    .eq('id', codeId);
  if (error) throw error;
}
