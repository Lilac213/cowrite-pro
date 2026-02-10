import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 获取用户认证信息
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取系统配置（从 system_config 表读取）
    const { data: configs, error: configError } = await supabaseClient
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['search_provider', 'search_api_key']);

    if (configError) {
      return new Response(
        JSON.stringify({ error: '无法获取系统配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configMap = configs.reduce((acc, item) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {} as Record<string, string>);

    const searchProvider = configMap['search_provider'] || 'openalex';
    const searchApiKey = configMap['search_api_key'];

    // 解析请求体
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少 query 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 根据提供商调用不同的 API
    let results: Array<{
      title: string;
      content: string;
      source: string;
      url: string;
      publishedAt?: string;
    }> = [];
    
    if (searchProvider === 'openalex') {
      // OpenAlex 是开放 API，不需要密钥
      const response = await fetch(
        `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=10&mailto=cowrite@example.com`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAlex API 错误: ${error}`);
      }

      const data = await response.json();
      results = (data.results || []).map((item: any) => ({
        title: item.title || item.display_name || '无标题',
        content: item.abstract || item.description || '无摘要',
        source: item.primary_location?.source?.display_name || 'OpenAlex',
        url: item.doi ? `https://doi.org/${item.doi}` : (item.id || ''),
        publishedAt: item.publication_date,
      }));
    } else if (searchProvider === 'google') {
      if (!searchApiKey) {
        return new Response(
          JSON.stringify({ error: '系统搜索配置未完成，请联系管理员配置' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')}&q=${encodeURIComponent(query)}&num=10`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Search API 错误: ${error}`);
      }

      const data = await response.json();
      results = (data.items || []).map((item: any) => ({
        title: item.title,
        content: item.snippet,
        source: new URL(item.link).hostname,
        url: item.link,
        publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'],
      }));
    } else if (searchProvider === 'bing') {
      if (!searchApiKey) {
        return new Response(
          JSON.stringify({ error: '系统搜索配置未完成，请联系管理员配置' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': searchApiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bing Search API 错误: ${error}`);
      }

      const data = await response.json();
      results = (data.webPages?.value || []).map((item: any) => ({
        title: item.name,
        content: item.snippet,
        source: new URL(item.url).hostname,
        url: item.url,
        publishedAt: item.datePublished,
      }));
    } else if (searchProvider === 'serpapi') {
      if (!searchApiKey) {
        return new Response(
          JSON.stringify({ error: '系统搜索配置未完成，请联系管理员配置' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${searchApiKey}&num=10&hl=zh-cn&gl=cn`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SerpAPI 错误: ${error}`);
      }

      const data = await response.json();
      results = (data.organic_results || []).map((item: any) => ({
        title: item.title,
        content: item.snippet,
        source: item.displayed_link,
        url: item.link,
        publishedAt: '',
      }));
    } else {
      return new Response(
        JSON.stringify({ error: `不支持的搜索提供商: ${searchProvider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
