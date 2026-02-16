import { useState } from 'react';
import { updateProject, createDraft, getLatestDraft, updateDraft, callDraftAgent } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

interface MaterialsStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function MaterialsStage({ projectId, onComplete }: MaterialsStageProps) {
  const [experience, setExperience] = useState('');
  const [opinion, setOpinion] = useState('');
  const [caseStudy, setCaseStudy] = useState('');
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const generateDraft = async () => {
    setGenerating(true);
    try {
      // 调用新的 draft-agent
      const result = await callDraftAgent(projectId);
      
      if (result.error) {
        throw new Error(result.details || result.error);
      }

      // 从 drafts 表读取生成的草稿
      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .select('payload_jsonb')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (draftError) throw draftError;

      const draftPayload = (draft as any).payload_jsonb;
      
      // 将结构化草稿转换为纯文本（用于兼容性）
      const contentText = draftPayload.draft_blocks
        .map((block: any) => block.content)
        .join('\n\n');

      // 保存到旧的 drafts 表（保持兼容性）
      const existingDraft = await getLatestDraft(projectId);
      if (!existingDraft) {
        await createDraft({
          project_id: projectId,
          content: contentText,
          version: 1,
        });
      } else {
        await updateDraft(existingDraft.id, {
          content: contentText,
          version: existingDraft.version + 1,
        });
      }

      // 更新项目状态
      await updateProject(projectId, { status: 'review_pass_1' });
      
      toast({
        title: '生成成功',
        description: '文章已生成，进入审校阶段',
      });
      
      onComplete();
    } catch (error: any) {
      console.error('生成失败详情:', error);
      
      let errorMessage = '无法生成文章';
      if (error.message && error.message.includes('未找到')) {
        errorMessage = '请先完成前序步骤（需求文档、资料搜索、文章结构）';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: '生成失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSkip = async () => {
    await generateDraft();
  };

  const handleConfirm = async () => {
    await generateDraft();
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
            <Button variant="outline" onClick={handleSkip} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                '跳过'
              )}
            </Button>
            <Button onClick={handleConfirm} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                '确认并继续'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
