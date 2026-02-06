import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
  requirementsDoc: string;
  projectId?: string;
  userId?: string;
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
    const { requirementsDoc, projectId, userId }: ResearchRequest = await req.json();

    addLog('========== 接收到的请求参数 ==========');
    addLog(`requirementsDoc 类型: ${typeof requirementsDoc}`);
    addLog(`projectId: ${projectId || '未提供'}`);
    addLog(`userId: ${userId || '未提供'}`);

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
    
    addLog('========== API Keys 状态检查 ==========');
    addLog(`QIANWEN_API_KEY 存在: ${!!qianwenApiKey}`);
    addLog(`INTEGRATIONS_API_KEY 存在: ${!!integrationsApiKey}`);
    addLog(`SUPABASE_URL 存在: ${!!supabaseUrl}`);
    
    if (!qianwenApiKey) {
      throw new Error('QIANWEN_API_KEY 未配置');
    }
    if (!integrationsApiKey) {
      throw new Error('INTEGRATIONS_API_KEY 未配置');
    }

    // 初始化 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 新的系统提示词 - 严格的输出格式
    const systemPrompt = `🧠 Research Retrieval Agent

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

    // ========== STEP 1: Multi-source Retrieval ==========
    const searchPromises = [];
    const rawResults = {
      academic_sources: [] as any[],
      news_sources: [] as any[],
      web_sources: [] as any[],
      user_library_sources: [] as any[],
      personal_sources: [] as any[]
    };

    // 1. Google Scholar 搜索
    if (searchPlan.academic_queries && searchPlan.academic_queries.length > 0) {
      addLog('========== Google Scholar 搜索开始 ==========');
      for (const query of searchPlan.academic_queries.slice(0, 2)) {
        const scholarUrl = `https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=2020&hl=en`;
        addLog(`[Google Scholar] 查询: "${query}"`);
        
        searchPromises.push(
          fetch(scholarUrl, {
            headers: {
              'Accept': 'application/json',
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(res => res.json())
          .then(data => {
            if (data.organic_results && data.organic_results.length > 0) {
              const mapped = data.organic_results.slice(0, 5).map((item: any) => ({
                title: item.title || '',
                authors: item.publication_info?.summary || '',
                abstract: item.snippet || '',
                citation_count: item.inline_links?.cited_by?.total || 0,
                year: item.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
                url: item.link || ''
              }));
              rawResults.academic_sources.push(...mapped);
              addLog(`[Google Scholar] 找到 ${mapped.length} 条结果`);
            }
          })
          .catch(err => console.error('[Google Scholar] 搜索失败:', err))
        );
      }
    }

    // 2. TheNews 搜索
    if (searchPlan.news_queries && searchPlan.news_queries.length > 0) {
      addLog('========== TheNews 搜索开始 ==========');
      for (const query of searchPlan.news_queries.slice(0, 2)) {
        const newsUrl = `https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=dummy&search=${encodeURIComponent(query)}&limit=5&sort=published_on`;
        addLog(`[TheNews] 查询: "${query}"`);
        
        searchPromises.push(
          fetch(newsUrl, {
            headers: { 'X-Gateway-Authorization': `Bearer ${integrationsApiKey}` }
          })
          .then(res => res.json())
          .then(data => {
            if (data.data && data.data.length > 0) {
              const mapped = data.data.map((item: any) => ({
                title: item.title || '',
                summary: item.description || item.snippet || '',
                source: item.source || '',
                published_at: item.published_at || '',
                url: item.url || ''
              }));
              rawResults.news_sources.push(...mapped);
              addLog(`[TheNews] 找到 ${mapped.length} 条结果`);
            }
          })
          .catch(err => console.error('[TheNews] 搜索失败:', err))
        );
      }
    }

    // 3. Smart Search (Bing) 搜索
    if (searchPlan.web_queries && searchPlan.web_queries.length > 0) {
      addLog('========== Smart Search 搜索开始 ==========');
      for (const query of searchPlan.web_queries.slice(0, 2)) {
        const smartUrl = `https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=${encodeURIComponent(query)}&count=5&freshness=Month&mkt=zh-CN`;
        addLog(`[Smart Search] 查询: "${query}"`);
        
        searchPromises.push(
          fetch(smartUrl, {
            headers: { 'X-Gateway-Authorization': `Bearer ${integrationsApiKey}` }
          })
          .then(res => res.json())
          .then(data => {
            if (data.webPages?.value && data.webPages.value.length > 0) {
              const mapped = data.webPages.value.map((item: any) => ({
                title: item.name || '',
                site_name: item.siteName || '',
                snippet: item.snippet || '',
                url: item.url || '',
                last_crawled_at: item.dateLastCrawled || ''
              }));
              rawResults.web_sources.push(...mapped);
              addLog(`[Smart Search] 找到 ${mapped.length} 条结果`);
            }
          })
          .catch(err => console.error('[Smart Search] 搜索失败:', err))
        );
      }
    }

    // 4. User Library 搜索
    if (userId && searchPlan.user_library_queries && searchPlan.user_library_queries.length > 0) {
      addLog('========== User Library 搜索开始 ==========');
      const query = searchPlan.user_library_queries.join(' ');
      addLog(`[User Library] 查询: "${query}"`);
      
      searchPromises.push(
        supabase
          .from('reference_articles')
          .select('*')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(10)
          .then(({ data, error }) => {
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
      searchPromises.push(
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(10)
          .then(({ data, error }) => {
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

    // 等待所有搜索完成
    addLog('========== 等待所有搜索完成 ==========');
    await Promise.all(searchPromises);

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
        
        const response = await supabase.functions.invoke('webpage-content-extract', {
          body: { url }
        });

        if (response.error) {
          addLog(`[Content Fetch] 错误: ${response.error.message}`);
          return {
            content_status: 'unavailable_fulltext',
            extracted_content: [],
            full_text: '',
            notes: response.error.message
          };
        }

        const data = response.data;
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

    // Process Academic Sources
    addLog('========== 处理学术来源 ==========');
    for (const source of rawResults.academic_sources) {
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

      const fullTextData = await fetchFullText(source.url, 'academic');
      
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

    // Process News Sources
    addLog('========== 处理新闻来源 ==========');
    for (const source of rawResults.news_sources) {
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
          published_at: source.published_at
        });
        continue;
      }

      const fullTextData = await fetchFullText(source.url, 'news');
      
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
        published_at: source.published_at
      });
    }

    // Process Web Sources
    addLog('========== 处理网络来源 ==========');
    for (const source of rawResults.web_sources) {
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

      const fullTextData = await fetchFullText(source.url, 'web');
      
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

    // 最终结果
    const finalResponse = {
      success: true,
      data: {
        search_summary: searchPlan.search_summary,
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

