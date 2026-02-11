/**
 * 信封模式解析模块
 * 处理LLM输出的信封格式：{ meta: {...}, payload: "..." }
 */

import { normalizeLLMOutput, extractFirstJsonBlock } from './normalize.ts';

/**
 * 信封结构接口
 */
export interface Envelope {
  meta: Record<string, any>;
  payload: string;
}

/**
 * 解析信封格式JSON - 三层防护策略
 * Layer 1: 提取第一个JSON块（防止前后污染）
 * Layer 2: 字符归一化清洗（处理中文标点）
 * Layer 3: 两步解析（外层信封 + 内层payload）
 * 
 * @param rawText - LLM原始输出文本
 * @returns 解析后的payload内容
 * @throws 解析失败时抛出错误
 */
export function parseEnvelope(rawText: string): any {
  console.log('[parseEnvelope] 原始文本长度:', rawText.length);
  console.log('[parseEnvelope] 原始文本前300字符:', rawText.substring(0, 300));
  
  try {
    // Step 1: 提取第一个JSON块
    const extracted = extractFirstJsonBlock(rawText);
    console.log('[parseEnvelope] 提取后长度:', extracted.length);
    
    // Step 2: 字符归一化清洗
    const normalized = normalizeLLMOutput(extracted);
    console.log('[parseEnvelope] 归一化完成');
    
    // Step 3: 解析外层信封
    const envelope = JSON.parse(normalized) as Envelope;
    console.log('[parseEnvelope] 外层信封解析成功, meta:', envelope.meta);
    
    // Step 4: 验证信封结构
    if (!envelope.meta || typeof envelope.payload !== 'string') {
      throw new Error('信封格式无效: 缺少 meta 或 payload 不是字符串');
    }
    
    // Step 5: 归一化并解析 payload 字符串
    if (!envelope.payload || envelope.payload.trim() === '') {
      console.warn('[parseEnvelope] payload 为空');
      return null;
    }
    
    const payloadNormalized = normalizeLLMOutput(envelope.payload);
    const content = JSON.parse(payloadNormalized);
    console.log('[parseEnvelope] payload 解析成功');
    
    return content;
  } catch (error) {
    console.error('[parseEnvelope] 解析失败:', error);
    console.error('[parseEnvelope] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`信封JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析payload字符串
 * @param payload - payload字符串
 * @returns 解析后的对象
 */
export function parsePayload(payload: string): any {
  try {
    const normalized = normalizeLLMOutput(payload);
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(`Payload解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
