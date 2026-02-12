/**
 * 双重LLM调用模块
 * 先尝试 Gemini，失败后回退到 Qwen
 */

import { LLMCallConfig } from './callLLM.ts';

/**
 * 调用 Gemini API
 */
async function callGemini(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'gemini-2.0-flash-exp',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY') || Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Gemini API密钥未配置');
  }

  console.log('[callGemini] 调用模型:', model);
  console.log('[callGemini] Temperature:', temperature);
  console.log('[callGemini] Prompt长度:', prompt.length);

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
    console.error('[callGemini] API调用失败:', response.status, response.statusText);
    console.error('[callGemini] 错误详情:', errorText);
    throw new Error(`Gemini API调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini未返回有效响应');
  }

  const text = data.candidates[0].content.parts[0].text;
  console.log('[callGemini] 响应长度:', text.length);

  return text;
}

/**
 * 调用 Qwen API
 */
async function callQwen(config: LLMCallConfig): Promise<string> {
  const {
    prompt,
    model = 'qwen-plus',
    temperature = 0.3,
    maxTokens = 8192,
  } = config;

  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
  if (!apiKey) {
    throw new Error('Qwen API密钥未配置');
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
 * 双重LLM调用：先尝试 Gemini，失败后回退到 Qwen
 * @param config - 调用配置
 * @returns LLM响应文本
 */
export async function callLLMWithFallback(config: LLMCallConfig): Promise<string> {
  console.log('[callLLMWithFallback] 开始双重LLM调用');
  
  // 第一次尝试：Gemini
  try {
    console.log('[callLLMWithFallback] 尝试 Gemini...');
    const result = await callGemini(config);
    console.log('[callLLMWithFallback] ✅ Gemini 调用成功');
    return result;
  } catch (geminiError) {
    console.warn('[callLLMWithFallback] ⚠️ Gemini 调用失败:', geminiError);
    console.log('[callLLMWithFallback] 回退到 Qwen...');
    
    // 第二次尝试：Qwen
    try {
      const result = await callQwen(config);
      console.log('[callLLMWithFallback] ✅ Qwen 调用成功（回退）');
      return result;
    } catch (qwenError) {
      console.error('[callLLMWithFallback] ❌ Qwen 调用也失败:', qwenError);
      
      // 两个都失败，抛出综合错误
      throw new Error(
        `双重LLM调用失败 - Gemini: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}, ` +
        `Qwen: ${qwenError instanceof Error ? qwenError.message : String(qwenError)}`
      );
    }
  }
}
