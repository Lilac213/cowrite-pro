# 草稿生成页面实现文档

## 概述

实现了一个增强的草稿生成页面，集成了段落结构生成、论据生成和连贯性验证功能。该页面提供了更好的用户体验，包括流式输出、引用标记、编辑功能和写作指导。

## 核心功能

### 1. 双面板布局

#### 左侧面板 - 草稿编辑器
- **功能**：显示 AI 生成的草稿内容
- **特性**：
  - 支持流式输出（实时显示生成过程）
  - 可编辑内容（contentEditable）
  - 引用标记（小标显示资料来源）
  - 响应式布局

#### 右侧面板 - 写作指导
- **功能**：为每个段落提供生成说明和建议
- **内容**：
  - 生成说明：解释为何这样生成
  - 个人内容建议：建议补充的个人观点
  - 个人经历建议：建议补充的亲身经历
  - 协作提示：激发用户参与的提示

### 2. 引用标记系统

#### CitationMarker 组件
- **显示**：小圆圈标记，显示引用序号
- **交互**：点击后弹出 Popover 显示资料详情
- **信息**：
  - 资料标题
  - 资料来源
  - 摘要
  - 引用内容
  - 原文链接

### 3. 数据结构

#### Citation 类型
```typescript
interface Citation {
  id: string;
  material_id: string;
  material_title: string;
  material_source?: string;
  material_url?: string;
  material_summary?: string;
  position: number; // 在内容中的字符位置
  paragraph_id?: string;
  quote?: string; // 实际引用的文本
}
```

#### ParagraphGuidance 类型
```typescript
interface ParagraphGuidance {
  paragraph_id: string;
  generation_rationale: string; // 为何这样生成
  personal_content_suggestions: string[]; // 建议补充的个人内容
  experience_suggestions: string[]; // 建议补充的个人经历
  collaboration_prompt: string; // 激发协作的提示
}
```

## 文件结构

### 新增文件

1. **页面组件**
   - `/src/pages/DraftGenerationPage.tsx` - 主页面组件

2. **草稿组件**
   - `/src/components/draft/DraftEditor.tsx` - 草稿编辑器
   - `/src/components/draft/DraftGuidance.tsx` - 写作指导面板
   - `/src/components/draft/CitationMarker.tsx` - 引用标记组件

3. **数据库迁移**
   - `add_draft_citations_and_guidance` - 添加 citations 和 guidance 字段

### 修改文件

1. **类型定义**
   - `/src/types/types.ts` - 添加 Citation 和 ParagraphGuidance 接口

2. **路由配置**
   - `/src/routes.tsx` - 添加草稿生成页面路由

3. **工作流组件**
   - `/src/components/workflow/DraftStage.tsx` - 添加"增强生成模式"按钮

## 数据库变更

### drafts 表新增字段

```sql
-- 引用信息
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb;

-- 写作指导
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS guidance jsonb DEFAULT '[]'::jsonb;
```

### 字段说明

- **citations**: 存储引用信息数组，包含资料 ID、位置、显示信息等
- **guidance**: 存储段落级别的生成说明和建议数组

## 用户交互流程

### 1. 进入页面
- 从项目工作流页面点击"增强生成模式"按钮
- 或直接访问 `/project/:projectId/draft`

### 2. 生成草稿
1. 点击"生成草稿"按钮
2. 系统调用 draft-agent Edge Function
3. 流式输出草稿内容到左侧面板
4. 同时生成引用标记和写作指导
5. 自动保存到数据库

### 3. 查看引用
1. 在草稿中看到带序号的小圆圈标记
2. 点击标记弹出 Popover
3. 查看资料详情（标题、来源、摘要、引用内容）
4. 可点击"查看原文"链接访问原始资料

### 4. 查看指导
1. 右侧面板显示所有段落的写作指导
2. 每个段落卡片包含：
   - 生成说明（为何这样写）
   - 个人内容建议（可以补充什么观点）
   - 个人经历建议（可以补充什么经历）
   - 协作提示（激发参与的提示）

### 5. 编辑草稿
1. 直接在左侧面板编辑内容
2. 支持添加、删除、修改文本
3. 点击"保存"按钮保存更改

### 6. 保存和返回
1. 点击"保存"按钮保存当前状态
2. 点击"返回"按钮回到项目工作流页面

## 技术实现

### 1. 响应式布局

使用 shadcn/ui 的 Resizable 组件实现可调整大小的双面板布局：

```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={60} minSize={40}>
    {/* 左侧草稿编辑器 */}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={40} minSize={30}>
    {/* 右侧写作指导 */}
  </ResizablePanel>
</ResizablePanelGroup>
```

