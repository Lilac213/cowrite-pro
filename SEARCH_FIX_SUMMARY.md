# 🔧 搜索功能修复总结

## 问题诊断

### 核心问题
用户报告搜索功能在"资料查询"阶段卡住，显示找到 0 篇文章。

### 根本原因分析

经过详细代码审查和日志分析，发现了以下关键问题：

#### 1. **数据结构不匹配** ⚠️ 最关键的问题

**问题描述**:
- Edge Function 返回格式: `{ success: true, data: {...} }`
- 前端 api.ts 直接返回: `data` (整个响应对象)
- 前端组件期望: `{ academic_sources: [], news_sources: [], ... }`

**结果**:
```javascript
// Edge Function 返回
{
  success: true,
  data: {
    academic_sources: [...],
    news_sources: [...],
    web_sources: [...]
  }
}

// api.ts 返回给组件
{
  success: true,  // ❌ 组件不期望这个字段
  data: {         // ❌ 组件期望直接是 academic_sources 等字段
    academic_sources: [...],
    news_sources: [...],
    web_sources: [...]
  }
}

// 组件尝试访问
retrievalResults.academic_sources  // ❌ undefined
retrievalResults.data.academic_sources  // ✅ 这才是正确的路径
```

**影响**:
- `allSources` 数组长度为 0
- 显示"找到 0 篇文章"
- 实际上 Edge Function 可能已经返回了数据

#### 2. **参数传递格式不一致**

**问题描述**:
- Edge Function 期望 `requirementsDoc` 可以是字符串或对象
- 前端有时传对象，有时传字符串
- 缺少统一的处理逻辑

#### 3. **缺少详细的调试日志**

**问题描述**:
- 前端和后端之间的数据流不透明
- 难以定位问题发生在哪个环节

## 修复方案

### 1. 修复数据结构处理 ✅

**文件**: `src/db/api.ts`

**修改内容**:

```typescript
// researchRetrievalAgent 函数
export async function researchRetrievalAgent(requirementsDoc: any, projectId?: string, userId?: string) {
  console.log('[researchRetrievalAgent] 开始调用，需求文档:', requirementsDoc);
  
  const { data, error } = await supabase.functions.invoke('research-retrieval-agent', {
    body: { requirementsDoc, projectId, userId },
  });

  console.log('[researchRetrievalAgent] Edge Function 响应:', { data, error });

  if (error) {
    // ... 错误处理
  }

  // ✅ 新增：检查返回的数据结构
  if (!data) {
    throw new Error('资料检索返回数据为空');
  }

  // ✅ 新增：如果返回的是 { success: true, data: {...} } 格式，提取 data 字段
  if (data.success && data.data) {
    console.log('[researchRetrievalAgent] 提取 data 字段:', data.data);
    return data.data;  // 返回嵌套的 data 字段
  }

  // 否则直接返回
  return data;
}
```

**同样的修复应用到 `researchSynthesisAgent` 函数**

### 2. 统一参数处理 ✅

**文件**: `supabase/functions/research-retrieval-agent/index.ts`

**修改内容**:

```typescript
const { requirementsDoc, projectId, userId }: ResearchRequest = await req.json();

console.log('========== 接收到的请求参数 ==========');
console.log('requirementsDoc 类型:', typeof requirementsDoc);
console.log('requirementsDoc 内容:', requirementsDoc);

// ✅ 新增：统一处理 requirementsDoc 格式
const requirementsDocStr = typeof requirementsDoc === 'string' 
  ? requirementsDoc 
  : JSON.stringify(requirementsDoc, null, 2);

console.log('处理后的 requirementsDoc:', requirementsDocStr);

// 后续使用 requirementsDocStr
const userPrompt = `研究需求文档：\n${requirementsDocStr}\n\n请生成搜索计划。`;
```

### 3. 增强调试日志 ✅

**前端日志** (`src/components/workflow/KnowledgeStage.tsx`):

