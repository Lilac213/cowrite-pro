/**
 * JSON 修复 Agent
 * 当 JSON 解析失败时，使用 LLM 修复格式错误
 * 使用双重LLM策略：先尝试 Gemini，失败后回退到 Qwen
 */

import { callLLMWithFallback } from '../runtime/callLLMWithFallback.ts';

/**
 * 使用 LLM 修复格式错误的 JSON
 * @param brokenJson - 格式错误的 JSON 文本
 * @returns 修复后的合法 JSON 字符串
 */
export async function repairJSONWithLLM(brokenJson: string): Promise<string> {
  console.log('[repairJSON] 开始修复 JSON，原始长度:', brokenJson.length);
  console.log('[repairJSON] 原始文本前500字符:', brokenJson.substring(0, 500));

  // 限制输入长度，避免 API 调用失败
  const MAX_INPUT_LENGTH = 50000; // 50KB
  let inputText = brokenJson;
  
  if (brokenJson.length > MAX_INPUT_LENGTH) {
    console.warn(`[repairJSON] 输入过长 (${brokenJson.length} 字符)，截断到 ${MAX_INPUT_LENGTH} 字符`);
    inputText = brokenJson.substring(0, MAX_INPUT_LENGTH);
  }

  const systemPrompt = `你是 CoWrite 系统的 JSON 修复 Agent。

你的唯一任务是：
将"格式错误的 JSON 文本"修复为"100% 合法、可被 JSON.parse() 解析的 JSON"。

⚠️ 你不能：
- 改写业务内容
- 增删字段
- 推测缺失语义
- 总结或解释
- 添加任何额外说明文字

⚠️ 你必须：
- 保留所有原始字段和值
- 只修复语法问题
- 保证输出是严格合法 JSON
- 只输出 JSON，不允许输出任何解释
- 如果输入不是 JSON，而是包含 JSON 的文本，请提取其中的 JSON 并修复

如果存在：
- 中文引号 → 改为英文引号
- 未转义换行 → 转义为 \\n
- 未转义引号 → 转义为 \\"
- 末尾多余逗号 → 删除
- 缺少引号 → 补全
- 缺少括号 → 补全
- 属性名未加引号 → 加引号
- 单引号字符串 → 改为双引号
- 多余 markdown 代码块 → 去除

输出必须满足：
- 标准 JSON 语法
- UTF-8
- 不包含 markdown
- 不包含 \`\`\`json
- 不包含解释性文字
- 不包含前后空白文本

修复后 JSON 的字段结构必须与原始结构完全一致。
字段数量不能增加或减少。

只输出修复后的 JSON。`;

  const userPrompt = `以下 JSON 存在语法错误，请修复：

====================
${inputText}
====================

请直接输出修复后的 JSON。
不要解释。
不要添加说明。
不要使用 markdown。`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  try {
    // 使用双重LLM策略：先尝试 Gemini，失败后回退到 Qwen
    const repairedText = await callLLMWithFallback({
      prompt: fullPrompt,
      model: 'gemini-2.0-flash-exp', // 首选模型
      temperature: 0, // 确定性修复，不要随机
      maxTokens: 8192,
    });

    console.log('[repairJSON] LLM 返回长度:', repairedText.length);
    console.log('[repairJSON] 返回文本前500字符:', repairedText.substring(0, 500));

    // 清理可能的 markdown 包裹
    let cleaned = repairedText.trim();
    
    // 移除 markdown 代码块
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    
    cleaned = cleaned.trim();

    // 验证修复后的 JSON 是否可解析
    try {
      JSON.parse(cleaned);
      console.log('[repairJSON] ✅ 修复成功，JSON 可解析');
      return cleaned;
    } catch (parseError) {
      console.error('[repairJSON] ❌ 修复后仍无法解析:', parseError);
      throw new Error(`JSON 修复失败: 修复后仍无法解析 - ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    console.error('[repairJSON] 修复过程出错:', error);
    throw new Error(`JSON 修复失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 检查两个 JSON 对象的结构是否一致
 * @param original - 原始对象
 * @param repaired - 修复后的对象
 * @returns 结构是否一致
 */
export function isSameShape(original: any, repaired: any): boolean {
  // 如果类型不同，返回 false
  if (typeof original !== typeof repaired) {
    return false;
  }

  // 如果是基本类型，认为一致
  if (typeof original !== 'object' || original === null || repaired === null) {
    return true;
  }

  // 如果是数组
  if (Array.isArray(original) && Array.isArray(repaired)) {
    // 数组长度可以不同，但如果都有元素，检查第一个元素的结构
    if (original.length > 0 && repaired.length > 0) {
      return isSameShape(original[0], repaired[0]);
    }
    return true;
  }

  // 如果是对象，检查关键字段
  const originalKeys = Object.keys(original).sort();
  const repairedKeys = Object.keys(repaired).sort();

  // 字段数量必须一致
  if (originalKeys.length !== repairedKeys.length) {
    console.warn('[isSameShape] 字段数量不一致:', originalKeys.length, 'vs', repairedKeys.length);
    return false;
  }

  // 字段名必须一致
  for (let i = 0; i < originalKeys.length; i++) {
    if (originalKeys[i] !== repairedKeys[i]) {
      console.warn('[isSameShape] 字段名不一致:', originalKeys[i], 'vs', repairedKeys[i]);
      return false;
    }
  }

  return true;
}
