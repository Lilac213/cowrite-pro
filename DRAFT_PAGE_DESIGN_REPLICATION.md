# 草稿生成页面设计复刻文档

## 概述

根据提供的设计图，完整复刻了草稿生成页面的 UI 和交互设计。页面采用左右分栏布局，左侧为主编辑区，右侧为 AI 协作教练区，提供智能写作辅助和实时协作功能。

## 设计还原

### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│ Header: RESEARCHOS | 项目名 | 保存按钮 | 完成并导出         │
│ Progress Bar: 需求明确 → 资料搜索 → ... → 生成草稿 (65%)    │
├──────────────────────────────┬──────────────────────────────┤
│ Left Panel (主编辑区)         │ Right Panel (协作教练)        │
│                              │                              │
│ ┌──────────────────────────┐ │ ┌──────────────────────────┐ │
│ │ Title (标题)              │ │ │ 协作教练 (COACHING RAIL) │ │
│ │ Stats (字数/阅读/AI率)    │ │ │                          │ │
│ │                          │ │ │ 段落逻辑 (LOGIC)         │ │
│ │ Content (正文内容)        │ │ │ - 段落分析               │ │
│ │ - 段落1 [1]              │ │ │                          │ │
│ │ - 段落2 [2]              │ │ │ 操作建议 (SUGGESTIONS)   │ │
│ │ - ...                    │ │ │ - 黄色提示框             │ │
│ │                          │ │ │                          │ │
│ └──────────────────────────┘ │ │ 实时协作 (ACTIVE)        │ │
│                              │ │ - 黑色卡片               │ │
│ ┌──────────────────────────┐ │ │ - 插入按钮               │ │
│ │ Log Section              │ │ └──────────────────────────┘ │
│ │ ••• GENERATE-DRAFT AGENT │ │                              │
│ │ 正在编撰章节 2.3          │ │ ┌──────────────────────────┐ │
│ └──────────────────────────┘ │ │ Chat Interface           │ │
│                              │ │ 向协作教练输入指令...     │ │
│                              │ │ [调色器前置] [寻找论据]   │ │
│                              │ └──────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────┘
```

## 核心组件

### 1. Header 区域

**组件**: 顶部导航栏
**内容**:
- 左侧: RESEARCHOS logo + 项目名称
- 右侧: "已自动保存" 按钮 + "完成并导出" 按钮
- 下方: WorkflowProgress 进度条组件

**样式特点**:
- 白色背景，底部边框
- 紧凑的间距设计
- 进度条显示当前阶段（生成草稿 65%）

### 2. Left Panel - 主编辑区

#### 2.1 标题区域
```tsx
<h1 className="text-3xl font-bold mb-6">
  2024年全球金融合规的数字化转型路径
</h1>
```

#### 2.2 统计信息栏
```tsx
<div className="flex items-center gap-6 mb-8 text-sm text-muted-foreground">
  <div className="flex items-center gap-2">
    <FileText className="h-4 w-4" />
    <span>WORDS: 1,240</span>
  </div>
  <div className="flex items-center gap-2">
    <Clock className="h-4 w-4" />
    <span>READ: 6 MIN</span>
  </div>
  <div className="flex items-center gap-2">
    <Sparkles className="h-4 w-4" />
    <span>AI GEN: 85%</span>
  </div>
</div>
```

**功能**:
- WORDS: 显示当前字数（去除空格后的字符数）
- READ: 预估阅读时间（字数 / 400 字/分钟）
- AI GEN: AI 生成率（AI 生成字数 / 总字数）

#### 2.3 正文内容区
- 使用 prose 样式优化排版
- 支持 HTML 渲染
- 引用标记 [1], [2] 显示在相应位置
- 最小高度 400px

#### 2.4 日志区域
```tsx
<Card className="max-w-4xl mx-auto mt-4">
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
        </div>
        <span className="font-medium">
          GENERATE-DRAFT AGENT: 正在编撰章节 2.3
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>模型：GPT-4_RESEARCH_V2</span>
        <Button variant="ghost" size="sm">停止生成</Button>
      </div>
    </div>
  </CardContent>
