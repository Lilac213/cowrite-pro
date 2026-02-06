# Edge Function 调用错误修复说明

## 问题描述

用户报告在搜索资料时出现以下错误：

```
Research Retrieval Agent Error:
FunctionsFetchError: Failed to send a request to the Edge Function
at @supabase_supabase-js@2:1855:12
```

后续还出现了 CORS 错误。

## 问题根因

在 `research-retrieval-agent` Edge Function 中，我们尝试使用 `supabase.functions.invoke()` 来调用另一个 Edge Function (`webpage-content-extract`)：

```typescript
// ❌ 错误的方式
const response = await supabase.functions.invoke('webpage-content-extract', {
  body: { url }
});
```

**问题**：
1. 在 Edge Function 内部使用 `supabase.functions.invoke()` 调用另一个 Edge Function 会导致 `FunctionsFetchError`
2. Supabase 客户端在 Edge Function 环境中的行为与在客户端不同
3. 缺少必要的环境变量（`SUPABASE_ANON_KEY`）

## 解决方案

### 1. 直接通过 HTTP 调用 Edge Function

将 `supabase.functions.invoke()` 改为直接的 HTTP 请求：

```typescript
// ✅ 正确的方式
const extractUrl = `${supabaseUrl}/functions/v1/webpage-content-extract`;
const response = await fetch(extractUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({ url })
});
```

### 2. 添加必要的环境变量

确保 Edge Function 可以访问 `SUPABASE_ANON_KEY`：

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!; // 新增
```

### 3. 优化全文提取策略

为了避免超时和提高性能，只对每个数据源的前 3 条结果进行全文提取：

```typescript
// 只对前3条进行全文提取，其余保留摘要
let fullTextData;
if (i < 3) {
  fullTextData = await fetchFullText(source.url, 'academic');
} else {
  fullTextData = {
    content_status: 'abstract_only',
    extracted_content: [source.abstract || ''],
    full_text: source.abstract || '',
    notes: '未提取全文（优先级较低）'
  };
}
```

### 4. 改进错误处理

添加更详细的错误日志和状态返回：

```typescript
if (!response.ok) {
  const errorText = await response.text();
  addLog(`[Content Fetch] HTTP 错误: ${response.status} - ${errorText}`);
  return {
    content_status: 'unavailable_fulltext',
    extracted_content: [],
    full_text: '',
    notes: `HTTP ${response.status}: ${errorText}`
  };
}

const data = await response.json();

if (!data.success) {
  addLog(`[Content Fetch] 提取失败: ${data.error || '未知错误'}`);
  return {
    content_status: data.content_status || 'unavailable_fulltext',
    extracted_content: [],
    full_text: '',
    notes: data.notes || data.error || '提取失败'
  };
}
```

## 修改的文件

1. **supabase/functions/research-retrieval-agent/index.ts**
   - 添加 `SUPABASE_ANON_KEY` 环境变量获取
   - 将 `supabase.functions.invoke()` 改为直接 HTTP 调用
   - 优化全文提取策略（只提取前 3 条）
   - 改进错误处理和日志记录

## 技术细节

### Edge Function 间调用的正确方式

在 Supabase Edge Functions 中，有两种方式调用另一个 Edge Function：

#### 方式 1: 直接 HTTP 调用（推荐）✅

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/function-name`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({ data })
});
```

**优点**：
- 可靠性高
- 错误处理清晰
- 支持所有 HTTP 方法
- 可以自定义请求头

**缺点**：
- 需要手动处理 HTTP 响应
- 代码稍微冗长

#### 方式 2: 使用 supabase.functions.invoke()（不推荐在 Edge Function 中使用）❌

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { data }
});
```

**问题**：
- 在 Edge Function 环境中可能失败
- 错误信息不清晰
- 依赖 Supabase 客户端的内部实现

### 性能优化策略

1. **限制全文提取数量**：只对每个数据源的前 3 条结果进行全文提取
2. **顺序执行**：避免并发过多导致超时
3. **快速失败**：对无法访问的 URL 快速返回错误状态
4. **保留摘要**：即使全文提取失败，也保留原始摘要

### 全文提取流程

```
搜索结果
    ↓
判断是否有 URL
    ├─ 无 URL → 标记为 abstract_only
    └─ 有 URL
        ↓
    判断优先级（前3条）
        ├─ 高优先级 → 调用 webpage-content-extract
        │   ├─ 成功 → 保存 full_text + extracted_content
        │   └─ 失败 → 保留摘要，标记状态
        └─ 低优先级 → 保留摘要，标记为 abstract_only
```

## 预期效果

修复后，系统应该能够：

1. ✅ 成功调用 `webpage-content-extract` Edge Function
2. ✅ 对前 3 条结果提取完整文本
3. ✅ 对其余结果保留摘要
4. ✅ 正确处理提取失败的情况
5. ✅ 避免 CORS 错误
6. ✅ 提供详细的日志信息

## 测试建议

1. **基本功能测试**：
   - 输入研究需求
   - 观察搜索进度
   - 检查是否出现错误

2. **内容质量测试**：
   - 查看前 3 条结果是否有完整内容
   - 检查内容状态标签是否正确
   - 验证摘要是否保留

3. **错误处理测试**：
   - 测试无法访问的 URL
   - 测试付费墙网站
   - 观察错误日志是否清晰

4. **性能测试**：
   - 记录搜索完成时间
   - 观察是否有超时
   - 检查日志中的提取时间

## 后续优化方向

1. **并行提取**：对前 3 条结果并行提取，而不是顺序执行
2. **智能优先级**：根据引用数、发布时间等因素动态调整优先级
3. **缓存机制**：对已提取的 URL 进行缓存
4. **重试机制**：对提取失败的 URL 进行智能重试
5. **用户配置**：允许用户配置全文提取的数量

## 部署状态

✅ **已部署**: `research-retrieval-agent` Edge Function (v2 - 修复版)

## 注意事项

1. **环境变量**：确保 Supabase 项目中已配置 `SUPABASE_ANON_KEY`
2. **API 限制**：Webpage Content Extract API 可能有速率限制
3. **超时设置**：Edge Function 默认超时时间为 150 秒
4. **内容长度**：完整文本可能较大，注意数据库存储限制
