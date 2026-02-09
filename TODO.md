# 任务：修复资料选择和替换搜索API

# 任务：修复搜索结果筛选、更新数据源标签、修复资料整理失败

## 当前任务
- [x] 修复搜索结果筛选和标签颜色
  - [x] 更新 SearchResultsPanel 的 badge 颜色使用语义化变体
  - [x] 确保按学术/资讯/网页筛选功能正常工作
  - [x] 标签颜色与搜索计划保持一致
- [x] 更新数据源标签
  - [x] 将"行业资讯 (TheNews)"改为"行业资讯 (SerpAPI - Google News)"
  - [x] 将"网页内容 (Smart Search)"改为"网页内容 (SerpAPI - Google Search)"
- [x] 修复资料整理失败问题
  - [x] 在调用 research-synthesis-agent 前将选中的资料保存到 knowledge_base 表
  - [x] 添加错误处理和日志

## 实现细节

### 1. 修复搜索结果筛选和标签颜色
**问题**：搜索结果的标签颜色使用了直接的 Tailwind 颜色类（bg-blue-500 等），不符合语义化设计规范

**解决方案**：
- 更新 `getSourceBadgeVariant` 函数返回语义化的 Badge 变体：
  - academic/scholar → `default` (蓝色主题色)
  - news → `destructive` (橙色/红色警示色)
  - web/search → `secondary` (绿色次要色)
  - 其他 → `outline` (边框样式)

- 更新 Badge 组件使用：
```tsx
<Badge variant={getSourceBadgeVariant(result.source)} className="flex items-center gap-1">
  {getSourceIcon(result.source)}
  <span>{result.source}</span>
</Badge>
```

- 筛选逻辑已正确实现，通过 `source.toLowerCase()` 匹配关键词：
  - academic: 匹配 "scholar"
  - news: 匹配 "news"
  - web: 匹配 "search"

### 2. 更新数据源标签
**修改位置**：SearchPlanPanel.tsx

**更新内容**：
- 行业资讯：`(TheNews)` → `(SerpAPI - Google News)`
- 网页内容：`(Smart Search)` → `(SerpAPI - Google Search)`

这样用户可以清楚地知道系统使用的是 SerpAPI 提供的 Google 搜索服务。

### 3. 修复资料整理失败问题
**问题分析**：
- 用户点击"资料整理"按钮后，调用 `research-synthesis-agent` Edge Function
- Edge Function 查询 `knowledge_base` 表获取资料
- 但是选中的资料还在 `retrieved_materials` 表中，没有保存到 `knowledge_base`
- 导致 Edge Function 返回错误："知识库为空，请先进行资料搜索"

**解决方案**：
在 `handleOrganize` 函数中添加以下步骤：

1. 获取选中的资料（从 `retrieved_materials` 表）
2. 将选中的资料逐条保存到 `knowledge_base` 表
3. 调用 `research-synthesis-agent` Edge Function
4. 获取并显示研究洞察和空白

**代码实现**：
```typescript
// 1. 获取选中的资料
const selectedMaterials = await getSelectedMaterials(writingSession.id);

if (selectedMaterials.length === 0) {
  toast({ title: '请选择资料', description: '至少选择一条资料才能继续' });
  return;
}

// 2. 将选中的资料保存到 knowledge_base 表
for (const material of selectedMaterials) {
  await createKnowledgeBase({
    project_id: projectId,
    title: material.title,
    content: material.abstract || material.full_text || '',
    source: material.source_type,
    source_url: material.url,
    published_at: material.published_at || material.year,
    collected_at: material.created_at,
    selected: true,
    content_status: material.full_text ? 'full_text' : 'abstract_only',
    extracted_content: material.full_text ? [material.full_text] : [],
    full_text: material.full_text,
  });
}

// 3. 调用研究综合 Agent
const result = await callResearchSynthesisAgent(projectId, writingSession.id);
```

**错误处理**：
- 添加了详细的 console.log 日志
- 单个资料保存失败不会中断整个流程
- 统一的错误提示和 toast 通知

## 已完成任务
- [x] 移除资料查询缓存逻辑，每次进入页面都重新搜索
- [x] 优化日志栏显示，确保实时显示搜索进度日志

## 实现细节

### 1. 移除缓存逻辑
- 删除了 localStorage 缓存检查代码（原 lines 301-350）
- 在 useEffect 中添加 `setAutoSearched(false)` 确保每次进入页面都重置搜索状态
- 每次进入页面都会触发 `autoSearchFromBrief()` 重新搜索

