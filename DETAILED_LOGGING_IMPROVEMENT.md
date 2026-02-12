# 详细日志改进文档

## 改进概述

为了更好地诊断"返回的结构缺少必要字段"错误，我们在所有 Edge Functions 和核心解析模块中添加了详细的日志记录。

## 改进目标

1. **明确缺失字段**: 日志中清楚显示具体缺失的字段名称
2. **记录输入输出**: 完整记录 LLM 的输入和输出数据
3. **显示实际字段**: 展示返回数据中实际包含的字段列表
4. **便于调试**: 提供足够的信息快速定位问题

## 改进内容

### 1. parseEnvelope 模块日志增强

**文件**: `supabase/functions/_shared/llm/runtime/parseEnvelope.ts`

#### 输入日志

```typescript
console.log('[parseEnvelope] 原始文本长度:', rawText.length);
console.log('[parseEnvelope] 原始文本前300字符:', rawText.substring(0, 300));
```

#### 直接 Payload 格式输出日志

```typescript
console.log('[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理');
console.log('[parseEnvelope] 输出数据类型:', typeof envelope);
console.log('[parseEnvelope] 输出数据字段:', envelope ? Object.keys(envelope).join(', ') : 'null');
console.log('[parseEnvelope] 输出数据内容（前500字符）:', JSON.stringify(envelope).substring(0, 500));
```

#### 标准信封格式输出日志

```typescript
console.log('[parseEnvelope] ✅ 解析完成');
console.log('[parseEnvelope] 输出数据类型:', typeof content);
console.log('[parseEnvelope] 输出数据字段:', content ? Object.keys(content).join(', ') : 'null');
console.log('[parseEnvelope] 输出数据内容（前500字符）:', JSON.stringify(content).substring(0, 500));
```

### 2. generate-article-structure 日志增强

**文件**: `supabase/functions/generate-article-structure/index.ts`

#### 验证日志

```typescript
console.log('[generate-article-structure] JSON解析完成，验证必要字段');
console.log('[generate-article-structure] 解析结果类型:', typeof structure);
console.log('[generate-article-structure] 解析结果内容:', JSON.stringify(structure, null, 2));
```

#### 错误日志

```typescript
const missingFields = [];
if (!structure.core_thesis) missingFields.push('core_thesis');
if (!structure.argument_blocks) missingFields.push('argument_blocks');

if (missingFields.length > 0) {
  console.error('[generate-article-structure] ❌ 返回的结构缺少必要字段:', missingFields.join(', '));
  console.error('[generate-article-structure] 实际字段列表:', Object.keys(structure).join(', '));
  console.error('[generate-article-structure] 完整结构内容:', JSON.stringify(structure, null, 2));
  throw new Error(`返回的结构缺少必要字段: ${missingFields.join(', ')}。实际字段: ${Object.keys(structure).join(', ')}`);
}
```

### 3. adjust-article-structure 日志增强

**文件**: `supabase/functions/adjust-article-structure/index.ts`

```typescript
console.log('[adjust-article-structure] 验证返回结构');
console.log('[adjust-article-structure] 返回数据类型:', typeof adjustedData);
console.log('[adjust-article-structure] 返回数据内容:', JSON.stringify(adjustedData, null, 2));

const missingFields = [];
if (!adjustedData.core_thesis) missingFields.push('core_thesis');
if (!adjustedData.argument_blocks) missingFields.push('argument_blocks');

if (missingFields.length > 0) {
  console.error('[adjust-article-structure] ❌ 返回的结构缺少必要字段:', missingFields.join(', '));
  console.error('[adjust-article-structure] 实际字段列表:', Object.keys(adjustedData).join(', '));
  console.error('[adjust-article-structure] 完整结构内容:', JSON.stringify(adjustedData, null, 2));
  throw new Error(`返回的结构缺少必要字段: ${missingFields.join(', ')}。实际字段: ${Object.keys(adjustedData).join(', ')}`);
}
```

### 4. verify-coherence 日志增强

**文件**: `supabase/functions/verify-coherence/index.ts`

```typescript
console.log('[verify-coherence] 验证返回结构');
console.log('[verify-coherence] 返回数据类型:', typeof result);
console.log('[verify-coherence] 返回数据内容:', JSON.stringify(result, null, 2));

if (!result.coherence_check) {
  console.error('[verify-coherence] ❌ 返回的结构缺少必要字段: coherence_check');
  console.error('[verify-coherence] 实际字段列表:', Object.keys(result).join(', '));
  console.error('[verify-coherence] 完整结构内容:', JSON.stringify(result, null, 2));
  throw new Error(`返回的结构缺少必要字段: coherence_check。实际字段: ${Object.keys(result).join(', ')}`);
}
```

### 5. generate-evidence 日志增强

**文件**: `supabase/functions/generate-evidence/index.ts`

```typescript
console.log('[generate-evidence] 验证返回结构');
console.log('[generate-evidence] 返回数据类型:', typeof result);
console.log('[generate-evidence] 返回数据内容:', JSON.stringify(result, null, 2));

if (!result.supporting_materials) {
  console.error('[generate-evidence] ❌ 返回的结构缺少必要字段: supporting_materials');
  console.error('[generate-evidence] 实际字段列表:', Object.keys(result).join(', '));
  console.error('[generate-evidence] 完整结构内容:', JSON.stringify(result, null, 2));
  throw new Error(`返回的结构缺少必要字段: supporting_materials。实际字段: ${Object.keys(result).join(', ')}`);
}
```

### 6. generate-paragraph-structure 日志增强

**文件**: `supabase/functions/generate-paragraph-structure/index.ts`

