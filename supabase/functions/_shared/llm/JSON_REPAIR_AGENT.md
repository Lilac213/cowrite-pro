# JSON 修复 Agent 文档

## 概述

`repairJSONAgent` 是 CoWrite 系统中的专用 JSON 修复工具，作为第四层防护机制，在所有常规解析方法失败后自动触发。

## 设计目标

**唯一任务**：将格式错误的 JSON 文本修复为 100% 合法、可被 `JSON.parse()` 解析的 JSON。

## 触发机制

### 自动触发

JSON 修复 Agent 会在以下情况自动触发：

1. **外层信封解析失败**
   ```typescript
   try {
     envelope = JSON.parse(normalized);
   } catch (envelopeError) {
     // 自动调用 repairJSONWithLLM
     const repaired = await repairJSONWithLLM(normalized);
     envelope = JSON.parse(repaired);
   }
   ```

2. **内层 payload 解析失败**
   ```typescript
   try {
     content = JSON.parse(payloadNormalized);
   } catch (payloadError) {
     // 自动调用 repairJSONWithLLM
     const repaired = await repairJSONWithLLM(payloadNormalized);
     content = JSON.parse(repaired);
   }
   ```

### 集成位置

- **文件**: `supabase/functions/_shared/llm/runtime/parseEnvelope.ts`
- **函数**: `parseEnvelope()` 和 `parsePayload()`
- **调用时机**: 在字符归一化和 JSON 提取之后，解析失败时

## 修复能力

### 支持的修复类型

| 问题类型 | 示例 | 修复后 |
|---------|------|--------|
| 中文引号 | `{"key":"value"}` | `{"key":"value"}` |
| 未转义换行 | `{"text":"line1\nline2"}` | `{"text":"line1\\nline2"}` |
| 未转义引号 | `{"text":"say "hi""}` | `{"text":"say \\"hi\\""}` |
| 末尾多余逗号 | `{"a":1,}` | `{"a":1}` |
| 缺少引号 | `{key:value}` | `{"key":"value"}` |
| 缺少括号 | `{"a":1` | `{"a":1}` |
| 属性名未加引号 | `{name:"John"}` | `{"name":"John"}` |
| 单引号字符串 | `{'key':'value'}` | `{"key":"value"}` |
| Markdown 包裹 | ` ```json\n{...}\n``` ` | `{...}` |
| 包含解释文字 | `这是JSON:\n{...}` | `{...}` |

## System Prompt

```
你是 CoWrite 系统的 JSON 修复 Agent。

你的唯一任务是：
将"格式错误的 JSON 文本"修复为"100% 合法、可被 JSON.parse() 解析的 JSON"。

⚠️ 你不能：
- 改写业务内容
- 增删字段
- 推测缺失语义
- 总结或解释
- 添加任何额外说明文字

⚠️ 你必须：
- 保留所有原始字段和值
- 只修复语法问题
- 保证输出是严格合法 JSON
- 只输出 JSON，不允许输出任何解释
- 如果输入不是 JSON，而是包含 JSON 的文本，请提取其中的 JSON 并修复

修复后 JSON 的字段结构必须与原始结构完全一致。
字段数量不能增加或减少。

只输出修复后的 JSON。
```

## User Prompt 模板

```
以下 JSON 存在语法错误，请修复：

====================
${brokenJson}
====================

请直接输出修复后的 JSON。
不要解释。
不要添加说明。
不要使用 markdown。
```

## 模型参数

```typescript
{
  model: 'gemini-2.0-flash-exp',
  temperature: 0,  // 确定性修复，不要随机
  maxTokens: 8192
}
```

**为什么 temperature = 0？**
- JSON 修复是确定性任务
- 不需要创造性或随机性
- 确保每次修复结果一致

## 验证机制

### 1. 可解析性验证

修复后立即验证是否可被 `JSON.parse()` 解析：

```typescript
try {
  JSON.parse(cleaned);
  console.log('[repairJSON] ✅ 修复成功，JSON 可解析');
  return cleaned;
} catch (parseError) {
  throw new Error(`JSON 修复失败: 修复后仍无法解析`);
}
```

### 2. 结构一致性检查

使用 `isSameShape()` 函数检查修复前后的结构：