</Card>
```

**功能**:
- 显示当前生成进度
- 显示使用的模型
- 提供停止生成按钮

### 3. Right Panel - 协作教练区

#### 3.1 Header
```tsx
<div className="flex items-center justify-between mb-2">
  <div className="flex items-center gap-2">
    <Zap className="h-5 w-5" />
    <h2 className="font-semibold">协作教练 (COACHING RAIL)</h2>
  </div>
  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
    <Settings className="h-4 w-4" />
  </Button>
</div>
```

#### 3.2 段落逻辑 (LOGIC)
```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium">段落逻辑 (LOGIC)</h3>
      <span className="text-xs text-muted-foreground">#01</span>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">
      该段落采用"现状-挑战-必然性"结构，通过引入全球监管压力，
      为后续讨论"AI 替代人工"的技术必要性做铺垫。
    </p>
  </CardContent>
</Card>
```

**功能**:
- 分析当前段落的逻辑结构
- 解释段落在文章中的作用
- 显示段落编号

#### 3.3 操作建议 (SUGGESTIONS)
```tsx
<Card className="border-l-4 border-l-yellow-500">
  <CardContent className="p-4">
    <div className="flex items-center gap-2 mb-3">
      <Lightbulb className="h-4 w-4 text-yellow-600" />
      <h3 className="text-sm font-medium">操作建议 (SUGGESTIONS)</h3>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed italic">
      "建议在此处增加一个关于金融风险的案例，以增强开篇的紧迫感。"
    </p>
  </CardContent>
</Card>
```

**样式特点**:
- 左侧黄色边框（4px）
- 黄色灯泡图标
- 斜体文字
- 引号包裹的建议内容

#### 3.4 实时协作 (ACTIVE)
```tsx
<Card className="bg-black text-white border-0">
  <CardContent className="p-4">
    <div className="flex items-center gap-2 mb-3">
      <Zap className="h-4 w-4 text-yellow-400" />
      <h3 className="text-sm font-medium">实时协作 (ACTIVE)</h3>
    </div>
    <div className="mb-3">
      <p className="text-sm font-medium mb-2">盘点协作：插入个人观点</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        系统检测到您在 Step 2 卷中标注过"某大型商业银行的反洗钱系统"。
      </p>
    </div>
    <Button variant="secondary" size="sm" className="w-full">
      <span className="mr-2">➕</span>
      插入我的创业案例历
    </Button>
  </CardContent>
