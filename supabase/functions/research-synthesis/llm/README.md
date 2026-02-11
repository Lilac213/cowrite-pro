# LLM Agent 架构文档

## ⚠️ 重要说明

**这是所有 Agent 代码的唯一真实来源（Single Source of Truth）**

- ✅ 修改代码请在此目录（`_shared/llm`）进行
- ❌ 不要修改各 Edge Function 中的 `llm` 副本
- 🔄 修改后运行 `bash ../sync-shared.sh` 同步到各函数

### 为什么需要副本？

Supabase Edge Functions 部署系统不支持 `_shared` 目录的自动打包。因此：
1. 此目录（`_shared/llm`）是源代码
2. 各函数中的 `llm` 目录是部署前自动生成的副本
3. 同步脚本确保所有副本与源代码保持一致

详见：`../ARCHITECTURE.md`

---

## 目录结构

```
/supabase/functions/_shared/llm/
├── runtime/                    # 统一运行时层
│   ├── callLLM.ts             # LLM API调用
│   ├── normalize.ts           # 字符归一化清洗
│   ├── parseEnvelope.ts       # 信封格式解析（含JSON修复）
│   ├── validateSchema.ts      # Schema验证
│   └── LLMRuntime.ts          # 统一入口
│
├── agents/                     # Agent层
│   ├── briefAgent.ts          # 需求文档生成
│   ├── researchAgent.ts       # 资料搜索与整理
│   ├── structureAgent.ts      # 文章结构生成
│   ├── draftAgent.ts          # 草稿生成
│   ├── reviewAgent.ts         # 内容审校
│   ├── structureAdjustmentAgent.ts  # 结构调整
│   └── repairJSONAgent.ts     # JSON修复（自动调用）
│
└── schemas/                    # Schema定义
    ├── briefSchema.ts
    ├── researchSchema.ts
    ├── structureSchema.ts
    ├── draftSchema.ts
    └── reviewSchema.ts
```

## 核心设计原则

### 1. 关注点分离

**Agent层职责**：
- 构造prompt
- 定义schema
- 调用统一runtime

**Runtime层职责**：
- 调用LLM API
- 字符归一化
- 解析信封格式
- 解析payload
- Schema验证
- 错误统一处理

### 2. 三层防护策略

所有LLM输出都经过三层防护：

1. **Layer 1: Prompt约束**
   - 在prompt中明确要求使用英文标点
   - 禁止使用中文标点符号
   - 要求严格的JSON格式

2. **Layer 2: 字符归一化**
   - 自动转换中文标点为英文标点
   - 清除不可见字符（BOM、零宽字符等）
   - 移除markdown代码块标记

3. **Layer 3: 结构化解析**
   - 提取第一个JSON块（防止前后文本污染）
   - 两步解析（信封 + payload）
   - Schema验证确保数据完整性

4. **Layer 4: JSON修复（自动降级）**
   - 当JSON解析失败时，自动调用 `repairJSONAgent`
   - 使用LLM修复格式错误（中文引号、未转义字符、多余逗号等）
   - 验证修复后的结构与原始一致
   - 确保100%可被 `JSON.parse()` 解析

### 3. 信封模式

所有Agent输出统一使用信封格式：

```typescript
{
  "meta": {
    "agent": "agentName",
    "timestamp": "2026-02-11T10:00:00Z",
    "model": "gemini-2.0-flash-exp"
  },
  "payload": "{\"key\":\"value\"}"  // 字符串形式的JSON
}
```

**为什么使用信封模式？**
- 外层JSON始终合法，即使payload解析失败
- 可以携带元数据（agent名称、时间戳等）
- 便于日志记录和调试
- 支持版本控制和向后兼容

### 4. JSON修复Agent

**自动触发机制**：当JSON解析失败时，系统会自动调用 `repairJSONAgent` 进行修复。

**修复能力**：
- ✅ 中文引号 → 英文引号
- ✅ 未转义换行 → `\n`
- ✅ 未转义引号 → `\"`
- ✅ 末尾多余逗号 → 删除
- ✅ 缺少引号/括号 → 补全
- ✅ 属性名未加引号 → 加引号
- ✅ 单引号字符串 → 双引号
- ✅ Markdown代码块 → 去除
- ✅ 包含解释文字 → 提取JSON

**约束保证**：
- ⚠️ 不改写业务内容
- ⚠️ 不增删字段
- ⚠️ 保持结构一致
- ⚠️ 只修复语法问题

