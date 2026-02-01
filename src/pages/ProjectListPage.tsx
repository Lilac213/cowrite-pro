import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects, createProject, deleteProject } from '@/db/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<string, string> = {
  init: '初始化',
  confirm_brief: '需求确认',
  knowledge_selected: '知识收集',
  outline_confirmed: '大纲确认',
  drafting: '草稿编写',
  review_pass_1: '第一轮审校',
  review_pass_2: '第二轮审校',
  review_pass_3: '第三轮审校',
  completed: '已完成',
};

const statusColors: Record<string, string> = {
  init: 'bg-muted',
  confirm_brief: 'bg-secondary',
  knowledge_selected: 'bg-secondary',
  outline_confirmed: 'bg-secondary',
  drafting: 'bg-accent',
  review_pass_1: 'bg-accent',
  review_pass_2: 'bg-accent',
  review_pass_3: 'bg-accent',
  completed: 'bg-primary text-primary-foreground',
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    try {
      const data = await getProjects(user.id);
      setProjects(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载项目列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectTitle.trim()) return;

    setCreating(true);
    try {
      const project = await createProject(user.id, newProjectTitle.trim());
      setProjects([project, ...projects]);
      setNewProjectTitle('');
      setDialogOpen(false);
      toast({
        title: '创建成功',
        description: '项目已创建',
      });
      navigate(`/project/${project.id}`);
    } catch (error) {
      toast({
        title: '创建失败',
        description: '无法创建项目',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
      toast({
        title: '删除成功',
        description: '项目已删除',
      });
    } catch (error) {
      toast({
        title: '删除失败',
        description: '无法删除项目',
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
          <h1 className="text-3xl font-bold">项目列表</h1>
          <p className="text-muted-foreground mt-2">管理您的写作项目</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建项目</DialogTitle>
              <DialogDescription>创建一个新的写作项目</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">项目标题</Label>
                <Input
                  id="title"
                  placeholder="请输入项目标题"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateProject();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateProject} disabled={creating || !newProjectTitle.trim()}>
                {creating ? '创建中...' : '创建'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">暂无项目</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个写作项目</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader onClick={() => navigate(`/project/${project.id}`)}>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          此操作将永久删除该项目及其所有相关数据，无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteProject(project.id)}>
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <CardDescription>
                  创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}
                </CardDescription>
              </CardHeader>
              <CardContent onClick={() => navigate(`/project/${project.id}`)}>
                <Badge className={statusColors[project.status]}>
                  {statusLabels[project.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
