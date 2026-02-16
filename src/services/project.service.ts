import { getProfile } from '@/api/profile.api';
import { createProject as createProjectApi } from '@/api/project.api';
import { incrementProjectCount } from './credit.service';

export async function createProject(userId: string, title: string) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  if (!profile.unlimited_credits && profile.available_credits <= 0) {
    throw new Error('点数不足，无法创建项目');
  }
  
  const project = await createProjectApi(userId, title);
  await incrementProjectCount(userId);
  return project;
}

export async function checkProjectLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  if (profile.unlimited_credits) return true;
  return profile.available_credits > 0;
}
