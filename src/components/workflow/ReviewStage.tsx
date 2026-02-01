import { useState, useEffect } from 'react';
import { getReview, createReview, updateReview, updateProject, getLatestDraft, callLLMGenerate } from '@/db/api';
import type { Review, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface ReviewStageProps {
  projectId: string;
  project: Project;
  onComplete: () => void;
}

const reviewRounds = {
  review_pass_1: {
    round: 1 as const,
    title: '第一遍：内容审校',
    description: '检查事实准确性、逻辑清晰性、结构合理性',
    nextStatus: 'review_pass_2' as const,
  },
  review_pass_2: {
    round: 2 as const,
    title: '第二遍：风格审校',
    description: '删除套话、拆解 AI 句式、替换书面词汇',
    nextStatus: 'review_pass_3' as const,
  },
  review_pass_3: {
    round: 3 as const,
    title: '第三遍：细节打磨',
    description: '检查句子长度、段落长度、标点使用',
    nextStatus: 'completed' as const,
  },
};

export default function ReviewStage({ projectId, project, onComplete }: ReviewStageProps) {
  const [review, setReview] = useState<Review | null>(null);
  const [issues, setIssues] = useState('');
  const [completed, setCompleted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const currentRound = reviewRounds[project.status as keyof typeof reviewRounds];

  useEffect(() => {
    loadReview();
  }, [projectId, currentRound]);

  const loadReview = async () => {
    try {
      const data = await getReview(projectId, currentRound.round);
      if (data) {
        setReview(data);
        setIssues(JSON.stringify(data.issues || {}, null, 2));
        setCompleted(data.completed);
      }
    } catch (error) {
      console.error('加载审校失败:', error);
    }
  };

  const handleAutoCheck = async () => {
    setChecking(true);
    try {
      const draft = await getLatestDraft(projectId);
      if (!draft) {
        toast({
          title: '未找到草稿',
          variant: 'destructive',
        });
        return;
      }

      const prompt = `请对以下文章进行${currentRound.title}：

${draft.content}

要求：${currentRound.description}

请返回发现的问题列表，以 JSON 格式返回。`;

      const result = await callLLMGenerate(prompt);
      setIssues(result);

      if (!review) {
        const newReview = await createReview({
          project_id: projectId,
          review_round: currentRound.round,
          issues: JSON.parse(result),
          completed: false,
        });
        setReview(newReview);
      } else {
        const updated = await updateReview(review.id, {
          issues: JSON.parse(result),
        });
        setReview(updated);
      }

      toast({
        title: '检查完成',
      });
    } catch (error: any) {
      toast({
        title: '检查失败',
        description: error.message || '无法进行审校',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleConfirm = async () => {
    if (!review) return;

    setConfirming(true);
    try {
      await updateReview(review.id, { completed: true });
      await updateProject(projectId, { status: currentRound.nextStatus });
      toast({
        title: '审校完成',
        description: currentRound.nextStatus === 'completed' ? '项目已完成' : '进入下一轮审校',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '确认失败',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{currentRound.title}</CardTitle>
          <CardDescription>{currentRound.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleAutoCheck} disabled={checking}>
            {checking ? '检查中...' : 'AI 自动检查'}
          </Button>
          {issues && (
            <>
              <Textarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="completed"
                  checked={completed}
                  onCheckedChange={(checked) => setCompleted(checked as boolean)}
                />
                <label htmlFor="completed" className="text-sm">
                  我已完成本轮审校
                </label>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleConfirm} disabled={confirming || !completed}>
                  {confirming ? '确认中...' : '完成审校'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
