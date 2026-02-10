import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsSearchRequest {
  q: string;
  hl?: string;
  gl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { q, hl = 'zh-CN', gl = 'cn' }: NewsSearchRequest = await req.json();

    if (!q) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数: q' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let apiKey = Deno.env.get('SERPAPI_API_KEY');
    
    // 如果环境变量没有配置，尝试从数据库读取
    if (!apiKey) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: config } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'search_api_key')
        .maybeSingle();
        
      if (config?.config_value) {
        apiKey = config.config_value;
        console.log('[SerpAPI Google News] 从数据库加载了 API Key');
      }
    }

    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY 未配置');
    }

    // 构建 SerpAPI 请求 URL
    const params = new URLSearchParams({
      engine: 'google_news',
      q,
      api_key: apiKey,
      hl,
      gl,
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    console.log('[SerpAPI Google News] 请求 URL:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SerpAPI Google News] API 请求失败:', errorText);
      throw new Error(`SerpAPI 请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // 检查是否有错误
    if (data.error) {
      throw new Error(`SerpAPI 返回错误: ${data.error}`);
    }

    // 提取新闻结果
    const results = data.news_results || [];
    
    console.log(`[SerpAPI Google News] 找到 ${results.length} 条结果`);

    return new Response(
      JSON.stringify({
        results: results.map((item: any) => ({
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
          source: item.source?.name || '',
          date: item.date || '',
          thumbnail: item.thumbnail || '',
          position: item.position || 0,
        })),
        search_metadata: data.search_metadata,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('[SerpAPI Google News] 错误:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || '搜索失败',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
