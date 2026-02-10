# 资料整理阶段完整实现说明

## 实现概览

本次更新完整实现了"资料整理"作为独立阶段，位于"资料查询"和"文章结构"之间，提供了完整的资料审阅和决策功能。

## 一、阶段进度条更新

### 更新位置
- 文件：`src/components/workflow/WorkflowProgress.tsx`

### 新的阶段流程
```
开始 (0%) 
→ 明确需求 (10%) 
→ 资料查询 (20%) 
→ 资料整理 (30%) ← 新增
→ 文章结构 (40%) 
→ 段落结构 (50%) 
→ 文章生成 (65%) 
→ 内容审校 (80%) 
→ 排版导出 (90%) 
→ 完成 (100%)
```

### 视觉效果
- 进度条上显示所有阶段节点
- 当前阶段高亮显示
- 已完成阶段可点击跳转
- 移动端自适应显示

## 二、资料整理页面布局（参考 Image 2）

### 整体布局结构
```
┌─────────────────────────────────────────────────────────┐
│ 顶部操作栏                                                │
│ - 标题：资料整理                                          │
│ - 已决策统计：X/Y                                         │
│ - 未决策提示按钮（橙色）                                   │
│ - 日志详情按钮                                            │
│ - 进入下一阶段按钮                                        │
└─────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────────────────┐
│ 左侧边栏     │ 右侧主内容区                              │
│ (col-span-3) │ (col-span-9)                             │
│              │                                          │
│ ┌──────────┐ │ ┌────────────────────────────────────┐  │
│ │资料类型  │ │ │ 资料内容                            │  │
│ │          │ │ │ - 全选复选框                        │  │
│ │市场趋势  │ │ │ - 批量操作按钮                      │  │
│ │  2条     │ │ │                                    │  │
│ │技术可行性│ │ │ ┌────────────────────────────────┐ │  │
│ │  3条     │ │ │ │ ☐ [类型标签] [状态标签]        │ │  │
│ └──────────┘ │ │ │   资料内容文本...               │ │  │
│              │ │ │   ○ 必须使用 ○ 背景补充 ○ 排除 │ │  │
│ ┌──────────┐ │ │ └────────────────────────────────┘ │  │
│ │审阅指南  │ │ │                                    │  │
│ │          │ │ │ [更多资料卡片...]                  │  │
│ │✓必须使用 │ │ └────────────────────────────────────┘  │
│ │ 核心观点 │ │                                          │
│ │          │ │                                          │
│ │○背景补充 │ │                                          │
│ │ 辅助信息 │ │                                          │
│ │          │ │                                          │
│ │○排除     │ │                                          │
│ │ 不相关   │ │                                          │
│ └──────────┘ │                                          │
└──────────────┴──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 底部日志框                                                │
│ ✅ 资料搜索已完成                                         │
│ ✅ 研究综合已完成                                         │
│ ⏳ 等待资料决策完成 (5/10)                                │
└─────────────────────────────────────────────────────────┘
```

### 左侧边栏详细说明

#### 1. 资料类型卡片
- **标题**：资料类型
- **内容**：显示各类别及数量
  - 格式：`类别名称` + `X 条`
  - 示例：
    - 市场趋势 2条
    - 技术可行性 3条
    - 商业模式创新 3条
- **样式**：
  - 每行一个类别
  - 底部边框分隔
  - 右侧显示数量徽章

#### 2. 审阅指南卡片
- **标题**：审阅指南
- **内容**：三种决策类型说明
  
  **必须使用** ✓ (绿色)
  - 核心观点，将直接用于文章论证
  
  **背景补充** ○ (蓝色)
  - 辅助信息，可作为背景或补充说明
  
  **排除** ○ (灰色)
  - 不相关或不适用的内容

### 右侧主内容区详细说明

#### 1. 顶部工具栏
- **全选功能**
  - 复选框 + "全选" 文字
  - 点击切换全选/取消全选状态
  
- **批量操作按钮**（仅在有选中项时显示）
  - 显示已选数量：`已选 X 项`
  - 三个批量操作按钮：
    - "批量设为必须使用"
    - "批量设为背景补充"
    - "批量排除"

#### 2. 资料卡片列表
每个资料卡片包含：

**卡片头部**
- 左侧：单选复选框
- 中间：
  - 类别标签（outline 样式）
  - 状态标签（彩色背景）
    - 待决策：橙色
    - 必须使用：绿色
    - 背景补充：蓝色
    - 排除：灰色
- 内容：资料文本

**卡片底部**
- 三个单选按钮（RadioGroup）
  - ○ 必须使用
  - ○ 背景补充
  - ○ 排除

**交互效果**
- 待决策项：橙色边框 + 浅橙色背景
- 选中项：蓝色外环（ring-2 ring-primary）
- 悬停效果：平滑过渡

