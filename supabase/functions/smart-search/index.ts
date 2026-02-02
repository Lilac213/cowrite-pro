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
    const { query, count = 10, freshness, mkt = 'zh-CN' } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少搜索关键词' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建查询参数
    const params = new URLSearchParams({
      q: query,
      count: count.toString(),
      mkt: mkt,
    });

    if (freshness) {
      params.append('freshness', freshness);
    }

    // 调用 Smart Search API
    const response = await fetch(
      `https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?${params.toString()}`,
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
    const webPages = data.webPages?.value || [];
    const results = {
      papers: webPages.map((page: any) => ({
        title: page.name || '',
        authors: page.siteName || 'Web Search',
        year: page.dateLastCrawled ? new Date(page.dateLastCrawled).getFullYear().toString() : '',
        abstract: page.snippet || '',
        citations: 0,
        url: page.url || '',
        source: 'Smart Search',
        publishedAt: page.dateLastCrawled,
      })),
      total: webPages.length,
      summary: '',
      sources: webPages.map((page: any) => ({
        url: page.url,
        title: page.name,
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
