import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const apiKey = Deno.env.get('SERPAPI_API_KEY');
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
