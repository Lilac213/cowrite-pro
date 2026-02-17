import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMaterials,
  createMaterial,
  deleteMaterial,
  updateMaterial,
  searchMaterials,
  getProjects
} from '@/api';
import { linkMaterialToProjects, updateMaterialTags, organizeMaterials } from '@/db/api';
import type { Material, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Trash2, Brain, Link as LinkIcon, Tag, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const materialTypeLabels = {
  experience: '个人经历',
  opinion: '观点',
  case: '案例/实验',
};

const materialStatusLabels = {
  unused: '未使用',
  used: '已使用',
  in_project: '已加入项目',
};

export default function MaterialsPageEnhanced() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [newTags, setNewTags] = useState('');
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'experience' as Material['material_type'],
    content: '',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // 获取所有唯一标签
  const allTags = Array.from(new Set(materials.flatMap(m => m.tags || [])));

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [materialsData, projectsData] = await Promise.all([
        getMaterials(user.id),
        getProjects(user.id)
      ]);
      setMaterials(materialsData);
      setProjects(projectsData);
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
      loadData();
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
        source: 'manual',
        tags: [],
        status: 'unused',
        project_ids: [],
        keywords: [],
      });
      setNewMaterial({ title: '', type: 'experience', content: '' });
      setDialogOpen(false);
      await loadData();
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

  const handleView = (material: Material) => {
    setSelectedMaterial(material);
    setViewDialogOpen(true);
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial({ ...material });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingMaterial || !editingMaterial.title.trim() || !editingMaterial.content.trim()) {
      toast({
        title: '请填写完整信息',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      await updateMaterial(editingMaterial.id, {
        title: editingMaterial.title,
        content: editingMaterial.content,
        material_type: editingMaterial.material_type,
        source: editingMaterial.source,
      });
      setEditDialogOpen(false);
      await loadData();
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

  const handleLinkProjects = async () => {
    if (!selectedMaterial) return;

    try {
      await linkMaterialToProjects(selectedMaterial.id, selectedProjects);
      await loadData();
      setLinkDialogOpen(false);
      setSelectedMaterial(null);
      setSelectedProjects([]);
      toast({
        title: '关联成功',
      });
    } catch (error) {
      toast({
        title: '关联失败',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateTags = async () => {
    if (!selectedMaterial) return;

    const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
    try {
      await updateMaterialTags(selectedMaterial.id, tags);
      await loadData();
      setTagDialogOpen(false);
      setSelectedMaterial(null);
      setNewTags('');
      toast({
        title: '标签更新成功',
      });
    } catch (error) {
      toast({
        title: '标签更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleOrganize = async () => {
    if (materials.length === 0) {
      toast({
        title: '没有素材可整理',
        variant: 'destructive',
      });
      return;
    }

    setOrganizing(true);
    try {
      const result = await organizeMaterials(materials);
      
      // 显示整理建议
      toast({
        title: 'AI 整理完成',
        description: `发现 ${result.similar_groups?.length || 0} 组相似素材，${result.article_suggestions?.length || 0} 个文章建议`,
      });

      // 这里可以展示更详细的整理结果
      console.log('AI 整理结果:', result);
    } catch (error) {
      toast({
        title: 'AI 整理失败',
        description: '请检查 API 配置',
        variant: 'destructive',
      });
    } finally {
      setOrganizing(false);
    }
  };

  // 筛选素材
  const filteredMaterials = materials.filter(m => {
    if (filterTag && filterTag !== 'all' && !(m.tags || []).includes(filterTag)) return false;
    if (filterStatus && filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOrganize} disabled={organizing}>
            <Brain className="h-4 w-4 mr-2" />
            {organizing ? 'AI 整理中...' : 'AI 整理'}
          </Button>
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
      </div>

      {/* 搜索和筛选 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
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
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="按标签筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部标签</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="按状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="unused">未使用</SelectItem>
                <SelectItem value="used">已使用</SelectItem>
                <SelectItem value="in_project">已加入项目</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 素材列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMaterials.map((material) => (
          <Card key={material.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{material.title}</CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{materialTypeLabels[material.material_type]}</Badge>
                    <Badge variant="secondary">{materialStatusLabels[material.status || 'unused']}</Badge>
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(material.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{material.content}</p>
              
              {/* 标签 */}
              {material.tags && material.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {material.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* 关联项目数 */}
              {material.project_ids && material.project_ids.length > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  已关联 {material.project_ids.length} 个项目
                </p>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleView(material)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  查看
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(material)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  编辑
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedMaterial(material);
                    setSelectedProjects(material.project_ids || []);
                    setLinkDialogOpen(true);
                  }}
                >
                  <LinkIcon className="h-3 w-3 mr-1" />
                  关联项目
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedMaterial(material);
                    setNewTags((material.tags || []).join(', '));
                    setTagDialogOpen(true);
                  }}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  标签
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                {new Date(material.created_at).toLocaleDateString('zh-CN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMaterials.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">暂无素材</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个素材</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建素材
          </Button>
        </Card>
      )}

      {/* 关联项目对话框 */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关联项目</DialogTitle>
            <DialogDescription>选择要关联的项目</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {projects.map(project => (
              <div key={project.id} className="flex items-center space-x-2">
                <Checkbox
                  id={project.id}
                  checked={selectedProjects.includes(project.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProjects([...selectedProjects, project.id]);
                    } else {
                      setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                    }
                  }}
                />
                <label
                  htmlFor={project.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {project.title}
                </label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleLinkProjects}>
              确认关联
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 标签编辑对话框 */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>用逗号分隔多个标签</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="例如：技术, 产品, 设计"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateTags}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMaterial?.title}</DialogTitle>
            <DialogDescription>
              {selectedMaterial && `类型：${materialTypeLabels[selectedMaterial.material_type]} | 状态：${materialStatusLabels[selectedMaterial.status || 'unused']}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>内容</Label>
              <div className="mt-2 p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">
                {selectedMaterial?.content}
              </div>
            </div>
            {selectedMaterial?.source && (
              <div>
                <Label>来源</Label>
                <p className="text-sm mt-1">
                  {selectedMaterial.source === 'manual' && '手动添加'}
                  {selectedMaterial.source === 'ai_generated' && 'AI 生成'}
                  {selectedMaterial.source === 'imported' && '导入'}
                </p>
              </div>
            )}
            {selectedMaterial?.tags && selectedMaterial.tags.length > 0 && (
              <div>
                <Label>标签</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMaterial.tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedMaterial?.keywords && selectedMaterial.keywords.length > 0 && (
              <div>
                <Label>关键词</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMaterial.keywords.map(keyword => (
                    <Badge key={keyword} variant="secondary">{keyword}</Badge>
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
            <DialogTitle>编辑素材</DialogTitle>
            <DialogDescription>修改素材的内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">标题</Label>
              <Input
                id="edit-title"
                value={editingMaterial?.title || ''}
                onChange={(e) => setEditingMaterial(editingMaterial ? { ...editingMaterial, title: e.target.value } : null)}
                placeholder="请输入标题"
              />
            </div>
            <div>
              <Label htmlFor="edit-type">类型</Label>
              <Select
                value={editingMaterial?.material_type || 'opinion'}
                onValueChange={(value: any) => setEditingMaterial(editingMaterial ? { ...editingMaterial, material_type: value } : null)}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="experience">个人经历</SelectItem>
                  <SelectItem value="opinion">观点</SelectItem>
                  <SelectItem value="case">案例/实验</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-content">内容</Label>
              <Textarea
                id="edit-content"
                value={editingMaterial?.content || ''}
                onChange={(e) => setEditingMaterial(editingMaterial ? { ...editingMaterial, content: e.target.value } : null)}
                placeholder="请输入内容"
                rows={15}
              />
            </div>
            <div>
              <Label htmlFor="edit-source">来源</Label>
              <Select
                value={editingMaterial?.source || 'manual'}
                onValueChange={(value: any) => setEditingMaterial(editingMaterial ? { ...editingMaterial, source: value } : null)}
              >
                <SelectTrigger id="edit-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手动添加</SelectItem>
                  <SelectItem value="ai_generated">AI 生成</SelectItem>
                  <SelectItem value="imported">导入</SelectItem>
                </SelectContent>
              </Select>
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
