import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject } from '@/db/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BriefStage from '@/components/workflow/BriefStage';
import KnowledgeStage from '@/components/workflow/KnowledgeStage';
import OutlineStage from '@/components/workflow/OutlineStage';
import MaterialsStage from '@/components/workflow/MaterialsStage';
import DraftStage from '@/components/workflow/DraftStage';
import ReviewStage from '@/components/workflow/ReviewStage';

const stages = [
  { key: 'init', label: '开始', progress: 0 },
  { key: 'confirm_brief', label: '明确需求', progress: 14 },
  { key: 'knowledge_selected', label: '资料查询', progress: 28 },
  { key: 'outline_confirmed', label: '段落摘要', progress: 42 },
  { key: 'drafting', label: '文章生成', progress: 56 },
  { key: 'review_pass_1', label: '内容审校', progress: 70 },
  { key: 'completed', label: '完成', progress: 100 },
];

export default function ProjectWorkflowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProject();
  }, [projectId, user]);

  const loadProject = async () => {
    if (!projectId || !user) return;
    try {
      const data = await getProject(projectId);
      if (!data) {
        toast({
          title: '项目不存在',
          description: '无法找到该项目',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }
      setProject(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载项目信息',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStage = () => {
    return stages.find((s) => s.key === project?.status) || stages[0];
  };

  const renderStageContent = () => {
    if (!project || !projectId) return null;

    switch (project.status) {
      case 'init':
      case 'confirm_brief':
        return <BriefStage projectId={projectId} onComplete={loadProject} />;
      case 'knowledge_selected':
        return <KnowledgeStage projectId={projectId} onComplete={loadProject} />;
      case 'outline_confirmed':
        return <OutlineStage projectId={projectId} onComplete={loadProject} />;
      case 'drafting':
        return <MaterialsStage projectId={projectId} onComplete={loadProject} />;
      case 'review_pass_1':
        return <ReviewStage projectId={projectId} onComplete={loadProject} />;
      case 'completed':
        return <DraftStage projectId={projectId} readonly />;
      default:
        return <DraftStage projectId={projectId} onComplete={loadProject} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const currentStage = getCurrentStage();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目列表
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
          <CardDescription>当前阶段：{currentStage.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>进度</span>
              <span>{currentStage.progress}%</span>
            </div>
            <Progress value={currentStage.progress} />
            <div className="flex justify-between text-xs text-muted-foreground mt-4">
              {stages.map((stage, index) => (
                <div
                  key={stage.key}
                  className={`flex flex-col items-center ${
                    index <= stages.findIndex((s) => s.key === project.status)
                      ? 'text-foreground'
                      : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mb-1 ${
                      index <= stages.findIndex((s) => s.key === project.status)
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                  <span className="hidden md:block">{stage.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {renderStageContent()}
    </div>
  );
}
