# API Server

自建 API 服务器，基于 Render 免费部署方案。

## 技术栈

- Fastify - 轻量高性能 Web 框架
- p-queue - 内存任务队列
- Supabase JS - 数据库客户端

## 本地开发

```bash
npm install
npm run dev
```

## 部署到 Render

1. 推送代码到 GitHub
2. 在 Render 创建 Web Service
3. 连接 GitHub 仓库
4. 配置环境变量
5. 部署

## 环境变量

- `FRONTEND_URL` - 前端地址
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_KEY` - Supabase 服务密钥
