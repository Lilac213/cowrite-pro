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

    // 获取用户配置
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('search_api_key, search_provider')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: '无法获取用户配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.search_api_key || !profile.search_provider) {
      return new Response(
        JSON.stringify({ error: '请先在设置中配置搜索 API 密钥和提供商' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    
    if (profile.search_provider === 'google') {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${profile.search_api_key}&cx=${Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')}&q=${encodeURIComponent(query)}&num=10`
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
    } else if (profile.search_provider === 'bing') {
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': profile.search_api_key,
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
    } else if (profile.search_provider === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${profile.search_api_key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: '你是一个搜索助手，请返回与查询相关的最新信息，包括来源和链接。',
            },
            {
              role: 'user',
              content: query,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API 错误: ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const citations = data.citations || [];
      
      // Perplexity 返回的是综合结果，我们将其作为单个结果返回
      results = [{
        title: query,
        content: content,
        source: 'Perplexity AI',
        url: citations[0] || '',
        publishedAt: new Date().toISOString(),
      }];
    } else {
      return new Response(
        JSON.stringify({ error: `不支持的搜索提供商: ${profile.search_provider}` }),
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