```typescript
if (originalContent && !isSameShape(originalContent, content)) {
  console.error('[parseEnvelope] ⚠️ 警告: 修复后的结构与原始不一致');
}
```

**检查内容**：
- 字段数量是否一致
- 字段名是否一致
- 数据类型是否一致

## 工作流程

```
┌─────────────────────────────────────────┐
│  LLM 输出原始文本                        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Layer 1: 提取第一个 JSON 块             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Layer 2: 字符归一化清洗                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Layer 3: 尝试 JSON.parse()              │
└─────────────────┬───────────────────────┘
                  │
                  ├─ 成功 ──────────────┐
                  │                      │
                  ├─ 失败               │
                  │                      │
                  ▼                      │
┌─────────────────────────────────────────┐│
│  Layer 4: 调用 repairJSONAgent          ││
│  - 使用 LLM 修复格式错误                ││
│  - temperature = 0                      ││
│  - 清理 markdown 包裹                   ││
└─────────────────┬───────────────────────┘│
                  │                      │
                  ▼                      │
┌─────────────────────────────────────────┐│
│  验证修复结果                            ││
│  - 可解析性检查                          ││
│  - 结构一致性检查                        ││
└─────────────────┬───────────────────────┘│
                  │                      │
                  └──────────────────────┤
                                         │
                                         ▼
                              ┌─────────────────┐
                              │  返回解析后的    │
                              │  JSON 对象       │
                              └─────────────────┘
```

## 使用示例

### 示例 1: 中文引号

**输入**：
```json
{"topic":"人工智能","description":"这是一个关于AI的文章"}
```

**修复后**：
```json
{"topic":"人工智能","description":"这是一个关于AI的文章"}
```

### 示例 2: 未转义换行

**输入**：
```json
{"content":"第一行
第二行"}
```

**修复后**：
```json
{"content":"第一行\n第二行"}
```

### 示例 3: Markdown 包裹

**输入**：
````
```json
{"key": "value"}
```
````

**修复后**：
```json
{"key": "value"}
```

### 示例 4: 包含解释文字

**输入**：
```
这是生成的 JSON 结果：
{"result": "success"}
希望这个结果对你有帮助。
```

**修复后**：
```json
{"result": "success"}
```

## 性能考虑

### 成本

- **触发频率**: 仅在常规解析失败时触发（预计 < 5% 的情况）
- **额外 LLM 调用**: 每次修复需要 1 次额外的 LLM API 调用
- **延迟**: 增加约 1-3 秒的处理时间

### 优化策略

1. **前置防护优先**
   - Layer 1-3 已经能处理大部分格式问题
   - JSON 修复作为最后的降级方案

2. **快速失败**
   - 如果修复后仍无法解析，立即抛出错误
   - 不进行多次修复尝试

3. **日志记录**
   - 记录所有修复操作，便于分析和优化
   - 识别高频错误模式，改进前置防护

## 限制与注意事项

### 不能修复的情况

1. **严重的结构缺失**
   - 缺少大量字段
   - 数据完全损坏

2. **语义错误**
   - 字段值的业务逻辑错误
   - 数据类型不符合业务要求

3. **超大文本**
   - 超过模型 token 限制的 JSON

### 最佳实践

1. **优先改进 Prompt**
   - 在 Agent 的 System Prompt 中明确 JSON 格式要求
   - 提供 JSON 输出示例

2. **监控修复率**
   - 如果修复率过高（> 10%），说明前置防护需要改进
   - 分析修复日志，找出高频错误模式

3. **结构验证**
   - 修复后务必验证字段完整性
   - 使用 Schema 验证确保数据质量

## 相关文件

- **Agent 实现**: `supabase/functions/_shared/llm/agents/repairJSONAgent.ts`
- **集成位置**: `supabase/functions/_shared/llm/runtime/parseEnvelope.ts`
- **Runtime**: `supabase/functions/_shared/llm/runtime/LLMRuntime.ts`
- **文档**: `supabase/functions/_shared/llm/README.md`

## 更新日志

- **2026-02-12**: 初始版本，支持基础 JSON 格式修复
- **2026-02-12**: 集成到 parseEnvelope，作为第四层防护
- **2026-02-12**: 添加结构一致性验证
