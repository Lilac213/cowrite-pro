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
      .in('config_key', ['llm_api_key', 'llm_provider', 'search_api_key']);

    if (configError) {
      throw configError;
    }

    // 构建配置映射
    const configMap = configs.reduce((acc, item) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {} as Record<string, string>);

    // 准备要同步的密钥
    const secretsToSync: { name: string; value: string }[] = [];

    // LLM API Key
    if (configMap.llm_api_key) {
      secretsToSync.push({
        name: 'QIANWEN_API_KEY',
        value: configMap.llm_api_key,
      });
    }

    // Search API Key (SerpAPI)
    if (configMap.search_api_key) {
      secretsToSync.push({
        name: 'SERPAPI_API_KEY',
        value: configMap.search_api_key,
      });
    }

    console.log('准备同步的密钥:', secretsToSync.map(s => s.name));

    // 调用 Supabase Management API 同步密钥
    // 注意：这需要 SUPABASE_ACCESS_TOKEN 和 SUPABASE_PROJECT_REF
    const accessToken = Deno.env.get('SUPABASE_ACCESS_TOKEN');
    const projectRef = Deno.env.get('SUPABASE_PROJECT_REF');
    
    let syncResult = null;
    if (accessToken && projectRef && secretsToSync.length > 0) {
      try {
        // 调用 Supabase Management API 批量创建/更新密钥
        const response = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(secretsToSync),
          }
        );
        
        if (response.ok) {
          syncResult = await response.json();
          console.log('密钥同步成功:', syncResult);
        } else {
          const errorText = await response.text();
          console.error('密钥同步失败:', response.status, errorText);
        }
      } catch (syncError) {
        console.error('调用 Management API 失败:', syncError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: '配置已保存到数据库',
        secrets: secretsToSync.map(s => s.name),
        synced: syncResult !== null,
        note: syncResult 
          ? 'QIANWEN_API_KEY 和 SERPAPI_API_KEY 已同步到 Edge Function 环境。' 
          : '配置已保存到数据库，Edge Functions 将从数据库读取配置。'
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
