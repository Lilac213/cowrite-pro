# AI 写作工作流完整说明

## 工作流概览

本系统实现了一个完整的 AI 辅助写作工作流，从需求明确到最终导出，共包含 9 个阶段。

```
开始 → 需求明确 → 资料搜索 → 资料整理 → 文章结构 → 生成草稿 → 内容审校 → 排版导出 → 完成
```

## 详细工作流

### 1. 开始 (init)
- **进度**: 0%
- **描述**: 项目初始化阶段
- **用户操作**: 创建新项目，输入项目标题
- **系统操作**: 创建项目记录，初始化数据库
- **下一阶段**: 需求明确

---

### 2. 需求明确 (confirm_brief)
- **进度**: 12%
- **描述**: 明确写作需求和目标
- **调用 Agent**: `brief-agent`
- **前端组件**: `BriefStage.tsx`
- **用户操作**: 
  - 输入写作主题
  - 描述写作目标
  - 设置文章要求（字数、风格、受众等）
- **系统操作**: 
  - 调用 `brief-agent` 分析需求
  - 生成需求文档
  - 保存到 `briefs` 表
- **输出**: 
  - 结构化的需求文档
  - 写作目标清单
- **下一阶段**: 资料搜索

**API 调用示例**:
```typescript
// src/db/api.ts
export async function callBriefAgent(projectId: string, input: any) {
  const { data, error } = await supabase.functions.invoke('brief-agent', {
    body: { projectId, input }
  });
  return data;
}
```

---

### 3. 资料搜索 (knowledge_selected)
- **进度**: 25%
- **描述**: 搜索和检索相关资料
- **调用 Agent**: `research-retrieval` (或 `research-retrieval-agent`)
- **前端组件**: `KnowledgeStage.tsx`
- **用户操作**: 
  - 审阅搜索计划
  - 选择搜索关键词
  - 确认搜索范围
- **系统操作**: 
  - 根据需求生成搜索计划
  - 调用搜索 API 检索资料
  - 对搜索结果进行初步筛选
  - 保存到 `retrieved_materials` 表
- **输出**: 
  - 搜索结果列表
  - 相关文章和资料
- **下一阶段**: 资料整理

**数据库表**:
```sql
-- retrieved_materials 表
CREATE TABLE retrieved_materials (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  content TEXT,
  source_url TEXT,
  relevance_score FLOAT,
  created_at TIMESTAMPTZ
);
```

---

### 4. 资料整理 (material_review)
- **进度**: 38%
- **描述**: 整理、审阅和合成资料
- **调用 Agent**: `research-synthesis` (或 `research-synthesis-agent`)
- **前端组件**: `MaterialReviewStage.tsx`
- **用户操作**: 
  - 审阅检索到的资料
  - 标记重要内容
  - 确认可用素材
- **系统操作**: 
  - 调用 `research-synthesis` 整理资料
  - 提取关键信息和洞察
  - 生成素材摘要
  - 保存到 `confirmed_insights` 表
- **输出**: 
  - 确认的素材列表
  - 关键洞察和引用
  - 素材分类和标签
- **下一阶段**: 文章结构

**数据流**:
```
retrieved_materials → research-synthesis → confirmed_insights
```

---

### 5. 文章结构 (outline_confirmed)
- **进度**: 50%
- **描述**: 生成和确认文章大纲结构
- **调用 Agent**: 
  - `structure-agent` (旧版)
  - `generate-article-structure` (新版，主要使用)
  - `adjust-article-structure` (调整结构)
- **前端组件**: `OutlineStage.tsx`
- **用户操作**: 
  - 审阅生成的文章结构
  - 编辑核心论点
  - 调整论证块顺序
  - 删除或添加论证块
- **系统操作**: 
  - 调用 `generate-article-structure` 生成结构
  - 根据确认的素材生成论证块
  - 保存到 `article_structures` 表
- **输出**: 
  - 核心论点 (core_thesis)
  - 论证块列表 (argument_blocks)
  - 每个论证块包含:
    - 标题 (title)
    - 描述 (description)
    - 顺序 (order)
    - 关联素材 (derived_from)
- **下一阶段**: 生成草稿

