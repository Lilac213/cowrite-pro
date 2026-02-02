import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getOutlines,
  batchCreateOutlines,
  updateOutline,
  deleteOutline,
  updateProject,
  callLLMGenerate,
  getBrief,
  getKnowledgeBase,
  getReferenceArticles,
  getMaterials,
  getProject,
  reorderOutlines,
} from '@/db/api';
import type { Outline, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, GripVertical, Sparkles, Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import ParagraphSummaryEditor from './ParagraphSummaryEditor';

interface OutlineStageProps {
  projectId: string;
  onComplete: () => void;
}

interface SortableOutlineItemProps {
  outline: Outline;
  index: number;
  onUpdate: (id: string, summary: string) => void;
  onToggle: (id: string, selected: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (outline: Outline) => void;
}

function SortableOutlineItem({
  outline,
  index,
  onUpdate,
  onToggle,
  onDelete,
  onEdit,
}: SortableOutlineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: outline.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border border-border rounded-md bg-card"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <Checkbox checked={outline.selected} onCheckedChange={() => onToggle(outline.id, outline.selected)} />
      <span className="text-sm text-muted-foreground w-8">{index + 1}.</span>
      <Input
        value={outline.summary}
        onChange={(e) => onUpdate(outline.id, e.target.value)}
        className="flex-1"
      />
      <Button variant="outline" size="sm" onClick={() => onEdit(outline)}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onDelete(outline.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function OutlineStage({ projectId, onComplete }: OutlineStageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingStructure, setEditingStructure] = useState(false);
  const [coreThesis, setCoreThesis] = useState('');
  const [argumentBlocks, setArgumentBlocks] = useState<any[]>([]);
  const [editingOutline, setEditingOutline] = useState<Outline | null>(null);
  const [referenceArticles, setReferenceArticles] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [projectData, outlinesData, refArticles, mats, kb] = await Promise.all([
        getProject(projectId),
        getOutlines(projectId),
        getReferenceArticles(user.id),
        getMaterials(user.id),
        getKnowledgeBase(projectId),
      ]);

      setProject(projectData);
      setOutlines(outlinesData);
      setReferenceArticles(refArticles);
      setMaterials(mats);
      setKnowledgeBase(kb.filter((k) => k.selected));

      if (projectData?.article_argument_structure) {
        setCoreThesis(projectData.article_argument_structure.core_thesis || '');
        setArgumentBlocks(projectData.article_argument_structure.argument_blocks || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 生成文章级论证结构
  const handleGenerateArticleStructure = async () => {
    setGeneratingStructure(true);
    try {
      const brief = await getBrief(projectId);

      const { data, error } = await supabase.functions.invoke('generate-article-structure', {
        body: {
          topic: brief?.topic,
          requirements: brief?.requirements,
          referenceArticles,
          materials,
        },
      });

      if (error) throw error;

      setCoreThesis(data.core_thesis);
      setArgumentBlocks(data.argument_blocks);

      // 保存到数据库
      const { error: saveError } = await supabase
        .from('projects')
        // @ts-ignore - article_argument_structure is a JSONB field
        .update({
          article_argument_structure: {
            core_thesis: data.core_thesis,
            argument_blocks: data.argument_blocks,
          },
        })
        .eq('id', projectId);

      if (saveError) throw saveError;

      toast({
        title: '生成成功',
        description: '文章级论证结构已生成',
      });
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message || '无法生成论证结构',
        variant: 'destructive',
      });
    } finally {
      setGeneratingStructure(false);
    }
  };

  // 保存文章级论证结构
  const handleSaveArticleStructure = async () => {
    try {
      const { error: saveError } = await supabase
        .from('projects')
        // @ts-ignore - article_argument_structure is a JSONB field
        .update({
          article_argument_structure: {
            core_thesis: coreThesis,
            argument_blocks: argumentBlocks,
          },
        })
        .eq('id', projectId);

      if (saveError) throw saveError;

      setEditingStructure(false);
      toast({
        title: '保存成功',
      });
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
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
      await loadData();

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

  const handleAddOutline = async () => {
    try {
      const newOutline = {
        project_id: projectId,
        paragraph_order: outlines.length + 1,
        summary: '',
        selected: true,
      };

      await batchCreateOutlines([newOutline]);
      await loadData();
    } catch (error: any) {
      toast({
        title: '添加失败',
        description: error.message,
        variant: 'destructive',
      });
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
      await loadData();
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
      await loadData();
    } catch (error) {
      toast({
        title: '删除失败',
        variant: 'destructive',
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = outlines.findIndex((o) => o.id === active.id);
      const newIndex = outlines.findIndex((o) => o.id === over.id);

      const newOutlines = arrayMove(outlines, oldIndex, newIndex);
      setOutlines(newOutlines);

      // 更新顺序到数据库
      const updates = newOutlines.map((outline, index) => ({
        id: outline.id,
        paragraph_order: index + 1,
      }));

      try {
        await reorderOutlines(projectId, updates);
      } catch (error) {
        toast({
          title: '更新顺序失败',
          variant: 'destructive',
        });
        await loadData(); // 重新加载
      }
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
      {/* 文章级论证结构 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>文章级论证结构</CardTitle>
              <CardDescription>定义文章整体论证方向和框架</CardDescription>
            </div>
            <div className="flex gap-2">
              {!editingStructure && (
                <>
                  <Button
                    onClick={handleGenerateArticleStructure}
                    disabled={generatingStructure}
                    variant="outline"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generatingStructure ? '生成中...' : '生成结构'}
                  </Button>
                  <Button onClick={() => setEditingStructure(true)} variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                </>
              )}
              {editingStructure && (
                <>
                  <Button onClick={handleSaveArticleStructure} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </Button>
                  <Button onClick={() => setEditingStructure(false)} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    取消
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingStructure ? (
            <>
              <div>
                <label className="text-sm font-semibold mb-2 block">核心论点</label>
                <Textarea
                  value={coreThesis}
                  onChange={(e) => setCoreThesis(e.target.value)}
                  placeholder="一句话概括文章要证明什么"
                  rows={2}
                />
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold">论证块</label>
                  <Button
                    onClick={() =>
                      setArgumentBlocks([
                        ...argumentBlocks,
                        {
                          id: `block_${Date.now()}`,
                          title: '',
                          description: '',
                          order: argumentBlocks.length + 1,
                        },
                      ])
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
                <div className="space-y-3">
                  {argumentBlocks.map((block, index) => (
                    <Card key={block.id} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">论证块 {index + 1}</span>
                          <Button
                            onClick={() => setArgumentBlocks(argumentBlocks.filter((b) => b.id !== block.id))}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={block.title}
                          onChange={(e) =>
                            setArgumentBlocks(
                              argumentBlocks.map((b) =>
                                b.id === block.id ? { ...b, title: e.target.value } : b
                              )
                            )
                          }
                          placeholder="论证块标题"
                        />
                        <Textarea
                          value={block.description}
                          onChange={(e) =>
                            setArgumentBlocks(
                              argumentBlocks.map((b) =>
                                b.id === block.id ? { ...b, description: e.target.value } : b
                              )
                            )
                          }
                          placeholder="该论证块的作用和要证明的内容"
                          rows={2}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {coreThesis ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-primary mb-1">核心论点</p>
                    <p className="text-sm">{coreThesis}</p>
                  </div>
                  {argumentBlocks.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-semibold text-primary mb-2">论证块</p>
                        <div className="space-y-2">
                          {argumentBlocks.map((block, index) => (
                            <Card key={block.id} className="p-3">
                              <p className="text-sm font-semibold">
                                {index + 1}. {block.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">{block.description}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无论证结构，请点击"生成结构"或"编辑"开始
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 段落摘要生成 */}
      <Card>
        <CardHeader>
          <CardTitle>段落摘要</CardTitle>
          <CardDescription>生成并编辑文章段落结构</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={generating || outlines.length > 0}>
              <Plus className="h-4 w-4 mr-2" />
              {generating ? '生成中...' : '生成段落摘要'}
            </Button>
            {outlines.length > 0 && (
              <Button onClick={handleAddOutline} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                添加段落
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 段落列表 */}
      {outlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>段落列表</CardTitle>
            <CardDescription>
              已选择 {outlines.filter((o) => o.selected).length} / {outlines.length} 个段落
              <br />
              <span className="text-xs">拖拽段落可调整顺序，确保观点递进或平行，文章结构通顺</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={outlines.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                {outlines.map((outline, index) => (
                  <SortableOutlineItem
                    key={outline.id}
                    outline={outline}
                    index={index}
                    onUpdate={handleUpdateSummary}
                    onToggle={handleToggleSelect}
                    onDelete={handleDelete}
                    onEdit={setEditingOutline}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="flex justify-end pt-4">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? '确认中...' : '确认结构'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 段落摘要编辑器 */}
      {editingOutline && (
        <ParagraphSummaryEditor
          outline={editingOutline}
          projectId={projectId}
          articleStructure={
            coreThesis
              ? {
                  core_thesis: coreThesis,
                  argument_blocks: argumentBlocks,
                }
              : undefined
          }
          referenceArticles={referenceArticles}
          materials={materials}
          knowledgeBase={knowledgeBase}
          onSave={() => {
            setEditingOutline(null);
            loadData();
          }}
          onClose={() => setEditingOutline(null)}
        />
      )}
    </div>
  );
}
