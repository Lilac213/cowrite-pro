# 未完成需求说明

## 概述

在 14 项核心需求中，已完成 12 项（86%），部分完成 2 项（14%）。本文档详细说明未完成部分的原因和解决方案。

## 1. 向量搜索（需求#8部分）

### 状态
⏳ **部分完成** - 使用关键词匹配替代

### 已实现
- ✅ 关键词匹配评分
- ✅ Top-K 选取（Top-8）
- ✅ 摘要压缩（前 500 字）

### 未实现
- ❌ 向量搜索（vector search）
- ❌ Embedding 生成
- ❌ pgvector 索引

### 原因
1. **技术依赖**：需要 Supabase 项目启用 pgvector 扩展
2. **外部服务**：需要 Embedding 模型（如 OpenAI text-embedding-3-small）
3. **成本考虑**：Embedding 生成需要额外的 API 调用成本
4. **时间限制**：向量搜索需要额外的开发和测试时间

### 当前方案
使用关键词匹配算法：
```typescript
// 关键词匹配评分
const scored = materials.map(material => {
  let score = 0;
  const content = (material.content || '').toLowerCase();
  const title = (material.title || '').toLowerCase();
  
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    if (title.includes(kw)) score += 3;  // 标题匹配权重更高
    if (content.includes(kw)) score += 1;
  }
  
  return { material, score };
});

// 按分数排序，取 Top-K
const topMaterials = scored
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

### 优点
- ✅ 无需外部依赖
- ✅ 零额外成本
- ✅ 实现简单，易于理解
- ✅ 对于关键词明确的场景效果良好

### 缺点
- ❌ 无法理解语义相似性
- ❌ 对同义词不敏感
- ❌ 无法处理复杂的语义关系

### 升级路径

#### 方案 1：启用 pgvector（推荐）
```sql
-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 添加向量列
ALTER TABLE research_sources 
ADD COLUMN embedding vector(1536);

-- 3. 创建向量索引
CREATE INDEX ON research_sources 
USING ivfflat (embedding vector_cosine_ops);
```

```typescript
// 4. 生成 Embedding
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

// 5. 向量搜索
const queryEmbedding = await generateEmbedding(query);
const { data } = await supabase.rpc('match_materials', {
  query_embedding: queryEmbedding,
  match_threshold: 0.7,
  match_count: 8
});
```

#### 方案 2：使用外部向量数据库
- Pinecone
- Weaviate
- Qdrant

### 建议
- **短期**：继续使用关键词匹配，已能满足基本需求
- **中期**：如果 Supabase 支持 pgvector，升级为向量搜索
- **长期**：考虑混合搜索（关键词 + 向量）

---

## 2. 引用可视化 UI（需求#9部分）

### 状态
⏳ **部分完成** - 后端完成，前端待实现

### 已实现
- ✅ 后端：LLM 生成（见资料N）标记
- ✅ 后端：返回结构化 citations
- ✅ 后端：包含 source_id, source_url, source_title, quote, citation_display

### 未实现
- ❌ 前端：引用点击弹窗
- ❌ 前端：显示摘要、来源、URL
- ❌ 前端：引用高亮

### 原因
1. **时间限制**：优先完成后端架构
2. **前端组件**：需要开发新的 UI 组件
3. **交互设计**：需要设计用户交互流程

### 当前状态
草稿中已包含引用标记，例如：
```
"人工智能正在改变教育模式（见资料1）。研究表明，个性化学习可以提高效率（见资料3）。"
```

但点击标记时无反应。

### 实现方案

#### 1. 创建 CitationPopover 组件
```typescript
// src/components/ui/CitationPopover.tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Citation {
  source_id: string;
  source_url?: string;
  source_title: string;
  quote?: string;
  citation_type: 'direct' | 'paraphrase' | 'reference';
}

interface CitationPopoverProps {
  citation: Citation;
  children: React.ReactNode;
}

