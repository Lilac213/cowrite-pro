# New API 配置完成指南

## ✅ 已完成的修改

### 1. 更新了所有 Agent 的模型名称

已将所有 Agent 的模型从 `gemini-2.0-flash-exp` 更新为 `gemini-3-pro-preview`：

- ✅ [briefAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/briefAgent.ts)
- ✅ [reviewAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/reviewAgent.ts)
- ✅ [draftAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/draftAgent.ts)
- ✅ [structureAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/structureAgent.ts)
- ✅ [researchAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/researchAgent.ts)
- ✅ [repairJSONAgent.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/agents/repairJSONAgent.ts)
- ✅ [callLLM.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/runtime/callLLM.ts) (默认模型)

### 2. 修改了 LLM 调用模块

已更新 [callLLM.ts](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/supabase/functions/_shared/llm/runtime/callLLM.ts) 支持：
- OpenAI 兼容 API（New API 中转站）
- 原生 Gemini API（自动检测）

## 🔧 需要您完成的配置

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
# INTEGRATIONS_API_KEY: sk-mQnV4bKXYX2sbQnz5...
```

### 步骤 4: 运行测试

```bash
# 运行完整测试
node tests/agent-test.js
```

## 📋 配置信息

### API 配置

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://api.newapi.pro` |
| API Key | `sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf` |
| 模型名称 | `gemini-3-pro-preview` |

### 环境变量

| 环境变量 | 说明 | 值 |
|---------|------|-----|
| `OPENAI_BASE_URL` | New API 的 Base URL | `https://api.newapi.pro` |
| `INTEGRATIONS_API_KEY` | API Key | `sk-mQnV4bKXYX2sbQnz5...` |

## 🔍 API 调用流程

配置后的调用流程：

1. **检测配置**: 系统检测到 `OPENAI_BASE_URL` 已配置
2. **使用中转站**: 自动使用 OpenAI 兼容 API 格式
3. **调用模型**: 通过 New API 中转站调用 `gemini-3-pro-preview`
4. **返回结果**: 获取模型响应

### 请求格式

```json
{
  "model": "gemini-3-pro-preview",
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

### 请求 URL

```
https://api.newapi.pro/v1/chat/completions
```

### 认证方式

```
Authorization: Bearer sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf
```

## 📝 修改的文件列表

### Agent 文件

1. `supabase/functions/_shared/llm/agents/briefAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`

2. `supabase/functions/_shared/llm/agents/reviewAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`

3. `supabase/functions/_shared/llm/agents/draftAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`

4. `supabase/functions/_shared/llm/agents/structureAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`

5. `supabase/functions/_shared/llm/agents/researchAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview` (2处)

6. `supabase/functions/_shared/llm/agents/repairJSONAgent.ts`
   - 模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`

### Runtime 文件

7. `supabase/functions/_shared/llm/runtime/callLLM.ts`
   - 默认模型: `gemini-2.0-flash-exp` → `gemini-3-pro-preview`
   - 新增: OpenAI 兼容 API 支持
   - 新增: 自动检测 API 类型

## ⚠️ 注意事项

### API Key 验证

在之前的测试中，这个 API Key 返回了"无效的令牌"错误。请确保：

1. **Key 正确**: 确认 Key 完整复制，没有多余空格
2. **Key 有效**: 登录 New API 控制台检查 Key 状态
3. **余额充足**: 确认账户有足够余额
4. **权限正确**: 确认 Key 有访问 Gemini 模型的权限

### 如果仍然失败

如果配置后仍然失败，请：

1. 检查 Edge Function 日志：
   ```bash
   supabase functions logs brief-agent
   ```

2. 查看详细错误信息

3. 考虑重新生成 API Key

## 🎯 下一步

1. ✅ 代码已修改完成
2. ⏳ 配置 Supabase Secrets（需要您执行）
3. ⏳ 重新部署 Edge Functions（需要您执行）
4. ⏳ 运行测试验证（需要您执行）

## 📄 相关文档

- [tests/NEW_API_CONFIG.md](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/tests/NEW_API_CONFIG.md) - 详细配置指南
- [tests/BRIEF_AGENT_FIX.md](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/tests/BRIEF_AGENT_FIX.md) - Brief Agent 修复报告
- [tests/TEST_REPORT.md](file:///Users/lilacfei/Desktop/Cowrite/app-9bwpferlujnl/tests/TEST_REPORT.md) - 测试报告

---

**总结**: 所有代码修改已完成，模型名称已更新为 `gemini-3-pro-preview`。请按照上述步骤配置 Supabase Secrets 并重新部署 Edge Functions，然后运行测试验证配置是否成功。
