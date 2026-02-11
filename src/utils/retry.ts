/**
 * 重试工具函数
 * 为 Edge Function 调用提供自动重试和指数退避机制
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
  backoffMultiplier: 2,
  retryableErrors: [
    'JSON解析失败',
    '未找到JSON对象',
    'API调用失败',
    '网络错误',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
};

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.error || String(error);
  
  return retryableErrors.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * 计算延迟时间（指数退避）
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 * @param fn - 要执行的异步函数
 * @param options - 重试选项
 * @returns 函数执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      console.log(`[withRetry] 尝试 ${attempt + 1}/${opts.maxRetries + 1}`);
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`[withRetry] ✅ 重试成功（第 ${attempt + 1} 次尝试）`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[withRetry] ❌ 尝试 ${attempt + 1} 失败:`, error);

      // 如果是最后一次尝试，直接抛出错误
      if (attempt === opts.maxRetries) {
        console.error(`[withRetry] 已达到最大重试次数 (${opts.maxRetries})，放弃重试`);
        break;
      }

      // 检查是否为可重试错误
      if (!isRetryableError(error, opts.retryableErrors)) {
        console.error(`[withRetry] 错误不可重试，放弃重试`);
        throw error;
      }

      // 计算延迟时间并等待
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      );
      console.log(`[withRetry] 等待 ${delay}ms 后重试...`);
      await sleep(delay);
    }
  }

  // 所有重试都失败，抛出最后一个错误
  throw lastError;
}

/**
 * 为 Supabase Edge Function 调用添加重试机制
 * @param supabase - Supabase 客户端
 * @param functionName - Edge Function 名称
 * @param options - 调用选项
 * @param retryOptions - 重试选项
 * @returns Edge Function 响应
 */
export async function invokeWithRetry<T = any>(
  supabase: any,
  functionName: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  } = {},
  retryOptions: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  return withRetry(async () => {
    console.log(`[invokeWithRetry] 调用 Edge Function: ${functionName}`);
    
    const result = await supabase.functions.invoke(
      functionName,
      options
    );
    
    const { data, error } = result as { data: T | null; error: any };

    if (error) {
      console.error(`[invokeWithRetry] Edge Function 返回错误:`, error);
      
      // 尝试从 error.context 中获取详细错误信息
      let errorMessage = error.message || '未知错误';
      if (error.context) {
        try {
          const contextText = await error.context.text();
          console.error(`[invokeWithRetry] 错误详情:`, contextText);
          
          // 尝试解析 JSON 错误
          try {
            const errorJson = JSON.parse(contextText);
            errorMessage = errorJson.error || errorJson.message || contextText;
          } catch {
            errorMessage = contextText;
          }
        } catch (e) {
          console.error(`[invokeWithRetry] 无法读取错误上下文:`, e);
        }
      }
      
      throw new Error(errorMessage);
    }

    return { data, error: null };
  }, retryOptions);
}
