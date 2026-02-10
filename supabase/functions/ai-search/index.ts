import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, num = 10 } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少搜索关键词' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serpApiKey = Deno.env.get('SERPAPI_API_KEY') || Deno.env.get('SERPAPI_KEY');
    
    // 如果环境变量没有配置，尝试从数据库读取
    if (!serpApiKey) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: config } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'search_api_key')
        .maybeSingle();
        
      if (config?.config_value) {
        serpApiKey = config.config_value;
        console.log('[AI Search] 从数据库加载了 API Key');
      }
    }

    if (!serpApiKey) {
      return new Response(
        JSON.stringify({ error: 'SerpAPI密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建查询参数
    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      api_key: serpApiKey,
      num: num.toString(),
      gl: 'cn', // 中国地区
      hl: 'zh-cn', // 中文
    });

    // 调用 SerpAPI Google Search
    const response = await fetch(
      `https://serpapi.com/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `SerpAPI请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // 提取有机搜索结果
    const organicResults = data.organic_results || [];
    
    // 构建摘要（使用前3个结果的片段）
    const summary = organicResults
      .slice(0, 3)
      .map((result: any) => result.snippet || '')
      .filter((snippet: string) => snippet)
      .join('\n\n');

    // 提取来源
    const sources = organicResults.map((result: any) => ({
      url: result.link || '',
      title: result.title || '',
      snippet: result.snippet || '',
    }));

    const results = {
      summary: summary || '未找到相关信息',
      sources: sources,
      source: 'Google Search',
      total: data.search_information?.total_results || 0,
    };

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
