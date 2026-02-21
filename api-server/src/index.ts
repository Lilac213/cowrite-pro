import Fastify from 'fastify';
import cors from '@fastify/cors';
import PQueue from 'p-queue';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually if not loaded
if (!process.env.SUPABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf-8');
      envConfig.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val) {
          process.env[key.trim()] = val.join('=').trim();
        }
      });
      console.log('Loaded .env file manually');
    }
  } catch (e) {
    console.error('Failed to load .env', e);
  }
}

import { runBriefAgent } from './llm/agents/briefAgent.js';
import { runStructureAgent } from './llm/agents/structureAgent.js';
import { runDraftAgent } from './llm/agents/draftAgent.js';
import { runDraftContentAgent } from './llm/agents/draftContentAgent.js';
import { runDraftAnalysisAgent } from './llm/agents/draftAnalysisAgent.js';
import { runReviewAgent } from './llm/agents/reviewAgent.js';
import { runStructureAdjustmentAgent } from './llm/agents/structureAdjustmentAgent.js';
import { runLLMAgent, runLLMRaw } from './llm/runtime/LLMRuntime.js';
import { validateOrThrow } from './llm/runtime/validateSchema.js';
import { cleanMaterials, rerankMaterialsWithEmbedding, type CleanedMaterial } from './utils/materialCleaner.js';
import { getSerpApiKey, searchScholar, searchNews, searchWeb, type MultiSearchRequest, type SearchQuery } from './services/serpapi.js';

const app = Fastify({ logger: true });
const searchQueue = new PQueue({ concurrency: Number(process.env.SEARCH_CONCURRENCY) || 5 });
const llmQueue = new PQueue({ concurrency: Number(process.env.LLM_CONCURRENCY) || 3 });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrlsRaw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';

console.log('API Server Environment Check:');
console.log('- SUPABASE_URL:', !!supabaseUrl);
console.log('- SUPABASE_SERVICE_KEY:', !!supabaseServiceKey);

function buildAllowedOrigins(input: string) {
  const entries = input
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const origins = new Set<string>();
  for (const entry of entries) {
    origins.add(entry);
    try {
      const url = new URL(entry);
      const host = url.host;
      const altHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
      origins.add(`${url.protocol}//${altHost}`);
    } catch {
      origins.add(entry);
    }
  }
  return Array.from(origins);
}

const allowedOrigins = buildAllowedOrigins(frontendUrlsRaw);

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_KEY 未配置');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function runStrictJsonPrompt(
  prompt: string,
  schema: { required?: string[]; optional?: string[]; defaults?: Record<string, any> }
) {
  const result = await runLLMRaw({
    prompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  if (result.parsed === undefined || result.parsed === null) {
    throw new Error(result.parseError || '无法解析 JSON 输出');
  }

  return validateOrThrow(result.parsed, schema);
}

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed'), false);
  },
  credentials: true
});

app.setNotFoundHandler((req, reply) => {
  req.log.warn({ method: req.method, url: req.url }, 'route not found');
  reply.code(404).send({ error: '路由不存在' });
});

app.setErrorHandler((error, req, reply) => {
  req.log.error(
    {
      method: req.method,
      url: req.url,
      statusCode: error.statusCode,
      message: error.message,
      cause: (error as any).cause
    },
    'request failed'
  );
  reply.code(error.statusCode || 500).send({
    error: error.message || '服务异常'
  });
});

app.get('/health', async () => ({ status: 'ok' }));

app.post('/api/serpapi-search', async (req, reply) => {
  const body = req.body as MultiSearchRequest | undefined;
  if (!body) {
    return reply.code(400).send({ error: '未提供有效的搜索请求' });
  }

  const supabase = getSupabaseAdmin();
  const apiKey = await getSerpApiKey(supabase);

  if (body.single) {
    const { engine, query } = body.single;
    let result;
    if (engine === 'scholar') {
      result = await searchQueue.add(() => searchScholar(apiKey, query));
    } else if (engine === 'news') {
      result = await searchQueue.add(() => searchNews(apiKey, query));
    } else {
      result = await searchQueue.add(() => searchWeb(apiKey, query));
    }
    return reply.send(result);
  }

  const queries = body.queries || {};
  const engines = body.engines || ['scholar', 'news', 'search'];
  const searchPromises: Promise<any>[] = [];

  if (engines.includes('scholar') && queries.scholar?.length) {
    for (const query of queries.scholar) {
      searchPromises.push(
        searchQueue.add(() => searchScholar(apiKey, query)).catch(err => ({
          engine: 'scholar',
          error: err.message,
          results: []
        }))
      );
    }
  }

  if (engines.includes('news') && queries.news?.length) {
    for (const query of queries.news) {
      searchPromises.push(
        searchQueue.add(() => searchNews(apiKey, query)).catch(err => ({
          engine: 'news',
          error: err.message,
          results: []
        }))
      );
    }
  }

  if (engines.includes('search') && queries.search?.length) {
    for (const query of queries.search) {
      searchPromises.push(
        searchQueue.add(() => searchWeb(apiKey, query)).catch(err => ({
          engine: 'search',
          error: err.message,
          results: []
        }))
      );
    }
  }

  if (searchPromises.length === 0) {
    return reply.code(400).send({ error: '未提供有效的搜索请求' });
  }

  const allResults = await Promise.all(searchPromises);
  const aggregated = {
    scholar: allResults.filter(r => r.engine === 'scholar'),
    news: allResults.filter(r => r.engine === 'news'),
    search: allResults.filter(r => r.engine === 'search'),
  };

  return reply.send(aggregated);
});

app.post('/api/web-search', async (req, reply) => {
  const { query, num } = (req.body || {}) as { query?: string; num?: number };
  if (!query) {
    return reply.code(400).send({ error: '缺少 query 参数' });
  }

  const supabase = getSupabaseAdmin();
  const apiKey = await getSerpApiKey(supabase);
  const result = await searchQueue.add(() =>
    searchWeb(apiKey, { q: query, num: num || 10, hl: 'zh-CN', gl: 'cn' })
  );
  return reply.send(result);
});

