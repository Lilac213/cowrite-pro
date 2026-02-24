import { useState, useEffect, Component } from 'react';
import { getLatestDraft, updateDraft, callDraftContentAgent, callDraftAnalysisAgent } from '@/api';
import { getWritingSession, getResearchInsights, getResearchGaps } from '@/api/session.api';
import { getStructureResult } from '@/db/api';
import type { Draft, ParagraphAnnotation, ResearchGap, ResearchInsight } from '@/types';
import { refineParagraph } from '@/api/draft.api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import DraftWithAnnotations from './DraftWithAnnotations';
import { Loader2, FileText, AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTypewriter } from '@/hooks/useTypewriter';

interface DraftStageProps {
  projectId: string;
  onComplete?: () => void;
  readonly?: boolean;
}

class DraftErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircle className="mt-0.5" />
            <AlertTitle>页面渲染失败</AlertTitle>
            <AlertDescription>请刷新页面后重试</AlertDescription>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DraftStage({ projectId, onComplete, readonly }: DraftStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [annotations, setAnnotations] = useState<ParagraphAnnotation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [structureResult, setStructureResult] = useState<any>(null);
  const [insights, setInsights] = useState<ResearchInsight[]>([]);
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [aiTypingEnabled, setAiTypingEnabled] = useState(false);
  const [typingParagraphId, setTypingParagraphId] = useState<string | null>(null);
  const [typingParagraphContent, setTypingParagraphContent] = useState('');
  const [typingParagraphActive, setTypingParagraphActive] = useState(false);
  const [regeneratingParagraphId, setRegeneratingParagraphId] = useState<string | null>(null);
  const { toast } = useToast();

  // Typewriter effect hook
  const { displayedText, isTyping } = useTypewriter(content, { speed: 10, enabled: aiTypingEnabled, onComplete: () => setAiTypingEnabled(false) });

  useEffect(() => {
    loadDraft();
    loadSessionData();
  }, [projectId]);

  const loadDraft = async () => {
    try {
      const data = await getLatestDraft(projectId);
      if (data) {
        setDraft(data);
        setContent(data.content || '');
        if (data.annotations) {
          setAnnotations(data.annotations);
        }
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
  };

  const loadSessionData = async () => {
    try {
      const session = await getWritingSession(projectId);
      if (!session) return;
      const [insightData, gapData, structure] = await Promise.all([
        getResearchInsights(session.id),
        getResearchGaps(session.id),
        getStructureResult(session.id)
      ]);
      setInsights((insightData || []).filter(i => i.user_decision === 'adopt'));
      setGaps((gapData || []).filter(g => g.user_decision === 'respond'));
      setStructureResult(structure);
    } catch (error) {
      console.error('加载研究资料失败:', error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setAnalyzing(false);
    setGenerateError(null);
    setContent('');
    setAnnotations([]);
    
    try {
      // 1. Generate Content
      const contentResult: any = await callDraftContentAgent(projectId);
      
      if (contentResult.success) {
        const fullContent = contentResult.content || '';
        const draftId = contentResult.draft_id;
        
        // Update content to start typing
        setAiTypingEnabled(true);
        setContent(fullContent);
        setGenerating(false); // Stop "generating" spinner, start typing
        
        // Update draft state with basic info
        setDraft({
             id: draftId,
             project_id: projectId,
             content: fullContent,
             annotations: [],
             version: 1,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
         } as Draft);

        // 2. Start Analysis (async)
        setAnalyzing(true);
        
        // Use a slight delay to let the UI settle/typing start
        setTimeout(() => {
            callDraftAnalysisAgent(draftId).then(async (analysisResult: any) => {
                if (analysisResult.success) {
                  setAnnotations(analysisResult.annotations || []);
                  
                  // Reload latest draft to sync everything
                  const newDraft = await getLatestDraft(projectId);
                  if (newDraft) setDraft(newDraft);
        
                  toast({
                    title: '分析完成',
                    description: `已生成 ${analysisResult.annotations?.length || 0} 条注释`,
                  });
                } else {
                    console.error('Analysis failed:', analysisResult.error);
                     toast({
                        title: '分析失败',
                        description: analysisResult.error || '无法生成注释',
                        variant: 'destructive',
                    });
                }
            }).catch((err: any) => {
                 console.error('Analysis error:', err);
                 toast({
                    title: '分析错误',
                    description: '无法生成注释',
                    variant: 'destructive',
                });
            }).finally(() => {
                setAnalyzing(false);
            });
        }, 1000);

      } else {
        throw new Error(contentResult.error || '生成失败');
      }

    } catch (error: any) {
      console.error('Generate draft error:', error);
      setGenerateError('生成失败，请重新点击生成按钮再次尝试');
      toast({
        title: '生成失败',
        description: error.message || '无法生成文章',
        variant: 'destructive',
      });
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    try {
      await updateDraft(draft.id, { 
        content,
        annotations,
      });
      toast({
        title: '保存成功',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateParagraph = async (paragraphId: string, paragraphText: string) => {
    if (!paragraphText) return;
    setRegeneratingParagraphId(paragraphId);
    setTypingParagraphId(paragraphId);
    setTypingParagraphContent('');
    setTypingParagraphActive(false);
    setAiTypingEnabled(false);
    try {
      const result: any = await refineParagraph(
        paragraphText,
        '请基于上下文重写本段，保持原意，修正逻辑与语言不通顺问题，尽量小幅修改并保留引用标记。',
        content
      );
      if (!result?.refined_content) {
        throw new Error(result?.error || '段落重写失败');
      }
      const paragraphs = (content || '').split(/\n\n+/).filter(p => p.trim());
      const index = parseInt(paragraphId.replace('P', '')) - 1;
      if (index >= 0 && index < paragraphs.length) {
        paragraphs[index] = result.refined_content;
        const newContent = paragraphs.join('\n\n');
        setContent(newContent);
        setTypingParagraphContent(result.refined_content);
        setTypingParagraphActive(true);
      }
    } catch (error) {
      toast({
        title: '段落重写失败',
        description: error instanceof Error ? error.message : '无法重写该段落',
        variant: 'destructive',
      });
      setTypingParagraphId(null);
      setTypingParagraphContent('');
      setTypingParagraphActive(false);
    } finally {
      setRegeneratingParagraphId(null);
    }
  };

  if (!draft && !generating && !content) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>文章草稿</CardTitle>
          <CardDescription>生成带有可解释注释的学术文章初稿</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                生成文章
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">正在为你生成文章草稿...</p>
          <p className="text-sm text-muted-foreground mt-2">
            步骤 1/3：加载研究资料与写作结构
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            随后将依次完成 步骤 2/3：生成正文草稿，步骤 3/3：结构分析与协作建议
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            文章草稿
            {analyzing && <Badge variant="secondary" className="animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin"/> 分析结构中...</Badge>}
          </h2>
          <p className="text-muted-foreground mt-1">
            {analyzing
              ? '步骤 3/3：正文已生成，AI 正在分析段落结构并补充协作建议'
              : '全部 3 个步骤已完成，现在可以在协作模式下优化段落，或在审阅模式通读全文'}
          </p>
          {generateError && (
            <div className="mt-3 animate-in fade-in">
              <Alert className="max-w-xl">
                <AlertCircle className="mt-0.5" />
                <AlertTitle>生成失败</AlertTitle>
                <AlertDescription className="flex items-center gap-3">
                  <span>{generateError}</span>
                  <Button size="sm" variant="outline" onClick={handleGenerate} className="h-7 px-2 gap-1">
                    <RotateCcw className="h-3 w-3" /> 重试
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <>
              <Button variant="outline" onClick={handleGenerate} disabled={generating || analyzing || isTyping}>
                {(generating || analyzing || isTyping) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中
                  </>
                ) : (
                  '重新生成'
                )}
              </Button>
              <Button onClick={handleSave} disabled={saving || isTyping}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <DraftErrorBoundary>
        <DraftWithAnnotations
          content={isTyping ? displayedText : content}
          annotations={annotations}
          onContentChange={(newContent) => {
            setAiTypingEnabled(false);
            setContent(newContent);
          }}
          readonly={readonly || isTyping}
          projectId={projectId}
          insights={insights}
          gaps={gaps}
          structureResult={structureResult}
          onRegenerateParagraph={handleRegenerateParagraph}
          regeneratingParagraphId={regeneratingParagraphId || undefined}
          typingParagraphId={typingParagraphId || undefined}
          typingParagraphContent={typingParagraphContent}
          typingParagraphActive={typingParagraphActive}
          onTypingComplete={() => setTypingParagraphActive(false)}
        />
      </DraftErrorBoundary>
    </div>
  );
}
