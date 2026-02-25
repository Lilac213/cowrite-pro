import { runLLMAgent } from '../runtime/LLMRuntime.js';

interface LiveSuggestionInput {
  text: string;
}

interface LiveSuggestionIssue {
  type: 'grammar' | 'clarity' | 'structure' | 'logic' | 'argument';
  severity: 'low' | 'medium' | 'high';
  target_text: string;
  suggestion_text: string;
  suggested_fix: string;
}

interface LiveSuggestionResult {
  issues: LiveSuggestionIssue[];
}

export async function runLiveSuggestionAgent(input: LiveSuggestionInput): Promise<LiveSuggestionResult> {
  const prompt = `
你是 Live Suggestion Agent，只负责句子级问题。
输出必须为合法 JSON，不要输出解释性文本，不要输出 Markdown。
最多返回 2 条 issue。
suggested_fix 必须可直接替换 target_text。
不得扩展原句超过 20%。
未发现问题返回 {"issues": []}。

输入文本：
${input.text}

输出格式：
{
  "issues": [
    {
      "type": "",
      "severity": "",
      "target_text": "",
      "suggestion_text": "",
      "suggested_fix": ""
    }
  ]
}
`;

  const result = await runLLMAgent<LiveSuggestionResult>({
    agentName: 'live-suggestion-agent',
    prompt,
    temperature: 0.3,
    maxTokens: 300,
    responseFormat: { type: 'json_object' }
  });

  return result.data;
}