#### 3. 滚动区域
- 高度：600px
- 支持垂直滚动
- 平滑滚动到未决策项

### 顶部操作栏详细说明

#### 1. 标题和描述
- **标题**：资料整理
- **描述**：审阅研究资料，决定每项资料的使用方式

#### 2. 统计信息
- 格式：`已决策：X / Y`
- X：已完成决策的数量（绿色）
- Y：总资料数量

#### 3. 未决策提示按钮
- **显示条件**：pendingCount > 0
- **样式**：outline 变体，橙色文字
- **图标**：AlertCircle
- **文本**：`还有 X 项未决策`
- **功能**：点击跳转到第一个未决策项
  - 使用 `scrollIntoView` 平滑滚动
  - 居中显示目标项

#### 4. 日志详情按钮
- **样式**：outline 变体
- **图标**：FileText
- **文本**：日志详情
- **功能**：打开日志详情弹窗

#### 5. 进入下一阶段按钮
- **文本**：进入下一阶段 / 处理中...
- **图标**：ChevronRight
- **禁用条件**：
  - saving = true
  - pendingCount > 0
- **功能**：
  - 调用 callArticleStructureAgent
  - 更新会话阶段为 'structure'
  - 更新项目状态为 'outline_confirmed'

### 日志详情弹窗

#### 弹窗结构
- **标题**：研究综合日志
- **尺寸**：max-w-4xl, max-h-[80vh]
- **内容区域**：可滚动，h-[60vh]

#### 显示内容

**1. 思考过程 (Thought)**
```
标题：思考过程 (Thought)
内容：LLM 的推理过程文本
样式：灰色背景，预格式化文本，自动换行
```

**2. 输入数据**
```
标题：输入数据
内容：JSON 格式的输入数据
样式：灰色背景，预格式化文本，可横向滚动
格式：JSON.stringify(input, null, 2)
```

**3. 输出结果**
```
标题：输出结果
内容：JSON 格式的综合结果
样式：灰色背景，预格式化文本，可横向滚动
格式：JSON.stringify(synthesis, null, 2)
```

**无数据状态**
- 图标：Info（大号，半透明）
- 文字：暂无日志数据
- 居中显示

### 底部日志框详细说明

#### 日志项列表

**1. 资料搜索已完成**
- 图标：✅ CheckCircle2（绿色）
- 状态：已完成
- 文字颜色：灰色（muted-foreground）

**2. 研究综合已完成**
- 图标：✅ CheckCircle2（绿色）
- 状态：已完成
- 文字颜色：灰色（muted-foreground）

**3. 资料决策状态**（动态）

**情况 A：所有资料已决策**
- 图标：✅ CheckCircle2（绿色）
- 文字：所有资料已完成决策
- 文字颜色：绿色

**情况 B：还有未决策项**
- 图标：⚠️ AlertCircle（橙色）
- 文字：等待资料决策完成 (X/Y)
- 文字颜色：橙色
- X：已决策数量
- Y：总数量

## 三、数据流程

### 1. 页面加载流程
```
1. 获取 writing_session (通过 projectId)
   ↓
2. 并行获取 research_insights 和 research_gaps
   ↓
3. 转换为统一的 MaterialItem 格式
   ↓
4. 从 session.synthesis_result 恢复日志数据
   ↓
5. 渲染界面
```

### 2. 决策操作流程

**单项决策**
```
用户点击单选按钮
   ↓
调用 updateInsightDecision 或 updateGapDecision
   ↓
更新数据库
   ↓
更新本地状态
```

**批量决策**
```
用户选择多项 + 点击批量按钮
   ↓
检查是否有选中项
   ↓
并行调用多个更新函数
   ↓
更新数据库
   ↓
更新本地状态
   ↓
清空选择
   ↓
显示成功提示
```

### 3. 进入下一阶段流程
```
用户点击"进入下一阶段"
   ↓
检查是否所有项都已决策
   ↓
调用 callArticleStructureAgent(sessionId, projectId)
   ↓
更新 writing_session.current_stage = 'structure'
   ↓
更新 project.status = 'outline_confirmed'
   ↓
触发 onComplete() 回调
   ↓
页面刷新，显示文章结构阶段
```

## 四、技术实现细节

### 1. 状态管理
```typescript
const [materials, setMaterials] = useState<MaterialItem[]>([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [sessionId, setSessionId] = useState<string>('');
const [synthesisLog, setSynthesisLog] = useState<any>(null);
```

### 2. 计算属性（useMemo）
```typescript
// 分类统计
const categoryStats = useMemo(() => {
  const stats: Record<string, number> = {};
  materials.forEach(item => {
    if (item.type === 'insight') {
      stats[item.category] = (stats[item.category] || 0) + 1;
    }
  });
  return stats;
}, [materials]);

// 未决策数量
const pendingCount = useMemo(() => {
  return materials.filter(m => m.decision === 'pending').length;
}, [materials]);

// 已决策数量
const decidedCount = useMemo(() => {
  return materials.filter(m => m.decision !== 'pending').length;
}, [materials]);
```

