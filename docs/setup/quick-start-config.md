# 快速开始：配置自建 API

## 1. 必需环境变量
```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_role_key"
export OPENAI_BASE_URL="https://api.newapi.pro"
export INTEGRATIONS_API_KEY="your_key"
```

## 2. 可选环境变量
```bash
export QIANWEN_API_KEY="your_key"
export SERPAPI_API_KEY="your_key"
export RESEND_API_KEY="your_key"
```

## 3. 启动服务
```bash
cd api-server
npm run dev
```

## 4. 健康检查
访问 `GET /health`，应返回：
```json
{"status":"ok"}
```
