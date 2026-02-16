import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects, deleteProject, getProfile } from '@/api';
import { createProject, checkProjectLimit } from '@/services/project.service';
import { deductUserPoints } from '@/services/credit.service';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, FileText, AlertCircle, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/utils/date';

const statusLabels: Record<string, string> = {
  init: '初始化',
  confirm_brief: '需求明确',
  knowledge_selected: '资料搜索',
  material_review: '资料整理',
  outline_confirmed: '文章结构',
  drafting: '生成草稿',
  review_pass_1: '第一轮审校',
  review_pass_2: '第二轮审校',
  review_pass_3: '第三轮审校',
  layout_export: '排版导出',
  completed: '已完成',
};

const statusColors: Record<string, string> = {
  init: 'bg-muted text-muted-foreground',
  confirm_brief: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  knowledge_selected: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  material_review: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  outline_confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  drafting: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  review_pass_1: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  review_pass_2: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  review_pass_3: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  layout_export: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState(true);
  const [projectInfo, setProjectInfo] = useState({ created: 0, limit: 0 });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    checkCreateLimit();
  }, [user]);

  const checkCreateLimit = async () => {
    if (!user) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setProjectInfo({
          created: profile.projects_created,
          limit: profile.unlimited_credits ? -1 : profile.available_credits,
        });
        setCanCreate(profile.unlimited_credits || profile.available_credits > 0);
      }
    } catch (error) {
      console.error('检查项目限制失败:', error);
    }
  };

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

    // 检查项目创建限制
    if (!canCreate) {
      toast({
        title: '项目数量已达上限',
        description: '请购买点数以创建更多项目',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      // 扣除 9 点
      await deductUserPoints(user.id, 9, '创建项目');
      
      // 增加项目计数
      await incrementProjectCount(user.id);
      
      const project = await createProject(user.id, newProjectTitle.trim());
      setProjects([project, ...projects]);
      setNewProjectTitle('');
      setDialogOpen(false);
      
      // 更新限制信息
      await checkCreateLimit();
      
      toast({
        title: '创建成功',
        description: '已扣除 9 点，项目创建成功',
      });
      navigate(`/project/${project.id}`);
    } catch (error: any) {
      let errorMessage = '无法创建项目';
      if (error.message && error.message.includes('点数不足')) {
        errorMessage = '点数不足，请先充值';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: '创建失败',
        description: errorMessage,
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
            <Button disabled={!canCreate}>
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

      {/* 项目配额提示 - 单行显示 */}
      <Alert className={`mb-6 ${!canCreate ? 'border-destructive' : ''}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>项目配额</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            已创建 {projectInfo.created} 个项目
            {projectInfo.limit === -1 ? ' (无限)' : ` · 剩余点数 ${projectInfo.limit}`}
            {!canCreate && ' - 已达上限'}
          </span>
          {!canCreate && (
            <Button 
              size="sm" 
              onClick={() => navigate('/settings')}
              variant="destructive"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              购买点数
            </Button>
          )}
        </AlertDescription>
      </Alert>

      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">暂无项目</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个写作项目</p>
          <Button onClick={() => setDialogOpen(true)} disabled={!canCreate}>
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
                  创建于 {formatDateTime(project.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent onClick={() => navigate(`/project/${project.id}`)}>
                <Badge className={statusColors[project.status] || 'bg-muted text-muted-foreground'}>
                  {statusLabels[project.status] || project.status || '未知状态'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