### 3. 数据类型映射
```typescript
// Insights 决策类型
type InsightDecision = 'adopt' | 'downgrade' | 'reject' | 'pending';

// Gaps 决策类型
type GapDecision = 'respond' | 'ignore' | 'pending';

// 统一映射
adopt → 必须使用 (绿色)
downgrade → 背景补充 (蓝色)
reject → 排除 (灰色)
respond → 必须使用 (绿色)
ignore → 排除 (灰色)
pending → 待决策 (橙色)
```

### 4. 日志数据结构
```typescript
interface SynthesisLog {
  thought: string;           // LLM 思考过程
  input: {                   // 输入数据
    writing_requirements: {...};
    raw_materials: [...];
  };
  synthesis: {               // 输出结果
    insights: [...];
    gaps: [...];
  };
  timestamp: string;         // 时间戳
}
```

### 5. 滚动到未决策项
```typescript
const scrollToFirstPending = () => {
  const firstPending = materials.find(m => m.decision === 'pending');
  if (firstPending) {
    const element = document.getElementById(`material-${firstPending.id}`);
    element?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  }
};
```

## 五、样式设计

### 1. 颜色系统
```css
/* 决策状态颜色 */
必须使用：text-green-600 bg-green-50
背景补充：text-blue-600 bg-blue-50
排除：text-gray-600 bg-gray-50
待决策：text-orange-600 bg-orange-50

/* 边框和背景 */
待决策卡片：border-orange-300 bg-orange-50/50
选中卡片：ring-2 ring-primary
```

### 2. 布局尺寸
```css
/* 网格布局 */
左侧边栏：col-span-3 (25%)
右侧内容：col-span-9 (75%)

/* 滚动区域 */
资料列表：h-[600px]
日志弹窗：h-[60vh]

/* 间距 */
卡片间距：space-y-4
内容间距：gap-2, gap-3, gap-4
```

### 3. 响应式设计
```css
/* 移动端适配 */
- 进度条标签：hidden md:block
- 网格布局：自动调整列宽
- 弹窗尺寸：max-w-4xl max-h-[80vh]
```

## 六、用户体验优化

### 1. 防止误操作
- 未完成决策时禁用"进入下一阶段"按钮
- 明确提示还有多少项未决策
- 批量操作前检查是否有选中项

### 2. 视觉反馈
- 待决策项橙色高亮
- 选中项蓝色外环
- 操作按钮禁用状态
- 加载和保存状态提示

### 3. 操作便捷性
- 支持全选/取消全选
- 支持批量操作
- 一键跳转到未决策项
- 平滑滚动动画

### 4. 信息透明度
- 实时显示决策进度
- 完整的日志信息
- 详细的错误提示
- 操作成功反馈

## 七、错误处理

### 1. 加载失败
```typescript
try {
  // 加载数据
} catch (error) {
  toast({
    title: '加载失败',
    description: error.message || '无法加载研究资料',
    variant: 'destructive',
  });
}
```

### 2. 保存失败
```typescript
try {
  // 保存决策
} catch (error) {
  toast({
    title: '设置失败',
    description: error.message || '设置决策失败',
    variant: 'destructive',
  });
}
```

### 3. 进入下一阶段失败
```typescript
try {
  // 生成文章结构
} catch (error) {
  toast({
    title: '操作失败',
    description: error.message || '无法生成文章结构',
    variant: 'destructive',
  });
}
```

## 八、测试要点

### 1. 功能测试
- [ ] 页面正常加载
- [ ] 资料列表正确显示
- [ ] 分类统计准确
- [ ] 单项决策正常工作
- [ ] 批量决策正常工作
- [ ] 全选功能正常
- [ ] 跳转到未决策项正常
- [ ] 日志详情正常显示
- [ ] 进入下一阶段正常

### 2. 边界测试
- [ ] 无资料时的显示
- [ ] 所有资料已决策时的状态
- [ ] 无日志数据时的显示
- [ ] 网络错误时的处理

### 3. 交互测试
- [ ] 选择/取消选择
- [ ] 批量操作
- [ ] 滚动定位
- [ ] 弹窗打开/关闭
- [ ] 按钮禁用状态

## 九、后续优化建议

### 1. 性能优化
- 虚拟滚动（资料数量 > 100 时）
- 批量操作进度条
- 防抖处理（搜索、筛选）

### 2. 功能增强
- 资料搜索功能
- 按类别筛选
- 按决策状态筛选
- 撤销/重做功能
- 快捷键支持

### 3. 数据分析
- 决策统计图表
- 资料质量评分
- 决策建议（AI 辅助）

### 4. 导出功能
- 导出决策报告
- 导出选中资料
- 导出日志信息
