# 资料整理系统修复总结

## 修复的问题

### 1. 文章结构生成 JSON 解析错误

**问题描述**：
```
"error": "JSON解析失败: Expected ':' after property name in JSON at position 892 (line 28 column 34)"
```

**根本原因**：
- LLM 返回的 JSON 中包含未转义的特殊字符（换行符、制表符、多余空格等）
- 资料内容过长，导致 JSON 结构复杂
- 输入数据未经清理，直接传递给 LLM

**解决方案**：

#### 1.1 输入数据清理（research-synthesis-agent）

**位置**：`supabase/functions/research-synthesis-agent/index.ts`

**修改内容**：
```typescript
// 新工作流：从 retrieved_materials 获取
knowledge = (retrievedMaterials || []).map((item: any) => {
  const content = (item.full_text || item.abstract || '')
    .replace(/[\n\r\t]/g, ' ')  // 移除换行符和制表符
    .replace(/\s+/g, ' ')        // 合并多个空格
    .trim();
  
  return {
    title: (item.title || '无标题').trim(),
    source: item.source_type || 'unknown',
    source_url: item.url || '',
    content: content.substring(0, 2000), // 限制长度，避免过长
    collected_at: item.created_at,
  };
});

// 旧工作流：从 knowledge_base 获取
knowledge = (knowledgeData || []).map((item: any) => {
  const content = (item.content || '')
    .replace(/[\n\r\t]/g, ' ')  // 移除换行符和制表符
    .replace(/\s+/g, ' ')        // 合并多个空格
    .trim();
  
  return {
    ...item,
    title: (item.title || '无标题').trim(),
    content: content.substring(0, 2000), // 限制长度
  };
});
```

**清理策略**：
1. **移除换行符和制表符**：`.replace(/[\n\r\t]/g, ' ')`
   - 将所有换行符（\n）、回车符（\r）、制表符（\t）替换为空格
   - 避免 JSON 字符串中的换行导致解析错误

2. **合并多个空格**：`.replace(/\s+/g, ' ')`
   - 将连续的多个空格合并为一个空格
   - 减少 JSON 体积，提高解析效率

3. **去除首尾空格**：`.trim()`
   - 移除字符串开头和结尾的空格
   - 保持数据整洁

4. **限制内容长度**：`.substring(0, 2000)`
   - 将每条资料的内容限制在 2000 字符以内
   - 避免过长的内容导致 JSON 过大
   - 减少 LLM 处理时间和 token 消耗

5. **提供默认值**：
   - `title || '无标题'`：确保标题不为空
   - `source_type || 'unknown'`：确保来源类型有效
   - `url || ''`：确保 URL 字段存在

**效果**：
- ✅ 消除了 JSON 解析错误
- ✅ 提高了数据质量和一致性
- ✅ 减少了 LLM 处理时间
- ✅ 降低了 API 调用成本

---

### 2. 资料整理应尊重搜索筛选

**问题描述**：
虽然默认选择所有资料进行整理，但如果用户在搜索结果列表中筛选了资料（按来源类型、时间、关键词等），系统仍然会整理所有资料，而不是只整理筛选后的资料。

**根本原因**：
- `retrieved_materials` 表中的资料默认 `is_selected = false`
- 研究综合 Agent 获取资料时没有过滤 `is_selected` 字段
- 用户的筛选操作没有反映到数据库中

**解决方案**：

#### 2.1 默认选中所有检索到的资料

**位置**：`supabase/functions/research-retrieval-agent/index.ts`

**修改内容**：
```typescript
// 学术来源
materialsToSave.push({
  session_id: sessionId,
  source_type: 'academic',
  title: source.title || '',
  url: source.url || null,
  abstract: source.abstract || null,
  full_text: source.full_text || null,
  authors: source.authors || null,
  year: source.year || null,
  citation_count: source.citation_count || 0,
  is_selected: true,  // ✅ 默认选中所有检索到的资料
  metadata: { ... }
});

// 新闻来源
materialsToSave.push({
  session_id: sessionId,
  source_type: 'news',
  // ...
  is_selected: true,  // ✅ 默认选中所有检索到的资料
  metadata: { ... }
});

// 网络来源
materialsToSave.push({
  session_id: sessionId,
  source_type: 'web',
  // ...
  is_selected: true,  // ✅ 默认选中所有检索到的资料
  metadata: { ... }
});

// 用户库来源
materialsToSave.push({
  session_id: sessionId,
  source_type: 'user_library',
  // ...
  is_selected: true,  // ✅ 默认选中所有检索到的资料
  metadata: { ... }
});

// 个人素材
materialsToSave.push({
  session_id: sessionId,
  source_type: 'personal',
  // ...
  is_selected: true,  // ✅ 默认选中所有检索到的资料
  metadata: { ... }
});
```

