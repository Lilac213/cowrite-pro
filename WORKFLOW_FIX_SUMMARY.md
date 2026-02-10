# 工作流修复总结

## 修复内容

### 1. 数据库枚举修复
**问题**: `project_status` 枚举缺少 `material_review` 值，导致更新项目状态时报错
**解决方案**: 创建迁移添加 `material_review` 状态

```sql
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'material_review' AFTER 'knowledge_selected';
```

### 2. 完整工作流程

#### 阶段 1: 资料查询 (knowledge_selected)
**位置**: `KnowledgeStage.tsx`
**功能**:
1. 用户输入查询主题
2. 调用 `research-retrieval-agent` 进行资料检索
3. 显示检索到的资料列表
4. 用户选择需要的资料
5. 点击"资料整理"按钮

**"资料整理"按钮操作**:
```typescript
// 调用研究综合 Agent
await callResearchSynthesisAgent(projectId, sessionId);

// 这会:
// 1. 分析选中的资料
// 2. 生成 research_insights (观点洞察)
// 3. 生成 research_gaps (矛盾空白)
// 4. 保存到数据库
```

**"进入下一阶段"按钮操作**:
```typescript
const handleNextStep = async () => {
  // 检查是否已完成研究综合
  if (!researchStageComplete) {
    toast({
      title: '请先完成资料整理',
      description: '需要先点击"资料整理"并完成研究综合后才能进入下一阶段',
      variant: 'destructive',
    });
    return;
  }

  // 更新项目状态到资料整理阶段
  await updateProject(projectId, { 
    status: 'material_review'
  });
  
  onComplete(); // 刷新页面，显示 MaterialReviewStage
};
```

#### 阶段 2: 资料整理 (material_review)
**位置**: `MaterialReviewStage.tsx`
**功能**:
1. 从数据库加载 `research_insights` 和 `research_gaps`
2. 左侧显示:
   - 资料类型统计
   - 审阅指南（必须使用/背景补充/排除）
3. 右侧显示:
   - 观点洞察列表（insights）
   - 矛盾空白列表（gaps）
   - 每项资料有三个单选按钮供用户决策
4. 支持批量选择和批量操作
5. 底部显示运行日志
6. 日志详情按钮显示 synthesis agent 的输入输出

**数据加载**:
```typescript
useEffect(() => {
  const loadData = async () => {
    // 1. 获取 writing_session
    const session = await getWritingSession(projectId);
    setSessionId(session.id);
    
    // 2. 加载 insights 和 gaps
    const [insights, gaps] = await Promise.all([
      getResearchInsights(session.id),
      getResearchGaps(session.id)
    ]);
    
    // 3. 转换为统一的 MaterialItem 格式
    const items = [
      ...insights.map(i => ({
        id: i.id,
        type: 'insight',
        category: i.category,
        content: i.insight,
        decision: i.user_decision,
        data: i
      })),
      ...gaps.map(g => ({
        id: g.id,
        type: 'gap',
        category: '矛盾与空白',
        content: g.description,
        decision: g.user_decision,
        data: g
      }))
    ];
    
    setMaterials(items);
    
    // 4. 恢复日志数据
    if (session.synthesis_result) {
      setSynthesisLog({
        thought: session.synthesis_result.thought,
        input: session.synthesis_result.input,
        synthesis: session.synthesis_result.synthesis
      });
    }
  };
  
  loadData();
}, [projectId]);
```

**用户决策操作**:
```typescript
// 单项决策
const handleSingleDecision = async (id: string, decision: string) => {
  const material = materials.find(m => m.id === id);
  
  if (material.type === 'insight') {
    await updateInsightDecision(id, decision);
  } else {
    await updateGapDecision(id, decision);
  }
  
  // 更新本地状态
  setMaterials(prev => prev.map(m => 
    m.id === id ? { ...m, decision } : m
  ));
};

// 批量决策
const handleBatchDecision = async (decision: string) => {
  const promises = Array.from(selectedIds).map(id => {
    const material = materials.find(m => m.id === id);
    if (material.type === 'insight') {
      return updateInsightDecision(id, decision);
    } else {
      return updateGapDecision(id, decision);
    }
  });
  
  await Promise.all(promises);
  
  // 更新本地状态
  setMaterials(prev => prev.map(m => 
    selectedIds.has(m.id) ? { ...m, decision } : m
  ));
  
  setSelectedIds(new Set());
};
```

