import { normalizeLLMOutput, extractFirstJsonBlock } from './normalize';
import { repairJSONWithLLM, isSameShape } from '../agents/repairJSONAgent';

export interface Envelope {
  meta: Record<string, any>;
  payload: string;
}

export async function parseEnvelope(rawText: string): Promise<any> {
  try {
    let extracted: string;
    try {
      extracted = extractFirstJsonBlock(rawText);
    } catch {
      const repaired = await repairJSONWithLLM(rawText);
      extracted = extractFirstJsonBlock(repaired);
    }

    const normalized = normalizeLLMOutput(extracted);

    let envelope: Envelope;
    try {
      envelope = JSON.parse(normalized) as Envelope;
    } catch {
      const repairedEnvelope = await repairJSONWithLLM(normalized);
      envelope = JSON.parse(repairedEnvelope) as Envelope;
    }

    if (envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)) {
      return envelope.payload;
    }

    if (!envelope.meta || typeof envelope.payload !== 'string') {
      return envelope;
    }

    if (!envelope.payload || envelope.payload.trim() === '') {
      return null;
    }

    const payloadNormalized = normalizeLLMOutput(envelope.payload);
    let content: any;
    let originalContent: any;

    try {
      content = JSON.parse(payloadNormalized);
    } catch {
      const repairedPayload = await repairJSONWithLLM(payloadNormalized);

      try {
        originalContent = JSON.parse(payloadNormalized);
      } catch {
        originalContent = null;
      }

      content = JSON.parse(repairedPayload);

      if (originalContent && !isSameShape(originalContent, content)) {
        return content;
      }
    }

    return content;
  } catch (error) {
    throw new Error(`信封JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function parsePayload(payload: string): Promise<any> {
  try {
    const normalized = normalizeLLMOutput(payload);
    try {
      return JSON.parse(normalized);
    } catch {
      const repaired = await repairJSONWithLLM(normalized);
      return JSON.parse(repaired);
    }
  } catch (error) {
    throw new Error(`Payload解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
