import { useState, useEffect } from 'react';
import { getOutlines, batchCreateOutlines, updateOutline, deleteOutline, updateProject, callLLMGenerate, getBrief, getKnowledgeBase } from '@/db/api';
import type { Outline } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OutlineStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function OutlineStage({ projectId, onComplete }: OutlineStageProps) {
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadOutlines();
  }, [projectId]);

  const loadOutlines = async () => {
    try {
      const data = await getOutlines(projectId);
      setOutlines(data);
    } catch (error) {
      console.error('加载大纲失败:', error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const brief = await getBrief(projectId);
      const knowledge = await getKnowledgeBase(projectId);
      const selectedKnowledge = knowledge.filter((k) => k.selected);

      const prompt = `基于以下需求和知识库，生成 7-8 个段落摘要（每个摘要一句话）：

需求：${JSON.stringify(brief?.requirements || {})}

知识库：
${selectedKnowledge.map((k) => `- ${k.title}: ${k.content}`).join('\n')}

请返回一个 JSON 数组，每个元素包含 summary 字段。`;

      const result = await callLLMGenerate(prompt);
      const summaries = JSON.parse(result);

      const newOutlines = summaries.map((item: any, index: number) => ({
        project_id: projectId,
        paragraph_order: index + 1,
        summary: item.summary,
        selected: true,
      }));

      await batchCreateOutlines(newOutlines);
      await loadOutlines();

      toast({
        title: '生成成功',
        description: '段落摘要已生成',
      });
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message || '无法生成大纲',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateSummary = async (id: string, summary: string) => {
    try {
      await updateOutline(id, { summary });
    } catch (error) {
      toast({
        title: '更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSelect = async (id: string, selected: boolean) => {
    try {
      await updateOutline(id, { selected: !selected });
      await loadOutlines();
    } catch (error) {
      toast({
        title: '更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOutline(id);
      await loadOutlines();
    } catch (error) {
      toast({
        title: '删除失败',
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = async () => {
    const selectedCount = outlines.filter((o) => o.selected).length;
    if (selectedCount === 0) {
      toast({
        title: '请至少选择一个段落',
        variant: 'destructive',
      });
      return;
    }

    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'drafting' });
      toast({
        title: '确认成功',
        description: '进入下一阶段',
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
          <CardTitle>段落摘要</CardTitle>
          <CardDescription>生成并编辑文章段落结构</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating || outlines.length > 0}>
            <Plus className="h-4 w-4 mr-2" />
            {generating ? '生成中...' : '生成段落摘要'}
          </Button>
        </CardContent>
      </Card>

      {outlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>段落列表</CardTitle>
            <CardDescription>
              已选择 {outlines.filter((o) => o.selected).length} / {outlines.length} 个段落
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {outlines.map((outline, index) => (
              <div key={outline.id} className="flex items-center gap-3 p-3 border border-border rounded-md">
                <Checkbox
                  checked={outline.selected}
                  onCheckedChange={() => handleToggleSelect(outline.id, outline.selected)}
                />
                <span className="text-sm text-muted-foreground w-8">{index + 1}.</span>
                <Input
                  value={outline.summary}
                  onChange={(e) => handleUpdateSummary(outline.id, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="sm" onClick={() => handleDelete(outline.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end pt-4">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? '确认中...' : '确认结构'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
