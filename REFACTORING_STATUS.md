# 重构进度报告

## ✅ 已完成的工作

### 1. 立即问题修复
- **修复资料整理状态显示为"-"的问题**
  - 原因：ProjectListPage.tsx中的statusLabels缺少部分状态映射
  - 解决：添加了material_review、layout_export等缺失状态
  - 添加了fallback处理，未知状态显示为"未知状态"而非空白

### 2. 阶段流程简化（需求#1）
- **更新了工作流阶段**：
  - 旧流程：需求确认 → 资料查询 → 资料整理 → 文章结构 → 段落结构 → 文章生成 → 内容审校 → 排版导出
  - 新流程：需求明确 → 资料搜索 → 资料整理 → 文章结构 → 生成草稿 → 内容审校 → 排版导出
  
- **具体改动**：
  - 移除了"段落结构"(paragraph_structure_confirmed)阶段
  - 将"文章生成"改名为"生成草稿"
  - 更新了WorkflowProgress.tsx的stages数组
  - 更新了ProjectWorkflowPage.tsx，移除ParagraphStructureStage组件
  - 更新了OutlineStage.tsx，确认后直接跳转到drafting阶段
  - 更新了ProjectStatus类型定义
  - 更新了ProjectListPage.tsx的状态标签

### 3. LLM Runtime架构搭建（需求#13部分）
- **创建了统一的Runtime层**：
  - `normalize.ts`: 字符归一化清洗（中文标点→英文标点，清除不可见字符）
  - `parseEnvelope.ts`: 信封格式解析（三层防护策略）
  - `callLLM.ts`: 统一LLM API调用
  - `validateSchema.ts`: Schema验证
  - `LLMRuntime.ts`: 统一入口，整合所有流程
  
- **创建了架构文档**：
  - `README.md`: 详细的架构说明、使用示例、迁移计划

## ⏳ 部分完成的工作

### 需求#13: Agent/Runtime/Schema分离
- ✅ Runtime层已完成
- ⏳ Agent层：已创建目录结构，但具体Agent实现待完成
- ⏳ Schema层：待创建
- ⏳ 现有Edge Functions迁移到新架构：待完成

## ❌ 未完成的工作（需要进一步开发）

### 高优先级（核心功能）

#### 需求#2: brief-agent
- 状态：未开始
- 需要：创建briefAgent.ts，生成writing_brief
- 依赖：Runtime层已就绪

#### 需求#3: research-agent
- 状态：未开始
- 需要：合并research_retrieval和research_synthesis为同一agent的两个函数
- 产出：统一的research_pack

#### 需求#4: structure-agent
- 状态：未开始
- 需要：
  - 重命名generate_article_structure为structure-agent
  - 强制引用research_pack
  - 每个block必须标明derived_from citation_id
  - 不允许空derived_from

#### 需求#5: draft-agent
- 状态：未开始
- 需要：
  - 创建新agent，综合多个现有功能
  - 强制输入：writing_brief, argument_outline, research_pack
  - Prompt中明确：必须使用这些输入才能生成草稿

#### 需求#6: review-agent
- 状态：未开始
- 需要：综合现有的三个review prompt

### 中优先级（架构改进）

#### 需求#7: 个人资料搜索移出结构阶段
- 状态：未开始
- 需要：
  - 统一Research Layer
  - Research Agent = 外部资料 + 个人资料
  - 只输出research_pack，永远不传全文

#### 需求#8: 个人资料库禁止"全文拼接"
- 状态：未开始
- 需要：
  - 实现关键词匹配
  - 实现向量搜索（需要pgvector）
  - 实现top-k选取
  - 实现摘要压缩
  - 只传top 5-8个高度相关摘要

#### 需求#10: 统一Research消费策略
- 状态：未开始
- 需要：
  - Research只做一次
  - 流程：需求 → Research → 用户确认 → 后续所有阶段复用research_pack
  - 禁止后续Agent自己搜索

#### 需求#11: 所有Agent强制依赖前序产物
- 状态：未开始
- 需要：
  - structure依赖research_pack
  - draft依赖structure + research_pack
  - review依赖draft
  - 在代码层面强制这些依赖

### 低优先级（功能增强）

#### 需求#9: Draft阶段可视化引用标记
- 状态：未开始
- 需要：
  - LLM使用citation_id: c_3时，草稿显示：（见资料3）
  - UI点击后展示：摘要、来源、URL
  - 实现引用弹窗组件

#### 需求#12: 积分系统调整
- 状态：未开始
- 需要：
  - 创建项目时扣除9点（而非进入资料搜索时扣除）
  - 完稿后禁止修改需求文档
  - 刷新/重新搜索资料额外消耗1点
  - 更新数据库schema添加project.is_completed字段

### 极高风险（需要谨慎规划）

