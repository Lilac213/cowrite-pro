import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, createDraft, updateDraft } from '@/db/api';
import type { Project, Draft, Citation, ParagraphGuidance } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Sparkles, Loader2, Settings, Send, Clock, FileText, Zap, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import CitationMarker from '@/components/draft/CitationMarker';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';

export default function DraftGenerationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [guidance, setGuidance] = useState<ParagraphGuidance[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Calculate stats
  const wordCount = content.replace(/\s/g, '').length;
  const readTime = Math.ceil(wordCount / 400); // 假设每分钟阅读400字
  const aiGenRate = 85; // TODO: Calculate from actual data

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
        setTitle('2024年全球金融合规的数字化转型路径'); // TODO: Get from draft
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
    setLogMessages(['开始生成草稿...', '正在分析文章结构...', '正在编撰章节 1...']);

    try {
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
        setLogMessages([...logMessages, '草稿生成完成']);

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
      setLogMessages([...logMessages, '生成失败: ' + (error instanceof Error ? error.message : '未知错误')]);
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

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    setLogMessages([...logMessages, `用户: ${chatMessage}`]);
    // TODO: Send to AI and get response
    setChatMessage('');
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
      {/* Header with Progress */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="font-bold text-lg">RESEARCHOS</div>
              <div className="text-sm text-muted-foreground">
                项目：{project?.title || '未命名项目'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Save className="h-4 w-4 mr-2" />
                已自动保存
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                完成并导出
              </Button>
            </div>
          </div>
          <WorkflowProgress
            currentStage={project?.status || 'drafting'}
            clickable={false}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Editor */}
        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-4xl mx-auto">
            <CardContent className="p-8">
              {/* Title */}
              <h1 className="text-3xl font-bold mb-6">
                {title || '未命名文章'}
              </h1>

              {/* Stats Bar */}
              <div className="flex items-center gap-6 mb-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>WORDS: {wordCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>READ: {readTime} MIN</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>AI GEN: {aiGenRate}%</span>
                </div>
              </div>

              {/* Content */}
              <div
                ref={contentRef}
                className="prose prose-sm max-w-none"
                style={{ minHeight: '400px' }}
              >
                {content ? (
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>点击"生成草稿"开始创作</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Log Section */}
          <Card className="max-w-4xl mx-auto mt-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
                  </div>
                  <span className="font-medium">
                    {generating ? 'GENERATE-DRAFT AGENT: 正在编撰章节 2.3' : '就绪'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>模型：GPT-4_RESEARCH_V2</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    停止生成
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Coaching Rail */}
        <div className="w-96 border-l bg-muted/30 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                <h2 className="font-semibold">协作教练 (COACHING RAIL)</h2>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            {/* Logic Section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">段落逻辑 (LOGIC)</h3>
                  <span className="text-xs text-muted-foreground">#01</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  该段落采用"现状-挑战-必然性"结构，通过引入全球监管压力，为后续讨论"AI 替代人工"的技术必要性做铺垫。
                </p>
              </CardContent>
            </Card>

            {/* Suggestions Section */}
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  <h3 className="text-sm font-medium">操作建议 (SUGGESTIONS)</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "建议在此处增加一个关于金融风险的案例，以增强开篇的紧迫感。"
                </p>
              </CardContent>
            </Card>

            {/* Active Collaboration Section */}
            <Card className="bg-black text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <h3 className="text-sm font-medium">实时协作 (ACTIVE)</h3>
                </div>
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">盘点协作：插入个人观点</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    系统检测到您在 Step 2 卷中标注过"某大型商业银行的反洗钱系统"。
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="w-full">
                  <span className="mr-2">➕</span>
                  插入我的创业案例历
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="border-t p-4 bg-background">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="向协作教练输入指令..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs">
                调色器前置
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                寻找相关论据
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
