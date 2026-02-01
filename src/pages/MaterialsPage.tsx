import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMaterials, createMaterial, deleteMaterial, searchMaterials } from '@/db/api';
import type { Material } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Trash2 } from 'lucide-react';
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
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'experience' as Material['material_type'],
    content: '',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    if (!user || !newMaterial.title.trim() || !newMaterial.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await createMaterial({
        user_id: user.id,
        title: newMaterial.title,
        material_type: newMaterial.type,
        content: newMaterial.content,
        keywords: [],
      });
      setNewMaterial({ title: '', type: 'experience', content: '' });
      setDialogOpen(false);
      await loadMaterials();
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建素材</DialogTitle>
              <DialogDescription>添加个人经历、观点或案例</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={newMaterial.title}
                  onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">类型</Label>
                <Select
                  value={newMaterial.type}
                  onValueChange={(value) => setNewMaterial({ ...newMaterial, type: value as Material['material_type'] })}
                >
                  <SelectTrigger id="type">
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
                  rows={6}
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
              placeholder="搜索素材..."
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => (
          <Card key={material.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{material.title}</CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant="outline">{materialTypeLabels[material.material_type]}</Badge>
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(material.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">{material.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(material.created_at).toLocaleDateString('zh-CN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">暂无素材</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个素材</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建素材
          </Button>
        </Card>
      )}
    </div>
  );
}
