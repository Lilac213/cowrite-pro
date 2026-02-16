import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTemplates, createTemplate, deleteTemplate, updateTemplate, generateTemplateRules } from '@/api';
import type { Template } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Sparkles, FileText, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TemplatesPageEnhanced() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [createMode, setCreateMode] = useState<'manual' | 'ai'>('ai');
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    content: '',
    format: 'markdown',
  });
  const [aiDescription, setAiDescription] = useState('');
  const [generatedRules, setGeneratedRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const data = await getTemplates(user.id);
      setTemplates(data);
    } catch (error) {
      toast({
        title: '加载失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRules = async () => {
    if (!aiDescription.trim()) {
      toast({
        title: '请输入格式描述',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const rules = await generateTemplateRules(aiDescription);
      setGeneratedRules(rules);
      
      // 自动填充模板名称
      if (!newTemplate.name) {
        setNewTemplate({
          ...newTemplate,
          name: '自动生成的模板',
          description: aiDescription,
        });
      }

      toast({
        title: 'AI 生成成功',
        description: '请预览并调整模板',
      });
    } catch (error) {
      toast({
        title: 'AI 生成失败',
        description: '请检查 API 配置',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newTemplate.name.trim()) {
      toast({
        title: '请填写模板名称',
        variant: 'destructive',
      });
      return;
    }

    if (createMode === 'manual' && !newTemplate.content.trim()) {
      toast({
        title: '请填写模板内容',
        variant: 'destructive',
      });
      return;
    }

    if (createMode === 'ai' && !generatedRules) {
      toast({
        title: '请先生成模板规则',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      let finalRules = generatedRules;
      
      // 如果是手动模式，检查内容是否为自然语言，如果是则转换为JSON
      if (createMode === 'manual' && newTemplate.content.trim()) {
        // 尝试解析为JSON，如果失败则认为是自然语言
        try {
          JSON.parse(newTemplate.content);
          // 如果能解析，说明已经是JSON格式，直接使用
        } catch {
          // 无法解析为JSON，说明是自然语言，需要转换
          toast({
            title: '正在转换格式...',
            description: '使用AI将自然语言转换为结构化格式',
          });
          finalRules = await generateTemplateRules(newTemplate.content);
        }
      }
      
      await createTemplate({
        user_id: user.id,
        name: newTemplate.name,
        description: newTemplate.description || undefined,
        content: newTemplate.content || '# 模板内容\n\n此模板由 AI 生成',
        format: newTemplate.format,
        rules: finalRules,
        preview_content: '预览内容',
      });
      
      setNewTemplate({ name: '', description: '', content: '', format: 'markdown' });
      setAiDescription('');
      setGeneratedRules(null);
      setDialogOpen(false);
      await loadTemplates();
      
      toast({
        title: '创建成功',
      });
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
      toast({
        title: '删除成功',
      });
    } catch (error) {
      toast({
        title: '删除失败',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate({ ...template });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) {
      toast({
        title: '请填写模板名称',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      let finalRules = editingTemplate.rules;
      
      // 检查内容是否为自然语言，如果是则转换为JSON
      if (editingTemplate.content && editingTemplate.content.trim()) {
        try {
          JSON.parse(editingTemplate.content);
          // 如果能解析，说明已经是JSON格式
        } catch {
          // 无法解析为JSON，说明是自然语言，需要转换
          toast({
            title: '正在转换格式...',
            description: '使用AI将自然语言转换为结构化格式',
          });
          finalRules = await generateTemplateRules(editingTemplate.content);
        }
      }
      
      await updateTemplate(editingTemplate.id, {
        name: editingTemplate.name,
        description: editingTemplate.description,
        content: editingTemplate.content,
        rules: finalRules,
      });
      setEditDialogOpen(false);
      await loadTemplates();
      toast({
        title: '更新成功',
      });
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">模板管理</h1>
          <p className="text-muted-foreground mt-2">管理您的格式模板</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建模板</DialogTitle>
              <DialogDescription>使用 AI 辅助生成或手动创建格式模板</DialogDescription>
            </DialogHeader>
            
            <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as 'manual' | 'ai')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI 辅助生成
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <FileText className="h-4 w-4 mr-2" />
                  手动创建
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-description">格式描述</Label>
                  <Textarea
                    id="ai-description"
                    placeholder="例如：本科毕业论文格式：标题三号黑体居中，摘要四号宋体，正文小四号宋体1.5倍行距，一级标题三号黑体，二级标题四号黑体，三级标题小四号黑体，参考文献五号宋体，页边距上下2.54cm左右3.17cm"
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    用自然语言描述您的格式要求，AI 将自动转换为结构化规则
                  </p>
                </div>

                <Button onClick={handleGenerateRules} disabled={generating} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? 'AI 生成中...' : 'AI 生成模板规则'}
                </Button>

                {generatedRules && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">生成的规则</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                        {JSON.stringify(generatedRules, null, 2)}
                      </pre>
                      {generatedRules.issues && generatedRules.issues.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">需要补充的信息：</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {generatedRules.issues.map((issue: string, index: number) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="template-name">模板名称</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="例如：本科毕业论文模板"
                  />
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">模板名称</Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="简要描述模板用途"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">模板内容</Label>
                  <Textarea
                    id="content"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    rows={12}
                    placeholder="可以输入自然语言描述（如：本科毕业论文格式：标题三号黑体居中...）或JSON格式"
                  />
                  <p className="text-xs text-muted-foreground">
                    支持自然语言描述，创建时将自动转换为结构化格式
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? '创建中...' : '创建模板'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="outline">{template.format}</Badge>
                {template.rules && (
                  <Badge variant="secondary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI 生成
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setPreviewDialogOpen(true);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  预览
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  编辑
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                {new Date(template.created_at).toLocaleDateString('zh-CN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">暂无模板</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个格式模板</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </Card>
      )}

      {/* 预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            {selectedTemplate?.description && (
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            )}
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-6 py-4">
              {selectedTemplate.rules && (
                <div>
                  <h3 className="font-semibold mb-3">格式规则</h3>
                  <Card>
                    <CardContent className="pt-4">
                      <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                        {JSON.stringify(selectedTemplate.rules, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3">模板内容</h3>
                <Card>
                  <CardContent className="pt-4">
                    <pre className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑模板</DialogTitle>
            <DialogDescription>修改模板的内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">模板名称</Label>
              <Input
                id="edit-name"
                value={editingTemplate?.name || ''}
                onChange={(e) => setEditingTemplate(editingTemplate ? { ...editingTemplate, name: e.target.value } : null)}
                placeholder="请输入模板名称"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">描述</Label>
              <Input
                id="edit-description"
                value={editingTemplate?.description || ''}
                onChange={(e) => setEditingTemplate(editingTemplate ? { ...editingTemplate, description: e.target.value } : null)}
                placeholder="请输入描述"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">模板内容</Label>
              <Textarea
                id="edit-content"
                value={editingTemplate?.content || ''}
                onChange={(e) => setEditingTemplate(editingTemplate ? { ...editingTemplate, content: e.target.value } : null)}
                placeholder="可以输入自然语言描述（如：本科毕业论文格式：标题三号黑体居中...）或JSON格式"
                rows={15}
              />
              <p className="text-xs text-muted-foreground mt-1">
                支持自然语言描述，保存时将自动转换为结构化格式
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={updating}>
                {updating ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
