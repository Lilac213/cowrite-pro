# 自建 API vs Supabase Edge Functions 对比分析

## 🔍 当前架构问题

### Supabase Edge Functions 的限制

1. **SSE (Server-Sent Events) 支持有限**
   - Edge Functions 基于 Deno Deploy，对长连接支持不佳
   - 流式响应容易超时
   - 难以实现复杂的实时推送

2. **并发控制困难**
   - 无法精确控制并发请求数
   - 难以实现请求队列和限流
   - 多个数据源并发查询管理复杂

3. **性能瓶颈**
   - 冷启动延迟（首次调用慢）
   - 执行时间限制（通常 60-150 秒）
   - 内存限制

4. **调试和监控困难**
   - 日志查看不便
   - 错误追踪困难
   - 性能分析工具有限

5. **成本问题**
   - 按调用次数计费
   - 高频调用成本高
   - 难以预测费用

## ✅ 自建 API 的优势

### 1. **完全控制**
```
自建 API 服务器
├── 完整的中间件支持
├── 自定义认证策略
├── 灵活的路由设计
├── 完整的错误处理
└── 性能优化空间大
```

### 2. **更好的实时功能**
- WebSocket 支持
- SSE 长连接稳定
- 实时推送可靠
- 自定义协议

### 3. **并发和队列管理**
- Bull/BullMQ 任务队列
- Redis 缓存层
- 请求限流和熔断
- 优先级队列

### 4. **成本可控**
- 固定服务器成本
- 可预测的费用
- 按需扩展

### 5. **开发体验**
- 本地调试方便
- 热重载
- 完整的 TypeScript 支持
- 丰富的生态系统

## 🎯 推荐架构方案

### 混合架构（最佳实践）

```
┌─────────────────────────────────────────────┐
│              前端应用 (React)                │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌──────────────────┐
│  自建 API     │   │  Supabase        │
│  (Node.js)    │   │  (直接访问)      │
├───────────────┤   ├──────────────────┤
│ • AI 调用     │   │ • 认证           │
│ • 搜索聚合    │   │ • 数据库 CRUD    │
│ • SSE 推送    │   │ • 文件存储       │
│ • 任务队列    │   │ • 简单查询       │
│ • 并发控制    │   │ • RLS 权限       │
└───────┬───────┘   └──────────────────┘
        │
        ▼
┌───────────────────┐
│   Supabase DB     │
│   (PostgreSQL)    │
└───────────────────┘
```

### 职责划分

#### 自建 API 负责：
1. **AI 相关功能**
   - LLM 调用（通义千问、GPT 等）
   - 流式响应处理
   - Token 计数和限流

2. **复杂搜索**
   - Google Scholar 爬取
   - 多源并发搜索
   - 结果聚合和排序
   - 相似度计算

3. **实时功能**
   - SSE 进度推送
   - WebSocket 通知
   - 实时协作

4. **后台任务**
   - 异步任务队列
   - 定时任务
   - 批量处理

#### Supabase 负责：
1. **认证授权**
   - 用户登录注册
   - JWT 验证
   - RLS 权限控制

2. **数据库操作**
   - 简单 CRUD
   - 关系查询
   - 实时订阅

3. **文件存储**
   - 文件上传下载
   - CDN 分发

## 🚀 实施方案

### 阶段 1: 搭建自建 API（1-2 周）

```typescript
// 技术栈推荐
{
  "framework": "Fastify / Express",
  "language": "TypeScript",
  "queue": "BullMQ + Redis",
  "cache": "Redis",
  "deployment": "Docker + Railway/Render/Fly.io"
}
```

**目录结构**：
```
api-server/
├── src/
│   ├── routes/
│   │   ├── ai.routes.ts          # AI 调用路由
│   │   ├── search.routes.ts      # 搜索路由
│   │   └── stream.routes.ts      # SSE 路由
│   ├── services/
│   │   ├── llm.service.ts        # LLM 服务
│   │   ├── search.service.ts     # 搜索服务
│   │   └── queue.service.ts      # 队列服务
│   ├── middleware/
│   │   ├── auth.middleware.ts    # 认证中间件
│   │   └── rate-limit.middleware.ts
│   └── utils/
│       ├── supabase.client.ts    # Supabase 客户端
│       └── redis.client.ts       # Redis 客户端
├── Dockerfile
└── package.json
```

### 阶段 2: 迁移核心功能（2-3 周）

