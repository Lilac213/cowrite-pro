# New API 中转站配置指南

## 概述

本项目已支持使用 New API 中转站调用 Gemini 模型。New API 是一个 OpenAI 兼容的 API 网关，可以将各种大模型（包括 Gemini）统一为 OpenAI 格式的 API。

## 配置步骤

### 步骤 1: 配置 Supabase Secrets

使用 Supabase CLI 配置以下环境变量：

```bash
# 配置 New API Base URL
supabase secrets set OPENAI_BASE_URL="https://api.newapi.pro"

# 配置 API Key
supabase secrets set INTEGRATIONS_API_KEY="sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf"
```

### 步骤 2: 重新部署 Edge Functions

配置完成后，需要重新部署所有 Agent 相关的 Edge Functions：

```bash
# 部署所有 Agent 相关的 Edge Functions
supabase functions deploy brief-agent
supabase functions deploy structure-agent
supabase functions deploy draft-agent
supabase functions deploy review-agent
```

### 步骤 3: 验证配置

```bash
# 检查 Secrets 是否已配置
supabase secrets list

# 应该看到:
# OPENAI_BASE_URL: https://api.newapi.pro
# INTEGRATIONS_API_KEY: sk-mQnV4bK...
```

## API 调用逻辑

修改后的 `callLLM.ts` 会自动检测配置并选择合适的 API：

### 优先级 1: OpenAI 兼容 API（中转站）

如果同时配置了以下两个环境变量：
- `OPENAI_BASE_URL`: 中转站的 Base URL
- `INTEGRATIONS_API_KEY` 或 `OPENAI_API_KEY`: API Key

系统会使用 OpenAI 兼容的 API 格式调用模型。

**请求格式**:
```json
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    {
      "role": "user",
      "content": "your prompt"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 8192
}
```

**请求 URL**:
```
{OPENAI_BASE_URL}/v1/chat/completions
```

### 优先级 2: 原生 Gemini API

如果没有配置 `OPENAI_BASE_URL`，系统会使用原生 Gemini API。

**请求格式**:
```json
{
  "contents": [{
    "parts": [{
      "text": "your prompt"
    }]
  }],
  "generationConfig": {
    "temperature": 0.3,
    "maxOutputTokens": 8192
  }
}
```

**请求 URL**:
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
```

## 支持的模型

New API 中转站支持多种模型，您可以在 Agent 代码中指定模型名称：

- `gemini-2.0-flash-exp` (默认)
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gpt-4`
- `gpt-3.5-turbo`
- 等等...

## 测试配置

### 方法 1: 运行完整测试

```bash
node tests/agent-test.js
```

### 方法 2: 测试单个 Agent

```bash
# 测试 Brief Agent
curl -X POST https://iupvpwpfhoonpzmosdgo.supabase.co/functions/v1/brief-agent \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-project",
    "topic": "测试主题",
    "user_input": "测试输入"
  }'
```

## 常见问题

### Q1: 如何确认使用的是中转站还是原生 API？

查看 Edge Function 日志：
```bash
supabase functions logs brief-agent
```

日志中会显示：
- `[callLLM] 使用 OpenAI 兼容 API` - 使用中转站
- `[callLLM] 使用原生 Gemini API` - 使用原生 API

### Q2: 配置后仍然报错怎么办？

1. 检查 API Key 是否正确
2. 检查 Base URL 是否正确（不要包含 `/v1` 后缀）
3. 检查账户余额是否充足
4. 查看 Edge Function 日志获取详细错误信息

### Q3: 如何切换回原生 Gemini API？

删除 `OPENAI_BASE_URL` 环境变量：
```bash
supabase secrets unset OPENAI_BASE_URL
```

然后重新部署 Edge Functions。

### Q4: 支持哪些环境变量？

| 环境变量 | 说明 | 优先级 |
|---------|------|--------|
| `OPENAI_BASE_URL` | 中转站的 Base URL | 高（触发中转站模式） |
| `INTEGRATIONS_API_KEY` | API Key（中转站或原生） | 高 |
| `OPENAI_API_KEY` | OpenAI API Key（备用） | 中 |
| `GEMINI_API_KEY` | Gemini API Key（备用） | 低 |

## 代码修改说明

### 修改的文件

- `supabase/functions/_shared/llm/runtime/callLLM.ts`
  - 添加了 `callOpenAICompatible()` 函数
  - 添加了 `callGeminiNative()` 函数
  - 修改了 `callLLM()` 函数以支持自动选择 API 类型

### 新增功能

1. **自动检测 API 类型**: 根据 `OPENAI_BASE_URL` 是否配置自动选择使用中转站还是原生 API
2. **OpenAI 兼容格式**: 支持标准的 OpenAI API 格式
3. **详细日志**: 记录使用的 API 类型和调用参数
4. **错误处理**: 提供更详细的错误信息

## 下一步

配置完成后，请：

1. 重新部署 Edge Functions
2. 运行测试验证配置
3. 检查日志确认 API 调用正常

如有问题，请查看 Edge Function 日志或联系技术支持。
