import { useState, useEffect } from 'react';
import { useFlowTransition } from '@/hooks/use-flow-transition';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, createDraft, updateDraft } from '@/api';
import type { Project, Draft, Citation } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Sparkles, Loader2, Settings, Send, Clock, FileText, Zap, Lightbulb, ExternalLink, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';
import { FlowTransition } from '@/components/ui/flow-transition';
import { type TransitionStage } from '@/hooks/use-flow-transition';
import SuggestionCard from '@/components/ui/suggestion-card';
import EditableParagraph from '@/components/ui/editable-paragraph';

// 段落数据结构
interface Paragraph {
  id: string;
  content: string;
  suggestions?: ParagraphSuggestion[];
  isEditing?: boolean;
  isLoadingSuggestion?: boolean;
}

// 段落建议结构
interface ParagraphSuggestion {
  id: string;
  type: 'logic' | 'style' | 'content';
  title: string;
  description: string;
  suggestion: string;
}

// 流程阶段定义
const draftStages: TransitionStage[] = [
  {
    id: 'editing',
    name: '内容编辑',
    description: '编辑和优化段落内容',
    skippable: false,
  },
  {
    id: 'suggestions',
    name: 'AI建议',
    description: '查看和应用AI改进建议',
    skippable: true,
  },
  {
    id: 'review',
    name: '最终审查',
    description: '审查并确认最终内容',
    skippable: false,
  },
  {
    id: 'complete',
    name: '完成导出',
    description: '导出最终草稿',
    skippable: false,
  },
];

