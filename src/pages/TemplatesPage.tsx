import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTemplates, createTemplate, deleteTemplate } from '@/db/api';
import type { Template } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    format: 'markdown',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    if (!user || !newTemplate.name.trim() || !newTemplate.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await createTemplate({
        user_id: user.id,
        name: newTemplate.name,
        content: newTemplate.content,
        format: newTemplate.format,
      });
      setNewTemplate({ name: '', content: '', format: 'markdown' });
      setDialogOpen(false);
      await loadTemplates();
      toast({
        title: '创建成功',
      });
    } catch (error) {
      toast({
        title: '创建失败',
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
          <p className="text-muted-foreground mt-2">管理您的文章模板</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新建模板</DialogTitle>
              <DialogDescription>创建文章格式模板</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">模板名称</Label>
                <Input
                  id="name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">格式</Label>
                <Select
                  value={newTemplate.format}
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, format: value })}
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="plain">纯文本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">模板内容</Label>
                <Textarea
                  id="content"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? '创建中...' : '创建'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 查看模板对话框 */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>查看模板</DialogTitle>
              <DialogDescription>模板详情</DialogDescription>
            </DialogHeader>
            {viewingTemplate && (
              <div className="space-y-4">
                <div>
                  <Label>模板名称</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {viewingTemplate.name}
                  </div>
                </div>
                <div>
                  <Label>格式</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {viewingTemplate.format}
                  </div>
                </div>
                <div>
                  <Label>模板内容</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <pre className="whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                      {viewingTemplate.content}
                    </pre>
                  </div>
                </div>
                {viewingTemplate.tags && viewingTemplate.tags.length > 0 && (
                  <div>
                    <Label>标签</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {viewingTemplate.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label>创建时间</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {new Date(viewingTemplate.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setViewDialogOpen(false)}>
                关闭
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card 
            key={template.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setViewingTemplate(template);
              setViewDialogOpen(true);
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">{template.format}</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(template.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground line-clamp-6 overflow-hidden">
                {template.content}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(template.created_at).toLocaleDateString('zh-CN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">暂无模板</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个模板</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </Card>
      )}
    </div>
  );
}
