export interface LLMCallConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

async function callGemini(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = '[C渠道][1额度/次]gemini-2.5-flash',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.INTEGRATIONS_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('Gemini 中转站未配置 (OPENAI_BASE_URL 或 INTEGRATIONS_API_KEY)');
  }

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
    throw new Error(`Gemini API调用失败: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Gemini未返回有效响应');
  }

  return data.choices[0].message.content;
}

async function callQwen(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'qwen-plus',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const apiKey = process.env.QIANWEN_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error('Qwen API密钥未配置 (QIANWEN_API_KEY)');
  }

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
    throw new Error(`Qwen API调用失败: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Qwen未返回有效响应');
  }

  return data.choices[0].message.content;
}

export async function callLLMWithFallback(config: LLMCallConfig): Promise<string> {
  let geminiError: Error | null = null;
  let qwenError: Error | null = null;

  try {
    return await callGemini(config);
  } catch (error) {
    geminiError = error instanceof Error ? error : new Error(String(error));
  }

  try {
    return await callQwen(config);
  } catch (error) {
    qwenError = error instanceof Error ? error : new Error(String(error));
  }

  const errorMessage = `双重LLM调用失败 - Gemini: ${geminiError?.message || '未知错误'}, Qwen: ${qwenError?.message || '未知错误'}`;
  throw new Error(errorMessage);
}
