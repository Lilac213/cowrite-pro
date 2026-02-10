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
    const { query, yearStart, yearEnd, start = 0 } = await req.json();

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
        console.log('[Google Scholar Search] 从数据库加载了 API Key');
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
      engine: 'google_scholar',
      q: query,
      api_key: serpApiKey,
      start: start.toString(),
      num: '10', // 每页结果数
    });

    if (yearStart) params.append('as_ylo', yearStart);
    if (yearEnd) params.append('as_yhi', yearEnd);

    // 调用 SerpAPI Google Scholar
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

    // 转换为统一格式
    const results = {
      papers: (data.organic_results || []).map((paper: any) => ({
        title: paper.title || '',
        authors: paper.publication_info?.summary || '',
        year: paper.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
        abstract: paper.snippet || '',
        citations: paper.inline_links?.cited_by?.total || 0,
        url: paper.link || '',
        source: 'Google Scholar',
      })),
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
