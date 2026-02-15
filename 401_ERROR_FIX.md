# 401 错误修复指南

## 问题原因

`research-retrieval-streaming` 函数返回 401 错误，说明：

1. **函数尚未部署** - 最常见的原因
2. **或者部署时设置了 JWT 验证策略**

## 解决方案

### 步骤 1：部署函数

在您的本机终端执行：

```bash
# 确保 supabase CLI 可用
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

# 登录 Supabase
supabase login

# 链接到您的项目
supabase link --project-ref YOUR_PROJECT_REF

# 部署函数（无 JWT 验证）
supabase functions deploy research-retrieval-streaming --no-verify-jwt
```

### 步骤 2：如果已经部署但仍然 401

检查函数的 JWT 设置：

```bash
# 查看已部署的函数列表
supabase functions list

# 重新部署，明确指定不需要 JWT
supabase functions deploy research-retrieval-streaming --no-verify-jwt
```

### 步骤 3：验证部署

部署完成后，测试函数是否可访问：

```bash
# 使用 curl 测试（需要替换 YOUR_PROJECT_REF 和 ACCESS_TOKEN）
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-retrieval-streaming \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"requirementsDoc": {"topic": "test"}}'
```

## 重要说明

### 关于 JWT 验证

- 当前函数代码中没有 JWT 验证逻辑
- 但 Supabase Edge Functions 默认可能需要 JWT
- 使用 `--no-verify-jwt` 参数部署可以禁用 JWT 验证

### 前端代码中的认证

前端代码已经正确添加了 Authorization 头：

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/research-retrieval-streaming`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,  // ✅ 已添加
  },
  body: JSON.stringify({...}),
});
```

### 部署后仍然 401？

如果部署后仍然出现 401，请检查：

1. **CORS 配置** - 确保函数允许跨域请求
2. **函数 URL** - 确认 URL 正确无误
3. **Supabase 项目** - 确认链接到正确的项目

## 快速诊断

在浏览器控制台执行以下代码测试：

```javascript
// 测试函数是否可访问
fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-retrieval-streaming', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session.access_token
  },
  body: JSON.stringify({requirementsDoc: {topic: 'test'}})
}).then(r => console.log('Status:', r.status))
```

如果返回 401，说明函数需要部署或重新配置。
