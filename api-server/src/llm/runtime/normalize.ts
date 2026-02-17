export function normalizeLLMOutput(raw: string): string {
  return raw
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\uFEFF/g, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

export function extractFirstJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('未找到JSON对象');
  }
  return match[0];
}
