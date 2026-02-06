# 修复说明文档

## 更新记录

### 2026-02-06 更新：添加实时搜索进度显示

用户反馈搜索失败时无法了解具体进度和失败原因，现已添加实时进度显示功能。

---

## 问题 1: 资料搜索失败错误显示不清晰 + 添加实时搜索进度显示

### 问题描述
1. 当资料搜索失败时，错误提示只显示 "Edge Function returned a non-2xx status code"，没有显示具体的错误原因
2. 搜索过程中用户无法看到当前进度，不知道系统正在做什么
3. 失败时不知道在哪个阶段失败的

### 解决方案

#### 1. 添加搜索进度状态管理

在 `KnowledgeStage.tsx` 中添加进度状态：

```typescript
const [searchProgress, setSearchProgress] = useState<{
  stage: string;
  message: string;
  details?: string;
} | null>(null);
```

#### 2. 在搜索流程中更新进度

在 `handleSearch` 函数的各个阶段更新进度信息：

```typescript
// 准备阶段
setSearchProgress({ stage: '准备中', message: '正在初始化搜索...' });

// 读取需求阶段
setSearchProgress({ stage: '读取需求', message: '正在读取需求文档...' });

// 资料查询阶段
setSearchProgress({ 
  stage: '资料查询', 
  message: '正在从 5 个数据源检索相关资料...',
  details: '数据源：Google Scholar、TheNews、Smart Search、参考文章库、个人素材库'
});

// 资料整理阶段
setSearchProgress({ 
  stage: '资料整理', 
  message: '正在整理检索结果...',
  details: `已检索到资料，正在分类整理`
});

// 保存资料阶段
setSearchProgress({ 
  stage: '保存资料', 
  message: `正在保存 ${allSources.length} 条资料到知识库...`
});

// 完成阶段
setSearchProgress({ 
  stage: '完成', 
  message: `搜索完成！已从 5 个数据源检索并整理了 ${allSources.length} 条资料`
});
```

#### 3. 改进错误处理

在错误处理中记录失败阶段和详细错误信息：

```typescript
catch (error: any) {
  console.error('搜索失败:', error);
  
  // 提取详细错误信息
  let errorMessage = '请稍后重试';
  let errorStage = '未知阶段';
  
  if (searchProgress) {
    errorStage = searchProgress.stage;
  }
  
  if (error?.message) {
    errorMessage = error.message;
  }
  
  // 如果是 Supabase Edge Function 错误，尝试提取更详细的信息
  if (error?.context) {
    try {
      const contextText = await error.context.text();
      if (contextText) {
        const contextJson = JSON.parse(contextText);
        errorMessage = contextJson.error || contextText;
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  setSearchProgress({ 
    stage: '失败', 
    message: `在 ${errorStage} 阶段失败`,
    details: errorMessage
  });
  
  toast({
    title: '❌ 资料检索失败',
    description: `${errorStage}：${errorMessage}`,
    variant: 'destructive',
  });
} finally {
  setSearching(false);
  // 3秒后清除进度信息
  setTimeout(() => setSearchProgress(null), 3000);
}
```

#### 4. 添加进度显示 UI

在搜索框下方添加实时进度显示卡片：

