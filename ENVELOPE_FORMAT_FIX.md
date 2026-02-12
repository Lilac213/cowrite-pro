# 信封格式无效错误修复

## 错误描述

**错误信息**:
```
JSON解析失败: 信封JSON解析失败: 信封格式无效: 缺少 meta 或 payload 不是字符串
```

**错误位置**: `parseEnvelope.ts:99`

**错误堆栈**:
```
Error: 信封JSON解析失败: 信封格式无效: 缺少 meta 或 payload 不是字符串
    at parseEnvelope (file:///var/tmp/sb-compile-edge-runtime/source/llm/runtime/parseEnvelope.ts:99:11)
```

## 根本原因

### 预期的信封格式

系统期望 LLM 返回以下格式的 JSON：

```json
{
  "meta": {
    "agent": "brief-agent",
    "timestamp": "2026-02-11T10:30:00Z",
    "thought": "分析用户需求..."
  },
  "payload": "{\"topic\":\"AI Agent\",\"requirement_meta\":{...}}"
}
```

**关键特征**:
- 外层有 `meta` 对象
- `payload` 是一个 **JSON 字符串**（不是对象）

### 实际返回的格式

但有时 LLM 会直接返回 payload 内容，而不包装在信封中：

```json
{
  "topic": "AI Agent",
  "requirement_meta": {
    "document_type": "blog",
    "target_audience": "开发者"
  }
}
```

**问题**:
- 没有 `meta` 字段
- 直接返回了 payload 对象（不是字符串）

### 为什么会发生

1. **LLM 理解偏差**: 有时 LLM 会忽略信封格式要求，直接返回业务数据
2. **Prompt 不够明确**: 信封格式的要求可能在某些情况下被 LLM 忽略
3. **双重 LLM 回退**: Qwen API 可能对信封格式的理解与 Gemini 不同

## 解决方案

### 实现回退机制

在 `parseEnvelope.ts` 中添加回退逻辑：

```typescript
// Step 4: 验证信封结构
if (!envelope.meta || typeof envelope.payload !== 'string') {
  console.warn('[parseEnvelope] 信封格式不完整，尝试将整个 JSON 作为 payload 处理');
  
  // 如果没有标准信封结构，尝试将整个 JSON 作为 payload
  // 这种情况下，LLM 可能直接返回了 payload 内容而不是信封
  try {
    // 检查 normalized 是否是有效的 JSON 对象（而不是信封）
    const directPayload = JSON.parse(normalized);
    
    // 如果解析成功，说明这是一个有效的 JSON 对象
    // 我们将它作为 payload 返回
    console.log('[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理');
    return {
      meta: {
        agent: 'unknown',
        timestamp: new Date().toISOString(),
        thought: 'LLM 直接返回了 payload，未使用信封格式'
      },
      payload: directPayload
    };
  } catch (directParseError) {
    console.error('[parseEnvelope] 无法将 JSON 作为 payload 处理:', directParseError);
    throw new Error('信封格式无效: 缺少 meta 或 payload 不是字符串');
  }
}
```

### 处理流程

```
LLM 返回 JSON
    ↓
尝试解析为信封格式
    ├─ 有 meta 和 payload（字符串）→ ✅ 标准信封格式
    └─ 缺少 meta 或 payload 不是字符串 ↓
        ├─ 尝试将整个 JSON 作为 payload
        │   ├─ 解析成功 → ✅ 直接 payload 格式
        │   │   └─ 自动包装为信封格式
        │   └─ 解析失败 → ❌ 抛出错误
        └─ 返回包装后的结果
```

## 改进效果

### 之前

```
LLM 返回直接 payload → 信封验证失败 → 系统崩溃 ❌
```

### 现在

```
LLM 返回直接 payload → 信封验证失败 → 自动包装为信封 → 继续处理 ✅
```

### 兼容性

| LLM 返回格式 | 之前 | 现在 |
|-------------|------|------|
| 标准信封格式 | ✅ 成功 | ✅ 成功 |
| 直接 payload | ❌ 失败 | ✅ 成功（自动包装） |
| 无效 JSON | ❌ 失败 | ❌ 失败（但有明确错误） |

