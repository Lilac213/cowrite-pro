import type { SupabaseClient } from '@supabase/supabase-js';

export type SearchEngine = 'scholar' | 'news' | 'search';

export interface SearchQuery {
  q: string;
  num?: number;
  start?: number;
  hl?: string;
  gl?: string;
  as_ylo?: number;
  as_yhi?: number;
}

export interface MultiSearchRequest {
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

export async function getSerpApiKey(supabaseClient?: SupabaseClient): Promise<string> {
  let apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey && supabaseClient) {
    const { data: config } = await supabaseClient
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'search_api_key')
      .maybeSingle();

    if (config?.config_value) {
      apiKey = config.config_value;
    }
  }

  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY 未配置');
  }

  return apiKey;
}

export async function searchScholar(apiKey: string, query: SearchQuery): Promise<any> {
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

export async function searchNews(apiKey: string, query: SearchQuery): Promise<any> {
  const params = new URLSearchParams({
    engine: 'google_news',
    q: query.q,
    api_key: apiKey,
    hl: query.hl || 'zh-CN',
    gl: query.gl || 'cn',
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
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

export async function searchWeb(apiKey: string, query: SearchQuery): Promise<any> {
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
