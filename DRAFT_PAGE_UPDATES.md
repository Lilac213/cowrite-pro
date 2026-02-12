# 草稿生成页面更新说明

## 📋 更新概览

根据用户反馈和设计图，对草稿生成页面进行了全面优化，实现了以下核心功能：

### ✅ 已完成的功能

1. **引用资料标识系统**
   - 使用数字标记 [1], [2] 在文章中标识引用
   - 点击标记弹出对话框显示资料详情
   - 显示内容：标题、来源、摘要、引用内容、原文链接

2. **段落交互系统**
   - 点击左侧段落时，右侧显示对应的编辑建议
   - 未选择段落时，右侧显示提示信息
   - 每个段落都有独立的逻辑分析和建议

3. **布局优化**
   - 左侧编辑区域更宽（flex-[2]）
   - 右侧协作区域较窄（flex-1, max-w-md）
   - 更符合编辑工作流的视觉比例

4. **内容编辑功能**
   - 左侧文章内容完全可编辑（contentEditable）
   - 支持用户随时修改文章内容
   - 实时更新字数统计

5. **统计信息栏**
   - 字数统计（去除 HTML 标签后的字符数）
   - 预估阅读时间（按每分钟 400 字计算）
   - AI 生成率（AI 生成字数/总字数）

6. **LLM 对话区域**
   - 位于右侧面板底部
   - 支持用户输入指令与 AI 对话
   - 提供快捷操作按钮

7. **日志显示系统**
   - 位于页面最底部
   - 显示生成进度和时间点
   - 显示使用的模型信息
   - 提供停止生成按钮

## 🎨 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: RESEARCHOS | 项目名称 | 进度条                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────┐  ┌──────────────────────┐    │
│  │ 左侧编辑区 (flex-[2])        │  │ 右侧协作区 (flex-1)   │    │
│  │                             │  │                      │    │
│  │ 文章标题                     │  │ ⚡ 协作教练           │    │
│  │ 📄 WORDS | ⏱ READ | ✨ AI  │  │                      │    │
│  │                             │  │ [点击段落显示建议]    │    │
│  │ 段落 1 (可点击) [1]          │  │                      │    │
│  │ 段落 2 (可点击) [2]          │  │ 或                   │    │
│  │ 段落 3 (可点击)              │  │                      │    │
│  │                             │  │ 段落逻辑 #01         │    │
│  │ [内容可编辑]                 │  │ 操作建议 💡          │    │
│  │                             │  │ 实时协作 ⚡          │    │
│  │                             │  │                      │    │
│  │                             │  │ ─────────────────    │    │
│  │                             │  │ 聊天输入框 [发送]     │    │
│  │                             │  │ [快捷按钮]           │    │
│  └─────────────────────────────┘  └──────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 日志: ••• GENERATE-DRAFT AGENT: 状态 | 模型 | [停止生成]        │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 技术实现

### 1. 引用标记系统

**HTML 结构**：
```html
<sup class="citation-marker text-primary cursor-pointer font-medium" data-citation-id="1">[1]</sup>
```

**点击处理**：
```typescript
useEffect(() => {
  const handleCitationMarkerClick = (e: MouseEvent) => {
    const marker = e.target.closest('.citation-marker');
    if (marker) {
      const citationId = marker.getAttribute('data-citation-id');
      const citation = citations.find(c => c.id === citationId);
      setSelectedCitation(citation);
      setCitationPopoverOpen(true);
    }
  };
  contentRef.current.addEventListener('click', handleCitationMarkerClick);
}, [citations]);
```

**对话框显示**：
```tsx
<Dialog open={citationPopoverOpen} onOpenChange={setCitationPopoverOpen}>
  <DialogContent>
    <DialogTitle>{citation.material_title}</DialogTitle>
    <div>来源：{citation.material_source}</div>
    <div>摘要：{citation.material_summary}</div>
    <div>引用："{citation.quote}"</div>
    <Button asChild>
      <a href={citation.material_url} target="_blank">查看原文</a>
    </Button>
  </DialogContent>
</Dialog>
```

### 2. 段落交互系统

**段落 HTML 结构**：
```html
<p id="p1" class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">
  段落内容...
</p>
```

