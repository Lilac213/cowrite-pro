# API 密钥配置修复文档

## 问题描述

用户遇到双重 LLM 调用失败的错误：

```json
{
  "error": "JSON解析失败: 信封JSON解析失败: 未找到JSON对象且修复失败: JSON 修复失败: 双重LLM调用失败 - Gemini: Gemini API调用失败: 400 Bad Request, Qwen: Qwen API调用失败: 401 Unauthorized"
}
```

## 根本原因

### 1. Gemini API 400 错误

可能的原因：
- API 密钥无效或过期
- 请求格式不正确
- API 配额已用完
- 模型名称错误

### 2. Qwen API 401 错误

原因：
- 之前的代码只使用 `INTEGRATIONS_API_KEY` 作为 Qwen 的 API 密钥
- 该密钥可能未配置，或者不是有效的 Qwen API 密钥
- Qwen API 需要专门的阿里云百炼平台 API 密钥

## 解决方案

### 1. 改进 Qwen API 密钥配置

**修改文件**: `supabase/functions/_shared/llm/runtime/callLLMWithFallback.ts`

#### 之前的代码

```typescript
async function callQwen(config: LLMCallConfig): Promise<string> {
  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
  if (!apiKey) {
    throw new Error('Qwen API密钥未配置');
  }
  // ...
}
```

#### 修改后的代码

```typescript
async function callQwen(config: LLMCallConfig): Promise<string> {
  // 优先使用专门的 QWEN_API_KEY，回退到 INTEGRATIONS_API_KEY
  const apiKey = Deno.env.get('QWEN_API_KEY') || Deno.env.get('INTEGRATIONS_API_KEY');
  if (!apiKey) {
    throw new Error('Qwen API密钥未配置');
  }
  // ...
}
```

**改进点**：
- 支持专门的 `QWEN_API_KEY` 环境变量
- 保持向后兼容，仍然支持 `INTEGRATIONS_API_KEY`
- 提供更灵活的配置选项

### 2. 增强 Gemini 错误日志

#### 之前的代码

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('[callGemini] API调用失败:', response.status, response.statusText);
  console.error('[callGemini] 错误详情:', errorText);
  throw new Error(`Gemini API调用失败: ${response.status} ${response.statusText}`);
}
```

#### 修改后的代码

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('[callGemini] API调用失败:', response.status, response.statusText);
  console.error('[callGemini] 错误详情:', errorText);
  console.error('[callGemini] 请求URL:', url);
  console.error('[callGemini] API Key前缀:', apiKey.substring(0, 10) + '...');
  throw new Error(`Gemini API调用失败: ${response.status} ${response.statusText}`);
}
```

**改进点**：
- 记录请求 URL，便于检查端点是否正确
- 记录 API Key 前缀（不泄露完整密钥），便于验证密钥是否正确

### 3. 改进回退错误处理

#### 之前的代码

```typescript
export async function callLLMWithFallback(config: LLMCallConfig): Promise<string> {
  try {
    const result = await callGemini(config);
    return result;
  } catch (geminiError) {
    try {
      const result = await callQwen(config);
      return result;
    } catch (qwenError) {
      throw new Error(
        `双重LLM调用失败 - Gemini: ${geminiError.message}, Qwen: ${qwenError.message}`
      );
    }
  }
}
```

#### 修改后的代码

```typescript
export async function callLLMWithFallback(config: LLMCallConfig): Promise<string> {
  console.log('[callLLMWithFallback] 开始双重LLM调用');
  
  let geminiError: Error | null = null;
  let qwenError: Error | null = null;
  
  // 第一次尝试：Gemini
  try {
    console.log('[callLLMWithFallback] 尝试 Gemini...');
    const result = await callGemini(config);
    console.log('[callLLMWithFallback] ✅ Gemini 调用成功');
    return result;
  } catch (error) {
    geminiError = error instanceof Error ? error : new Error(String(error));
    console.warn('[callLLMWithFallback] ⚠️ Gemini 调用失败:', geminiError.message);
    console.log('[callLLMWithFallback] 回退到 Qwen...');
  }
  
  // 第二次尝试：Qwen
  try {
    const result = await callQwen(config);
    console.log('[callLLMWithFallback] ✅ Qwen 调用成功（回退）');
    return result;
  } catch (error) {
    qwenError = error instanceof Error ? error : new Error(String(error));
    console.error('[callLLMWithFallback] ❌ Qwen 调用也失败:', qwenError.message);
  }
  
  // 两个都失败，抛出综合错误
  const errorMessage = `双重LLM调用失败 - Gemini: ${geminiError?.message || '未知错误'}, Qwen: ${qwenError?.message || '未知错误'}`;
  console.error('[callLLMWithFallback] ❌ 最终错误:', errorMessage);
  
  // 如果 Qwen 是因为 API 密钥未配置而失败，提供更友好的错误信息
  if (qwenError?.message.includes('API密钥未配置') || qwenError?.message.includes('401')) {
    console.warn('[callLLMWithFallback] 💡 提示: Qwen API 密钥未配置或无效，请配置 QWEN_API_KEY 环境变量以启用回退功能');
  }
  
  throw new Error(errorMessage);
}
```

**改进点**：
- 更清晰的错误处理逻辑
- 分别记录 Gemini 和 Qwen 的错误
- 提供友好的配置提示
- 更详细的日志记录