### 2. 优化日志栏显示
- 在搜索开始时初始化日志：`setSearchLogs(['[时间] 开始搜索资料...'])`
- 在各个搜索阶段添加日志更新：
  - 读取需求文档
  - 生成搜索计划
  - 资料检索
  - 加载资料
  - 完成/失败
- 改进日志栏显示：
  - 从日志内容中提取时间戳显示
  - 移除日志消息中的时间戳前缀，只显示内容
  - 根据搜索状态动态改变指示灯颜色（搜索中：绿色闪烁，完成：灰色）
  - 显示最多 80 个字符的日志内容

### 3. 日志格式
所有日志都使用统一格式：`[HH:MM:SS] 消息内容`
- 便于解析和显示
- 保持时间信息的一致性

---

# 历史任务：优化研究检索和综合流程

## 问题诊断

### 搜索结果不显示的原因
1. **Race Condition**: `autoSearchFromBrief` 在 `writingSession` 初始化之前被调用
2. **sessionId 为 undefined**: 导致 Edge Function 无法保存资料到数据库
3. **数据库为空**: retrieved_materials 表中没有数据
4. **UI 条件不满足**: `showMaterialSelection && retrievedMaterials.length > 0` 条件不满足，导致显示旧的 SearchResultsPanel

### 已修复的问题
1. ✅ 添加 writingSession 检查，防止在未初始化时调用搜索
2. ✅ 添加 useEffect 监听 writingSession，在初始化后触发自动搜索
3. ✅ 修复状态更新时序问题（使用本地变量而不是依赖异步状态）
4. ✅ 添加详细的 console 日志用于调试
5. ✅ 改进错误处理和用户提示

## 需求分析

### 当前流程问题
1. 用户点击"整理资料"后，系统自动调用 Research Synthesis Agent
2. 用户无法选择具体需要的资料
3. 缺少对原文内容的展示

### 新流程要求
1. **Research Retrieval Agent 阶段**
   - 在各数据源搜索关键词
   - 获取资料标题和 URL
   - 从 URL 提取原文内容
   - 在页面展示搜索结果（标题、摘要、URL、原文）
   - 用户可以选择需要的资料（点击勾选）

2. **用户选择阶段**
   - 显示所有搜索到的资料
   - 支持用户勾选/取消勾选
   - 只有选中的资料才会进入下一步

3. **Research Synthesis Agent 阶段**
   - 只在用户选择资料后调用
   - 基于用户选中的资料进行综合分析
   - 提取观点、数据、洞察
   - 显示综合结果

4. **用户决策阶段**
   - 显示 AI 提取的观点和数据
   - 用户可以填写自己的判断
   - 标记观点是否可取
   - 添加个人评论和决策

5. **完成检查**
   - 只有完成所有决策后才能进入下一阶段

## 实施计划

### Phase 1: 数据库架构更新 ✅
- [x] 创建 retrieved_materials 表
  - id, session_id, source_type, title, url, abstract, full_text
  - authors, year, citation_count, published_at
  - is_selected (用户是否选中)
  - created_at
- [x] 添加 RLS 策略
- [x] 创建索引

### Phase 2: 更新 Research Retrieval Agent ✅
- [x] 添加 sessionId 参数
- [x] 保存检索结果到 retrieved_materials 表
- [x] 返回结构化的资料列表
- [x] 部署 Edge Function

### Phase 3: 创建资料选择 UI ✅
- [x] 创建 MaterialSelectionPanel 组件
  - 显示所有检索到的资料
  - 按数据源分类展示
  - 显示标题、作者、摘要
  - 可展开查看原文
  - 勾选框选择资料
  - 显示已选数量
  - 确认选择按钮
- [x] 添加资料详情展开/折叠
- [x] 添加全选/取消全选功能
- [x] 添加按来源筛选功能

### Phase 4: 更新 API 函数 ✅
- [x] 添加 RetrievedMaterial 类型定义
- [x] getRetrievedMaterials - 获取会话的所有检索资料
- [x] getSelectedMaterials - 获取选中的资料
- [x] updateMaterialSelection - 更新资料选择状态
- [x] batchUpdateMaterialSelection - 批量更新选择
- [x] clearRetrievedMaterials - 清空会话的检索资料
- [x] saveRetrievedMaterial - 保存单个检索资料
- [x] batchSaveRetrievedMaterials - 批量保存检索资料

