import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runLLMAgent } from '../_shared/llm/runtime/LLMRuntime.ts';
import { cleanMaterials, rerankMaterialsWithEmbedding, type CleanedMaterial } from '../_shared/utils/materialCleaner.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

interface ResearchRequest {
  requirementsDoc: any;
  projectId?: string;
  userId?: string;
  sessionId?: string;
}

interface SSEEvent {
  stage: 'plan' | 'searching' | 'top3' | 'final' | 'error' | 'done';
  data?: any;
  message?: string;
}

function sendSSEEvent(encoder: TextEncoder, controller: ReadableStreamDefaultController, event: SSEEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController | null = null;
  
  // 添加日志数组
  const logs: string[] = [];
  const addLog = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    console.log(...args);
    logs.push(message);
  };

  const body = new ReadableStream({
    start(controller) {
      streamController = controller;
    },
  });

  const processRequest = async () => {
    try {
      const { requirementsDoc, projectId, userId, sessionId }: ResearchRequest = await req.json();
      
      addLog('========== Research Retrieval Streaming Agent ==========');
      addLog(`projectId: ${projectId || '未提供'}`);
      addLog(`userId: ${userId || '未提供'}`);
      addLog(`sessionId: ${sessionId || '未提供'}`);

      if (!streamController) return;

      if (!requirementsDoc) {
        sendSSEEvent(encoder, streamController, {
          stage: 'error',
          message: '缺少必需参数: requirementsDoc'
        });
        streamController.close();
        return;
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      sendSSEEvent(encoder, streamController, {
        stage: 'plan',
        message: '正在生成搜索计划...'
      });

      const result = await runLLMAgent({
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
      });

      const searchPlan = result.data;

      if (!searchPlan.search_summary) searchPlan.search_summary = { interpreted_topic: '', key_dimensions: [] };
      if (!searchPlan.academic_queries) searchPlan.academic_queries = [];
      if (!searchPlan.news_queries) searchPlan.news_queries = [];
      if (!searchPlan.web_queries) searchPlan.web_queries = [];
      if (!searchPlan.user_library_queries) searchPlan.user_library_queries = [];

      sendSSEEvent(encoder, streamController, {
        stage: 'plan',
        data: searchPlan,
        message: '搜索计划已生成'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      sendSSEEvent(encoder, streamController, {
        stage: 'searching',
        message: '正在从 Google Scholar、Google News、Google Search 检索资料...'
      });

      const rawResults = {
        academic_sources: [] as any[],
        news_sources: [] as any[],
        web_sources: [] as any[],
        user_library_sources: [] as any[],
        personal_sources: [] as any[]
      };

      const serpapiQueries: {
        scholar?: { q: string; num: number; hl: string; as_ylo: number }[];
        news?: { q: string; hl: string; gl: string }[];
        search?: { q: string; num: number; hl: string; gl: string }[];
      } = {};

      if (searchPlan.academic_queries?.length > 0) {
        serpapiQueries.scholar = searchPlan.academic_queries.slice(0, 2).map(q => ({ q, num: 10, hl: 'zh-CN', as_ylo: 2020 }));
      }

      if (searchPlan.news_queries?.length > 0) {
        serpapiQueries.news = searchPlan.news_queries.slice(0, 2).map(q => ({ q, hl: 'zh-CN', gl: 'cn' }));
      }

      if (searchPlan.web_queries?.length > 0) {
        serpapiQueries.search = searchPlan.web_queries.slice(0, 2).map(q => ({ q, num: 10, hl: 'zh-CN', gl: 'cn' }));
      }

      if (Object.keys(serpapiQueries).length > 0) {
        sendSSEEvent(encoder, streamController, {
          stage: 'searching',
          message: '正在检索学术资料...'
        });
        
        const serpapiUrl = `${supabaseUrl}/functions/v1/serpapi-search`;
        const serpapiResponse = await fetch(serpapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ queries: serpapiQueries }),
        });

        if (serpapiResponse.ok) {
          const serpapiResults = await serpapiResponse.json();
          
          if (serpapiResults.scholar) {
            for (const result of serpapiResults.scholar) {
              if (result.results?.length > 0) {
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
            }
            
            if (rawResults.academic_sources.length > 0) {
              sendSSEEvent(encoder, streamController, {
                stage: 'searching',
                message: `已找到 ${rawResults.academic_sources.length} 篇学术资料`
              });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (serpapiResults.news) {
            for (const result of serpapiResults.news) {
              if (result.results?.length > 0) {
                const mapped = result.results.map((item: any) => ({
                  title: item.title || '',
                  summary: item.snippet || '',
                  source: item.source || '',
                  published_at: normalizeDate(item.date) || '',
                  url: item.link || ''
                }));
                rawResults.news_sources.push(...mapped);
              }
            }
            
            if (rawResults.news_sources.length > 0) {
              sendSSEEvent(encoder, streamController, {
                stage: 'searching',
                message: `已找到 ${rawResults.news_sources.length} 条新闻资料`
              });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (serpapiResults.search) {
            for (const result of serpapiResults.search) {
              if (result.results?.length > 0) {
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
            
            if (rawResults.web_sources.length > 0) {
              sendSSEEvent(encoder, streamController, {
                stage: 'searching',
                message: `已找到 ${rawResults.web_sources.length} 条网络资料`
              });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
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

      sendSSEEvent(encoder, streamController, {
        stage: 'searching',
        message: '正在清洗和整理资料...'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const query = searchPlan.search_summary?.interpreted_topic || '';
      const keywords = searchPlan.search_summary?.key_dimensions || [];
      
      console.log('[research-retrieval-streaming] 清洗前资料数量:', {
        academic: rawResults.academic_sources.length,
        news: rawResults.news_sources.length,
        web: rawResults.web_sources.length
      });
      
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
        { minContentLength: 20, minQualityScore: 0.1, removeLowQuality: false }
      );
      
      const cleanedNews = cleanMaterials(
        rawResults.news_sources.map(s => ({
          title: s.title,
          url: s.url,
          content: s.summary || '',
          source_type: 'news',
          published_at: s.published_at,
        })),
        { minContentLength: 10, minQualityScore: 0.05, removeLowQuality: false }
      );
      
      const cleanedWeb = cleanMaterials(
        rawResults.web_sources.map(s => ({
          title: s.title,
          url: s.url,
          content: s.snippet || '',
          source_type: 'web',
        })),
        { minContentLength: 10, minQualityScore: 0.05, removeLowQuality: false }
      );

      console.log('[research-retrieval-streaming] 清洗后资料数量:', {
        academic: cleanedAcademic.length,
        news: cleanedNews.length,
        web: cleanedWeb.length
      });

      const allCleanedMaterials = [
        ...cleanedAcademic,
        ...cleanedNews,
        ...cleanedWeb
      ];
      
      sendSSEEvent(encoder, streamController, {
        stage: 'searching',
        message: `共整理 ${allCleanedMaterials.length} 条资料，正在计算相关性...`
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rankedMaterials = await rerankMaterialsWithEmbedding(
        allCleanedMaterials,
        query,
        keywords,
        { topN: 100 }
      );
      
      sendSSEEvent(encoder, streamController, {
        stage: 'searching',
        message: `已完成相关性排序，共 ${rankedMaterials.length} 条相关资料`
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const rankedAcademic = rankedMaterials.filter(m => m.source_type === 'academic');
      const rankedNews = rankedMaterials.filter(m => m.source_type === 'news');
      const rankedWeb = rankedMaterials.filter(m => m.source_type === 'web');

      if (rankedMaterials.length >= 3) {
        sendSSEEvent(encoder, streamController, {
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

      await new Promise(resolve => setTimeout(resolve, 100));

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
        user_library_queries: searchPlan.user_library_queries || []
      };

      addLog('========== 返回结果 ==========');
      addLog(`学术: ${finalResults.academic_sources.length}, 新闻: ${finalResults.news_sources.length}, 网络: ${finalResults.web_sources.length}`);
      
      sendSSEEvent(encoder, streamController, {
        stage: 'final',
        data: { ...finalResults, logs },
        message: '搜索完成'
      });

      sendSSEEvent(encoder, streamController, {
        stage: 'done',
        message: '所有阶段完成'
      });

      streamController.close();

    } catch (error: any) {
      console.error('[research-retrieval-streaming] 错误:', error);
      if (streamController) {
        sendSSEEvent(encoder, streamController, {
          stage: 'error',
          message: error.message
        });
        streamController.close();
      }
    }
  };

  processRequest();

  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
