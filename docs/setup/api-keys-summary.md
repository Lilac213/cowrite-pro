# 项目第三方 API 密钥汇总

## 必需
### LLM 主模型（Gemini）
- `OPENAI_BASE_URL`
- `INTEGRATIONS_API_KEY`
- 位置：自建 API 服务环境变量

### 数据库访问
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- 位置：自建 API 服务环境变量

## 可选
### Qwen 备用模型
- `QIANWEN_API_KEY`（或 `QWEN_API_KEY`）
- 位置：自建 API 服务环境变量

### 搜索服务
- `SERPAPI_API_KEY`
- 位置：自建 API 服务环境变量
- 备用：`system_config.search_api_key`（管理面板写入）

### 邀请邮件
- `RESEND_API_KEY`
- 位置：自建 API 服务环境变量

## 相关文档
- [api-key-setup.md](./api-key-setup.md) - 详细配置指南
- [api-key-quick-guide.md](./api-key-quick-guide.md) - 快速配置指南
- [serpapi-configuration.md](../api/serpapi-configuration.md) - 搜索服务配置