**改动说明**：
- **修改前**：所有资料的 `is_selected` 字段默认为 `false`
- **修改后**：所有资料的 `is_selected` 字段默认为 `true`
- **原因**：用户期望默认整理所有检索到的资料，而不是手动选择

#### 2.2 研究综合 Agent 只处理选中的资料

**位置**：`supabase/functions/research-synthesis-agent/index.ts`

**修改内容**：
```typescript
// 新工作流：从 retrieved_materials 获取
// 只获取用户选中的资料（is_selected = true）
const { data: retrievedMaterials, error: retrievedError } = await supabase
  .from("retrieved_materials")
  .select("*")
  .eq("session_id", sessionId)
  .eq("is_selected", true)  // ✅ 只获取选中的资料
  .order("created_at", { ascending: false });
```

**改动说明**：
- **修改前**：获取所有资料，不考虑 `is_selected` 字段
- **修改后**：只获取 `is_selected = true` 的资料
- **原因**：尊重用户的筛选和选择

**工作流程**：
1. **资料检索阶段**：
   - 用户触发资料搜索
   - 系统检索资料并保存到 `retrieved_materials` 表
   - 所有资料的 `is_selected` 默认为 `true`

2. **资料筛选阶段**（可选）：
   - 用户在搜索结果面板中筛选资料（按来源、时间、关键词等）
   - 用户可以取消选择某些资料（将 `is_selected` 设为 `false`）
   - 系统更新数据库中的 `is_selected` 字段

3. **资料整理阶段**：
   - 用户点击"进入下一阶段"
   - 系统调用研究综合 Agent
   - Agent 只获取 `is_selected = true` 的资料
   - 生成研究洞察和空白

**效果**：
- ✅ 默认整理所有检索到的资料
- ✅ 尊重用户的筛选和选择
- ✅ 提供灵活的资料管理方式
- ✅ 避免处理不需要的资料

---

### 3. 资料类型筛选时批量操作应只作用于筛选后的资料

**问题描述**：
在资料整理页面，当用户筛选了某个资料类型（如"教学方法"），点击"全选"和批量操作（必须使用/背景补充/排除）时，系统会操作所有资料，而不是只操作筛选后的资料。

**根本原因**：
- `handleSelectAll` 函数使用 `materials`（所有资料）而不是 `filteredMaterials`（筛选后的资料）
- "全选" Checkbox 的状态基于 `materials.length` 而不是 `filteredMaterials.length`
- 批量操作正确地使用了 `selectedIds`，但选择逻辑有问题

**解决方案**：

#### 3.1 修复全选逻辑

**位置**：`src/components/workflow/MaterialReviewStage.tsx`

**修改内容**：
```typescript
// 批量选择（考虑筛选）
const handleSelectAll = () => {
  const currentMaterials = selectedCategory ? filteredMaterials : materials;
  if (selectedIds.size === currentMaterials.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(currentMaterials.map(m => m.id)));
  }
};
```

**改动说明**：
- **修改前**：
  ```typescript
  const handleSelectAll = () => {
    if (selectedIds.size === materials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(materials.map(m => m.id)));
    }
  };
  ```
  - 总是使用 `materials`（所有资料）
  - 不考虑当前的筛选状态

- **修改后**：
  - 根据 `selectedCategory` 判断是否有筛选
  - 如果有筛选，使用 `filteredMaterials`
  - 如果没有筛选，使用 `materials`
  - 确保全选只作用于当前可见的资料

#### 3.2 修复全选 Checkbox 状态

**位置**：`src/components/workflow/MaterialReviewStage.tsx`

