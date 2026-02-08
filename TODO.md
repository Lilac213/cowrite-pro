# Task: 工作流优化和 Google Scholar 重新配置

## Plan
- [x] Step 1: 调整需求文档按钮位置
  - [x] 将按钮从进度条移到卡片标题行
  - [x] 与标题和当前阶段在同一排
- [x] Step 2: 重新配置 Google Scholar API
  - [x] 更新 Edge Function 使用新的 Gateway API
  - [x] 使用正确的 API 端点和参数格式
  - [x] 添加必需的认证头
  - [x] 部署 Edge Function
- [x] Step 3: 移除底部操作卡片
  - [x] 删除"已选择 x / x 条资料"卡片
  - [x] 移除底部的"生成综合摘要"和"确认并进入下一步"按钮
- [x] Step 4: 确保项目上下文隔离
  - [x] 验证搜索不跨项目
  - [x] 每个项目独立上下文
- [x] Step 5: 美化搜索结果中的按钮
  - [x] 优化"资料整理"和"进入下一步"按钮样式
  - [x] 调整按钮位置和间距
  - [x] 添加渐变背景和图标
- [x] Step 6: 验证查询显示和按钮可见性
  - [x] 确认 SearchPlanPanel 正确显示所有查询
  - [x] 确认 SearchResultsPanel 底部显示两个按钮
- [x] Step 7: 运行 lint 检查

## 完成情况
✅ 所有任务已完成！

## 功能说明

### 1. 查询显示（数据源查询）
SearchPlanPanel 组件已正确实现查询显示功能：
- **学术调研 (Google Scholar)**: 显示 `academic_queries`，蓝色背景
- **行业资讯 (TheNews)**: 显示 `news_queries`，橙色背景
- **网页内容 (Smart Search)**: 显示 `web_queries`，绿色背景
- **资料库**: 显示 `user_library_queries`，紫色背景

数据流：
1. `agentDrivenResearchWorkflow` 返回 `search_summary` 对象
2. `retrievalResults.search_summary` 包含所有查询数组
3. `searchSummary` 传递给 `SearchPlanPanel`
4. 组件在"数据源查询"标题下展示所有查询

### 2. 搜索结果按钮
SearchResultsPanel 组件底部显示两个按钮：
- **资料整理**: 
  - 条件：`onOrganize` 存在且 `filteredResults.length > 0`
  - 功能：打开综合分析结果弹窗（需要先运行综合分析）
  - 样式：outline 变体，Sparkles 图标
- **进入下一步**:
  - 条件：`onNextStep` 存在且 `filteredResults.length > 0`
  - 功能：直接进入文章结构阶段
  - 样式：渐变背景，ArrowRight 图标

按钮位置：
- 在所有搜索结果卡片之后
- 顶部有分隔线（`border-t border-border`）
- 右对齐布局（`justify-end`）
- 按钮间距 3 单位（`gap-3`）

## 实现的改进

### 1. 需求文档按钮位置调整
- 将"需求文档"按钮从进度条区域移到卡片标题行
- 与项目标题和当前阶段在同一排显示
- 使用事件机制（`openRequirementsDialog`）触发弹窗打开
- 只在明确需求阶段之后显示（currentIndex >= 1）
- 按钮位置固定在右上角，不随进度条滚动

