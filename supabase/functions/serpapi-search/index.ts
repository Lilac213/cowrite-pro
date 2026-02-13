import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SearchEngine = 'scholar' | 'news' | 'search';

interface SearchQuery {
  q: string;
  num?: number;
  start?: number;
  hl?: string;
  gl?: string;
  as_ylo?: number;
  as_yhi?: number;
}

interface MultiSearchRequest {
  engines?: SearchEngine[];
  queries?: {
    scholar?: SearchQuery[];
    news?: SearchQuery[];
    search?: SearchQuery[];
  };
  single?: {
    engine: SearchEngine;
    query: SearchQuery;
  };
}

async function getApiKey(): Promise<string> {
  let apiKey = Deno.env.get('SERPAPI_API_KEY');
  
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
      console.log('[SerpAPI] 从数据库加载了 API Key');
    }
  }

  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY 未配置');
  }
  
  return apiKey;
}

async function searchScholar(apiKey: string, query: SearchQuery): Promise<any> {
  const params = new URLSearchParams({
    engine: 'google_scholar',
    q: query.q,
    api_key: apiKey,
    num: (query.num || 10).toString(),
    start: (query.start || 0).toString(),
    hl: query.hl || 'zh-CN',
  });

  if (query.as_ylo) {
    params.append('as_ylo', query.as_ylo.toString());
  }
  if (query.as_yhi) {
    params.append('as_yhi', query.as_yhi.toString());
  }

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  console.log('[SerpAPI Scholar] 请求:', query.q);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpAPI Scholar 请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`SerpAPI Scholar 返回错误: ${data.error}`);
  }

  const results = data.organic_results || [];
  console.log(`[SerpAPI Scholar] 找到 ${results.length} 条结果`);

  return {
    engine: 'scholar',
    results: results.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      publication_info: item.publication_info || {},
      cited_by: item.inline_links?.cited_by?.total || 0,
      related_pages_link: item.inline_links?.related_pages_link || '',
      position: item.position || 0,
    })),
    search_metadata: data.search_metadata,
  };
}

async function searchNews(apiKey: string, query: SearchQuery): Promise<any> {
  const params = new URLSearchParams({
    engine: 'google_news',
    q: query.q,
    api_key: apiKey,
    hl: query.hl || 'zh-CN',
    gl: query.gl || 'cn',
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  console.log('[SerpAPI News] 请求:', query.q);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpAPI News 请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`SerpAPI News 返回错误: ${data.error}`);
  }

  const results = data.news_results || [];
  console.log(`[SerpAPI News] 找到 ${results.length} 条结果`);

  return {
    engine: 'news',
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
  };
}

async function searchWeb(apiKey: string, query: SearchQuery): Promise<any> {
  const params = new URLSearchParams({
    engine: 'google',
    q: query.q,
    api_key: apiKey,
    num: (query.num || 10).toString(),
    start: (query.start || 0).toString(),
    hl: query.hl || 'zh-CN',
    gl: query.gl || 'cn',
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  console.log('[SerpAPI Search] 请求:', query.q);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpAPI Search 请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`SerpAPI Search 返回错误: ${data.error}`);
  }

  const results = data.organic_results || [];
  console.log(`[SerpAPI Search] 找到 ${results.length} 条结果`);

  return {
    engine: 'search',
    results: results.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayed_link: item.displayed_link || '',
      position: item.position || 0,
    })),
    search_metadata: data.search_metadata,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: MultiSearchRequest = await req.json();
    const apiKey = await getApiKey();

    // 单引擎模式
    if (body.single) {
      const { engine, query } = body.single;
      
      let result;
      switch (engine) {
        case 'scholar':
          result = await searchScholar(apiKey, query);
          break;
        case 'news':
          result = await searchNews(apiKey, query);
          break;
        case 'search':
          result = await searchWeb(apiKey, query);
          break;
        default:
          throw new Error(`不支持的引擎: ${engine}`);
      }
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 多引擎并行模式
    const queries = body.queries || {};
    const engines = body.engines || ['scholar', 'news', 'search'];
    
    const searchPromises: Promise<any>[] = [];

    // Scholar 搜索
    if (engines.includes('scholar') && queries.scholar?.length) {
      for (const query of queries.scholar) {
        searchPromises.push(
          searchScholar(apiKey, query).catch(err => ({
            engine: 'scholar',
            error: err.message,
            results: []
          }))
        );
      }
    }

    // News 搜索
    if (engines.includes('news') && queries.news?.length) {
      for (const query of queries.news) {
        searchPromises.push(
          searchNews(apiKey, query).catch(err => ({
            engine: 'news',
            error: err.message,
            results: []
          }))
        );
      }
    }

    // Web 搜索
    if (engines.includes('search') && queries.search?.length) {
      for (const query of queries.search) {
        searchPromises.push(
          searchWeb(apiKey, query).catch(err => ({
            engine: 'search',
            error: err.message,
            results: []
          }))
        );
      }
    }

    if (searchPromises.length === 0) {
      return new Response(
        JSON.stringify({ error: '未提供有效的搜索请求' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 并行执行所有搜索
    const allResults = await Promise.all(searchPromises);

    // 按引擎类型聚合结果
    const aggregated = {
      scholar: allResults.filter(r => r.engine === 'scholar'),
      news: allResults.filter(r => r.engine === 'news'),
      search: allResults.filter(r => r.engine === 'search'),
    };

    return new Response(
      JSON.stringify(aggregated),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SerpAPI] 错误:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || '搜索失败',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
