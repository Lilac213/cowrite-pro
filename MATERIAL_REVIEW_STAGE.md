# 资料整理阶段实现总结

## 实现内容

### 1. 新增资料整理阶段
- 在资料查询和文章结构之间新增了独立的"资料整理"阶段
- 项目状态流程更新为：`confirm_brief` → `knowledge_selected` → `material_review` → `outline_confirmed`

### 2. MaterialReviewStage 组件功能

#### 左侧面板
- **资料类型统计**：显示各类资料的数量（如"市场趋势 2条"）
- **审阅指南**：
  - 必须使用：核心观点，将直接用于文章论证
  - 背景补充：辅助信息，可作为背景或补充说明
  - 排除：不相关或不适用的内容

#### 右侧面板
- **资料列表**：显示所有研究洞察和空白
- **批量操作**：
  - 全选/取消全选
  - 批量设为必须使用/背景补充/排除
- **单项操作**：每项资料可单独选择决策
- **未决策提示**：显示"还有 X 项未决策"按钮，点击跳转到第一个未决策项
- **决策状态标识**：
  - 待决策：橙色高亮
  - 必须使用：绿色标签
  - 背景补充：蓝色标签
  - 排除：灰色标签

#### 底部日志框
- 显示运行步骤：
  - ✅ 资料搜索已完成
  - ✅ 研究综合已完成
  - ⏳ 等待资料决策完成 (X/Y)
- **日志详情按钮**：点击弹窗显示：
  - 思考过程 (Thought)：LLM 的推理过程
  - 输入数据：传递给 research synthesis agent 的输入
  - 输出结果：agent 返回的完整结果

### 3. 数据库更新
- 在 `writing_sessions` 表中新增 `synthesis_result` 字段（JSONB 类型）
- 存储结构：
  ```json
  {
    "thought": "LLM 思考过程",
    "input": { /* 输入数据 */ },
    "synthesis": { /* 综合结果 */ },
    "timestamp": "2025-02-11T..."
  }
  ```

### 4. 工作流程更新

#### 资料查询阶段 (KnowledgeStage)
- 点击"进入下一步"后，不再直接生成文章结构
- 而是更新项目状态为 `material_review`，进入资料整理阶段

#### 资料整理阶段 (MaterialReviewStage)
- 用户审阅所有研究洞察和空白
- 为每项资料做出决策（必须使用/背景补充/排除）
- 完成所有决策后，点击"进入下一阶段"
- 调用 `callArticleStructureAgent` 生成文章结构
- 更新项目状态为 `outline_confirmed`

### 5. API 更新
- 新增 `getWritingSession(projectId)` 函数：获取写作会话
- 更新 `callResearchSynthesisAgent`：自动保存 synthesis_result 到数据库
- 使用正确的函数名：
  - `updateInsightDecision` (不是 updateResearchInsightDecision)
  - `updateGapDecision` (不是 updateResearchGapDecision)

### 6. 类型定义更新
- `ProjectStatus` 类型新增 `'material_review'`
- `WritingSession` 接口新增 `synthesis_result?: any` 字段

## 用户体验改进

### 1. 清晰的决策流程
- 用户可以清楚地看到所有资料
- 可以批量或单独处理
- 实时显示决策进度

### 2. 防止遗漏
- 未完成所有决策时，无法进入下一阶段
- 明确提示还有多少项未决策
- 一键跳转到未决策项

### 3. 透明的处理过程
- 日志框显示每个步骤的状态
- 日志详情提供完整的 LLM 处理信息
- 便于调试和理解系统行为

## 技术实现要点

### 1. 状态管理
- 使用 React hooks 管理本地状态
- 实时同步数据库状态
- 批量操作优化性能

### 2. 数据转换
- 统一 insights 和 gaps 的数据格式
- 正确映射决策类型（insights: adopt/downgrade/reject, gaps: respond/ignore）

### 3. 错误处理
- 完善的错误提示
- 详细的日志记录
- 用户友好的错误消息

## 后续优化建议

1. **性能优化**：
   - 大量资料时考虑虚拟滚动
   - 批量操作时显示进度条

2. **用户体验**：
   - 添加快捷键支持（如 Space 选择/取消选择）
   - 支持筛选和搜索功能
   - 添加撤销/重做功能

3. **数据分析**：
   - 统计用户决策偏好
   - 提供决策建议
   - 显示资料质量评分
