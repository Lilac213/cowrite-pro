/**
 * 信封模式解析模块
 * 处理LLM输出的信封格式：{ meta: {...}, payload: "..." }
 */

import { normalizeLLMOutput, extractFirstJsonBlock } from './normalize.ts';
import { repairJSONWithLLM, isSameShape } from '../agents/repairJSONAgent.ts';

/**
 * 信封结构接口
 */
export interface Envelope {
  meta: Record<string, any>;
  payload: string;
}

/**
 * 解析信封格式JSON - 三层防护策略 + JSON修复
 * Layer 1: 提取第一个JSON块（防止前后污染）
 * Layer 2: 字符归一化清洗（处理中文标点）
 * Layer 3: 两步解析（外层信封 + 内层payload）
 * Layer 4: JSON修复（如果解析失败，使用LLM修复）
 * 
 * @param rawText - LLM原始输出文本
 * @returns 解析后的payload内容
 * @throws 解析失败时抛出错误
 */
export async function parseEnvelope(rawText: string): Promise<any> {
  console.log('[parseEnvelope] 原始文本长度:', rawText.length);
  console.log('[parseEnvelope] 原始文本前300字符:', rawText.substring(0, 300));
  
  try {
    // Step 1: 提取第一个JSON块
    const extracted = extractFirstJsonBlock(rawText);
    console.log('[parseEnvelope] 提取后长度:', extracted.length);
    
    // Step 2: 字符归一化清洗
    const normalized = normalizeLLMOutput(extracted);
    console.log('[parseEnvelope] 归一化完成');
    
    // Step 3: 解析外层信封（带修复）
    let envelope: Envelope;
    try {
      envelope = JSON.parse(normalized) as Envelope;
      console.log('[parseEnvelope] 外层信封解析成功, meta:', envelope.meta);
    } catch (envelopeError) {
      console.warn('[parseEnvelope] 外层信封解析失败，尝试修复...');
      const repairedEnvelope = await repairJSONWithLLM(normalized);
      envelope = JSON.parse(repairedEnvelope) as Envelope;
      console.log('[parseEnvelope] ✅ 外层信封修复成功');
    }
    
    // Step 4: 验证信封结构
    if (!envelope.meta || typeof envelope.payload !== 'string') {
      throw new Error('信封格式无效: 缺少 meta 或 payload 不是字符串');
    }
    
    // Step 5: 归一化并解析 payload 字符串（带修复）
    if (!envelope.payload || envelope.payload.trim() === '') {
      console.warn('[parseEnvelope] payload 为空');
      return null;
    }
    
    const payloadNormalized = normalizeLLMOutput(envelope.payload);
    let content: any;
    let originalContent: any;
    
    try {
      content = JSON.parse(payloadNormalized);
      console.log('[parseEnvelope] payload 解析成功');
    } catch (payloadError) {
      console.warn('[parseEnvelope] payload 解析失败，尝试修复...');
      const repairedPayload = await repairJSONWithLLM(payloadNormalized);
      
      // 先尝试解析原始的（用于结构对比）
      try {
        originalContent = JSON.parse(payloadNormalized);
      } catch {
        // 原始无法解析，跳过结构检查
        originalContent = null;
      }
      
      content = JSON.parse(repairedPayload);
      console.log('[parseEnvelope] ✅ payload 修复成功');
      
      // 验证修复后的结构是否一致
      if (originalContent && !isSameShape(originalContent, content)) {
        console.error('[parseEnvelope] ⚠️ 警告: 修复后的结构与原始不一致');
        // 不抛出错误，只记录警告，因为原始本身就无法解析
      }
    }
    
    return content;
  } catch (error) {
    console.error('[parseEnvelope] 解析失败:', error);
    console.error('[parseEnvelope] 失败时的原始文本前500字符:', rawText.substring(0, 500));
    throw new Error(`信封JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析payload字符串（带修复）
 * @param payload - payload字符串
 * @returns 解析后的对象
 */
export async function parsePayload(payload: string): Promise<any> {
  try {
    const normalized = normalizeLLMOutput(payload);
    try {
      return JSON.parse(normalized);
    } catch (parseError) {
      console.warn('[parsePayload] 解析失败，尝试修复...');
      const repaired = await repairJSONWithLLM(normalized);
      return JSON.parse(repaired);
    }
  } catch (error) {
    throw new Error(`Payload解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
