/**
 * LLM调用模块
 * 统一处理与Google Gemini API的通信
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
    model = 'gemini-2.0-flash-exp',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  // 优先使用 INTEGRATIONS_API_KEY，回退到 GEMINI_API_KEY
  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY') || Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('API密钥未配置（需要 INTEGRATIONS_API_KEY 或 GEMINI_API_KEY）');
  }

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
    console.error('[callLLM] API调用失败:', errorText);
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