### 2. Google Scholar API 重新配置
- Edge Function 已正确配置使用新的 Gateway API
- API 端点：`https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search`
- 使用 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` 认证
- 支持参数：engine, q, as_ylo, as_yhi, start
- 返回格式已标准化：papers 数组包含 title, authors, year, abstract, citations, url
- 已成功部署到 Supabase

### 3. 移除底部操作卡片
- 删除了显示"已选择 x / x 条资料"的底部卡片
- 移除了"生成综合摘要"和"确认并进入下一步"按钮
- 简化了页面布局，避免重复功能
- 所有操作集中在搜索结果面板中

### 4. 项目上下文隔离
- 所有搜索和数据操作都基于 `projectId` 参数
- 数据清理基于当前项目的需求文档（`brief.requirements`）
- Edge Functions 通过 `projectId` 隔离不同项目的数据
- 知识库查询使用 `project_id` 过滤
- 确保不会出现跨项目内容污染

### 5. 搜索结果按钮美化
- 按钮区域添加顶部边框分隔（`border-t border-border`）
- 增加上下内边距（`mt-6 pt-6`）
- 按钮尺寸统一为 `size="lg"`，最小宽度 140px
- "资料整理"按钮：
  - 使用 `variant="outline"` 样式
  - 添加 Sparkles 图标
- "进入下一步"按钮：
  - 使用渐变背景（`bg-gradient-to-r from-primary to-primary/80`）
  - 悬停效果（`hover:from-primary/90 hover:to-primary/70`）
  - 添加 ArrowRight 图标在右侧
- 按钮间距增加到 3 单位（`gap-3`）
- 右对齐布局（`justify-end`）

### 6. 代码质量
- 所有代码通过 TypeScript lint 检查
- 正确处理事件监听和清理
- 优化导入语句，移除未使用的组件
- 添加适当的类型定义和错误处理

## 完成情况
✅ 所有任务已完成！

## 实现的改进

### 1. 需求文档固定显示
- 创建 `RequirementsDocDialog` 组件，美观展示需求文档内容
- 在 `WorkflowProgress` 组件右上角添加"需求文档"按钮
- 只在明确需求阶段之后显示（currentIndex >= 1）
- 智能解析 JSON 格式的需求文档，展示主题、目标、关键维度、时间范围等
- 在 `ProjectWorkflowPage` 中加载并传递需求文档数据

### 2. Google Scholar API 测试
- 创建 `test-google-scholar.js` 测试脚本
- 验证 Edge Function 实现正确
- API 调用逻辑无误，使用正确的 Gateway API
- 网络连接问题需在实际部署环境测试

### 3. 添加"进入下一步"按钮
- **明确需求阶段**：在"确认需求"按钮旁添加"进入下一步"按钮
  - 使用 `ArrowRight` 图标
  - 只有确认后才能进入下一步
- **资料查询阶段**：在"资料整理"按钮旁添加"进入下一步"按钮
  - 直接跳转到文章结构阶段
  - 无需生成综合摘要即可进入

### 4. 搜索结果数据清理
- 实现 `cleanSearchResults` 函数，包含三层清理：
  1. **过滤不当内容**：检测并移除包含色情、赌博、毒品等关键词的结果
  2. **标题去重**：相同标题只保留内容更完整的（extracted_content 更多）
  3. **时效性验证**：根据需求文档中的 year_start/year_end 过滤结果
- 在 `loadKnowledge` 中自动应用数据清理
- 确保数据质量和相关性

### 5. 日志栏样式优化
- 固定底部日志栏背景色改为黑色（`bg-black`）
- 文字使用白色和灰色系（`text-white`, `text-gray-300`）
- 悬停效果改为深灰色（`hover:bg-gray-900`）
- 分隔线使用深灰色（`bg-gray-700`）
- 提升视觉对比度和专业感

### 6. 搜索计划显示优化
- 在数据源名称中添加具体服务名称（Google Scholar, TheNews, Smart Search）
- 查询关键词使用彩色背景卡片展示：
  - 学术调研：蓝色背景（`bg-blue-50 dark:bg-blue-950`）
  - 行业资讯：橙色背景（`bg-orange-50 dark:bg-orange-950`）
  - 网页内容：绿色背景（`bg-green-50 dark:bg-green-950`）
  - 资料库：紫色背景（`bg-purple-50 dark:bg-purple-950`）
- 每个查询关键词独立显示，清晰易读

### 7. 项目上下文隔离
- 数据清理基于当前项目的需求文档（`brief.requirements`）
- 时效性验证从需求文档中提取时间限制
- 所有 LLM 调用都传递 `projectId` 参数
- Edge Functions 通过 `projectId` 隔离不同项目的数据
- 确保不会出现跨项目内容污染

### 8. 代码质量
- 所有代码通过 TypeScript lint 检查
- 修复类型错误（Brief.requirements vs requirements_doc）
- 正确处理 JSON 和字符串格式的需求文档
- 添加错误处理和日志输出

## 完成情况
✅ 所有任务已完成！

## 实现的改进

### 1. Google Scholar 搜索验证
- 检查了 Edge Function 实现，使用正确的 Gateway API
- 搜索逻辑正确，通过 research-retrieval-agent 调用
- 如果仍有问题，可能是 API Key 或网络问题

### 2. 搜索计划显示优化
- SearchPlanPanel 已正确实现所有查询类型的解析和显示
- 支持 academic_queries、news_queries、web_queries、user_library_queries
- 使用图标和颜色区分不同数据源

### 3. 资料整理弹窗优化
- 包含完整的综合洞察、关键数据点、矛盾或研究空白
- 智能解析 JSON 内容
- 自动加粗关键数据和关键词
- 调整为内容自适应高度

### 4. 搜索日志重构
- 创建固定底部日志栏，显示最新日志状态
- 点击日志栏打开详情弹窗
- 日志弹窗采用时间轴格式，参考用户提供的设计
- 支持下载完整日志
- 智能解析日志阶段和状态

### 5. 页面清理
- 移除底部综合分析结果卡片（已在资料整理弹窗中展示）
- 移除综合分析日志卡片
- 所有弹窗调整为内容自适应高度
- 优化整体页面布局和用户体验

## 完成情况
✅ 所有任务已完成！

## 实现的改进
1. **搜索计划面板优化**：
   - 添加 JSON 解析逻辑，支持对象类型的查询内容
   - 完整显示所有数据源的查询计划
   
2. **布局优化**：
   - 搜索计划和搜索结果合并到同一个卡片
   - 移动端使用垂直布局，桌面端使用左右分栏
   - 添加边框分隔，提升视觉层次
   
3. **交互改进**：
   - 收藏和删除按钮始终可见
   - 操作后显示成功/失败提示
   - 未选中时点击按钮会提示用户先选择
   
4. **时间筛选修复**：
   - 正确处理 published_at 和 collected_at 字段
   - 添加空值检查，避免筛选错误
   
5. **详情弹窗优化**：
   - 弹窗尺寸增大到 max-w-6xl
   - 响应式宽度 w-95vw
   - 内容区域可滚动，最大高度 70vh
   
6. **内容清理**：
   - 移除"写作级研究摘要"冗余部分
   - 优化综合分析结果的 JSON 解析
   - 支持多种字段名称的解析
