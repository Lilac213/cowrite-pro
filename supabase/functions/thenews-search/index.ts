import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10, language = 'zh,en' } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少搜索关键词' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serpApiKey = Deno.env.get('SERPAPI_KEY');
    if (!serpApiKey) {
      return new Response(
        JSON.stringify({ error: 'SerpAPI密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建查询参数
    const params = new URLSearchParams({
      engine: 'google_news',
      q: query,
      api_key: serpApiKey,
      num: limit.toString(),
    });

    // 根据语言设置地区
    if (language.includes('zh')) {
      params.append('gl', 'cn'); // 中国
      params.append('hl', 'zh-cn'); // 中文
    } else {
      params.append('gl', 'us'); // 美国
      params.append('hl', 'en'); // 英文
    }

    // 调用 SerpAPI Google News
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
    const newsResults = data.news_results || [];
    const results = {
      papers: newsResults.map((article: any) => ({
        title: article.title || '',
        authors: article.source?.name || 'Google News',
        year: article.date ? new Date(article.date).getFullYear().toString() : new Date().getFullYear().toString(),
        abstract: article.snippet || '',
        citations: 0,
        url: article.link || '',
        source: 'Google News',
        publishedAt: article.date,
      })),
      total: newsResults.length,
      summary: '',
      sources: newsResults.map((article: any) => ({
        url: article.link,
        title: article.title,
      })),
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
