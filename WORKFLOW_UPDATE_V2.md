# 工作流更新 V2 - 简化资料整理流程

## 更新内容

### 1. 移除独立的"资料整理"按钮
**之前**: 资料查询页有两个按钮："资料整理" 和 "进入下一阶段"
**现在**: 只保留"进入下一阶段"按钮，整合所有功能

### 2. 优化"进入下一阶段"按钮逻辑
**位置**: `KnowledgeStage.tsx` - `handleNextStep` 函数

**新流程**:
1. 检查是否有检索到的资料
2. 如果还没有执行研究综合，自动执行：
   - 获取所有检索到的资料
   - 保存到 knowledge_base 表
   - 调用 research-synthesis-agent
   - 生成 insights 和 gaps
3. 更新项目状态为 'material_review'
4. 跳转到资料整理页

**关键代码**:
```typescript
const handleNextStep = async () => {
  // 1. 验证前置条件
  if (!writingSession) {
    toast({ title: '会话未初始化', description: '请刷新页面重试', variant: 'destructive' });
    return;
  }

  if (retrievedMaterials.length === 0) {
    toast({ title: '暂无资料', description: '请先进行资料搜索', variant: 'destructive' });
    return;
  }

  try {
    setConfirming(true);
    
    // 2. 如果还没有完成研究综合，先执行综合
    if (!researchStageComplete) {
      // 2.1 获取所有检索到的资料
      const allMaterials = await getRetrievedMaterials(writingSession.id);
      
      // 2.2 保存到 knowledge_base
      const existingKnowledge = await getKnowledgeBase(projectId);
      const existingUrls = new Set(existingKnowledge.map(k => k.source_url).filter(Boolean));
      
      for (const material of allMaterials) {
        if (material.url && existingUrls.has(material.url)) continue;
        
        await createKnowledgeBase({
          project_id: projectId,
          title: material.title,
          content: material.abstract || material.full_text || '',
          source: material.source_type,
          source_url: material.url,
          published_at: material.published_at || (material.year ? `${material.year}-01-01T00:00:00Z` : null),
          collected_at: material.created_at,
          selected: true,
          content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
          extracted_content: material.full_text ? [material.full_text] : [],
          full_text: material.full_text,
        });
      }
      
      // 2.3 调用研究综合 Agent
      await callResearchSynthesisAgent(projectId, writingSession.id);
      
      // 2.4 获取生成的 insights 和 gaps
      const insights = await getResearchInsights(writingSession.id);
      const gaps = await getResearchGaps(writingSession.id);
    }
    
    // 3. 更新项目状态
    await updateProject(projectId, { status: 'material_review' });
    
    // 4. 刷新页面，显示 MaterialReviewStage
    onComplete();
  } catch (error) {
    // 错误处理
  } finally {
    setConfirming(false);
  }
};
```

### 3. 增强 MaterialReviewStage 的错误处理
**位置**: `MaterialReviewStage.tsx` - `loadMaterials` 函数

**改进**:
1. 添加详细的控制台日志
2. 验证 session 和 session.id 的有效性
3. 提供更友好的错误提示

**关键代码**:
```typescript
const loadMaterials = async () => {
  try {
    setLoading(true);
    
    console.log('[MaterialReviewStage] 开始加载资料，projectId:', projectId);
    
    // 获取 writing session
    const session = await getWritingSession(projectId);
    console.log('[MaterialReviewStage] getWritingSession 返回:', session);
    
    if (!session) {
      console.error('[MaterialReviewStage] 会话未找到');
      toast({
        title: '会话未找到',
        description: '请先完成资料查询阶段',
        variant: 'destructive',
      });
      return;
    }
    
    if (!session.id) {
      console.error('[MaterialReviewStage] session.id 为空');
      toast({
        title: '会话ID无效',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('[MaterialReviewStage] session.id:', session.id);
    setSessionId(session.id);
    
    // 获取研究洞察和空白
    console.log('[MaterialReviewStage] 开始获取 insights 和 gaps');
    const [insights, gaps] = await Promise.all([
      getResearchInsights(session.id),
      getResearchGaps(session.id)
    ]);
    
    console.log('[MaterialReviewStage] insights:', insights.length, 'gaps:', gaps.length);
    
    // ... 转换和设置数据
  } catch (error: any) {
    console.error('[MaterialReviewStage] 加载资料失败:', error);
    console.error('[MaterialReviewStage] 错误详情:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    toast({
      title: '加载失败',
      description: error.message || '无法加载研究资料',
      variant: 'destructive',
    });
  } finally {
    setLoading(false);
  }
};
```