**数据结构**:
```typescript
interface ArticleStructure {
  core_thesis: string;
  argument_blocks: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    relation: string;
    derived_from: string[];
    user_editable: boolean;
  }>;
  status: 'awaiting_user_confirmation' | 'confirmed';
  allowed_user_actions: string[];
}
```

---

### 6. 生成草稿 (drafting)
- **进度**: 65%
- **描述**: 根据结构生成文章草稿
- **调用 Agent**: `draft-agent`
- **前端组件**: `DraftStage.tsx`
- **用户操作**: 
  - 查看生成的草稿
  - 编辑段落内容
  - 调整段落顺序
- **系统操作**: 
  - 调用 `draft-agent` 生成草稿
  - 根据论证块生成段落
  - 保存到 `drafts` 表
- **输出**: 
  - 完整的文章草稿
  - 段落列表
  - 每个段落包含:
    - 内容 (content)
    - 顺序 (order)
    - 关联的论证块 (block_id)
- **下一阶段**: 内容审校

**生成流程**:
```
article_structures → draft-agent → drafts → paragraphs
```

---

### 7. 内容审校 (review_pass_1)
- **进度**: 80%
- **描述**: 审校和优化文章内容
- **调用 Agent**: 
  - `review-agent` (主要审校)
  - `verify-coherence` (验证连贯性)
- **前端组件**: `ReviewStage.tsx`
- **用户操作**: 
  - 查看审校建议
  - 接受或拒绝修改
  - 手动编辑内容
- **系统操作**: 
  - 调用 `review-agent` 审校内容
  - 检查语法、逻辑、连贯性
  - 生成修改建议
  - 保存审校记录
- **输出**: 
  - 审校建议列表
  - 修改后的草稿
  - 审校通过标记
- **下一阶段**: 排版导出

**审校维度**:
- 语法和拼写
- 逻辑连贯性
- 论证充分性
- 风格一致性
- 引用准确性

---

### 8. 排版导出 (layout_export)
- **进度**: 92%
- **描述**: 导出最终文档
- **调用 Agent**: 无（纯前端操作）
- **前端组件**: 导出页面 (`/project/:id/export`)
- **用户操作**: 
  - 选择导出格式（PDF、Word、Markdown）
  - 设置排版选项
  - 下载文档
- **系统操作**: 
  - 格式化文档
  - 生成导出文件
  - 更新项目状态
- **输出**: 
  - 最终文档文件
- **下一阶段**: 完成

---

### 9. 完成 (completed)
- **进度**: 100%
- **描述**: 项目完成
- **用户操作**: 
  - 查看最终文档
  - 重新编辑（返回任意阶段）
- **系统操作**: 
  - 标记项目为已完成
  - 归档项目数据

---

## 数据库表结构

### 核心表

```sql
-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL, -- 工作流状态
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 需求文档表
CREATE TABLE briefs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  requirements JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 检索资料表
CREATE TABLE retrieved_materials (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  content TEXT,
  source_url TEXT,
  relevance_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 确认素材表
CREATE TABLE confirmed_insights (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  category TEXT,
  content TEXT,
  source_insight_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章结构表
CREATE TABLE article_structures (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  core_thesis TEXT,
  argument_blocks JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 草稿表
CREATE TABLE drafts (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  content TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目历史表
CREATE TABLE project_history (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  stage TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Edge Functions 详细说明

### brief-agent
**功能**: 分析用户需求，生成结构化的需求文档

**输入**:
```typescript
{
  projectId: string;
  topic: string;
  requirements: string;
  targetAudience?: string;
  wordCount?: number;
  style?: string;
}
```

**输出**:
```typescript
{
  requirements: {
    topic: string;
    goals: string[];
    constraints: string[];
    targetAudience: string;
    wordCount: number;
    style: string;
  };
}
```

---

### research-retrieval
**功能**: 检索相关资料

**输入**:
```typescript
{
  projectId: string;
  topic: string;
  keywords: string[];
  searchDepth?: 'shallow' | 'deep';
}
```

**输出**:
```typescript
{
  materials: Array<{
    title: string;
    content: string;
    source_url: string;
    relevance_score: number;
  }>;
}
```

---

### research-synthesis
**功能**: 整理和合成资料

**输入**:
```typescript
{
  projectId: string;
  materials: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}
