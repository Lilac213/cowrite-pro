import { runLLMAgent } from '../runtime/LLMRuntime.js';

interface CoachInput {
  text: string;
  stage: 'draft' | 'argument' | 'refine';
}

interface CoachIssue {
  type: 'grammar' | 'clarity' | 'structure' | 'logic' | 'argument';
  severity: 'low' | 'medium' | 'high';
  target_scope: 'sentence' | 'paragraph' | 'document';
  suggestion_text: string;
  suggested_fix_template?: string;
}

interface CoachResult {
  stage: 'draft' | 'argument' | 'refine';
  issues: CoachIssue[];
}

export async function runCoachAgent(input: CoachInput): Promise<CoachResult> {
  const prompt = `
你是 Coach Agent，负责结构/逻辑/论证问题。
输出必须为合法 JSON，不要输出解释性文本，不要输出 Markdown。
最多返回 3 条 issue。
只给修改方向，不给完整改写。
未发现问题返回 {"stage":"${input.stage}","issues": []}。

输入文本：
${input.text}

输出格式：
{
  "stage": "draft | argument | refine",
  "issues": [
    {
      "type": "",
      "severity": "",
      "target_scope": "",
      "suggestion_text": "",
      "suggested_fix_template": ""
    }
  ]
}
`;

  const result = await runLLMAgent<CoachResult>({
    agentName: 'coach-agent',
    prompt,
    temperature: 0.4,
    maxTokens: 600,
    responseFormat: { type: 'json_object' }
  });

  return result.data;
}