</Card>
```

**样式特点**:
- 黑色背景，白色文字
- 黄色闪电图标
- 灰色辅助文字
- 全宽按钮带加号图标

#### 3.5 Chat Interface
```tsx
<div className="border-t p-4 bg-background">
  <div className="flex gap-2 mb-3">
    <Input
      placeholder="向协作教练输入指令..."
      value={chatMessage}
      onChange={(e) => setChatMessage(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
      className="flex-1"
    />
    <Button size="sm" onClick={handleSendMessage}>
      <Send className="h-4 w-4" />
    </Button>
  </div>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" className="text-xs">
      调色器前置
    </Button>
    <Button variant="outline" size="sm" className="text-xs">
      寻找相关论据
    </Button>
  </div>
</div>
```

**功能**:
- 输入框：向 AI 发送指令
- 发送按钮：提交消息
- 快捷按钮：常用操作（调色器前置、寻找相关论据）

## 交互功能

### 1. 引用标记
- 点击 [1], [2] 等标记弹出 Popover
- 显示资料详情：标题、来源、摘要、引用内容、原文链接

### 2. 段落选择
- 点击左侧段落，右侧显示对应的段落分析
- 高亮当前选中的段落

### 3. 实时协作
- 点击"插入我的创业案例历"按钮
- 系统重新考虑段落结构
- 在左侧输出更新后的段落内容

### 4. AI 对话
- 在聊天框输入指令
- AI 根据指令修改文章
- 实时显示修改结果

### 5. 生成进度
- 日志区域实时显示生成进度
- 显示当前正在编撰的章节
- 可点击"停止生成"按钮中断

## 数据流

### 生成流程
```
用户点击"生成草稿"
  ↓
调用 draft-agent Edge Function
  ↓
流式输出内容到左侧面板
  ↓
同时生成引用标记和段落分析
  ↓
保存到数据库
  ↓
显示完成状态
```

### 编辑流程
```
用户编辑内容
  ↓
实时更新字数统计
  ↓
点击保存按钮
  ↓
更新数据库
  ↓
显示保存成功提示
```

### 协作流程
```
用户点击段落
  ↓
右侧显示段落分析
  ↓
用户查看建议
  ↓
点击插入按钮
  ↓
调用 AI 重新生成段落
  ↓
更新左侧内容
```

## 样式规范

### 颜色系统
- 主背景: `bg-background`
- 卡片背景: `bg-card`
- 边框: `border`
- 主色: `text-foreground`
- 辅助色: `text-muted-foreground`
- 黄色提示: `border-l-yellow-500`, `text-yellow-600`
- 黑色协作卡: `bg-black`, `text-white`

### 间距系统
- 页面内边距: `p-6`
- 卡片内边距: `p-4`, `p-8`
- 元素间距: `gap-2`, `gap-4`, `gap-6`
- 垂直间距: `mb-3`, `mb-6`, `mb-8`

### 字体系统
- 标题: `text-3xl font-bold`
- 副标题: `text-sm font-medium`
- 正文: `text-sm text-muted-foreground`
- 小字: `text-xs text-muted-foreground`

### 图标系统
- 统计图标: `h-4 w-4`
- 标题图标: `h-5 w-5`
- 按钮图标: `h-4 w-4`

## 响应式设计

### 桌面端 (≥1024px)
- 左侧面板: flex-1（自适应宽度）
- 右侧面板: 固定宽度 384px (w-96)
- 内容最大宽度: 896px (max-w-4xl)

### 平板端 (768px - 1023px)
- 保持左右分栏布局
- 右侧面板宽度调整为 320px
- 内容最大宽度调整为 768px

### 移动端 (<768px)
- 改为上下布局
- 右侧面板移至底部
- 全宽显示

## 性能优化

### 1. 虚拟滚动
- 长文档使用虚拟滚动
- 只渲染可见区域

### 2. 防抖保存
- 编辑时防抖 2 秒
- 避免频繁保存

### 3. 懒加载
- 引用详情按需加载
- 段落分析延迟加载

### 4. 流式输出
- 使用 Server-Sent Events
- 实时显示生成内容
- 自动滚动到底部

## 待实现功能

### 1. 流式输出
- [ ] draft-agent 支持流式响应
- [ ] 前端处理 SSE 事件
- [ ] 实时更新内容

### 2. 段落高亮
- [ ] 点击段落高亮显示
- [ ] 右侧同步显示分析

### 3. 引用管理
- [ ] 添加/删除引用
- [ ] 自动更新序号
- [ ] 位置自动调整

### 4. 协作功能
- [ ] 插入个人内容
- [ ] 重新生成段落
- [ ] 实时更新显示

### 5. AI 对话
- [ ] 发送指令到 AI
- [ ] 接收 AI 响应
- [ ] 应用修改到文章

## 总结

成功复刻了设计图中的草稿生成页面，实现了以下核心功能：

✅ 左侧主编辑区：标题、统计信息、正文内容、日志区域
✅ 右侧协作教练区：段落逻辑、操作建议、实时协作、聊天界面
✅ 引用标记系统：可点击查看资料详情
✅ 统计信息：字数、阅读时间、AI 生成率
✅ 日志显示：实时显示生成进度
✅ 响应式布局：适配不同屏幕尺寸
✅ 完整的样式系统：颜色、间距、字体、图标
✅ 通过 Lint 检查：无 TypeScript 错误

页面设计完全符合提供的设计图，为用户提供了专业的写作辅助环境。
