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

  try {
    const { requirementsDoc, projectId, userId }: ResearchRequest = await req.json();

    if (!requirementsDoc) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数: requirementsDoc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    const integrationsApiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
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

    const userPrompt = `研究需求文档：\n${requirementsDoc}\n\n请生成搜索计划。`;

    console.log('开始调用 DeepSeek API 生成搜索计划...');

    // 调用 DeepSeek API 生成搜索计划
    const llmResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
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
      console.error('DeepSeek API 错误:', errorText);
      throw new Error(`DeepSeek API 请求失败: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('DeepSeek API 返回内容为空');
    }

    console.log('DeepSeek 返回内容:', content);

    // 提取 ---JSON--- 部分
    let searchPlan;
    try {
      const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)(?:---|\n\n\n|$)/);
      if (!jsonMatch) {
        console.error('未找到 ---JSON--- 标记，原始内容:', content);
        throw new Error('未找到 ---JSON--- 标记');
      }
      
      const jsonText = jsonMatch[1].trim();
      console.log('提取的 JSON 文本:', jsonText);
      
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

    console.log('搜索计划:', JSON.stringify(searchPlan, null, 2));

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
      console.log('开始 Google Scholar 搜索...');
      for (const query of searchPlan.academic_queries.slice(0, 2)) {
        searchPromises.push(
          fetch(`https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=2020&hl=en`, {
            headers: {
              'Accept': 'application/json',
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(res => res.json())
          .then(data => {
            console.log('Google Scholar 返回:', data);
            if (data.organic_results) {
              results.academic_sources.push(...data.organic_results.slice(0, 5).map((item: any) => ({
                title: item.title || '',
                authors: item.publication_info?.summary || '',
                abstract: item.snippet || '',
                citation_count: item.inline_links?.cited_by?.total || 0,
                publication_year: item.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
                url: item.link || ''
              })));
            }
          })
          .catch(err => {
            console.error('Google Scholar 搜索失败:', err);
          })
        );
      }
    }

    // 2. TheNews 搜索
    if (searchPlan.news_queries && searchPlan.news_queries.length > 0) {
      console.log('开始 TheNews 搜索...');
      for (const query of searchPlan.news_queries.slice(0, 2)) {
        searchPromises.push(
          fetch(`https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=dummy&search=${encodeURIComponent(query)}&limit=5&sort=published_on`, {
            headers: {
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(res => res.json())
          .then(data => {
            console.log('TheNews 返回:', data);
            if (data.data) {
              results.news_sources.push(...data.data.map((item: any) => ({
                title: item.title || '',
                summary: item.description || item.snippet || '',
                source: item.source || '',
                published_at: item.published_at || '',
                url: item.url || ''
              })));
            }
          })
          .catch(err => {
            console.error('TheNews 搜索失败:', err);
          })
        );
      }
    }

    // 3. Smart Search (Bing) 搜索
    if (searchPlan.web_queries && searchPlan.web_queries.length > 0) {
      console.log('开始 Smart Search 搜索...');
      for (const query of searchPlan.web_queries.slice(0, 2)) {
        searchPromises.push(
          fetch(`https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=${encodeURIComponent(query)}&count=5&freshness=Month&mkt=zh-CN`, {
            headers: {
              'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`
            }
          })
          .then(res => res.json())
          .then(data => {
            console.log('Smart Search 返回:', data);
            if (data.webPages?.value) {
              results.web_sources.push(...data.webPages.value.map((item: any) => ({
                title: item.name || '',
                site_name: item.siteName || '',
                snippet: item.snippet || '',
                url: item.url || '',
                last_crawled_at: item.dateLastCrawled || ''
              })));
            }
          })
          .catch(err => {
            console.error('Smart Search 搜索失败:', err);
          })
        );
      }
    }

    // 等待所有搜索完成
    await Promise.all(searchPromises);

    console.log('所有搜索完成');

    // 去重
    results.academic_sources = Array.from(new Map(results.academic_sources.map(item => [item.url, item])).values()).slice(0, 10);
    results.news_sources = Array.from(new Map(results.news_sources.map(item => [item.url, item])).values()).slice(0, 10);
    results.web_sources = Array.from(new Map(results.web_sources.map(item => [item.url, item])).values()).slice(0, 10);

    console.log('最终结果:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          search_summary: searchPlan.search_summary,
          ...results
        },
        raw_content: content
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || '处理请求时出错',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