#### 需求#14: Payload格式标准化
- 状态：未开始
- 风险：涉及所有层的数据结构变更
- 需要：
  - 需求文档层：添加document_type, target_audience, citation_style等
  - 资料搜索层：添加credibility_score, recency_score, relevance_score, embedding_vector等
  - 资料整理层：添加supporting_sources, citability, evidence_strength等
  - 文章结构层：添加coverage_check, unused_insights等
  - 草稿生成层：结构化draft_blocks，包含citations
  - 审校层：logic_issues, citation_issues, style_issues等

#### 需求#14: 数据库重构
- 状态：未开始
- 风险：极高，可能导致现有数据丢失
- 需要：
  - 创建新表：requirements, research_sources, synthesized_insights, article_structures, drafts, review_reports, agent_logs
  - 设置pgvector扩展（用于向量搜索）
  - 编写数据迁移脚本
  - 确保现有项目数据不丢失

## 🚨 关键风险和建议

### 1. 数据库重构风险
**问题**：需求#14要求完全重构数据库schema，这可能导致：
- 现有项目数据丢失
- 应用停机时间
- 回滚困难

**建议**：
- 采用增量迁移策略，而非一次性重构
- 先创建新表，保留旧表
- 实现双写机制（同时写入新旧表）
- 充分测试后再切换到新schema
- 准备回滚方案

### 2. 向量搜索依赖
**问题**：需求#8要求实现向量搜索，需要：
- Supabase pgvector扩展
- Embedding模型（如OpenAI text-embedding-3-small）
- 向量索引配置

**建议**：
- 先确认Supabase项目是否支持pgvector
- 如不支持，考虑使用其他相似度算法（如TF-IDF）作为替代
- 或者使用外部向量数据库（如Pinecone）

### 3. Agent重构复杂度
**问题**：需求#2-6要求重命名、合并多个Agent，涉及：
- 多个Edge Functions的重写
- Prompt的重新设计
- 前端调用逻辑的更新

**建议**：
- 采用渐进式迁移，一次迁移一个Agent
- 保持API接口向后兼容
- 使用feature flag控制新旧Agent切换
- 充分测试每个Agent后再迁移下一个

### 4. 强制依赖实现
**问题**：需求#11要求强制Agent依赖前序产物，但：
- 用户可能想跳过某些步骤
- 可能需要重新生成某个中间步骤

**建议**：
- 在代码层面检查依赖，缺少时抛出明确错误
- 提供"重新生成"功能，允许用户重新运行某个Agent
- UI上禁用未满足依赖的步骤

## 📋 建议的实施顺序

### 第一批（低风险，高价值）
1. ✅ 阶段流程简化（已完成）
2. ✅ Runtime架构搭建（已完成）
3. 积分系统调整（需求#12）
4. 创建briefAgent（需求#2）

### 第二批（中风险，核心功能）
5. 创建researchAgent（需求#3）
6. 重构structureAgent（需求#4）
7. 创建draftAgent（需求#5）
8. 创建reviewAgent（需求#6）

### 第三批（高风险，架构改进）
9. 统一Research消费策略（需求#10）
10. 强制Agent依赖（需求#11）
11. 个人资料搜索优化（需求#7, #8）

### 第四批（极高风险，需要专门规划）
12. Payload格式标准化（需求#14部分）
13. 数据库重构（需求#14部分）
14. 引用可视化（需求#9）

## 💡 下一步行动建议

### 立即可做
1. 创建briefAgent.ts，使用新的Runtime架构
2. 更新积分系统逻辑
3. 编写Agent的Schema定义

### 需要讨论
1. 数据库重构的具体方案和时间表
2. 向量搜索的实现方式（pgvector vs 替代方案）
3. 是否需要保持向后兼容，还是可以接受breaking changes

### 需要准备
1. 完整的测试计划
2. 数据迁移脚本
3. 回滚方案
4. 用户通知（如果有停机时间）

## 📊 完成度统计

- ✅ 已完成：2/14 (14%)
- ⏳ 部分完成：1/14 (7%)
- ❌ 未开始：11/14 (79%)

**预计剩余工作量**：
- 简单任务（1-2天）：需求#2, #6, #12
- 中等任务（3-5天）：需求#3, #4, #5, #7, #9, #10, #11
- 复杂任务（1-2周）：需求#8, #14

**总预计时间**：3-4周（假设全职开发）

## 🎯 总结

已完成的工作为后续开发奠定了良好的基础：
1. 修复了立即的bug（状态显示）
2. 简化了工作流（提升用户体验）
3. 搭建了可扩展的Agent架构（为后续迁移做准备）

但大部分核心功能改造尚未开始，特别是：
- Agent的重命名和合并
- 强制依赖关系
- 数据库重构

建议采用渐进式迁移策略，分批次实施，每个批次充分测试后再进行下一批次。