**使用参数**：
- `temperature: 0` - 确定性修复，不随机
- `model: gemini-2.0-flash-exp` - 高性能模型

**工作流程**：
```
JSON解析失败
    ↓
调用 repairJSONAgent
    ↓
LLM修复格式错误
    ↓
验证可解析性
    ↓
检查结构一致性
    ↓
返回修复后的JSON
```

## 使用示例

### 基础用法

```typescript
import { runLLMAgent } from '../_shared/llm/runtime/LLMRuntime.ts';

// 在Edge Function中调用
const result = await runLLMAgent({
  agentName: 'briefAgent',
  prompt: buildPrompt(input),
  schema: {
    required: ['topic', 'core_thesis', 'target_audience'],
    optional: ['style', 'word_count'],
  },
  model: 'gemini-2.0-flash-exp',
  temperature: 0.4,
});

// 使用结果
const brief = result.data;
console.log('生成的需求文档:', brief);
```

### Agent实现模板

```typescript
// agents/exampleAgent.ts
import { runLLMAgent } from '../runtime/LLMRuntime.ts';

export interface ExampleInput {
  field1: string;
  field2: number;
}

export interface ExampleOutput {
  result: string;
  confidence: number;
}

export async function runExampleAgent(
  input: ExampleInput
): Promise<ExampleOutput> {
  const prompt = `
你是一个专业的AI助手。

输入：
- field1: ${input.field1}
- field2: ${input.field2}

【输出要求 - 信封模式】
你必须严格输出一个固定结构的JSON对象：
{
  "meta": {
    "agent": "exampleAgent",
    "timestamp": "当前时间"
  },
  "payload": "{\\"result\\":\\"..\\",\\"confidence\\":0.9}"
}

重要规则：
1. 禁止使用中文标点符号（""''：，等）
2. 必须使用英文双引号 "
3. payload是字符串，需要转义内部引号
`;

  const result = await runLLMAgent<ExampleOutput>({
    agentName: 'exampleAgent',
    prompt,
    schema: {
      required: ['result', 'confidence'],
    },
    temperature: 0.3,
  });

  return result.data;
}
```

## Agent依赖关系

```
briefAgent (需求文档)
    ↓
researchAgent (资料搜索与整理)
    ↓
structureAgent (文章结构)
    ↓
draftAgent (草稿生成)
    ↓
reviewAgent (内容审校)
```

**强制依赖规则**：
- structureAgent 必须依赖 researchAgent 的输出
- draftAgent 必须依赖 structureAgent + researchAgent 的输出
- reviewAgent 必须依赖 draftAgent 的输出
- 禁止Agent跳过前序步骤或自行搜索资料

## 错误处理

所有错误都会被统一捕获并包装：

```typescript
try {
  const result = await runLLMAgent(config);
} catch (error) {
  // 错误信息格式：Agent {agentName} 运行失败: {详细原因}
  console.error(error.message);
  
  // 返回友好的错误响应
  return new Response(
    JSON.stringify({
      error: 'Agent运行失败',
      details: error.message,
    }),
    { status: 500 }
  );
}
```

## 日志记录

Runtime会自动记录关键信息：
- Agent名称和运行时间
- Prompt长度和模型参数
- 响应长度和解析状态
- 错误详情和堆栈

建议在生产环境中将这些日志存入 `agent_logs` 表，用于：
- 调试和问题排查
- 成本分析（token使用量）
- 性能监控（响应时间）
- 模型对比和优化

## 迁移计划

### 阶段1：创建新架构（当前）
- ✅ 创建runtime层
- ⏳ 创建agent模板
- ⏳ 创建schema定义

### 阶段2：逐步迁移
- 将现有Edge Functions改为使用新runtime
- 保持API接口不变
- 逐个Agent迁移，确保每个都能正常工作

### 阶段3：清理旧代码
- 删除重复的解析逻辑
- 统一错误处理
- 优化日志记录

## 注意事项

1. **不要修改runtime层**：所有Agent共享同一个runtime，修改需谨慎
2. **Schema验证是可选的**：简单场景可以不提供schema
3. **温度参数建议**：
   - 结构化输出（brief, structure）：0.3-0.4
   - 创意内容（draft）：0.6-0.7
   - 审校分析（review）：0.2-0.3
4. **Token限制**：注意maxTokens设置，避免输出截断

## 未来扩展

- [ ] 支持流式输出
- [ ] 支持多模型切换（Claude, GPT-4等）
- [ ] 支持缓存机制
- [ ] 支持重试策略
- [ ] 集成Zod进行更严格的类型验证
