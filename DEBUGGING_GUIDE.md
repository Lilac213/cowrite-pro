# Research Synthesis Agent 调试指南

## 问题描述
用户在完成资料整理后点击"进入下一步"时出现错误："操作失败：Edge Function returned a non-2xx status code"

## 数据流程

```
用户完成资料整理
    ↓
保存用户决策到数据库 (research_insights.user_decision)
    ↓
点击"进入下一步"
    ↓
handleNextStep() 调用 callArticleStructureAgent()
    ↓
从数据库获取所有洞察
    ↓
筛选 user_decision === 'adopt' 的洞察
    ↓
构建 structureInput JSON
    ↓
调用 generate-article-structure Edge Function
    ↓
Edge Function 调用 Gemini API
    ↓
解析返回的 JSON 结构
    ↓
保存到 writing_sessions.structure_result
```

## 已添加的调试日志

### 1. 前端日志 (KnowledgeStage.tsx - handleNextStep)
```javascript
[handleNextStep] ========== 开始进入下一阶段 ==========
[handleNextStep] writingSession.id: xxx
[handleNextStep] projectId: xxx
[handleNextStep] 当前洞察总数: N
[handleNextStep] 当前空白总数: N
[handleNextStep] 洞察决策分布: { adopt: N, downgrade: N, reject: N, pending: N }
[handleNextStep] 洞察 1: { id, insight_id, decision, category, content }
```

### 2. API 层日志 (api.ts - callArticleStructureAgent)
```javascript
[callArticleStructureAgent] ========== 开始生成文章结构 ==========
[callArticleStructureAgent] 步骤1: 获取项目信息
[callArticleStructureAgent] 步骤2: 获取需求文档
[callArticleStructureAgent] 步骤3: 获取研究洞察和空白
[callArticleStructureAgent] 总洞察数: N
[callArticleStructureAgent] 洞察详情: [每条洞察的 ID、决策、分类、内容]
[callArticleStructureAgent] 洞察决策分布: { adopt: N, downgrade: N, reject: N, pending: N }
[callArticleStructureAgent] 步骤4: 内容筛选
[callArticleStructureAgent] 采用的洞察数: N
[callArticleStructureAgent] 采用的洞察列表: [详细列表]
[callArticleStructureAgent] 步骤5: 构建输入数据
[callArticleStructureAgent] 完整输入 JSON: {...}
[callArticleStructureAgent] 步骤6: 调用 generate-article-structure Edge Function
[callArticleStructureAgent] 步骤7: 保存结构结果到数据库
[callArticleStructureAgent] ========== 文章结构生成完成 ==========
```

### 3. Edge Function 日志 (generate-article-structure/index.ts)
```javascript
[generate-article-structure] ========== 收到请求 ==========
[generate-article-structure] 请求体: {...}
[generate-article-structure] 使用新格式输入
[generate-article-structure] 输入数据: {...}
[generate-article-structure] 验证通过，准备调用 LLM
[generate-article-structure] 主题: xxx
[generate-article-structure] 确认的洞察数量: N
[generate-article-structure] 开始调用 Gemini API
[generate-article-structure] API响应成功，开始读取流式数据
[generate-article-structure] 流式数据读取完成，总长度: N
[generate-article-structure] 原始响应内容（前500字符）: ...
[generate-article-structure] JSON解析完成，验证必要字段
[generate-article-structure] 核心论点: xxx
[generate-article-structure] 论证块数量: N
[generate-article-structure] 结构数据处理完成
[generate-article-structure] ========== 请求处理成功 ==========
```

## 调试步骤

### 步骤 1: 检查浏览器控制台日志
1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 点击"进入下一步"
4. 查找以下关键日志：
   - `[handleNextStep]` 开头的日志 - 检查洞察决策分布
   - `[callArticleStructureAgent]` 开头的日志 - 检查数据处理流程
   - 错误信息 - 查看具体错误原因

### 步骤 2: 检查洞察决策状态
在控制台日志中查找：
```
[handleNextStep] 洞察决策分布: { adopt: N, downgrade: N, reject: N, pending: N }
```

