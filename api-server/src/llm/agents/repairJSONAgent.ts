import { callLLMWithFallback } from '../runtime/callLLMWithFallback.js';

export async function repairJSONWithLLM(brokenJson: string): Promise<string> {
  const maxInputLength = 50000;
  let inputText = brokenJson;

  if (brokenJson.length > maxInputLength) {
    inputText = brokenJson.substring(0, maxInputLength);
  }

  const systemPrompt = `你是 CoWrite 系统的 JSON 修复 Agent。

你的唯一任务是：
将"格式错误的 JSON 文本"修复为"100% 合法、可被 JSON.parse() 解析的 JSON"。

你不能：
- 改写业务内容
- 增删字段
- 推测缺失语义
- 总结或解释
- 添加任何额外说明文字

你必须：
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

  const repairedText = await callLLMWithFallback({
    prompt: fullPrompt,
    model: 'gemini-2.5-flash',
    temperature: 0,
    maxTokens: 8192,
  });

  let cleaned = repairedText.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  cleaned = cleaned.trim();
  JSON.parse(cleaned);
  return cleaned;
}

export function isSameShape(original: any, repaired: any): boolean {
  if (typeof original !== typeof repaired) {
    return false;
  }

  if (typeof original !== 'object' || original === null || repaired === null) {
    return true;
  }

  if (Array.isArray(original) && Array.isArray(repaired)) {
    if (original.length > 0 && repaired.length > 0) {
      return isSameShape(original[0], repaired[0]);
    }
    return true;
  }

  const originalKeys = Object.keys(original).sort();
  const repairedKeys = Object.keys(repaired).sort();

  if (originalKeys.length !== repairedKeys.length) {
    return false;
  }

  for (let i = 0; i < originalKeys.length; i++) {
    if (originalKeys[i] !== repairedKeys[i]) {
      return false;
    }
  }

  return true;
}