```typescript
{/* 搜索进度显示 */}
{searchProgress && (
  <Card className={`border-2 ${
    searchProgress.stage === '失败' 
      ? 'border-destructive bg-destructive/5' 
      : searchProgress.stage === '完成'
      ? 'border-primary bg-primary/5'
      : 'border-primary bg-primary/5'
  }`}>
    <CardContent className="pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {searchProgress.stage === '失败' ? (
              <span className="text-destructive text-lg">❌</span>
            ) : searchProgress.stage === '完成' ? (
              <span className="text-primary text-lg">✅</span>
            ) : (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            )}
            <span className="font-semibold text-sm">
              {searchProgress.stage}
            </span>
          </div>
          <Badge variant={
            searchProgress.stage === '失败' 
              ? 'destructive' 
              : searchProgress.stage === '完成'
              ? 'default'
              : 'secondary'
          }>
            {searchProgress.stage === '失败' ? '失败' : searchProgress.stage === '完成' ? '完成' : '进行中'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {searchProgress.message}
        </p>
        {searchProgress.details && (
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            {searchProgress.details}
          </p>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

### 功能特点

#### 1. 实时进度反馈
- **准备中**：初始化搜索
- **读取需求**：读取需求文档
- **资料查询**：从 5 个数据源检索（显示数据源列表）
- **资料整理**：整理检索结果
- **保存资料**：保存到知识库（显示数量）
- **完成**：显示最终结果

#### 2. 视觉反馈
- **进行中**：显示旋转加载动画
- **完成**：显示绿色 ✅ 图标和成功样式
- **失败**：显示红色 ❌ 图标和错误样式
- **状态徽章**：显示当前状态（进行中/完成/失败）

#### 3. 详细信息显示
- **主要消息**：当前阶段的简要说明
- **详细信息**：额外的上下文信息（如数据源列表、错误详情）
- **失败定位**：明确显示在哪个阶段失败
- **错误原因**：显示具体的错误消息

#### 4. 用户体验优化
- 进度信息在完成或失败后 3 秒自动消失
- 不同状态使用不同的颜色和图标
- 清晰的视觉层次和信息组织
- 响应式设计，适配不同屏幕尺寸

### 改进效果

#### 搜索过程透明化
用户可以实时看到：
1. 当前正在执行的步骤
2. 每个步骤的具体操作
3. 涉及的数据源和资源
4. 处理的数据量

#### 错误定位精确化
失败时用户可以看到：
1. 在哪个阶段失败（准备中/读取需求/资料查询/资料整理/保存资料）
2. 具体的错误原因（API密钥未配置/网络错误/数据格式错误等）
3. 可能的解决方案提示

#### 用户信心提升
- 不再是"黑盒"操作，用户知道系统在做什么
- 长时间操作时不会焦虑，能看到进度
- 失败时能快速定位问题，不需要反复尝试

---

## 问题 2: 参考文章库缺少编辑功能

### 问题描述
参考文章库中的文章只能查看和删除，无法编辑已录入的参考文章内容。

### 解决方案
在 `ReferencesPage.tsx` 中添加完整的编辑功能：

#### 1. 添加必要的状态和导入
```typescript
// 导入 Edit 图标
import { Plus, Search, Trash2, Link as LinkIcon, Upload, FileText, Edit } from 'lucide-react';

// 添加编辑相关状态
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [editingReference, setEditingReference] = useState<ReferenceArticle | null>(null);
const [updating, setUpdating] = useState(false);
```

#### 2. 添加编辑处理函数
```typescript
const handleEdit = (reference: ReferenceArticle) => {
  setEditingReference(reference);
  setEditDialogOpen(true);
};

const handleUpdate = async () => {
  if (!editingReference) return;

  if (!editingReference.title.trim() || !editingReference.content.trim()) {
    toast({
      title: '请填写标题和内容',
      variant: 'destructive',
    });
    return;
  }

  setUpdating(true);
  try {
    await updateReferenceArticle(editingReference.id, {
      title: editingReference.title,
      content: editingReference.content,
      source_type: editingReference.source_type || undefined,
      source_url: editingReference.source_url || undefined,
      keywords: editingReference.keywords || [],
    });

    await loadReferences();
    setEditDialogOpen(false);
    setEditingReference(null);

    toast({
      title: '更新成功',
    });
  } catch (error) {
    toast({
      title: '更新失败',
      variant: 'destructive',
    });
  } finally {
    setUpdating(false);
  }
};
```

#### 3. 在卡片中添加编辑按钮
在每个参考文章卡片的右上角添加编辑按钮（在删除按钮旁边）：

```typescript
<div className="flex gap-1">
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={(e) => {
      e.stopPropagation();
      handleEdit(reference);
    }}
  >
    <Edit className="h-4 w-4" />
  </Button>
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(reference.id);
    }}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

#### 4. 添加编辑对话框
创建一个完整的编辑对话框，允许用户修改：
- 标题
- 来源类型
- 来源链接
- 内容
- 关键词