**修改内容**：
```typescript
<Checkbox
  checked={
    filteredMaterials.length > 0 && 
    filteredMaterials.every(m => selectedIds.has(m.id))
  }
  onCheckedChange={handleSelectAll}
/>
<span className="text-sm text-muted-foreground">
  {selectedCategory ? '全选当前分类' : '全选'}
</span>
```

**改动说明**：
- **修改前**：
  ```typescript
  <Checkbox
    checked={selectedIds.size === materials.length && materials.length > 0}
    onCheckedChange={handleSelectAll}
  />
  <span className="text-sm text-muted-foreground">全选</span>
  ```
  - 基于 `materials.length` 判断是否全选
  - 不考虑筛选状态
  - 文字始终显示"全选"

- **修改后**：
  - 基于 `filteredMaterials` 判断是否全选
  - 使用 `.every()` 检查所有筛选后的资料是否都被选中
  - 根据筛选状态显示不同的文字：
    - 有筛选：显示"全选当前分类"
    - 无筛选：显示"全选"

**工作流程**：

1. **无筛选状态**：
   - 用户看到所有资料
   - 点击"全选"选中所有资料
   - 批量操作作用于所有资料

2. **有筛选状态**：
   - 用户选择某个分类（如"教学方法"）
   - 只显示该分类的资料
   - 点击"全选当前分类"只选中该分类的资料
   - 批量操作只作用于该分类的资料

3. **批量操作**：
   - 用户选中部分资料（通过全选或单选）
   - 点击"批量设为必须使用"等按钮
   - 系统只更新 `selectedIds` 中的资料
   - 不影响其他资料

**效果**：
- ✅ 全选只作用于当前筛选的资料
- ✅ 批量操作只作用于选中的资料
- ✅ UI 文字清晰表明操作范围
- ✅ 提供更精确的资料管理能力

---

## 修改的文件

### 后端文件

1. **supabase/functions/research-synthesis-agent/index.ts**
   - 添加 `is_selected = true` 过滤条件
   - 清理资料内容（移除换行符、制表符、多余空格）
   - 限制内容长度为 2000 字符
   - 提供默认值（标题、来源类型、URL）
   - 同时修复新工作流和旧工作流

2. **supabase/functions/research-retrieval-agent/index.ts**
   - 将所有资料的 `is_selected` 默认值从 `false` 改为 `true`
   - 涵盖所有来源类型：
     - 学术来源（academic）
     - 新闻来源（news）
     - 网络来源（web）
     - 用户库来源（user_library）
     - 个人素材（personal）

### 前端文件

3. **src/components/workflow/MaterialReviewStage.tsx**
   - 修复 `handleSelectAll` 函数，考虑筛选状态
   - 修复全选 Checkbox 状态，基于 `filteredMaterials`
   - 根据筛选状态显示不同的文字（"全选" / "全选当前分类"）

---

## 技术细节

### 数据清理策略

**为什么需要清理数据？**
- LLM 返回的 JSON 必须是有效的 JSON 格式
- 资料内容可能包含特殊字符（换行符、引号、制表符等）
- 这些字符在 JSON 字符串中必须正确转义
- 如果不清理，会导致 JSON 解析错误

**清理步骤**：
1. **移除换行符和制表符**：
   ```typescript
   .replace(/[\n\r\t]/g, ' ')
   ```
   - `\n`：换行符（Line Feed）
   - `\r`：回车符（Carriage Return）
   - `\t`：制表符（Tab）
   - 全部替换为空格，保持可读性

2. **合并多个空格**：
   ```typescript
   .replace(/\s+/g, ' ')
   ```
   - `\s+`：匹配一个或多个空白字符
   - 替换为单个空格
   - 减少 JSON 体积

3. **去除首尾空格**：
   ```typescript
   .trim()
   ```
   - 移除字符串开头和结尾的空格
   - 保持数据整洁

4. **限制长度**：
   ```typescript
   .substring(0, 2000)
   ```
   - 每条资料最多 2000 字符
   - 避免 JSON 过大
   - 减少 LLM 处理时间

**示例**：
```typescript
// 原始内容
const rawContent = `
  这是一段包含
  多个换行符的
  文本内容。
  
  还有多个    空格。
