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
    const { query, yearStart, yearEnd } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少搜索关键词' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建 OpenAlex API 查询
    const params = new URLSearchParams({
      search: query,
      per_page: '10',
      sort: 'cited_by_count:desc',
    });

    // 添加年份过滤
    if (yearStart || yearEnd) {
      const fromYear = yearStart || '2000';
      const toYear = yearEnd || new Date().getFullYear().toString();
      params.append('filter', `publication_year:${fromYear}-${toYear}`);
    }

    // 调用 OpenAlex API（免费开放 API）
    const response = await fetch(
      `https://api.openalex.org/works?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoWrite (mailto:support@cowrite.app)',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAlex API 请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // 转换为统一格式
    const results = {
      papers: (data.results || []).map((work: any) => ({
        title: work.title || '',
        authors: work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean).join(', ') || '',
        year: work.publication_year?.toString() || '',
        abstract: work.abstract || work.abstract_inverted_index ? '摘要可用' : '',
        citations: work.cited_by_count || 0,
        url: work.doi ? `https://doi.org/${work.doi}` : work.id || '',
        source: 'OpenAlex',
      })),
      total: data.meta?.count || 0,
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