export default function DraftGenerationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [logMessages, setLogMessages] = useState<Array<{ time: string; message: string; type?: 'info' | 'success' | 'error' }>>([
    { time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message: '系统初始化完成', type: 'success' },
    { time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message: '等待用户操作...', type: 'info' },
  ]);
  const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 新版本标识 - 实时编辑与LLM建议系统
  console.log('🎨 DraftGenerationPage v2.0 - Real-time Editing & LLM Suggestions Loaded');

  // 计算统计数据
  const totalContent = paragraphs.map(p => p.content).join('');
  const wordCount = totalContent.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
  const readTime = Math.ceil(wordCount / 400);
  const aiGenRate = 85;

  // 添加日志
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogMessages(prev => [...prev, { time, message, type }]);
  };

  // 预加载阶段数据函数
  const preloadStageData = async (stage: TransitionStage) => {
    try {
      addLog(`开始预加载阶段: ${stage.name}`, 'info');
      
      switch (stage.id) {
        case 'suggestions':
          // 预加载AI建议相关数据
          if (paragraphs.length > 0) {
            // 模拟预加载AI建议数据
            await new Promise(resolve => setTimeout(resolve, 200));
            addLog(`预加载AI建议数据完成`, 'success');
          }
          break;
          
        case 'review':
          // 预加载审查相关数据
          if (citations.length > 0) {
            // 模拟预加载引用验证数据
            await new Promise(resolve => setTimeout(resolve, 300));
            addLog(`预加载审查数据完成`, 'success');
          }
          break;
          
        case 'complete':
          // 预加载导出相关数据
          if (draft) {
            // 模拟预加载导出格式数据
            await new Promise(resolve => setTimeout(resolve, 150));
            addLog(`预加载导出数据完成`, 'success');
          }
          break;
          
        default:
          addLog(`阶段 ${stage.name} 无需预加载`, 'info');
      }
    } catch (error) {
      console.error(`预加载阶段 ${stage.name} 失败:`, error);
      addLog(`预加载阶段 ${stage.name} 失败`, 'error');
    }
  };

  // 使用流程过渡Hook
  const {
    state: flowState,
    next: flowNext,
    isTransitioning,
    isPreloaded,
  } = useFlowTransition(draftStages, {
    duration: 400,
    type: 'slide',
    direction: 'left',
    easing: 'ease-in-out',
    preload: {
      enabled: true,
      lookahead: 2,
      delay: 200,
      retryCount: 3,
      retryDelay: 1000,
      preloadFn: preloadStageData,
    },
  });

  useEffect(() => {
    loadProject();
    loadDraft();
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const projectData = await getProject(projectId);
      setProject(projectData);
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
      const draftData = await getLatestDraft(projectId);
      if (draftData) {
        setDraft(draftData);
        const draftTitle = (draftData as any).title || '';
        setTitle(draftTitle);
        
        if (draftData.content) {
          const parsedParagraphs = parseContentToParagraphs(draftData.content);
          setParagraphs(parsedParagraphs);
        } else {
          setParagraphs(getInitialParagraphs());
        }
        
        setCitations(draftData.citations || []);
      } else {
        setTitle('2024年全球金融合规的数字化转型路径');
        setParagraphs(getInitialParagraphs());
        setCitations(getInitialCitations());
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
      setTitle('2024年全球金融合规的数字化转型路径');
      setParagraphs(getInitialParagraphs());
      setCitations(getInitialCitations());
    } finally {
      setLoading(false);
    }
  };

  const parseContentToParagraphs = (htmlContent: string): Paragraph[] => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const paragraphElements = tempDiv.querySelectorAll('p');
    
    return Array.from(paragraphElements).map((p, index) => ({
      id: `p${index + 1}`,
      content: p.innerHTML,
    }));
  };

  const getInitialParagraphs = (): Paragraph[] => {
    return [
      {
        id: 'p1',
        content: '随着全球金融监管环境的日益复杂，传统的手工合规审查已无法满足现代高频交易的需求。数字化转型已不再是企业的可选项，而是生存的必然要求。特别是在跨境支付与反洗钱（AML）领域，实时数据分析技术的应用正成为衡量金融机构核心竞争力的关键指标。<sup class="citation-marker" data-citation-id="1">[1]</sup>',
      },
      {
        id: 'p2',
        content: '在这一背景下，我们观察到大型银行在合规预算的分配上出现了显著倾斜。根据近期的数据显示，超过65%的金融机构已将初步风险评估框架迁移至云端，这种转变不仅缩短了从预警到响应的处理周期。<sup class="citation-marker" data-citation-id="2">[2]</sup> 相比于传统本地部署方案，云原生系统能够更理解更加复杂的文本语境，从而提升对异常交易模式的识别精度，正在重塑合规风险指标的内涵。',
      },
      {
        id: 'p3',
        content: '展望未来，金融科技的融合将进一步深化。人工智能驱动的合规系统不仅能够实时监控交易，还能预测潜在风险，为金融机构提供前瞻性的决策支持。这种转变将彻底改变传统合规模式，推动整个行业向更加智能化、自动化的方向发展。',
      },
    ];
  };

  const getInitialCitations = (): Citation[] => {
    return [
      {
        id: '1',
        material_id: 'mat1',
        material_title: '2023年全球金融科技应用白皮书',
        material_source: '第三章',
        quote: '超过65%的金融机构已将初步风险评估框架迁移至云端',
        position: 45,
      },
      {
        id: '2',
        material_id: 'mat2',
        material_title: '跨境支付合规技术报告',
        material_source: '技术实现部分',
        quote: '实时数据分析技术正成为衡量金融机构核心竞争力的关键指标',
        position: 78,
      },
    ];
  };

  // TODO: 实现保存功能
  // const handleSave = async () => {
  //   if (!projectId || !user) return;
  //   
  //   try {
  //     const content = paragraphs.map(p => `<p>${p.content}</p>`).join('\n');
  //     
  //     if (draft) {
  //       await updateDraft(draft.id, {
  //         content,
  //         citations,
  //         updated_at: new Date().toISOString(),
  //       });
  //     } else {
  //       const newDraft = await createDraft({
  //         project_id: projectId,
  //         content,
  //         citations,
  //         version: 1,
  //       });
  //       setDraft(newDraft);
  //     }
  //     
  //     toast({
  //       title: '保存成功',
  //       description: '草稿已保存',
  //       variant: 'default',
  //     });
  //     
  //     addLog('草稿保存成功', 'success');
  //   } catch (error) {
  //     console.error('保存草稿失败:', error);
  //     toast({
  //       title: '保存失败',
  //       description: '无法保存草稿',
  //       variant: 'destructive',
  //     });
  //     addLog('草稿保存失败', 'error');
  //   }
  // };

  const handleGenerate = async () => {
    if (!projectId) return;
    
    setGenerating(true);
    addLog('开始生成最终草稿', 'info');
    
    try {
      // 模拟生成过程
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      addLog('草稿生成完成', 'success');
      
      toast({
        title: '生成成功',
        description: '最终草稿已生成',
        variant: 'default',
      });
      
      // 导航到项目页面
      navigate(`/project/${projectId}`);
    } catch (error) {
      console.error('生成失败:', error);
      toast({
        title: '生成失败',
        description: '无法生成最终草稿',
        variant: 'destructive',
      });
      addLog('草稿生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleParagraphChange = (paragraphId: string, newContent: string) => {
    setParagraphs(prev => prev.map(p => 
      p.id === paragraphId ? { ...p, content: newContent } : p
    ));
  };

  // TODO: 实现段落建议功能
  // const handleParagraphSuggestion = async (paragraphId: string) => {
  //   setParagraphs(prev => prev.map(p => 
  //     p.id === paragraphId ? { ...p, isLoadingSuggestion: true } : p
  //   ));
  //   
  //   try {
  //     // 模拟AI建议生成
  //     await new Promise(resolve => setTimeout(resolve, 2000));
  //     
  //     const suggestions: ParagraphSuggestion[] = [
  //       {
  //         id: `${paragraphId}-suggestion-1`,
  //         type: 'style',
  //         title: '语言风格优化',
  //         description: '建议增加更多专业术语',
  //         suggestion: '可以考虑使用"监管科技(RegTech)"等专业术语来增强学术性。',
  //       },
  //       {
  //         id: `${paragraphId}-suggestion-2`,
  //         type: 'content',
  //         title: '内容深化建议',
  //         description: '可以增加具体案例',
  //         suggestion: '建议添加具体的银行数字化转型案例来支撑论点。',
  //       },
  //     ];
  //     
  //     setParagraphs(prev => prev.map(p => 
  //       p.id === paragraphId ? { ...p, suggestions, isLoadingSuggestion: false } : p
  //     ));
  //     
  //     addLog(`为段落 ${paragraphId} 生成建议`, 'success');
  //   } catch (error) {
  //     console.error('生成建议失败:', error);
  //     setParagraphs(prev => prev.map(p => 
  //       p.id === paragraphId ? { ...p, isLoadingSuggestion: false } : p
  //     ));
  //     addLog('生成建议失败', 'error');
  //   }
  // };

  const applySuggestion = (paragraphId: string, suggestion: ParagraphSuggestion) => {
    setParagraphs(prev => prev.map(p => {
      if (p.id === paragraphId) {
        // 应用建议到段落内容
        const newContent = p.content + ' ' + suggestion.suggestion;
        return { 
          ...p, 
          content: newContent,
          suggestions: p.suggestions?.filter(s => s.id !== suggestion.id)
        };
      }
      return p;
    }));
    
    addLog(`应用建议 ${suggestion.id}`, 'info');
  };

  const ignoreSuggestion = (paragraphId: string, suggestionId: string) => {
    setParagraphs(prev => prev.map(p => 
      p.id === paragraphId ? { 
        ...p, 
        suggestions: p.suggestions?.filter(s => s.id !== suggestionId)
      } : p
    ));
    
    addLog(`忽略建议 ${suggestionId}`, 'info');
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }



  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/project/${projectId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">返回</span>
              </Button>
              <div className="flex items-center gap-1 md:gap-2">
                <span className="font-bold text-xs md:text-sm">RESEARCHOS</span>
                <span className="text-muted-foreground text-xs md:text-sm">/</span>
                <span className="text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{project?.title || '项目'}</span>
                <span className="text-xs text-muted-foreground ml-1 md:ml-2 px-1 md:px-2 py-0.5 bg-primary/10 rounded">v2.0</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 预加载状态指示器 */}
              {draftStages.map((stage, index) => {
                const isPreloading = isPreloaded(index) && index > flowState.currentIndex;
                const isCurrent = index === flowState.currentIndex;
                
                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : isPreloading
                        ? 'bg-green-100 text-green-700 animate-pulse'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPreloading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>{stage.name}</span>
                  </div>
                );
              })}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLogPanel(!showLogPanel)}
              >
                <Settings className="h-4 w-4 mr-2" />
                日志
              </Button>
              <Button
                size="sm"
                onClick={flowState.currentIndex === draftStages.length - 1 ? handleGenerate : flowNext}
                disabled={generating || isTransitioning}
              >
                {generating || isTransitioning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isTransitioning ? '切换中' : '生成中'}
                  </>
                ) : flowState.currentIndex === draftStages.length - 1 ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    完成并导出
                  </>
                ) : (
                  <>
                    <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                    下一步
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="container mx-auto px-4 pb-4">
          <WorkflowProgress currentStage="drafting" />
        </div>
      </header>

      {/* Main Content with Flow Transition */}
      <div className="flex-1 flex overflow-hidden">
        <FlowTransition
          stages={draftStages}
          config={{
            duration: 400,
            type: 'slide',
            direction: 'left',
            easing: 'ease-in-out',
            preload: {
              enabled: true,
              lookahead: 2,
              delay: 200,
              retryCount: 3,
              retryDelay: 1000,
              preloadFn: preloadStageData,
            },
          }}
          showProgress={true}
          progressPosition="top"
          className="flex-1"
        >
          {(stage, index) => (
            <>
              {stage.id === 'editing' && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  {/* Left Panel - Editor (wider: flex-[2]) */}
                  <div className="flex-[2] overflow-auto">
                    <div className="container max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-8">
                      <Card className="border-0 shadow-none">
                        <CardContent className="p-0">
                          {/* Title */}
                          <h1 className="text-2xl md:text-3xl lg:text-[2.5rem] font-bold leading-tight tracking-tight text-gray-900 mb-4 md:mb-6">
                            {title}
                          </h1>

                          {/* Stats Bar */}
                          <div className="flex flex-wrap items-center gap-3 md:gap-6 mb-6 md:mb-8 text-xs md:text-sm text-muted-foreground">
                            <div className="flex items-center gap-1 md:gap-2">
                              <FileText className="h-3 md:h-4 w-3 md:w-4" />
                              <span>WORDS: {wordCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                              <Clock className="h-3 md:h-4 w-3 md:w-4" />
                              <span>READ: {readTime} MIN</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                              <Sparkles className="h-3 md:h-4 w-3 md:w-4" />
                              <span>AI GEN: {aiGenRate}%</span>
                            </div>
                          </div>

                          {/* Editable Paragraphs */}
                          <div className="space-y-6">
                            {paragraphs.map((paragraph) => (
                              <EditableParagraph
                                key={paragraph.id}
                                id={paragraph.id}
                                content={paragraph.content}
                                onSave={(newContent: string) => handleParagraphChange(paragraph.id, newContent)}
                                placeholder="输入段落内容..."
                              />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Right Panel - Chat (narrower: flex-[1]) */}
                  <div className="flex-[1] lg:border-l bg-muted/30">
                    <div className="h-full flex flex-col">
                      {/* Chat Header */}
                      <div className="border-b p-3 md:p-4">
                        <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                          <Zap className="h-4 w-4" />
                          AI 助手
                        </h3>
                        <p className="text-xs md:text-sm text-muted-foreground mt-1">智能写作助手，提供实时建议</p>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
                        <div className="bg-card rounded-lg p-2 md:p-3 border">
                          <div className="flex items-start gap-2 md:gap-3">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">AI 助手</p>
                              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                                我是您的智能写作助手。我可以帮助您优化段落结构、改进语言表达，并提供相关的研究建议。
                              </p>
                            </div>
                          </div>
                        </div>

                        {chatMessage && (
                          <div className="bg-primary/10 rounded-lg p-3 ml-8">
                            <p className="text-sm">{chatMessage}</p>
                          </div>
                        )}
                      </div>

                      {/* Chat Input */}
                      <div className="border-t p-3 md:p-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="输入您的问题或需求..."
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            className="flex-1 text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && chatMessage.trim()) {
                                // 处理发送消息
                                setChatMessage('');
                              }
                            }}
                          />
                          <Button size="sm" disabled={!chatMessage.trim()} className="px-2 md:px-4">
                            <Send className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {stage.id === 'suggestions' && (
                <div className="flex-1 overflow-auto">
                  <div className="container max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-8">
                    <div className="mb-6 md:mb-8">
                      <h2 className="text-xl md:text-2xl font-bold mb-2">AI 改进建议</h2>
                      <p className="text-sm md:text-base text-muted-foreground">基于您的内容，我们为您提供了以下改进建议</p>
                    </div>

                    <div className="grid gap-4 md:gap-6">
                      {paragraphs.map((paragraph) => (
                        paragraph.suggestions && paragraph.suggestions.length > 0 && (
                          <div key={paragraph.id} className="bg-card rounded-lg p-4 md:p-6 border">
                            <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">段落 {paragraph.id}</h3>
                            <div className="space-y-4">
                              {paragraph.suggestions.map((suggestion) => (
                                <SuggestionCard
                                  key={suggestion.id}
                                  id={suggestion.id}
                                  type={suggestion.type}
                                  title={suggestion.title}
                                  description={suggestion.description}
                                  suggestion={suggestion.suggestion}
                                  onAccept={() => applySuggestion(paragraph.id, suggestion)}
                                  onReject={() => ignoreSuggestion(paragraph.id, suggestion.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>

                    {paragraphs.every(p => !p.suggestions || p.suggestions.length === 0) && (
                      <div className="text-center py-12">
                        <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">暂无AI建议，请先为段落生成建议</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {stage.id === 'review' && (
                <div className="flex-1 overflow-auto">
                  <div className="container max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-8">
                    <div className="mb-6 md:mb-8">
                      <h2 className="text-xl md:text-2xl font-bold mb-2">最终审查</h2>
                      <p className="text-sm md:text-base text-muted-foreground">请审查您的最终内容</p>
                    </div>

                    <Card className="mb-4 md:mb-6">
                      <CardContent className="p-4 md:p-6">
                        <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">{title}</h3>
                        <div className="space-y-4">
                          {paragraphs.map((paragraph) => (
                            <div key={paragraph.id} className="prose max-w-none">
                              <p dangerouslySetInnerHTML={{ __html: paragraph.content }} />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-3 md:gap-4">
                      <div className="flex items-center justify-between p-3 md:p-4 bg-muted rounded-lg text-sm md:text-base">
                        <span className="font-medium">总字数</span>
                        <span className="text-muted-foreground">{wordCount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 md:p-4 bg-muted rounded-lg text-sm md:text-base">
                        <span className="font-medium">预计阅读时间</span>
                        <span className="text-muted-foreground">{readTime} 分钟</span>
                      </div>
                      <div className="flex items-center justify-between p-3 md:p-4 bg-muted rounded-lg text-sm md:text-base">
                        <span className="font-medium">引用数量</span>
                        <span className="text-muted-foreground">{citations.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {stage.id === 'complete' && (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center max-w-md">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                      <Check className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-2">草稿生成完成！</h2>
                    <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">您的草稿已成功生成并保存</p>
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                      <Button onClick={() => navigate(`/project/${projectId}`)}>
                        返回项目
                      </Button>
                      <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        导出PDF
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </FlowTransition>
      </div>

      {/* Log Panel */}
      {showLogPanel && (
        <div className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">操作日志</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-auto">
              {logMessages.map((log, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground text-xs">{log.time}</span>
                  <span className={`flex-1 ${
                    log.type === 'success' ? 'text-green-600' :
                    log.type === 'error' ? 'text-red-600' :
                    'text-foreground'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citation Dialog */}
      <Dialog open={citationPopoverOpen} onOpenChange={setCitationPopoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>引用详情</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            引用详情功能开发中...
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}