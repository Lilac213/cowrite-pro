import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, updateProject, saveProjectHistory, getProjectHistoryByStage, getBrief } from '@/db/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BriefStage from '@/components/workflow/BriefStage';
import KnowledgeStage from '@/components/workflow/KnowledgeStage';
import OutlineStage from '@/components/workflow/OutlineStage';
import ParagraphStructureStage from '@/components/workflow/ParagraphStructureStage';
import MaterialsStage from '@/components/workflow/MaterialsStage';
import DraftStage from '@/components/workflow/DraftStage';
import ReviewStage from '@/components/workflow/ReviewStage';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';

const stages = [
  { key: 'init', label: '开始', progress: 0 },
  { key: 'confirm_brief', label: '明确需求', progress: 12 },
  { key: 'knowledge_selected', label: '资料查询', progress: 24 },
  { key: 'outline_confirmed', label: '文章结构', progress: 36 },
  { key: 'paragraph_structure_confirmed', label: '段落结构', progress: 48 },
  { key: 'drafting', label: '文章生成', progress: 60 },
  { key: 'review_pass_1', label: '内容审校', progress: 75 },
  { key: 'layout_export', label: '排版导出', progress: 90 },
  { key: 'completed', label: '完成', progress: 100 },
];

export default function ProjectWorkflowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [requirementsDoc, setRequirementsDoc] = useState<string>('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProject();
    loadRequirementsDoc();
  }, [projectId, user]);

  // 当项目状态变为 layout_export 时，导航到导出页面
  useEffect(() => {
    if (project?.status === 'layout_export' && projectId) {
      navigate(`/project/${projectId}/export`);
    }
  }, [project?.status, projectId, navigate]);

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

  const loadRequirementsDoc = async () => {
    if (!projectId) return;
    try {
      const brief = await getBrief(projectId);
      if (brief && brief.requirements) {
        const doc = typeof brief.requirements === 'string' 
          ? brief.requirements 
          : JSON.stringify(brief.requirements, null, 2);
        setRequirementsDoc(doc);
      }
    } catch (error) {
      console.error('加载需求文档失败:', error);
    }
  };

  const handleStageClick = async (stageKey: string) => {
    if (!project || !projectId) return;

    // 保存当前阶段的历史记录
    try {
      await saveProjectHistory(projectId, project.status, {
        timestamp: new Date().toISOString(),
        status: project.status,
      });

      // 更新项目状态
      await updateProject(projectId, { status: stageKey as any });

      toast({
        title: '已跳转',
        description: `已跳转到${stages.find((s) => s.key === stageKey)?.label}阶段`,
      });

      // 重新加载项目
      await loadProject();
    } catch (error) {
      toast({
        title: '跳转失败',
        description: '无法跳转到该阶段',
        variant: 'destructive',
      });
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
      case 'paragraph_structure_confirmed':
        return <ParagraphStructureStage projectId={projectId} onComplete={loadProject} />;
      case 'drafting':
        return <MaterialsStage projectId={projectId} onComplete={loadProject} />;
      case 'review_pass_1':
        return <ReviewStage projectId={projectId} onComplete={loadProject} />;
      case 'layout_export':
        // 导航到导出页面
        navigate(`/project/${projectId}/export`);
        return null;
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
          <WorkflowProgress 
            currentStage={project.status} 
            onStageClick={handleStageClick}
            clickable={true}
            requirementsDoc={requirementsDoc}
          />
        </CardContent>
      </Card>

      {renderStageContent()}
    </div>
  );
}
