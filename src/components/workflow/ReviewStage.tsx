import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLatestDraft, updateDraft, updateProject, callLLMGenerate } from '@/db/api';
import type { Draft } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { diffWords } from 'diff';
import { DEFAULT_POLISH_PROMPT, DEFAULT_ENHANCE_PROMPT, RHYTHM_PROMPT } from '@/constants/prompts';

interface ReviewStageProps {
  projectId: string;
  onComplete: () => void;
}

type ReviewStep = 'content' | 'style' | 'detail';


export default function ReviewStage({ projectId, onComplete }: ReviewStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [completedSteps, setCompletedSteps] = useState<ReviewStep[]>([]);
  const [processingStep, setProcessingStep] = useState<ReviewStep | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDraft();
  }, [projectId]);

  const loadDraft = async () => {
    setLoading(true);
    try {
      const data = await getLatestDraft(projectId);
      if (data) {
        setDraft(data);
        setCurrentContent(data.content || '');
        setOriginalContent(data.content || '');
      } else {
        toast({
          title: '未找到草稿',
          description: '请先在文章生成阶段生成内容',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载文章内容',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (step: ReviewStep) => {
    if (!currentContent) {
      toast({
        title: '无内容',
        description: '请先生成文章内容',
        variant: 'destructive',
      });
      return;
    }

    setProcessingStep(step);
    setProgress(0);
    
    // 模拟进度更新
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const next = prev + Math.random() * 15;
        return Math.min(next, 90); // 确保不超过 90
      });
    }, 500);
    
    try {
      let systemMessage = '';
      
      if (step === 'content') {
        systemMessage = DEFAULT_POLISH_PROMPT;
      } else if (step === 'style') {
        systemMessage = DEFAULT_ENHANCE_PROMPT;
      } else if (step === 'detail') {
        systemMessage = RHYTHM_PROMPT;
      }

      const result = await callLLMGenerate(currentContent, '', systemMessage);
      
      clearInterval(progressInterval);
      setProgress(100); // 完成时设置为 100
      
      // 等待一下让用户看到100%
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setCurrentContent(result);
      setCompletedSteps([...completedSteps, step]);
      
      // 保存到草稿
      if (draft) {
        await updateDraft(draft.id, { content: result });
      }
      
      toast({
        title: '审校完成',
        description: getStepName(step) + ' 已完成',
      });
    } catch (error: any) {
      clearInterval(progressInterval);
      toast({
        title: '审校失败',
        description: error.message || '无法完成审校',
        variant: 'destructive',
      });
    } finally {
      setProcessingStep(null);
      setProgress(0);
    }
  };

  const handleConfirm = async () => {
    if (completedSteps.length < 3) {
      toast({
        title: '请完成所有审校步骤',
        variant: 'destructive',
      });
      return;
    }

    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'layout_export' });
      toast({
        title: '审校完成',
        description: '即将进入排版导出页面',
      });
      
      // 刷新项目状态
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('审校确认失败:', error);
      toast({
        title: '确认失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
      setConfirming(false);
    }
  };

  const getStepName = (step: ReviewStep) => {
    switch (step) {
      case 'content':
        return '第一遍：内容审校';
      case 'style':
        return '第二遍：风格审校';
      case 'detail':
        return '第三遍：细节打磨';
    }
  };

  const renderDiff = () => {
    const diff = diffWords(originalContent, currentContent);
    
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-200 dark:bg-green-900/50">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={index} className="bg-red-200 dark:bg-red-900/50 line-through">
                {part.value}
              </span>
            );
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>内容审校</CardTitle>
          <CardDescription>
            三遍审校流程：内容审校 → 风格审校 → 细节打磨
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">加载文章内容中...</p>
            </div>
          </CardContent>
        </Card>
      ) : !currentContent ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <Circle className="h-12 w-12 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">无内容</h3>
                <p className="text-muted-foreground">请先生成文章内容</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : completedSteps.length === 3 ? (
        // 显示最终文案（三遍审校完成后）
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">最终文章</CardTitle>
                  <CardDescription className="mt-2">
                    三遍审校已完成，以下是最终精修稿
                  </CardDescription>
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  审校完成
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none p-6 bg-background rounded-lg border">
                <div className="whitespace-pre-wrap text-base leading-relaxed">
                  {currentContent}
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleConfirm}
                  disabled={confirming}
                  size="lg"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      确认中...
                    </>
                  ) : (
                    '确认完成'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{/* Rest of the content */}
        {/* 左侧：文章内容 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>文章内容</CardTitle>
            <CardDescription>
              {completedSteps.length > 0 
                ? `已完成 ${completedSteps.length}/3 遍审校` 
                : '原始内容'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto p-4 bg-muted rounded-lg">
              {currentContent !== originalContent ? renderDiff() : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{currentContent}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：审校步骤 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>审校步骤</CardTitle>
            <CardDescription>请按顺序完成三遍审校</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 第一遍：内容审校 */}
            <Card className={completedSteps.includes('content') ? 'border-green-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {completedSteps.includes('content') ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">第一遍：内容审校</CardTitle>
                  </div>
                  {completedSteps.includes('content') && (
                    <Badge variant="default">已完成</Badge>
                  )}
                </div>
                <CardDescription>
                  检查事实准确性、逻辑清晰性、结构合理性
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingStep === 'content' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">处理中...</span>
                      <span className="font-medium">{Math.min(Math.round(progress), 100)}%</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => handleReview('content')}
                  disabled={processingStep !== null || completedSteps.includes('content')}
                  className="w-full"
                >
                  {processingStep === 'content' && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {completedSteps.includes('content') ? '已完成' : '开始审校'}
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* 第二遍：风格审校 */}
            <Card className={completedSteps.includes('style') ? 'border-green-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {completedSteps.includes('style') ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">第二遍：风格审校</CardTitle>
                  </div>
                  {completedSteps.includes('style') && (
                    <Badge variant="default">已完成</Badge>
                  )}
                </div>
                <CardDescription>
                  降低 AI 味，删除套话，改成口语化，加入真实细节
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingStep === 'style' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">处理中...</span>
                      <span className="font-medium">{Math.min(Math.round(progress), 100)}%</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => handleReview('style')}
                  disabled={processingStep !== null || !completedSteps.includes('content') || completedSteps.includes('style')}
                  className="w-full"
                >
                  {processingStep === 'style' && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {completedSteps.includes('style') ? '已完成' : '开始审校'}
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* 第三遍：细节打磨 */}
            <Card className={completedSteps.includes('detail') ? 'border-green-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {completedSteps.includes('detail') ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">第三遍：细节打磨</CardTitle>
                  </div>
                  {completedSteps.includes('detail') && (
                    <Badge variant="default">已完成</Badge>
                  )}
                </div>
                <CardDescription>
                  检查句子长度、段落长度、标点自然、节奏变化
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingStep === 'detail' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">处理中...</span>
                      <span className="font-medium">{Math.min(Math.round(progress), 100)}%</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => handleReview('detail')}
                  disabled={processingStep !== null || !completedSteps.includes('style') || completedSteps.includes('detail')}
                  className="w-full"
                >
                  {processingStep === 'detail' && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {completedSteps.includes('detail') ? '已完成' : '开始审校'}
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* 确认完成 */}
            <div className="flex justify-end">
              <Button
                onClick={handleConfirm}
                disabled={confirming || completedSteps.length < 3}
                size="lg"
              >
                {confirming ? '确认中...' : '确认完成'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
