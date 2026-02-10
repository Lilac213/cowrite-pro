# 资料整理页功能增强

## 实现的功能

### 1. 底部日志栏 + 日志详情对话框

**位置**: MaterialReviewStage.tsx

**功能描述**:
- 将"日志详情"按钮从顶部操作栏移至页面底部固定日志栏
- 日志栏样式参考资料查询页（KnowledgeStage），采用黑色背景、白色文字
- 显示最新日志状态："研究综合已完成"
- 点击日志栏或"日志详情"按钮打开对话框

**日志详情对话框内容**:
- **思考过程 (Thought)**: 显示 LLM 的思考过程，使用 markdown 格式渲染
- **输入数据**: 显示 JSON 格式的输入数据
- **输出结果**: 显示 JSON 格式的综合结果

**实现细节**:
```tsx
// 底部固定日志栏
{synthesisLog && (
  <div 
    className="fixed bottom-0 left-0 right-0 bg-black text-white..."
    onClick={() => setShowLogsDialog(true)}
  >
    <div className="container mx-auto px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="bg-green-600 text-white">
          LATEST LOG
        </Badge>
        <span className="text-sm">
          {new Date().toLocaleTimeString('zh-CN')} 研究综合已完成
        </span>
      </div>
      <Button variant="ghost" size="sm">
        <FileText className="w-4 h-4 mr-2" />
        日志详情
      </Button>
    </div>
  </div>
)}
```

### 2. 资料类型筛选功能

**位置**: MaterialReviewStage.tsx 左侧边栏

**功能描述**:
- 点击左侧资料类型可筛选右侧资料内容
- 显示每个类型的总数和未决策数量
- 支持"全部"选项查看所有资料

**数据结构**:
```tsx
// 分类统计（包含未决策数量）
const categoryStats = useMemo(() => {
  const stats: Record<string, { total: number; pending: number }> = {};
  materials.forEach(item => {
    if (item.type === 'insight') {
      if (!stats[item.category]) {
        stats[item.category] = { total: 0, pending: 0 };
      }
      stats[item.category].total += 1;
      if (item.decision === 'pending') {
        stats[item.category].pending += 1;
      }
    }
  });
  return stats;
}, [materials]);
```

**UI 实现**:
```tsx
<div 
  className={cn(
    "flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-colors hover:bg-accent",
    selectedCategory === category && "bg-accent"
  )}
  onClick={() => setSelectedCategory(category)}
>
  <div className="flex flex-col gap-1">
    <span className="text-sm">{category}</span>
    {stats.pending > 0 && (
      <span className="text-xs text-orange-600">
        还剩 {stats.pending} 条未决策
      </span>
    )}
  </div>
  <Badge variant="secondary">{stats.total} 条</Badge>
</div>
```

**筛选逻辑**:
```tsx
// 过滤后的资料列表
const filteredMaterials = useMemo(() => {
  if (!selectedCategory) return materials;
  return materials.filter(m => m.category === selectedCategory);
}, [materials, selectedCategory]);
```

### 3. 修复"进入下一阶段"按钮不触发研究综合 Agent

**位置**: KnowledgeStage.tsx

**问题原因**:
- 按钮被禁用条件：`disabled={confirming || retrievedMaterials.length === 0}`
- 当从数据库加载资料时，`retrievedMaterials` 可能为空，但 `knowledge` 有数据
- 导致按钮被禁用，无法点击

**解决方案**:

1. **更新按钮禁用条件**:
```tsx
disabled={confirming || (retrievedMaterials.length === 0 && knowledge.length === 0)}
```

2. **更新提示文本**:
```tsx
{retrievedMaterials.length > 0 ? (
  <span>
    已检索到 {retrievedMaterials.length} 条资料，点击"进入下一阶段"开始整理
  </span>
) : (
  <span>
    已加载 {knowledge.length} 条资料，点击"进入下一阶段"开始整理
  </span>
)}
```

3. **更新 handleNextStep 函数**:
```tsx
// 如果 retrievedMaterials 为空但 knowledge 有数据，使用 knowledge
const materialsToUse = retrievedMaterials.length > 0 ? retrievedMaterials : knowledge;

if (materialsToUse.length === 0) {
  toast({
    title: '暂无资料',
    description: '请先进行资料搜索',
    variant: 'destructive',
  });
  return;
}

// ...后续使用 materialsToUse 而不是 retrievedMaterials
```

