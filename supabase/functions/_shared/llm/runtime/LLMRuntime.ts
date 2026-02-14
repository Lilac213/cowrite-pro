/**
 * LLM Runtime 统一入口
 * 整合所有LLM调用、解析、验证流程
 */

import { callLLMWithFallback, type LLMCallConfig } from './callLLMWithFallback.ts';
import { parseEnvelope } from './parseEnvelope.ts';
import { validateOrThrow } from './validateSchema.ts';

/**
 * Agent运行配置
 */
export interface AgentRunConfig {
  agentName: string;
  prompt: string;
  schema?: {
    required?: string[];
    optional?: string[];
    validate?: (data: any) => boolean;
  };
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Agent运行结果
 */
export interface AgentRunResult<T = any> {
  agent: string;
  data: T;
  rawOutput?: string;
}

/**
 * 统一LLM Agent运行入口
 * 
 * 执行流程：
 * 1. 调用LLM API
 * 2. 归一化输出
 * 3. 解析信封格式
 * 4. 解析payload
 * 5. Schema验证
 * 6. 返回结果
 * 
 * @param config - Agent运行配置
 * @returns Agent运行结果
 * @throws 任何步骤失败时抛出错误
 */
export async function runLLMAgent<T = any>(
  config: AgentRunConfig
): Promise<AgentRunResult<T>> {
  const startTime = Date.now();
  console.log(`[runLLMAgent] 开始运行 Agent: ${config.agentName}`);

  try {
    // Step 1: 调用LLM
    const rawOutput = await callLLMWithFallback({
      prompt: config.prompt,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Step 2-4: 解析信封格式（包含归一化、payload解析、JSON修复）
    const parsedData = await parseEnvelope(rawOutput);

    // Step 5: Schema验证（如果提供了schema）
    let validatedData: T;
    if (config.schema) {
      validatedData = validateOrThrow<T>(parsedData, config.schema);
      console.log(`[runLLMAgent] Schema验证通过`);
    } else {
      validatedData = parsedData as T;
    }

    const duration = Date.now() - startTime;
    console.log(`[runLLMAgent] Agent ${config.agentName} 运行成功，耗时: ${duration}ms`);

    return {
      agent: config.agentName,
      data: validatedData,
      rawOutput,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[runLLMAgent] Agent ${config.agentName} 运行失败，耗时: ${duration}ms`);
    console.error('[runLLMAgent] 错误详情:', error);
    throw new Error(
      `Agent ${config.agentName} 运行失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 批量运行多个Agent（并行）
 * @param configs - Agent配置数组
 * @returns Agent结果数组
 */
export async function runLLMAgentsBatch(
  configs: AgentRunConfig[]
): Promise<AgentRunResult[]> {
  console.log(`[runLLMAgentsBatch] 批量运行 ${configs.length} 个 Agents`);
  
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
    console.warn('[runLLMAgentsBatch] 部分Agent运行失败:', errors);
  }

  console.log(`[runLLMAgentsBatch] 成功: ${successResults.length}/${configs.length}`);
  
  return successResults;
}
