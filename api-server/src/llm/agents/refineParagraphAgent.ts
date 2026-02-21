import { runLLMAgent } from '../runtime/LLMRuntime.js';

interface RefineParagraphInput {
  paragraph_content: string;
  instruction: string;
  context?: string;
}

interface RefineParagraphResult {
  refined_content: string;
  explanation: string;
}

export async function runRefineParagraphAgent(input: RefineParagraphInput): Promise<RefineParagraphResult> {
  const { paragraph_content, instruction, context } = input;

  const prompt = `
You are an expert academic writing coach and editor. 
Your task is to refine a specific paragraph of an academic paper based on the user's instructions.

**Guidelines:**
1. Maintain the academic tone and style.
2. Directly address the user's instruction (e.g., "make it more formal", "expand on X", "shorten it").
3. Ensure the refined content fits seamlessly into the context (if provided).
4. Do NOT remove citations like (见资料X) unless explicitly asked.
5. Return the result in strict JSON format with two fields:
   - "refined_content": The rewritten paragraph text.
   - "explanation": A brief explanation of what you changed and why (in Chinese).

**Input:**
Paragraph:
${paragraph_content}

Context:
${context || "No specific context provided."}

Instruction:
${instruction}

**Output JSON:**
{
  "refined_content": "...",
  "explanation": "..."
}
`;

  try {
    const result = await runLLMAgent<RefineParagraphResult>({
      agentName: 'refine-paragraph-agent',
      prompt: prompt,
      model: 'gpt-4o', // or use default config if handled in runtime
      temperature: 0.7,
      schema: {
        validate: (data: any) => 
          typeof data.refined_content === 'string' && 
          typeof data.explanation === 'string'
      }
    });

    return result.data;
  } catch (error) {
    console.error("RefineParagraphAgent error:", error);
    // Fallback if agent fails
    return {
      refined_content: paragraph_content,
      explanation: "AI 处理失败，请重试。"
    };
  }
}