```typescript
console.log('[KnowledgeStage] 调用 agentDrivenResearchWorkflow，需求文档:', requirementsDoc);

const { retrievalResults, synthesisResults } = await agentDrivenResearchWorkflow(
  requirementsDoc,
  projectId,
  user.id
);

console.log('[KnowledgeStage] agentDrivenResearchWorkflow 返回结果:');
console.log('  - retrievalResults:', retrievalResults);
console.log('  - synthesisResults:', synthesisResults);

const allSources = [
  ...(retrievalResults.academic_sources || []).map((s: any) => ({ ...s, sourceType: 'academic' })),
  ...(retrievalResults.news_sources || []).map((s: any) => ({ ...s, sourceType: 'news' })),
  ...(retrievalResults.web_sources || []).map((s: any) => ({ ...s, sourceType: 'web' })),
  ...(retrievalResults.user_library_sources || []).map((s: any) => ({ ...s, sourceType: 'user_library' })),
  ...(retrievalResults.personal_sources || []).map((s: any) => ({ ...s, sourceType: 'personal' })),
];

console.log('[KnowledgeStage] 所有来源数量:', allSources.length);
console.log('[KnowledgeStage] 来源详情:', {
  academic: retrievalResults.academic_sources?.length || 0,
  news: retrievalResults.news_sources?.length || 0,
  web: retrievalResults.web_sources?.length || 0,
  user_library: retrievalResults.user_library_sources?.length || 0,
  personal: retrievalResults.personal_sources?.length || 0,
});
```

**后端日志** (已在之前的部署中添加):
- API Keys 状态检查
- 请求参数详情
- 每个数据源的搜索过程
- 最终结果统计

### 4. 修复架构文档 ✅

**文件**: `ARCHITECTURE_DIAGRAM.md`

**修改内容**:
- 将所有 "DeepSeek API" 改为 "Qwen API"
- 确保文档与实际实现一致

## 修复后的数据流

### 正确的数据流程

```
1. 前端 KnowledgeStage
   ↓ 调用 agentDrivenResearchWorkflow(requirementsDoc, projectId, userId)
   
2. api.ts - agentDrivenResearchWorkflow
   ↓ 调用 researchRetrievalAgent(requirementsDoc, projectId, userId)
   
3. api.ts - researchRetrievalAgent
   ↓ 调用 supabase.functions.invoke('research-retrieval-agent', { body: {...} })
   
4. Edge Function - research-retrieval-agent
   ↓ 返回 { success: true, data: { academic_sources: [...], ... } }
   
5. api.ts - researchRetrievalAgent
   ✅ 检测到 data.success && data.data
   ✅ 返回 data.data (即 { academic_sources: [...], ... })
   
6. api.ts - agentDrivenResearchWorkflow
   ✅ retrievalResults = { academic_sources: [...], ... }
   ↓ 调用 researchSynthesisAgent(retrievalResults, requirementsDoc)
   
7. Edge Function - research-synthesis-agent
   ↓ 返回 { success: true, data: { synthesized_insights: [...], ... } }
   
8. api.ts - researchSynthesisAgent
   ✅ 检测到 data.success && data.data
   ✅ 返回 data.data
   
9. api.ts - agentDrivenResearchWorkflow
   ✅ 返回 { retrievalResults, synthesisResults }
   
10. 前端 KnowledgeStage
    ✅ retrievalResults.academic_sources 可以正确访问
    ✅ allSources 数组包含所有来源
    ✅ 显示正确的文章数量
```

## 测试验证

### 1. 使用搜索调试页面

访问 `/search-debug` 页面，执行测试搜索：

**预期结果**:
```
[时间] 🚀 开始搜索流程
[时间] ✅ 需求文档解析成功
[时间] 📋 主题: AI Agent应用的商业化路径
[时间] 👤 用户 ID: xxx
[时间] 📡 调用 research-retrieval-agent Edge Function...
[时间] ⏱️ 请求耗时: 3000ms
[时间] ✅ Edge Function 调用成功
[时间] 📊 搜索结果统计:
[时间]    - 学术来源: 5 条
[时间]    - 新闻来源: 3 条
[时间]    - 网络来源: 7 条
[时间]    - 用户库来源: 0 条
[时间]    - 总计: 15 条
[时间] ✅ 搜索流程完成
```

### 2. 查看浏览器控制台

打开浏览器控制台（F12），查看详细日志：

**预期日志**:
```javascript
[researchRetrievalAgent] 开始调用，需求文档: {...}
[researchRetrievalAgent] Edge Function 响应: { data: { success: true, data: {...} }, error: null }
[researchRetrievalAgent] 提取 data 字段: { academic_sources: [...], news_sources: [...], ... }
[KnowledgeStage] agentDrivenResearchWorkflow 返回结果:
  - retrievalResults: { academic_sources: [...], news_sources: [...], ... }
  - synthesisResults: { synthesized_insights: [...], ... }
[KnowledgeStage] 所有来源数量: 15
[KnowledgeStage] 来源详情: { academic: 5, news: 3, web: 7, user_library: 0, personal: 0 }
```

### 3. 查看 Edge Function 日志

