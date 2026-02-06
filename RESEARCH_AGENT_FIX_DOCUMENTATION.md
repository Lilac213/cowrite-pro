# Research Retrieval Agent 修复文档

## 问题总结

根据用户反馈，系统存在以下 4 个关键问题：

1. **搜索返回 30 条结果，但页面显示 60 条** - 数据重复问题
2. **无法勾选搜索出来的资料** - 复选框交互 bug
3. **参考文章库中有相关文章但搜索引擎没搜到** - 缺少用户库集成
4. **所有搜索源返回的内容都不完整** - 只做了搜索，没有全文爬取

## 核心问题诊断

**根本原因**：Research Agent = Search Agent，而不是 Search + Fetch + Normalize Agent

当前系统只实现了搜索步骤，但缺少了关键的**内容补全（Content Completion）**步骤：
- Smart Search：只返回 snippet，需要点击 "read more"
- TheNews：只返回标题，没有正文
- Google Scholar：只返回部分摘要

## 解决方案

### 1. 创建全文提取 Edge Function

**文件**: `supabase/functions/webpage-content-extract/index.ts`

**功能**:
- 调用 Webpage Content Extract API（Plugin ID: 371d109d-df38-4c24-8330-a1644e986572）
- 从 URL 提取完整文章内容
- 提取 3-8 个核心段落
- 判断内容质量状态：
  - `full_text`: 成功提取完整文本（>1000 字符）
  - `abstract_only`: 中等长度内容（300-1000 字符）
  - `insufficient_content`: 内容较短（100-300 字符）
  - `unavailable_fulltext`: 无法访问或内容过短（<100 字符）

**关键代码**:
```typescript
const fetchFullText = async (url: string) => {
  const response = await supabase.functions.invoke('webpage-content-extract', {
    body: { url }
  });
  
  return {
    content_status: response.data.content_status,
    extracted_content: response.data.extracted_content, // 3-8 个段落
    full_text: response.data.text,
    notes: response.data.notes
  };
};
```

### 2. 重构 Research Retrieval Agent

**文件**: `supabase/functions/research-retrieval-agent/index.ts`

**新增功能**:

#### A. 扩展数据源（5 个）
```typescript
Available Data Sources:
1. Google Scholar - 学术研究（2020年至今）
2. TheNews - 新闻/行业动态（近1-2年）
3. Smart Search (Bing) - 博客、白皮书、行业报告
4. User Library - 用户参考文章库（reference_articles）
5. Personal Materials - 用户个人素材库（materials）
```

#### B. 实现两步工作流

**Step 1: Multi-source Retrieval（多源检索）**
- 并行搜索所有 5 个数据源
- 每个源最多返回 10 条结果
- 基于 URL 去重

**Step 2: Content Completion（内容补全）** ⭐ **关键步骤**
```typescript
for (const source of rawResults.academic_sources) {
  if (!source.url) {
    // 无 URL，仅保存摘要
    finalResults.push({
      content_status: 'abstract_only',
      extracted_content: [source.abstract]
    });
    continue;
  }

  // 调用全文提取
  const fullTextData = await fetchFullText(source.url);
  
  finalResults.push({
    content_status: fullTextData.content_status,
    extracted_content: fullTextData.extracted_content, // 3-8 段落
    full_text: fullTextData.full_text,
    notes: fullTextData.notes
  });
}
```

**Step 3: Content Quality Judgment（内容质量判断）**
- 统计各质量等级的资料数量
- 标记每条资料的 `content_status`
- 记录详细的提取日志

#### C. 用户库搜索集成

```typescript
// 搜索参考文章库
await supabase
  .from('reference_articles')
  .select('*')
  .eq('user_id', userId)
  .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
  .limit(10);

// 搜索个人素材库
await supabase
  .from('materials')
  .select('*')
  .eq('user_id', userId)
  .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
  .limit(10);
```

### 3. 数据库架构更新

**Migration**: `00013_add_fulltext_content_fields.sql`

```sql
ALTER TABLE knowledge_base 
ADD COLUMN content_status TEXT DEFAULT 'abstract_only',
ADD COLUMN extracted_content JSONB,
ADD COLUMN full_text TEXT;

CREATE INDEX idx_knowledge_base_content_status ON knowledge_base(content_status);
```

**新增字段说明**:
- `content_status`: 内容完整性状态
- `extracted_content`: 提取的 3-8 个核心段落（JSONB 数组）
- `full_text`: 完整提取的文本内容

### 4. 前端组件修复

**文件**: `src/components/workflow/KnowledgeStage.tsx`

#### A. 修复复选框 Bug

**问题**: `onCheckedChange` 回调传递了错误的值
```typescript
// ❌ 错误：传递当前状态，导致无法切换
<Checkbox
  checked={item.selected}
  onCheckedChange={() => handleToggleSelect(item.id, item.selected)}
/>

// ✅ 正确：传递新的选中状态
<Checkbox
  checked={item.selected}
  onCheckedChange={(checked) => handleToggleSelect(item.id, checked as boolean)}
/>
```

#### B. 显示内容状态标签