### Phase 5: 更新 KnowledgeStage 流程 ✅
- [x] 添加新状态变量
  - retrievedMaterials
  - showMaterialSelection
  - materialsConfirmed
- [x] 修改 handleSearch 函数
  - 传递 sessionId 到 workflow
  - 加载检索到的资料
  - 显示 MaterialSelectionPanel
- [x] 添加 handleMaterialSelectionConfirm 处理器
- [x] 更新 handleRefreshSearch 处理器
- [x] 更新按钮状态和提示文本
- [x] 条件渲染资料选择界面
- [x] 修复 race condition 问题
- [x] 添加 writingSession 检查
- [x] 添加详细日志

### Phase 6: Bug 修复 ✅
- [x] 修复 writingSession 初始化时序问题
- [x] 修复状态更新异步问题
- [x] 添加错误处理和用户提示
- [x] 添加调试日志

### Phase 7: 修改 Research Synthesis Agent 调用 ⏳
- [ ] 修改 handleOrganize 函数
  - 检查是否有选中的资料
  - 只传递选中的资料给 Synthesis Agent
- [ ] 更新 callResearchSynthesisAgent
  - 接收选中的资料列表
  - 基于选中资料进行综合分析

### Phase 8: 增强用户决策界面 ⏳
- [ ] 在 ResearchSynthesisReview 中添加
  - 用户判断输入框
  - 观点可取性评分
  - 个人评论文本框
  - 决策理由说明
- [ ] 更新决策保存逻辑
  - 保存用户判断
  - 保存评分和评论
- [ ] 添加决策完成度进度条

### Phase 9: 测试和优化 ⏳
- [ ] 测试完整流程
- [ ] 优化加载性能
- [ ] 添加错误处理
- [ ] 优化 UI 交互

## 已完成功能

### 数据库
- ✅ retrieved_materials 表已创建
- ✅ RLS 策略已配置
- ✅ 索引已创建

### Edge Function
- ✅ research-retrieval-agent 已更新
  - 接收 sessionId 参数
  - 保存资料到数据库
  - 支持所有数据源

### API 函数
- ✅ 8 个新的 API 函数已添加
- ✅ 类型定义已更新
- ✅ 添加调试日志

### UI 组件
- ✅ MaterialSelectionPanel 已创建
  - 按来源分组显示
  - 支持展开/折叠
  - 支持全选/取消全选
  - 显示原文内容
  - 实时更新选择状态

### 工作流
- ✅ KnowledgeStage 已更新
  - 新的状态管理
  - 资料选择流程
  - 条件渲染逻辑
  - Race condition 修复
  - 错误处理改进

## Bug 修复记录

### 2026-02-10: 修复写作会话初始化失败（PGRST116 错误）

**问题**: 
- 从明确需求页进入资料查询页时没有反应
- 点击刷新按钮也没有反应
- 控制台显示错误："初始化写作会话失败"
- PostgreSQL 错误 PGRST116: "Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row"

**根本原因**:
- `getOrCreateWritingSession` 函数使用 `.maybeSingle()` 查询 writing_sessions 表
- 数据库中同一个 project_id 存在多个 writing_sessions 记录
- `.maybeSingle()` 期望返回 0 或 1 行，但实际返回了 2 行
- 导致 PostgreSQL 返回 PGRST116 错误

**解决方案**:
- 在查询中添加 `.order('created_at', { ascending: false })` 按创建时间倒序排序
- 添加 `.limit(1)` 限制只返回最新的一条记录
- 这样即使有多个会话，也只会获取最新的那个

**修改文件**:
- src/db/api.ts
  - 修改 `getOrCreateWritingSession` 函数
  - 添加排序和限制条件确保只返回一条记录

**技术细节**:
- Supabase 的 `.maybeSingle()` 要求查询结果必须是 0 或 1 行
- 如果结果超过 1 行，会抛出 PGRST116 错误
- 使用 `.order().limit(1).maybeSingle()` 可以安全地获取最新记录
- 这种方式比删除旧记录更安全，保留了历史数据

---

### 2026-02-10: 从明确需求页自动带入需求文档并生成搜索计划

**需求**: 
1. 从明确需求页跳转到资料查询页时，将需求文档内容带到下一页
2. 自动调用 research retrieval agent 生成搜索计划
3. 按照各类关键词去对应数据源搜索相关内容

