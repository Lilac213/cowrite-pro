/**
 * Schema验证模块
 * 使用Zod进行运行时类型验证
 */

/**
 * 简化的Schema验证接口
 * 由于Deno环境限制，这里提供基础的验证功能
 * 生产环境建议使用Zod或其他验证库
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 基础Schema验证函数
 * @param data - 待验证的数据
 * @param schema - 验证规则（简化版）
 * @returns 验证结果
 */
export function validateSchema<T>(
  data: any,
  schema: {
    required?: string[];
    optional?: string[];
    validate?: (data: any) => boolean;
    defaults?: Record<string, any>;
  }
): ValidationResult<T> {
  try {
    // 应用默认值
    if (schema.defaults) {
      for (const [key, value] of Object.entries(schema.defaults)) {
        if (data[key] === undefined || data[key] === null) {
          data[key] = value;
        }
      }
    }
    
    // 检查必需字段
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data) || data[field] === undefined || data[field] === null) {
          return {
            success: false,
            error: `缺少必需字段: ${field}`,
          };
        }
      }
    }

    // 自定义验证
    if (schema.validate && !schema.validate(data)) {
      return {
        success: false,
        error: '自定义验证失败',
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    return {
      success: false,
      error: `验证失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 验证并返回数据，失败时抛出错误
 * @param data - 待验证的数据
 * @param schema - 验证规则
 * @returns 验证后的数据
 * @throws 验证失败时抛出错误
 */
export function validateOrThrow<T>(
  data: any,
  schema: {
    required?: string[];
    optional?: string[];
    validate?: (data: any) => boolean;
    defaults?: Record<string, any>;
  }
): T {
  // 应用默认值
  if (schema.defaults) {
    for (const [key, value] of Object.entries(schema.defaults)) {
      if (data[key] === undefined || data[key] === null) {
        data[key] = value;
      }
    }
  }
  
  const result = validateSchema<T>(data, schema);
  if (!result.success) {
    throw new Error(result.error || 'Schema验证失败');
  }
  return result.data!;
}
