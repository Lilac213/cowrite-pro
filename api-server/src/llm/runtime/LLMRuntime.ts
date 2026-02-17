import { callLLMWithFallback, type LLMCallConfig } from './callLLMWithFallback';
import { parseEnvelope } from './parseEnvelope';
import { normalizeLLMOutput } from './normalize';
import { validateOrThrow } from './validateSchema';

export interface AgentRunConfig {
  agentName: string;
  prompt: string;
  schema?: {
    required?: string[];
    optional?: string[];
    validate?: (data: any) => boolean;
    defaults?: Record<string, any>;
  };
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentRunResult<T = any> {
  agent: string;
  data: T;
  rawOutput?: string;
}

export interface RawLLMRunConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  parseEnvelope?: boolean;
}

export interface RawLLMRunResult {
  rawOutput: string;
  normalized: string;
  parsed?: any;
  parseError?: string;
}

export async function runLLMAgent<T = any>(
  config: AgentRunConfig
): Promise<AgentRunResult<T>> {
  try {
    const rawOutput = await callLLMWithFallback({
      prompt: config.prompt,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    } as LLMCallConfig);

    const parsedData = await parseEnvelope(rawOutput);

    let validatedData: T;
    if (config.schema) {
      validatedData = validateOrThrow<T>(parsedData, config.schema);
    } else {
      validatedData = parsedData as T;
    }

    return {
      agent: config.agentName,
      data: validatedData,
      rawOutput,
    };
  } catch (error) {
    throw new Error(
      `Agent ${config.agentName} 运行失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function runLLMRaw(
  config: RawLLMRunConfig
): Promise<RawLLMRunResult> {
  const rawOutput = await callLLMWithFallback({
    prompt: config.prompt,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  } as LLMCallConfig);

  const normalized = normalizeLLMOutput(rawOutput);
  let parsed: any;
  let parseError: string | undefined;

  if (config.parseEnvelope !== false && /\{[\s\S]*\}/.test(rawOutput)) {
    try {
      parsed = await parseEnvelope(rawOutput);
    } catch (error) {
      parsed = undefined;
      parseError = error instanceof Error ? error.message : String(error);
    }
  }

  return { rawOutput, normalized, parsed, parseError };
}

export async function runLLMAgentsBatch(
  configs: AgentRunConfig[]
): Promise<AgentRunResult[]> {
  const results = await Promise.allSettled(
    configs.map(config => runLLMAgent(config))
  );

  const successResults: AgentRunResult[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    } else {
      errors.push(`Agent ${configs[index].agentName} 失败: ${result.reason}`);
    }
  });

  if (errors.length > 0) {
    return successResults;
  }

  return successResults;
}
