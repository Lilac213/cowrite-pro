# 修复说明文档

## 问题 1: 资料搜索失败错误显示不清晰

### 问题描述
当资料搜索失败时，错误提示只显示 "Edge Function returned a non-2xx status code"，没有显示具体的错误原因，用户无法了解失败的真正原因。

### 解决方案
更新 `KnowledgeStage.tsx` 中的错误处理逻辑：

1. **提取详细错误信息**：
   - 首先尝试从 `error.message` 获取错误信息
   - 如果是 Supabase Edge Function 错误，尝试从 `error.context` 中提取更详细的错误信息
   - 解析 JSON 格式的错误响应，获取实际的错误消息

2. **改进的错误处理代码**：
```typescript
catch (error: any) {
  console.error('搜索失败:', error);
  
  // 提取详细错误信息
  let errorMessage = '请稍后重试';
  
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
  
  toast({
    title: '❌ 资料检索失败',
    description: errorMessage,
    variant: 'destructive',
  });
}
```

3. **改进效果**：
   - 用户现在可以看到具体的错误原因（如 "API密钥未配置"、"缺少需求文档" 等）
   - 更容易定位和解决问题
   - 提供更好的用户体验

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
