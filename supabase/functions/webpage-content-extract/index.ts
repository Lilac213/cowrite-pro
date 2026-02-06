import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractRequest {
  url: string;
  fields?: string;
}

interface ExtractResponse {
  success: boolean;
  content_status: 'full_text' | 'abstract_only' | 'insufficient_content' | 'unavailable_fulltext';
  title?: string;
  text?: string;
  extracted_content?: string[];
  author?: string;
  date?: string;
  error?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, fields }: ExtractRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ 
          success: false,
          content_status: 'unavailable_fulltext',
          error: '缺少 URL 参数' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const integrationsApiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!integrationsApiKey) {
      throw new Error('INTEGRATIONS_API_KEY 未配置');
    }

    console.log(`[Webpage Extract] 开始提取: ${url}`);

    // 调用 Webpage Content Extract API
    const apiUrl = `https://app-9bwpferlujnl-api-Q9KWZ8R7Qv09.gateway.appmedo.com/v3/article?url=${encodeURIComponent(url)}${fields ? `&fields=${fields}` : ''}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Gateway-Authorization': `Bearer ${integrationsApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Webpage Extract] API 请求失败: ${response.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          content_status: 'unavailable_fulltext',
          error: `API 请求失败: ${response.status}`,
          notes: '无法访问该 URL 或内容受保护'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[Webpage Extract] API 响应结构:`, Object.keys(data));

    // 提取文章内容
    const article = data.objects?.[0];
    if (!article) {
      console.error(`[Webpage Extract] 未找到文章对象`);
      return new Response(
        JSON.stringify({
          success: false,
          content_status: 'unavailable_fulltext',
          error: '未找到文章内容',
          notes: '页面可能不包含可提取的文章内容'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const title = article.title || '无标题';
    const text = article.text || '';
    const html = article.html || '';
    const author = article.author || article.authors?.[0]?.name || '';
    const date = article.date || '';

    console.log(`[Webpage Extract] 提取结果 - 标题: ${title}, 文本长度: ${text.length}`);

    // 判断内容状态
    let content_status: 'full_text' | 'abstract_only' | 'insufficient_content' | 'unavailable_fulltext';
    let notes = '';

    if (text.length < 100) {
      content_status = 'unavailable_fulltext';
      notes = '内容过短，可能是付费墙或访问受限';
    } else if (text.length < 300) {
      content_status = 'insufficient_content';
      notes = '内容较短，可能只是摘要或简介';
    } else if (text.length < 1000) {
      content_status = 'abstract_only';
      notes = '内容长度中等，可能是摘要或部分内容';
    } else {
      content_status = 'full_text';
      notes = '成功提取完整文本';
    }

    // 提取 3-8 个核心段落
    const extracted_content: string[] = [];
    if (text.length > 0) {
      // 按句号、问号、感叹号分割段落
      const sentences = text
        .split(/[。！？\n\r]+/)
        .map(s => s.trim())
        .filter(s => s.length > 20); // 过滤掉太短的句子

      // 每 2-3 句组成一个段落
      const paragraphSize = Math.ceil(sentences.length / 6); // 目标 6 个段落
      for (let i = 0; i < sentences.length; i += paragraphSize) {
        const paragraph = sentences.slice(i, i + paragraphSize).join('。');
        if (paragraph.length > 30) {
          extracted_content.push(paragraph);
        }
        if (extracted_content.length >= 8) break; // 最多 8 个段落
      }

      // 如果段落太少，直接按长度分割
      if (extracted_content.length < 3 && text.length > 300) {
        const chunkSize = Math.ceil(text.length / 5);
        for (let i = 0; i < text.length && extracted_content.length < 5; i += chunkSize) {
          const chunk = text.substring(i, i + chunkSize).trim();
          if (chunk.length > 50) {
            extracted_content.push(chunk);
          }
        }
      }
    }

    console.log(`[Webpage Extract] 提取段落数: ${extracted_content.length}, 状态: ${content_status}`);

    const result: ExtractResponse = {
      success: true,
      content_status,
      title,
      text,
      extracted_content,
      author,
      date,
      notes
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Webpage Extract] 错误:', error);
    return new Response(
      JSON.stringify({
        success: false,
        content_status: 'unavailable_fulltext',
        error: error.message || '提取失败',
        notes: '服务器内部错误'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
