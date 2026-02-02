import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getMaterials, 
  createMaterial, 
  updateMaterial,
  deleteMaterial, 
  searchMaterials,
  parseDocument,
  summarizeContent,
  searchMaterialsByTags
} from '@/db/api';
import { supabase } from '@/db/supabase';
import type { Material } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Trash2, Edit, Upload, Loader2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const materialTypeLabels = {
  experience: '个人经历',
  opinion: '观点',
  case: '案例/实验',
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'experience' as Material['material_type'],
    content: '',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadMaterials();
  }, [user]);

  const loadMaterials = async () => {
    if (!user) return;
    try {
      const data = await getMaterials(user.id);
      setMaterials(data);
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
      loadMaterials();
      return;
    }

    try {
      const data = await searchMaterials(user.id, searchQuery);
      setMaterials(data);
    } catch (error) {
      toast({
        title: '搜索失败',
        variant: 'destructive',
      });
    }
  };

  const handleSearchByTags = async () => {
    if (!user || selectedTags.length === 0) {
      loadMaterials();
      return;
    }

    try {
      const data = await searchMaterialsByTags(user.id, selectedTags);
      setMaterials(data);
    } catch (error) {
      toast({
        title: '标签搜索失败',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: '不支持的文件类型',
        description: '请上传 .txt、.pdf 或 .docx 文件',
        variant: 'destructive',
      });
      return;
    }

    setUploadedFile(file);
    setParsing(true);

    try {
      // 上传文件到 Supabase Storage
      const fileName = `${user!.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cowrite-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cowrite-files')
        .getPublicUrl(fileName);

      // 解析文档内容
      let content = '';
      if (file.type === 'text/plain') {
        content = await file.text();
      } else {
        content = await parseDocument(publicUrl, file.type);
      }

      setNewMaterial({
        ...newMaterial,
        title: file.name.replace(/\.[^/.]+$/, ''),
        content,
      });

      toast({
        title: '文件上传成功',
        description: '请确认内容后保存',
      });
    } catch (error: any) {
      toast({
        title: '文件处理失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newMaterial.title.trim() || !newMaterial.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    setSummarizing(true);

    try {
      // 先调用 AI 生成摘要和标签
      const { summary, tags } = await summarizeContent(newMaterial.content);

      // 创建素材
      await createMaterial({
        user_id: user.id,
        title: newMaterial.title,
        material_type: newMaterial.type,
        content: newMaterial.content,
        summary,
        keywords: tags,
      });

      setNewMaterial({ title: '', type: 'experience', content: '' });
      setUploadedFile(null);
      setDialogOpen(false);
      await loadMaterials();
      
      toast({
        title: '创建成功',
        description: `已提取 ${tags.length} 个标签`,
      });
    } catch (error: any) {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
      setSummarizing(false);
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingMaterial) return;

    setCreating(true);
    setSummarizing(true);

    try {
      // 重新生成摘要和标签
      const { summary, tags } = await summarizeContent(editingMaterial.content);

      await updateMaterial(editingMaterial.id, {
        title: editingMaterial.title,
        content: editingMaterial.content,
        material_type: editingMaterial.material_type,
        summary,
        keywords: tags,
      });

      setEditDialogOpen(false);
      setEditingMaterial(null);
      await loadMaterials();
      
      toast({
        title: '更新成功',
        description: `已更新标签`,
      });
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
      setSummarizing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial(id);
      setMaterials(materials.filter((m) => m.id !== id));
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

  // 获取所有唯一标签
  const allTags = Array.from(
    new Set(materials.flatMap((m) => m.keywords || []))
  ).sort();

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
          <h1 className="text-3xl font-bold">素材库</h1>
          <p className="text-muted-foreground mt-2">管理您的个人素材</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建素材
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建素材</DialogTitle>
              <DialogDescription>添加个人经历、观点或案例，支持上传文件</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">上传文件（可选）</Label>
                <div className="flex gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    disabled={parsing}
                  />
                  {parsing && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  支持 .txt、.pdf、.docx 格式
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={newMaterial.title}
                  onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                  placeholder="输入素材标题"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">类型</Label>
                <Select
                  value={newMaterial.type}
                  onValueChange={(value) => setNewMaterial({ ...newMaterial, type: value as Material['material_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experience">个人经历</SelectItem>
                    <SelectItem value="opinion">观点</SelectItem>
                    <SelectItem value="case">案例/实验</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">内容</Label>
                <Textarea
                  id="content"
                  value={newMaterial.content}
                  onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                  rows={12}
                  placeholder="输入素材内容"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={creating || parsing}>
                {summarizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    AI 分析中...
                  </>
                ) : creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和筛选 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex gap-2">
                <Input
                  placeholder="搜索素材..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="mt-4">
              <Label className="mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                按标签筛选
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newTags = selectedTags.includes(tag)
                        ? selectedTags.filter((t) => t !== tag)
                        : [...selectedTags, tag];
                      setSelectedTags(newTags);
                      if (newTags.length > 0) {
                        searchMaterialsByTags(user!.id, newTags).then(setMaterials);
                      } else {
                        loadMaterials();
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 素材列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => (
          <Card key={material.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{material.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {materialTypeLabels[material.material_type]}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(material)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(material.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {material.summary && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {material.summary}
                </p>
              )}
              {material.keywords && material.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {material.keywords.map((keyword, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">暂无素材</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个素材
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑素材</DialogTitle>
            <DialogDescription>修改素材内容，保存时将重新生成标签</DialogDescription>
          </DialogHeader>
          {editingMaterial && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">标题</Label>
                <Input
                  id="edit-title"
                  value={editingMaterial.title}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">类型</Label>
                <Select
                  value={editingMaterial.material_type}
                  onValueChange={(value) => setEditingMaterial({ ...editingMaterial, material_type: value as Material['material_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experience">个人经历</SelectItem>
                    <SelectItem value="opinion">观点</SelectItem>
                    <SelectItem value="case">案例/实验</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">内容</Label>
                <Textarea
                  id="edit-content"
                  value={editingMaterial.content}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, content: e.target.value })}
                  rows={12}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={creating}>
              {summarizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  AI 分析中...
                </>
              ) : creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
