import { useState } from 'react';
import { updateProject } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface MaterialsStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function MaterialsStage({ projectId, onComplete }: MaterialsStageProps) {
  const [experience, setExperience] = useState('');
  const [opinion, setOpinion] = useState('');
  const [caseStudy, setCaseStudy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const handleSkip = async () => {
    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'review_pass_1' });
      toast({
        title: '已跳过',
        description: '进入文章生成阶段',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '操作失败',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // 这里可以保存个人素材到数据库
      await updateProject(projectId, { status: 'review_pass_1' });
      toast({
        title: '确认成功',
        description: '进入文章生成阶段',
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
          <CardTitle>个人素材（可选）</CardTitle>
          <CardDescription>添加个人经历、观点或案例，使文章更具个性化</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="experience">个人经历</Label>
            <Textarea
              id="experience"
              placeholder="分享相关的个人经历..."
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opinion">观点</Label>
            <Textarea
              id="opinion"
              placeholder="表达您的观点..."
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="case">案例 / 实验</Label>
            <Textarea
              id="case"
              placeholder="描述相关案例或实验..."
              value={caseStudy}
              onChange={(e) => setCaseStudy(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleSkip} disabled={confirming}>
              跳过
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? '确认中...' : '确认并继续'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
