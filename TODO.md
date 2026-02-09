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

