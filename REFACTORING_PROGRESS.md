# 系统重构进度报告

## 已完成的工作

### 1. 修复 GEMINI_API_KEY 错误 ✅

**问题**: JSON 修复 Agent 调用失败，错误信息为 "GEMINI_API_KEY 未配置"

**解决方案**:
- 更新 `_shared/llm/runtime/callLLM.ts`
- 优先使用 `INTEGRATIONS_API_KEY`，回退到 `GEMINI_API_KEY`
- 部署所有 9 个 Edge Functions

**影响**:
- 所有使用 JSON 修复功能的 Edge Functions 现在可以正常工作
- 错误处理更加健壮

### 2. 添加重试机制 ✅

**创建文件**: `src/utils/retry.ts`

**功能**:
- `withRetry<T>()` - 通用重试包装器
- `invokeWithRetry<T>()` - 专门用于 Supabase Edge Function 调用的重试函数
- 指数退避策略（exponential backoff）
- 可配置的重试次数、延迟时间、可重试错误类型

**特性**:
```typescript
// 默认配置
{
  maxRetries: 3,              // 最多重试 3 次
  initialDelay: 1000,         // 初始延迟 1 秒
  maxDelay: 10000,            // 最大延迟 10 秒
  backoffMultiplier: 2,       // 指数退避倍数
  retryableErrors: [          // 可重试的错误类型
    'JSON解析失败',
    '未找到JSON对象',
    'API调用失败',
    '网络错误',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
}
```

**使用示例**:
```typescript
import { invokeWithRetry } from '@/utils/retry';

// 自动重试的 Edge Function 调用
const { data, error } = await invokeWithRetry(
  supabase,
  'structure-agent',
  { body: { topic: '人工智能' } },
  { maxRetries: 5 } // 可选：自定义重试次数
);
```

### 3. 删除 Stripe 支付相关代码 ✅

**删除的文件**:
- `src/pages/PaymentSuccessPage.tsx`
- `supabase/functions/create_stripe_checkout/`
- `supabase/functions/verify_stripe_payment/`

**修改的文件**:
- `src/routes.tsx`
  - 删除 PaymentSuccessPage 导入
  - 删除 `/payment-success` 路由
  
- `src/pages/SettingsPage.tsx`
  - 删除 `creditPackages` 配置
  - 删除 `handlePurchase` 函数
  - 删除 `purchaseDialogOpen` 状态
  - 删除购买点数 Dialog UI
  - 清理未使用的导入（ShoppingCart, Star）

**验证**:
- ✅ Lint 检查通过（0 errors）
- ✅ 所有导入正确
- ✅ 无未使用的变量或函数

## 待完成的工作

### 第三阶段：Edge Functions 重构

这是一个大型重构任务，需要分步进行：

#### 3.1 合并 structure-agent 相关函数

**目标**: 将 `generate-article-structure` 和 `adjust-article-structure` 合并到 `structure-agent`

**当前状态**:
- `generate-article-structure` - 生成文章结构
- `adjust-article-structure` - 调整文章结构
- `structure-agent` - 已存在，使用 _shared/llm

**计划**:
1. 分析两个函数的输入输出格式
2. 设计统一的 API（通过 `action` 参数区分操作类型）
3. 在 `structure-agent` 中实现两种功能
4. 更新前端调用（src/db/api.ts）
5. 测试验证
6. 删除旧函数

#### 3.2 合并 research-agent 相关函数

**目标**: 合并 4 个 research 相关函数

**当前函数**:
- `research-retrieval` - 检索研究资料
- `research-synthesis` - 综合研究结果
- `research-retrieval-agent` - 检索 Agent
- `research-synthesis-agent` - 综合 Agent

**计划**:
1. 分析功能差异和重复部分
2. 设计统一的 research-agent API
3. 实现合并后的功能
4. 更新前端调用
5. 测试验证
6. 删除旧函数

#### 3.3 合并 draft-agent 相关函数

**目标**: 合并 5 个 draft 相关函数

**当前函数**:
- `generate-paragraph-reasoning` - 生成段落推理
- `generate-paragraph-structure` - 生成段落结构
- `generate-evidence` - 生成证据
- `generate-evidence-pool` - 生成证据池
- `verify-coherence` - 验证连贯性

**计划**:
1. 分析每个函数的具体功能
2. 设计统一的 draft-agent API（支持多种操作）
3. 实现合并后的功能
4. 更新前端调用
5. 测试验证
6. 删除旧函数

#### 3.4 更新 brief-agent

**目标**: 确保 brief-agent 使用 _shared/llm

**计划**:
1. 检查当前实现
2. 如果未使用 _shared/llm，则重构
3. 测试验证

### 第四阶段：应用重试机制

**目标**: 在关键的 API 调用点应用重试机制

**计划**:
1. 识别关键的 Edge Function 调用（容易失败的）
2. 使用 `invokeWithRetry` 替换直接调用
3. 添加用户友好的错误提示
4. 测试重试机制的效果

**优先级高的调用点**:
- structure-agent 调用
- draft-agent 调用
- research-agent 调用
- review-agent 调用

### 第五阶段：测试和文档

**计划**:
1. 完整的端到端测试
2. 更新 sync-shared.sh（如果有新的 Edge Functions）
3. 更新 ARCHITECTURE.md
4. 创建重构总结文档

## 技术债务和注意事项

### 重构风险

1. **向后兼容性**: 合并函数时必须保持 API 兼容，避免破坏现有功能
2. **测试覆盖**: 每个合并步骤都需要充分测试
3. **数据库依赖**: 某些函数可能依赖特定的数据库表结构

### 建议的重构策略

1. **渐进式重构**: 一次只合并一组函数
2. **保持旧函数**: 在验证新函数正常工作前，保留旧函数
3. **功能标志**: 可以考虑使用功能标志来切换新旧实现
4. **详细日志**: 在新函数中添加详细日志，便于调试

### 性能考虑

1. **重试延迟**: 重试机制会增加失败情况下的响应时间
2. **API 成本**: 重试会增加 LLM API 调用次数
3. **用户体验**: 需要在重试时显示适当的加载状态

## 下一步行动

### 立即可做的事情

1. **应用重试机制**: 在关键的 API 调用点使用 `invokeWithRetry`
   - 优先级：高
   - 风险：低
   - 工作量：中等

2. **分析现有函数**: 详细分析需要合并的函数的输入输出
   - 优先级：高
   - 风险：低
   - 工作量：中等

### 需要用户确认的事项

1. **重构优先级**: 是否需要立即进行 Edge Functions 合并？
2. **功能保留**: 是否所有现有功能都需要保留？
3. **测试策略**: 是否有特定的测试场景需要覆盖？

## 总结

已完成的工作为系统提供了更好的错误处理和容错能力：

- ✅ 修复了 API 密钥配置问题
- ✅ 添加了自动重试机制
- ✅ 删除了不需要的支付功能
- ✅ 代码质量检查通过

接下来的 Edge Functions 重构是一个大工程，建议分步进行，每步都要充分测试。
