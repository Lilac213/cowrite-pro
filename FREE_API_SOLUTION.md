# 自建 API 免费方案

## 💰 完全免费的部署方案

### 方案对比

| 平台 | 免费额度 | 限制 | 推荐度 |
|------|---------|------|--------|
| **Render** | 750 小时/月 | 冷启动、512MB RAM | ⭐⭐⭐⭐⭐ |
| **Railway** | $5 免费额度/月 | 约 500 小时 | ⭐⭐⭐⭐ |
| **Fly.io** | 3 个共享 VM | 256MB RAM | ⭐⭐⭐⭐ |
| **Vercel** | 无限部署 | 10 秒执行限制 | ⭐⭐⭐ (不适合长连接) |
| **Cloudflare Workers** | 100k 请求/天 | 无状态 | ⭐⭐⭐ (不适合 SSE) |

## 🎯 推荐方案：Render 免费套餐

### 为什么选择 Render？

1. **完全免费**
   - 750 小时/月（够用一整月）
   - 无需信用卡
   - 无隐藏费用

2. **功能完整**
   - 支持 Docker
   - 支持 WebSocket/SSE
   - 自动 HTTPS
   - 自动部署

3. **限制可接受**
   - 15 分钟无请求后休眠（冷启动 ~30 秒）
   - 512MB RAM（够用）
   - 0.1 CPU（够用）

### Redis 免费方案

#### 选项 1: Upstash Redis（推荐）
```yaml
免费额度:
  - 10,000 命令/天
  - 256MB 存储
  - 全球边缘网络
  - 无需信用卡
```

#### 选项 2: Redis Cloud
```yaml
免费额度:
  - 30MB 存储
  - 30 连接
  - 够用于小规模应用
```

#### 选项 3: 内存缓存（最简单）
```typescript
// 如果不需要持久化，直接用 Node.js 内存
const cache = new Map();
```

## 🚀 完全免费的技术栈

```typescript
{
  "api": "Fastify (轻量高性能)",
  "queue": "内存队列 (p-queue) 或 Upstash QStash",
  "cache": "Upstash Redis (免费) 或 内存缓存",
  "deployment": "Render (免费)",
  "monitoring": "Render 内置日志 (免费)",
  "database": "Supabase PostgreSQL (已有)"
}
```

## 📦 最小化实现方案

### 1. 基础 API 服务器（无 Redis）

```typescript
// server.ts - 最小化实现
import Fastify from 'fastify';
import cors from '@fastify/cors';
import PQueue from 'p-queue';

const app = Fastify({ logger: true });
const queue = new PQueue({ concurrency: 5 }); // 内存队列

await app.register(cors, {
  origin: process.env.FRONTEND_URL,
  credentials: true
});

// SSE 端点
app.get('/api/search/stream', async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  // 流式推送
  reply.raw.write(`data: ${JSON.stringify({ stage: 'start' })}\n\n`);
  
  // 执行搜索...
  
  reply.raw.end();
});

app.listen({ port: 3000, host: '0.0.0.0' });
```

### 2. 部署配置

```yaml
# render.yaml
services:
  - type: web
    name: api-server
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

### 3. 包依赖（最小化）

```json
{
  "dependencies": {
    "fastify": "^4.26.0",
    "@fastify/cors": "^9.0.1",
    "p-queue": "^8.0.1",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0"
  }
}
```

## 💡 成本优化策略

### 1. 避免冷启动（Render 免费版）

```typescript
// 定时 ping 保持活跃（可选）
// 使用 cron-job.org (免费) 每 10 分钟 ping 一次
app.get('/health', async () => ({ status: 'ok' }));
```

### 2. 缓存策略（无 Redis）

```typescript
// 简单内存缓存
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  
  set(key: string, value: any, ttl = 3600) {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttl * 1000
    });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
}

const cache = new SimpleCache();
```

### 3. 任务队列（无 Redis）

```typescript
import PQueue from 'p-queue';

// 内存队列，重启后丢失（可接受）
const searchQueue = new PQueue({
  concurrency: 3,
  timeout: 60000,
  throwOnTimeout: true
});

