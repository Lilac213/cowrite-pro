import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, Sparkles, Save } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { Outline, SubArgument, EvidenceItem } from '@/types';

interface ParagraphSummaryEditorProps {
  outline: Outline;
  projectId: string;
  articleStructure?: {
    core_thesis: string;
    argument_blocks: Array<{
      id: string;
      title: string;
      description: string;
      order: number;
    }>;
  };
  referenceArticles?: any[];
  materials?: any[];
  knowledgeBase?: any[];
  onSave: () => void;
  onClose: () => void;
}

export default function ParagraphSummaryEditor({
  outline,
  projectId,
  articleStructure,
  referenceArticles = [],
  materials = [],
  knowledgeBase = [],
  onSave,
  onClose,
}: ParagraphSummaryEditorProps) {
  const [mainArgument, setMainArgument] = useState(outline.reasoning_structure?.main_argument || '');
  const [subArguments, setSubArguments] = useState<SubArgument[]>(
    outline.reasoning_structure?.sub_arguments || []
  );
  const [conclusion, setConclusion] = useState(outline.reasoning_structure?.conclusion || '');
  const [evidencePool, setEvidencePool] = useState<EvidenceItem[]>(outline.evidence_pool || []);
  const [generating, setGenerating] = useState(false);
  const [generatingEvidence, setGeneratingEvidence] = useState(false);
  const [saving, setSaving] = useState(false);

  // 生成论证结构（Step 1）
  const handleGenerateReasoning = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-paragraph-reasoning', {
        body: {
          paragraphSummary: outline.summary,
          articleStructure,
          argumentBlock: articleStructure?.argument_blocks.find(
            (block) => block.order === outline.paragraph_order
          ),
          referenceArticles,
          materials,
          knowledgeBase,
        },
      });

      if (error) throw error;

      setMainArgument(data.main_argument);
      setSubArguments(data.sub_arguments);
      setConclusion(data.conclusion);
    } catch (error: any) {
      console.error('生成论证结构失败:', error);
      alert('生成论证结构失败：' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // 生成论据池（Step 2）
  const handleGenerateEvidence = async () => {
    if (subArguments.length === 0) {
      alert('请先生成或填写分论据');
      return;
    }

    setGeneratingEvidence(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-evidence-pool', {
        body: {
          subArguments,
          referenceArticles,
          materials,
          knowledgeBase,
        },
      });

      if (error) throw error;

      setEvidencePool(data.evidence_pool);
    } catch (error: any) {
      console.error('生成论据池失败:', error);
      alert('生成论据池失败：' + error.message);
    } finally {
      setGeneratingEvidence(false);
    }
  };

  // 添加分论据
  const handleAddSubArgument = () => {
    const newSubArg: SubArgument = {
      id: `sub_${Date.now()}`,
      content: '',
      order: subArguments.length + 1,
    };
    setSubArguments([...subArguments, newSubArg]);
  };

  // 删除分论据
  const handleDeleteSubArgument = (id: string) => {
    setSubArguments(subArguments.filter((arg) => arg.id !== id));
    // 同时删除相关的论据
    setEvidencePool(evidencePool.filter((ev) => ev.sub_argument_id !== id));
  };

  // 更新分论据内容
  const handleUpdateSubArgument = (id: string, content: string) => {
    setSubArguments(
      subArguments.map((arg) => (arg.id === id ? { ...arg, content } : arg))
    );
  };

  // 切换论据选择状态
  const handleToggleEvidence = (id: string) => {
    setEvidencePool(
      evidencePool.map((ev) => (ev.id === id ? { ...ev, selected: !ev.selected } : ev))
    );
  };

  // 保存
  const handleSave = async () => {
    setSaving(true);
    try {
      // 更新论证结构
      const { error: reasoningError } = await supabase
        .from('outlines')
        // @ts-ignore - reasoning_structure and evidence_pool are JSONB fields
        .update({
          reasoning_structure: {
            main_argument: mainArgument,
            sub_arguments: subArguments,
            conclusion,
          },
          evidence_pool: evidencePool,
        })
        .eq('id', outline.id);

      if (reasoningError) throw reasoningError;

      onSave();
    } catch (error: any) {
      console.error('保存失败:', error);
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getEvidenceTypeLabel = (type: string) => {
    switch (type) {
      case 'case':
        return '案例';
      case 'data':
        return '数据';
      case 'analogy':
        return '类比';
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>段落摘要生成 - 两步走</CardTitle>
            <div className="flex gap-2">
              <Button onClick={onClose} variant="outline">
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                保存
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            段落 {outline.paragraph_order}：{outline.summary}
          </p>
          {articleStructure && (
            <p className="text-sm text-muted-foreground">
              文章核心论点：{articleStructure.core_thesis}
            </p>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* 左侧：论证结构（Step 1） */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Step 1：段落级观点结构整理</h3>
                <Button onClick={handleGenerateReasoning} disabled={generating} size="sm">
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  生成结构
                </Button>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* 总论据 */}
                  <div>
                    <label className="text-sm font-semibold text-primary mb-2 block">
                      总论据
                    </label>
                    <Textarea
                      value={mainArgument}
                      onChange={(e) => setMainArgument(e.target.value)}
                      placeholder="该段落的核心论点，一句话"
                      rows={2}
                    />
                  </div>

                  <Separator />

                  {/* 分论据 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-primary">分论据</label>
                      <Button onClick={handleAddSubArgument} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {subArguments.map((arg, index) => (
                        <div key={arg.id} className="flex gap-2">
                          <span className="text-sm font-medium text-muted-foreground mt-2">
                            {index + 1}.
                          </span>
                          <Textarea
                            value={arg.content}
                            onChange={(e) => handleUpdateSubArgument(arg.id, e.target.value)}
                            placeholder="分论据内容"
                            rows={2}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => handleDeleteSubArgument(arg.id)}
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* 小总结 */}
                  <div>
                    <label className="text-sm font-semibold text-primary mb-2 block">
                      小总结
                    </label>
                    <Textarea
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      placeholder="对该段落论证的总结"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：论据池（Step 2） */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Step 2：论据 / 案例支撑池</h3>
                <Button
                  onClick={handleGenerateEvidence}
                  disabled={generatingEvidence || subArguments.length === 0}
                  size="sm"
                >
                  {generatingEvidence ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  生成支撑材料
                </Button>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {evidencePool.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>暂无支撑材料</p>
                      <p className="text-sm mt-2">请先完成分论据，然后点击"生成支撑材料"</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {subArguments.map((arg) => {
                        const relatedEvidence = evidencePool.filter(
                          (ev) => ev.sub_argument_id === arg.id
                        );
                        if (relatedEvidence.length === 0) return null;

                        return (
                          <div key={arg.id} className="space-y-2">
                            <p className="text-sm font-semibold text-primary">
                              分论据：{arg.content}
                            </p>
                            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                              {relatedEvidence.map((evidence) => (
                                <Card key={evidence.id} className="p-3">
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={evidence.selected}
                                      onCheckedChange={() => handleToggleEvidence(evidence.id)}
                                    />
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                          {getEvidenceTypeLabel(evidence.type)}
                                        </Badge>
                                        {evidence.uncertainty && (
                                          <Badge variant="outline" className="text-xs">
                                            ⚠️ {evidence.uncertainty}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm">{evidence.content}</p>
                                      {evidence.source && (
                                        <p className="text-xs text-muted-foreground">
                                          来源：{evidence.source}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
