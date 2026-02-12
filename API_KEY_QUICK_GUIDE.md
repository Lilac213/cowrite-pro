# API 密钥配置快速指南

## 问题：双重 LLM 调用失败

如果你看到以下错误：

```
双重LLM调用失败 - Gemini: Gemini API调用失败: 400 Bad Request, Qwen: Qwen API调用失败: 401 Unauthorized
```

这意味着 API 密钥配置有问题。

## 快速解决方案

### 步骤 1: 配置 Gemini API 密钥（必需）

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建或获取 API 密钥
3. 在 Supabase Dashboard 中配置：

```
项目设置 → Edge Functions → Secrets
添加: INTEGRATIONS_API_KEY = 你的_Gemini_API_密钥
```

### 步骤 2: 配置 Qwen API 密钥（推荐，可选）

1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
2. 创建应用并获取 API 密钥
3. 在 Supabase Dashboard 中配置：

```
项目设置 → Edge Functions → Secrets
添加: QWEN_API_KEY = 你的_Qwen_API_密钥
```

## 为什么需要两个 API 密钥？

- **Gemini API**：主要 LLM，用于所有正常请求
- **Qwen API**：备用 LLM，仅在 Gemini 失败时使用

配置两个 API 密钥可以提高系统可靠性！

## 常见问题

### Q: 我只配置 Gemini 可以吗？

A: 可以！Qwen 是可选的备用方案。但建议配置两个以提高可靠性。

### Q: 如何验证配置是否正确？

A: 查看 Edge Function 日志：

```
[callLLMWithFallback] ✅ Gemini 调用成功
```

或者（如果 Gemini 失败）：

```
[callLLMWithFallback] ⚠️ Gemini 调用失败
[callLLMWithFallback] ✅ Qwen 调用成功（回退）
```

### Q: 我看到 "API密钥未配置" 错误怎么办？

A: 检查 Supabase Dashboard 中的 Secrets 配置，确保：
- `INTEGRATIONS_API_KEY` 已配置（Gemini）
- `QWEN_API_KEY` 已配置（可选，Qwen）

### Q: 我看到 400 或 401 错误怎么办？

A: 
- **400 错误**：Gemini API 密钥无效或过期，请重新获取
- **401 错误**：Qwen API 密钥无效或未配置，请检查配置

## 获取 API 密钥

### Gemini API 密钥

1. 访问：https://makersuite.google.com/app/apikey
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制生成的密钥

### Qwen API 密钥

1. 访问：https://bailian.console.aliyun.com/
2. 登录阿里云账号
3. 创建应用
4. 在应用详情中找到 API Key
5. 复制 API Key

## 需要帮助？

查看详细文档：`API_KEY_CONFIGURATION_FIX.md`
