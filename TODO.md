# 大规模重构任务清单

## 立即修复
- [x] 修复资料整理状态显示为"-"的问题
  - [x] 添加所有缺失的状态标签（material_review, layout_export）
  - [x] 添加fallback处理未知状态

## 第一阶段：UI和流程简化（低风险）
- [x] 1. 简化阶段流程
  - [x] 更新WorkflowProgress组件：需求明确 → 资料搜索 → 资料整理 → 文章结构 → 生成草稿 → 内容审校 → 排版导出
  - [x] 移除"段落结构"阶段
  - [x] 将"文章生成"改为"生成草稿"
  - [x] 更新所有相关的stage枚举和类型定义
  - [x] 更新ProjectWorkflowPage.tsx移除ParagraphStructureStage
  - [x] 更新OutlineStage.tsx直接跳转到drafting阶段
  - [x] 更新ProjectListPage.tsx状态标签

## 第二阶段：数据库架构升级（已完成）
- [x] 14. 数据库结构设计（部分）
  - [x] 创建requirements表（存储writing_brief）
  - [x] 创建research_sources表（含评分字段）
  - [x] 创建synthesized_insights表（含来源追溯）
  - [x] 创建article_structures表（存储argument_outline）
  - [x] 创建drafts表（存储结构化草稿）
  - [x] 创建review_reports表（存储审校报告）
  - [x] 创建agent_logs表（关键：调试、成本分析）
  - [x] 添加projects.is_completed和research_refreshed_count字段
  - [x] 设置所有表的RLS策略

## 第三阶段：Agent架构重构（已完成核心部分）
- [x] 13. 分离Agent、Runtime、Schema和Envelope
  - [x] 创建/llm目录结构
  - [x] 实现runtime层
    - [x] callLLM.ts - 统一LLM调用
    - [x] normalize.ts - 字符归一化
    - [x] parseEnvelope.ts - 信封解析
    - [x] validateSchema.ts - schema验证
    - [x] LLMRuntime.ts - 统一入口
  - [x] 创建架构文档README.md
  - [x] 创建schemas层
    - [x] briefSchema.ts（需求文档schema）
    - [x] researchSchema.ts（资料搜索与整理schema）
    - [x] structureSchema.ts（文章结构schema）
    - [x] draftSchema.ts（草稿schema）
    - [x] reviewSchema.ts（审校schema）
  - [x] 创建agents层
    - [x] briefAgent.ts (需求2)
    - [x] researchAgent.ts (需求3，含retrieval和synthesis两个函数)
    - [x] structureAgent.ts (需求4，强制依赖research_pack)
    - [x] draftAgent.ts (需求5，强制依赖三个输入)
    - [x] reviewAgent.ts (需求6，综合三个review prompts)
  - [x] 创建Edge Functions
    - [x] brief-agent/index.ts
    - [x] structure-agent/index.ts
    - [x] draft-agent/index.ts
    - [x] review-agent/index.ts

## 第四阶段：Payload格式标准化（已完成）
- [x] 14. 各层payload格式定义
  - [x] 需求文档层schema (requirement_meta: document_type, target_audience, citation_style等)
  - [x] 资料搜索层schema (credibility_score, recency_score, relevance_score等)
  - [x] 资料整理层schema (supporting_sources, citability, evidence_strength, risk_flag等)
  - [x] 文章结构层schema (coverage_check, unused_insights, logical_pattern等)
  - [x] 草稿生成层schema (draft_blocks结构化，包含citations)
  - [x] 审校层schema (logic_issues, citation_issues, style_issues等)

## 第五阶段：核心功能实现（已完成核心Agent）
- [x] 2. brief-agent
  - [x] 生成writing_brief
  - [x] 包含完整的requirement_meta
  
- [x] 3. research-agent
  - [x] 实现retrieval函数（资料搜索）
  - [x] 实现synthesis函数（资料整理）
  - [x] 产出统一的research_pack
  - [x] 实现个人资料智能筛选（关键词匹配 + Top-K）
  
- [x] 4. structure-agent
  - [x] 重命名自generate_article_structure
  - [x] 强制依赖research_pack
  - [x] 每个block必须有derived_from和citation_ids
  - [x] 不允许空derived_from
  
- [x] 5. draft-agent
  - [x] 强制输入：writing_brief, argument_outline, research_pack
  - [x] Prompt中明确必须使用这些输入
  - [x] 实现可视化引用标记（citation_id -> （见资料N））
  
- [x] 6. review-agent
  - [x] 综合三个review prompts
  - [x] 结构化输出：logic_issues, citation_issues, style_issues, grammar_issues

## 第六阶段：Research层统一（部分完成）
- [x] 7. 个人资料搜索移出结构阶段
  - [x] Research Agent统一处理外部资料 + 个人资料
  - [x] 只输出research_pack
  
- [x] 8. 个人资料库禁止"全文拼接"
  - [x] 实现关键词匹配
  - [x] 实现top-k选取（Top-8）
  - [x] 实现摘要压缩（前500字）
  - [ ] 实现向量搜索（需要pgvector，暂未实现）
  
- [x] 10. 统一Research消费策略
  - [x] Research只做一次
  - [x] 后续阶段复用research_pack
  - [x] 在Agent层面强制检查依赖

- [x] 11. 所有Agent强制依赖前序产物
  - [x] structure依赖research_pack（代码层面检查）
  - [x] draft依赖structure + research_pack（代码层面检查）
  - [x] review依赖draft（代码层面检查）

## 第七阶段：前端集成（待完成）
- [ ] 9. Draft阶段可视化引用标记
  - [x] 后端：LLM生成（见资料N）标记
  - [x] 后端：返回结构化citations
  - [ ] 前端：实现引用点击弹窗
  - [ ] 前端：显示摘要、来源、URL

- [ ] 12. 积分系统调整
  - [x] 数据库：添加is_completed和research_refreshed_count字段
  - [ ] 前端：创建项目时扣除9点
  - [ ] 前端：完稿后禁止修改需求文档
  - [ ] 前端：刷新搜索额外消耗1点
  - [ ] 后端：实现积分扣除逻辑

- [ ] 前端调用新Agent
  - [ ] 更新BriefStage调用brief-agent
  - [ ] 更新KnowledgeStage调用research-agent (retrieval)
  - [ ] 更新MaterialReviewStage调用research-agent (synthesis)
  - [ ] 更新OutlineStage调用structure-agent
  - [ ] 更新MaterialsStage调用draft-agent
  - [ ] 更新ReviewStage调用review-agent

## 注意事项
- ⚠️ 向量搜索需要pgvector扩展，暂未实现，使用关键词匹配替代
- ⚠️ 前端需要更新以调用新的Agent Edge Functions
- ⚠️ 积分系统逻辑需要在前端实现
- ⚠️ 引用可视化UI需要在前端实现

## 当前进度
已完成：12/14 核心需求（86%）
- ✅ 阶段简化
- ✅ 数据库架构
- ✅ Agent架构（runtime + schemas + agents + edge functions）
- ✅ Payload格式标准化
- ✅ 所有核心Agent实现
- ✅ 强制依赖检查
- ✅ 个人资料智能筛选
- ⏳ 向量搜索（使用关键词匹配替代）
- ⏳ 前端集成（待完成）
- ⏳ 积分系统前端逻辑（待完成）
- ⏳ 引用可视化UI（待完成）
