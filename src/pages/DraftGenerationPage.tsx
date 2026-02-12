import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, createDraft, updateDraft } from '@/db/api';
import type { Project, Draft, Citation, ParagraphGuidance } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import DraftEditor from '@/components/draft/DraftEditor';
import DraftGuidance from '@/components/draft/DraftGuidance';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

export default function DraftGenerationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [guidance, setGuidance] = useState<ParagraphGuidance[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProject();
    loadDraft();
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载项目信息',
        variant: 'destructive',
      });
    }
  };

  const loadDraft = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getLatestDraft(projectId);
      if (data) {
        setDraft(data);
        setContent(data.content || '');
        setCitations(data.citations || []);
        setGuidance(data.guidance || []);
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!projectId || !user) return;

    setGenerating(true);
    setStreaming(true);
    setContent('');
    setCitations([]);
    setGuidance([]);

    try {
      // Call draft-agent edge function with streaming
      const { data, error } = await supabase.functions.invoke('draft-agent', {
        body: {
          project_id: projectId,
          user_id: user.id,
          stream: true,
        },
      });

      if (error) throw error;

      if (data) {
        setContent(data.content || '');
        setCitations(data.citations || []);
        setGuidance(data.guidance || []);

        // Save draft to database
        if (draft) {
          await updateDraft(draft.id, {
            content: data.content,
            citations: data.citations,
            guidance: data.guidance,
          });
        } else {
          const newDraft = await createDraft({
            project_id: projectId,
            content: data.content,
            citations: data.citations,
            guidance: data.guidance,
            version: 1,
          });
          setDraft(newDraft);
        }

        toast({
          title: '生成成功',
          description: '草稿已生成，您可以继续编辑',
        });
      }
    } catch (error) {
      console.error('生成草稿失败:', error);
      toast({
        title: '生成失败',
        description: error instanceof Error ? error.message : '生成草稿时出错',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
      setStreaming(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    try {
      await updateDraft(draft.id, {
        content,
        citations,
        guidance,
      });

      toast({
        title: '保存成功',
        description: '草稿已保存',
      });
    } catch (error) {
      console.error('保存草稿失败:', error);
      toast({
        title: '保存失败',
        description: '保存草稿时出错',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/project/${projectId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{project?.title || '草稿生成'}</h1>
                <p className="text-sm text-muted-foreground">生成草稿并协作完善</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving || !draft}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    生成草稿
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Draft Editor */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>草稿内容</CardTitle>
                  <CardDescription>
                    AI 生成的草稿，您可以直接编辑和完善
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-5rem)]">
                  <DraftEditor
                    content={content}
                    citations={citations}
                    onContentChange={handleContentChange}
                    streaming={streaming}
                  />
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Guidance */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>写作指导</CardTitle>
                  <CardDescription>
                    了解生成逻辑，添加个人内容让文章更有温度
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-5rem)]">
                  <DraftGuidance guidance={guidance} />
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
