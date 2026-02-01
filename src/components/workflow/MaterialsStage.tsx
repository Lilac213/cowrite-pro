import { useState } from 'react';
import { updateProject, createDraft, getLatestDraft, updateDraft, callLLMGenerate, getBrief, getKnowledgeBase, getOutlines } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      const brief = await getBrief(projectId);
      const knowledge = await getKnowledgeBase(projectId);
      const outlines = await getOutlines(projectId);

      const selectedKnowledge = knowledge.filter((k) => k.selected);
      const selectedOutlines = outlines.filter((o) => o.selected);

      let prompt = `基于以下信息生成完整文章：

需求：${JSON.stringify(brief?.requirements || {})}

知识库：
${selectedKnowledge.map((k) => `- ${k.title}: ${k.content}`).join('\n')}

段落结构：
${selectedOutlines.map((o, i) => `${i + 1}. ${o.summary}`).join('\n')}`;

      // 添加个人素材
      if (experience || opinion || caseStudy) {
        prompt += `\n\n个人素材：`;
        if (experience) prompt += `\n亲身经历：${experience}`;
        if (opinion) prompt += `\n个人观点：${opinion}`;
        if (caseStudy) prompt += `\n案例故事：${caseStudy}`;
      }

      prompt += `\n\n请生成一篇完整的文章。`;

      const result = await callLLMGenerate(prompt);

      // 保存草稿
      const existingDraft = await getLatestDraft(projectId);
      if (!existingDraft) {
        await createDraft({
          project_id: projectId,
          content: result,
          version: 1,
        });
      } else {
        await updateDraft(existingDraft.id, {
          content: result,
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
      toast({
        title: '生成失败',
        description: error.message || '无法生成文章',
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