app.post('/api/search/stream', async (req, reply) => {
  reply.hijack();
  const requestOrigin = req.headers.origin as string | undefined;
  const resolvedOrigin =
    requestOrigin && (allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin))
      ? requestOrigin
      : allowedOrigins.length > 0
        ? allowedOrigins[0]
        : undefined;
  if (resolvedOrigin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', resolvedOrigin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Vary', 'Origin');
  }
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders?.();

  const send = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const encoderDelay = () => new Promise(resolve => setTimeout(resolve, 100));

  try {
    const { requirementsDoc, projectId, userId, sessionId } = (req.body || {}) as {
      requirementsDoc?: any;
      projectId?: string;
      userId?: string;
      sessionId?: string;
    };

    if (!requirementsDoc) {
      send({ stage: 'error', message: '缺少必需参数: requirementsDoc' });
      reply.raw.end();
      return;
    }

    const supabase = getSupabaseAdmin();
    const apiKey = await getSerpApiKey(supabase);
    const currentDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `Research Retrieval Agent - LLM Runtime Version

Current Date: ${currentDate}
CRITICAL: Focus on materials from 2025-2026. Do NOT prioritize content from 2023-2024 or earlier.

Role:
你是 CoWrite 的 Research Retrieval Agent。根据用户需求文档生成搜索计划。

特别注意：请仔细分析需求文档中的"关键要点"和"核心观点"，这些是搜索的核心依据。

Available Data Sources:
1. Google Scholar - 学术研究（2020年至今）
2. TheNews - 新闻/行业动态（近1-2年）
3. Smart Search (Bing) - 博客、白皮书、行业报告
4. User Library - 用户参考文章库
5. Personal Materials - 用户个人素材库

Output Format (Envelope Mode):
---THOUGHT---
（你对需求的理解、搜索策略说明）

---JSON---
{
  "search_summary": {
    "interpreted_topic": "对研究主题的理解",
    "key_dimensions": ["维度1", "维度2"]
  },
  "academic_queries": ["英文学术关键词1", "英文学术关键词2"],
  "news_queries": ["中英文新闻关键词1"],
  "web_queries": ["中英文网络关键词1"],
  "user_library_queries": ["用户库搜索关键词1"]
}

Rules:
- 即使没有结果，也必须返回空数组 []
- 不允许省略任何字段
- 搜索关键词必须包含需求文档中的关键要点和核心观点中的关键词`;

    const requirementsDocStr = typeof requirementsDoc === 'string' ? requirementsDoc : JSON.stringify(requirementsDoc, null, 2);
    const userPrompt = `研究需求文档：\n${requirementsDocStr}\n\n请生成搜索计划。`;

    send({ stage: 'plan', message: '正在生成搜索计划...' });

    const result = await llmQueue.add(() => runLLMAgent({
      agentName: 'researchRetrievalAgent',
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      schema: {
        required: ['search_summary'],
        optional: ['academic_queries', 'news_queries', 'web_queries', 'user_library_queries'],
        defaults: {
          search_summary: { interpreted_topic: '', key_dimensions: [] },
          academic_queries: [],
          news_queries: [],
          web_queries: [],
          user_library_queries: []
        }
      },
      model: 'gemini-2.5-flash',
      temperature: 0.7,
    })) as Awaited<ReturnType<typeof runLLMAgent>>;

    const searchPlan = result.data as any;
    if (!searchPlan.search_summary) searchPlan.search_summary = { interpreted_topic: '', key_dimensions: [] };
    if (!searchPlan.academic_queries) searchPlan.academic_queries = [];
    if (!searchPlan.news_queries) searchPlan.news_queries = [];
    if (!searchPlan.web_queries) searchPlan.web_queries = [];
    if (!searchPlan.user_library_queries) searchPlan.user_library_queries = [];

    send({ stage: 'plan', data: searchPlan, message: '搜索计划已生成' });
    await encoderDelay();

    send({ stage: 'searching', message: '正在从 Google Scholar、Google News、Google Search 检索资料...' });

    const rawResults = {
      academic_sources: [] as any[],
      news_sources: [] as any[],
      web_sources: [] as any[],
      user_library_sources: [] as any[],
      personal_sources: [] as any[]
    };
    const serpapiLogs: string[] = [];

    const serpapiQueries: {
      scholar?: SearchQuery[];
      news?: SearchQuery[];
      search?: SearchQuery[];
    } = {};

    if (searchPlan.academic_queries?.length > 0) {
      serpapiQueries.scholar = searchPlan.academic_queries.slice(0, 2).map((q: string) => ({ q, num: 10, hl: 'zh-CN', as_ylo: 2020 }));
    }

    if (searchPlan.news_queries?.length > 0) {
      serpapiQueries.news = searchPlan.news_queries.slice(0, 2).map((q: string) => ({ q, hl: 'zh-CN', gl: 'cn' }));
    }

    if (searchPlan.web_queries?.length > 0) {
      serpapiQueries.search = searchPlan.web_queries.slice(0, 2).map((q: string) => ({ q, num: 10, hl: 'zh-CN', gl: 'cn' }));
    }

    const searchPromises: Promise<any>[] = [];

    if (serpapiQueries.scholar) {
      for (const query of serpapiQueries.scholar) {
        searchPromises.push(
          searchQueue.add(() => searchScholar(apiKey, query)).catch(err => ({
            engine: 'scholar',
            error: err.message,
            results: []
          }))
        );
      }
    }

    if (serpapiQueries.news) {
      for (const query of serpapiQueries.news) {
        searchPromises.push(
          searchQueue.add(() => searchNews(apiKey, query)).catch(err => ({
            engine: 'news',
            error: err.message,
            results: []
          }))
        );
      }
    }

    if (serpapiQueries.search) {
      for (const query of serpapiQueries.search) {
        searchPromises.push(
          searchQueue.add(() => searchWeb(apiKey, query)).catch(err => ({
            engine: 'search',
            error: err.message,
            results: []
          }))
        );
      }
    }

    if (searchPromises.length > 0) {
      const serpapiResults = await Promise.all(searchPromises);
      for (const result of serpapiResults) {
        if (result.error) {
          const engineLabel = result.engine === 'scholar'
            ? 'Scholar'
            : result.engine === 'news'
              ? 'News'
              : 'Search';
          const errorMessage = `SerpAPI ${engineLabel} 请求失败: ${result.error}`;
          serpapiLogs.push(errorMessage);
          send({ stage: 'searching', message: errorMessage });
          await encoderDelay();
        }

        if (result.engine === 'scholar' && result.results?.length > 0) {
          const mapped = result.results.slice(0, 5).map((item: any) => ({
            title: item.title || '',
            authors: item.publication_info?.summary || '',
            abstract: item.snippet || '',
            citation_count: item.cited_by || 0,
            year: item.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
            url: item.link || ''
          }));
          rawResults.academic_sources.push(...mapped);
        }

        if (result.engine === 'news' && result.results?.length > 0) {
          const mapped = result.results.map((item: any) => ({
            title: item.title || '',
            summary: item.snippet || '',
            source: item.source || '',
            published_at: item.date || '',
            url: item.link || ''
          }));
          rawResults.news_sources.push(...mapped);
        }

        if (result.engine === 'search' && result.results?.length > 0) {
          const mapped = result.results.map((item: any) => ({
            title: item.title || '',
            site_name: item.displayed_link || '',
            snippet: item.snippet || '',
            url: item.link || '',
            last_crawled_at: ''
          }));
          rawResults.web_sources.push(...mapped);
        }
      }
    }

    if (userId && searchPlan.user_library_queries?.length > 0) {
      const query = searchPlan.user_library_queries.join(' ');
      const [refResult, matResult] = await Promise.all([
        supabase.from('reference_articles').select('*').eq('user_id', userId).or(`title.ilike.%${query}%,content.ilike.%${query}%`).limit(10),
        supabase.from('materials').select('*').eq('user_id', userId).or(`title.ilike.%${query}%,content.ilike.%${query}%`).limit(10)
      ]);

      if (refResult.data?.length) {
        rawResults.user_library_sources.push(...refResult.data.map((item: any) => ({
          title: item.title || '',
          content: item.content || '',
          source_type: item.source_type || '',
          url: item.source_url || '',
          created_at: item.created_at || ''
        })));
      }

      if (matResult.data?.length) {
        rawResults.personal_sources.push(...matResult.data.map((item: any) => ({
          title: item.title || '',
          content: item.content || '',
          material_type: item.material_type || '',
          created_at: item.created_at || ''
        })));
      }
    }

    rawResults.academic_sources = Array.from(new Map(rawResults.academic_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.news_sources = Array.from(new Map(rawResults.news_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.web_sources = Array.from(new Map(rawResults.web_sources.map(item => [item.url, item])).values()).slice(0, 10);

    send({ stage: 'searching', message: '正在清洗和整理资料...' });
    await encoderDelay();

    const query = searchPlan.search_summary?.interpreted_topic || '';
    const keywords = searchPlan.search_summary?.key_dimensions || [];

    const cleanedAcademic = cleanMaterials(
      rawResults.academic_sources.map(s => ({
        title: s.title,
        url: s.url,
        content: s.abstract || '',
        source_type: 'academic',
        authors: s.authors ? [s.authors] : [],
        year: s.year,
        citation_count: s.citation_count,
      })),
      { minContentLength: 20, minQualityScore: 0.1, removeLowQuality: false, deduplicateByUrl: false, deduplicateByTitle: false }
    );

    const cleanedNews = cleanMaterials(
      rawResults.news_sources.map(s => ({
        title: s.title,
        url: s.url,
        content: s.summary || '',
        source_type: 'news',
        published_at: s.published_at,
      })),
      { minContentLength: 10, minQualityScore: 0.05, removeLowQuality: false, deduplicateByUrl: false, deduplicateByTitle: false }
    );

    const cleanedWeb = cleanMaterials(
      rawResults.web_sources.map(s => ({
        title: s.title,
        url: s.url,
        content: s.snippet || '',
        source_type: 'web',
      })),
      { minContentLength: 10, minQualityScore: 0.05, removeLowQuality: false, deduplicateByUrl: false, deduplicateByTitle: false }
    );

    const allCleanedMaterials = [
      ...cleanedAcademic,
      ...cleanedNews,
      ...cleanedWeb
    ];

    send({ stage: 'searching', message: `共整理 ${allCleanedMaterials.length} 条资料，正在计算相关性...` });
    await encoderDelay();

    const rankedMaterials = await rerankMaterialsWithEmbedding(
      allCleanedMaterials,
      query,
      keywords,
      { topN: 100 }
    );

    send({ stage: 'searching', message: `已完成相关性排序，共 ${rankedMaterials.length} 条相关资料` });
    await encoderDelay();

    const rankedAcademic = rankedMaterials.filter(m => m.source_type === 'academic');
    const rankedNews = rankedMaterials.filter(m => m.source_type === 'news');
    const rankedWeb = rankedMaterials.filter(m => m.source_type === 'web');

    if (rankedMaterials.length > 0) {
      for (let i = 0; i < rankedMaterials.length; i += 1) {
        const item = rankedMaterials[i];
        send({
          stage: 'result',
          data: {
            item: {
              source_type: item.source_type,
              title: item.title,
              url: item.url,
              content: item.content || '',
              authors: item.authors || [],
              year: item.year,
              published_at: item.published_at,
              citation_count: item.citation_count || 0,
              quality_score: item.quality_score,
              similarity_score: item.similarity_score,
              embedding_similarity: item.embedding_similarity,
            },
            rank: i + 1,
            is_top3: i < 3,
            total: rankedMaterials.length,
          },
          message: `已追加第 ${i + 1} 条资料`
        });
        await encoderDelay();
      }
    }

    if (rankedMaterials.length >= 3) {
      send({
        stage: 'top3',
        data: {
          top3: rankedMaterials.slice(0, 3).map(m => ({
            title: m.title,
            source: m.source_type,
            conclusion: m.content?.substring(0, 150) + '...' || '',
            url: m.url
          }))
        },
        message: '已发现核心观点'
      });
    }

    await encoderDelay();

    const finalResults = {
      academic_sources: rankedAcademic.map((s: CleanedMaterial) => ({
        source_type: 'GoogleScholar',
        title: s.title,
        authors: s.authors?.join(', ') || '',
        year: s.year || '',
        url: s.url,
        content_status: 'abstract_only',
        extracted_content: [s.content || ''],
        full_text: s.content || '',
        citation_count: s.citation_count || 0,
        quality_score: s.quality_score,
        similarity_score: s.similarity_score,
        embedding_similarity: s.embedding_similarity,
        is_selected: s.is_selected,
      })),
      news_sources: rankedNews.map((s: CleanedMaterial) => ({
        source_type: 'GoogleNews',
        title: s.title,
        source: s.source_type,
        published_at: s.published_at || '',
        url: s.url,
        content_status: 'abstract_only',
        extracted_content: [s.content || ''],
        full_text: s.content || '',
        quality_score: s.quality_score,
        similarity_score: s.similarity_score,
        embedding_similarity: s.embedding_similarity,
        is_selected: s.is_selected,
      })),
      web_sources: rankedWeb.map((s: CleanedMaterial) => ({
        source_type: 'WebSearch',
        title: s.title,
        site_name: '',
        url: s.url,
        content_status: 'abstract_only',
        extracted_content: [s.content || ''],
        full_text: s.content || '',
        quality_score: s.quality_score,
        similarity_score: s.similarity_score,
        embedding_similarity: s.embedding_similarity,
      })),
      user_library_sources: rawResults.user_library_sources,
      personal_sources: rawResults.personal_sources,
      search_summary: searchPlan.search_summary,
      academic_queries: searchPlan.academic_queries || [],
      news_queries: searchPlan.news_queries || [],
      web_queries: searchPlan.web_queries || [],
      user_library_queries: searchPlan.user_library_queries || [],
      logs: serpapiLogs
    };

    send({ stage: 'final', data: { ...finalResults }, message: '搜索完成' });
    send({ stage: 'done', message: '所有阶段完成' });
    reply.raw.end();
  } catch (error: any) {
    send({ stage: 'error', message: error.message || '搜索失败' });
    reply.raw.end();
  }
});

app.post('/api/fetch-webpage', async (req, reply) => {
  try {
    const { url } = (req.body || {}) as { url?: string };
    if (!url) {
      return reply.code(400).send({ error: '缺少 url 参数' });
    }
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return reply.code(response.status).send({ error: `抓取失败: ${response.status}` });
    }
    const html = await response.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const content = cleaned.slice(0, 20000);
    return reply.send({ content });
  } catch (error) {
    return reply.code(500).send({ error: '抓取失败', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/llm/generate', async (req, reply) => {
  const supabase = getSupabaseAdmin();
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return reply.code(401).send({ error: '未授权' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return reply.code(401).send({ error: '未授权' });
  }

  const { prompt, context, systemMessage, schema } = (req.body || {}) as {
    prompt?: string;
    context?: string;
    systemMessage?: string;
    schema?: {
      required?: string[];
      optional?: string[];
      defaults?: Record<string, any>;
      validate?: any;
    };
  };

  if (!prompt) {
    return reply.code(400).send({ error: '缺少 prompt 参数' });
  }

  if (!schema) {
    return reply.code(400).send({ error: '缺少 schema 参数' });
  }

  if (schema.validate) {
    return reply.code(400).send({ error: 'schema.validate 不支持通过接口传入' });
  }

  const requiredFields = schema.required?.length ? schema.required.join(', ') : '';
  const optionalFields = schema.optional?.length ? schema.optional.join(', ') : '';
  const schemaInstructionParts = [
    '请仅返回 JSON 对象，不要包含代码块或额外文本。',
    requiredFields ? `必须包含字段: ${requiredFields}` : '',
    optionalFields ? `可选字段: ${optionalFields}` : '',
  ].filter(Boolean);

  const promptParts = [
    systemMessage ? `SYSTEM:\n${systemMessage}` : '',
    context ? `CONTEXT:\n${context}` : '',
    `USER:\n${prompt}\n\n${schemaInstructionParts.join('\n')}`,
  ].filter(Boolean);

  const finalPrompt = promptParts.join('\n\n');

  const result = await runLLMRaw({
    prompt: finalPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  if (result.parsed === undefined || result.parsed === null) {
    const rawSnippet = result.rawOutput.slice(0, 800);
    const normalizedSnippet = result.normalized.slice(0, 800);
    return reply.code(422).send({
      error: '无法解析 JSON 输出',
      details: result.parseError || '未找到可解析的 JSON 对象',
      raw_output_snippet: rawSnippet,
      normalized_output_snippet: normalizedSnippet
    });
  }

  try {
    const validated = validateOrThrow(result.parsed, schema);
    return reply.send({ result: validated });
  } catch (error) {
    return reply.code(422).send({
      error: 'Schema 校验失败',
      details: error instanceof Error ? error.message : String(error),
      parsed_output: result.parsed
    });
  }
});

app.post('/api/adjust-article-structure', async (req, reply) => {
  try {
    const { project_id, coreThesis, argumentBlocks, operation, blockIndex } = (req.body || {}) as any;

    if (!coreThesis || !argumentBlocks) {
      return reply.code(400).send({ error: '缺少核心论点或论证块信息' });
    }

    const supabase = getSupabaseAdmin();
    const startTime = Date.now();
    const result = await llmQueue.add(() => runStructureAdjustmentAgent({
      core_thesis: coreThesis,
      argument_blocks: argumentBlocks,
      operation,
      block_index: blockIndex
    })) as Awaited<ReturnType<typeof runStructureAdjustmentAgent>>;

    const adjustedData = result.data;
    if (!adjustedData.core_thesis || !adjustedData.argument_blocks) {
      throw new Error('返回的结构缺少必要字段');
    }

    if (argumentBlocks && Array.isArray(argumentBlocks)) {
      const timestamp = Date.now();
      adjustedData.argument_blocks = adjustedData.argument_blocks.map((block: any, index: number) => {
        // 优先尝试通过 ID 匹配
        let matchedOriginal = argumentBlocks.find((orig: any) => 
          block.id && block.id !== 'new_block' && block.id !== 'new' && orig.id === block.id
        );

        // 如果没有匹配到 ID，尝试通过标题或内容匹配 (兼容旧逻辑或 AI 生成了新标题但意图是同一个块)
        if (!matchedOriginal) {
          matchedOriginal = argumentBlocks.find((orig: any) =>
            orig.title === block.title || 
            (orig.description && block.description && orig.description === block.description) ||
            (orig.main_argument && block.main_argument && orig.main_argument === block.main_argument)
          );
        }

        const blockId = matchedOriginal?.id || `block_${timestamp}_${index}`;
        return {
          ...(matchedOriginal || {}), // 保留原有的 detailed info (如 supporting_points, citations)
          ...block, // 覆盖新的 info (如 title, order, relation)
          id: blockId,
          order: index + 1,
        };
      });
    }

    if (project_id) {
      await supabase.from('agent_logs').insert({
        project_id,
        agent_name: 'structureAdjustmentAgent',
        input_payload_jsonb: { coreThesis, argumentBlocks, operation, blockIndex },
        output_payload_jsonb: adjustedData,
        latency_ms: Date.now() - startTime,
        status: 'success'
      });
    }

    return reply.send(adjustedData);
  } catch (error) {
    return reply.code(500).send({
      error: '调整结构失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/generate-article-structure', async (req, reply) => {
  try {
    const { input } = (req.body || {}) as { input?: any };
    if (!input || !input.topic || !input.confirmed_insights) {
      return reply.code(400).send({ error: '缺少必要参数' });
    }

    const confirmedInsights = input.confirmed_insights || [];
    const insightsText = confirmedInsights.map((item: any, index: number) => {
      return `${index + 1}. [${item.id}] ${item.category}: ${item.content}`;
    }).join('\n');

    const prompt = `你是写作系统中的「文章级论证架构生成模块」。

【输入信息】
- 主题: ${input.topic}
- 核心论点: ${input.user_core_thesis || '未指定'}
- 已确认洞察:
${insightsText}

【任务】
1. 生成文章结构，包含多个 argument_blocks
2. 每个论证块包含: id, title, description, order, relation
3. relation 表示与上一个论证块的关系（并列/递进/因果/对比/总结）
4. 最后一个论证块必须是总结性质（复述总论点/总结升华/展望未来）

请输出 JSON：
{
  "core_thesis": "核心论点",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "标题",
      "description": "论证作用",
      "order": 1,
      "relation": "并列/递进/因果/对比/总结"
    }
  ]
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['core_thesis', 'argument_blocks']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '文章结构生成失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/generate-paragraph-structure', async (req, reply) => {
  try {
    const {
      coreThesis,
      currentArgumentBlock,
      blockTask,
      previousParagraphTask,
      relationWithPrevious,
      newInformation,
      referenceContent,
      authorMaterials,
      retrievedData,
    } = (req.body || {}) as any;

    if (!coreThesis || !currentArgumentBlock) {
      return reply.code(400).send({ error: '缺少必要参数' });
    }

    let materialsSection = '';
    if (referenceContent) {
      materialsSection += `- 参考内容（如有）：\n${referenceContent}\n`;
    }
    if (authorMaterials) {
      materialsSection += `- 作者个人素材（如有）：\n${authorMaterials}\n`;
    }
    if (retrievedData) {
      materialsSection += `- 检索资料摘要（如有）：\n${retrievedData}\n`;
    }

    const prompt = `你是写作系统中的【段落级推理模块】。

你只负责生成"段落的论证结构"，而不是正文。

【文章级约束】
- 核心论点：${coreThesis}
- 当前段落所属论证块：${currentArgumentBlock}
- 该论证块的论证任务：${blockTask || '展开论证'}

【段落关系信息】
- 上一段完成的论证任务：${previousParagraphTask || '无（首段）'}
- 当前段与上一段的关系：
  ${relationWithPrevious || '承接'}
- 当前段新增的信息是什么：${newInformation || '待确定'}

【输入素材】
${materialsSection || '- 无'}

【你的任务】
按以下顺序输出段落结构：
1. input_assumption（承接前文的前提）
2. core_claim（本段要证明的核心主张）
3. sub_claims（1–3 条分论据）
4. output_state（为下一段铺垫的逻辑出口）

请输出 JSON：
{
  "input_assumption": "承接前文的前提",
  "core_claim": "本段要证明的核心主张",
  "sub_claims": ["分论据1", "分论据2"],
  "output_state": "为下一段铺垫的逻辑出口"
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['input_assumption', 'core_claim', 'sub_claims', 'output_state']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '生成失败，请重试',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/generate-paragraph-reasoning', async (req, reply) => {
  try {
    const {
      coreThesis,
      currentBlock,
      previousParagraph,
      relationToPrevious,
      newInformation,
      referenceMaterials,
      personalMaterials,
      knowledgeBase,
    } = (req.body || {}) as any;

    if (!coreThesis || !currentBlock) {
      return reply.code(400).send({ error: '缺少核心论点或当前论证块信息' });
    }

    let refContent = '';
    if (referenceMaterials && referenceMaterials.length > 0) {
      refContent = referenceMaterials.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    let personalContent = '';
    if (personalMaterials && personalMaterials.length > 0) {
      personalContent = personalMaterials.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    let knowledgeContent = '';
    if (knowledgeBase && knowledgeBase.length > 0) {
      knowledgeContent = knowledgeBase.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    const prompt = `你是写作系统中的【段落级推理模块】。
你只负责生成"段落的论证结构"，而不是正文。

【文章级约束】

核心论点：${coreThesis}
当前段落所属论证块：${currentBlock.title}
该论证块的论证任务：${currentBlock.description}

【段落关系信息】

上一段完成的论证任务：${previousParagraph || '无（这是第一段）'}
当前段与上一段的关系：${relationToPrevious || '引入'}
（承接 / 递进 / 转折 / 因果 / 举例 / 总结）
当前段新增的信息是什么：${newInformation || '待确定'}

【输入素材】

参考内容（如有）：${refContent || '无'}
作者个人素材（如有）：${personalContent || '无'}
检索资料摘要（如有）：${knowledgeContent || '无'}

【你的任务】
按以下顺序输出段落结构：

input_assumption（承接前文的前提）
core_claim（本段要证明的核心主张）
sub_claims（1–3 条分论据）
output_state（为下一段铺垫的逻辑出口）

请输出 JSON：
{
  "input_assumption": "承接前文的前提",
  "core_claim": "本段要证明的核心主张",
  "sub_claims": ["分论据1", "分论据2"],
  "output_state": "为下一段铺垫的逻辑出口"
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['input_assumption', 'core_claim', 'sub_claims', 'output_state']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '生成失败，请重试',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/generate-evidence', async (req, reply) => {
  try {
    const { articleTopic, coreClaim, subClaim } = (req.body || {}) as any;

    if (!articleTopic || !coreClaim || !subClaim) {
      return reply.code(400).send({ error: '缺少必要参数' });
    }

    const prompt = `你是写作系统中的【论据与支撑材料模块】。

【上下文】
- 文章主题：${articleTopic}
- 当前段落 core_claim：${coreClaim}
- 当前 sub_claim（仅针对这一条）：${subClaim}

【你的任务】
为该分论据提供 1–3 条【可选支撑材料】。

支撑材料类型可包括：
- 行业 / 写作实践案例
- 数据或研究结论（如不确定请标注）
- 类比或通俗解释

【输出格式】
请输出 JSON：
{
  "sub_claim": "${subClaim}",
  "supporting_materials": [
    {
      "type": "案例/数据/类比",
      "content": "具体内容",
      "uncertainty": "如有不确定性请标注"
    }
  ]
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['sub_claim', 'supporting_materials']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '生成失败，请重试',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/verify-coherence', async (req, reply) => {
  try {
    const { coreThesis, paragraphs } = (req.body || {}) as any;

    if (!coreThesis || !paragraphs || !Array.isArray(paragraphs)) {
      return reply.code(400).send({ error: '缺少必要参数' });
    }

    let paragraphList = '';
    paragraphs.forEach((para: any, index: number) => {
      paragraphList += `段落 ${index + 1}：\n`;
      paragraphList += `  - input_assumption: ${para.input_assumption || '无'}\n`;
      paragraphList += `  - core_claim: ${para.core_claim}\n`;
      paragraphList += `  - output_state: ${para.output_state || '无'}\n\n`;
    });

    const prompt = `你是写作系统中的【段落连贯性校验模块】。

请对以下段落结构进行逻辑诊断，不要改写任何内容。

【输入】
- 文章核心论点：${coreThesis}
- 段落结构列表（每段包含：
  input_assumption / core_claim / output_state）

${paragraphList}

【你的任务】
逐段分析并输出：
1. 本段的论证角色
2. 与上一段的关系是否清晰
3. 是否存在逻辑跳跃、重复或断裂
4. 是否需要显式过渡（是 / 否 + 原因）

请输出 JSON：
{
  "coherence_check": [
    {
      "paragraph_index": 1,
      "role": "论证角色",
      "coherence_status": "通过/有问题",
      "issues": "问题说明（如有）",
      "needs_transition": "是/否",
      "transition_reason": "原因说明"
    }
  ],
  "overall_assessment": "整体连贯性评价"
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['coherence_check', 'overall_assessment']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '校验失败，请重试',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/parse-document', async (req, reply) => {
  try {
    const { fileUrl, fileType } = (req.body || {}) as { fileUrl?: string; fileType?: string };
    if (!fileUrl || !fileType) {
      return reply.code(400).send({ error: '缺少文件URL或类型' });
    }

    const supabase = getSupabaseAdmin();
    const filePath = decodeURIComponent(fileUrl.split('/').pop() || '');
    const { data: fileData, error } = await supabase.storage.from('documents').download(filePath);

    if (error || !fileData) {
      return reply.code(500).send({ error: '文件下载失败' });
    }

    let content = '';
    if (fileType === 'txt') {
      const buffer = Buffer.from(await (fileData as any).arrayBuffer());
      content = buffer.toString('utf-8');
    } else if (fileType === 'docx') {
      const buffer = Buffer.from(await (fileData as any).arrayBuffer());
      content = buffer.toString('utf-8');
    } else if (fileType === 'pdf') {
      const buffer = Buffer.from(await (fileData as any).arrayBuffer());
      content = buffer.toString('utf-8');
    } else {
      return reply.code(400).send({ error: '不支持的文件类型' });
    }

    return reply.send({ text: content });
  } catch (error) {
    return reply.code(500).send({ error: '解析失败', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/summarize-content', async (req, reply) => {
  try {
    const { content } = (req.body || {}) as { content?: string };
    if (!content) {
      return reply.code(400).send({ error: '缺少内容' });
    }

    const prompt = `请对以下内容进行摘要，输出摘要内容和标签。

内容：
${content}

请输出 JSON：
{
  "summary": "摘要内容",
  "tags": ["标签1", "标签2"]
}`;

    const data = await llmQueue.add(() => runStrictJsonPrompt(prompt, {
      required: ['summary', 'tags']
    })) as any;

    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({
      error: '摘要失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/send-invite-email', async (req, reply) => {
  try {
    const supabase = getSupabaseAdmin();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: '未授权' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return reply.code(401).send({ error: '未授权' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return reply.code(500).send({ error: '权限检查失败' });
    }

    if (!profile || profile.role !== 'admin') {
      return reply.code(403).send({ error: '仅管理员可发送邀请邮件' });
    }

    const { email, inviteCode, credits } = (req.body || {}) as any;
    if (!email || !inviteCode) {
      return reply.code(400).send({ error: '缺少必要参数' });
    }

    const emailContent = `
      <div style="font-family: sans-serif; font-size: 14px; color: #333;">
        <h2>欢迎加入 Cowrite</h2>
        <p>您的邀请码：<strong>${inviteCode}</strong></p>
        <p>使用后可获得 ${credits || 100} 积分</p>
      </div>
    `;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return reply.code(500).send({ error: '邮件服务未配置' });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Cowrite <noreply@cowrite.io>',
        to: email,
        subject: 'Cowrite 邀请码',
        html: emailContent,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      throw new Error(`邮件发送失败: ${resendError}`);
    }

    const resendResult = await resendResponse.json();
    return reply.send({ success: true, message: '邀请邮件已发送', emailId: resendResult.id });
  } catch (error) {
    return reply.code(500).send({
      error: '发送失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/brief-agent', async (req, reply) => {
  const { project_id, topic, user_input, context } = (req.body || {}) as {
    project_id?: string;
    topic?: string;
    user_input?: string;
    context?: string;
  };

  if (!project_id || !topic || !user_input) {
    return reply.code(400).send({ error: '缺少必需参数：project_id, topic, user_input' });
  }

  const supabase = getSupabaseAdmin();
  const writingBrief = await llmQueue.add(() => runBriefAgent({ topic, user_input, context })) as Awaited<ReturnType<typeof runBriefAgent>>;

  const { data: requirement, error: insertError } = await supabase
    .from('requirements')
    .insert({
      project_id,
      payload_jsonb: writingBrief,
      version: 1
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await supabase.from('agent_logs').insert({
    project_id,
    agent_name: 'briefAgent',
    input_payload_jsonb: { topic, user_input, context },
    output_payload_jsonb: writingBrief,
    latency_ms: 0,
    status: 'success'
  });

  return reply.send({
    success: true,
    requirement_id: requirement.id,
    writing_brief: writingBrief
  });
});

app.post('/api/structure-agent', async (req, reply) => {
  const { project_id, session_id } = (req.body || {}) as { project_id?: string; session_id?: string };

  if (!project_id) {
    return reply.code(400).send({ error: '缺少必需参数：project_id' });
  }

  const supabase = getSupabaseAdmin();

  // 1. 获取 Writing Brief (从 requirements 表)
  const { data: requirement, error: reqError } = await supabase
    .from('requirements')
    .select('payload_jsonb')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reqError || !requirement) {
    return reply.code(400).send({ error: '未找到 writing_brief，请先运行 brief-agent' });
  }

  const writing_brief = requirement.payload_jsonb;

  // 2. 确定 Session ID
  let currentSessionId = session_id;
  if (!currentSessionId) {
    const { data: session, error: sessionError } = await supabase
      .from('writing_sessions')
      .select('id')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (sessionError || !session) {
       // 如果没有 session，尝试使用 project_id 直接查询 insights (兼容旧逻辑或无 session 情况)
       // 但通常应该有 session
       console.log('未找到 writing_session，尝试直接使用 project_id');
    } else {
      currentSessionId = session.id;
    }
  }

  // 3. 获取 Insights (从 research_insights 表)
          console.log('[structure-agent] Querying research_insights for:', { project_id, currentSessionId });
          
          // 优先使用 session_id 过滤，如果没有则使用 project_id
          let insightsQuery = supabase
            .from('research_insights')
    .select('*')
    .in('user_decision', ['adopt', 'downgrade']); // 获取用户采用(adopt)或降级(downgrade)的洞察

  if (currentSessionId) {
    insightsQuery = insightsQuery.eq('session_id', currentSessionId);
  } else {
    insightsQuery = insightsQuery.eq('project_id', project_id);
  }

  const { data: insights, error: insightsError } = await insightsQuery;
          console.log('[structure-agent] Found insights:', insights?.length, 'Error:', insightsError);

          if (insightsError) throw insightsError;

  // 4. 获取 Sources (从 retrieved_materials 表)
  // 同样优先使用 session_id
  let sourcesQuery = supabase
    .from('retrieved_materials')
    .select('*');

  if (currentSessionId) {
    sourcesQuery = sourcesQuery.eq('session_id', currentSessionId);
  } else {
    sourcesQuery = sourcesQuery.eq('project_id', project_id);
  }
  
  const { data: sources, error: sourcesError } = await sourcesQuery;

  if (sourcesError) throw sourcesError;

  if (!insights || insights.length === 0) {
    // 尝试查询 research_gaps 作为补充? 或者直接报错
    // 暂时报错，但提示更明确
    return reply.code(400).send({ error: '未找到有效的 research_insights (需状态为 adopt 或 downgrade)，请先在资料整理页确认洞察' });
  }

  // 5. 构建 Research Pack
  const research_pack = {
    sources: (sources || []).map(s => ({
      id: s.id,
      title: s.title || '无标题',
      content: s.full_text || s.abstract || '',
      summary: (s.abstract || s.full_text || '').substring(0, 200),
      source_url: s.url || '',
      source_type: (['web', 'personal', 'academic', 'news'].includes(s.source_type) ? s.source_type : 'web') as any,
      credibility_score: 0.8,
      recency_score: 0.8,
      relevance_score: 0.8,
      token_length: (s.full_text || '').length,
      tags: [],
      created_at: new Date().toISOString()
    })),
    insights: insights.map(i => ({
      id: i.insight_id || i.id, // 优先使用 insight_id
      category: i.category || 'General',
      content: i.insight_text || i.insight, // 优先使用 insight_text
      supporting_source_ids: [], // 目前没有直接关联，设为空
      citability: i.user_decision === 'downgrade' ? 'background' : (['direct', 'paraphrase', 'background'].includes(i.citability) ? i.citability : 'paraphrase') as any,
      evidence_strength: i.user_decision === 'adopt' ? 'strong' : 'medium' as any,
      risk_flag: false,
      confidence_score: 0.9,
      user_decision: i.user_decision as any
    })),
    summary: {
      total_sources: sources?.length || 0,
      total_insights: insights.length,
      coverage_score: 0.8,
      quality_score: 0.85
    }
  };

  // 6. 调用 Agent
  const argumentOutline = await llmQueue.add(() => runStructureAgent({ writing_brief, research_pack })) as Awaited<ReturnType<typeof runStructureAgent>>;

  // 7. 保存结果 (保存到 writing_sessions 表的 structure_result 列)
  if (currentSessionId) {
    await supabase
      .from('writing_sessions')
      .update({
        structure_result: argumentOutline,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSessionId);
  }

  // 同时保存到 article_structures 表 (保持兼容性)
  const { data: structure, error: insertError } = await supabase
    .from('article_structures')
    .insert({
      project_id,
      payload_jsonb: argumentOutline,
      version: 1
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await supabase.from('agent_logs').insert({
    project_id,
    agent_name: 'structureAgent',
    input_payload_jsonb: { writing_brief, research_pack_summary: research_pack.summary },
    output_payload_jsonb: argumentOutline,
    latency_ms: 0,
    status: 'success'
  });

  return reply.send({
    success: true,
    structure_id: structure.id,
    argument_outline: argumentOutline
  });
});

app.post('/api/draft-agent', async (req, reply) => {
  const { project_id } = (req.body || {}) as { project_id?: string };

  if (!project_id) {
    return reply.code(400).send({ error: '缺少必需参数：project_id' });
  }

  const supabase = getSupabaseAdmin();

  const { data: requirement, error: reqError } = await supabase
    .from('requirements')
    .select('payload_jsonb')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (reqError || !requirement) {
    return reply.code(400).send({ error: '未找到 writing_brief，请先运行 brief-agent' });
  }

  const writing_brief = requirement.payload_jsonb;

  const { data: structure, error: structError } = await supabase
    .from('article_structures')
    .select('payload_jsonb')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (structError || !structure) {
    return reply.code(400).send({ error: '未找到 argument_outline，请先运行 structure-agent' });
  }

  const argument_outline = structure.payload_jsonb;

  // 3. 获取 Insights (从 research_insights 表)
  // 优先使用 session_id 过滤
  let insightsQuery = supabase
    .from('research_insights')
    .select('*')
    .in('user_decision', ['adopt', 'downgrade']); // 获取用户采用(adopt)或降级(downgrade)的洞察

  // 尝试获取 session_id
  let currentSessionId: string | undefined;
  const { data: session } = await supabase
    .from('writing_sessions')
    .select('id')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (session) {
    currentSessionId = session.id;
    insightsQuery = insightsQuery.eq('session_id', currentSessionId);
  } else {
    insightsQuery = insightsQuery.eq('project_id', project_id);
  }

  const { data: insights, error: insightsError } = await insightsQuery;

  if (insightsError) throw insightsError;

  // 4. 获取 Sources (从 retrieved_materials 表)
  let sourcesQuery = supabase
    .from('retrieved_materials')
    .select('*');

  if (currentSessionId) {
    sourcesQuery = sourcesQuery.eq('session_id', currentSessionId);
  } else {
    sourcesQuery = sourcesQuery.eq('project_id', project_id);
  }

  const { data: sources, error: sourcesError } = await sourcesQuery;

  if (sourcesError) throw sourcesError;

  if (!insights || insights.length === 0) {
    return reply.code(400).send({ error: '未找到 research_pack，请先运行 research-agent' });
  }

  const research_pack = {
    sources: (sources || []).map(s => ({
      id: s.id,
      title: s.title || '无标题',
      content: s.full_text || s.abstract || '',
      summary: (s.abstract || s.full_text || '').substring(0, 200),
      source_url: s.url || '',
      source_type: (['web', 'personal', 'academic', 'news'].includes(s.source_type) ? s.source_type : 'web') as any,
      credibility_score: 0.8,
      recency_score: 0.8,
      relevance_score: 0.8,
      token_length: (s.full_text || '').length,
      tags: [],
      created_at: new Date().toISOString()
    })),
    insights: insights.map(i => ({
      id: i.insight_id || i.id, // 优先使用 insight_id
      category: i.category || 'General',
      content: i.insight_text || i.insight, // 优先使用 insight_text
      supporting_source_ids: [], // 目前没有直接关联，设为空
      citability: i.user_decision === 'downgrade' ? 'background' : (['direct', 'paraphrase', 'background'].includes(i.citability) ? i.citability : 'paraphrase') as any,
      evidence_strength: i.user_decision === 'adopt' ? 'strong' : 'medium' as any,
      risk_flag: false,
      confidence_score: 0.9,
      user_decision: i.user_decision as any
    })),
    summary: {
      total_sources: sources?.length || 0,
      total_insights: insights.length,
      coverage_score: 0.8,
      quality_score: 0.85
    }
  };

  const draftPayload = await llmQueue.add(() => runDraftAgent({ writing_brief, argument_outline, research_pack })) as Awaited<ReturnType<typeof runDraftAgent>>;

  // Construct full content and annotations
  const content = draftPayload.draft_blocks.map(block => block.content).join('\n\n');
  
  const annotations = draftPayload.draft_blocks.map(block => {
    // Determine paragraph type based on order or content analysis (simplified for now)
    // You might want to ask the agent to output paragraph_type explicitly if needed
    let paragraph_type = '其他';
    if (block.order === 1) paragraph_type = '引言';
    else if (block.order === draftPayload.draft_blocks.length) paragraph_type = '结论';
    else paragraph_type = '观点提出'; // Default for body paragraphs

    return {
      paragraph_id: `P${block.order}`, // Assuming order matches paragraph index + 1
      paragraph_type: paragraph_type,
      information_source: {
        references: block.citations.map(c => c.source_title),
        is_direct_quote: block.citations.some(c => c.citation_type === 'direct')
      },
      viewpoint_generation: '多文献综合', // Default or derive from logic
      development_logic: block.coaching_tip?.rationale || '逻辑推演',
      editing_suggestions: block.coaching_tip?.suggestion || '无建议'
    };
  });

  const { data: draft, error: insertError } = await supabase
    .from('drafts')
    .insert({
      project_id,
      content,
      annotations,
      payload_jsonb: draftPayload,
      version: 1,
      global_coherence_score: draftPayload.global_coherence_score
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await supabase.from('agent_logs').insert({
    project_id,
    agent_name: 'draftAgent',
    input_payload_jsonb: {
      writing_brief_topic: writing_brief.topic,
      argument_outline_blocks: argument_outline.argument_blocks?.length,
      research_pack_summary: research_pack.summary
    },
    output_payload_jsonb: {
      draft_blocks_count: draftPayload.draft_blocks.length,
      total_word_count: draftPayload.total_word_count,
      global_coherence_score: draftPayload.global_coherence_score
    },
    latency_ms: 0,
    status: 'success'
  });

  return reply.send({
    success: true,
    draft_id: draft.id,
    content: draft.content,
    annotations: draft.annotations,
    draft_payload: draftPayload
  });
});

app.post('/api/draft/generate-content', async (req, reply) => {
  const { project_id } = (req.body || {}) as { project_id?: string };

  if (!project_id) {
    return reply.code(400).send({ error: '缺少必需参数：project_id' });
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. 获取 Writing Brief
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .select('payload_jsonb')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqError || !requirement) throw new Error('未找到 writing_brief');
    const writing_brief = requirement.payload_jsonb;

    // 2. 获取 Article Structure
    const { data: structure, error: structError } = await supabase
      .from('article_structures')
      .select('payload_jsonb')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (structError || !structure) throw new Error('未找到 article_structure');
    const argument_outline = structure.payload_jsonb.argument_outline || structure.payload_jsonb;

    // 3. 获取 Research Pack
    // 优先使用 session_id 过滤
    let insightsQuery = supabase
      .from('research_insights')
      .select('*')
      .in('user_decision', ['adopt', 'downgrade']); // 获取用户采用(adopt)或降级(downgrade)的洞察

    // 尝试获取 session_id
    let currentSessionId: string | undefined;
    const { data: session } = await supabase
      .from('writing_sessions')
      .select('id')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (session) {
      currentSessionId = session.id;
      insightsQuery = insightsQuery.eq('session_id', currentSessionId);
    } else {
      insightsQuery = insightsQuery.eq('project_id', project_id);
    }

    const { data: insights } = await insightsQuery;
    
    // 4. 获取 Sources (从 retrieved_materials 表)
    let sourcesQuery = supabase
      .from('retrieved_materials')
      .select('*');

    if (currentSessionId) {
      sourcesQuery = sourcesQuery.eq('session_id', currentSessionId);
    } else {
      sourcesQuery = sourcesQuery.eq('project_id', project_id);
    }

    const { data: sources } = await sourcesQuery;

    // 如果没有找到 insights，尝试只用 project_id 再次查询（作为兜底）
    let finalInsights = insights || [];
    if (finalInsights.length === 0 && currentSessionId) {
       console.log('未通过 session_id 找到 insights，尝试使用 project_id 兜底');
       const { data: backupInsights } = await supabase.from('research_insights')
        .select('*').eq('project_id', project_id).in('user_decision', ['adopt', 'downgrade']);
       if (backupInsights) finalInsights = backupInsights;
    }

    // 如果仍然为空，且是开发/测试环境，可能允许继续（但 Agent 会报错）
    // 为了防止 Agent 报错，如果没有 insights，我们可以尝试生成一个占位符，或者直接让 Agent 报错并返回更友好的信息
    if (finalInsights.length === 0) {
        throw new Error('Research Pack 为空：未找到已采纳的洞察 (research_insights)。请确保已完成研究阶段并采纳了相关洞察。');
    }

    const research_pack = {
      insights: finalInsights.map(i => ({
        id: i.insight_id || i.id,
        content: i.insight_text || i.insight,
        supporting_source_ids: [],
        evidence_strength: 'medium'
      })),
      sources: (sources || []).map(s => ({
        id: s.id,
        title: s.title || '无标题',
        summary: s.abstract || s.full_text || '',
        source_url: s.url || ''
      }))
    };

    // 4. 运行 Draft Content Agent
    const draftPayload = await llmQueue.add(() => runDraftContentAgent({ 
      writing_brief, 
      argument_outline, 
      research_pack: research_pack as any 
    })) as Awaited<ReturnType<typeof runDraftContentAgent>>;

    // 5. 构建 Content
    const content = draftPayload.draft_blocks.map(block => block.content).join('\n\n');

    // 6. 保存到 Drafts 表 (Annotations 为空)
    const { data: draft, error: insertError } = await supabase
      .from('drafts')
      .insert({
        project_id,
        content,
        annotations: [], // 暂时为空，等待分析
        payload_jsonb: draftPayload,
        version: 1,
        global_coherence_score: draftPayload.global_coherence_score
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return reply.send({
      success: true,
      draft_id: draft.id,
      content,
      draft_blocks: draftPayload.draft_blocks
    });

  } catch (error) {
    req.log.error(error, '生成草稿内容失败');
    return reply.code(500).send({
      error: '生成草稿内容失败',
      details: error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error))
    });
  }
});

app.post('/api/draft/analyze-structure', async (req, reply) => {
  const { project_id, draft_id } = (req.body || {}) as { project_id?: string; draft_id?: string };

  if (!project_id && !draft_id) {
    return reply.code(400).send({ error: '缺少必需参数：project_id 或 draft_id' });
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. 获取 Draft
    let draft;
    let draftError;

    if (draft_id) {
      const result = await supabase.from('drafts').select('*').eq('id', draft_id).single();
      draft = result.data;
      draftError = result.error;
    } else if (project_id) {
      const result = await supabase.from('drafts').select('*').eq('project_id', project_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      draft = result.data;
      draftError = result.error;
    } else {
      throw new Error('缺少必需参数：project_id 或 draft_id');
    }

    if (draftError || !draft) throw new Error('未找到 draft');
    
    // 确保有 project_id (如果是通过 draft_id 查询的)
    const currentProjectId = project_id || draft.project_id;

    // 2. 获取 Writing Brief 和 Article Structure (用于上下文)
    const { data: requirement } = await supabase.from('requirements').select('payload_jsonb').eq('project_id', currentProjectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: structure } = await supabase.from('article_structures').select('payload_jsonb').eq('project_id', currentProjectId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!requirement || !structure) throw new Error('缺少上下文信息 (Brief 或 Structure)');

    // 3. 运行 Analysis Agent
    const analysisPayload = await llmQueue.add(() => runDraftAnalysisAgent({
      draft_payload: draft.payload_jsonb,
      writing_brief: requirement.payload_jsonb,
      argument_outline: structure.payload_jsonb.argument_outline || structure.payload_jsonb
    })) as Awaited<ReturnType<typeof runDraftAnalysisAgent>>;

    // 4. 转换 Annotations 格式以匹配前端
    const annotations = analysisPayload.annotations.map(a => {
      // 查找对应的 block 以获取引用信息
      const block = draft.payload_jsonb.draft_blocks.find((b: any) => b.paragraph_id === a.paragraph_id);
      
      return {
        paragraph_id: a.paragraph_id,
        paragraph_type: a.paragraph_type,
        information_source: {
          references: block?.citations?.map((c: any) => c.source_title) || [],
          is_direct_quote: false
        },
        viewpoint_generation: a.viewpoint_generation,
        development_logic: a.development_logic,
        editing_suggestions: a.editing_suggestions
      };
    });

    // 5. 更新 Draft
    const { error: updateError } = await supabase
      .from('drafts')
      .update({ annotations })
      .eq('id', draft.id);

    if (updateError) throw updateError;

    return reply.send({
      success: true,
      annotations
    });

  } catch (error) {
    req.log.error(error, '分析草稿结构失败');
    return reply.code(500).send({
      error: '分析草稿结构失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/review-agent', async (req, reply) => {
  const { project_id } = (req.body || {}) as { project_id?: string };

  if (!project_id) {
    return reply.code(400).send({ error: '缺少必需参数：project_id' });
  }

  const supabase = getSupabaseAdmin();

  const { data: requirement, error: reqError } = await supabase
    .from('requirements')
    .select('payload_jsonb')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (reqError || !requirement) {
    return reply.code(400).send({ error: '未找到 writing_brief，请先运行 brief-agent' });
  }

  const writing_brief = requirement.payload_jsonb;

  const { data: draftData, error: draftError } = await supabase
    .from('drafts')
    .select('payload_jsonb')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (draftError || !draftData) {
    return reply.code(400).send({ error: '未找到 draft，请先运行 draft-agent' });
  }

  const draft = draftData.payload_jsonb;

  const reviewPayload = await llmQueue.add(() => runReviewAgent({ writing_brief, draft })) as Awaited<ReturnType<typeof runReviewAgent>>;

  const { data: review, error: insertError } = await supabase
    .from('review_reports')
    .insert({
      project_id,
      payload_jsonb: reviewPayload
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await supabase.from('agent_logs').insert({
    project_id,
    agent_name: 'reviewAgent',
    input_payload_jsonb: {
      writing_brief_topic: writing_brief.topic,
      draft_blocks_count: draft.draft_blocks?.length,
      draft_word_count: draft.total_word_count
    },
    output_payload_jsonb: {
      total_issues: reviewPayload.logic_issues.length +
                    reviewPayload.citation_issues.length +
                    reviewPayload.style_issues.length +
                    reviewPayload.grammar_issues.length,
      overall_score: reviewPayload.overall_quality.overall_score,
      pass: reviewPayload.pass
    },
    latency_ms: 0,
    status: 'success'
  });

  return reply.send({
    success: true,
    review_id: review.id,
    review_payload: reviewPayload
  });
});

app.post('/api/research-synthesis-agent', async (req, reply) => {
  const supabase = getSupabaseAdmin();
  const body = (req.body || {}) as any;

  let input: any;
  let sessionId: string | undefined;
  let projectId: string | undefined;

  if (body.input) {
    input = body.input;
    sessionId = body.sessionId;
    projectId = body.projectId;
  } else if (body.projectId) {
    projectId = body.projectId;
    sessionId = body.sessionId;

    const { data: project, error: projectError } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
    if (projectError || !project) {
      return reply.code(404).send({ error: "项目不存在" });
    }

    const { data: brief, error: briefError } = await supabase.from("briefs").select("requirements").eq("project_id", projectId).maybeSingle();
    if (briefError || !brief) {
      return reply.code(404).send({ error: "需求文档不存在" });
    }

    let knowledge: any[] = [];

    if (sessionId) {
      const { data: retrievedMaterials, error: retrievedError } = await supabase.from("retrieved_materials").select("*").eq("session_id", sessionId).eq("is_selected", true).order("created_at", { ascending: false });
      if (!retrievedError && retrievedMaterials && retrievedMaterials.length > 0) {
        const selectedMaterials = retrievedMaterials.slice(0, 8);
        knowledge = selectedMaterials.map((item: any) => {
          const content = (item.full_text || item.abstract || '').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
          return { title: (item.title || '无标题').trim(), source: item.source_type || 'unknown', source_url: item.url || '', content: content.substring(0, 2000), collected_at: item.created_at };
        });
      }
    }

    if (knowledge.length === 0) {
      const { data: knowledgeData, error: knowledgeError } = await supabase.from("knowledge_base").select("*").eq("project_id", projectId).order("collected_at", { ascending: false });
      if (knowledgeError) {
        return reply.code(500).send({ error: "获取知识库失败" });
      }
      const selectedKnowledge = (knowledgeData || []).slice(0, 8);
      knowledge = selectedKnowledge.map((item: any) => {
        const content = (item.content || item.full_text || '').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        return { ...item, title: (item.title || '无标题').trim(), source: item.source || 'unknown', source_url: item.source_url || '', content: content.substring(0, 2000) };
      });
    }

    if (!knowledge || knowledge.length === 0) {
      return reply.code(400).send({ error: "知识库为空，请先进行资料搜索" });
    }

    let requirements: any = {};
    try { requirements = JSON.parse(brief.requirements); } catch { requirements = { topic: project.title }; }

    input = {
      writing_requirements: { topic: requirements.topic || project.title, target_audience: requirements.target_audience, writing_purpose: requirements.writing_purpose, key_points: requirements.key_points },
      raw_materials: knowledge.map((item: any) => ({ title: item.title, source: item.source, source_url: item.source_url, content: item.content })),
    };
  } else {
    return reply.code(400).send({ error: "缺少 projectId 或 input 参数" });
  }

  let materialsContent = "";
  const selectedMaterials = input.raw_materials.slice(0, 8);

  selectedMaterials.forEach((item: any, index: number) => {
    const truncatedContent = item.content.substring(0, 2000);
    materialsContent += `\n\n【资料 ${index + 1}】\n标题: ${item.title}\n来源: ${item.source}\n${item.source_url ? `链接: ${item.source_url}\n` : ''}内容:\n${truncatedContent}\n`;
  });

  let requirementsText = `写作主题: ${input.writing_requirements.topic}\n`;
  if (input.writing_requirements.target_audience) requirementsText += `目标读者: ${input.writing_requirements.target_audience}\n`;
  if (input.writing_requirements.writing_purpose) requirementsText += `写作目的: ${input.writing_requirements.writing_purpose}\n`;
  if (input.writing_requirements.key_points?.length) requirementsText += `关键要点: ${input.writing_requirements.key_points.join(', ')}\n`;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentDateStr = currentDate.toISOString().split('T')[0];

  const systemPrompt = `Research Synthesis Agent (LLM Runtime Version)

Current Date: ${currentDateStr}
Current Year: ${currentYear}

Role:
你是 CoWrite 的 Research Synthesis Agent。将多源检索资料整理为可供写作选择的研究素材池。

Core Tasks:
1. 中文化（非直译）- 面向商业/产品/技术复合读者，保留原意
2. 高密度提炼 - 核心结论、关键数据、方法框架、与需求对应关系
3. 主动结构化 - 分类帮助用户理解，不做价值取舍
4. 显式标注 - recommended_usage: direct | background | optional
5. 标注不确定性与争议

Output Format (Envelope Mode):
---THOUGHT---
（你如何归类信息，以及哪些地方需要用户重点决策）

---JSON---
{
  "synthesized_insights": [
    {
      "id": "insight_1",
      "category": "分类名称",
      "insight": "核心洞察（中文）",
      "supporting_data": ["数据点1", "数据点2"],
      "source_type": "academic | news | web",
      "recommended_usage": "direct | background | optional",
      "citability": "direct | background | controversial",
      "limitations": "局限性说明",
      "user_decision": "pending"
    }
  ],
  "contradictions_or_gaps": [
    {
      "id": "gap_1",
      "issue": "矛盾或空白点",
      "description": "说明",
      "user_decision": "pending"
    }
  ]
}

Rules:
- 所有 insight 默认 user_decision = pending
- 不得假设用户的立场
- 不得为下游结构生成提前收敛观点`;

  const userPrompt = `请对以下资料进行研究综合整理：

【写作需求】
${requirementsText}

【检索资料】
${materialsContent}

请按照 Research Synthesis Agent 的要求，将这些资料整理为可供用户选择的研究素材池。`;

  const result = await llmQueue.add(() => runLLMAgent({
    agentName: 'researchSynthesisAgent',
    prompt: `${systemPrompt}\n\n${userPrompt}`,
    schema: {
      required: ['synthesized_insights'],
      optional: ['contradictions_or_gaps']
    },
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 4000,
  })) as Awaited<ReturnType<typeof runLLMAgent>>;

  const synthesisData = result.data as any;
  if (!synthesisData.synthesized_insights) synthesisData.synthesized_insights = [];
  if (!synthesisData.contradictions_or_gaps) synthesisData.contradictions_or_gaps = [];

  if (sessionId && projectId) {
    if (synthesisData.synthesized_insights?.length > 0) {
      const knowledgeBaseItems = synthesisData.synthesized_insights.map((insight: any) => ({
        project_id: projectId,
        title: insight.category + ': ' + insight.insight.substring(0, 50),
        content: insight.insight,
        source: insight.source_type || 'synthesis',
        source_url: null,
        selected: true,
        content_status: 'synthesized',
        metadata: {
          insight_id: insight.id,
          category: insight.category,
          supporting_data: insight.supporting_data,
          recommended_usage: insight.recommended_usage,
          citability: insight.citability,
          limitations: insight.limitations,
        },
      }));

      await supabase.from("knowledge_base").insert(knowledgeBaseItems);
    }

    if (synthesisData.synthesized_insights?.length > 0) {
      const insightsToInsert = synthesisData.synthesized_insights.map((insight: any) => ({
        session_id: sessionId,
        insight_id: insight.id,
        category: insight.category,
        insight: insight.insight,
        supporting_data: insight.supporting_data || [],
        source_type: insight.source_type,
        recommended_usage: insight.recommended_usage,
        citability: insight.citability,
        limitations: insight.limitations || "",
        user_decision: "pending",
      }));
      try {
        const { error: insertInsightError } = await supabase.from("research_insights").insert(insightsToInsert);
        if (insertInsightError) {
          console.error("Failed to insert research_insights (non-fatal):", insertInsightError);
          // throw insertInsightError; // Do not throw, allow fallback to client-side storage
        }
      } catch (e) {
        console.error("Exception inserting research_insights (non-fatal):", e);
      }
    }

    if (synthesisData.contradictions_or_gaps?.length > 0) {
      const gapsToInsert = synthesisData.contradictions_or_gaps.map((gap: any) => ({
        session_id: sessionId,
        gap_id: gap.id,
        issue: gap.issue,
        description: gap.description,
        user_decision: "pending",
      }));
      try {
        const { error: insertGapError } = await supabase.from("research_gaps").insert(gapsToInsert);
        if (insertGapError) {
          console.error("Failed to insert research_gaps (non-fatal):", insertGapError);
          // throw insertGapError; // Do not throw
        }
      } catch (e) {
        console.error("Exception inserting research_gaps (non-fatal):", e);
      }
    }
  }

  return reply.send({ thought: result.rawOutput?.match(/---THOUGHT---\s*([\s\S]*?)---JSON---/)?.[1]?.trim() || "", synthesis: synthesisData, sessionId });
});

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: '0.0.0.0' });
