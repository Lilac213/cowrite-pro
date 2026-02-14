export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function createEmbedding(input: string, model: string = 'text-embedding-3-small'): Promise<EmbeddingResult> {
  const baseUrl = Deno.env.get('OPENAI_BASE_URL');
  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');

  if (!baseUrl || !apiKey) {
    throw new Error('Embedding API 未配置 (OPENAI_BASE_URL 或 INTEGRATIONS_API_KEY)');
  }

  const normalizedBaseUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
  const url = `${normalizedBaseUrl}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: input.trim(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[createEmbedding] API 调用失败:', response.status, response.statusText);
    console.error('[createEmbedding] 错误详情:', errorText);
    throw new Error(`Embedding API 调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    embedding: data.data[0].embedding,
    model: data.model,
    usage: data.usage,
  };
}

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

export async function createBatchEmbeddings(texts: string[], model: string = 'text-embedding-3-small', concurrency: number = 5): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const chunks: string[][] = [];
  
  for (let i = 0; i < texts.length; i += concurrency) {
    chunks.push(texts.slice(i, i + concurrency));
  }
  
  console.log('[createBatchEmbeddings] 文本数量:', texts.length, '分批:', chunks.length);
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(text => 
        createEmbedding(text, model).catch(error => {
          console.warn('[createBatchEmbeddings] 单个 embedding 失败:', error);
          return null;
        })
      )
    );
    
    results.push(...chunkResults.filter((r): r is EmbeddingResult => r !== null));
  }
  
  return results;
}
