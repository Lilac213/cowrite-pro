import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 字符归一化清洗 - 将中文标点符号转换为英文标点
 */
function normalizeJsonString(raw: string): string {
  return raw
    .replace(/[""]/g, '"')      // 中文双引号 → 英文双引号
    .replace(/['']/g, "'")      // 中文单引号 → 英文单引号
    .replace(/：/g, ':')        // 中文冒号 → 英文冒号
    .replace(/，/g, ',')        // 中文逗号 → 英文逗号
    .replace(/（/g, '(')        // 中文左括号 → 英文左括号
    .replace(/）/g, ')')        // 中文右括号 → 英文右括号
    .replace(/\u00A0/g, ' ')    // 不可见空格 → 普通空格
    .replace(/\u200B/g, '')     // 零宽字符 → 删除
    .replace(/\uFEFF/g, '');    // BOM字符 → 删除
}

/**
 * 提取第一个JSON对象 - 防止前后文本污染
 */
function extractFirstJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('未找到JSON对象');
  }
  return match[0];
}

/**
 * 解析信封模式JSON - 三层防护策略
 */
function parseEnvelopeJson(rawText: string): any {
  console.log('[parseEnvelope] 原始文本长度:', rawText.length);
  
  try {
    // Step 1: 提取第一个JSON块
    const extracted = extractFirstJsonBlock(rawText);
    
    // Step 2: 字符归一化清洗
    const normalized = normalizeJsonString(extracted);
    
    // Step 3: 解析外层信封
    const envelope = JSON.parse(normalized);
    console.log('[parseEnvelope] 外层信封解析成功, type:', envelope.type);
    
    // Step 4: 验证信封结构
    if (!envelope.type || typeof envelope.payload !== 'string') {
      throw new Error('信封格式无效: 缺少 type 或 payload 不是字符串');
    }
    
    // Step 5: 归一化并解析 payload 字符串
    if (!envelope.payload || envelope.payload.trim() === '') {
      console.warn('[parseEnvelope] payload 为空');
      return null;
    }
    
    const payloadNormalized = normalizeJsonString(envelope.payload);
    const content = JSON.parse(payloadNormalized);
    console.log('[parseEnvelope] payload 解析成功');
    
    return content;
  } catch (error) {
    console.error('[parseEnvelope] 解析失败:', error);
    console.error('[parseEnvelope] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`信封JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
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

【输出要求 - 信封模式】
你必须严格输出一个固定结构的JSON对象, 且只能包含以下两个字段:
- type: 固定值 "verify_coherence"
- payload: 字符串类型, 内容是连贯性检查结果JSON的字符串形式

重要规则:
1. 外层JSON必须始终合法, 只有type和payload两个字段
2. payload是字符串, 不是JSON对象, 需要将内部JSON转换为字符串
3. 不要在外层JSON之外输出任何文字
4. 不要使用markdown代码块
5. 如果无法生成内容, payload可以是空字符串
6. 禁止使用中文标点符号（""''：，等），必须使用英文标点符号
7. 所有字符串必须使用英文双引号 "

输出格式示例:
{
  "type": "verify_coherence",
  "payload": "{\"coherence_check\":[],\"overall_assessment\":\"示例\"}"
}

payload字符串内部应包含的结构:
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
      result = parseEnvelopeJson(fullText);
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