```

**输出**:
```typescript
{
  insights: Array<{
    id: string;
    category: string;
    content: string;
    source_insight_id: string;
  }>;
}
```

---

### generate-article-structure
**功能**: 生成文章结构

**输入**:
```typescript
{
  input: {
    topic: string;
    user_core_thesis?: string;
    confirmed_insights: Array<{
      id: string;
      category: string;
      content: string;
      source_insight_id: string;
    }>;
    context_flags: {
      confirmed_insight_count: number;
      contradictions_or_gaps_present: boolean;
    };
  };
}
```

**输出**:
```typescript
{
  core_thesis: string;
  argument_blocks: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    relation: string;
    derived_from: string[];
    user_editable: boolean;
  }>;
  status: 'awaiting_user_confirmation';
  allowed_user_actions: string[];
}
```

---

### draft-agent
**功能**: 生成文章草稿

**输入**:
```typescript
{
  projectId: string;
  structure: {
    core_thesis: string;
    argument_blocks: Array<{
      id: string;
      title: string;
      description: string;
    }>;
  };
  insights: Array<{
    id: string;
    content: string;
  }>;
}
```

**输出**:
```typescript
{
  draft: {
    content: string;
    paragraphs: Array<{
      content: string;
      order: number;
      block_id: string;
    }>;
  };
}
```

---

### review-agent
**功能**: 审校文章内容

**输入**:
```typescript
{
  projectId: string;
  draft: {
    content: string;
  };
  requirements: {
    style: string;
    targetAudience: string;
  };
}
```

**输出**:
```typescript
{
  suggestions: Array<{
    type: 'grammar' | 'logic' | 'style' | 'coherence';
    location: string;
    original: string;
    suggestion: string;
    reason: string;
  }>;
  score: {
    grammar: number;
    logic: number;
    coherence: number;
    style: number;
  };
}
```

---

## 前端组件说明

### ProjectWorkflowPage.tsx
**路径**: `src/pages/ProjectWorkflowPage.tsx`

**功能**: 工作流主页面，管理整个工作流程

**关键功能**:
- 显示工作流进度
- 根据当前阶段渲染对应组件
- 处理阶段跳转
- 加载和保存项目数据

---

### WorkflowProgress.tsx
**路径**: `src/components/workflow/WorkflowProgress.tsx`

**功能**: 显示工作流进度条

**特性**:
- 可视化显示当前阶段
- 支持点击跳转到已完成阶段
- 显示每个阶段的完成状态

---

### BriefStage.tsx
**路径**: `src/components/workflow/BriefStage.tsx`

**功能**: 需求明确阶段组件

**特性**:
- 输入写作需求
- 调用 brief-agent
- 显示生成的需求文档
- 确认并进入下一阶段

---

### KnowledgeStage.tsx
**路径**: `src/components/workflow/KnowledgeStage.tsx`

**功能**: 资料搜索阶段组件

**特性**:
- 显示搜索计划
- 执行资料检索
- 显示搜索结果
- 选择相关资料

---

### MaterialReviewStage.tsx
**路径**: `src/components/workflow/MaterialReviewStage.tsx`

**功能**: 资料整理阶段组件

**特性**:
- 显示检索到的资料
- 标记重要内容
- 调用 research-synthesis
- 确认可用素材

---

### OutlineStage.tsx
**路径**: `src/components/workflow/OutlineStage.tsx`

**功能**: 文章结构阶段组件

**特性**:
- 调用 generate-article-structure
- 显示核心论点和论证块
- 支持编辑和调整结构
- 确认结构并进入下一阶段

---

### DraftStage.tsx
**路径**: `src/components/workflow/DraftStage.tsx`

**功能**: 生成草稿阶段组件

**特性**:
- 调用 draft-agent 生成草稿
- 显示文章内容
- 支持编辑段落
- 保存草稿

---

### ReviewStage.tsx
**路径**: `src/components/workflow/ReviewStage.tsx`

**功能**: 内容审校阶段组件

**特性**:
- 调用 review-agent 审校
- 显示审校建议
- 接受或拒绝修改
- 完成审校并进入导出

---

## API 调用流程

### 完整工作流 API 调用链

```typescript
// 1. 需求明确
const brief = await callBriefAgent(projectId, briefInput);
await saveBrief(projectId, brief);
await updateProject(projectId, { status: 'knowledge_selected' });