**"进入下一阶段"按钮操作**:
```typescript
const handleNextStage = async () => {
  // 检查是否所有资料都已决策
  if (pendingCount > 0) {
    toast({
      title: '还有未决策的资料',
      description: `还有 ${pendingCount} 项资料未决策，请完成所有决策后再进入下一阶段`,
      variant: 'destructive',
    });
    return;
  }

  setSaving(true);
  
  try {
    // 1. 调用文章结构生成 Agent
    await callArticleStructureAgent(sessionId, projectId);
    
    // 2. 更新会话阶段
    await updateWritingSessionStage(sessionId, 'structure');
    
    // 3. 更新项目状态
    await updateProject(projectId, {
      status: 'outline_confirmed'
    });
    
    toast({
      title: '已进入下一阶段',
      description: '文章结构已生成，开始结构设计',
    });
    
    onComplete(); // 刷新页面，显示 OutlineStage
  } catch (error) {
    toast({
      title: '操作失败',
      description: error.message || '无法生成文章结构',
      variant: 'destructive',
    });
  } finally {
    setSaving(false);
  }
};
```

#### 阶段 3: 文章结构 (outline_confirmed)
**位置**: `OutlineStage.tsx`
**功能**:
1. 显示由 `article-structure-agent` 生成的文章结构
2. 用户可以编辑和调整结构
3. 确认后进入下一阶段

## 数据流程图

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 资料查询阶段 (KnowledgeStage)                                  │
│                                                                   │
│  用户输入查询 → 调用 research-retrieval-agent                      │
│                ↓                                                  │
│  显示检索结果 → 用户选择资料                                        │
│                ↓                                                  │
│  点击"资料整理" → 调用 research-synthesis-agent                    │
│                ↓                                                  │
│  生成 insights + gaps → 保存到数据库                               │
│                ↓                                                  │
│  点击"进入下一阶段" → 更新 status = 'material_review'              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. 资料整理阶段 (MaterialReviewStage)                             │
│                                                                   │
│  加载 insights + gaps → 显示资料列表                               │
│                ↓                                                  │
│  用户对每项资料做决策:                                              │
│    - 必须使用 (adopt/respond)                                      │
│    - 背景补充 (downgrade)                                          │
│    - 排除 (reject/ignore)                                         │
│                ↓                                                  │
│  所有资料决策完成 → 点击"进入下一阶段"                              │
│                ↓                                                  │
│  调用 article-structure-agent → 生成文章结构                       │
│                ↓                                                  │
│  更新 status = 'outline_confirmed'                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. 文章结构阶段 (OutlineStage)                                    │
│                                                                   │
│  显示文章结构 → 用户编辑调整 → 确认 → 下一阶段                      │
└─────────────────────────────────────────────────────────────────┘
```

## 数据库表结构

### research_insights
```sql
CREATE TABLE research_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES writing_sessions(id),
  insight_id text,
  category text,
  insight text,
  supporting_data text[],
  source_type text,
  recommended_usage text,
  citability text,
  limitations text,
  user_decision text DEFAULT 'pending', -- 'adopt' | 'downgrade' | 'reject' | 'pending'
  created_at timestamptz DEFAULT now()
);
```

### research_gaps
```sql
CREATE TABLE research_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES writing_sessions(id),
  gap_id text,
  issue text,
  description text,
  user_decision text DEFAULT 'pending', -- 'respond' | 'ignore' | 'pending'
  created_at timestamptz DEFAULT now()
);
```

### writing_sessions
```sql
CREATE TABLE writing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  current_stage text, -- 'research' | 'synthesis' | 'structure' | 'drafting'
  synthesis_result jsonb, -- 保存 research-synthesis-agent 的完整输出
  structure_result jsonb, -- 保存 article-structure-agent 的完整输出
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Edge Functions

### research-synthesis-agent
**输入**:
```typescript
{
  projectId: string,  // 或者
  input: {
    writing_requirements: {
      topic: string;
      target_audience?: string;
      writing_purpose?: string;
      key_points?: string[];
    };
    raw_materials: Array<{
      title: string;
      source: string;
      source_url?: string;
      content: string;
    }>;
  },
  sessionId?: string
}
```