## 日志示例

### 场景 1: 标准信封格式（正常）

```
[parseEnvelope] JSON 提取成功，长度: 1234
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: { agent: 'brief-agent', ... }
[parseEnvelope] payload 解析成功
```

### 场景 2: 直接 payload 格式（回退）

```
[parseEnvelope] JSON 提取成功，长度: 1234
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: undefined
[parseEnvelope] ⚠️ 信封格式不完整，尝试将整个 JSON 作为 payload 处理
[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理
```

### 场景 3: 无效 JSON（失败）

```
[parseEnvelope] JSON 提取成功，长度: 1234
[parseEnvelope] 归一化完成
[parseEnvelope] 外层信封解析成功, meta: undefined
[parseEnvelope] ⚠️ 信封格式不完整，尝试将整个 JSON 作为 payload 处理
[parseEnvelope] ❌ 无法将 JSON 作为 payload 处理: SyntaxError: ...
[parseEnvelope] 抛出错误: 信封格式无效: 缺少 meta 或 payload 不是字符串
```

## 自动包装逻辑

当检测到 LLM 直接返回 payload 时，系统会自动包装为标准信封格式：

```typescript
// LLM 返回
{
  "topic": "AI Agent",
  "requirement_meta": { ... }
}

// 自动包装后
{
  "meta": {
    "agent": "unknown",
    "timestamp": "2026-02-11T10:30:00Z",
    "thought": "LLM 直接返回了 payload，未使用信封格式"
  },
  "payload": {
    "topic": "AI Agent",
    "requirement_meta": { ... }
  }
}
```

## 优势

### 1. 更强的容错能力

- ✅ 兼容标准信封格式
- ✅ 兼容直接 payload 格式
- ✅ 自动适配不同 LLM 的返回格式

### 2. 更好的用户体验

- ✅ 减少因格式问题导致的失败
- ✅ 透明处理，用户无感知
- ✅ 详细日志，便于调试

### 3. 双重 LLM 兼容性

- ✅ Gemini 和 Qwen 可能有不同的格式理解
- ✅ 自动适配两种 LLM 的返回格式
- ✅ 提高双重 LLM 回退的成功率

## 部署状态

所有 9 个 Edge Functions 已部署此修复:

1. ✅ brief-agent
2. ✅ research-retrieval
3. ✅ research-synthesis
4. ✅ structure-agent
5. ✅ draft-agent
6. ✅ review-agent
7. ✅ adjust-article-structure
8. ✅ generate-article-structure
9. ✅ verify-coherence

## 监控建议

### 关键指标

1. **标准信封格式比例**: 应 > 90%
2. **直接 payload 格式比例**: 应 < 10%
3. **完全失败比例**: 应 < 1%

### 日志关键字

- `[parseEnvelope] 外层信封解析成功` - 标准格式
- `[parseEnvelope] ✅ 将整个 JSON 作为 payload 处理` - 直接 payload
- `[parseEnvelope] ❌ 无法将 JSON 作为 payload 处理` - 失败

### 告警阈值

- ⚠️ 直接 payload 格式 > 20% → 检查 LLM prompt 是否需要优化
- 🚨 完全失败 > 2% → 检查 LLM 返回格式是否异常

## 相关文档

- `DUAL_LLM_FALLBACK.md` - 双重 LLM 回退机制
- `JSON_REPAIR_400_FIX.md` - 400 错误修复
- `ERROR_FIXES_SUMMARY.md` - 所有错误修复总结

## 总结

通过添加直接 payload 格式的回退处理，系统现在可以：

✅ 兼容标准信封格式和直接 payload 格式
✅ 自动适配不同 LLM 的返回格式
✅ 提高双重 LLM 回退的成功率
✅ 减少因格式问题导致的失败
✅ 提供详细的日志记录

这一改进进一步增强了系统的容错能力和稳定性！
