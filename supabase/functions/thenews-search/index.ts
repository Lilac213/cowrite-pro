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

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    const apiToken = Deno.env.get('THENEWS_API_TOKEN');
    
    if (!apiKey || !apiToken) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建查询参数
    const params = new URLSearchParams({
      api_token: apiToken,
      search: query,
      language: language,
      limit: limit.toString(),
      sort: 'relevance_score',
    });

    // 调用 TheNews All News API
    const response = await fetch(
      `https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?${params.toString()}`,
      {
        headers: {
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // 转换为统一格式
    const results = {
      papers: (data.data || []).map((article: any) => ({
        title: article.title || '',
        authors: article.source || 'TheNews',
        year: article.published_at ? new Date(article.published_at).getFullYear().toString() : '',
        abstract: article.description || article.snippet || '',
        citations: 0,
        url: article.url || '',
        source: 'TheNews',
        publishedAt: article.published_at,
      })),
      total: data.meta?.found || 0,
      summary: '',
      sources: (data.data || []).map((article: any) => ({
        url: article.url,
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
