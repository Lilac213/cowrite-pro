import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, createDraft, updateDraft } from '@/db/api';
import type { Project, Draft, Citation, ParagraphGuidance } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, Sparkles, Loader2, Settings, Send, Clock, FileText, Zap, Lightbulb, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
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
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Calculate stats
  const wordCount = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
  const readTime = Math.ceil(wordCount / 400); // 假设每分钟阅读400字
  const aiGenRate = 85; // TODO: Calculate from actual data
  
  // Get current paragraph guidance
  const currentGuidance = selectedParagraphId 
    ? guidance.find(g => g.paragraph_id === selectedParagraphId)
    : null;

  useEffect(() => {
    loadProject();
    loadDraft();
  }, [projectId]);
  
  // Handle citation marker clicks
  useEffect(() => {
    if (!contentRef.current) return;
    
    const handleCitationMarkerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const marker = target.closest('.citation-marker') as HTMLElement;
      
      if (marker) {
        e.preventDefault();
        e.stopPropagation();
        
        const citationId = marker.getAttribute('data-citation-id');
        if (citationId) {
          const citation = citations.find(c => c.id === citationId);
          if (citation) {
            setSelectedCitation(citation);
            setCitationPopoverOpen(true);
          }
        }
      }
    };
    
    contentRef.current.addEventListener('click', handleCitationMarkerClick);
    
    return () => {
      contentRef.current?.removeEventListener('click', handleCitationMarkerClick);
    };
  }, [citations]);
  
  const showCitationPopover = (citation: Citation, element: HTMLElement) => {
    setSelectedCitation(citation);
    setCitationPopoverOpen(true);
  };

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
        setTitle(data.content ? '2024年全球金融合规的数字化转型路径' : '');
        setContent(data.content || getSampleContent());
        setCitations(data.citations || getSampleCitations());
        setGuidance(data.guidance || getSampleGuidance());
      } else {
        // 如果没有草稿，显示示例内容
        setTitle('2024年全球金融合规的数字化转型路径');
        setContent(getSampleContent());
        setCitations(getSampleCitations());
        setGuidance(getSampleGuidance());
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
      // 加载失败时也显示示例内容
      setTitle('2024年全球金融合规的数字化转型路径');
      setContent(getSampleContent());
      setCitations(getSampleCitations());
      setGuidance(getSampleGuidance());
    } finally {
      setLoading(false);
    }
  };

  // 示例内容
  const getSampleContent = () => {
    return `<p id="p1" class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">随着全球金融监管环境的日益复杂，传统的手工合规审查已无法满足现代高频交易的需求。数字化转型已不再是企业的可选项，而是生存的必然需求。特别是在跨境支付与反洗钱（AML）领域，实时数据分析技术的应用正成为衡量金融机构核心竞争力的关键指标<sup class="citation-marker text-primary cursor-pointer font-medium" data-citation-id="1">[1]</sup>。</p>

<p id="p2" class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">在这一背景下，我们观察到大型银行在合规预算的分配上出现了显著倾斜。根据近期的数据显示，超过65%的金融机构已将初步风险评估框架迁移至云端处理周期。这种转变不仅缩短了从预警到响应的处理周期<sup class="citation-marker text-primary cursor-pointer font-medium" data-citation-id="2">[2]</sup>，相比于传统的本地部署方案，云端系统能够更理解更加复杂的文本语境，从而提高了对异常交易的识别准确率，正在提取合规风险指标...</p>

<p class="paragraph-block cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"><span style="color: #999; font-style: italic;">《等待输入...》点击此处答。</span></p>`;
  };

  const getSampleCitations = (): Citation[] => {
    return [
      {
        id: '1',
        material_id: 'mat-1',
        material_title: '《2023年全球金融科技应用白皮书》- 第三章',
        material_source: '麦肯锡',
        material_url: 'https://example.com/report',
        material_summary: '报告指出，超过65%的金融机构已将初步风险评估框架迁移至云端处理周期。特别是在处理KYC文档时，错误率降低了34%。',
        position: 150,
        paragraph_id: 'p1',
        quote: '实时数据分析技术的应用正成为衡量金融机构核心竞争力的关键指标',
      },
      {
        id: '2',
        material_id: 'mat-2',
        material_title: '资源原文档',
        material_source: '内部研究',
        material_url: '',
        material_summary: '云端系统能够更好地理解复杂的文本语境，提高异常交易识别准确率。',
        position: 280,
        paragraph_id: 'p2',
        quote: '缩短了从预警到响应的处理周期',
      },
    ];
  };

  const getSampleGuidance = (): ParagraphGuidance[] => {
    return [
      {
        paragraph_id: 'p1',
        generation_rationale: '该段落采用"现状-挑战-必然性"结构，通过引入全球监管压力，为后续讨论"AI 替代人工"的技术必要性做铺垫。',
        personal_content_suggestions: ['建议在此处增加一个关于金融风险的案例，以增强开篇的紧迫感。'],
        experience_suggestions: ['如果您有相关的行业经验，可以分享具体的合规挑战案例。'],
        collaboration_prompt: '系统检测到您在 Step 2 卷中标注过"某大型商业银行的反洗钱系统"。',
      },
      {
        paragraph_id: 'p2',
        generation_rationale: '该段落通过数据支撑前文观点，采用"现象-数据-效果"的论证结构，增强说服力。',
        personal_content_suggestions: ['可以补充具体的云端迁移案例，使论述更加生动。'],
        experience_suggestions: ['如果您了解相关的技术实施细节，可以添加技术架构说明。'],
        collaboration_prompt: '检测到您收藏过关于云计算的资料，是否需要引用？',
      },
    ];
  };
  
  // Handle paragraph click
  const handleParagraphClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const paragraph = target.closest('.paragraph-block') as HTMLElement;
    if (paragraph && paragraph.id) {
      setSelectedParagraphId(paragraph.id);
    }
  };
  
  // Handle citation click
  const handleCitationClick = (citationId: string) => {
    const citation = citations.find(c => c.id === citationId);
    if (citation) {
      // Citation marker component will handle the popover
      console.log('Citation clicked:', citation);
    }
  };
  
  // Handle content change
  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setContent(newContent);
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

      {/* Main Content - Left wider than right */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Editor (wider: flex-[2]) */}
        <div className="flex-[2] overflow-auto p-6">
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

              {/* Editable Content */}
              <div
                ref={contentRef}
                className="prose prose-sm max-w-none"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleContentChange}
                onClick={handleParagraphClick}
                style={{ minHeight: '400px' }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Coaching Rail (narrower: flex-1, max-w-md) */}
        <div className="flex-1 max-w-md border-l bg-muted/30 flex flex-col">
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

            {/* Show guidance only when paragraph is selected */}
            {selectedParagraphId && currentGuidance ? (
              <>
                {/* Logic Section */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">段落逻辑 (LOGIC)</h3>
                      <span className="text-xs text-muted-foreground">#{selectedParagraphId.replace('p', '')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {currentGuidance.generation_rationale}
                    </p>
                  </CardContent>
                </Card>

                {/* Suggestions Section */}
                {currentGuidance.personal_content_suggestions && currentGuidance.personal_content_suggestions.length > 0 && (
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-yellow-600" />
                        <h3 className="text-sm font-medium">操作建议 (SUGGESTIONS)</h3>
                      </div>
                      {currentGuidance.personal_content_suggestions.map((suggestion, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground leading-relaxed italic mb-2">
                          "{suggestion}"
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Active Collaboration Section */}
                {currentGuidance.collaboration_prompt && (
                  <Card className="bg-black text-white border-0">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        <h3 className="text-sm font-medium">实时协作 (ACTIVE)</h3>
                      </div>
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">盘点协作：插入个人观点</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {currentGuidance.collaboration_prompt}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" className="w-full">
                        <span className="mr-2">➕</span>
                        插入我的创业案例历
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">点击左侧段落查看编辑建议</p>
                </CardContent>
              </Card>
            )}
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

      {/* Log Section - At the very bottom */}
      <div className="border-t bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-foreground"></div>
              </div>
              <span className="font-medium">
                {generating ? 'GENERATE-DRAFT AGENT: 正在编撰章节 2.3' : 'GENERATE-DRAFT AGENT: 就绪'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>模型：GPT-4_RESEARCH_V2</span>
              {generating && (
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  停止生成
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Citation Dialog */}
      <Dialog open={citationPopoverOpen} onOpenChange={setCitationPopoverOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedCitation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base">{selectedCitation.material_title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedCitation.material_source && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">来源</p>
                    <p className="text-sm">{selectedCitation.material_source}</p>
                  </div>
                )}
                
                {selectedCitation.material_summary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">摘要</p>
                    <p className="text-sm leading-relaxed">{selectedCitation.material_summary}</p>
                  </div>
                )}
                
                {selectedCitation.quote && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">引用内容</p>
                    <p className="text-sm italic border-l-2 border-primary pl-3 py-1">"{selectedCitation.quote}"</p>
                  </div>
                )}
                
                {selectedCitation.material_url && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={selectedCitation.material_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看原文
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