**优先迁移**：
1. ✅ 研究检索 Agent（并发搜索）
2. ✅ 流式响应（SSE）
3. ✅ AI 生成（LLM 调用）
4. ✅ 任务队列（异步处理）

**保留在 Supabase**：
1. ✅ 用户认证
2. ✅ 数据库 CRUD
3. ✅ 文件存储
4. ✅ 简单查询

### 阶段 3: 优化和监控（持续）

1. **性能监控**
   - Prometheus + Grafana
   - 日志聚合（ELK/Loki）
   - APM 工具

2. **成本优化**
   - Redis 缓存策略
   - 请求合并
   - CDN 加速

## 💰 成本对比

### Supabase Edge Functions
```
假设：每月 100 万次调用
- 免费额度：50 万次
- 超出部分：$2/10 万次
- 月成本：$10

但实际：
- 冷启动影响用户体验
- 调试困难增加开发成本
- 功能受限需要额外方案
```

### 自建 API
```
Railway/Render 基础方案：
- 服务器：$5-20/月
- Redis：$5-10/月
- 总成本：$10-30/月

优势：
- 性能稳定
- 功能完整
- 开发效率高
- 可扩展性强
```

## 📊 决策矩阵

| 维度 | Supabase Edge Functions | 自建 API | 推荐 |
|------|------------------------|----------|------|
| 开发速度 | ⭐⭐⭐⭐ | ⭐⭐⭐ | Edge Functions（初期） |
| 功能完整性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | **自建 API** |
| 性能 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **自建 API** |
| 成本（小规模） | ⭐⭐⭐⭐ | ⭐⭐⭐ | Edge Functions |
| 成本（大规模） | ⭐⭐ | ⭐⭐⭐⭐⭐ | **自建 API** |
| 调试体验 | ⭐⭐ | ⭐⭐⭐⭐⭐ | **自建 API** |
| 可维护性 | ⭐⭐⭐ | ⭐⭐⭐⭐ | **自建 API** |
| 扩展性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | **自建 API** |

## 🎯 最终建议

### 立即行动（高优先级）

**建议采用混合架构**，原因：

1. **保留 Supabase 的优势**
   - 认证系统成熟稳定
   - 数据库 RLS 安全可靠
   - 文件存储开箱即用

2. **自建 API 解决痛点**
   - SSE 流式响应
   - 并发搜索控制
   - AI 调用管理
   - 任务队列处理

3. **渐进式迁移**
   - 先迁移最痛的功能（搜索、SSE）
   - 保持系统稳定运行
   - 降低风险

### 技术选型建议

```typescript
// 推荐技术栈
{
  "api": "Fastify (性能最佳) 或 Express (生态最好)",
  "queue": "BullMQ (功能强大) + Redis",
  "cache": "Redis (必备)",
  "monitoring": "Prometheus + Grafana",
  "deployment": "Docker + Railway (简单) 或 Fly.io (性能)",
  "database": "继续使用 Supabase PostgreSQL"
}
```

### 实施时间线

```
Week 1-2: 搭建基础 API 框架
  ├── 项目初始化
  ├── 认证中间件（验证 Supabase JWT）
  ├── 基础路由
  └── 部署到 Railway

Week 3-4: 迁移搜索功能
  ├── 实现并发搜索
  ├── SSE 流式响应
  ├── 结果缓存
  └── 前端对接

Week 5-6: 迁移 AI 功能
  ├── LLM 调用封装
  ├── Token 限流
  ├── 任务队列
  └── 错误重试

Week 7+: 优化和监控
  ├── 性能优化
  ├── 监控告警
  └── 成本优化
```

## 📝 下一步行动

1. **创建 API 服务器项目**
   ```bash
   mkdir api-server && cd api-server
   npm init -y
   npm install fastify @fastify/cors bullmq redis
   ```

2. **配置 Supabase 认证中间件**
   - 验证前端传来的 JWT
   - 从 JWT 提取用户信息

3. **实现第一个 API**
   - 研究检索 SSE 接口
   - 替换现有 Edge Function

4. **前端适配**
   - 修改 API 调用地址
   - 保持接口兼容

## 🔗 相关资源

- [Fastify 文档](https://www.fastify.io/)
- [BullMQ 文档](https://docs.bullmq.io/)
- [Railway 部署指南](https://docs.railway.app/)
- [Supabase JWT 验证](https://supabase.com/docs/guides/auth/server-side/verifying-jwts)
