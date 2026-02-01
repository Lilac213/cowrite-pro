import { useState, useEffect } from 'react';
import { getLatestDraft, createDraft, updateDraft, callLLMGenerate, getBrief, getKnowledgeBase, getOutlines } from '@/db/api';
import type { Draft } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface DraftStageProps {
  projectId: string;
  onComplete?: () => void;
  readonly?: boolean;
}

export default function DraftStage({ projectId, onComplete, readonly }: DraftStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDraft();
  }, [projectId]);

  const loadDraft = async () => {
    try {
      const data = await getLatestDraft(projectId);
      if (data) {
        setDraft(data);
        setContent(data.content);
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const brief = await getBrief(projectId);
      const knowledge = await getKnowledgeBase(projectId);
      const outlines = await getOutlines(projectId);

      const selectedKnowledge = knowledge.filter((k) => k.selected);
      const selectedOutlines = outlines.filter((o) => o.selected);

      const prompt = `基于以下信息生成完整文章：

需求：${JSON.stringify(brief?.requirements || {})}

知识库：
${selectedKnowledge.map((k) => `- ${k.title}: ${k.content}`).join('\n')}

段落结构：
${selectedOutlines.map((o, i) => `${i + 1}. ${o.summary}`).join('\n')}

请生成一篇完整的文章。`;

      const result = await callLLMGenerate(prompt);
      setContent(result);

      if (!draft) {
        const newDraft = await createDraft({
          project_id: projectId,
          content: result,
          version: 1,
        });
        setDraft(newDraft);
      } else {
        const updated = await updateDraft(draft.id, {
          content: result,
          version: draft.version + 1,
        });
        setDraft(updated);
      }

      toast({
        title: '生成成功',
        description: '文章已生成',
      });
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

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    try {
      await updateDraft(draft.id, { content });
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{readonly ? '最终文章' : '文章草稿'}</CardTitle>
          <CardDescription>
            {readonly ? '项目已完成' : '生成并编辑文章内容'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readonly && !draft && (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? '生成中...' : '生成文章'}
            </Button>
          )}
          {content && (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                disabled={readonly}
              />
              {!readonly && (
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
