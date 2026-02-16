import { supabase } from '@/db/supabase';
import type { SystemConfig } from '@/types';

export async function getSystemConfig() {
  const { data, error } = await supabase.from('system_config').select('*');
  if (error) throw error;
  return data as SystemConfig[];
}

export async function updateSystemConfig(configKey: string, configValue: string) {
  const { data, error } = await supabase
    .from('system_config')
    .upsert({ 
      config_key: configKey, 
      config_value: configValue,
      updated_at: new Date().toISOString()
    } as any, { onConflict: 'config_key' })
    .select()
    .single();
  if (error) throw error;
  return data as SystemConfig;
}
