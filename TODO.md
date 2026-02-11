# 大规模重构任务清单

## 立即修复
- [x] 修复资料整理状态显示为"-"的问题
  - [x] 添加所有缺失的状态标签（material_review, paragraph_structure_confirmed, layout_export）
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

## 第二阶段：积分系统调整（中风险）
- [ ] 12. 积分系统改造
  - [ ] 创建项目时扣除9点（而非进入资料搜索时扣除）
  - [ ] 完稿后禁止修改需求文档
  - [ ] 刷新/重新搜索资料额外消耗1点
  - [ ] 更新数据库schema添加project.is_completed字段
  - [ ] 更新前端UI显示积分消耗规则

## 第三阶段：Agent架构重构（高风险，核心改造）
- [x] 13. 分离Agent、Runtime、Schema和Envelope（部分完成）
  - [x] 创建/llm目录结构
  - [x] 实现runtime层
    - [x] callLLM.ts - 统一LLM调用
    - [x] normalize.ts - 字符归一化
    - [x] parseEnvelope.ts - 信封解析
    - [x] validateSchema.ts - schema验证
    - [x] LLMRuntime.ts - 统一入口
  - [x] 创建架构文档README.md
  - [ ] 创建agents层
    - [ ] briefAgent.ts (需求2)
    - [ ] researchAgent.ts (需求3)
    - [ ] structureAgent.ts (需求4，重命名)
    - [ ] draftAgent.ts (需求5，新建)
    - [ ] reviewAgent.ts (需求6)
  - [ ] 创建schemas层
  - [ ] 迁移现有Edge Functions到新架构

## 第四阶段：Payload格式标准化（高风险）
- [ ] 14. 各层payload格式定义
  - [ ] 需求文档层schema (requirement_meta: document_type, target_audience, citation_style等)
  - [ ] 资料搜索层schema (credibility_score, recency_score, relevance_score, embedding_vector等)
  - [ ] 资料整理层schema (supporting_sources, citability, evidence_strength, risk_flag等)
  - [ ] 文章结构层schema (coverage_check, unused_insights, logical_pattern等)
  - [ ] 草稿生成层schema (draft_blocks结构化，包含citations)
  - [ ] 审校层schema (logic_issues, citation_issues, style_issues等)

## 第五阶段：数据库重构（极高风险）
- [ ] 14. 数据库结构设计
  - [ ] 创建requirements表
  - [ ] 创建research_sources表（含向量索引）
  - [ ] 创建synthesized_insights表
  - [ ] 创建article_structures表
  - [ ] 创建drafts表
  - [ ] 创建review_reports表
  - [ ] 创建agent_logs表（关键：调试、成本分析）
  - [ ] 设置pgvector扩展
  - [ ] 数据迁移脚本

## 第六阶段：Research层统一（高风险）
- [ ] 3. research-agent综合实现
  - [ ] 合并research_retrieval和research_synthesis为同一agent的两个函数
  - [ ] 产出统一的research_pack
  
- [ ] 7. 个人资料搜索移出结构阶段
  - [ ] Research Agent = 外部资料 + 个人资料
  - [ ] 只输出research_pack，永远不传全文
  
- [ ] 8. 个人资料库禁止"全文拼接"
  - [ ] 实现关键词匹配
  - [ ] 实现向量搜索（需要pgvector）
  - [ ] 实现top-k选取
  - [ ] 实现摘要压缩
  - [ ] 只传top 5-8个高度相关摘要

- [ ] 10. 统一Research消费策略
  - [ ] Research只做一次
  - [ ] 流程：需求 → Research → 用户确认 → 后续所有阶段复用research_pack
  - [ ] 禁止后续Agent自己搜索

## 第七阶段：Agent依赖强制（中风险）
- [ ] 4. structure-agent必须引用research_pack
  - [ ] 每个block标明derived_from citation_id
  - [ ] 不允许空derived_from
  
- [ ] 5. draft-agent强制输入
  - [ ] 必须输入：writing_brief, argument_outline, research_pack
  - [ ] prompt中明确：若未使用argument_outline和research_pack，不得生成草稿
  
- [ ] 11. 所有Agent强制依赖前序产物
  - [ ] structure依赖research_pack
  - [ ] draft依赖structure + research_pack
  - [ ] review依赖draft

## 第八阶段：引用可视化（中风险）
- [ ] 9. Draft阶段可视化引用标记
  - [ ] LLM使用citation_id: c_3时，草稿显示：（见资料3）
  - [ ] UI点击后展示：摘要、来源、URL
  - [ ] 实现引用弹窗组件

## 注意事项
- ⚠️ 数据库重构需要完整的迁移策略，避免丢失现有数据
- ⚠️ Agent重构需要保持向后兼容，或提供平滑过渡方案
- ⚠️ 向量搜索需要Supabase pgvector扩展支持
- ⚠️ 所有改动需要充分测试，确保不破坏现有功能
- ⚠️ 建议分批次部署，每个阶段独立验证

## 当前进度
正在进行：第一阶段 - UI和流程简化
