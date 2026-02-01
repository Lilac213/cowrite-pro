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
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少搜索关键词' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('TAVILY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Tavily API 密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 调用 Tavily Search API
    const response = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: query,
          search_depth: 'advanced',
          include_answer: true,
          include_raw_content: false,
          max_results: 10,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Tavily API 请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // 转换为统一格式
    const results = {
      summary: data.answer || '',
      papers: (data.results || []).map((result: any) => ({
        title: result.title || '',
        authors: 'Tavily Search',
        year: new Date().getFullYear().toString(),
        abstract: result.content || '',
        citations: 0,
        url: result.url || '',
        source: 'Tavily',
      })),
      sources: (data.results || []).map((result: any) => ({
        url: result.url || '',
        title: result.title || '',
      })),
      total: data.results?.length || 0,
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