**实现方案**:
1. **需求文档传递**: 
   - ProjectWorkflowPage 已经加载 requirementsDoc
   - KnowledgeStage 的 autoSearchFromBrief 函数从数据库加载完整需求文档
   - handleSearch 函数构建完整的 requirementsDoc JSON 对象传递给 agent

2. **搜索计划生成**:
   - research-retrieval-agent Edge Function 使用 LLM 分析需求文档
   - 生成针对不同数据源的搜索关键词：
     * academic_queries: 学术搜索关键词（Google Scholar）
     * news_queries: 新闻搜索关键词（TheNews）
     * web_queries: 网络搜索关键词（Smart Search/Bing）
     * user_library_queries: 用户库搜索关键词
   - 返回 search_summary 包含主题理解和关键维度

3. **UI 反馈增强**:
   - 添加 searchPlan 状态存储搜索计划
   - 在搜索过程中显示"生成搜索计划"阶段
   - 搜索计划生成后显示 toast 通知
   - SearchPlanPanel 组件展示完整搜索计划
   - 显示各数据源的具体搜索关键词

4. **自动搜索流程**:
   - 用户从明确需求页点击"进入下一阶段"
   - KnowledgeStage 初始化 writingSession
   - autoSearchFromBrief 等待 session 初始化完成
   - 加载需求文档并自动触发搜索
   - 显示搜索计划生成和执行过程
   - 展示检索到的资料供用户选择

**修改文件**:
- src/components/workflow/KnowledgeStage.tsx
  - 添加 searchPlan 状态
  - 增强 autoSearchFromBrief 日志和提示
  - 改进 handleSearch 搜索进度提示
  - 提取并显示搜索计划
  - 添加搜索计划生成阶段的 UI 反馈

**技术细节**:
- Edge Function 已有完整的搜索计划生成逻辑
- 使用通义千问 LLM 分析需求文档
- 针对不同数据源生成专门的搜索关键词
- 学术搜索使用英文关键词
- 新闻和网络搜索支持中英文关键词
- 搜索计划包含在 retrievalResults.search_summary 中

---

### 2026-02-10: 搜索结果不显示
**问题**: 用户搜索后看到"找到 0 条相关结果"，MaterialSelectionPanel 不显示

**根本原因**:
1. `autoSearchFromBrief` 在 `writingSession` 初始化前被调用
2. `sessionId` 为 undefined，导致 Edge Function 无法保存资料
3. `retrieved_materials` 表为空
4. UI 条件 `retrievedMaterials.length > 0` 不满足

**解决方案**:
1. 在 `handleSearch` 开始时检查 `writingSession` 是否存在
2. 在 `autoSearchFromBrief` 中添加 `writingSession` 检查
3. 添加新的 useEffect 监听 `writingSession`，在初始化后触发自动搜索
4. 修复状态更新时序问题（使用本地变量）
5. 添加详细的 console 日志用于调试

**修改文件**:
- src/components/workflow/KnowledgeStage.tsx
- src/db/api.ts

## 下一步工作

1. **测试修复**
   - 用户需要刷新页面并重新搜索
   - 检查 console 日志确认 sessionId 正确传递
   - 验证资料保存到数据库
   - 确认 MaterialSelectionPanel 正确显示

2. **修改 Research Synthesis Agent 调用**
   - 只使用选中的资料
   - 优化综合分析逻辑

3. **增强用户决策界面**
   - 添加用户判断字段
   - 添加评分和评论功能

---

# 任务：集成 SerpAPI 替换现有搜索 API

## 完成情况

### ✅ 已完成

#### 1. SerpAPI 密钥配置
- [x] 添加 SERPAPI_KEY 到 Supabase Secrets
- [x] API Key: c96ae1f8fd0f0d0095948456dd7db91558ead973f0e8d884a1b7635804a96f41

#### 2. Google Scholar 搜索 (google-scholar-search)
- [x] 替换原有 API 为 SerpAPI
- [x] 使用 SerpAPI Google Scholar engine
- [x] 保持原有接口参数兼容性
  - query: 搜索关键词
  - yearStart: 起始年份
  - yearEnd: 结束年份
  - start: 分页起始位置
- [x] 保持原有返回格式
  - papers: 论文列表
  - total: 总结果数
- [x] 部署 Edge Function