在 Supabase Dashboard 中查看 Edge Function 日志：

**预期日志**:
```
========== 接收到的请求参数 ==========
requirementsDoc 类型: object
requirementsDoc 内容: {...}
处理后的 requirementsDoc: {...}

========== API Keys 状态检查 ==========
QIANWEN_API_KEY 存在: true
INTEGRATIONS_API_KEY 存在: true

========== 开始调用通义千问 API ==========
用户提示词: 研究需求文档：...

========== Google Scholar 搜索开始 ==========
[Google Scholar] 查询: "AI Agent commercialization"
[Google Scholar] 响应状态: 200
[Google Scholar] organic_results 长度: 10

========== 最终结果统计 ==========
总计资料数量: 15
```

## 常见问题排查

### 问题 1: 仍然显示 0 篇文章

**可能原因**:
1. INTEGRATIONS_API_KEY 未配置或无效
2. 通义千问 API 返回的搜索计划为空
3. 所有外部 API 都返回空结果

**排查步骤**:
1. 访问 `/search-debug` 页面测试
2. 查看浏览器控制台日志
3. 查看 Edge Function 日志
4. 检查 `[researchRetrievalAgent] 提取 data 字段` 日志，确认数据结构正确

### 问题 2: 数据结构错误

**症状**:
```javascript
Cannot read property 'academic_sources' of undefined
```

**原因**:
- Edge Function 返回格式变化
- api.ts 中的数据提取逻辑失效

**解决**:
1. 查看 `[researchRetrievalAgent] Edge Function 响应` 日志
2. 确认返回的数据结构
3. 调整 api.ts 中的数据提取逻辑

### 问题 3: Edge Function 超时

**症状**:
- 搜索一直卡在"资料查询"阶段
- 最终显示超时错误

**原因**:
- 外部 API 响应慢
- 通义千问 API 响应慢
- 并发请求过多

**解决**:
1. 检查 Edge Function 日志，看哪个 API 慢
2. 考虑增加超时时间
3. 考虑减少并发请求数量

## 部署状态

### 已部署的修改

✅ **Edge Function**: research-retrieval-agent
- 统一参数处理
- 增强日志输出
- 已重新部署

✅ **前端代码**: src/db/api.ts
- 修复数据结构处理
- 增强日志输出
- 已通过 lint 检查

✅ **前端组件**: src/components/workflow/KnowledgeStage.tsx
- 增强日志输出
- 已通过 lint 检查

✅ **文档**: ARCHITECTURE_DIAGRAM.md
- 修正 API 名称（DeepSeek → Qwen）

### 待验证

⏳ **功能测试**:
- 在实际项目中执行搜索
- 验证是否能正确显示文章数量
- 验证是否能正确保存到知识库

⏳ **性能测试**:
- 测试搜索响应时间
- 测试并发搜索性能

## 下一步行动

### 立即测试

1. **访问搜索调试页面**
   ```
   URL: /search-debug
   ```

2. **执行测试搜索**
   - 使用默认的需求文档
   - 点击"开始搜索"
   - 观察日志和结果

3. **在实际项目中测试**
   - 创建新项目
   - 进入知识阶段
   - 执行自动搜索
   - 查看是否显示正确的文章数量

### 如果仍有问题

1. **收集日志**
   - 浏览器控制台日志（完整）
   - Edge Function 日志（完整）
   - 搜索调试页面的日志

2. **提供信息**
   - 使用的需求文档内容
   - 错误信息截图
   - 预期行为 vs 实际行为

3. **进一步调试**
   - 使用搜索调试页面的原始响应数据
   - 检查数据结构是否符合预期
   - 逐步排查数据流中的问题

## 总结

### 核心修复

1. ✅ **数据结构处理**: 正确提取 Edge Function 返回的嵌套 data 字段
2. ✅ **参数处理**: 统一 requirementsDoc 的格式处理
3. ✅ **日志增强**: 在关键节点添加详细日志
4. ✅ **文档修正**: 更新架构文档中的 API 名称

### 预期效果

- ✅ 搜索功能能正确返回文章数量
- ✅ 文章能正确保存到知识库
- ✅ 日志清晰，便于调试
- ✅ 文档与实现一致

### 关键改进

- **数据流透明化**: 每个环节都有详细日志
- **错误处理增强**: 更详细的错误信息
- **调试工具完善**: 搜索调试页面提供全面的测试能力

---

**修复时间**: 2025-02-06
**状态**: ✅ 已完成
**优先级**: 🔴 高（核心功能修复）
**测试状态**: ⏳ 待验证