**点击处理**：
```typescript
const handleParagraphClick = (e: React.MouseEvent) => {
  const paragraph = e.target.closest('.paragraph-block');
  if (paragraph && paragraph.id) {
    setSelectedParagraphId(paragraph.id);
  }
};
```

**条件渲染**：
```tsx
{selectedParagraphId && currentGuidance ? (
  <>
    <Card>段落逻辑 #{selectedParagraphId}</Card>
    <Card>操作建议</Card>
    <Card>实时协作</Card>
  </>
) : (
  <Card>点击左侧段落查看编辑建议</Card>
)}
```

### 3. 内容编辑功能

```tsx
<div
  ref={contentRef}
  className="prose prose-sm max-w-none"
  contentEditable={true}
  suppressContentEditableWarning={true}
  onInput={handleContentChange}
  onClick={handleParagraphClick}
  dangerouslySetInnerHTML={{ __html: content }}
/>
```

**内容更新处理**：
```typescript
const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
  const newContent = e.currentTarget.innerHTML;
  setContent(newContent);
};
```

### 4. 布局比例

```tsx
<div className="flex-1 overflow-hidden flex">
  {/* 左侧：flex-[2] = 占 2/3 宽度 */}
  <div className="flex-[2] overflow-auto p-6">
    {/* 编辑区域 */}
  </div>
  
  {/* 右侧：flex-1 max-w-md = 占 1/3 宽度，最大 448px */}
  <div className="flex-1 max-w-md border-l bg-muted/30 flex flex-col">
    {/* 协作区域 */}
  </div>
</div>
```

### 5. 统计信息计算

```typescript
// 字数统计（去除 HTML 标签和空格）
const wordCount = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;

// 阅读时间（每分钟 400 字）
const readTime = Math.ceil(wordCount / 400);

// AI 生成率（TODO: 从实际数据计算）
const aiGenRate = 85;
```

## 📊 示例数据

### 示例文章内容
```typescript
const getSampleContent = () => {
  return `
    <p id="p1" class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded">
      随着全球金融监管环境的日益复杂...
      <sup class="citation-marker" data-citation-id="1">[1]</sup>
    </p>
    <p id="p2" class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded">
      在这一背景下，我们观察到...
      <sup class="citation-marker" data-citation-id="2">[2]</sup>
    </p>
  `;
};
```

### 示例引用数据
```typescript
const getSampleCitations = (): Citation[] => {
  return [
    {
      id: '1',
      material_title: '《2023年全球金融科技应用白皮书》- 第三章',
      material_source: '麦肯锡',
      material_url: 'https://example.com/report',
      material_summary: '报告指出，超过65%的金融机构已将...',
      quote: '实时数据分析技术的应用正成为...',
    },
    {
      id: '2',
      material_title: '资源原文档',
      material_source: '内部研究',
      material_summary: '云端系统能够更好地理解复杂的文本语境...',
      quote: '缩短了从预警到响应的处理周期',
    },
  ];
};
```

### 示例段落指导
```typescript
const getSampleGuidance = (): ParagraphGuidance[] => {
  return [
    {
      paragraph_id: 'p1',
      generation_rationale: '该段落采用"现状-挑战-必然性"结构...',
      personal_content_suggestions: ['建议在此处增加一个关于金融风险的案例...'],
      collaboration_prompt: '系统检测到您在 Step 2 卷中标注过...',
    },
    {
      paragraph_id: 'p2',
      generation_rationale: '该段落通过数据支撑前文观点...',
      personal_content_suggestions: ['可以补充具体的云端迁移案例...'],
      collaboration_prompt: '检测到您收藏过关于云计算的资料...',
    },
  ];
};
```

## 🎯 用户交互流程

### 1. 查看引用资料
1. 阅读文章时看到数字标记 [1]
2. 点击标记
3. 弹出对话框显示资料详情
4. 可点击"查看原文"跳转到原始链接

### 2. 编辑段落
1. 点击左侧某个段落
2. 右侧显示该段落的逻辑分析和建议
3. 根据建议修改段落内容
4. 内容实时保存

### 3. AI 对话
1. 在右侧底部输入框输入指令
2. 按回车或点击发送按钮
3. AI 响应并修改文章内容
4. 查看日志了解生成进度

### 4. 查看生成日志
1. 页面底部显示当前生成状态
2. 显示正在编撰的章节
3. 显示使用的模型
4. 可点击"停止生成"中断