#### 3. 新闻搜索 (thenews-search)
- [x] 替换 TheNews API 为 SerpAPI Google News
- [x] 使用 SerpAPI Google News engine
- [x] 保持原有接口参数兼容性
  - query: 搜索关键词
  - limit: 结果数量限制
  - language: 语言设置
- [x] 根据语言自动设置地区
  - 中文: gl=cn, hl=zh-cn
  - 英文: gl=us, hl=en
- [x] 保持原有返回格式
  - papers: 新闻列表
  - total: 总结果数
  - sources: 来源列表
- [x] 部署 Edge Function

#### 4. 智能搜索 (ai-search)
- [x] 替换 Gemini AI Search 为 SerpAPI Google Search
- [x] 使用 SerpAPI Google Search engine
- [x] 保持原有接口参数兼容性
  - query: 搜索关键词
  - num: 结果数量（默认10）
- [x] 生成摘要（使用前3个结果的片段）
- [x] 提取来源信息
- [x] 保持原有返回格式
  - summary: 搜索摘要
  - sources: 来源列表
  - source: 数据源标识
- [x] 部署 Edge Function

## 功能说明

### SerpAPI 集成优势

1. **统一 API 接口**
   - 所有搜索功能使用同一个 API 密钥
   - 简化配置和管理
   - 降低维护成本

2. **Google Scholar 搜索**
   - 直接访问 Google Scholar 数据
   - 支持年份筛选
   - 支持分页
   - 返回引用数、作者、摘要等完整信息

3. **Google News 搜索**
   - 实时新闻数据
   - 支持多语言和地区设置
   - 返回发布时间、来源等信息
   - 自动根据语言设置地区

4. **Google Search 搜索**
   - 通用网页搜索
   - 返回有机搜索结果
   - 提供片段和链接
   - 自动生成摘要

### API 调用示例

#### Google Scholar
```typescript
// 请求
{
  "query": "machine learning",
  "yearStart": "2020",
  "yearEnd": "2024",
  "start": 0
}

// 响应
{
  "papers": [
    {
      "title": "论文标题",
      "authors": "作者信息",
      "year": "2023",
      "abstract": "摘要",
      "citations": 100,
      "url": "https://...",
      "source": "Google Scholar"
    }
  ],
  "total": 1000
}
```

#### Google News
```typescript
// 请求
{
  "query": "人工智能",
  "limit": 10,
  "language": "zh,en"
}

// 响应
{
  "papers": [
    {
      "title": "新闻标题",
      "authors": "来源名称",
      "year": "2024",
      "abstract": "新闻摘要",
      "url": "https://...",
      "source": "Google News",
      "publishedAt": "2024-01-01"
    }
  ],
  "total": 10,
  "sources": [...]
}
```

#### Google Search
```typescript
// 请求
{
  "query": "AI技术发展",
  "num": 10
}

// 响应
{
  "summary": "综合摘要...",
  "sources": [
    {
      "url": "https://...",
      "title": "标题",
      "snippet": "片段"
    }
  ],
  "source": "Google Search",
  "total": 1000
}
```

## 技术细节

### SerpAPI 端点
- 基础 URL: `https://serpapi.com/search`
- 认证方式: API Key 作为查询参数

### 支持的引擎
1. **google_scholar**: 学术搜索
2. **google_news**: 新闻搜索
3. **google**: 通用网页搜索

### 参数映射

#### Google Scholar
- `engine=google_scholar`: 指定搜索引擎
- `q`: 搜索关键词
- `as_ylo`: 起始年份
- `as_yhi`: 结束年份
- `start`: 分页起始位置
- `num`: 每页结果数

#### Google News
- `engine=google_news`: 指定搜索引擎
- `q`: 搜索关键词
- `num`: 结果数量
- `gl`: 地区代码（cn/us）
- `hl`: 语言代码（zh-cn/en）

#### Google Search
- `engine=google`: 指定搜索引擎
- `q`: 搜索关键词
- `num`: 结果数量
- `gl`: 地区代码
- `hl`: 语言代码

### 返回数据结构

#### Google Scholar
```json
{
  "organic_results": [
    {
      "title": "标题",
      "link": "链接",
      "snippet": "摘要",
      "publication_info": {
        "summary": "作者和年份信息"
      },
      "inline_links": {
        "cited_by": {
          "total": 100
        }
      }
    }
  ],
  "search_information": {
    "total_results": 1000
  }
}
```