```tsx
{item.content_status && (
  <Badge 
    variant={
      item.content_status === 'full_text' ? 'default' :
      item.content_status === 'abstract_only' ? 'secondary' :
      'outline'
    }
  >
    {item.content_status === 'full_text' ? '✓ 完整全文' :
     item.content_status === 'abstract_only' ? '摘要' :
     item.content_status === 'insufficient_content' ? '内容不足' :
     '无法获取'}
  </Badge>
)}
```

#### C. 保存完整内容

```typescript
await createKnowledgeBase({
  project_id: projectId,
  title: source.title,
  content: fullText || extractedContent.join('\n\n'),
  source: sourceLabel,
  source_url: source.url,
  content_status: source.content_status,
  extracted_content: source.extracted_content,
  full_text: source.full_text,
  // ...
});
```

### 5. 类型定义更新

**文件**: `src/types/types.ts`

```typescript
export interface KnowledgeBase {
  // ... 原有字段
  content_status?: 'full_text' | 'abstract_only' | 'insufficient_content' | 'unavailable_fulltext';
  extracted_content?: string[];
  full_text?: string;
}
```

## 修复效果

### 问题 1: 搜索返回 30 条但显示 60 条 ✅
**原因**: 代码中存在重复的结果处理逻辑
**修复**: 删除了旧的重复代码，确保只有一个结果处理流程

### 问题 2: 无法勾选搜索结果 ✅
**原因**: `onCheckedChange` 回调传递了当前状态而不是新状态
**修复**: 修改为 `onCheckedChange={(checked) => handleToggleSelect(item.id, checked as boolean)}`

### 问题 3: 用户库未被搜索 ✅
**原因**: Research Agent 只搜索外部 API，没有集成用户库
**修复**: 
- 添加 `reference_articles` 表搜索
- 添加 `materials` 表搜索
- 并行执行所有 5 个数据源的搜索

### 问题 4: 内容不完整 ✅
**原因**: 只做了搜索，没有全文爬取
**修复**: 
- 创建 `webpage-content-extract` Edge Function
- 对每个搜索结果的 URL 进行全文提取
- 提取 3-8 个核心段落
- 标记内容质量状态
- 保存完整文本到数据库

## 新的工作流程

```
用户输入需求
    ↓
通义千问生成搜索计划
    ↓
并行搜索 5 个数据源
    ├─ Google Scholar (学术)
    ├─ TheNews (新闻)
    ├─ Smart Search (网络)
    ├─ Reference Articles (用户库)
    └─ Materials (个人素材)
    ↓
对每个结果进行内容补全
    ├─ 提取 URL
    ├─ 调用 Webpage Content Extract API
    ├─ 获取完整文本
    ├─ 提取 3-8 个核心段落
    └─ 判断内容质量状态
    ↓
保存到知识库
    ├─ 标题
    ├─ 完整内容
    ├─ 内容状态
    ├─ 提取的段落
    └─ 完整文本
    ↓
前端显示
    ├─ 可勾选
    ├─ 显示内容状态标签
    └─ 显示完整内容
```

## 技术亮点

1. **两步工作流**: Search + Fetch，确保获取完整内容
2. **内容质量判断**: 自动标记 4 种质量等级
3. **多源并行搜索**: 5 个数据源同时检索，提高效率
4. **智能段落提取**: 自动提取 3-8 个核心段落，便于后续写作
5. **用户库集成**: 充分利用用户已有的参考资料和个人素材
6. **详细日志记录**: 完整的搜索和提取日志，便于调试

## 部署状态

✅ **已部署的 Edge Functions**:
- `webpage-content-extract` - 全文提取功能
- `research-retrieval-agent` - 更新后的研究检索代理

✅ **已应用的数据库迁移**:
- `00013_add_fulltext_content_fields` - 添加全文内容字段

✅ **已更新的前端组件**:
- `KnowledgeStage.tsx` - 修复复选框 bug，显示内容状态

✅ **Lint 检查**: 通过，无错误

## 使用说明

1. **搜索资料**: 在知识阶段输入研究需求，系统会自动从 5 个数据源检索
2. **查看内容状态**: 每条资料都会显示内容状态标签（完整全文、摘要等）
3. **勾选资料**: 点击复选框选择需要的资料（已修复，可正常勾选）
4. **查看完整内容**: 系统会自动提取并保存完整文本，不再只显示摘要
5. **综合分析**: 选择资料后点击"综合分析"按钮，生成写作摘要

## 注意事项

1. **全文提取可能失败**: 某些网站有付费墙或访问限制，会标记为 `unavailable_fulltext`
2. **提取时间**: 全文提取需要时间，每个 URL 约 1-3 秒
3. **内容长度**: 完整文本会保存到 `full_text` 字段，可能较大
4. **用户库搜索**: 需要用户先在参考文章库和个人素材库中添加内容

## 后续优化建议

1. **批量提取**: 可以考虑批量并行提取多个 URL，提高速度
2. **缓存机制**: 对已提取的 URL 进行缓存，避免重复提取
3. **智能重试**: 对提取失败的 URL 进行智能重试
4. **内容摘要**: 对过长的全文进行智能摘要，提取关键信息
5. **相关性评分**: 根据内容与需求的相关性进行评分排序