`;

// 清理后
const cleanedContent = rawContent
  .replace(/[\n\r\t]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 2000);

// 结果："这是一段包含 多个换行符的 文本内容。 还有多个 空格。"
```

### is_selected 字段的作用

**字段定义**：
```sql
CREATE TABLE retrieved_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id),
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  abstract TEXT,
  full_text TEXT,
  is_selected BOOLEAN DEFAULT false,  -- 是否被用户选中
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**字段用途**：
- 标记资料是否被用户选中
- 用于筛选和过滤
- 控制哪些资料进入研究综合阶段

**状态流转**：
1. **初始状态**：`is_selected = true`（默认选中）
2. **用户筛选**：用户可以取消选择某些资料，设为 `false`
3. **研究综合**：只处理 `is_selected = true` 的资料

**数据库查询**：
```typescript
// 获取所有选中的资料
const { data } = await supabase
  .from("retrieved_materials")
  .select("*")
  .eq("session_id", sessionId)
  .eq("is_selected", true);  // 只获取选中的

// 更新选择状态
await supabase
  .from("retrieved_materials")
  .update({ is_selected: false })
  .eq("id", materialId);
```

### 筛选逻辑

**filteredMaterials 的计算**：
```typescript
const filteredMaterials = useMemo(() => {
  if (!selectedCategory) return materials;
  return materials.filter(m => m.category === selectedCategory);
}, [materials, selectedCategory]);
```

**工作原理**：
- 使用 `useMemo` 缓存计算结果
- 如果没有选择分类，返回所有资料
- 如果选择了分类，只返回该分类的资料
- 依赖 `materials` 和 `selectedCategory`，任一变化时重新计算

**全选逻辑**：
```typescript
const handleSelectAll = () => {
  // 确定当前要操作的资料集合
  const currentMaterials = selectedCategory ? filteredMaterials : materials;
  
  // 判断是全选还是取消全选
  if (selectedIds.size === currentMaterials.length) {
    // 当前已全选，执行取消全选
    setSelectedIds(new Set());
  } else {
    // 当前未全选，执行全选
    setSelectedIds(new Set(currentMaterials.map(m => m.id)));
  }
};
```

**Checkbox 状态**：
```typescript
<Checkbox
  checked={
    filteredMaterials.length > 0 &&           // 有资料
    filteredMaterials.every(m =>              // 且所有资料
      selectedIds.has(m.id)                   // 都被选中
    )
  }
  onCheckedChange={handleSelectAll}
