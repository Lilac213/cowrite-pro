import { useState, useEffect } from 'react';
import { getBrief, createBrief, updateBrief, updateProject, callLLMGenerate } from '@/db/api';
import type { Brief } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface BriefStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function BriefStage({ projectId, onComplete }: BriefStageProps) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [topic, setTopic] = useState('');
  const [formatTemplate, setFormatTemplate] = useState('');
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
文章类型：${formatTemplate || '无'}

请生成一个结构化的需求文档，包括：
1. 文章主题
2. 目标读者
3. 核心观点
4. 预期长度
5. 写作风格
6. 关键要点

请严格按照以下 JSON 格式返回，不要包含任何其他文字说明：
{
  "主题": "文章主题",
  "目标读者": "目标读者群体",
  "核心观点": ["观点1", "观点2"],
  "预期长度": "字数范围",
  "写作风格": "风格描述",
  "关键要点": ["要点1", "要点2"]
}`;

      const result = await callLLMGenerate(prompt);
      
      // 尝试提取 JSON
      let parsedResult;
      try {
        // 尝试直接解析
        parsedResult = JSON.parse(result);
      } catch (e) {
        // 如果失败，尝试提取 JSON 部分
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('AI 返回的内容不是有效的 JSON 格式');
        }
      }
      
      setGeneratedRequirements(JSON.stringify(parsedResult, null, 2));

      if (!brief) {
        const newBrief = await createBrief({
          project_id: projectId,
          topic,
          format_template: formatTemplate || undefined,
          requirements: parsedResult,
          confirmed: false,
        });
        setBrief(newBrief);
      } else {
        // 重新生成时，重置确认状态
        const updated = await updateBrief(brief.id, {
          topic,
          format_template: formatTemplate || undefined,
          requirements: parsedResult,
          confirmed: false,
        });
        setBrief(updated);
      }

      toast({
        title: '生成成功',
        description: '需求文档已生成',
      });
    } catch (error: any) {
      console.error('生成失败详情:', error);
      
      let errorMessage = '无法生成需求文档';
      
      // 检查是否是 API 配置问题
      if (error.message && error.message.includes('系统 LLM 配置未完成')) {
        errorMessage = '系统 LLM 配置未完成，请联系管理员配置通义千问 API 密钥';
      } else if (error.message && error.message.includes('请先在设置中配置')) {
        errorMessage = '系统 LLM 配置未完成，请联系管理员配置';
      } else if (error.message && error.message.includes('API 错误')) {
        errorMessage = 'API 调用失败，请联系管理员检查 API 密钥是否正确';
      } else if (error.message && error.message.includes('JSON')) {
        errorMessage = 'AI 返回格式错误，请重试或联系管理员';
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
          <div className="space-y-2">
            <Label htmlFor="format">文章类型</Label>
            <Input
              id="format"
              placeholder="例如：技术博客、学术论文、产品介绍"
              value={formatTemplate}
              onChange={(e) => setFormatTemplate(e.target.value)}
            />
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
            <div className="flex justify-end gap-2">
              <Button onClick={handleConfirm} disabled={confirming || brief?.confirmed} variant="outline">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {confirming ? '确认中...' : brief?.confirmed ? '已确认' : '确认需求'}
              </Button>
              <Button onClick={handleConfirm} disabled={confirming || !brief?.confirmed}>
                <ArrowRight className="h-4 w-4 mr-2" />
                进入下一步
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