```typescript
console.log('[generate-paragraph-structure] 验证返回结构');
console.log('[generate-paragraph-structure] 返回数据类型:', typeof structure);
console.log('[generate-paragraph-structure] 返回数据内容:', JSON.stringify(structure, null, 2));

const missingFields = [];
if (!structure.core_claim) missingFields.push('core_claim');
if (!structure.sub_claims) missingFields.push('sub_claims');

if (missingFields.length > 0) {
  console.error('[generate-paragraph-structure] ❌ 返回的结构缺少必要字段:', missingFields.join(', '));
  console.error('[generate-paragraph-structure] 实际字段列表:', Object.keys(structure).join(', '));
  console.error('[generate-paragraph-structure] 完整结构内容:', JSON.stringify(structure, null, 2));
  throw new Error(`返回的结构缺少必要字段: ${missingFields.join(', ')}。实际字段: ${Object.keys(structure).join(', ')}`);
}
```

## 日志示例

### 场景 1: 成功解析（标准信封格式）

```
[parseEnvelope] 原始文本长度: 1234
[parseEnvelope] 原始文本前300字符: {"meta":{"agent":"structure-agent"...
[parseEnvelope] 提取后长度: 1200
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: { agent: 'structure-agent', ... }
[parseEnvelope] payload 解析成功
[parseEnvelope] ✅ 解析完成
[parseEnvelope] 输出数据类型: object
[parseEnvelope] 输出数据字段: core_thesis, argument_blocks, status
[parseEnvelope] 输出数据内容（前500字符）: {"core_thesis":"AI Agent...
[generate-article-structure] JSON解析完成，验证必要字段
[generate-article-structure] 解析结果类型: object
[generate-article-structure] 解析结果内容: {
  "core_thesis": "...",
  "argument_blocks": [...]
}
```

### 场景 2: 成功解析（直接 Payload 格式）

```
[parseEnvelope] 原始文本长度: 1234
[parseEnvelope] 原始文本前300字符: {"core_thesis":"AI Agent...
[parseEnvelope] 提取后长度: 1200
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: undefined
[parseEnvelope] ⚠️ 信封格式不完整，尝试将整个 JSON 作为 payload 处理
[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理
[parseEnvelope] 输出数据类型: object
[parseEnvelope] 输出数据字段: core_thesis, argument_blocks, status
[parseEnvelope] 输出数据内容（前500字符）: {"core_thesis":"AI Agent...
[generate-article-structure] JSON解析完成，验证必要字段
[generate-article-structure] 解析结果类型: object
[generate-article-structure] 解析结果内容: {
  "core_thesis": "...",
  "argument_blocks": [...]
}
```

### 场景 3: 缺少必要字段（错误）

```
[parseEnvelope] 原始文本长度: 1234
[parseEnvelope] 原始文本前300字符: {"topic":"AI Agent...
[parseEnvelope] 提取后长度: 1200
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: undefined
[parseEnvelope] ⚠️ 信封格式不完整，尝试将整个 JSON 作为 payload 处理
[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理
[parseEnvelope] 输出数据类型: object
[parseEnvelope] 输出数据字段: topic, requirement_meta
[parseEnvelope] 输出数据内容（前500字符）: {"topic":"AI Agent","requirement_meta":{...
[generate-article-structure] JSON解析完成，验证必要字段
[generate-article-structure] 解析结果类型: object
[generate-article-structure] 解析结果内容: {
  "topic": "AI Agent",
  "requirement_meta": {...}
}
[generate-article-structure] ❌ 返回的结构缺少必要字段: core_thesis, argument_blocks
[generate-article-structure] 实际字段列表: topic, requirement_meta
[generate-article-structure] 完整结构内容: {
  "topic": "AI Agent",
  "requirement_meta": {...}
}
Error: 返回的结构缺少必要字段: core_thesis, argument_blocks。实际字段: topic, requirement_meta
```

## 优势

### 1. 快速定位问题

- ✅ 明确显示缺失的字段名称
- ✅ 显示实际返回的字段列表
- ✅ 提供完整的数据内容用于分析

### 2. 完整的数据追踪

- ✅ 记录 LLM 原始输入（前300字符）
- ✅ 记录解析后的输出（完整结构）
- ✅ 记录数据类型和字段列表

### 3. 更好的错误消息

- ✅ 错误消息包含具体缺失字段
- ✅ 错误消息包含实际字段列表
- ✅ 便于前端展示和用户理解

### 4. 便于调试

- ✅ 日志层次清晰，易于追踪
- ✅ 使用 emoji 标记（✅ ❌ ⚠️）提高可读性
- ✅ 提供足够的上下文信息

## 部署状态

✅ 所有 11 个 Edge Functions 已成功部署最新版本：
- brief-agent
- research-retrieval
- research-synthesis
- structure-agent
- draft-agent
- review-agent
- adjust-article-structure
- generate-article-structure
- verify-coherence
- generate-evidence
- generate-paragraph-structure

## 监控建议

### 1. 日志查询

使用 Supabase Dashboard 查询日志：

```sql
-- 查询缺少字段的错误
SELECT *
FROM edge_logs
WHERE message LIKE '%缺少必要字段%'
ORDER BY timestamp DESC
LIMIT 100;
```

### 2. 关键指标

监控以下指标：
- 缺少字段错误的频率
- 最常缺失的字段名称
- 直接 Payload 格式的使用频率
- JSON 修复的成功率

### 3. 告警设置

建议设置告警：
- 缺少字段错误超过阈值（如 5次/小时）
- 特定字段频繁缺失
- JSON 修复失败率过高

## 总结

通过添加详细的日志记录，我们现在可以：

✅ 快速识别缺失的具体字段
✅ 完整追踪数据流转过程
✅ 提供更有用的错误消息
✅ 大幅提升调试效率
✅ 更好地理解 LLM 的返回格式

这一改进将显著提高系统的可维护性和问题诊断能力！
