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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const addLog = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    console.log(...args);
    logs.push(message);
  };

  try {
    const { requirementsDoc, projectId, userId, sessionId }: ResearchRequest = await req.json();

    addLog('========== Research Retrieval Agent (LLM Runtime) ==========');
    addLog(`projectId: ${projectId || '未提供'}`);
    addLog(`userId: ${userId || '未提供'}`);
    addLog(`sessionId: ${sessionId || '未提供'}`);

    if (!requirementsDoc) {
      return new Response(JSON.stringify({ error: '缺少必需参数: requirementsDoc' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    addLog('========== 使用 LLM Runtime 生成搜索计划 ==========');

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
    addLog('搜索计划:', JSON.stringify(searchPlan, null, 2));

    if (!searchPlan.search_summary) searchPlan.search_summary = { interpreted_topic: '', key_dimensions: [] };
    if (!searchPlan.academic_queries) searchPlan.academic_queries = [];
    if (!searchPlan.news_queries) searchPlan.news_queries = [];
    if (!searchPlan.web_queries) searchPlan.web_queries = [];
    if (!searchPlan.user_library_queries) searchPlan.user_library_queries = [];

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
      addLog('========== 准备 Google Scholar 搜索 ==========');
      serpapiQueries.scholar = searchPlan.academic_queries.slice(0, 2).map(q => ({ q, num: 10, hl: 'zh-CN', as_ylo: 2020 }));
    }

    if (searchPlan.news_queries?.length > 0) {
      addLog('========== 准备 Google News 搜索 ==========');
      serpapiQueries.news = searchPlan.news_queries.slice(0, 2).map(q => ({ q, hl: 'zh-CN', gl: 'cn' }));
    }

    if (searchPlan.web_queries?.length > 0) {
      addLog('========== 准备 Google Search 搜索 ==========');
      serpapiQueries.search = searchPlan.web_queries.slice(0, 2).map(q => ({ q, num: 10, hl: 'zh-CN', gl: 'cn' }));
    }

    if (Object.keys(serpapiQueries).length > 0) {
      addLog('========== 调用 serpapi-search（并行搜索）==========');
      
      // 使用 fetch 直接调用 serpapi-search Edge Function
      const serpapiUrl = `${supabaseUrl}/functions/v1/serpapi-search`;
      const serpapiResponse = await fetch(serpapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ queries: serpapiQueries }),
      });

      if (!serpapiResponse.ok) {
        const errorText = await serpapiResponse.text();
        addLog(`[SerpAPI] 调用失败: ${serpapiResponse.status} ${errorText}`);
      } else {
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
          addLog(`[Scholar] 找到 ${rawResults.academic_sources.length} 条结果`);
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
          addLog(`[News] 找到 ${rawResults.news_sources.length} 条结果`);
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
          addLog(`[Search] 找到 ${rawResults.web_sources.length} 条结果`);
        }
      }
    }

    if (userId && searchPlan.user_library_queries?.length > 0) {
      addLog('========== User Library 搜索 ==========');
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
        addLog(`[User Library] 找到 ${refResult.data.length} 条结果`);
      }

      if (matResult.data?.length) {
        rawResults.personal_sources.push(...matResult.data.map((item: any) => ({
          title: item.title || '',
          content: item.content || '',
          material_type: item.material_type || '',
          created_at: item.created_at || ''
        })));
        addLog(`[Personal Materials] 找到 ${matResult.data.length} 条结果`);
      }
    }

    addLog('========== 搜索完成统计 ==========');
    addLog(`学术: ${rawResults.academic_sources.length}, 新闻: ${rawResults.news_sources.length}, 网络: ${rawResults.web_sources.length}`);

    rawResults.academic_sources = Array.from(new Map(rawResults.academic_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.news_sources = Array.from(new Map(rawResults.news_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.web_sources = Array.from(new Map(rawResults.web_sources.map(item => [item.url, item])).values()).slice(0, 10);

    // ========== 资料清洗和重排序 ==========
    addLog('========== 开始资料清洗和重排序 ==========');
    
    const query = searchPlan.search_summary?.interpreted_topic || '';
    const keywords = searchPlan.search_summary?.key_dimensions || [];
    
    // 清洗学术资料 - 放宽限制以保留更多资料
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
    addLog(`[清洗] 学术资料: ${rawResults.academic_sources.length} -> ${cleanedAcademic.length} 条`);
    
    // 清洗新闻资料 - 放宽限制
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
    addLog(`[清洗] 新闻资料: ${rawResults.news_sources.length} -> ${cleanedNews.length} 条`);
    
    // 清洗网页资料 - 放宽限制
    const cleanedWeb = cleanMaterials(
      rawResults.web_sources.map(s => ({
        title: s.title,
        url: s.url,
        content: s.snippet || '',
        source_type: 'web',
      })),
      { minContentLength: 10, minQualityScore: 0.05, removeLowQuality: false }
    );
    addLog(`[清洗] 网页资料: ${rawResults.web_sources.length} -> ${cleanedWeb.length} 条`);

    const allCleanedMaterials = [
      ...cleanedAcademic,
      ...cleanedNews,
      ...cleanedWeb
    ];

    const rankedMaterials = await rerankMaterialsWithEmbedding(
      allCleanedMaterials,
      query,
      keywords,
      { topN: 100 }
    );

    const rankedAcademic = rankedMaterials.filter(m => m.source_type === 'academic');
    const rankedNews = rankedMaterials.filter(m => m.source_type === 'news');
    const rankedWeb = rankedMaterials.filter(m => m.source_type === 'web');

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
        is_selected: s.is_selected,
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

    return new Response(JSON.stringify({ success: true, data: finalResults, logs }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[research-retrieval-agent] 错误:', error);
    return new Response(JSON.stringify({ error: error.message, logs }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
