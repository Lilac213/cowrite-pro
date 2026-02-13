import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 辅助函数：将各种日期格式转换为 ISO 8601 格式
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    // 尝试解析日期
    const date = new Date(dateStr);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn(`[normalizeDate] 无效日期格式: ${dateStr}`);
      return null;
    }
    
    // 返回 ISO 8601 格式
    return date.toISOString();
  } catch (error) {
    console.error(`[normalizeDate] 日期转换失败: ${dateStr}`, error);
    return null;
  }
}

interface ResearchRequest {
  requirementsDoc: string;
  projectId?: string;
  userId?: string;
  sessionId?: string;
}

interface SourceWithContent {
  source_type: string;
  title: string;
  authors?: string;
  year?: string;
  url: string;
  content_status: 'full_text' | 'abstract_only' | 'insufficient_content' | 'unavailable_fulltext';
  extracted_content: string[];
  full_text?: string;
  notes?: string;
  [key: string]: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 用于收集日志的数组
  const logs: string[] = [];
  const addLog = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    console.log(...args);
    logs.push(message);
  };

  try {
    const { requirementsDoc, projectId, userId, sessionId }: ResearchRequest = await req.json();

    addLog('========== 接收到的请求参数 ==========');
    addLog(`requirementsDoc 类型: ${typeof requirementsDoc}`);
    addLog(`projectId: ${projectId || '未提供'}`);
    addLog(`userId: ${userId || '未提供'}`);
    addLog(`sessionId: ${sessionId || '未提供'}`);

    if (!requirementsDoc) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数: requirementsDoc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 如果 requirementsDoc 是对象，转换为 JSON 字符串
    const requirementsDocStr = typeof requirementsDoc === 'string' 
      ? requirementsDoc 
      : JSON.stringify(requirementsDoc, null, 2);

    const qianwenApiKey = Deno.env.get('QIANWEN_API_KEY');
    const integrationsApiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    addLog('========== API Keys 状态检查 ==========');
    addLog(`QIANWEN_API_KEY 存在: ${!!qianwenApiKey}`);
    addLog(`SUPABASE_URL 存在: ${!!supabaseUrl}`);
    
    if (!qianwenApiKey) {
      throw new Error('QIANWEN_API_KEY 未配置');
    }

    // 初始化 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 获取当前日期
    const currentDate = new Date().toISOString().split('T')[0]; // 格式：2026-02-09
    
    // 新的系统提示词 - 严格的输出格式
    const systemPrompt = `🧠 Research Retrieval Agent

⏰ Current Date: ${currentDate}
CRITICAL: When searching for news and recent content, focus on materials from 2025-2026. Do NOT output or prioritize content from 2023-2024 or earlier unless specifically requested in the requirements.

Role:
你是 CoWrite 的 Research Retrieval Agent。你的唯一职责是根据用户提供的结构化 JSON 需求文档，在指定数据源中检索、筛选、返回"原始资料线索"。

你不：翻译内容、提炼观点、总结结论、写作或推理延展
你只做：理解需求、搜索、去重、标记相关性、结构化返回

Available Data Sources（必须全部考虑）:
1. Google Scholar - 学术研究、方法论、实证分析（2020年至今，最多10条）
2. TheNews - 新闻/行业动态、商业实践（近1-2年，最多10条）
3. Smart Search (Bing) - 博客、白皮书、行业报告（近12-24个月，最多10条）
4. User Library - 用户参考文章库（已收藏文章）
5. Personal Materials - 用户个人素材库（笔记、草稿）

⚠️ 输出规则（极其重要）:
你必须严格按以下格式输出。
- 允许你在 ---THOUGHT--- 中自由推理
- 系统只会解析 ---JSON--- 中的内容
- ---JSON--- 中只能出现合法 JSON

Output Format:
---THOUGHT---
（你对需求的理解、搜索策略说明，可用自然语言）

---JSON---
{
  "search_summary": {
    "interpreted_topic": "对研究主题的理解",
    "key_dimensions": ["维度1", "维度2"]
  },
  "academic_queries": ["英文学术关键词1", "英文学术关键词2"],
  "news_queries": ["中英文新闻关键词1", "中英文新闻关键词2"],
  "web_queries": ["中英文网络关键词1", "中英文网络关键词2"],
  "user_library_queries": ["用户库搜索关键词1", "用户库搜索关键词2"]
}

字段要求:
- 即使没有结果，也必须返回空数组 []
- 不允许省略任何字段
- 不允许输出额外文本`;

    const userPrompt = `研究需求文档：\n${requirementsDocStr}\n\n请生成搜索计划。`;

    addLog('========== 开始调用通义千问 API ==========');

    // 调用通义千问 API 生成搜索计划
    const llmResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qianwenApiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('通义千问 API 错误:', errorText);
      throw new Error(`通义千问 API 请求失败: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('通义千问 API 返回内容为空');
    }

    addLog('通义千问返回内容:', content);

    // 提取 ---JSON--- 部分
    let searchPlan;
    try {
      const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)(?:---|\n\n\n|$)/);
      if (!jsonMatch) {
        console.error('未找到 ---JSON--- 标记，原始内容:', content);
        throw new Error('未找到 ---JSON--- 标记');
      }
      
      const jsonText = jsonMatch[1].trim();
      addLog('提取的 JSON 文本:', jsonText);
      
      searchPlan = JSON.parse(jsonText);
      
      // 验证必需字段
      if (!searchPlan.search_summary) searchPlan.search_summary = { interpreted_topic: '', key_dimensions: [] };
      if (!searchPlan.academic_queries) searchPlan.academic_queries = [];
      if (!searchPlan.news_queries) searchPlan.news_queries = [];
      if (!searchPlan.web_queries) searchPlan.web_queries = [];
      if (!searchPlan.user_library_queries) searchPlan.user_library_queries = [];
      
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      console.error('原始内容:', content);
      throw new Error(`解析搜索计划失败: ${parseError.message}`);
    }

    addLog('搜索计划:', JSON.stringify(searchPlan, null, 2));

    // ========== STEP 1: Multi-source Retrieval (使用统一的 serpapi-search) ==========
    const rawResults = {
      academic_sources: [] as any[],
      news_sources: [] as any[],
      web_sources: [] as any[],
      user_library_sources: [] as any[],
      personal_sources: [] as any[]
    };

    // 构建统一搜索请求
    const serpapiQueries: {
      scholar?: { q: string; num: number; hl: string; as_ylo: number }[];
      news?: { q: string; hl: string; gl: string }[];
      search?: { q: string; num: number; hl: string; gl: string }[];
    } = {};

    if (searchPlan.academic_queries && searchPlan.academic_queries.length > 0) {
      addLog('========== 准备 Google Scholar 搜索 ==========');
      serpapiQueries.scholar = searchPlan.academic_queries.slice(0, 2).map(q => ({
        q,
        num: 10,
        hl: 'zh-CN',
        as_ylo: 2020
      }));
      addLog(`[Scholar] 查询: ${serpapiQueries.scholar.map(q => q.q).join(', ')}`);
    }

    if (searchPlan.news_queries && searchPlan.news_queries.length > 0) {
      addLog('========== 准备 Google News 搜索 ==========');
      serpapiQueries.news = searchPlan.news_queries.slice(0, 2).map(q => ({
        q,
        hl: 'zh-CN',
        gl: 'cn'
      }));
      addLog(`[News] 查询: ${serpapiQueries.news.map(q => q.q).join(', ')}`);
    }

    if (searchPlan.web_queries && searchPlan.web_queries.length > 0) {
      addLog('========== 准备 Google Search 搜索 ==========');
      serpapiQueries.search = searchPlan.web_queries.slice(0, 2).map(q => ({
        q,
        num: 10,
        hl: 'zh-CN',
        gl: 'cn'
      }));
      addLog(`[Search] 查询: ${serpapiQueries.search.map(q => q.q).join(', ')}`);
    }

    // 调用统一的 serpapi-search 函数（内部并行）
    if (Object.keys(serpapiQueries).length > 0) {
      addLog('========== 调用 serpapi-search（并行搜索）==========');
      
      const { data: serpapiResults, error: serpapiError } = await supabase.functions.invoke('serpapi-search', {
        body: { queries: serpapiQueries }
      });

      if (serpapiError) {
        addLog(`[SerpAPI] 调用失败: ${serpapiError.message}`);
      } else if (serpapiResults) {
        // 处理 Scholar 结果
        if (serpapiResults.scholar) {
          for (const result of serpapiResults.scholar) {
            if (result.results && result.results.length > 0) {
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
            if (result.error) {
              addLog(`[Scholar] 错误: ${result.error}`);
            }
          }
          addLog(`[Scholar] 找到 ${rawResults.academic_sources.length} 条结果`);
        }

        // 处理 News 结果
        if (serpapiResults.news) {
          for (const result of serpapiResults.news) {
            if (result.results && result.results.length > 0) {
              const mapped = result.results.map((item: any) => ({
                title: item.title || '',
                summary: item.snippet || '',
                source: item.source || '',
                published_at: normalizeDate(item.date) || '',
                url: item.link || ''
              }));
              rawResults.news_sources.push(...mapped);
            }
            if (result.error) {
              addLog(`[News] 错误: ${result.error}`);
            }
          }
          addLog(`[News] 找到 ${rawResults.news_sources.length} 条结果`);
        }

        // 处理 Web Search 结果
        if (serpapiResults.search) {
          for (const result of serpapiResults.search) {
            if (result.results && result.results.length > 0) {
              const mapped = result.results.map((item: any) => ({
                title: item.title || '',
                site_name: item.displayed_link || '',
                snippet: item.snippet || '',
                url: item.link || '',
                last_crawled_at: ''
              }));
              rawResults.web_sources.push(...mapped);
            }
            if (result.error) {
              addLog(`[Search] 错误: ${result.error}`);
            }
          }
          addLog(`[Search] 找到 ${rawResults.web_sources.length} 条结果`);
        }
      }
    }

    // 4. User Library 搜索
    const userSearchPromises = [];
    
    if (userId && searchPlan.user_library_queries && searchPlan.user_library_queries.length > 0) {
      addLog('========== User Library 搜索开始 ==========');
      const query = searchPlan.user_library_queries.join(' ');
      addLog(`[User Library] 查询: "${query}"`);
      
      userSearchPromises.push(
        supabase
          .from('reference_articles')
          .select('*')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(10)
          .then(({ data, error }: { data: any; error: any }) => {
            if (error) {
              console.error('[User Library] 搜索失败:', error);
              return;
            }
            if (data && data.length > 0) {
              const mapped = data.map((item: any) => ({
                title: item.title || '',
                content: item.content || '',
                source_type: item.source_type || '',
                url: item.source_url || '',
                created_at: item.created_at || ''
              }));
              rawResults.user_library_sources.push(...mapped);
              addLog(`[User Library] 找到 ${mapped.length} 条结果`);
            }
          })
      );

      // 5. Personal Materials 搜索
      addLog('========== Personal Materials 搜索开始 ==========');
      userSearchPromises.push(
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(10)
          .then(({ data, error }: { data: any; error: any }) => {
            if (error) {
              console.error('[Personal Materials] 搜索失败:', error);
              return;
            }
            if (data && data.length > 0) {
              const mapped = data.map((item: any) => ({
                title: item.title || '',
                content: item.content || '',
                material_type: item.material_type || '',
                created_at: item.created_at || ''
              }));
              rawResults.personal_sources.push(...mapped);
              addLog(`[Personal Materials] 找到 ${mapped.length} 条结果`);
            }
          })
      );
    }

    // 等待用户库搜索完成
    if (userSearchPromises.length > 0) {
      addLog('========== 等待用户库搜索完成 ==========');
      await Promise.all(userSearchPromises);
    }

    addLog('========== 搜索完成统计 ==========');
    addLog(`学术来源: ${rawResults.academic_sources.length}`);
    addLog(`新闻来源: ${rawResults.news_sources.length}`);
    addLog(`网络来源: ${rawResults.web_sources.length}`);
    addLog(`用户库来源: ${rawResults.user_library_sources.length}`);
    addLog(`个人素材: ${rawResults.personal_sources.length}`);

    // 去重（基于 URL）
    addLog('========== 开始去重 ==========');
    rawResults.academic_sources = Array.from(new Map(rawResults.academic_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.news_sources = Array.from(new Map(rawResults.news_sources.map(item => [item.url, item])).values()).slice(0, 10);
    rawResults.web_sources = Array.from(new Map(rawResults.web_sources.map(item => [item.url, item])).values()).slice(0, 10);

    addLog('去重后数量:', {
      academic: rawResults.academic_sources.length,
      news: rawResults.news_sources.length,
      web: rawResults.web_sources.length,
      user_library: rawResults.user_library_sources.length,
      personal: rawResults.personal_sources.length
    });

    // ========== STEP 2: Content Completion (KEY STEP) ==========
    addLog('========== 开始内容补全（全文抓取）==========');
    
    const finalResults = {
      academic_sources: [] as SourceWithContent[],
      news_sources: [] as SourceWithContent[],
      web_sources: [] as SourceWithContent[],
      user_library_sources: [] as SourceWithContent[],
      personal_sources: [] as SourceWithContent[]
    };

    // Helper function to fetch full text
    const fetchFullText = async (url: string, sourceType: string): Promise<{
      content_status: string;
      extracted_content: string[];
      full_text: string;
      notes: string;
    }> => {
      try {
        addLog(`[Content Fetch] 开始抓取: ${url}`);
        
        // 直接调用 webpage-content-extract Edge Function 的 HTTP 端点
        const extractUrl = `${supabaseUrl}/functions/v1/webpage-content-extract`;
        const response = await fetch(extractUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ url })
        });

        if (!response.ok) {
          const errorText = await response.text();
          addLog(`[Content Fetch] HTTP 错误: ${response.status} - ${errorText}`);
          return {
            content_status: 'unavailable_fulltext',
            extracted_content: [],
            full_text: '',
            notes: `HTTP ${response.status}: ${errorText}`
          };
        }

        const data = await response.json();
        
        if (!data.success) {
          addLog(`[Content Fetch] 提取失败: ${data.error || '未知错误'}`);
          return {
            content_status: data.content_status || 'unavailable_fulltext',
            extracted_content: [],
            full_text: '',
            notes: data.notes || data.error || '提取失败'
          };
        }

        addLog(`[Content Fetch] 成功 - 状态: ${data.content_status}, 段落数: ${data.extracted_content?.length || 0}`);
        
        return {
          content_status: data.content_status || 'unavailable_fulltext',
          extracted_content: data.extracted_content || [],
          full_text: data.text || '',
          notes: data.notes || ''
        };
      } catch (error: any) {
        addLog(`[Content Fetch] 异常: ${error.message}`);
        return {
          content_status: 'unavailable_fulltext',
          extracted_content: [],
          full_text: '',
          notes: error.message
        };
      }
    };

    // Process Academic Sources (只提取前3条的全文)
    addLog('========== 处理学术来源 ==========');
    for (let i = 0; i < rawResults.academic_sources.length; i++) {
      const source = rawResults.academic_sources[i];
      
      if (!source.url) {
        finalResults.academic_sources.push({
          source_type: 'GoogleScholar',
          title: source.title,
          authors: source.authors,
          year: source.year,
          url: '',
          content_status: 'abstract_only',
          extracted_content: [source.abstract || ''],
          full_text: source.abstract || '',
          notes: '无 URL，仅摘要',
          citation_count: source.citation_count
        });
        continue;
      }

      // 只对前3条进行全文提取，其余保留摘要
      let fullTextData;
      if (i < 3) {
        fullTextData = await fetchFullText(source.url, 'academic');
      } else {
        fullTextData = {
          content_status: 'abstract_only',
          extracted_content: [source.abstract || ''],
          full_text: source.abstract || '',
          notes: '未提取全文（优先级较低）'
        };
      }
      
      finalResults.academic_sources.push({
        source_type: 'GoogleScholar',
        title: source.title,
        authors: source.authors,
        year: source.year,
        url: source.url,
        content_status: fullTextData.content_status,
        extracted_content: fullTextData.extracted_content.length > 0 
          ? fullTextData.extracted_content 
          : [source.abstract || ''],
        full_text: fullTextData.full_text || source.abstract || '',
        notes: fullTextData.notes,
        citation_count: source.citation_count
      });
    }

    // Process News Sources (只提取前3条的全文)
    addLog('========== 处理新闻来源 ==========');
    for (let i = 0; i < rawResults.news_sources.length; i++) {
      const source = rawResults.news_sources[i];
      
      if (!source.url) {
        finalResults.news_sources.push({
          source_type: 'TheNews',
          title: source.title,
          url: '',
          content_status: 'abstract_only',
          extracted_content: [source.summary || ''],
          full_text: source.summary || '',
          notes: '无 URL，仅摘要',
          source: source.source,
          published_at: normalizeDate(source.published_at) || null
        });
        continue;
      }

      // 只对前3条进行全文提取
      let fullTextData;
      if (i < 3) {
        fullTextData = await fetchFullText(source.url, 'news');
      } else {
        fullTextData = {
          content_status: 'abstract_only',
          extracted_content: [source.summary || ''],
          full_text: source.summary || '',
          notes: '未提取全文（优先级较低）'
        };
      }
      
      finalResults.news_sources.push({
        source_type: 'TheNews',
        title: source.title,
        url: source.url,
        content_status: fullTextData.content_status,
        extracted_content: fullTextData.extracted_content.length > 0 
          ? fullTextData.extracted_content 
          : [source.summary || ''],
        full_text: fullTextData.full_text || source.summary || '',
        notes: fullTextData.notes,
        source: source.source,
        published_at: normalizeDate(source.published_at) || null
      });
    }

    // Process Web Sources (只提取前3条的全文)
    addLog('========== 处理网络来源 ==========');
    for (let i = 0; i < rawResults.web_sources.length; i++) {
      const source = rawResults.web_sources[i];
      
      if (!source.url) {
        finalResults.web_sources.push({
          source_type: 'SmartSearch',
          title: source.title,
          url: '',
          content_status: 'abstract_only',
          extracted_content: [source.snippet || ''],
          full_text: source.snippet || '',
          notes: '无 URL，仅摘要',
          site_name: source.site_name
        });
        continue;
      }

      // 只对前3条进行全文提取
      let fullTextData;
      if (i < 3) {
        fullTextData = await fetchFullText(source.url, 'web');
      } else {
        fullTextData = {
          content_status: 'abstract_only',
          extracted_content: [source.snippet || ''],
          full_text: source.snippet || '',
          notes: '未提取全文（优先级较低）'
        };
      }
      
      finalResults.web_sources.push({
        source_type: 'SmartSearch',
        title: source.title,
        url: source.url,
        content_status: fullTextData.content_status,
        extracted_content: fullTextData.extracted_content.length > 0 
          ? fullTextData.extracted_content 
          : [source.snippet || ''],
        full_text: fullTextData.full_text || source.snippet || '',
        notes: fullTextData.notes,
        site_name: source.site_name
      });
    }

    // Process User Library Sources (already have full content)
    addLog('========== 处理用户库来源 ==========');
    for (const source of rawResults.user_library_sources) {
      const content = source.content || '';
      const sentences = content.split(/[。！？\n\r]+/).filter(s => s.trim().length > 20);
      const paragraphSize = Math.max(1, Math.ceil(sentences.length / 5));
      const extracted_content: string[] = [];
      
      for (let i = 0; i < sentences.length && extracted_content.length < 8; i += paragraphSize) {
        const paragraph = sentences.slice(i, i + paragraphSize).join('。');
        if (paragraph.length > 30) {
          extracted_content.push(paragraph);
        }
      }

      finalResults.user_library_sources.push({
        source_type: 'UserLibrary',
        title: source.title,
        url: source.url || '',
        content_status: 'full_text',
        extracted_content: extracted_content.length > 0 ? extracted_content : [content],
        full_text: content,
        notes: '来自用户参考文章库',
        source_type_label: source.source_type
      });
    }

    // Process Personal Materials (already have full content)
    addLog('========== 处理个人素材 ==========');
    for (const source of rawResults.personal_sources) {
      const content = source.content || '';
      const sentences = content.split(/[。！？\n\r]+/).filter(s => s.trim().length > 20);
      const paragraphSize = Math.max(1, Math.ceil(sentences.length / 5));
      const extracted_content: string[] = [];
      
      for (let i = 0; i < sentences.length && extracted_content.length < 8; i += paragraphSize) {
        const paragraph = sentences.slice(i, i + paragraphSize).join('。');
        if (paragraph.length > 30) {
          extracted_content.push(paragraph);
        }
      }

      finalResults.personal_sources.push({
        source_type: 'PersonalMaterial',
        title: source.title,
        url: '',
        content_status: 'full_text',
        extracted_content: extracted_content.length > 0 ? extracted_content : [content],
        full_text: content,
        notes: '来自个人素材库',
        material_type: source.material_type
      });
    }

    // ========== STEP 3: Content Quality Judgment ==========
    addLog('========== 内容质量统计 ==========');
    const qualityStats = {
      full_text: 0,
      abstract_only: 0,
      insufficient_content: 0,
      unavailable_fulltext: 0
    };

    const allSources = [
      ...finalResults.academic_sources,
      ...finalResults.news_sources,
      ...finalResults.web_sources,
      ...finalResults.user_library_sources,
      ...finalResults.personal_sources
    ];

    for (const source of allSources) {
      qualityStats[source.content_status as keyof typeof qualityStats]++;
    }

    addLog('质量统计:', qualityStats);
    addLog('总资料数:', allSources.length);

    // 保存检索资料到数据库
    if (sessionId) {
      addLog('========== 保存检索资料到数据库 ==========');
      try {
        // 先清空该会话的旧资料
        const { error: deleteError } = await supabase
          .from('retrieved_materials')
          .delete()
          .eq('session_id', sessionId);

        if (deleteError) {
          addLog(`清空旧资料失败: ${deleteError.message}`);
        } else {
          addLog('已清空旧资料');
        }

        // 准备要保存的资料
        const materialsToSave = [];

        // 学术来源
        for (const source of finalResults.academic_sources) {
          materialsToSave.push({
            session_id: sessionId,
            source_type: 'academic',
            title: source.title || '',
            url: source.url || null,
            abstract: source.abstract || null,
            full_text: source.full_text || null,
            authors: source.authors || null,
            year: source.year || null,
            citation_count: source.citation_count || 0,
            is_selected: true,  // 默认选中所有检索到的资料
            metadata: {
              content_status: source.content_status,
              extracted_content: source.extracted_content || [],
              notes: source.notes || ''
            }
          });
        }

        // 新闻来源
        for (const source of finalResults.news_sources) {
          materialsToSave.push({
            session_id: sessionId,
            source_type: 'news',
            title: source.title || '',
            url: source.url || null,
            abstract: source.summary || null,
            full_text: source.full_text || null,
            authors: source.source || null,
            published_at: normalizeDate(source.published_at) || null,
            is_selected: true,  // 默认选中所有检索到的资料
            metadata: {
              content_status: source.content_status,
              extracted_content: source.extracted_content || [],
              notes: source.notes || ''
            }
          });
        }

        // 网络来源
        for (const source of finalResults.web_sources) {
          materialsToSave.push({
            session_id: sessionId,
            source_type: 'web',
            title: source.title || '',
            url: source.url || null,
            abstract: source.snippet || null,
            full_text: source.full_text || null,
            authors: source.site_name || null,
            is_selected: true,  // 默认选中所有检索到的资料
            metadata: {
              content_status: source.content_status,
              extracted_content: source.extracted_content || [],
              notes: source.notes || '',
              last_crawled_at: source.last_crawled_at || ''
            }
          });
        }

        // 用户库来源
        for (const source of finalResults.user_library_sources) {
          materialsToSave.push({
            session_id: sessionId,
            source_type: 'user_library',
            title: source.title || '',
            url: source.url || null,
            full_text: source.content || null,
            is_selected: true,  // 默认选中所有检索到的资料
            metadata: {
              source_type: source.source_type || '',
              created_at: source.created_at || ''
            }
          });
        }

        // 个人素材
        for (const source of finalResults.personal_sources) {
          materialsToSave.push({
            session_id: sessionId,
            source_type: 'personal',
            title: source.title || '',
            full_text: source.content || null,
            is_selected: true,  // 默认选中所有检索到的资料
            metadata: {
              material_type: source.material_type || '',
              created_at: source.created_at || ''
            }
          });
        }

        if (materialsToSave.length > 0) {
          const { data: savedMaterials, error: insertError } = await supabase
            .from('retrieved_materials')
            .insert(materialsToSave)
            .select();

          if (insertError) {
            addLog(`保存资料失败: ${insertError.message}`);
          } else {
            addLog(`成功保存 ${savedMaterials?.length || 0} 条资料`);
          }
        } else {
          addLog('没有资料需要保存');
        }
      } catch (saveError: any) {
        addLog(`保存资料异常: ${saveError.message}`);
        console.error('保存资料异常:', saveError);
      }
    } else {
      addLog('未提供 sessionId，跳过保存资料');
    }

    // 最终结果
    const finalResponse = {
      success: true,
      data: {
        search_summary: {
          ...searchPlan.search_summary,
          academic_queries: searchPlan.academic_queries || [],
          news_queries: searchPlan.news_queries || [],
          web_queries: searchPlan.web_queries || [],
          user_library_queries: searchPlan.user_library_queries || []
        },
        ...finalResults
      },
      stats: {
        total_sources: allSources.length,
        by_type: {
          academic: finalResults.academic_sources.length,
          news: finalResults.news_sources.length,
          web: finalResults.web_sources.length,
          user_library: finalResults.user_library_sources.length,
          personal: finalResults.personal_sources.length
        },
        by_quality: qualityStats
      },
      logs: logs
    };

    addLog('========== 研究检索完成 ==========');

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('处理请求时出错:', error);
    addLog(`❌ 错误: ${error.message || '处理请求时出错'}`);
    return new Response(
      JSON.stringify({ 
        error: error.message || '处理请求时出错',
        details: error.toString(),
        logs: logs
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