### 4. UI 更新

#### 资料查询页 (KnowledgeStage)
**之前**:
```
[资料整理] [进入下一阶段]
```

**现在**:
```
[进入下一阶段]
```

**按钮状态**:
- 启用条件: `retrievedMaterials.length > 0`
- 禁用条件: `confirming || retrievedMaterials.length === 0`
- 按钮文本: 
  - 正常: "进入下一阶段"
  - 处理中: "处理中..."

**提示文本**:
- 有资料: "已检索到 X 条资料，点击"进入下一阶段"开始整理"
- 无资料: "请先进行资料搜索"

## 数据流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 资料查询阶段 (KnowledgeStage)                                      │
│                                                                   │
│  1. 用户输入查询主题                                                │
│     ↓                                                             │
│  2. 调用 research-retrieval-agent                                 │
│     ↓                                                             │
│  3. 显示检索结果 (retrieved_materials 表)                          │
│     ↓                                                             │
│  4. 用户点击"进入下一阶段"                                          │
│     ↓                                                             │
│  5. 自动执行资料整理:                                               │
│     a. 获取所有 retrieved_materials                               │
│     b. 保存到 knowledge_base 表                                   │
│     c. 调用 research-synthesis-agent                              │
│     d. 生成 research_insights + research_gaps                     │
│     e. 保存到数据库                                                │
│     ↓                                                             │
│  6. 更新 project.status = 'material_review'                       │
│     ↓                                                             │
│  7. 刷新页面 (onComplete)                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 资料整理阶段 (MaterialReviewStage)                                 │
│                                                                   │
│  1. 加载 writing_session                                          │
│     ↓                                                             │
│  2. 获取 research_insights + research_gaps                        │
│     ↓                                                             │
│  3. 显示资料列表供用户决策                                          │
│     ↓                                                             │
│  4. 用户对每项资料做决策                                            │
│     ↓                                                             │
│  5. 所有决策完成后，点击"进入下一阶段"                              │
│     ↓                                                             │
│  6. 调用 article-structure-agent                                  │
│     ↓                                                             │
│  7. 更新 project.status = 'outline_confirmed'                     │
│     ↓                                                             │
│  8. 刷新页面，显示文章结构页                                        │
└─────────────────────────────────────────────────────────────────┘
```

## 用户体验改进

### 1. 简化操作流程
**之前**: 需要两步操作
1. 点击"资料整理"等待完成
2. 点击"进入下一阶段"

**现在**: 只需一步操作
1. 点击"进入下一阶段"（自动完成整理并跳转）

### 2. 更清晰的状态提示
- 按钮文本动态变化："进入下一阶段" → "处理中..."
- 底部提示明确告知用户当前状态和下一步操作

### 3. 更好的错误处理
- 详细的控制台日志便于调试
- 友好的错误提示帮助用户理解问题
- 针对性的解决方案提示（如 API 密钥配置）

## 技术细节

### 1. 状态管理
- `confirming`: 控制按钮禁用状态和文本显示
- `researchStageComplete`: 判断是否需要执行研究综合
- `retrievedMaterials`: 检索到的资料列表
- `synthesisLogs`: 记录整理过程的日志

### 2. 数据持久化
所有数据都保存在 Supabase 数据库中：
- `retrieved_materials`: 检索到的原始资料
- `knowledge_base`: 保存到知识库的资料
- `research_insights`: 研究洞察
- `research_gaps`: 研究空白/矛盾
- `writing_sessions`: 会话信息和综合结果

### 3. 错误处理策略
1. **前置验证**: 检查必要条件（session、materials）
2. **详细日志**: 记录每个步骤的执行情况
3. **友好提示**: 将技术错误转换为用户可理解的提示
4. **状态恢复**: 确保错误后状态正确恢复

## 测试要点

### 功能测试
- [ ] 资料查询页只显示一个"进入下一阶段"按钮
- [ ] 无资料时按钮禁用
- [ ] 有资料时按钮启用
- [ ] 点击按钮后自动执行资料整理
- [ ] 整理完成后自动跳转到资料整理页
- [ ] 资料整理页正确加载 insights 和 gaps
- [ ] 资料整理页显示正确的数量统计

### 错误处理测试
- [ ] 会话未初始化时显示错误提示
- [ ] 无资料时显示错误提示
- [ ] API 调用失败时显示错误提示
- [ ] 数据库操作失败时显示错误提示

### 边界情况测试
- [ ] 重复点击按钮的处理
- [ ] 已完成综合后再次进入的处理
- [ ] 网络中断时的处理
- [ ] 大量资料时的性能表现

## 常见问题排查

### 问题 1: 资料整理页显示 "0 / 0"
**原因**: 
- writing_session 未创建或未找到
- research-synthesis-agent 未成功执行
- insights/gaps 未保存到数据库

**排查步骤**:
1. 检查控制台日志，查看 `[MaterialReviewStage]` 开头的日志
2. 确认 `getWritingSession` 返回了有效的 session
3. 确认 `session.id` 不为空
4. 检查 `research_insights` 和 `research_gaps` 表是否有数据

**解决方案**:
1. 确保在资料查询阶段调用了 `getOrCreateWritingSession`
2. 确保 research-synthesis-agent 成功执行
3. 检查 Edge Function 日志确认数据是否保存成功

### 问题 2: "invalid input syntax for type uuid: ''"
**原因**: session.id 为空字符串

**排查步骤**:
1. 检查 `getWritingSession` 的返回值
2. 确认 `writing_sessions` 表中有对应的记录
3. 检查 `project_id` 是否正确

**解决方案**:
1. 在 MaterialReviewStage 中添加了 session.id 的验证
2. 如果 session.id 为空，显示友好的错误提示
3. 建议用户刷新页面或重新执行资料查询

### 问题 3: "JSON object requested, multiple (or no) rows returned"
**原因**: `getWritingSession` 使用 `.maybeSingle()` 但返回了多行（存在重复的 writing_sessions 记录）

**排查步骤**:
1. 检查 `writing_sessions` 表是否有重复记录
2. 确认查询条件 `project_id` 是否正确

**解决方案**:
1. ✅ **已修复**: 更新 `getWritingSession` 函数，添加 `.order('created_at', { ascending: false }).limit(1)` 获取最新的 session
2. ✅ **已修复**: 添加数据库唯一约束 `writing_sessions_project_id_unique` 防止重复记录
3. ✅ **已修复**: 清理了数据库中的重复 writing_sessions 记录

**修复代码**:
```typescript
export async function getWritingSession(projectId: string): Promise<WritingSession | null> {
  const { data, error } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })  // 按创建时间倒序
    .limit(1)                                    // 只取最新的一条
    .maybeSingle();

  if (error) throw error;
  return data as WritingSession | null;
}
```

**数据库约束**:
```sql
-- 确保每个项目只有一个写作会话
ALTER TABLE writing_sessions
ADD CONSTRAINT writing_sessions_project_id_unique UNIQUE (project_id);
```

## 后续优化建议

### 1. 性能优化
- 使用事务批量保存资料到 knowledge_base
- 优化 research-synthesis-agent 的响应时间
- 添加进度条显示整理进度

### 2. 用户体验
- 添加"取消"按钮允许中断整理过程
- 显示实时日志让用户了解当前进度
- 添加估计完成时间

### 3. 数据管理
- 添加资料去重逻辑
- 支持增量更新（只整理新增资料）
- 添加缓存机制避免重复计算

### 4. 错误恢复
- 支持从中断点继续执行
- 添加自动重试机制
- 保存中间状态便于恢复