**输出**:
```typescript
{
  thought: string,  // LLM 的思考过程
  synthesis: {
    synthesized_insights: Array<{
      id: string;
      category: string;
      insight: string;
      supporting_data: string[];
      source_type: string;
      recommended_usage: string;
      citability: string;
      limitations: string;
    }>;
    contradictions_or_gaps: Array<{
      id: string;
      issue: string;
      description: string;
    }>;
  },
  sessionId: string
}
```

### article-structure-agent
**输入**:
```typescript
{
  sessionId: string,
  projectId: string
}
```

**功能**:
1. 从数据库读取用户决策后的 insights 和 gaps
2. 基于用户决策生成文章结构
3. 保存结构到 writing_sessions.structure_result

## 关键修复点

### 1. 枚举值缺失
- **问题**: `project_status` 枚举没有 `material_review`
- **影响**: 无法更新项目状态到资料整理阶段
- **解决**: 添加迁移 `00021_add_material_review_status.sql`

### 2. 工作流顺序
- **之前**: 资料查询 → 文章结构
- **现在**: 资料查询 → 资料整理 → 文章结构

### 3. Agent 调用时机
- **research-synthesis-agent**: 在资料查询阶段点击"资料整理"时调用
- **article-structure-agent**: 在资料整理阶段点击"进入下一阶段"时调用

## 用户操作流程

1. **资料查询阶段**:
   - 输入查询主题
   - 查看检索结果
   - 选择需要的资料
   - 点击"资料整理"按钮（调用 synthesis agent）
   - 等待综合完成
   - 点击"进入下一阶段"（跳转到资料整理页）

2. **资料整理阶段**:
   - 查看左侧的资料类型统计和审阅指南
   - 在右侧查看所有观点洞察和矛盾空白
   - 对每项资料做出决策（必须使用/背景补充/排除）
   - 可以使用批量操作加快决策
   - 点击"还有X项未决策"快速跳转到未决策项
   - 点击"日志详情"查看 synthesis agent 的详细输出
   - 完成所有决策后，点击"进入下一阶段"（调用 structure agent）

3. **文章结构阶段**:
   - 查看生成的文章结构
   - 编辑和调整结构
   - 确认后进入下一阶段

## 测试要点

### 功能测试
- [ ] 资料查询页面正常显示
- [ ] "资料整理"按钮正常工作
- [ ] synthesis agent 正常生成 insights 和 gaps
- [ ] "进入下一阶段"按钮正常跳转到资料整理页
- [ ] 资料整理页面正常加载数据
- [ ] 用户决策正常保存
- [ ] 批量操作正常工作
- [ ] "进入下一阶段"按钮正常调用 structure agent
- [ ] 正常跳转到文章结构页

### 错误处理
- [ ] 未完成资料整理时点击"进入下一阶段"显示提示
- [ ] 有未决策项时点击"进入下一阶段"显示提示
- [ ] Edge Function 调用失败时显示错误信息
- [ ] 数据库操作失败时显示错误信息

### 边界情况
- [ ] 无检索结果时的处理
- [ ] 无 insights 或 gaps 时的处理
- [ ] 所有资料都被排除时的处理
- [ ] 网络错误时的处理

## 已知问题和解决方案

### 问题 1: JSON 解析失败
**现象**: Edge Function 返回 "Unterminated string in JSON"
**原因**: LLM 返回的 JSON 中包含未转义的换行符或特殊字符
**解决方案**: 
- Edge Function 中的 `cleanJsonText` 函数会清理 JSON 文本
- 如果仍然失败，检查 LLM 的输出格式

### 问题 2: 枚举值错误
**现象**: "invalid input value for enum project_status: 'material_review'"
**原因**: 数据库枚举缺少该值
**解决方案**: 已通过迁移添加

### 问题 3: 会话未初始化
**现象**: "会话未初始化"错误
**原因**: `writing_session` 未创建或未加载
**解决方案**: 
- 确保在 KnowledgeStage 初始化时调用 `getOrCreateWritingSession`
- 确保在 MaterialReviewStage 加载时获取 session

## 后续优化建议

1. **性能优化**:
   - 使用虚拟滚动处理大量资料
   - 批量操作添加进度条
   - 优化数据库查询

2. **用户体验**:
   - 添加资料搜索功能
   - 添加按类别筛选
   - 添加撤销/重做功能
   - 添加快捷键支持

3. **数据分析**:
   - 添加决策统计图表
   - 添加资料质量评分
   - 添加 AI 辅助决策建议

4. **错误处理**:
   - 添加更详细的错误日志
   - 添加错误恢复机制
   - 添加离线缓存支持