## 配置指南

### 环境变量配置

系统现在支持以下 API 密钥配置：

#### 1. Gemini API 密钥

```bash
# 优先级 1: INTEGRATIONS_API_KEY
INTEGRATIONS_API_KEY=your_gemini_api_key_here

# 优先级 2: GEMINI_API_KEY（如果 INTEGRATIONS_API_KEY 未设置）
GEMINI_API_KEY=your_gemini_api_key_here
```

**获取方式**：
- 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
- 创建或获取 API 密钥

#### 2. Qwen API 密钥（可选，用于回退）

```bash
# 优先级 1: QWEN_API_KEY（推荐）
QWEN_API_KEY=your_qwen_api_key_here

# 优先级 2: INTEGRATIONS_API_KEY（如果 QWEN_API_KEY 未设置）
INTEGRATIONS_API_KEY=your_qwen_api_key_here
```

**获取方式**：
- 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
- 创建应用并获取 API 密钥

### Supabase 配置

在 Supabase Dashboard 中配置环境变量：

1. 进入项目设置 → Edge Functions → Secrets
2. 添加以下密钥：

```
INTEGRATIONS_API_KEY=your_gemini_api_key
QWEN_API_KEY=your_qwen_api_key  # 可选
```

## 错误诊断

### 场景 1: Gemini 400 错误

**日志示例**：
```
[callGemini] API调用失败: 400 Bad Request
[callGemini] 错误详情: {"error": {"message": "API key not valid"}}
[callGemini] 请求URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=...
[callGemini] API Key前缀: AIzaSyBxxx...
```

**解决方法**：
1. 检查 `INTEGRATIONS_API_KEY` 或 `GEMINI_API_KEY` 是否正确
2. 验证 API 密钥是否有效（未过期、未被撤销）
3. 检查 API 配额是否已用完
4. 确认模型名称是否正确

### 场景 2: Qwen 401 错误

**日志示例**：
```
[callLLMWithFallback] ⚠️ Gemini 调用失败: Gemini API调用失败: 400 Bad Request
[callLLMWithFallback] 回退到 Qwen...
[callQwen] API调用失败: 401 Unauthorized
[callQwen] 错误详情: {"error": "Invalid API key"}
[callLLMWithFallback] ❌ Qwen 调用也失败: Qwen API调用失败: 401 Unauthorized
[callLLMWithFallback] 💡 提示: Qwen API 密钥未配置或无效，请配置 QWEN_API_KEY 环境变量以启用回退功能
```

**解决方法**：
1. 配置 `QWEN_API_KEY` 环境变量
2. 确认 API 密钥来自阿里云百炼平台
3. 验证 API 密钥格式是否正确
4. 检查 API 密钥权限是否足够

### 场景 3: 两个都失败

**日志示例**：
```
[callLLMWithFallback] 开始双重LLM调用
[callLLMWithFallback] 尝试 Gemini...
[callGemini] API调用失败: 400 Bad Request
[callLLMWithFallback] ⚠️ Gemini 调用失败: Gemini API调用失败: 400 Bad Request
[callLLMWithFallback] 回退到 Qwen...
[callQwen] API调用失败: 401 Unauthorized
[callLLMWithFallback] ❌ Qwen 调用也失败: Qwen API调用失败: 401 Unauthorized
[callLLMWithFallback] ❌ 最终错误: 双重LLM调用失败 - Gemini: Gemini API调用失败: 400 Bad Request, Qwen: Qwen API调用失败: 401 Unauthorized
[callLLMWithFallback] 💡 提示: Qwen API 密钥未配置或无效，请配置 QWEN_API_KEY 环境变量以启用回退功能
```

**解决方法**：
1. 优先修复 Gemini API 配置（主要 LLM）
2. 配置 Qwen API 作为备用（可选但推荐）
3. 检查网络连接是否正常
4. 验证所有 API 密钥是否有效

## 最佳实践

### 1. 推荐配置

```bash
# 主要 LLM（必需）
INTEGRATIONS_API_KEY=your_gemini_api_key

# 备用 LLM（推荐）
QWEN_API_KEY=your_qwen_api_key
```

### 2. 监控建议

- 监控 Gemini API 调用成功率
- 监控 Qwen 回退使用频率
- 设置 API 配额告警
- 定期检查 API 密钥有效性

### 3. 成本优化

- Gemini 作为主要 LLM（成本较低）
- Qwen 作为备用（仅在 Gemini 失败时使用）
- 监控两个 API 的使用量和成本

## 部署状态

✅ 所有 9 个 Edge Functions 已成功部署最新版本：
- brief-agent
- research-retrieval
- research-synthesis
- structure-agent
- draft-agent
- review-agent
- adjust-article-structure
- generate-article-structure
- verify-coherence

## 总结

通过以下改进，系统现在能够：

✅ 支持专门的 Qwen API 密钥配置
✅ 提供更详细的错误日志
✅ 给出友好的配置提示
✅ 更好地诊断 API 密钥问题
✅ 提高系统的容错能力

**重要提示**：
- Gemini API 密钥是必需的（主要 LLM）
- Qwen API 密钥是可选的（备用 LLM）
- 建议配置两个 API 密钥以获得最佳可靠性
