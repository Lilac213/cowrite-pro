import { getProfile, updateProfile } from '@/api/profile.api';

export async function checkResearchLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  if (profile.unlimited_credits) return true;
  return profile.available_credits >= 3;
}

export async function deductResearchCredits(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  if (profile.unlimited_credits) return;
  
  if (profile.available_credits < 3) {
    throw new Error('点数不足，资料查询和整理需要3点');
  }
  
  await updateProfile(userId, {
    available_credits: profile.available_credits - 3,
  });
}

export async function checkAIReducerLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  if (profile.unlimited_credits) return true;
  return profile.available_credits > 0;
}

export async function incrementAIReducerUsage(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  if (profile.unlimited_credits) {
    await updateProfile(userId, { ai_reducer_used: profile.ai_reducer_used + 1 });
    return;
  }

  if (profile.available_credits <= 0) {
    throw new Error('点数不足，请购买点数');
  }

  await updateProfile(userId, {
    ai_reducer_used: profile.ai_reducer_used + 1,
    available_credits: profile.available_credits - 1,
  });
}

export async function setUserCredits(userId: string, credits: number): Promise<void> {
  const updateData = credits === -1
    ? { available_credits: 0, unlimited_credits: true }
    : { available_credits: credits, unlimited_credits: false };
  await updateProfile(userId, updateData);
}

export async function deductUserPoints(userId: string, points: number): Promise<number> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');

  if (profile.unlimited_credits) return -1;

  const newBalance = (profile.available_credits || 0) - points;
  if (newBalance < 0) throw new Error('点数不足');

  await updateProfile(userId, { available_credits: newBalance });
  return newBalance;
}

export async function incrementProjectCount(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  await updateProfile(userId, { projects_created: profile.projects_created + 1 });
}
