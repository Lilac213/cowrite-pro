export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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
    if (schema.defaults) {
      for (const [key, value] of Object.entries(schema.defaults)) {
        if (data[key] === undefined || data[key] === null) {
          data[key] = value;
        }
      }
    }

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

export function validateOrThrow<T>(
  data: any,
  schema: {
    required?: string[];
    optional?: string[];
    validate?: (data: any) => boolean;
    defaults?: Record<string, any>;
  }
): T {
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
