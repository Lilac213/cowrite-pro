# API 密钥配置指南

## 自建 API 依赖的密钥与环境

### LLM 调用（主备模型）
CoWrite 的 LLM 调用使用主模型 + 备用模型回退：

- 主模型：Gemini（通过中转站）
  - `OPENAI_BASE_URL`
  - `INTEGRATIONS_API_KEY`

- 备用模型：Qwen（可选）
  - `QIANWEN_API_KEY`（或 `QWEN_API_KEY`）

当 Gemini 调用失败时会自动回退到 Qwen。

### 搜索服务
SerpAPI 用于 Scholar / News / Web 搜索：
- `SERPAPI_API_KEY`
- 也可通过管理面板写入 `system_config.search_api_key`

### 邮件服务（可选）
邀请邮件使用 Resend：
- `RESEND_API_KEY`

### 数据库访问
自建 API 需要 Supabase Service Key 访问数据库：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## 本地开发配置示例
```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_role_key"
export OPENAI_BASE_URL="https://api.newapi.pro"
export INTEGRATIONS_API_KEY="your_key"
export QIANWEN_API_KEY="your_key"
export SERPAPI_API_KEY="your_key"
export RESEND_API_KEY="your_key"

cd api-server
npm run dev
```

## 常见报错与处理
- `Gemini 中转站未配置`：缺少 `OPENAI_BASE_URL` 或 `INTEGRATIONS_API_KEY`
- `Qwen API密钥未配置`：缺少 `QIANWEN_API_KEY`，仅在回退时触发
- `SERPAPI_API_KEY 未配置`：搜索接口未配置
- `SUPABASE_URL 或 SUPABASE_SERVICE_KEY 未配置`：数据库访问配置缺失

## 安全建议
- 所有密钥只配置在服务端环境变量
- 不要在前端或文档中写入真实密钥
