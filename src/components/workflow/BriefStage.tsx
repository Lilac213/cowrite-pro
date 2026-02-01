import { useState, useEffect } from 'react';
import { getBrief, createBrief, updateBrief, updateProject, callLLMGenerate } from '@/db/api';
import type { Brief } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface BriefStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function BriefStage({ projectId, onComplete }: BriefStageProps) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [topic, setTopic] = useState('');
  const [formatTemplate, setFormatTemplate] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generatedRequirements, setGeneratedRequirements] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadBrief();
  }, [projectId]);

  const loadBrief = async () => {
    try {
      const data = await getBrief(projectId);
      if (data) {
        setBrief(data);
        setTopic(data.topic);
        setFormatTemplate(data.format_template || '');
        setOutputFormat(data.output_format || '');
        if (data.requirements) {
          setGeneratedRequirements(JSON.stringify(data.requirements, null, 2));
        }
      }
    } catch (error) {
      console.error('加载需求失败:', error);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: '请输入选题',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const prompt = `请将以下写作需求结构化为需求文档：

选题：${topic}
格式模板：${formatTemplate || '无'}
输出格式：${outputFormat || '无'}

请生成一个结构化的需求文档，包括：
1. 文章主题
2. 目标读者
3. 核心观点
4. 预期长度
5. 写作风格
6. 关键要点

以 JSON 格式返回。`;

      const result = await callLLMGenerate(prompt);
      setGeneratedRequirements(result);

      if (!brief) {
        const newBrief = await createBrief({
          project_id: projectId,
          topic,
          format_template: formatTemplate || undefined,
          output_format: outputFormat || undefined,
          requirements: JSON.parse(result),
          confirmed: false,
        });
        setBrief(newBrief);
      } else {
        const updated = await updateBrief(brief.id, {
          topic,
          format_template: formatTemplate || undefined,
          output_format: outputFormat || undefined,
          requirements: JSON.parse(result),
        });
        setBrief(updated);
      }

      toast({
        title: '生成成功',
        description: '需求文档已生成',
      });
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message || '无法生成需求文档',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!brief) return;

    setConfirming(true);
    try {
      await updateBrief(brief.id, { confirmed: true });
      await updateProject(projectId, { status: 'knowledge_selected' });
      toast({
        title: '确认成功',
        description: '进入下一阶段',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '确认失败',
        description: '无法确认需求',
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
          <CardTitle>明确需求</CardTitle>
          <CardDescription>输入文章选题和写作要求，AI 将生成结构化需求文档</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">文章选题 / 写作目标</Label>
            <Textarea
              id="topic"
              placeholder="例如：介绍 React 19 的新特性和最佳实践"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="format">格式模板</Label>
              <Input
                id="format"
                placeholder="例如：技术博客"
                value={formatTemplate}
                onChange={(e) => setFormatTemplate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output">输出格式</Label>
              <Input
                id="output"
                placeholder="例如：Markdown"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating || !topic.trim()}>
            {generating ? '生成中...' : '生成需求文档'}
          </Button>
        </CardContent>
      </Card>

      {generatedRequirements && (
        <Card>
          <CardHeader>
            <CardTitle>需求文档</CardTitle>
            <CardDescription>AI 生成的结构化需求文档</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={generatedRequirements}
              onChange={(e) => setGeneratedRequirements(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={handleConfirm} disabled={confirming || brief?.confirmed}>
                {confirming ? '确认中...' : brief?.confirmed ? '已确认' : '确认需求'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
