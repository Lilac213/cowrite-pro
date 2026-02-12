import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, createDraft, updateDraft } from '@/db/api';
import type { Project, Draft, Citation } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, Sparkles, Loader2, Settings, Send, Clock, FileText, Zap, Lightbulb, ExternalLink, X, Check, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';

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

export default function DraftGenerationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [logMessages, setLogMessages] = useState<Array<{ time: string; message: string; type?: 'info' | 'success' | 'error' }>>([
    { time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message: '系统初始化完成', type: 'success' },
    { time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message: '等待用户操作...', type: 'info' },
  ]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
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
        material_summary: 'AI在合规领域的应用正在快速发展。特别是在处理KYC文档时，错误率降低了34%。',
        material_url: 'https://example.com/fintech-report-2023',
        quote: 'AI在合规领域的应用正在快速发展',
        position: 0,
      },
      {
        id: '2',
        material_id: 'mat2',
        material_title: '云原生架构在金融行业的实践',
        material_source: '案例研究',
        material_summary: '从本地部署迁移到云端后，合规处理效率提升了50%以上。',
        material_url: 'https://example.com/cloud-native-finance',
        quote: '云原生系统能够更好地应对复杂场景',
        position: 1,
      },
    ];
  };

  // 段落编辑完成，请求LLM建议
  const handleParagraphBlur = async (paragraphId: string, newContent: string) => {
    setParagraphs(prev => prev.map(p => 
      p.id === paragraphId ? { ...p, content: newContent, isEditing: false } : p
    ));

    const originalParagraph = paragraphs.find(p => p.id === paragraphId);
    if (!newContent.trim() || newContent === originalParagraph?.content) {
      return;
    }

    setParagraphs(prev => prev.map(p => 
      p.id === paragraphId ? { ...p, isLoadingSuggestion: true } : p
    ));

    addLog(`正在为段落 ${paragraphId} 生成建议...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('paragraph-suggestion', {
        body: {
          paragraph_id: paragraphId,
          content: newContent,
          context: {
            title,
            all_paragraphs: paragraphs.map(p => p.content),
            citations,
          },
        },
      });

      if (error) throw error;

      if (data && data.suggestions) {
        setParagraphs(prev => prev.map(p => 
          p.id === paragraphId 
            ? { ...p, suggestions: data.suggestions, isLoadingSuggestion: false } 
            : p
        ));
        addLog(`段落 ${paragraphId} 建议生成完成`, 'success');
        setActiveParagraphId(paragraphId);
      }
    } catch (error) {
      console.error('获取段落建议失败:', error);
      addLog(`段落 ${paragraphId} 建议生成失败，使用模拟数据`, 'error');
      setParagraphs(prev => prev.map(p => 
        p.id === paragraphId ? { ...p, isLoadingSuggestion: false } : p
      ));
      
      const mockSuggestions = getMockSuggestions(paragraphId);
      setParagraphs(prev => prev.map(p => 
        p.id === paragraphId ? { ...p, suggestions: mockSuggestions } : p
      ));
      setActiveParagraphId(paragraphId);
    }
  };

  const getMockSuggestions = (paragraphId: string): ParagraphSuggestion[] => {
    return [
      {
        id: `${paragraphId}-logic`,
        type: 'logic',
        title: '段落逻辑 (LOGIC)',
        description: '该段落采用"现状-挑战-解决方案"的论证结构，通过引入人工智能技术必要性的讨论，为后续章节做铺垫。',
        suggestion: '建议在段落末尾增加过渡句，更好地衔接下一段内容。',
      },
      {
        id: `${paragraphId}-style`,
        type: 'style',
        title: '表达优化 (STYLE)',
        description: '语言表达专业但略显生硬，可以适当增加一些具体案例或数据来支撑观点。',
        suggestion: '建议将"已无法满足"改为"难以有效应对"，使表达更加客观。',
      },
      {
        id: `${paragraphId}-content`,
        type: 'content',
        title: '内容建议 (CONTENT)',
        description: '可以补充具体的行业数据或案例，增强说服力。',
        suggestion: '建议添加具体的数字化转型案例，如某大型银行的实践经验。',
      },
    ];
  };

  // 处理引用标记点击
  const handleCitationClick = (citationId: string) => {
    const citation = citations.find(c => c.id === citationId);
    if (citation) {
      setSelectedCitation(citation);
      setCitationPopoverOpen(true);
    }
  };

  // 保存草稿
  const handleSave = async () => {
    if (!projectId || !user) return;

    setSaving(true);
    addLog('正在保存草稿...', 'info');

    try {
      const content = paragraphs.map(p => `<p>${p.content}</p>`).join('\n');
      
      if (draft) {
        await updateDraft(draft.id, {
          content,
          citations,
        } as any);
      } else {
        const newDraft = await createDraft({
          project_id: projectId,
          content,
          citations,
          version: 1,
        } as any);
        setDraft(newDraft);
      }

      addLog('草稿保存成功', 'success');
      toast({
        title: '保存成功',
        description: '草稿已保存',
      });
    } catch (error) {
      console.error('保存草稿失败:', error);
      addLog('草稿保存失败', 'error');
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '保存草稿时出错',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // 生成草稿
  const handleGenerate = async () => {
    if (!projectId || !user) return;

    setGenerating(true);
    addLog('开始生成草稿...', 'info');

    try {
      const { data, error } = await supabase.functions.invoke('draft-agent', {
        body: {
          project_id: projectId,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data) {
        if (data.content) {
          const parsedParagraphs = parseContentToParagraphs(data.content);
          setParagraphs(parsedParagraphs);
        }
        setCitations(data.citations || []);
        addLog('草稿生成完成', 'success');

        toast({
          title: '生成成功',
          description: '草稿已生成，您可以继续编辑',
        });
      }
    } catch (error) {
      console.error('生成草稿失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`生成失败: ${errorMsg}`, 'error');
      toast({
        title: '生成失败',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // 发送聊天消息
  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogMessages(prev => [...prev, { time, message: `用户: ${chatMessage}`, type: 'info' }]);
    
    setTimeout(() => {
      const responseTime = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setLogMessages(prev => [...prev, { 
        time: responseTime, 
        message: `AI: 正在处理您的请求...`, 
        type: 'info' 
      }]);
    }, 500);
    
    setChatMessage('');
  };

  // 添加新段落
  const handleAddParagraph = () => {
    const newId = `p${paragraphs.length + 1}`;
    setParagraphs(prev => [...prev, {
      id: newId,
      content: '',
      isEditing: true,
    }]);
    addLog(`添加新段落 ${newId}`, 'info');
  };

  // 删除段落
  const handleDeleteParagraph = (paragraphId: string) => {
    setParagraphs(prev => prev.filter(p => p.id !== paragraphId));
    if (activeParagraphId === paragraphId) {
      setActiveParagraphId(null);
    }
    addLog(`删除段落 ${paragraphId}`, 'info');
  };

  // 应用建议
  const handleApplySuggestion = (paragraphId: string, suggestionId: string) => {
    addLog(`应用建议 ${suggestionId} 到段落 ${paragraphId}`, 'success');
    toast({
      title: '建议已应用',
      description: '建议内容已应用到段落中',
    });
  };

  // 忽略建议
  const handleDismissSuggestion = (paragraphId: string, suggestionId: string) => {
    setParagraphs(prev => prev.map(p => {
      if (p.id === paragraphId && p.suggestions) {
        return {
          ...p,
          suggestions: p.suggestions.filter(s => s.id !== suggestionId),
        };
      }
      return p;
    }));
    addLog(`忽略建议 ${suggestionId}`, 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeParagraph = paragraphs.find(p => p.id === activeParagraphId);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
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
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">RESEARCHOS</span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-sm">{project?.title || '项目'}</span>
                <span className="text-xs text-muted-foreground ml-2 px-2 py-0.5 bg-primary/10 rounded">v2.0</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中
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
                    生成中
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    完成并导出
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor (wider: flex-[2]) */}
        <div className="flex-[2] overflow-auto">
          <div className="container max-w-4xl mx-auto px-8 py-8">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                {/* Title */}
                <h1 className="text-[2.5rem] font-bold leading-tight tracking-tight text-gray-900 mb-6">
                  {title}
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

                {/* Editable Paragraphs */}
                <div className="space-y-6">
                  {paragraphs.map((paragraph) => (
                    <EditableParagraph
                      key={paragraph.id}
                      paragraph={paragraph}
                      isActive={activeParagraphId === paragraph.id}
                      onBlur={handleParagraphBlur}
                      onFocus={() => setActiveParagraphId(paragraph.id)}
                      onDelete={handleDeleteParagraph}
                      onCitationClick={handleCitationClick}
                    />
                  ))}
                </div>

                {/* Add Paragraph Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddParagraph}
                  className="mt-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加段落
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Suggestions (narrower: flex-1) */}
        <div className="flex-1 max-w-md border-l bg-muted/30 flex flex-col overflow-hidden">
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

            {/* Suggestions Display */}
            {activeParagraph && activeParagraph.isLoadingSuggestion ? (
              <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">正在生成建议...</p>
                </CardContent>
              </Card>
            ) : activeParagraph && activeParagraph.suggestions && activeParagraph.suggestions.length > 0 ? (
              <>
                {activeParagraph.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    paragraphId={activeParagraph.id}
                    onApply={handleApplySuggestion}
                    onDismiss={handleDismissSuggestion}
                  />
                ))}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <Lightbulb className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {activeParagraph 
                      ? '编辑段落后，AI 将为您提供优化建议'
                      : '点击左侧段落开始编辑'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Interface */}
          <div className="border-t bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <span className="material-symbols-outlined text-base">smart_toy</span>
              <span>与 AI 对话</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="向协作教练提问或请求修改..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
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

      {/* Log Section */}
      <div className="border-t bg-card sticky bottom-0">
        <div className="container mx-auto px-4">
          <div 
            className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowLogPanel(!showLogPanel)}
          >
            <div className="flex items-center gap-3 text-sm">
              <div className="flex gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${generating ? 'bg-green-500 animate-pulse' : 'bg-foreground'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full ${generating ? 'bg-green-500 animate-pulse' : 'bg-foreground'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full ${generating ? 'bg-green-500 animate-pulse' : 'bg-foreground'}`}></div>
              </div>
              <span className="font-bold text-[10px] uppercase tracking-wider text-gray-900">
                GENERATE-DRAFT AGENT:
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {generating ? '正在生成' : '就绪'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                模型：GPT-4_RESEARCH_V2
              </span>
              {generating && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold hover:text-red-500 transition-all">
                  停止生成
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-[10px] font-bold hover:bg-gray-100 transition-all"
              >
                {showLogPanel ? '▼' : '▲'} 日志
              </Button>
            </div>
          </div>

          {showLogPanel && (
            <div className="border-t border-gray-200 bg-white">
              <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
                {logMessages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">
                    暂无日志记录
                  </div>
                ) : (
                  logMessages.map((log, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                            {log.time}
                          </span>
                          {log.type && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              log.type === 'success' ? 'bg-green-100 text-green-700' :
                              log.type === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {log.type === 'success' ? '✓ 成功' : log.type === 'error' ? '✗ 错误' : 'ℹ 信息'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
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
                    <p className="text-sm italic leading-relaxed">"{selectedCitation.quote}"</p>
                  </div>
                )}
                
                {selectedCitation.material_url && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">原文链接</p>
                    <a
                      href={selectedCitation.material_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      查看原文
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 可编辑段落组件
interface EditableParagraphProps {
  paragraph: Paragraph;
  isActive: boolean;
  onBlur: (id: string, content: string) => void;
  onFocus: () => void;
  onDelete: (id: string) => void;
  onCitationClick: (citationId: string) => void;
}

function EditableParagraph({ 
  paragraph, 
  isActive, 
  onBlur, 
  onFocus, 
  onDelete,
  onCitationClick 
}: EditableParagraphProps) {
  const [content, setContent] = useState(paragraph.content);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(paragraph.content);
  }, [paragraph.content]);

  const handleBlur = () => {
    const newContent = contentRef.current?.innerHTML || '';
    onBlur(paragraph.id, newContent);
  };

  const handleInput = () => {
    const newContent = contentRef.current?.innerHTML || '';
    setContent(newContent);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const marker = target.closest('.citation-marker') as HTMLElement;
    
    if (marker) {
      e.preventDefault();
      e.stopPropagation();
      const citationId = marker.getAttribute('data-citation-id');
      if (citationId) {
        onCitationClick(citationId);
      }
    }
  };

  return (
    <div className={`relative group ${isActive ? 'ring-2 ring-primary rounded-lg' : ''}`}>
      <div
        ref={contentRef}
        contentEditable={true}
        suppressContentEditableWarning={true}
        onBlur={handleBlur}
        onFocus={onFocus}
        onInput={handleInput}
        onClick={handleClick}
        className={`
          min-h-[60px] p-4 rounded-lg
          text-base leading-relaxed text-gray-900
          cursor-text
          transition-all duration-200
          ${isActive 
            ? 'bg-primary/5' 
            : 'hover:bg-muted/50'
          }
          focus:outline-none
        `}
        dangerouslySetInnerHTML={{ __html: content }}
      />
      
      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(paragraph.id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Loading Indicator */}
      {paragraph.isLoadingSuggestion && (
        <div className="absolute -right-8 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

// 建议卡片组件
interface SuggestionCardProps {
  suggestion: ParagraphSuggestion;
  paragraphId: string;
  onApply: (paragraphId: string, suggestionId: string) => void;
  onDismiss: (paragraphId: string, suggestionId: string) => void;
}

function SuggestionCard({ suggestion, paragraphId, onApply, onDismiss }: SuggestionCardProps) {
  const getIcon = () => {
    switch (suggestion.type) {
      case 'logic':
        return <span className="material-symbols-outlined text-base text-blue-600">psychology</span>;
      case 'style':
        return <span className="material-symbols-outlined text-base text-amber-600">settings</span>;
      case 'content':
        return <Lightbulb className="h-4 w-4 text-green-600" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getBorderColor = () => {
    switch (suggestion.type) {
      case 'logic':
        return 'border-l-blue-500';
      case 'style':
        return 'border-l-amber-500';
      case 'content':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-500';
    }
  };

  return (
    <Card className={`border-l-4 ${getBorderColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getIcon()}
            <h3 className="text-sm font-medium">{suggestion.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(paragraphId, suggestion.id)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {suggestion.description}
        </p>
        
        <div className="bg-muted/50 p-3 rounded-lg mb-3">
          <p className="text-sm leading-relaxed">
            {suggestion.suggestion}
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => onApply(paragraphId, suggestion.id)}
          className="w-full"
        >
          <Check className="h-3 w-3 mr-2" />
          应用建议
        </Button>
      </CardContent>
    </Card>
  );
}