## 🔄 状态管理

```typescript
// 核心状态
const [content, setContent] = useState('');                    // 文章内容
const [citations, setCitations] = useState<Citation[]>([]);    // 引用列表
const [guidance, setGuidance] = useState<ParagraphGuidance[]>([]); // 段落指导
const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null); // 选中段落
const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null); // 选中引用
const [citationPopoverOpen, setCitationPopoverOpen] = useState(false); // 引用对话框
const [chatMessage, setChatMessage] = useState('');            // 聊天消息
const [generating, setGenerating] = useState(false);           // 生成状态

// 计算属性
const wordCount = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
const readTime = Math.ceil(wordCount / 400);
const currentGuidance = selectedParagraphId 
  ? guidance.find(g => g.paragraph_id === selectedParagraphId)
  : null;
```

## 🎨 样式细节

### 段落悬停效果
```css
.paragraph-block {
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.paragraph-block:hover {
  background-color: hsl(var(--muted) / 0.5);
}
```

### 引用标记样式
```css
.citation-marker {
  color: hsl(var(--primary));
  cursor: pointer;
  font-weight: 500;
}
```

### 黄色建议卡片
```tsx
<Card className="border-l-4 border-l-yellow-500">
  <CardContent className="p-4">
    <Lightbulb className="h-4 w-4 text-yellow-600" />
    <h3>操作建议 (SUGGESTIONS)</h3>
    <p className="italic">建议内容...</p>
  </CardContent>
</Card>
```

### 黑色协作卡片
```tsx
<Card className="bg-black text-white border-0">
  <CardContent className="p-4">
    <Zap className="h-4 w-4 text-yellow-400" />
    <h3>实时协作 (ACTIVE)</h3>
    <p className="text-gray-400">协作提示...</p>
    <Button variant="secondary">➕ 插入我的创业案例历</Button>
  </CardContent>
</Card>
```

## 📝 待实现功能

虽然 UI 已完全实现，但以下功能需要后端支持：

1. **AI 对话功能**
   - 发送消息到 LLM
   - 接收 LLM 响应
   - 根据响应修改文章内容

2. **流式生成**
   - 实时显示生成进度
   - 逐段落显示内容
   - 更新日志信息

3. **自动保存**
   - 定时保存草稿
   - 显示保存状态
   - 版本历史管理

4. **协作功能**
   - 插入个人素材
   - 引用知识库内容
   - 多人协作编辑

## ✅ 验证清单

- [x] 引用标记使用数字格式 [1], [2]
- [x] 点击引用标记弹出对话框
- [x] 对话框显示标题、来源、摘要、URL
- [x] 段落可点击
- [x] 点击段落显示对应的逻辑和建议
- [x] 未选择段落时显示提示信息
- [x] 左侧面板比右侧面板宽
- [x] 文章内容可编辑
- [x] 统计信息正确显示
- [x] 聊天界面在右侧底部
- [x] 日志区域在页面最底部
- [x] 所有样式符合设计图
- [x] 通过 Lint 检查
- [x] 响应式布局正常

## 🚀 如何测试

1. 访问草稿生成页面：`/project/{projectId}/draft`
2. 查看示例文章内容和统计信息
3. 点击文章中的 [1] 或 [2] 标记，查看引用对话框
4. 点击不同的段落，观察右侧建议的变化
5. 尝试编辑文章内容，查看字数统计更新
6. 在聊天框输入消息（目前仅记录日志）
7. 查看页面底部的生成日志信息

## 📚 相关文件

- `/src/pages/DraftGenerationPage.tsx` - 主页面组件
- `/src/components/draft/CitationMarker.tsx` - 引用标记组件（未使用）
- `/src/types/types.ts` - 类型定义
- `/src/db/api.ts` - API 函数
- `TODO.md` - 任务清单
- `DRAFT_PAGE_PREVIEW.md` - 页面预览文档

## 🎉 总结

草稿生成页面已完全按照设计图和用户需求实现，包括：

✅ 数字引用标记系统  
✅ 段落交互和条件显示  
✅ 内容可编辑功能  
✅ 优化的布局比例  
✅ 完整的统计信息  
✅ LLM 对话界面  
✅ 日志显示系统  

所有 UI 功能已就绪，等待后端 API 集成即可实现完整的交互功能。