4. **处理混合类型**:
```tsx
// 处理 RetrievedMaterial 和 KnowledgeBase 类型
const isRetrievedMaterial = 'url' in material;
const materialUrl = isRetrievedMaterial ? material.url : (material as any).source_url;
const materialSourceType = isRetrievedMaterial ? material.source_type : (material as any).source;
// ...
```

## 技术细节

### 状态管理

**MaterialReviewStage 新增状态**:
```tsx
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [showLogsDialog, setShowLogsDialog] = useState(false);
```

### 样式设计

**底部日志栏样式**:
- 固定定位：`fixed bottom-0 left-0 right-0`
- 黑色背景：`bg-black text-white`
- 边框：`border-t border-gray-800`
- 阴影：`shadow-lg`
- 层级：`z-50`
- 悬停效果：`hover:bg-gray-900 transition-colors`

**分类筛选样式**:
- 悬停效果：`hover:bg-accent`
- 选中状态：`bg-accent`
- 圆角：`rounded-md`
- 过渡动画：`transition-colors`

### 数据流

1. **加载资料** → `loadMaterials()`
   - 获取 writing session
   - 获取 insights 和 gaps
   - 转换为统一的 MaterialItem 格式
   - 恢复 synthesis_result 日志

2. **筛选资料** → `filteredMaterials`
   - 根据 selectedCategory 过滤
   - 实时更新显示

3. **统计数据** → `categoryStats`
   - 计算每个分类的总数
   - 计算每个分类的未决策数量

## 用户体验改进

### 1. 更清晰的日志展示
- 底部固定日志栏始终可见
- 一键查看详细日志
- Markdown 格式的思考过程更易读

### 2. 更高效的资料筛选
- 快速定位特定类型的资料
- 清楚了解每个类型的决策进度
- 减少滚动查找的时间

### 3. 更可靠的工作流
- 修复了按钮禁用的问题
- 支持从数据库恢复的资料
- 更好的错误处理和提示

## 测试场景

### 场景 1: 查看日志详情
1. 进入资料整理页
2. 查看底部黑色日志栏
3. 点击日志栏或"日志详情"按钮
4. ✅ 对话框打开，显示思考过程、输入数据、输出结果

### 场景 2: 筛选资料
1. 查看左侧资料类型列表
2. 点击某个类型（如"核心观点"）
3. ✅ 右侧只显示该类型的资料
4. ✅ 显示"还剩X条未决策"
5. 点击"全部"
6. ✅ 显示所有资料

### 场景 3: 进入下一阶段
1. 在资料查询页完成搜索
2. 点击"进入下一阶段"
3. ✅ 按钮可点击（不被禁用）
4. ✅ 触发研究综合 Agent
5. ✅ 跳转到资料整理页
6. ✅ 正确显示 insights 和 gaps

## 相关文件

### 修改的文件
1. `src/components/workflow/MaterialReviewStage.tsx`
   - 添加底部日志栏
   - 添加日志详情对话框
   - 添加资料筛选功能
   - 添加未决策数量统计

2. `src/components/workflow/KnowledgeStage.tsx`
   - 修复按钮禁用逻辑
   - 更新 handleNextStep 函数
   - 支持混合类型资料

### 依赖的组件
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` - 日志详情对话框
- `Badge` - 日志栏标签和分类统计
- `Button` - 日志详情按钮
- `ScrollArea` - 日志内容滚动
- `Card`, `CardHeader`, `CardContent` - 分类列表

## 后续优化建议

1. **日志时间戳**:
   - 从 synthesis_result 中提取实际的执行时间
   - 显示更精确的时间信息

2. **日志导出**:
   - 添加导出日志为文本文件的功能
   - 方便用户保存和分享

3. **筛选增强**:
   - 添加多选筛选
   - 添加决策状态筛选（已决策/未决策）
   - 添加搜索功能

4. **性能优化**:
   - 虚拟滚动优化大量资料的渲染
   - 懒加载资料内容

5. **数据持久化**:
   - 保存用户的筛选偏好
   - 记住上次查看的分类
