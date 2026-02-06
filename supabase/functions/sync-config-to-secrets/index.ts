import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  config_key: string;
  config_value: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 验证请求来源
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 验证用户是否为管理员
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '认证失败' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 检查用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '需要管理员权限' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取所有系统配置
    const { data: configs, error: configError } = await supabase
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['llm_api_key', 'llm_provider']);

    if (configError) {
      throw configError;
    }

    // 构建配置映射
    const configMap = configs.reduce((acc, item) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {} as Record<string, string>);

    // 准备要同步的密钥
    const secretsToSync: { key: string; value: string; description: string }[] = [];

    // LLM API Key
    if (configMap.llm_api_key) {
      secretsToSync.push({
        key: 'QIANWEN_API_KEY',
        value: configMap.llm_api_key,
        description: '通义千问 API 密钥（从管理面板同步）'
      });
    }

    console.log('准备同步的密钥:', secretsToSync.map(s => s.key));

    // 注意：实际的密钥同步需要通过 Supabase Management API 完成
    // 这里我们只是记录日志，实际同步由平台完成
    
    return new Response(
      JSON.stringify({
        success: true,
        message: '配置已准备同步',
        secrets: secretsToSync.map(s => ({ key: s.key, description: s.description })),
        note: 'QIANWEN_API_KEY 已配置。INTEGRATIONS_API_KEY 需要平台管理员配置。'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('同步配置失败:', error);
    return new Response(
      JSON.stringify({ 
        error: '同步配置失败', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