#### Google News
```json
{
  "news_results": [
    {
      "title": "标题",
      "link": "链接",
      "snippet": "摘要",
      "date": "发布时间",
      "source": {
        "name": "来源名称"
      }
    }
  ]
}
```

#### Google Search
```json
{
  "organic_results": [
    {
      "title": "标题",
      "link": "链接",
      "snippet": "片段"
    }
  ],
  "search_information": {
    "total_results": 1000
  }
}
```

## 兼容性说明

### 接口兼容性
- ✅ 所有 Edge Function 保持原有接口参数
- ✅ 所有 Edge Function 保持原有返回格式
- ✅ 前端代码无需修改
- ✅ 现有功能完全兼容

### 数据格式兼容性
- ✅ Google Scholar: 完全兼容
- ✅ Google News: 完全兼容（source 字段从 "TheNews" 改为 "Google News"）
- ✅ Google Search: 完全兼容（source 字段从 "AI Search" 改为 "Google Search"）

## 测试建议

1. **Google Scholar 搜索测试**
   - 测试基本搜索
   - 测试年份筛选
   - 测试分页功能
   - 验证返回数据格式

2. **Google News 搜索测试**
   - 测试中文搜索
   - 测试英文搜索
   - 测试结果数量限制
   - 验证发布时间

3. **Google Search 测试**
   - 测试基本搜索
   - 验证摘要生成
   - 验证来源提取
   - 测试结果数量

4. **集成测试**
   - 在资料查询页面测试完整搜索流程
   - 验证多数据源搜索
   - 验证结果展示
   - 验证资料保存

## 注意事项

### API 配额
- SerpAPI 有每月搜索次数限制
- 建议监控 API 使用情况
- 必要时可升级 SerpAPI 套餐

### 错误处理
- 所有 Edge Function 都包含完整的错误处理
- API 失败时返回友好的错误信息
- 前端可以正常处理错误响应

### 性能优化
- SerpAPI 响应速度通常较快
- 建议实现结果缓存机制
- 避免重复搜索相同关键词

---

# 任务：研究综合 Agent 和用户决策流程

## 完成情况

### ✅ 已完成

#### 1. 数据库架构
- [x] 创建 writing_sessions 表（写作会话）
- [x] 创建 research_insights 表（研究洞察）
- [x] 创建 research_gaps 表（研究矛盾/空白）
- [x] 创建 structure_decisions 表（结构决策）
- [x] 创建 paragraph_decisions 表（段落决策）
- [x] 创建 evidence_decisions 表（证据决策）
- [x] 添加 RLS 策略
- [x] 创建索引

#### 2. Edge Function
- [x] 创建 research-synthesis-agent Edge Function
- [x] 实现 Research Synthesis Agent prompt
- [x] 解析 JSON 输出
- [x] 保存洞察到数据库
- [x] 保存矛盾/空白到数据库
- [x] 部署 Edge Function

#### 3. 类型定义
- [x] 添加 WritingSession 类型
- [x] 添加 WritingStage 枚举
- [x] 添加 ResearchInsight 类型
- [x] 添加 ResearchGap 类型
- [x] 添加 UserDecision 类型
- [x] 添加 SynthesisResult 类型
- [x] 添加其他决策类型

#### 4. API 函数
- [x] getOrCreateWritingSession - 获取或创建写作会话
- [x] updateWritingSessionStage - 更新写作阶段
- [x] callResearchSynthesisAgent - 调用研究综合 Agent
- [x] getResearchInsights - 获取研究洞察
- [x] getResearchGaps - 获取研究空白
- [x] updateInsightDecision - 更新洞察决策
- [x] batchUpdateInsightDecisions - 批量更新决策
- [x] updateGapDecision - 更新空白决策
- [x] isResearchStageComplete - 检查阶段是否完成

#### 5. UI 组件
- [x] 创建 ResearchSynthesisReview 组件
  - 显示 AI 思考过程
  - 按分类显示研究洞察
  - 显示支持数据
  - 显示推荐使用和可引用性标签
  - 显示局限性警告
  - 用户决策选项（必须使用/背景补充/排除）
  - 显示矛盾和空白
  - 决策完成度检查
  - 保存决策功能

#### 6. KnowledgeStage 集成
- [x] 添加写作会话状态管理
- [x] 初始化写作会话
- [x] 更新 handleOrganize 调用新 Agent
- [x] 显示综合审阅界面
- [x] 更新 handleNextStep 检查决策完成
- [x] 更新按钮状态和提示
- [x] 条件渲染审阅界面

