# Edge Function 修复说明

## 问题描述

用户在使用"生成文章结构"功能时遇到 500 错误：

```
Error: 返回的结构缺少必要字段: core_thesis, argument_blocks。实际字段: type, payload
```

## 根本原因

LLM 返回的响应格式与 `parseEnvelope` 函数预期的格式不匹配：

### LLM 实际返回格式
```json
{
  "type": "article_structure",
  "payload": {
    "core_thesis": "...",
    "argument_blocks": [...]
  }
}
```

### parseEnvelope 原本支持的格式
1. **标准信封格式**: `{ meta: {...}, payload: "..." }` (payload 是字符串)
2. **直接返回格式**: `{ core_thesis: "...", argument_blocks: [...] }` (无信封)

### 问题所在
LLM 返回的是**简化信封格式**: `{ type: "...", payload: {...} }`，其中 payload 是对象而非字符串。

原代码只检查 `!envelope.meta || typeof envelope.payload !== 'string'`，这会将简化信封格式误判为"直接返回格式"，导致返回整个 `{ type, payload }` 对象，而不是提取 `payload` 内容。

## 解决方案

更新 `parseEnvelope.ts` 文件，添加对简化信封格式的支持：

```typescript
// Step 4: 验证信封结构
// 处理三种可能的格式：
// 1. 标准信封: { meta: {...}, payload: "..." }
// 2. 简化信封: { type: "...", payload: {...} }
// 3. 直接返回: { core_thesis: "...", argument_blocks: [...] }

if (envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)) {
  // 格式2: { type: "...", payload: {...} } - payload 是对象
  console.log('[parseEnvelope] 检测到简化信封格式（payload 为对象），直接返回 payload');
  console.log('[parseEnvelope] ✅ 输出数据类型:', typeof envelope.payload);
  console.log('[parseEnvelope] 输出数据字段:', Object.keys(envelope.payload).join(', '));
  console.log('[parseEnvelope] 输出数据内容（前500字符）:', JSON.stringify(envelope.payload).substring(0, 500));
  return envelope.payload;
}

if (!envelope.meta || typeof envelope.payload !== 'string') {
  // 格式3: 直接返回完整对象
  console.warn('[parseEnvelope] 信封格式不完整，尝试将整个 JSON 作为 payload 处理');
  
  // 如果没有标准信封结构，说明 LLM 可能直接返回了 payload 内容
  // envelope 变量已经是解析后的对象，直接返回它作为 payload
  console.log('[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理');
  console.log('[parseEnvelope] 输出数据类型:', typeof envelope);
  console.log('[parseEnvelope] 输出数据字段:', envelope ? Object.keys(envelope).join(', ') : 'null');
  console.log('[parseEnvelope] 输出数据内容（前500字符）:', JSON.stringify(envelope).substring(0, 500));
  return envelope;
}
```

## 修复逻辑

1. **首先检查简化信封格式**: 如果 `envelope.payload` 存在且是对象（非数组），直接返回 `envelope.payload`
2. **然后检查直接返回格式**: 如果没有 `meta` 字段或 `payload` 不是字符串，返回整个 `envelope` 对象
3. **最后处理标准信封格式**: 解析 `payload` 字符串并返回

## 已更新的文件

### 核心文件（已部署）
- ✅ `supabase/functions/generate-article-structure/llm/runtime/parseEnvelope.ts` (已部署)
- ✅ `supabase/functions/structure-agent/llm/runtime/parseEnvelope.ts` (已部署)
- ✅ `supabase/functions/adjust-article-structure/llm/runtime/parseEnvelope.ts` (已部署)
- ✅ `supabase/functions/_shared/llm/runtime/parseEnvelope.ts` (已更新)

### 待更新文件（非紧急）
- ⏳ `supabase/functions/brief-agent/llm/runtime/parseEnvelope.ts`
- ⏳ `supabase/functions/draft-agent/llm/runtime/parseEnvelope.ts`
- ⏳ `supabase/functions/research-retrieval/llm/runtime/parseEnvelope.ts`
- ⏳ `supabase/functions/review-agent/llm/runtime/parseEnvelope.ts`
- ⏳ `supabase/functions/verify-coherence/llm/runtime/parseEnvelope.ts`
- ⏳ `supabase/functions/research-synthesis/llm/runtime/parseEnvelope.ts`

## 测试验证

### 测试步骤
1. 进入项目工作流页面
2. 完成"素材审阅"阶段
3. 点击"进入下一阶段"按钮
4. 观察是否成功生成文章结构

### 预期结果
- ✅ 不再出现 500 错误
- ✅ 成功返回包含 `core_thesis` 和 `argument_blocks` 的结构
- ✅ 控制台日志显示 "检测到简化信封格式（payload 为对象），直接返回 payload"

### 错误日志示例（修复前）
```
[Error] [callArticleStructureAgent] Edge Function 错误:
FunctionsHttpError: Edge Function returned a non-2xx status code

[Error] [callArticleStructureAgent] 错误响应内容:
{"error":"返回的结构缺少必要字段: core_thesis, argument_blocks。实际字段: type, payload"}
```

### 成功日志示例（修复后）
```
[parseEnvelope] 检测到简化信封格式（payload 为对象），直接返回 payload
[parseEnvelope] ✅ 输出数据类型: object
[parseEnvelope] 输出数据字段: core_thesis, argument_blocks, status, allowed_user_actions
[generate-article-structure] 核心论点: ...
[generate-article-structure] 论证块数量: 3
[generate-article-structure] ========== 请求处理成功 ==========
```

## 影响范围

### 直接影响
- **generate-article-structure**: 生成文章结构功能（已修复）
- **structure-agent**: 结构代理功能（已修复）
- **adjust-article-structure**: 调整文章结构功能（已修复）

### 潜在影响
其他使用 `parseEnvelope` 的 Edge Functions 如果遇到相同的 LLM 响应格式，也会受益于此修复。

## 后续建议

1. **统一响应格式**: 建议在 LLM prompt 中明确要求使用标准信封格式 `{ meta: {...}, payload: "..." }`
2. **完善文档**: 在 `llm/README.md` 中记录所有支持的响应格式
3. **添加单元测试**: 为 `parseEnvelope` 函数添加测试用例，覆盖所有三种格式
4. **监控日志**: 观察生产环境中 LLM 实际返回的格式分布，优化解析策略

## 技术细节

### 为什么需要三种格式支持？

1. **标准信封格式**: 最规范，支持元数据和字符串化的 payload，便于传输和日志记录
2. **简化信封格式**: LLM 有时会直接返回对象形式的 payload，减少了一层字符串化
3. **直接返回格式**: 某些简单场景下，LLM 可能直接返回数据，无需信封包装

### 检测顺序的重要性

必须先检查简化信封格式，再检查直接返回格式，因为：
- 简化信封格式有 `payload` 字段（对象）
- 直接返回格式没有 `payload` 字段
- 如果先检查 `!envelope.meta`，简化信封格式会被误判为直接返回格式

### 类型安全

```typescript
// 确保 payload 是对象但不是数组
typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)
```

这个检查很重要，因为：
- `typeof [] === 'object'` 返回 `true`
- 我们需要排除数组类型
- 确保 payload 是真正的对象

## 总结

此修复通过增强 `parseEnvelope` 函数的格式兼容性，解决了 LLM 返回简化信封格式时的解析失败问题。修复后，系统可以正确处理三种不同的响应格式，提高了系统的健壮性和容错能力。
