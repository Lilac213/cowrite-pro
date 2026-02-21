import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLatestDraft, updateDraft, callDraftContentAgent, callDraftAnalysisAgent } from '@/api';
import type { Draft, ParagraphAnnotation } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import DraftWithAnnotations from './DraftWithAnnotations';
import { Loader2, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { useTypewriter } from '@/hooks/useTypewriter';

interface DraftStageProps {
  projectId: string;
  onComplete?: () => void;
  readonly?: boolean;
}

export default function DraftStage({ projectId, onComplete, readonly }: DraftStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [annotations, setAnnotations] = useState<ParagraphAnnotation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'annotated' | 'plain'>('annotated');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Typewriter effect hook
  const { displayedText, isTyping } = useTypewriter(content, { speed: 10 });

  useEffect(() => {
    loadDraft();
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

  const handleGenerate = async () => {
    setGenerating(true);
    setAnalyzing(false);
    setContent('');
    setAnnotations([]);
    
    try {
      // 1. Generate Content
      const contentResult: any = await callDraftContentAgent(projectId);
      
      if (contentResult.success) {
        const fullContent = contentResult.content || '';
        const draftId = contentResult.draft_id;
        
        // Update content to start typing
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
          <p className="text-lg font-medium">正在生成文章...</p>
          <p className="text-sm text-muted-foreground mt-2">
            AI 正在分析资料并撰写初稿
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            文章草稿
            {analyzing && <Badge variant="secondary" className="animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin"/> 分析结构中...</Badge>}
          </h2>
          <p className="text-muted-foreground mt-1">
            查看文章内容和段落注释，了解每段的来源和生成逻辑
          </p>
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

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'annotated' | 'plain')}>
        <TabsList>
          <TabsTrigger value="annotated" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            注释视图
          </TabsTrigger>
          <TabsTrigger value="plain" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            纯文本视图
          </TabsTrigger>
        </TabsList>

        <TabsContent value="annotated" className="mt-6">
            <DraftWithAnnotations
              content={isTyping ? displayedText : content}
              annotations={annotations}
              onContentChange={setContent}
              readonly={readonly || isTyping}
            />
        </TabsContent>

        <TabsContent value="plain" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>文章内容</CardTitle>
              <CardDescription>纯文本编辑模式</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={isTyping ? displayedText : content}
                onChange={(e) => setContent(e.target.value)}
                rows={25}
                disabled={readonly || isTyping}
                className="font-mono"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