// 2. 资料搜索
const materials = await callResearchRetrieval(projectId, searchInput);
await saveRetrievedMaterials(projectId, materials);
await updateProject(projectId, { status: 'material_review' });

// 3. 资料整理
const insights = await callResearchSynthesis(projectId, materials);
await saveConfirmedInsights(projectId, insights);
await updateProject(projectId, { status: 'outline_confirmed' });

// 4. 文章结构
const structure = await callArticleStructureAgent(projectId, structureInput);
await saveArticleStructure(projectId, structure);
await updateProject(projectId, { status: 'drafting' });

// 5. 生成草稿
const draft = await callDraftAgent(projectId, draftInput);
await saveDraft(projectId, draft);
await updateProject(projectId, { status: 'review_pass_1' });

// 6. 内容审校
const review = await callReviewAgent(projectId, reviewInput);
await saveReviewSuggestions(projectId, review);
await updateProject(projectId, { status: 'layout_export' });

// 7. 排版导出
await updateProject(projectId, { status: 'completed' });
```

---

## 错误处理

### 通用错误处理策略

```typescript
try {
  const result = await supabase.functions.invoke('agent-name', {
    body: input
  });
  
  if (result.error) {
    // 处理 Edge Function 错误
    console.error('Edge Function 错误:', result.error);
    toast({
      title: '操作失败',
      description: result.error.message,
      variant: 'destructive'
    });
    return;
  }
  
  // 处理成功结果
  handleSuccess(result.data);
} catch (error) {
  // 处理网络错误或其他异常
  console.error('请求失败:', error);
  toast({
    title: '请求失败',
    description: '请检查网络连接后重试',
    variant: 'destructive'
  });
}
```

### parseEnvelope 错误处理

所有 Edge Functions 的 `parseEnvelope` 函数现在支持三种响应格式，提高了容错能力：

1. **标准信封格式**: `{ meta: {...}, payload: "..." }`
2. **简化信封格式**: `{ type: "...", payload: {...} }`
3. **直接返回格式**: `{ core_thesis: "...", ... }`

如果解析失败，会自动尝试使用 JSON 修复 Agent 修复格式。

---

## 性能优化

### 1. 数据缓存
- 使用 React Query 缓存 API 响应
- 减少重复请求

### 2. 增量加载
- 分页加载资料列表
- 懒加载大型文档

### 3. 并行处理
- 并行调用多个 Edge Functions
- 使用 Promise.all 优化性能

### 4. 状态管理
- 使用 Context API 管理全局状态
- 避免不必要的重新渲染

---

## 安全性

### 1. 认证和授权
- 所有 API 调用需要用户认证
- RLS 策略保护数据访问

### 2. 数据验证
- 前端和后端双重验证
- 防止 SQL 注入和 XSS 攻击

### 3. 敏感信息保护
- API 密钥存储在 Supabase Secrets
- 不在客户端暴露敏感信息

---

## 监控和日志

### 1. Edge Function 日志
```typescript
console.log('[agent-name] 开始处理请求');
console.log('[agent-name] 输入数据:', JSON.stringify(input));
console.log('[agent-name] 处理完成');
```

### 2. 前端日志
```typescript
console.log('[Component] 调用 API:', apiName);
console.log('[Component] API 响应:', response);
console.error('[Component] 错误:', error);
```

### 3. 性能监控
- 记录每个阶段的处理时间
- 监控 API 响应时间
- 追踪错误率

---

## 总结

本系统实现了一个完整的 AI 辅助写作工作流，涵盖从需求明确到最终导出的全过程。通过模块化的设计和清晰的数据流，确保了系统的可维护性和可扩展性。

**关键特性**:
- ✅ 9 个完整的工作流阶段
- ✅ 6 个核心 AI Agent
- ✅ 完整的数据库设计
- ✅ 健壮的错误处理
- ✅ 良好的用户体验
- ✅ 高度可扩展的架构

**已修复问题**:
- ✅ parseEnvelope 格式兼容性问题
- ✅ 所有 Edge Functions 已更新并部署
- ✅ 工作流各阶段正常运行
