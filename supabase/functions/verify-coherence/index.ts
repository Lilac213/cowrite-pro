import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 提取JSON对象 - 只保留第一个 { 到最后一个 } 之间的内容
 */
function extractJSONObject(rawText: string): string {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('未在LLM输出中找到JSON对象（缺少 { 或 }）');
  }
  
  if (lastBrace <= firstBrace) {
    throw new Error('JSON对象边界无效（} 在 { 之前）');
  }
  
  return rawText.slice(firstBrace, lastBrace + 1);
}

/**
 * 解析JSON - 先提取边界，再解析
 */
function parseJsonSafely(rawText: string): any {
  console.log('[parseJson] 原始文本长度:', rawText.length);
  
  try {
    // Step 1: 提取JSON对象边界
    const jsonText = extractJSONObject(rawText);
    console.log('[parseJson] 提取后长度:', jsonText.length);
    
    // Step 2: 解析JSON
    const result = JSON.parse(jsonText);
    console.log('[parseJson] 解析成功');
    return result;
  } catch (error) {
    console.error('[parseJson] 解析失败:', error);
    console.error('[parseJson] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coreThesis, paragraphs } = await req.json();

    if (!coreThesis || !paragraphs || !Array.isArray(paragraphs)) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建段落列表
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

【输出格式】
段落 X：
- 论证角色：
- 连贯性判断：通过 / 有问题
- 问题说明（如有）：
- 是否建议增加过渡：是 / 否

【约束】
- 不生成正文
- 不提出具体改写文本

请将输出转换为JSON格式返回：
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
}

重要提示：
1. 必须输出纯JSON, 不要包含markdown代码块
2. 所有字符串字段中禁止出现中文引号, 中文逗号, 中文冒号或任何全角标点符号
3. 确保JSON格式完全正确, 可以被JSON.parse()直接解析`;

    const response = await fetch('https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 读取流式响应
    const reader = response.body?.getReader();
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

    // 提取并解析JSON内容
    let result;
    try {
      result = parseJsonSafely(fullText);
    } catch (error) {
      console.error('[verify-coherence] JSON解析失败:', error);
      return new Response(
        JSON.stringify({ 
          error: `JSON解析失败: ${error instanceof Error ? error.message : String(error)}`,
          raw_output: fullText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result.coherence_check) {
      throw new Error('返回的结构缺少必要字段');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify coherence error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '校验失败，请重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
