import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requirementsDoc, projectId, userId } = await req.json();

    if (!requirementsDoc) {
      return new Response(
        JSON.stringify({ error: '缺少需求文档' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 初始化 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 构建 Research Retrieval Agent Prompt
    const systemPrompt = `你是 CoWrite 的 Research Retrieval Agent，负责根据用户提供的【结构化 JSON 需求文档】，在多个数据源中检索最贴合主题、最具时效性、最具信息密度的研究与事实材料，为后续写作提供高质量输入。

你不做观点发挥、不做写作、不做总结结论，只做 "搜索、筛选、结构化返回"。

可用数据源（必须全部考虑）：
1️⃣ Google Scholar（via SerpApi）- 学术研究、方法论、框架、实证研究
2️⃣ TheNews（新闻 & 行业动态）- 最新趋势、商业实践、失败案例、公司动向
3️⃣ Smart Search（Bing Web Search）- 博客、白皮书、行业报告、实践总结
4️⃣ 用户参考文章库（User Reference Library）- 用户显式提供或历史沉淀的参考资料
5️⃣ 用户个人素材库（Personal Knowledge Base）- 用户过往观点、笔记、方法论、内部总结

检索策略（必须执行）：
1. 先理解需求 - 从 JSON 中提取核心问题、关键判断维度、隐含研究目标
2. 反向生成搜索 Query - 将中文需求转写为英文学术关键词和中英文混合行业关键词
3. 多源并行搜索 - 三个外部搜索源 + 两个内部库同时进行
4. 结果去重 & 相关度过滤 - 删除明显跑题、纯营销内容、无实质信息的新闻稿

你必须输出一个结构化 JSON，包含：
- search_summary: 解读的主题和关键维度
- search_queries: 生成的搜索查询（学术关键词、网页查询）
- academic_sources: Google Scholar 结果
- news_sources: TheNews 结果
- web_sources: Smart Search 结果
- user_library_sources: 用户参考文章库结果
- personal_sources: 用户个人素材库结果

⚠️ 不允许输出自然语言总结
⚠️ 不允许中文翻译或观点提炼（这是下一个 Agent 的工作）`;

    const userPrompt = `需求文档（JSON）：
${JSON.stringify(requirementsDoc, null, 2)}

请根据以上需求文档，生成搜索查询并规划检索策略。输出格式：
{
  "search_summary": {
    "interpreted_topic": "...",
    "key_dimensions": ["...", "..."]
  },
  "search_queries": {
    "academic_keywords": ["...", "..."],
    "web_queries": ["...", "..."]
  }
}`;

    // 调用 LLM 生成搜索查询
    const llmResponse = await fetch(
      'https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: '我理解了。我是 Research Retrieval Agent，我会根据需求文档生成搜索查询并检索相关资料。' }] },
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
        }),
      }
    );

    if (!llmResponse.ok) {
      throw new Error(`LLM API 请求失败: ${llmResponse.status}`);
    }

    // 读取流式响应
    const reader = llmResponse.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.candidates && jsonData.candidates[0]?.content?.parts) {
                const text = jsonData.candidates[0].content.parts[0]?.text || '';
                fullText += text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 提取 JSON 内容
    let searchPlan;
    let jsonText = '';
    
    try {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = (jsonMatch[1] || jsonMatch[0]).trim();
      } else {
        throw new Error('无法找到 JSON 内容');
      }
      
      // 清理 JSON 文本
      // 1. 移除注释
      jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      
      // 2. 修复常见的 JSON 错误
      // 移除尾随逗号
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
      
      // 3. 尝试解析
      try {
        searchPlan = JSON.parse(jsonText);
      } catch (parseError) {
        // 如果解析失败，尝试修复属性名未加引号的问题
        console.error('首次 JSON 解析失败，尝试修复属性名:', parseError);
        
        // 尝试给未加引号的属性名加上引号
        const fixedJson = jsonText.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        try {
          searchPlan = JSON.parse(fixedJson);
          console.log('JSON 修复成功');
        } catch (fixError) {
          // 记录详细错误信息
          console.error('JSON 修复后仍然解析失败:', fixError);
          console.error('原始文本长度:', fullText.length);
          console.error('提取的 JSON 文本:', jsonText.substring(0, 1000));
          console.error('修复后的 JSON 文本:', fixedJson.substring(0, 1000));
          
          throw new Error(`解析搜索计划失败: ${fixError.message}。请查看 Edge Function 日志获取详细信息。`);
        }
      }
    } catch (e) {
      console.error('JSON 提取或解析失败:', e);
      console.error('完整原始文本:', fullText);
      throw new Error(`解析搜索计划失败: ${e.message}`);
    }

    // 执行并行搜索
    const searchPromises: Promise<any>[] = [];

    // 1. Google Scholar 搜索
    if (searchPlan.search_queries?.academic_keywords?.length > 0) {
      const query = searchPlan.search_queries.academic_keywords.join(' ');
      searchPromises.push(
        fetch(
          `https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=2020&num=10`,
          {
            headers: {
              'X-Gateway-Authorization': `Bearer ${apiKey}`,
            },
          }
        )
          .then((res) => res.json())
          .then((data) => ({
            source: 'google_scholar',
            results: data.organic_results || [],
          }))
          .catch(() => ({ source: 'google_scholar', results: [] }))
      );
    }

    // 2. TheNews 搜索
    if (searchPlan.search_queries?.web_queries?.length > 0) {
      const query = searchPlan.search_queries.web_queries[0];
      searchPromises.push(
        fetch(
          `https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=${apiKey}&search=${encodeURIComponent(query)}&limit=10&sort=published_on`,
          {
            headers: {
              'X-Gateway-Authorization': `Bearer ${apiKey}`,
            },
          }
        )
          .then((res) => res.json())
          .then((data) => ({
            source: 'thenews',
            results: data.data || [],
          }))
          .catch(() => ({ source: 'thenews', results: [] }))
      );
    }

    // 3. Smart Search
    if (searchPlan.search_queries?.web_queries?.length > 0) {
      const query = searchPlan.search_queries.web_queries[0];
      searchPromises.push(
        fetch(
          `https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=${encodeURIComponent(query)}&count=10&mkt=zh-CN&freshness=Year`,
          {
            headers: {
              'X-Gateway-Authorization': `Bearer ${apiKey}`,
            },
          }
        )
          .then((res) => res.json())
          .then((data) => ({
            source: 'smart_search',
            results: data.webPages?.value || [],
          }))
          .catch(() => ({ source: 'smart_search', results: [] }))
      );
    }

    // 4. 用户参考文章库
    if (projectId) {
      searchPromises.push(
        supabase
          .from('reference_articles')
          .select('*')
          .eq('project_id', projectId)
          .limit(10)
          .then(({ data }) => ({
            source: 'user_library',
            results: data || [],
          }))
          .catch(() => ({ source: 'user_library', results: [] }))
      );
    }

    // 5. 用户个人素材库
    if (projectId) {
      searchPromises.push(
        supabase
          .from('materials')
          .select('*')
          .eq('project_id', projectId)
          .limit(10)
          .then(({ data }) => ({
            source: 'personal_materials',
            results: data || [],
          }))
          .catch(() => ({ source: 'personal_materials', results: [] }))
      );
    }

    // 等待所有搜索完成
    const searchResults = await Promise.all(searchPromises);

    // 整理结果
    const organizedResults = {
      search_summary: searchPlan.search_summary,
      search_queries: searchPlan.search_queries,
      academic_sources: [],
      news_sources: [],
      web_sources: [],
      user_library_sources: [],
      personal_sources: [],
    };

    for (const result of searchResults) {
      if (result.source === 'google_scholar') {
        organizedResults.academic_sources = result.results.map((item: any) => ({
          title: item.title || '',
          authors: item.publication_info?.summary || '',
          year: item.publication_info?.summary?.match(/\d{4}/)?.[0] || '',
          citation_count: item.inline_links?.cited_by?.total || 0,
          abstract: item.snippet || '',
          url: item.link || '',
          core_relevance: '待评估',
        }));
      } else if (result.source === 'thenews') {
        organizedResults.news_sources = result.results.map((item: any) => ({
          title: item.title || '',
          source: item.source || '',
          published_at: item.published_at || '',
          snippet: item.description || '',
          url: item.url || '',
          why_relevant: '待评估',
        }));
      } else if (result.source === 'smart_search') {
        organizedResults.web_sources = result.results.map((item: any) => ({
          title: item.name || '',
          site_name: item.siteName || '',
          snippet: item.snippet || '',
          url: item.url || '',
          last_crawled_at: item.dateLastCrawled || '',
          why_relevant: '待评估',
        }));
      } else if (result.source === 'user_library') {
        organizedResults.user_library_sources = result.results.map((item: any) => ({
          id: item.id,
          title: item.title || '',
          content: item.content || '',
          url: item.url || '',
          relevance_level: '待评估',
        }));
      } else if (result.source === 'personal_materials') {
        organizedResults.personal_sources = result.results.map((item: any) => ({
          id: item.id,
          title: item.title || '',
          content: item.content || '',
          relevance_level: '待评估',
        }));
      }
    }

    return new Response(JSON.stringify(organizedResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Research Retrieval Agent Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '检索失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
