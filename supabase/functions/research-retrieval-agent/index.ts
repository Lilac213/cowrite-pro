import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
  requirementsDoc: string;
  projectId?: string;
  userId?: string;
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
    
    addLog('========== API Keys 状态检查 ==========');
    addLog(`QIANWEN_API_KEY 存在: ${!!qianwenApiKey}`);
    addLog(`INTEGRATIONS_API_KEY 存在: ${!!integrationsApiKey}`);
    addLog(`INTEGRATIONS_API_KEY 前缀: ${integrationsApiKey?.substring(0, 10) || 'N/A'}`);
    
    if (!qianwenApiKey) {
      throw new Error('QIANWEN_API_KEY 未配置');
    }
    if (!integrationsApiKey) {
      throw new Error('INTEGRATIONS_API_KEY 未配置');
    }

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
  "web_queries": ["中英文网络关键词1", "中英文网络关键词2"]
}

字段要求:
- 即使没有结果，也必须返回空数组 []
- 不允许省略任何字段
- 不允许输出额外文本`;

    const userPrompt = `研究需求文档：\n${requirementsDocStr}\n\n请生成搜索计划。`;

    addLog('========== 开始调用通义千问 API ==========');
    addLog('用户提示词:', userPrompt);

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
      
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      console.error('原始内容:', content);
      throw new Error(`解析搜索计划失败: ${parseError.message}`);
    }

    addLog('搜索计划:', JSON.stringify(searchPlan, null, 2));

    // 并行执行所有搜索
    const searchPromises = [];
    const results = {
      academic_sources: [],
      news_sources: [],
      web_sources: [],
      user_library_sources: []
    };

    // 1. Google Scholar 搜索
    if (searchPlan.academic_queries && searchPlan.academic_queries.length > 0) {
      addLog('========== Google Scholar 搜索开始 ==========');
      addLog('学术查询关键词:', searchPlan.academic_queries);
      for (const query of searchPlan.academic_queries.slice(0, 2)) {
        const scholarUrl = `https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=2020&hl=en`;
        addLog(`[Google Scholar] 查询: "${query}"`);
        addLog(`[Google Scholar] URL: ${scholarUrl}`);
        
        searchPromises.push(
          fetch(scholarUrl, {
            headers: {
              'Accept': 'application/json',
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(async res => {
            addLog(`[Google Scholar] 响应状态: ${res.status}`);
            const text = await res.text();
            addLog(`[Google Scholar] 原始响应: ${text.substring(0, 500)}...`);
            return JSON.parse(text);
          })
          .then(data => {
            addLog('[Google Scholar] 解析后的数据结构:', Object.keys(data));
            addLog('[Google Scholar] organic_results 存在:', !!data.organic_results);
            addLog('[Google Scholar] organic_results 长度:', data.organic_results?.length || 0);
            
            if (data.organic_results && data.organic_results.length > 0) {
              addLog('[Google Scholar] 第一条结果示例:', JSON.stringify(data.organic_results[0], null, 2));
              const mapped = data.organic_results.slice(0, 5).map((item: any) => ({
                title: item.title || '',
                authors: item.publication_info?.summary || '',
                abstract: item.snippet || '',
                citation_count: item.inline_links?.cited_by?.total || 0,
                publication_year: item.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
                url: item.link || ''
              }));
              addLog('[Google Scholar] 映射后的结果数量:', mapped.length);
              results.academic_sources.push(...mapped);
            } else {
              addLog('[Google Scholar] ⚠️ 没有找到 organic_results 或结果为空');
              addLog('[Google Scholar] 完整响应数据:', JSON.stringify(data, null, 2));
            }
          })
          .catch(err => {
            console.error('[Google Scholar] ❌ 搜索失败:', err);
            console.error('[Google Scholar] 错误详情:', err.message);
            console.error('[Google Scholar] 错误堆栈:', err.stack);
          })
        );
      }
    } else {
      addLog('⚠️ 没有学术查询关键词，跳过 Google Scholar 搜索');
    }

    // 2. TheNews 搜索
    if (searchPlan.news_queries && searchPlan.news_queries.length > 0) {
      addLog('========== TheNews 搜索开始 ==========');
      addLog('新闻查询关键词:', searchPlan.news_queries);
      for (const query of searchPlan.news_queries.slice(0, 2)) {
        const newsUrl = `https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=dummy&search=${encodeURIComponent(query)}&limit=5&sort=published_on`;
        addLog(`[TheNews] 查询: "${query}"`);
        addLog(`[TheNews] URL: ${newsUrl}`);
        
        searchPromises.push(
          fetch(newsUrl, {
            headers: {
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(async res => {
            addLog(`[TheNews] 响应状态: ${res.status}`);
            const text = await res.text();
            addLog(`[TheNews] 原始响应: ${text.substring(0, 500)}...`);
            return JSON.parse(text);
          })
          .then(data => {
            addLog('[TheNews] 解析后的数据结构:', Object.keys(data));
            addLog('[TheNews] data 字段存在:', !!data.data);
            addLog('[TheNews] data 长度:', data.data?.length || 0);
            
            if (data.data && data.data.length > 0) {
              addLog('[TheNews] 第一条结果示例:', JSON.stringify(data.data[0], null, 2));
              const mapped = data.data.map((item: any) => ({
                title: item.title || '',
                summary: item.description || item.snippet || '',
                source: item.source || '',
                published_at: item.published_at || '',
                url: item.url || ''
              }));
              addLog('[TheNews] 映射后的结果数量:', mapped.length);
              results.news_sources.push(...mapped);
            } else {
              addLog('[TheNews] ⚠️ 没有找到 data 字段或结果为空');
              addLog('[TheNews] 完整响应数据:', JSON.stringify(data, null, 2));
            }
          })
          .catch(err => {
            console.error('[TheNews] ❌ 搜索失败:', err);
            console.error('[TheNews] 错误详情:', err.message);
            console.error('[TheNews] 错误堆栈:', err.stack);
          })
        );
      }
    } else {
      addLog('⚠️ 没有新闻查询关键词，跳过 TheNews 搜索');
    }

    // 3. Smart Search (Bing) 搜索
    if (searchPlan.web_queries && searchPlan.web_queries.length > 0) {
      addLog('========== Smart Search 搜索开始 ==========');
      addLog('网络查询关键词:', searchPlan.web_queries);
      for (const query of searchPlan.web_queries.slice(0, 2)) {
        const smartUrl = `https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=${encodeURIComponent(query)}&count=5&freshness=Month&mkt=zh-CN`;
        addLog(`[Smart Search] 查询: "${query}"`);
        addLog(`[Smart Search] URL: ${smartUrl}`);
        
        searchPromises.push(
          fetch(smartUrl, {
            headers: {
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(async res => {
            addLog(`[Smart Search] 响应状态: ${res.status}`);
            const text = await res.text();
            addLog(`[Smart Search] 原始响应: ${text.substring(0, 500)}...`);
            return JSON.parse(text);
          })
          .then(data => {
            addLog('[Smart Search] 解析后的数据结构:', Object.keys(data));
            addLog('[Smart Search] webPages 存在:', !!data.webPages);
            addLog('[Smart Search] webPages.value 存在:', !!data.webPages?.value);
            addLog('[Smart Search] webPages.value 长度:', data.webPages?.value?.length || 0);
            
            if (data.webPages?.value && data.webPages.value.length > 0) {
              addLog('[Smart Search] 第一条结果示例:', JSON.stringify(data.webPages.value[0], null, 2));
              const mapped = data.webPages.value.map((item: any) => ({
                title: item.name || '',
                site_name: item.siteName || '',
                snippet: item.snippet || '',
                url: item.url || '',
                last_crawled_at: item.dateLastCrawled || ''
              }));
              addLog('[Smart Search] 映射后的结果数量:', mapped.length);
              results.web_sources.push(...mapped);
            } else {
              addLog('[Smart Search] ⚠️ 没有找到 webPages.value 或结果为空');
              addLog('[Smart Search] 完整响应数据:', JSON.stringify(data, null, 2));
            }
          })
          .catch(err => {
            console.error('[Smart Search] ❌ 搜索失败:', err);
            console.error('[Smart Search] 错误详情:', err.message);
            console.error('[Smart Search] 错误堆栈:', err.stack);
          })
        );
      }
    } else {
      addLog('⚠️ 没有网络查询关键词，跳过 Smart Search 搜索');
    }

    // 等待所有搜索完成
    addLog('========== 等待所有搜索完成 ==========');
    addLog('搜索任务数量:', searchPromises.length);
    await Promise.all(searchPromises);

    addLog('========== 所有搜索完成 ==========');
    addLog('学术来源数量:', results.academic_sources.length);
    addLog('新闻来源数量:', results.news_sources.length);
    addLog('网络来源数量:', results.web_sources.length);
    addLog('用户库来源数量:', results.user_library_sources.length);

    // 去重
    addLog('========== 开始去重 ==========');
    const beforeDedup = {
      academic: results.academic_sources.length,
      news: results.news_sources.length,
      web: results.web_sources.length
    };
    
    results.academic_sources = Array.from(new Map(results.academic_sources.map(item => [item.url, item])).values()).slice(0, 10);
    results.news_sources = Array.from(new Map(results.news_sources.map(item => [item.url, item])).values()).slice(0, 10);
    results.web_sources = Array.from(new Map(results.web_sources.map(item => [item.url, item])).values()).slice(0, 10);

    addLog('去重前数量:', beforeDedup);
    addLog('去重后数量:', {
      academic: results.academic_sources.length,
      news: results.news_sources.length,
      web: results.web_sources.length
    });

    addLog('========== 最终结果统计 ==========');
    addLog('总计资料数量:', results.academic_sources.length + results.news_sources.length + results.web_sources.length + results.user_library_sources.length);
    addLog('最终结果详情:', JSON.stringify({
      academic_count: results.academic_sources.length,
      news_count: results.news_sources.length,
      web_count: results.web_sources.length,
      user_library_count: results.user_library_sources.length,
      academic_sample: results.academic_sources.slice(0, 1),
      news_sample: results.news_sources.slice(0, 1),
      web_sample: results.web_sources.slice(0, 1)
    }, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          search_summary: searchPlan.search_summary,
          ...results
        },
        logs: logs,
        raw_content: content
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
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