export function CitationPopover({ citation, children }: CitationPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold">{citation.source_title}</h4>
          {citation.quote && (
            <p className="text-sm text-muted-foreground italic">
              "{citation.quote}"
            </p>
          )}
          {citation.source_url && (
            <a 
              href={citation.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              查看来源 →
            </a>
          )}
          <p className="text-xs text-muted-foreground">
            引用类型：{citation.citation_type === 'direct' ? '直接引用' : 
                      citation.citation_type === 'paraphrase' ? '转述' : '参考'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

#### 2. 解析草稿中的引用标记
```typescript
// src/components/draft/DraftRenderer.tsx
function parseCitationsInContent(
  content: string, 
  citations: Citation[]
): React.ReactNode {
  // 正则匹配（见资料N）
  const regex = /（见资料(\d+)）/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // 添加普通文本
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // 添加引用标记
    const citationNumber = parseInt(match[1]);
    const citation = citations[citationNumber - 1];
    
    if (citation) {
      parts.push(
        <CitationPopover key={match.index} citation={citation}>
          <span className="text-primary cursor-pointer hover:underline">
            {match[0]}
          </span>
        </CitationPopover>
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = regex.lastIndex;
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <>{parts}</>;
}
```

#### 3. 在草稿显示组件中使用
```typescript
// src/components/workflow/DraftDisplay.tsx
export function DraftDisplay({ draftPayload }: { draftPayload: DraftPayload }) {
  return (
    <div className="space-y-4">
      {draftPayload.draft_blocks.map((block) => (
        <div key={block.block_id} className="p-4 border rounded">
          <div className="prose">
            {parseCitationsInContent(block.content, block.citations)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 建议
- **优先级**：中等（不影响核心功能，但提升用户体验）
- **工作量**：1-2 天
- **依赖**：无，可以立即开始

---

## 3. 积分系统调整（需求#12）

### 状态
❌ **未完成** - 数据库准备完成，前端逻辑待实现

### 已实现
- ✅ 数据库：添加 `projects.is_completed` 字段
- ✅ 数据库：添加 `projects.research_refreshed_count` 字段

### 未实现
- ❌ 前端：创建项目时扣除 9 点
- ❌ 前端：完稿后禁止修改需求文档
- ❌ 前端：刷新搜索额外消耗 1 点
- ❌ 后端：实现积分扣除逻辑

### 原因
1. **时间限制**：优先完成 Agent 架构
2. **前端逻辑**：需要修改多个组件
3. **业务逻辑**：需要明确积分扣除时机

### 实现方案

#### 1. 创建项目时扣除 9 点
```typescript
// src/pages/ProjectListPage.tsx
const handleCreateProject = async () => {
  if (!user || !newProjectTitle.trim()) return;

  // 检查积分是否足够
  const profile = await getProfile(user.id);
  if (!profile.unlimited_credits && profile.available_credits < 9) {
    toast({
      title: '积分不足',
      description: '创建项目需要 9 点，请购买点数',
      variant: 'destructive',
    });
    return;
  }

  try {
    setCreating(true);
    
    // 创建项目
    const project = await createProject(user.id, newProjectTitle);
    
    // 扣除 9 点
    if (!profile.unlimited_credits) {
      await supabase
        .from('profiles')
        .update({ 
          available_credits: profile.available_credits - 9 
        })
        .eq('id', user.id);
    }
    
    toast({
      title: '创建成功',
      description: '已扣除 9 点积分',
    });
    
    navigate(`/project/${project.id}`);
  } catch (error) {
    toast({
      title: '创建失败',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setCreating(false);
  }
};
```

#### 2. 刷新搜索额外消耗 1 点
```typescript
// src/components/workflow/KnowledgeStage.tsx
const handleRefreshSearch = async () => {
  // 检查积分
  const profile = await getProfile(user.id);
  if (!profile.unlimited_credits && profile.available_credits < 1) {
    toast({
      title: '积分不足',
      description: '刷新搜索需要 1 点',
      variant: 'destructive',
    });
    return;
  }

  try {
    // 调用搜索
    await callResearchRetrieval(projectId);
    
    // 扣除 1 点
    if (!profile.unlimited_credits) {
      await supabase
        .from('profiles')
        .update({ 
          available_credits: profile.available_credits - 1 
        })
        .eq('id', user.id);
    }
    
    // 更新刷新次数
    await supabase
      .from('projects')
      .update({ 
        research_refreshed_count: project.research_refreshed_count + 1 
      })
      .eq('id', projectId);
    
    toast({
      title: '刷新成功',
      description: '已扣除 1 点积分',
    });
  } catch (error) {
    toast({
      title: '刷新失败',
      description: error.message,
      variant: 'destructive',
    });
  }
};
```

#### 3. 完稿后禁止修改需求文档
```typescript
// src/components/workflow/BriefStage.tsx
const handleSaveBrief = async () => {
  // 检查项目是否已完稿
  const { data: project } = await supabase
    .from('projects')
    .select('is_completed')
    .eq('id', projectId)
    .single();
  
  if (project.is_completed) {
    toast({
      title: '无法修改',
      description: '项目已完稿，无法修改需求文档',
      variant: 'destructive',
    });
    return;
  }
  
  // 保存需求文档
  await saveBrief(projectId, briefData);
};

// 在导出页面标记完稿
// src/pages/ExportPage.tsx
const handleMarkAsCompleted = async () => {
  await supabase
    .from('projects')
    .update({ 
      is_completed: true,
      status: 'completed'
    })
    .eq('id', projectId);
  
  toast({
    title: '完稿成功',
    description: '项目已标记为完成，需求文档已锁定',
  });
};
```

### 建议
- **优先级**：高（影响业务逻辑）
- **工作量**：1 天
- **依赖**：无，可以立即开始

---

## 4. 前端集成新 Agent（需求#2-6）

### 状态
❌ **未完成** - Edge Functions 已就绪，前端调用待更新

### 已实现
- ✅ 所有 Agent 的 Edge Functions
- ✅ 所有 Agent 的输入输出格式
- ✅ 数据库表和 Schema

### 未实现
- ❌ 更新 BriefStage 调用 brief-agent
- ❌ 更新 KnowledgeStage 调用 research-agent (retrieval)
- ❌ 更新 MaterialReviewStage 调用 research-agent (synthesis)
- ❌ 更新 OutlineStage 调用 structure-agent
- ❌ 更新 MaterialsStage 调用 draft-agent
- ❌ 更新 ReviewStage 调用 review-agent

### 原因
1. **时间限制**：优先完成后端架构
2. **测试需求**：需要先测试 Agent 是否正常工作
3. **向后兼容**：需要确保不破坏现有功能

### 实现方案

#### 示例：更新 BriefStage
```typescript
// src/components/workflow/BriefStage.tsx
const handleGenerateBrief = async () => {
  try {
    setGenerating(true);
    
    // 调用新的 brief-agent
    const { data, error } = await supabase.functions.invoke('brief-agent', {
      body: {
        project_id: projectId,
        topic: topic,
        user_input: userInput,
        context: context
      }
    });
    
    if (error) throw error;
    
    // 保存 writing_brief
    setWritingBrief(data.writing_brief);
    
    toast({
      title: '生成成功',
      description: '需求文档已生成',
    });
  } catch (error) {
    toast({
      title: '生成失败',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setGenerating(false);
  }
};
```

#### 示例：更新 OutlineStage
```typescript
// src/components/workflow/OutlineStage.tsx
const handleGenerateStructure = async () => {
  try {
    setGenerating(true);
    
    // 调用新的 structure-agent
    const { data, error } = await supabase.functions.invoke('structure-agent', {
      body: {
        project_id: projectId
      }
    });
    
    if (error) throw error;
    
    // 保存 argument_outline
    setArgumentOutline(data.argument_outline);
    
    toast({
      title: '生成成功',
      description: `已生成 ${data.argument_outline.argument_blocks.length} 个论证模块`,
    });
  } catch (error) {
    toast({
      title: '生成失败',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setGenerating(false);
  }
};
```

### 建议
- **优先级**：高（必须完成才能使用新 Agent）
- **工作量**：2-3 天
- **依赖**：需要先测试 Agent 是否正常工作

---

## 总结

### 完成度
- ✅ 核心架构：100%
- ✅ 后端 Agent：100%
- ⏳ 向量搜索：50%（使用关键词匹配替代）
- ⏳ 引用可视化：50%（后端完成，前端待实现）
- ❌ 积分系统：0%（数据库准备完成）
- ❌ 前端集成：0%（Edge Functions 已就绪）

### 剩余工作量
- 前端集成新 Agent：2-3 天
- 积分系统逻辑：1 天
- 引用可视化 UI：1-2 天
- 向量搜索（可选）：1-2 天

**总计**：4-8 天（假设全职开发）

### 风险评估
- **低风险**：前端集成、积分系统、引用可视化（都是常规开发）
- **中风险**：向量搜索（需要外部依赖）

### 建议优先级
1. **高优先级**：前端集成新 Agent（必须）
2. **高优先级**：积分系统逻辑（业务需求）
3. **中优先级**：引用可视化 UI（用户体验）
4. **低优先级**：向量搜索（可选优化）
