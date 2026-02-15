# Supabase Edge Functions 部署指南 - 无JWT验证版本

## 当前状态

✅ 您的函数已经**不需要JWT验证**，因为：

1. 函数代码中没有JWT验证逻辑
2. 默认情况下，Supabase Edge Functions默认是公开可访问的

## 部署步骤

### 1. 安装Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# 或者从官网下载
# https://supabase.com/docs/guides/cli/getting-started
```

### 2. 登录Supabase

```bash
supabase login
```

### 3. 链接到您的项目

```bash
# 找到您的项目ID（在Supabase Dashboard的设置中）
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. 部署函数（无JWT验证）

```bash
# 部署 research-retrieval-agent
supabase functions deploy research-retrieval-agent

# 部署 research-retrieval-streaming
supabase functions deploy research-retrieval-streaming
```

### 5. 验证部署

部署后，函数URL格式为：
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-retrieval-agent
https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-retrieval-streaming
```

## 常见问题

### Q: 函数需要认证吗？

**不需要**。当前函数是公开的，可以被任何调用者访问。

### Q: 如何测试函数？

可以使用curl直接测试：

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-retrieval-agent \
  -H "Content-Type: application/json" \
  -d '{"requirementsDoc": "test"}'
```

### Q: 如果我想添加JWT验证，怎么做？

如果未来需要添加JWT验证，可以在函数开头添加：

```typescript
// 从请求头获取JWT
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

const token = authHeader.replace('Bearer ', '');
// 使用supabase.auth.getUser(token)验证
```

### Q: CORS配置

当前CORS配置已经设置为允许所有来源：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Q: 如何查看已部署的函数？

在Supabase Dashboard中：
1. 导航到 **Edge Functions**
2. 可以看到所有已部署的函数
3. 可以查看日志和调用统计
