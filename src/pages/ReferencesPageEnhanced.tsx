import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getReferenceArticles,
  createReferenceArticle,
  deleteReferenceArticle,
  searchReferenceArticles,
  updateReferenceArticle,
  createMaterial
} from '@/api';
import { analyzeReferenceArticle, updateReferenceAnalysis } from '@/db/api';
import type { ReferenceArticle } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Trash2, Brain, FileText, Sparkles, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReferencesPageEnhanced() {
  const [references, setReferences] = useState<ReferenceArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceArticle | null>(null);
  const [editingReference, setEditingReference] = useState<ReferenceArticle | null>(null);
  const [newReference, setNewReference] = useState({
    title: '',
    content: '',
    sourceType: '',
    sourceUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadReferences();
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
        tags: [],
        keywords: [],
      });
      setNewReference({ title: '', content: '', sourceType: '', sourceUrl: '' });
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

  const handleView = (reference: ReferenceArticle) => {
    setSelectedReference(reference);
    setViewDialogOpen(true);
  };

  const handleEdit = (reference: ReferenceArticle) => {
    setEditingReference({ ...reference });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingReference || !editingReference.title.trim() || !editingReference.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      await updateReferenceArticle(editingReference.id, {
        title: editingReference.title,
        content: editingReference.content,
        source_type: editingReference.source_type,
        source_url: editingReference.source_url,
      });
      setEditDialogOpen(false);
      await loadReferences();
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

  const handleAnalyze = async (reference: ReferenceArticle) => {
    setAnalyzing(true);
    setSelectedReference(reference);
    setAnalysisDialogOpen(true);

    try {
      const analysis = await analyzeReferenceArticle(reference.title, reference.content);
      await updateReferenceAnalysis(reference.id, analysis);
      await loadReferences();
      
      // 更新当前选中的引用
      setSelectedReference({
        ...reference,
        ai_analysis: analysis,
        tags: analysis.tags || []
      });

      toast({
        title: 'AI 分析完成',
      });
    } catch (error) {
      toast({
        title: 'AI 分析失败',
        description: '请检查 API 配置',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddToMaterials = async (content: string, title: string) => {
    if (!user) return;

    try {
      await createMaterial({
        user_id: user.id,
        title: title,
        material_type: 'opinion',
        content: content,
        source: 'ai_generated',
        tags: [],
        status: 'unused',
        project_ids: [],
        keywords: [],
      });

      toast({
        title: '已加入素材库',
      });
    } catch (error) {
      toast({
        title: '加入失败',
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新建参考文章</DialogTitle>
              <DialogDescription>添加参考文章或资料</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                <Label htmlFor="sourceUrl">来源链接</Label>
                <Input
                  id="sourceUrl"
                  placeholder="https://..."
                  value={newReference.sourceUrl}
                  onChange={(e) => setNewReference({ ...newReference, sourceUrl: e.target.value })}
                />
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
                  <CardDescription className="mt-1 flex flex-wrap gap-1">
                    {reference.source_type && (
                      <Badge variant="outline">{reference.source_type}</Badge>
                    )}
                    {reference.ai_analysis && (
                      <Badge variant="secondary">
                        <Sparkles className="h-3 w-3 mr-1" />
                        已分析
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(reference.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{reference.content}</p>
              
              {reference.source_url && (
                <a 
                  href={reference.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mb-3 block"
                >
                  查看原文 →
                </a>
              )}

              {reference.tags && reference.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {reference.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleView(reference)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  查看
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(reference)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  编辑
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleAnalyze(reference)}
                  disabled={analyzing}
                >
                  <Brain className="h-3 w-3 mr-1" />
                  AI 整理
                </Button>
                {reference.ai_analysis && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedReference(reference);
                      setAnalysisDialogOpen(true);
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    查看分析
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
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

      {/* AI 分析结果对话框 */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 分析结果</DialogTitle>
            <DialogDescription>{selectedReference?.title}</DialogDescription>
          </DialogHeader>
          
          {analyzing ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">AI 分析中...</p>
              </div>
            </div>
          ) : selectedReference?.ai_analysis ? (
            <div className="space-y-6 py-4">
              {/* 核心观点 */}
              {selectedReference.ai_analysis.core_points && selectedReference.ai_analysis.core_points.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">核心观点</h3>
                  <div className="space-y-2">
                    {selectedReference.ai_analysis.core_points.map((point, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm flex-1">{point}</p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleAddToMaterials(point, `观点 ${index + 1}`)}
                            >
                              加入素材库
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* 文章结构 */}
              {selectedReference.ai_analysis.structure && (
                <div>
                  <h3 className="font-semibold mb-3">文章结构</h3>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-3 text-sm">
                        {selectedReference.ai_analysis.structure.introduction && (
                          <div>
                            <p className="font-medium">引言</p>
                            <p className="text-muted-foreground">{selectedReference.ai_analysis.structure.introduction}</p>
                          </div>
                        )}
                        {selectedReference.ai_analysis.structure.main_sections && (
                          <div>
                            <p className="font-medium">主要章节</p>
                            <ul className="list-disc list-inside text-muted-foreground">
                              {selectedReference.ai_analysis.structure.main_sections.map((section: string, index: number) => (
                                <li key={index}>{section}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedReference.ai_analysis.structure.conclusion && (
                          <div>
                            <p className="font-medium">结论</p>
                            <p className="text-muted-foreground">{selectedReference.ai_analysis.structure.conclusion}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Separator />

              {/* 可借鉴段落 */}
              {selectedReference.ai_analysis.borrowable_segments && selectedReference.ai_analysis.borrowable_segments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">可借鉴段落</h3>
                  <div className="space-y-2">
                    {selectedReference.ai_analysis.borrowable_segments.map((segment: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <p className="text-sm mb-2">{segment.content}</p>
                          <p className="text-xs text-muted-foreground mb-3">适用场景：{segment.usage}</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAddToMaterials(segment.content, `借鉴段落 ${index + 1}`)}
                          >
                            加入素材库
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              暂无分析结果
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 查看对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReference?.title}</DialogTitle>
            <DialogDescription>
              {selectedReference?.source_type && `来源：${selectedReference.source_type}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReference?.source_url && (
              <div>
                <Label>原文链接</Label>
                <a 
                  href={selectedReference.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline block mt-1"
                >
                  {selectedReference.source_url}
                </a>
              </div>
            )}
            <div>
              <Label>内容</Label>
              <div className="mt-2 p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">
                {selectedReference?.content}
              </div>
            </div>
            {selectedReference?.tags && selectedReference.tags.length > 0 && (
              <div>
                <Label>标签</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedReference.tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑文章</DialogTitle>
            <DialogDescription>修改参考文章的内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">标题</Label>
              <Input
                id="edit-title"
                value={editingReference?.title || ''}
                onChange={(e) => setEditingReference(editingReference ? { ...editingReference, title: e.target.value } : null)}
                placeholder="请输入标题"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">内容</Label>
              <Textarea
                id="edit-content"
                value={editingReference?.content || ''}
                onChange={(e) => setEditingReference(editingReference ? { ...editingReference, content: e.target.value } : null)}
                placeholder="请输入内容"
                rows={15}
              />
            </div>
            <div>
              <Label htmlFor="edit-source-type">来源类型</Label>
              <Input
                id="edit-source-type"
                value={editingReference?.source_type || ''}
                onChange={(e) => setEditingReference(editingReference ? { ...editingReference, source_type: e.target.value } : null)}
                placeholder="例如：学术论文、博客文章等"
              />
            </div>
            <div>
              <Label htmlFor="edit-source-url">来源链接</Label>
              <Input
                id="edit-source-url"
                value={editingReference?.source_url || ''}
                onChange={(e) => setEditingReference(editingReference ? { ...editingReference, source_url: e.target.value } : null)}
                placeholder="请输入原文链接"
              />
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