// 添加任务
searchQueue.add(() => performSearch(query));
```

## 📊 免费方案对比

### 当前方案（Supabase Edge Functions）
```
成本: $0 (免费额度内)
问题:
  ❌ SSE 支持差
  ❌ 并发控制难
  ❌ 调试困难
  ❌ 冷启动慢
```

### 新方案（Render + 内存缓存）
```
成本: $0 (完全免费)
优势:
  ✅ SSE 完美支持
  ✅ 并发控制简单
  ✅ 调试方便
  ✅ 性能更好
  ⚠️ 冷启动 ~30 秒（可接受）
```

### 升级方案（Render + Upstash Redis）
```
成本: $0 (免费额度内)
优势:
  ✅ 持久化缓存
  ✅ 分布式队列
  ✅ 更好的性能
  ✅ 可扩展性强
```

## 🎯 实施步骤（完全免费）

### 第 1 步：创建项目（5 分钟）

```bash
mkdir api-server && cd api-server
npm init -y
npm install fastify @fastify/cors p-queue @supabase/supabase-js
npm install -D typescript @types/node tsx
```

### 第 2 步：编写最小 API（30 分钟）

```typescript
// src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

app.register(cors, {
  origin: process.env.FRONTEND_URL || '*'
});

// 健康检查
app.get('/health', async () => ({ status: 'ok' }));

// SSE 搜索
app.get('/api/search/stream', async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  const send = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ stage: 'start', message: '开始搜索...' });
  
  // TODO: 实现搜索逻辑
  
  reply.raw.end();
});

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: '0.0.0.0' });
```

### 第 3 步：部署到 Render（10 分钟）

1. 推送代码到 GitHub
2. 访问 [render.com](https://render.com)
3. 连接 GitHub 仓库
4. 选择 "Web Service"
5. 配置环境变量
6. 点击 "Create Web Service"

### 第 4 步：前端对接（15 分钟）

```typescript
// src/api/search.api.ts
const API_URL = import.meta.env.VITE_API_URL || 'https://your-app.onrender.com';

export async function streamSearch(query: string, onProgress: (data: any) => void) {
  const response = await fetch(`${API_URL}/api/search/stream?q=${query}`);
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        onProgress(data);
      }
    }
  }
}
```

## 🔄 渐进式升级路径

### 阶段 1: 最小实现（免费）
```
Render 免费版 + 内存缓存 + 内存队列
成本: $0
适用: MVP、小规模应用
```

### 阶段 2: 添加 Redis（免费）
```
Render 免费版 + Upstash Redis 免费版
成本: $0
适用: 中等规模应用
```

### 阶段 3: 付费升级（可选）
```
Render $7/月 + Upstash Redis $10/月
成本: $17/月
适用: 生产环境、高并发
```

## ✅ 最终建议

### 立即采用（完全免费）

1. **使用 Render 免费版部署 API**
   - 无需信用卡
   - 支持 SSE/WebSocket
   - 自动 HTTPS

2. **使用内存缓存和队列**
   - 简单够用
   - 无额外成本
   - 重启后丢失（可接受）

3. **保留 Supabase 认证和数据库**
   - 继续免费
   - 功能完整
   - 无需迁移

### 成本对比总结

| 方案 | 月成本 | 功能 | 推荐 |
|------|--------|------|------|
| 纯 Supabase Edge Functions | $0 | ⭐⭐ | ❌ |
| Render 免费 + 内存 | $0 | ⭐⭐⭐⭐ | ✅ **推荐** |
| Render 免费 + Upstash | $0 | ⭐⭐⭐⭐⭐ | ✅ **最佳** |
| Render 付费 + Redis | $17 | ⭐⭐⭐⭐⭐ | 生产环境 |

## 📝 下一步

1. 创建 GitHub 仓库
2. 复制最小 API 代码
3. 部署到 Render（10 分钟）
4. 前端对接测试
5. 逐步迁移功能

**结论：完全可以零成本实现自建 API，性能和功能都优于 Edge Functions！**