```typescript
<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>编辑参考文章</DialogTitle>
      <DialogDescription>修改参考文章内容</DialogDescription>
    </DialogHeader>
    {editingReference && (
      <div className="space-y-4 py-4">
        {/* 标题输入框 */}
        <div className="space-y-2">
          <Label htmlFor="edit-title">标题 *</Label>
          <Input
            id="edit-title"
            placeholder="文章标题"
            value={editingReference.title}
            onChange={(e) => setEditingReference({ ...editingReference, title: e.target.value })}
          />
        </div>

        {/* 来源类型输入框 */}
        <div className="space-y-2">
          <Label htmlFor="edit-source-type">来源类型</Label>
          <Input
            id="edit-source-type"
            placeholder="例如：论文、博客、报告"
            value={editingReference.source_type || ''}
            onChange={(e) => setEditingReference({ ...editingReference, source_type: e.target.value })}
          />
        </div>

        {/* 来源链接输入框 */}
        <div className="space-y-2">
          <Label htmlFor="edit-source-url">来源链接</Label>
          <Input
            id="edit-source-url"
            placeholder="https://example.com"
            value={editingReference.source_url || ''}
            onChange={(e) => setEditingReference({ ...editingReference, source_url: e.target.value })}
          />
        </div>

        {/* 内容文本域 */}
        <div className="space-y-2">
          <Label htmlFor="edit-content">内容 *</Label>
          <Textarea
            id="edit-content"
            placeholder="文章内容"
            value={editingReference.content}
            onChange={(e) => setEditingReference({ ...editingReference, content: e.target.value })}
            rows={15}
          />
        </div>

        {/* 关键词输入框 */}
        <div className="space-y-2">
          <Label htmlFor="edit-keywords">关键词（用逗号分隔）</Label>
          <Input
            id="edit-keywords"
            placeholder="关键词1, 关键词2, 关键词3"
            value={editingReference.keywords?.join(', ') || ''}
            onChange={(e) => {
              const keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
              setEditingReference({ ...editingReference, keywords });
            }}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleUpdate} disabled={updating}>
            {updating ? '更新中...' : '保存'}
          </Button>
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
```

### 功能特点

1. **完整的编辑功能**：
   - 可以修改文章的所有字段
   - 保留原有的创建时间和用户ID
   - 支持关键词的编辑（逗号分隔）

2. **用户体验优化**：
   - 编辑按钮位于卡片右上角，与删除按钮并列
   - 点击编辑按钮打开编辑对话框，预填充当前内容
   - 提供清晰的加载状态（"更新中..."）
   - 操作成功后显示 toast 提示

3. **数据验证**：
   - 必填字段验证（标题和内容）
   - 关键词自动处理（去除空格、过滤空值）

4. **错误处理**：
   - 捕获更新失败的错误
   - 显示友好的错误提示

---

## 测试建议

### 测试问题 1（错误显示）
1. 尝试在没有配置 API 密钥的情况下搜索
2. 检查错误提示是否显示具体的错误原因
3. 验证错误信息是否清晰易懂

### 测试问题 2（编辑功能）
1. 在参考文章库中创建一篇测试文章
2. 点击编辑按钮，验证对话框是否正确打开
3. 修改标题、内容、关键词等字段
4. 保存后验证修改是否成功
5. 刷新页面，确认修改已持久化
6. 测试必填字段验证（尝试清空标题或内容）

---

## 相关文件

### 修改的文件
1. `src/components/workflow/KnowledgeStage.tsx` - 改进错误处理
2. `src/pages/ReferencesPage.tsx` - 添加编辑功能

### 使用的 API
- `updateReferenceArticle` (已存在于 `src/db/api.ts`)

---

## 注意事项

1. **错误处理**：
   - Edge Function 错误的 context 可能是异步的，需要使用 `await error.context.text()`
   - 解析 JSON 时要做好错误处理，避免二次错误

2. **编辑功能**：
   - 编辑时要阻止事件冒泡（`e.stopPropagation()`），避免触发卡片的点击事件
   - 关键词处理要过滤空值，避免保存空字符串
   - 更新成功后要重新加载列表，确保显示最新数据
