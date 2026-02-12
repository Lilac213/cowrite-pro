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
    - [x] research-retrieval/index.ts
    - [x] research-synthesis/index.ts
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

## 第七阶段：前端集成（已完成）
- [ ] 9. Draft阶段可视化引用标记
  - [x] 后端：LLM生成（见资料N）标记
  - [x] 后端：返回结构化citations
  - [ ] 前端：实现引用点击弹窗（待实现）
  - [ ] 前端：显示摘要、来源、URL（待实现）

- [x] 12. 积分系统调整
  - [x] 数据库：添加is_completed和research_refreshed_count字段
  - [x] 前端：创建项目时扣除9点
  - [x] 前端：完稿后禁止修改需求文档
  - [x] 前端：刷新搜索额外消耗1点
  - [x] 后端：实现积分扣除逻辑

- [x] 前端调用新Agent
  - [x] 更新BriefStage调用brief-agent
  - [x] 更新KnowledgeStage调用research-retrieval（添加刷新扣点逻辑）
  - [x] MaterialReviewStage已使用research-synthesis-agent
  - [x] 更新OutlineStage调用structure-agent
  - [x] 更新MaterialsStage调用draft-agent
  - [x] 更新ReviewStage调用review-agent
  - [x] 更新ProjectListPage实现创建项目扣9点
  - [x] 更新ExportPage标记项目完稿

## 第八阶段：Bug修复与代码组织优化（已完成）
- [x] 修复 `adjust-article-structure` 中的 JSON 解析失败问题
  - [x] 重构为 Agent 架构，使用 `LLMRuntime`
  - [x] 升级模型为 `gemini-2.0-flash-exp`
  - [x] 增加信封模式三层防护解析
  - [x] 增加 `agent_logs` 运行日志记录
  - [x] 修复 Edge Function 部署中的 `_shared` 目录依赖问题

- [x] 优化 Edge Functions 代码组织
  - [x] 建立 `_shared/llm` 作为唯一代码源（Single Source of Truth）
  - [x] 创建 `sync-shared.sh` 自动同步脚本
  - [x] 添加 `.gitignore` 防止提交自动生成的副本
  - [x] 创建 `ARCHITECTURE.md` 文档说明架构设计
  - [x] 删除未使用的 Edge Functions（openalex-search, thenews-search, web-search）

- [x] 增加 JSON 修复 Agent（第四层防护）
  - [x] 创建 `repairJSONAgent.ts` 专门处理 JSON 格式错误
  - [x] 集成到 `parseEnvelope` 中，解析失败时自动调用
  - [x] 使用 LLM 修复中文引号、未转义字符、多余逗号等问题
  - [x] 验证修复后的结构与原始一致
  - [x] 更新文档说明四层防护策略

- [x] 修复遗留 Edge Functions 的 JSON 解析问题
  - [x] 更新 `generate-article-structure` 使用新的 `parseEnvelope`（含 JSON 修复）
  - [x] 更新 `verify-coherence` 使用新的 `parseEnvelope`（含 JSON 修复）
  - [x] 将这两个函数加入 `sync-shared.sh` 同步列表
  - [x] 更新 `.gitignore` 忽略自动生成的 llm 副本
  - [x] 重新部署所有 9 个 Edge Functions

- [x] 增强 JSON 提取阶段的容错能力
  - [x] 在 Layer 1（提取 JSON 块）增加降级处理
  - [x] 提取失败时自动调用 JSON 修复 Agent
  - [x] 修复后再次尝试提取 JSON 对象
  - [x] 增强 `extractFirstJsonBlock` 的错误日志
  - [x] 更新文档说明新的工作流程
  - [x] 重新部署所有 9 个 Edge Functions

# Task: AI写作助手系统重构与优化

## Plan
- [x] 修复 GEMINI_API_KEY 错误
  - [x] 更新 callLLM.ts 使用 INTEGRATIONS_API_KEY
  - [x] 部署所有 Edge Functions

- [x] 修复 JSON 修复 Agent 的 400 Bad Request 错误
  - [x] 添加输入长度限制（50KB）到 repairJSONAgent
  - [x] 改进 callLLM 的错误日志
  - [x] 在 parseEnvelope 中为所有修复调用添加 try-catch
  - [x] 改进错误消息，明确指出失败阶段
  - [x] 部署所有 Edge Functions

- [x] 实现 JSON 修复 Agent 的双重 LLM 回退机制
  - [x] 创建 callLLMWithFallback.ts 模块
  - [x] 实现 callGemini 函数
  - [x] 实现 callQwen 函数
  - [x] 实现双重回退逻辑（Gemini → Qwen）
  - [x] 更新 repairJSONAgent 使用双重 LLM
  - [x] 同步并部署所有 Edge Functions
  - [x] 创建详细文档（DUAL_LLM_FALLBACK.md）

