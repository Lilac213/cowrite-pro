import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import { getBrief, createBrief, updateBrief, updateProject, callBriefAgent } from '@/api';
import type { Brief } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, ArrowRight, Search, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const [showResearchDialog, setShowResearchDialog] = useState(false);
  const [isProjectCompleted, setIsProjectCompleted] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadBrief();
    checkProjectStatus();
  }, [projectId]);

  const checkProjectStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('is_completed')
        .eq('id', projectId)
        .single();
      
      if (!error && data) {
        setIsProjectCompleted((data as any).is_completed || false);
      }
    } catch (error) {
      console.error('检查项目状态失败:', error);
    }
  };

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

    if (isProjectCompleted) {
      toast({
        title: '项目已完稿',
        description: '完稿后无法修改需求文档',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      // 调用新的 brief-agent
      const userInput = `选题：${topic}\n文章类型：${formatTemplate || '无'}`;
      const result = await callBriefAgent(projectId, topic, userInput);
      
      if (result.error) {
        throw new Error(result.details || result.error);
      }

      // 从 requirements 表读取生成的 writing_brief
      const { data: requirement, error: reqError } = await supabase
        .from('requirements')
        .select('payload_jsonb')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (reqError) throw reqError;

      const writingBrief = (requirement as any).payload_jsonb;
      setGeneratedRequirements(JSON.stringify(writingBrief, null, 2));

      if (!brief) {
        const newBrief = await createBrief({
          project_id: projectId,
          topic,
          format_template: formatTemplate || undefined,
          requirements: writingBrief,
          confirmed: false,
        });
        setBrief(newBrief);
      } else {
        const updated = await updateBrief(brief.id, {
          topic,
          format_template: formatTemplate || undefined,
          requirements: writingBrief,
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
      
      if (error.message && error.message.includes('未找到 writing_brief')) {
        errorMessage = 'Agent 运行失败，请重试';
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
    if (!brief || !user) return;

    // 显示资料查询选择对话框
    setShowResearchDialog(true);
  };

  // 进行资料查询
  const handleDoResearch = async () => {
    if (!brief) return;

    setShowResearchDialog(false);
    setConfirming(true);
    try {
      await updateBrief(brief.id, { confirmed: true });
      await updateProject(projectId, { status: 'knowledge_selected' });
      toast({
        title: '确认成功',
        description: '进入资料查询阶段',
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

  // 跳过资料查询，直接生成结构
  const handleSkipResearch = async () => {
    if (!brief) return;

    setShowResearchDialog(false);
    setConfirming(true);
    try {
      await updateBrief(brief.id, { confirmed: true });
      // 跳过资料查询和整理，直接进入文章结构阶段
      await updateProject(projectId, { status: 'outline_confirmed' });
      toast({
        title: '确认成功',
        description: '跳过资料查询，进入文章结构阶段',
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
          <Button onClick={handleGenerate} disabled={generating || !topic.trim() || isProjectCompleted}>
            {isProjectCompleted && <Lock className="h-4 w-4 mr-2" />}
            {generating ? '生成中...' : isProjectCompleted ? '项目已完稿' : '生成需求文档'}
          </Button>
          {isProjectCompleted && (
            <p className="text-sm text-muted-foreground mt-2">
              ⚠️ 项目已完稿，无法修改需求文档
            </p>
          )}
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
                进入下一阶段
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 资料查询选择对话框 */}
      <Dialog open={showResearchDialog} onOpenChange={setShowResearchDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Search className="h-5 w-5 text-primary" />
              是否进行资料查询？
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">适合学术论文、研究报告、需要引用文献的写作</strong>
                </p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    可获得：可靠资料 + 可引用来源
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2">
                <span>👉</span>
                <p>若是公众号、方案、观点类文章，可直接跳过</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2 pt-4">
            <Button
              onClick={handleDoResearch}
              disabled={confirming}
              className="w-full"
              size="lg"
            >
              <Search className="h-4 w-4 mr-2" />
              进行资料查询
            </Button>
            <Button
              onClick={handleSkipResearch}
              variant="outline"
              disabled={confirming}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              跳过，直接生成结构
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
