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
    const { query, yearStart, yearEnd, start = 0 } = await req.json();

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
      engine: 'google_scholar',
      q: query,
      start: start.toString(),
    });

    if (yearStart) params.append('as_ylo', yearStart);
    if (yearEnd) params.append('as_yhi', yearEnd);

    // 调用 Google Scholar API
    const response = await fetch(
      `https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
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