- [x] 修复信封格式无效错误
  - [x] 添加直接 payload 格式的回退处理
  - [x] 自动包装为标准信封格式
  - [x] 同步并部署所有 Edge Functions
  - [x] 创建详细文档（ENVELOPE_FORMAT_FIX.md）

- [x] 第一阶段：添加重试机制到前端 API 调用
  - [x] 创建通用的 retry wrapper 函数（src/utils/retry.ts）
  - [x] 实现 exponential backoff 策略
  - [x] 提供 invokeWithRetry 函数用于 Edge Function 调用
  - [x] 修复 TypeScript 类型错误

- [x] 第二阶段：删除 Stripe 支付相关代码
  - [x] 删除 PaymentSuccessPage.tsx
  - [x] 从 routes.tsx 删除支付路由和导入
  - [x] 从 SettingsPage.tsx 删除支付相关代码（购买按钮、Dialog、handlePurchase）
  - [x] 删除 create_stripe_checkout 和 verify_stripe_payment Edge Functions
  - [x] 清理未使用的导入（ShoppingCart, Star）
  - [x] Lint 检查通过

- [ ] 第三阶段：Edge Functions 重构（保持现有功能，优化代码复用）
  - [ ] 注意：这是一个大型重构，需要仔细测试每个步骤
  - [ ] 子任务 3.1：合并 structure-agent 相关函数
    - [ ] 分析 generate-article-structure 的输入输出
    - [ ] 分析 adjust-article-structure 的输入输出
    - [ ] 设计统一的 structure-agent API（支持两种操作）
    - [ ] 实现新的 structure-agent
    - [ ] 更新前端调用
    - [ ] 测试验证
    - [ ] 删除旧函数
  - [ ] 子任务 3.2：合并 research-agent 相关函数
    - [ ] 分析 4 个 research 函数的功能差异
    - [ ] 设计统一的 research-agent API
    - [ ] 实现新的 research-agent
    - [ ] 更新前端调用
    - [ ] 测试验证
    - [ ] 删除旧函数
  - [ ] 子任务 3.3：合并 draft-agent 相关函数
    - [ ] 分析 5 个 draft 相关函数的功能
    - [ ] 设计统一的 draft-agent API
    - [ ] 实现新的 draft-agent
    - [ ] 更新前端调用
    - [ ] 测试验证
    - [ ] 删除旧函数
  - [ ] 子任务 3.4：更新 brief-agent 使用 _shared/llm
    - [ ] 检查 brief-agent 当前实现
    - [ ] 如果未使用 _shared/llm，则重构
    - [ ] 测试验证

- [ ] 第四阶段：应用重试机制到关键 API 调用
  - [ ] 识别关键的 Edge Function 调用点
  - [ ] 使用 invokeWithRetry 替换直接调用
  - [ ] 添加用户友好的错误提示
  - [ ] 测试重试机制

- [ ] 第五阶段：测试和验证
  - [ ] 运行 lint 检查
  - [ ] 测试完整的写作工作流程
  - [ ] 验证错误处理和重试机制
  - [ ] 更新文档和 sync-shared.sh

## Notes
- 重构是一个大工程，需要分步进行，每步都要测试
- 优先级：修复错误 > 删除支付 > 添加重试 > 合并函数
- 合并函数时要保持向后兼容，避免破坏现有功能
- ⚠️ 向量搜索需要pgvector扩展，暂未实现，使用关键词匹配替代
- ⚠️ 引用可视化UI需要在前端实现（CitationPopover组件）
- ✅ 所有Agent已集成到前端
- ✅ 积分系统逻辑已实现
- ✅ **代码组织**：`_shared/llm` 是唯一源代码，各函数中的 `llm` 副本由 `sync-shared.sh` 自动生成

## 当前进度
已完成：14/14 核心需求（100%） + 代码组织优化
- ✅ 阶段简化
- ✅ 数据库架构
- ✅ Agent架构（runtime + schemas + agents + edge functions）
- ✅ Payload格式标准化
- ✅ 所有核心Agent实现
- ✅ 强制依赖检查
- ✅ 个人资料智能筛选
- ✅ 前端集成（所有Stage已更新）
- ✅ 积分系统前端逻辑（创建扣9点、刷新扣1点、完稿锁定）
- ✅ **代码组织优化**（Single Source of Truth + 自动同步）
- ⏳ 向量搜索（使用关键词匹配替代）
- ⏳ 引用可视化UI（后端完成，前端UI待实现）
