# CORS 问题修复 - v138.2

## 问题描述

在 v138.1 更新后，research-synthesis-agent Edge Function 仍然出现 CORS 错误：

```
Access to fetch at 'https://...research-synthesis-agent' from origin 'https://app-9bwpferlujnl-vitesandbox.sandbox.medo.dev' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## 根本原因

Edge Function 的 CORS 配置**缺少关键的 `Access-Control-Allow-Methods` 响应头**。

### CORS Preflight 请求要求

当浏览器发起跨域 POST 请求时，会先发送一个 OPTIONS 预检请求（preflight request）。服务器必须返回以下响应头：

1. ✅ `Access-Control-Allow-Origin` - 允许的源（已有）
2. ✅ `Access-Control-Allow-Headers` - 允许的请求头（已有）
3. ❌ `Access-Control-Allow-Methods` - **允许的 HTTP 方法（缺失！）**
4. ✅ HTTP 状态码 200（已有，但不够明确）

### 之前的配置（错误）

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // ❌ 缺少 Access-Control-Allow-Methods
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
    // ⚠️ 状态码虽然默认是 200，但不够明确
  }
  // ...
});
```

### 现在的配置（正确）

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", // ✅ 添加了允许的方法
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
    // ✅ 明确指定 200 状态码
  }
  // ...
});
```

## 修复内容

### 1. research-synthesis-agent/index.ts

**修改位置**: Line 7-10

```diff
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
+ "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

**修改位置**: Line 159-161

```diff
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
-   return new Response(null, { headers: corsHeaders });
+   return new Response(null, { status: 200, headers: corsHeaders });
  }
```

### 2. llm-generate/index.ts

**修改位置**: Line 3-6

```diff
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
+ 'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

**修改位置**: Line 139-141

```diff
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
-   return new Response(null, { headers: corsHeaders });
+   return new Response(null, { status: 200, headers: corsHeaders });
  }
```

### 3. summarize-content/index.ts

**修改位置**: Line 3-6

```diff
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
+ 'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

**修改位置**: Line 153-155

```diff
serve(async (req) => {
  if (req.method === 'OPTIONS') {
-   return new Response('ok', { headers: corsHeaders });
+   return new Response(null, { status: 200, headers: corsHeaders });
  }
```

## 技术说明

### CORS Preflight 流程

1. **浏览器发起 OPTIONS 请求**
   ```http
   OPTIONS /functions/v1/research-synthesis-agent HTTP/1.1
   Origin: https://app-9bwpferlujnl-vitesandbox.sandbox.medo.dev
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: authorization, content-type
   ```

2. **服务器必须返回**
   ```http
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
   ```

3. **浏览器验证通过后，发起实际的 POST 请求**
   ```http
   POST /functions/v1/research-synthesis-agent HTTP/1.1
   Authorization: Bearer xxx
   Content-Type: application/json
   
   {"projectId": "xxx", "sessionId": "xxx"}
   ```

### 为什么之前没有这个问题？

可能的原因：
1. 之前的部署环境可能自动添加了这个响应头
2. 之前使用的 Supabase 客户端版本可能有不同的请求方式
3. 浏览器的 CORS 策略可能有变化

### 为什么需要明确指定 status: 200？

虽然 `new Response(null)` 默认返回 200 状态码，但：
1. **明确性**：代码意图更清晰
2. **兼容性**：某些环境可能对默认行为有不同实现
3. **调试性**：更容易理解和排查问题

## 验证方法

### 1. 浏览器开发者工具

打开 Network 面板，筛选 "research-synthesis-agent"：

**OPTIONS 请求（预检）**
- Status: 200 OK ✅
- Response Headers:
  - `Access-Control-Allow-Origin: *` ✅
  - `Access-Control-Allow-Methods: POST, OPTIONS` ✅
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` ✅

**POST 请求（实际调用）**
- Status: 200 OK ✅
- Response: JSON 数据 ✅

### 2. curl 测试

```bash
# 测试 OPTIONS 请求
curl -X OPTIONS \
  https://iupvpwpfhoonpzmosdgo.supabase.co/functions/v1/research-synthesis-agent \
  -H "Origin: https://app-9bwpferlujnl-vitesandbox.sandbox.medo.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type" \
  -v

# 应该看到：
# < HTTP/2 200
# < access-control-allow-origin: *
# < access-control-allow-methods: POST, OPTIONS
# < access-control-allow-headers: authorization, x-client-info, apikey, content-type
```

### 3. 应用内测试

1. 登录 CoWrite
2. 进入任意项目的"知识研究"阶段
3. 确保有搜索结果
4. 点击"资料整理"按钮
5. 查看浏览器控制台：
   - ❌ 之前：CORS 错误
   - ✅ 现在：成功调用，显示"启动 Research Synthesis Agent..."

## 部署状态

### Edge Functions 重新部署
- ✅ research-synthesis-agent (v138.2)
- ✅ llm-generate (v138.2)
- ✅ summarize-content (v138.2)

### 部署时间
2025-02-10 (v138.2)

## 相关资源

### MDN 文档
- [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Preflight request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
- [Access-Control-Allow-Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods)

### Supabase 文档
- [Edge Functions CORS](https://supabase.com/docs/guides/functions/cors)

## 总结

这是一个**经典的 CORS 配置错误**：

1. **问题**：缺少 `Access-Control-Allow-Methods` 响应头
2. **症状**：浏览器阻止跨域请求，显示 "doesn't pass access control check"
3. **修复**：添加 `Access-Control-Allow-Methods: "POST, OPTIONS"` 到 corsHeaders
4. **验证**：OPTIONS 预检请求返回 200 + 完整的 CORS 响应头

**关键教训**：CORS 配置必须包含三个核心响应头：
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Methods` ⭐

---

**状态**: ✅ 已修复并部署  
**版本**: v138.2  
**更新时间**: 2025-02-10