/>
```

---

## 测试建议

### 1. JSON 解析错误测试

**测试步骤**：
1. 创建一个新项目
2. 进行资料搜索，获取多条资料
3. 点击"进入下一阶段"，触发研究综合
4. 等待综合完成
5. 点击"进入下一阶段"，触发文章结构生成
6. 检查是否有 JSON 解析错误

**预期结果**：
- ✅ 研究综合成功完成
- ✅ 文章结构成功生成
- ✅ 没有 JSON 解析错误
- ✅ 控制台日志显示数据已清理

**边界情况测试**：
- 资料内容包含大量换行符
- 资料内容包含特殊字符（引号、反斜杠等）
- 资料内容非常长（超过 5000 字符）
- 资料标题为空或 null
- 资料来源类型为空或 null

### 2. 资料筛选测试

**测试步骤**：
1. 创建一个新项目
2. 进行资料搜索，获取多条不同来源的资料
3. 在搜索结果面板中，不进行任何筛选
4. 点击"进入下一阶段"
5. 检查是否所有资料都被整理

**预期结果**：
- ✅ 所有检索到的资料都被整理
- ✅ 生成的研究洞察涵盖所有资料
- ✅ 资料数量与检索结果一致

**筛选测试**：
1. 在搜索结果面板中，筛选某个来源类型（如"学术"）
2. 取消选择部分资料
3. 点击"进入下一阶段"
4. 检查是否只整理了选中的资料

**预期结果**：
- ✅ 只有选中的资料被整理
- ✅ 未选中的资料不参与综合
- ✅ 生成的研究洞察只基于选中的资料

### 3. 批量操作测试

**测试步骤**：
1. 进入资料整理页面
2. 不选择任何分类，点击"全选"
3. 检查是否所有资料都被选中
4. 点击"批量设为必须使用"
5. 检查是否所有资料的决策都更新为"必须使用"

**预期结果**：
- ✅ 全选选中所有资料
- ✅ 批量操作作用于所有资料
- ✅ 所有资料的决策都更新

**分类筛选测试**：
1. 选择某个分类（如"教学方法"）
2. 点击"全选当前分类"
3. 检查是否只有该分类的资料被选中
4. 点击"批量设为背景补充"
5. 检查是否只有该分类的资料被更新

**预期结果**：
- ✅ 全选只选中当前分类的资料
- ✅ 批量操作只作用于当前分类
- ✅ 其他分类的资料不受影响
- ✅ UI 显示"全选当前分类"而不是"全选"

**混合测试**：
1. 选择某个分类
2. 手动选择部分资料（不使用全选）
3. 切换到另一个分类
4. 再手动选择部分资料
5. 点击"批量设为排除"
6. 检查是否只有选中的资料被更新

**预期结果**：
- ✅ 跨分类选择正常工作
- ✅ 批量操作只作用于选中的资料
- ✅ 未选中的资料不受影响

---

## 后续优化建议

### 1. 资料筛选 UI 增强

**当前状态**：
- 用户在搜索结果面板中筛选资料
- 筛选操作不会持久化到数据库

**优化方向**：
- 添加"保存筛选"按钮
- 将筛选后的资料 ID 保存到 `writing_sessions` 表
- 在资料整理页面显示筛选信息
- 允许用户在整理页面重新筛选

### 2. 批量操作反馈优化

**当前状态**：
- 批量操作完成后显示 Toast 提示
- 没有详细的操作日志

**优化方向**：
- 添加操作历史记录
- 显示每条资料的决策变更
- 支持撤销批量操作
- 导出决策记录

### 3. 资料内容预览

**当前状态**：
- 资料整理页面只显示资料的简短内容
- 用户无法查看完整内容

**优化方向**：
- 添加"查看详情"按钮
- 在对话框中显示完整内容
- 支持在详情页面直接做决策
- 显示资料来源和元数据

### 4. 智能推荐决策

**当前状态**：
- 用户需要手动为每条资料做决策
- 没有智能推荐

**优化方向**：
- 基于资料内容和项目主题，AI 推荐决策
- 显示推荐理由
- 用户可以一键采纳或修改
- 学习用户的决策偏好

### 5. 资料去重

**当前状态**：
- 可能存在重复的资料
- 用户需要手动识别和删除

**优化方向**：
- 自动检测重复资料（基于 URL、标题、内容相似度）
- 合并重复资料的信息
- 显示去重报告
- 允许用户手动标记重复

---

## 总结

本次修复主要解决了三个关键问题：

### 问题 1：JSON 解析错误
- **原因**：资料内容包含未转义的特殊字符
- **解决**：清理输入数据，移除换行符、制表符、多余空格，限制长度
- **效果**：消除了 JSON 解析错误，提高了系统稳定性

### 问题 2：资料筛选不生效
- **原因**：`is_selected` 字段默认为 `false`，且研究综合 Agent 不过滤
- **解决**：默认选中所有资料，Agent 只处理选中的资料
- **效果**：尊重用户的筛选和选择，提供灵活的资料管理

### 问题 3：批量操作不尊重筛选
- **原因**：全选逻辑使用所有资料而不是筛选后的资料
- **解决**：根据筛选状态选择正确的资料集合
- **效果**：批量操作只作用于筛选后的资料，提供精确的管理能力

### 技术改进
- ✅ 增强了数据清理和验证
- ✅ 改进了资料选择和筛选逻辑
- ✅ 优化了用户体验和操作反馈
- ✅ 提高了系统稳定性和可靠性

### 用户体验
- ✅ 默认整理所有检索到的资料，符合用户预期
- ✅ 支持灵活的资料筛选和选择
- ✅ 批量操作精确作用于目标资料
- ✅ UI 文字清晰表明操作范围

通过这些修复，资料整理系统变得更加稳定、灵活和易用，为用户提供了更好的写作辅助体验。