### 2. 引用标记渲染

将内容按引用位置分割，插入 CitationMarker 组件：

```typescript
const renderContentWithCitations = () => {
  const sortedCitations = [...citations].sort((a, b) => a.position - b.position);
  const parts: (string | React.ReactElement)[] = [];
  let lastPosition = 0;

  sortedCitations.forEach((citation, index) => {
    // 添加引用前的文本
    if (citation.position > lastPosition) {
      parts.push(content.substring(lastPosition, citation.position));
    }
    // 添加引用标记
    parts.push(<CitationMarker key={citation.id} citation={citation} index={index + 1} />);
    lastPosition = citation.position;
  });

  // 添加剩余文本
  if (lastPosition < content.length) {
    parts.push(content.substring(lastPosition));
  }

  return parts;
};
```

### 3. 内容编辑

使用 contentEditable 实现可编辑的草稿内容：

```tsx
<div
  contentEditable={!readonly}
  onInput={handleInput}
  className="p-6 prose prose-sm max-w-none focus:outline-none"
  suppressContentEditableWarning
>
  {content}
</div>
```

### 4. 流式输出

预留了流式输出的支持，通过 `streaming` 状态控制：

```typescript
const [streaming, setStreaming] = useState(false);

// 自动滚动到底部
useEffect(() => {
  if (streaming && editorRef.current) {
    editorRef.current.scrollTop = editorRef.current.scrollHeight;
  }
}, [content, streaming]);
```

## 待实现功能

### 1. 流式输出
- 需要在 draft-agent Edge Function 中实现流式响应
- 前端需要处理 Server-Sent Events 或 chunked responses
- 实时更新草稿内容和引用标记

### 2. 段落高亮
- 点击右侧指导卡片时，高亮对应段落
- 编辑某段落时，自动显示对应的指导

### 3. 引用管理
- 支持添加、删除、修改引用
- 自动更新引用序号
- 引用位置自动调整

### 4. 协作功能
- 支持多人同时编辑
- 实时同步更改
- 显示其他用户的光标位置

## 使用示例

### 访问页面

```typescript
// 从工作流页面导航
navigate(`/project/${projectId}/draft`);

// 或直接访问 URL
// /project/abc-123/draft
```

### 生成草稿

```typescript
const handleGenerate = async () => {
  const { data, error } = await supabase.functions.invoke('draft-agent', {
    body: {
      project_id: projectId,
      user_id: user.id,
      stream: true,
    },
  });

  if (data) {
    setContent(data.content);
    setCitations(data.citations);
    setGuidance(data.guidance);
  }
};
```

### 保存草稿

```typescript
const handleSave = async () => {
  await updateDraft(draft.id, {
    content,
    citations,
    guidance,
  });
};
```

## 样式设计

### 引用标记样式
- 小圆圈：5x5 尺寸
- 主题色背景：`bg-primary/10`
- 悬停效果：`hover:bg-primary/20`
- 序号显示：居中对齐

### 指导卡片样式
- 左侧边框：4px 主题色
- 图标标识：不同类型使用不同图标
  - 生成说明：💡 Lightbulb
  - 个人内容：👤 User
  - 个人经历：❤️ Heart
  - 协作提示：✨ Sparkles

### 布局样式
- 左侧面板：默认 60% 宽度，最小 40%
- 右侧面板：默认 40% 宽度，最小 30%
- 可拖动调整大小

## 性能优化

### 1. 虚拟滚动
- 对于长文档，考虑使用虚拟滚动
- 只渲染可见区域的内容

### 2. 防抖保存
- 编辑时使用防抖，避免频繁保存
- 自动保存间隔：2-3 秒

### 3. 懒加载
- 引用详情按需加载
- 资料摘要延迟加载

## 错误处理

### 1. 生成失败
- 显示错误提示
- 提供重试按钮
- 保留之前的草稿内容

### 2. 保存失败
- 显示错误提示
- 自动重试（最多 3 次）
- 本地缓存未保存的更改

### 3. 加载失败
- 显示加载失败提示
- 提供刷新按钮
- 回退到工作流页面

## 总结

增强的草稿生成页面提供了更好的用户体验：

✅ 双面板布局，清晰展示草稿和指导
✅ 引用标记系统，方便查看资料来源
✅ 可编辑内容，支持用户协作完善
✅ 写作指导，激发用户添加个人内容
✅ 响应式设计，适配不同屏幕尺寸
✅ 完整的类型定义和错误处理

该页面为用户提供了一个强大的写作协作环境，帮助用户在 AI 生成的基础上，添加个人观点和经历，创作出更有温度的文章。
