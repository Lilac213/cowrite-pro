import { runLLMAgent } from '../runtime/LLMRuntime.js';

interface DecisionGuideInput {
  text: string;
  issues: Array<{
    type: string;
    severity: string;
    suggestion_text: string;
  }>;
  mode?: 'normal' | 'auto_fix';
}

interface DecisionGuideResult {
  summary: string;
  options: Array<{ type: 'auto_fix' | 'multi_version' | 'manual_edit' }>;
  auto_fix_result?: {
    rewritten_text: string;
  };
}

export async function runDecisionGuideAgent(input: DecisionGuideInput): Promise<DecisionGuideResult> {
  const mode = input.mode || 'normal';
  const prompt = `
你是 Decision Guide Agent，负责整合多个 issue 并给出决策选项。
输出必须为合法 JSON，不要输出解释性文本，不要输出 Markdown。
未发现问题返回 {"summary":"","options":[] }。
只有在 mode=auto_fix 时才输出 auto_fix_result。

输入文本：
${input.text}

Issues:
${input.issues.map((issue, index) => `${index + 1}. ${issue.type} | ${issue.severity} | ${issue.suggestion_text}`).join('\n')}

输出格式：
{
  "summary": "",
  "options": [
    { "type": "auto_fix" },
    { "type": "multi_version" },
    { "type": "manual_edit" }
  ],
  "auto_fix_result": {
    "rewritten_text": ""
  }
}
`;

  const result = await runLLMAgent<DecisionGuideResult>({
    agentName: 'decision-guide-agent',
    prompt,
    temperature: 0.5,
    maxTokens: mode === 'auto_fix' ? 1200 : 400,
    responseFormat: { type: 'json_object' }
  });

  return result.data;
}
