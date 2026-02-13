/**
 * LLM调用模块
 * 支持多种LLM API：
 * 1. Google Gemini 原生 API
 * 2. OpenAI 兼容 API（如 New API、One API 等中转站）
 */

/**
 * LLM调用配置
 */
export interface LLMCallConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 调用LLM API
 * @param config - 调用配置
 * @returns LLM响应文本
 */
export async function callLLM(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'gemini-2.5-flash',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  // 检查是否使用 OpenAI 兼容 API（New API / One API 等中转站）
  const openaiBaseUrl = Deno.env.get('OPENAI_BASE_URL');
  const openaiApiKey = Deno.env.get('INTEGRATIONS_API_KEY') || Deno.env.get('OPENAI_API_KEY');
  
  // 如果配置了 OPENAI_BASE_URL，使用 OpenAI 兼容 API
  if (openaiBaseUrl && openaiApiKey) {
    return await callOpenAICompatible({
      baseUrl: openaiBaseUrl,
      apiKey: openaiApiKey,
      prompt,
      model,
      temperature,
      maxTokens,
    });
  }

  // 否则使用原生 Gemini API
  const geminiApiKey = Deno.env.get('INTEGRATIONS_API_KEY') || Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('API密钥未配置。请设置以下环境变量之一：\n' +
      '1. OPENAI_BASE_URL + INTEGRATIONS_API_KEY（使用中转站）\n' +
      '2. INTEGRATIONS_API_KEY 或 GEMINI_API_KEY（使用原生 Gemini API）');
  }

  return await callGeminiNative({
    apiKey: geminiApiKey,
    prompt,
    model,
    temperature,
    maxTokens,
  });
}

/**
 * 调用 OpenAI 兼容 API（New API / One API 等中转站）
 */
async function callOpenAICompatible(params: {
  baseUrl: string;
  apiKey: string;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const { baseUrl, apiKey, prompt, model, temperature, maxTokens } = params;

  console.log('[callLLM] 使用 OpenAI 兼容 API');
  console.log('[callLLM] Base URL:', baseUrl);
  console.log('[callLLM] 调用模型:', model);
  console.log('[callLLM] Temperature:', temperature);
  console.log('[callLLM] Prompt长度:', prompt.length);

  // 确保 base URL 格式正确
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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callLLM] API调用失败:', response.status, response.statusText);
    console.error('[callLLM] 错误详情:', errorText);
    console.error('[callLLM] Prompt长度:', prompt.length);
    console.error('[callLLM] Prompt前500字符:', prompt.substring(0, 500));
    throw new Error(`LLM API调用失败: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('LLM未返回有效响应');
  }

  const text = data.choices[0].message.content;
  console.log('[callLLM] 响应长度:', text.length);

  return text;
}

/**
 * 调用原生 Gemini API
 */
async function callGeminiNative(params: {
  apiKey: string;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const { apiKey, prompt, model, temperature, maxTokens } = params;

  console.log('[callLLM] 使用原生 Gemini API');
  console.log('[callLLM] 调用模型:', model);
  console.log('[callLLM] Temperature:', temperature);
  console.log('[callLLM] Prompt长度:', prompt.length);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callLLM] API调用失败:', response.status, response.statusText);
    console.error('[callLLM] 错误详情:', errorText);
    console.error('[callLLM] Prompt长度:', prompt.length);
    console.error('[callLLM] Prompt前500字符:', prompt.substring(0, 500));
    throw new Error(`LLM API调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('LLM未返回有效响应');
  }

  const text = data.candidates[0].content.parts[0].text;
  console.log('[callLLM] 响应长度:', text.length);

  return text;
}
