# API 密钥配置快速指南

## 适用范围
自建 API 运行所需的最小配置说明，适用于本地和线上部署。

## 必需配置
### 1. Gemini 中转站
- `OPENAI_BASE_URL`：中转站地址（如 https://api.newapi.pro）
- `INTEGRATIONS_API_KEY`：中转站密钥

### 2. Supabase 服务访问
- `SUPABASE_URL`：Supabase 项目地址
- `SUPABASE_SERVICE_KEY`：Supabase Service Role 密钥

## 可选配置
- `QIANWEN_API_KEY`：Qwen 备用模型密钥
- `SERPAPI_API_KEY`：搜索服务密钥（也可通过管理面板写入 system_config）
- `RESEND_API_KEY`：邀请邮件服务密钥

## 本地运行示例
```bash
export OPENAI_BASE_URL="https://api.newapi.pro"
export INTEGRATIONS_API_KEY="your_key"
export QIANWEN_API_KEY="your_key"
export SERPAPI_API_KEY="your_key"
export RESEND_API_KEY="your_key"
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_role_key"

cd api-server
npm run dev
```

## 验证方式
- `GET /health` 返回 `{"status":"ok"}`
- 若密钥缺失，会返回明确错误，例如 `Gemini 中转站未配置` 或 `SERPAPI_API_KEY 未配置`

## 安全提示
- 不要把密钥写入前端或提交到仓库
