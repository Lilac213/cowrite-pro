import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getReferenceArticles, createReferenceArticle, deleteReferenceArticle, searchReferenceArticles, getProjects } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { ReferenceArticle, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Trash2, Link as LinkIcon, Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReferencesPage() {
  const [references, setReferences] = useState<ReferenceArticle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputMethod, setInputMethod] = useState<'url' | 'file' | 'text'>('text');
  const [newReference, setNewReference] = useState({
    title: '',
    content: '',
    sourceType: '',
    sourceUrl: '',
    projectId: '',
  });
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadReferences();
    loadProjects();
  }, [user]);

  const loadReferences = async () => {
    if (!user) return;
    try {
      const data = await getReferenceArticles(user.id);
      setReferences(data);
    } catch (error) {
      toast({
        title: '加载失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!user) return;
    try {
      const data = await getProjects(user.id);
      setProjects(data);
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const handleExtractUrl = async () => {
    if (!newReference.sourceUrl.trim()) {
      toast({
        title: '请输入 URL',
        variant: 'destructive',
      });
      return;
    }

    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-url-content', {
        body: { url: newReference.sourceUrl },
      });

      if (error) throw error;

      setNewReference({
        ...newReference,
        title: data.title || '无标题',
        content: data.content || '',
      });

      toast({
        title: '提取成功',
        description: '已从 URL 提取内容',
      });
    } catch (error: any) {
      toast({
        title: '提取失败',
        description: error.message || '无法从 URL 提取内容',
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制文件大小为 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '文件过大',
        description: '文件大小不能超过 5MB',
        variant: 'destructive',
      });
      return;
    }

    // 只支持文本文件
    if (!file.type.startsWith('text/') && !file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      toast({
        title: '不支持的文件类型',
        description: '只支持文本文件（.txt, .md）',
        variant: 'destructive',
      });
      return;
    }

    try {
      const content = await file.text();
      setNewReference({
        ...newReference,
        title: file.name.replace(/\.[^/.]+$/, ''),
        content,
      });

      toast({
        title: '文件上传成功',
      });
    } catch (error) {
      toast({
        title: '文件读取失败',
        variant: 'destructive',
      });
    }
  };

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) {
      loadReferences();
      return;
    }

    try {
      const data = await searchReferenceArticles(user.id, searchQuery);
      setReferences(data);
    } catch (error) {
      toast({
        title: '搜索失败',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    if (!user || !newReference.title.trim() || !newReference.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await createReferenceArticle({
        user_id: user.id,
        title: newReference.title,
        content: newReference.content,
        source_type: newReference.sourceType || undefined,
        source_url: newReference.sourceUrl || undefined,
        project_id: newReference.projectId || undefined,
        keywords: [],
      });
      setNewReference({ title: '', content: '', sourceType: '', sourceUrl: '', projectId: '' });
      setDialogOpen(false);
      await loadReferences();
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
      await deleteReferenceArticle(id);
      setReferences(references.filter((r) => r.id !== id));
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
          <h1 className="text-3xl font-bold">参考文章库</h1>
          <p className="text-muted-foreground mt-2">管理您的参考文章</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建参考文章
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建参考文章</DialogTitle>
              <DialogDescription>添加参考文章或资料</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'url' | 'file' | 'text')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="url">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    URL 链接
                  </TabsTrigger>
                  <TabsTrigger value="file">
                    <Upload className="h-4 w-4 mr-2" />
                    上传文件
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <FileText className="h-4 w-4 mr-2" />
                    直接输入
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">文章链接</Label>
                    <div className="flex gap-2">
                      <Input
                        id="url"
                        placeholder="https://example.com/article"
                        value={newReference.sourceUrl}
                        onChange={(e) => setNewReference({ ...newReference, sourceUrl: e.target.value })}
                      />
                      <Button onClick={handleExtractUrl} disabled={extracting}>
                        {extracting ? '提取中...' : '提取'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      输入文章 URL，系统将自动提取标题和内容
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">上传文件</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".txt,.md,text/*"
                      onChange={handleFileUpload}
                    />
                    <p className="text-xs text-muted-foreground">
                      支持 .txt 和 .md 文件，最大 5MB
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    直接在下方输入文章标题和内容
                  </p>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={newReference.title}
                  onChange={(e) => setNewReference({ ...newReference, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceType">来源类型</Label>
                <Input
                  id="sourceType"
                  placeholder="例如：博客、论文、新闻"
                  value={newReference.sourceType}
                  onChange={(e) => setNewReference({ ...newReference, sourceType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">关联项目（可选）</Label>
                <Select
                  value={newReference.projectId || 'none'}
                  onValueChange={(value) => setNewReference({ ...newReference, projectId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联项目</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  关联到项目后，可在项目中直接使用此参考文章
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">内容</Label>
                <Textarea
                  id="content"
                  value={newReference.content}
                  onChange={(e) => setNewReference({ ...newReference, content: e.target.value })}
                  rows={10}
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
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="搜索参考文章..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {references.map((reference) => (
          <Card key={reference.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{reference.title}</CardTitle>
                  {reference.source_type && (
                    <CardDescription className="mt-1">{reference.source_type}</CardDescription>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(reference.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-4">{reference.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(reference.created_at).toLocaleDateString('zh-CN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {references.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">暂无参考文章</h3>
          <p className="text-muted-foreground mb-6">创建您的第一篇参考文章</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建参考文章
          </Button>
        </Card>
      )}
    </div>
  );
}
