import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLatestDraft, createDraft, updateDraft, callLLMGenerate, getBrief, getKnowledgeBase, getOutlines, getMaterials, getReferenceArticles } from '@/db/api';
import type { Draft, ParagraphAnnotation } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DRAFT_WITH_ANNOTATIONS_PROMPT } from '@/constants/prompts';
import DraftWithAnnotations from './DraftWithAnnotations';
import { Loader2, FileText, MessageSquare, Sparkles } from 'lucide-react';

interface DraftStageProps {
  projectId: string;
  onComplete?: () => void;
  readonly?: boolean;
}

export default function DraftStage({ projectId, onComplete, readonly }: DraftStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [annotations, setAnnotations] = useState<ParagraphAnnotation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'annotated' | 'plain'>('annotated');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDraft();
  }, [projectId]);

  const loadDraft = async () => {
    try {
      const data = await getLatestDraft(projectId);
      if (data) {
        setDraft(data);
        setContent(data.content);
        if (data.annotations) {
          setAnnotations(data.annotations);
        }
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

      // 获取用户的素材和参考文章（仅观点，不包含案例）
      let userMaterials: any[] = [];
      let userReferences: any[] = [];
      if (user) {
        const materials = await getMaterials(user.id);
        const references = await getReferenceArticles(user.id);
        
        // 过滤掉案例类型的素材，只保留观点和个人经历
        userMaterials = materials.filter(m => m.material_type !== 'case');
        userReferences = references;
      }

      const prompt = `${DRAFT_WITH_ANNOTATIONS_PROMPT}

## 需求信息
主题：${brief?.topic || ''}
格式要求：${brief?.format_template || ''}
具体要求：${JSON.stringify(brief?.requirements || {})}

## 知识库资料（仅使用观点，严禁使用案例）
${selectedKnowledge.map((k) => `
标题：${k.title}
来源：${k.source}
内容：${k.content}
关键词：${k.keywords?.join('、') || ''}
`).join('\n---\n')}

## 用户素材（仅观点和经历，不含案例）
${userMaterials.map((m) => `
类型：${m.material_type === 'opinion' ? '观点' : '个人经历'}
标题：${m.title}
内容：${m.content}
摘要：${m.summary || ''}
标签：${m.keywords?.join('、') || ''}
`).join('\n---\n')}

## 参考文章（仅提取观点）
${userReferences.slice(0, 5).map((r) => `
标题：${r.title}
来源：${r.source_type || ''}
摘要：${r.summary || ''}
关键词：${r.keywords?.join('、') || ''}
`).join('\n---\n')}

## 段落结构
${selectedOutlines.map((o, i) => `${i + 1}. ${o.summary}`).join('\n')}

请严格按照 JSON 格式输出，包含 content 和 annotations 两个字段。`;

      const result = await callLLMGenerate(prompt);
      
      // 解析 JSON 响应
      let parsedResult;
      try {
        // 尝试提取 JSON
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析 JSON 响应');
        }
      } catch (parseError) {
        console.error('JSON 解析错误:', parseError);
        // 如果解析失败，使用原始文本作为内容
        parsedResult = {
          content: result,
          annotations: [],
        };
      }

      setContent(parsedResult.content);
      setAnnotations(parsedResult.annotations || []);

      if (!draft) {
        const newDraft = await createDraft({
          project_id: projectId,
          content: parsedResult.content,
          annotations: parsedResult.annotations,
          version: 1,
        });
        setDraft(newDraft);
      } else {
        const updated = await updateDraft(draft.id, {
          content: parsedResult.content,
          annotations: parsedResult.annotations,
          version: draft.version + 1,
        });
        setDraft(updated);
      }

      toast({
        title: '生成成功',
        description: `文章已生成，包含 ${parsedResult.annotations?.length || 0} 条注释`,
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
      await updateDraft(draft.id, { 
        content,
        annotations,
      });
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

  if (!draft && !generating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>文章草稿</CardTitle>
          <CardDescription>生成带有可解释注释的学术文章初稿</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                生成文章
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">正在生成文章...</p>
          <p className="text-sm text-muted-foreground mt-2">
            AI 正在分析资料并生成带注释的初稿
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">文章草稿</h2>
          <p className="text-muted-foreground mt-1">
            查看文章内容和段落注释，了解每段的来源和生成逻辑
          </p>
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/project/${projectId}/draft`)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                增强生成模式
              </Button>
              <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    重新生成
                  </>
                ) : (
                  '重新生成'
                )}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'annotated' | 'plain')}>
        <TabsList>
          <TabsTrigger value="annotated" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            注释视图
          </TabsTrigger>
          <TabsTrigger value="plain" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            纯文本视图
          </TabsTrigger>
        </TabsList>

        <TabsContent value="annotated" className="mt-6">
          {annotations.length > 0 ? (
            <DraftWithAnnotations
              content={content}
              annotations={annotations}
              onContentChange={setContent}
              readonly={readonly}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>暂无注释信息</p>
                <p className="text-sm mt-2">请重新生成文章以获取注释</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plain" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>文章内容</CardTitle>
              <CardDescription>纯文本编辑模式</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={25}
                disabled={readonly}
                className="font-mono"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