**关键检查点**：
- `adopt` 的数量必须 > 0，否则无法生成文章结构
- 如果 `adopt` = 0，说明用户没有选择任何洞察为"必须使用"

### 步骤 3: 检查输入数据
在控制台日志中查找：
```
[callArticleStructureAgent] 完整输入 JSON: {...}
```

**验证以下字段**：
- `topic`: 不能为空
- `confirmed_insights`: 数组长度必须 > 0
- 每个 insight 必须包含: `id`, `category`, `content`, `source_insight_id`

### 步骤 4: 检查 Edge Function 错误
如果看到 Edge Function 错误，查找：
```
[generate-article-structure] 错误消息: xxx
```

**常见错误**：
1. **"没有确认的研究洞察"**: 用户没有选择任何洞察为"必须使用"
2. **"缺少主题信息"**: topic 字段为空
3. **"API请求失败"**: Gemini API 调用失败
4. **"无法解析返回的JSON结构"**: LLM 返回的内容格式不正确

## 常见问题及解决方案

### 问题 1: 没有已采用的研究洞察
**症状**: 错误消息显示 "没有已采用的研究洞察，无法生成文章结构"

**原因**: 用户在资料整理审阅时，没有选择任何洞察为"必须使用"，只选择了"背景补充"或"排除"

**解决方案**:
1. 返回资料整理审阅界面
2. 至少选择一条洞察为"必须使用"
3. 保存决策
4. 再次点击"进入下一步"

### 问题 2: 决策未保存
**症状**: 控制台显示所有洞察的 `user_decision` 都是 `pending`

**原因**: 用户在资料整理审阅界面做出选择后，没有点击"保存决策"按钮

**解决方案**:
1. 返回资料整理审阅界面
2. 确认所有洞察都已做出决策（不能有待决策的项）
3. 点击"保存决策"按钮
4. 等待保存成功提示
5. 再次点击"进入下一步"

### 问题 3: Edge Function 调用失败
**症状**: 错误消息显示 "Edge Function returned a non-2xx status code"

**可能原因**:
1. 输入数据格式不正确
2. Gemini API 调用失败
3. API 密钥未配置或无效

**调试方法**:
1. 检查控制台日志中的 `[callArticleStructureAgent] 完整输入 JSON`
2. 检查 Edge Function 日志（如果有访问权限）
3. 验证 INTEGRATIONS_API_KEY 是否正确配置

## 数据验证 SQL 查询

如果需要直接检查数据库中的数据，可以使用以下 SQL 查询：

```sql
-- 检查某个 session 的所有洞察及其决策状态
SELECT 
  id,
  insight_id,
  category,
  LEFT(insight, 50) as insight_preview,
  user_decision,
  created_at
FROM research_insights
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at;

-- 统计决策分布
SELECT 
  user_decision,
  COUNT(*) as count
FROM research_insights
WHERE session_id = 'YOUR_SESSION_ID'
GROUP BY user_decision;

-- 检查是否有已采用的洞察
SELECT COUNT(*) as adopted_count
FROM research_insights
WHERE session_id = 'YOUR_SESSION_ID'
  AND user_decision = 'adopt';
```

## 修复记录

### 2025-02-11: 修复用户决策值映射问题
- **问题**: UI 使用 `'must_use'`, `'background'`, `'excluded'`，但数据库期望 `'adopt'`, `'downgrade'`, `'reject'`
- **修复**: 更新 ResearchSynthesisReview.tsx 中的 RadioGroup 值为正确的类型
- **影响**: 用户现在可以正确保存决策，系统能够正确筛选已采用的洞察

### 2025-02-11: 增强调试日志
- **添加**: 在整个数据流程中添加详细的日志记录
- **位置**: 
  - KnowledgeStage.tsx - handleNextStep
  - api.ts - callArticleStructureAgent
  - generate-article-structure/index.ts
- **目的**: 帮助快速定位问题所在

## 下一步行动

如果问题仍然存在，请：
1. 提供完整的浏览器控制台日志（从点击"进入下一步"开始）
2. 提供错误消息的完整内容
3. 确认是否有任何洞察被选择为"必须使用"
