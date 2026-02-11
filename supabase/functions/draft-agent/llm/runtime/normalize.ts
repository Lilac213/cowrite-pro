/**
 * 字符归一化清洗模块
 * 将LLM输出中的中文标点符号转换为英文标点，清除不可见字符
 * 这是防止JSON解析失败的第一道防线
 */

/**
 * 归一化LLM输出文本
 * @param raw - LLM原始输出文本
 * @returns 清洗后的文本
 */
export function normalizeLLMOutput(raw: string): string {
  return raw
    .replace(/[""]/g, '"')      // 中文双引号 → 英文双引号
    .replace(/['']/g, "'")      // 中文单引号 → 英文单引号
    .replace(/：/g, ':')        // 中文冒号 → 英文冒号
    .replace(/，/g, ',')        // 中文逗号 → 英文逗号
    .replace(/（/g, '(')        // 中文左括号 → 英文左括号
    .replace(/）/g, ')')        // 中文右括号 → 英文右括号
    .replace(/\u00A0/g, ' ')    // 不可见空格 → 普通空格
    .replace(/\u200B/g, '')     // 零宽字符 → 删除
    .replace(/\uFEFF/g, '')     // BOM字符 → 删除
    .replace(/```json/gi, '')   // 移除markdown代码块标记
    .replace(/```/g, '')        // 移除markdown代码块标记
    .trim();                    // 移除首尾空白
}

/**
 * 提取第一个JSON对象
 * 使用正则匹配第一个完整的 { ... } 块，防止前后文本污染
 * @param text - 待提取的文本
 * @returns 提取的JSON字符串
 * @throws 如果未找到JSON对象
 */
export function extractFirstJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('未找到JSON对象');
  }
  return match[0];
}
