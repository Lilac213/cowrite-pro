/**
 * 双重LLM调用模块
 * 先尝试 Gemini（通过中转站），失败后回退到 Qwen
 */

export interface LLMCallConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 调用 Gemini（通过中转站 OpenAI 兼容 API）
 */
async function callGemini(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'gemini-2.5-flash',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const baseUrl = Deno.env.get('OPENAI_BASE_URL');
  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
  
  if (!baseUrl || !apiKey) {
    throw new Error('Gemini 中转站未配置 (OPENAI_BASE_URL 或 INTEGRATIONS_API_KEY)');
  }

  console.log('[callGemini] 使用中转站:', baseUrl);
  console.log('[callGemini] 调用模型:', model);
  console.log('[callGemini] Temperature:', temperature);
  console.log('[callGemini] Prompt长度:', prompt.length);

  const normalizedBaseUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callGemini] API调用失败:', response.status, response.statusText);
    console.error('[callGemini] 错误详情:', errorText);
    throw new Error(`Gemini API调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('Gemini未返回有效响应');
  }

  const text = data.choices[0].message.content;
  console.log('[callGemini] 响应长度:', text.length);

  return text;
}

/**
 * 调用 Qwen API（阿里云 DashScope）
 */
async function callQwen(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'qwen-plus',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const apiKey = Deno.env.get('QIANWEN_API_KEY') || Deno.env.get('QWEN_API_KEY');
  if (!apiKey) {
    throw new Error('Qwen API密钥未配置 (QIANWEN_API_KEY)');
  }

  console.log('[callQwen] 调用模型:', model);
  console.log('[callQwen] Temperature:', temperature);
  console.log('[callQwen] Prompt长度:', prompt.length);

  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callQwen] API调用失败:', response.status, response.statusText);
    console.error('[callQwen] 错误详情:', errorText);
    throw new Error(`Qwen API调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('Qwen未返回有效响应');
  }

  const text = data.choices[0].message.content;
  console.log('[callQwen] 响应长度:', text.length);

  return text;
}

/**
 * 双重LLM调用：先尝试 Gemini（中转站），失败后回退到 Qwen
 */
export async function callLLMWithFallback(config: LLMCallConfig): Promise<string> {
  console.log('[callLLMWithFallback] 开始双重LLM调用');
  
  let geminiError: Error | null = null;
  let qwenError: Error | null = null;
  
  // 第一次尝试：Gemini（中转站）
  try {
    console.log('[callLLMWithFallback] 尝试 Gemini（中转站）...');
    const result = await callGemini(config);
    console.log('[callLLMWithFallback] ✅ Gemini 调用成功');
    return result;
  } catch (error) {
    geminiError = error instanceof Error ? error : new Error(String(error));
    console.warn('[callLLMWithFallback] ⚠️ Gemini 调用失败:', geminiError.message);
    console.log('[callLLMWithFallback] 回退到 Qwen...');
  }
  
  // 第二次尝试：Qwen
  try {
    const result = await callQwen(config);
    console.log('[callLLMWithFallback] ✅ Qwen 调用成功（回退）');
    return result;
  } catch (error) {
    qwenError = error instanceof Error ? error : new Error(String(error));
    console.error('[callLLMWithFallback] ❌ Qwen 调用也失败:', qwenError.message);
  }
  
  // 两个都失败，抛出综合错误
  const errorMessage = `双重LLM调用失败 - Gemini: ${geminiError?.message || '未知错误'}, Qwen: ${qwenError?.message || '未知错误'}`;
  console.error('[callLLMWithFallback] ❌ 最终错误:', errorMessage);
  
  throw new Error(errorMessage);
}