## 功能说明

### 用户决策流程

1. **资料搜索阶段**
   - 用户进行资料搜索
   - 系统从多个数据源检索资料
   - 资料保存到知识库

2. **资料整理阶段**
   - 用户点击"资料整理"按钮
   - 调用 Research Synthesis Agent
   - Agent 分析资料并生成：
     * 研究洞察（按分类组织）
     * 支持数据
     * 推荐使用方式
     * 可引用性评估
     * 局限性说明
     * 矛盾和空白点

3. **用户决策阶段**
   - 显示综合审阅界面
   - 用户为每条洞察做出决策：
     * 必须使用（must_use）
     * 背景补充（background）
     * 排除（excluded）
   - 用户为每个矛盾/空白做出决策：
     * 需要处理（respond）
     * 忽略（ignore）
   - 所有决策完成后才能保存

4. **进入下一阶段**
   - 只有完成所有决策后才能进入下一阶段
   - 按钮状态根据决策完成度动态更新
   - 更新写作会话阶段为 'structure'

### Research Synthesis Agent 特点

1. **用户决策导向**
   - 不做价值取舍
   - 不假设用户立场
   - 所有观点等待用户决策

2. **高密度提炼**
   - 提取核心结论/观点
   - 提取关键数据
   - 标注方法和框架
   - 标注与需求的对应关系

3. **结构化输出**
   - 按分类组织洞察
   - 标注推荐使用方式
   - 标注可引用性
   - 标注局限性
   - 标注矛盾和空白

4. **时效性优先**
   - 优先使用 2025-2026 数据
   - 旧数据标记为历史背景

### 数据库设计

#### writing_sessions
- 跟踪写作流程状态
- 记录当前阶段
- 记录锁定状态

#### research_insights
- 存储研究洞察
- 记录用户决策
- 关联写作会话

#### research_gaps
- 存储矛盾和空白
- 记录用户决策
- 关联写作会话

#### 其他决策表
- 为后续阶段预留
- structure_decisions
- paragraph_decisions
- evidence_decisions

## 技术细节

### Edge Function 调用流程

```typescript
// 1. 获取项目信息和知识库
const project = await getProject(projectId);
const knowledge = await getKnowledgeBase(projectId);

// 2. 构建 prompt
const systemPrompt = `Research Synthesis Agent...`;
const userMessage = `请对以下资料进行研究综合整理...`;

// 3. 调用 LLM
const response = await callLLM(systemPrompt, userMessage);

// 4. 解析 JSON
const synthesis = parseJSON(response);

// 5. 保存到数据库
await saveInsights(sessionId, synthesis.synthesized_insights);
await saveGaps(sessionId, synthesis.contradictions_or_gaps);
```

### 用户决策保存流程

```typescript
// 1. 用户在 UI 中选择决策
handleInsightDecisionChange(insightId, 'must_use');

// 2. 本地状态更新
setLocalInsights(prev => ...);

// 3. 检查完成度
const allComplete = localInsights.every(i => i.user_decision !== 'pending');

// 4. 保存到数据库
await batchUpdateInsightDecisions(decisions);

// 5. 更新阶段状态
await updateWritingSessionStage(sessionId, 'structure');
```

## 后续扩展

### 结构决策阶段
- 生成文章结构
- 用户确认核心论点
- 用户调整论证块顺序
- 用户删除不需要的块

### 段落决策阶段
- 生成段落结构
- 用户选择接受/修改/跳过
- 用户选择修改类型

### 证据决策阶段
- 为每个子论点提供证据选项
- 用户选择使用哪些证据

### 写作阶段
- 基于用户决策生成文章
- 只使用用户选择的内容

## 测试建议

1. **资料整理测试**
   - 测试无资料时的提示
   - 测试 Agent 调用
   - 测试 JSON 解析
   - 测试数据保存

2. **决策界面测试**
   - 测试洞察显示
   - 测试决策选项
   - 测试完成度检查
   - 测试保存功能

3. **流程控制测试**
   - 测试未完成决策时禁止进入下一阶段
   - 测试完成决策后启用按钮
   - 测试阶段更新

4. **边界情况测试**
   - 测试空洞察列表
   - 测试空矛盾列表
   - 测试 Agent 失败
   - 测试保存失败

