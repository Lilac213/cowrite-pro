import { useState, useEffect } from 'react';
import {
  getProject,
  updateProject,
  getBrief,
  getKnowledgeBase,
  getReferenceArticles,
  getMaterials,
  callStructureAgent,
} from '@/db/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Sparkles, Save, X, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

interface OutlineStageProps {
  projectId: string;
  onComplete: () => void;
}

interface OutlineStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function OutlineStage({ projectId, onComplete }: OutlineStageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingStructure, setEditingStructure] = useState(false);
  const [coreThesis, setCoreThesis] = useState('');
  const [argumentBlocks, setArgumentBlocks] = useState<any[]>([]);
  const [referenceArticles, setReferenceArticles] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [projectData, refArticles, mats, kb] = await Promise.all([
        getProject(projectId),
        getReferenceArticles(user.id, projectId), // 只获取当前项目的参考文章
        getMaterials(user.id, projectId), // 只获取当前项目的素材
        getKnowledgeBase(projectId),
      ]);

      setProject(projectData);
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
      // 调用新的 structure-agent
      const result = await callStructureAgent(projectId);
      
      if (result.error) {
        throw new Error(result.details || result.error);
      }

      // 从 article_structures 表读取生成的结构
      const { data: structure, error: structError } = await supabase
        .from('article_structures')
        .select('payload_jsonb')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (structError) throw structError;

      const argumentOutline = (structure as any).payload_jsonb;
      setCoreThesis(argumentOutline.core_thesis);
      setArgumentBlocks(argumentOutline.argument_blocks);

      // 保存到 projects 表（保持兼容性）
      const { error: saveError } = await supabase
        .from('projects')
        // @ts-ignore - article_argument_structure is a JSONB field
        .update({
          article_argument_structure: {
            core_thesis: argumentOutline.core_thesis,
            argument_blocks: argumentOutline.argument_blocks,
          },
        })
        .eq('id', projectId);

      if (saveError) throw saveError;

      toast({
        title: '生成成功',
        description: '文章级论证结构已生成',
      });
    } catch (error: any) {
      console.error('生成失败详情:', error);
      
      let errorMessage = '无法生成论证结构';
      if (error.message && error.message.includes('未找到 research_pack')) {
        errorMessage = '请先完成资料搜索和整理';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: '生成失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGeneratingStructure(false);
    }
  };

  // 保存文章级论证结构（带自动调整）
  const handleSaveArticleStructure = async () => {
    try {
      // 调用调整接口，确保结构连贯且最后一块是总结
      const { data, error } = await supabase.functions.invoke('adjust-article-structure', {
        body: {
          project_id: projectId,
          coreThesis,
          argumentBlocks,
          operation: 'check',
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || '调整论证结构失败');
      }

      if (!data) {
        throw new Error('未返回调整后的结构');
      }

      // 使用调整后的结构
      const adjustedStructure = {
        core_thesis: data.core_thesis,
        argument_blocks: data.argument_blocks,
      };

      const { error: saveError } = await supabase
        .from('projects')
        // @ts-ignore - article_argument_structure is a JSONB field
        .update({
          article_argument_structure: adjustedStructure,
        })
        .eq('id', projectId);

      if (saveError) throw saveError;

      // 更新本地状态
      setCoreThesis(data.core_thesis);
      setArgumentBlocks(data.argument_blocks);
      setEditingStructure(false);

      toast({
        title: '保存成功',
        description: '论证结构已优化并保存',
      });
    } catch (error: any) {
      console.error('Save article structure error:', error);
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 添加论证块
  const handleAddArgumentBlock = async (index: number) => {
    const newBlock = {
      id: `block_${Date.now()}`,
      title: '',
      description: '',
      order: index + 1,
      relation: '',
    };

    const updatedBlocks = [
      ...argumentBlocks.slice(0, index),
      newBlock,
      ...argumentBlocks.slice(index),
    ].map((block, idx) => ({ ...block, order: idx + 1 }));

    setArgumentBlocks(updatedBlocks);

    // 自动调整结构
    try {
      const { data, error } = await supabase.functions.invoke('adjust-article-structure', {
        body: {
          project_id: projectId,
          coreThesis,
          argumentBlocks: updatedBlocks,
          operation: 'add',
          blockIndex: index,
        },
      });

      if (error) {
        console.error('Adjust structure error:', error);
        throw new Error(error.message || '调整失败');
      }

      if (data && data.argument_blocks) {
        setArgumentBlocks(data.argument_blocks);
        toast({
          title: '已添加',
          description: '论证块已自动调整以保持连贯',
        });
      }
    } catch (error: any) {
      console.error('Add block error:', error);
      toast({
        title: '自动调整失败',
        description: error.message || '请手动调整论证块内容',
        variant: 'destructive',
      });
    }
  };

  // 删除论证块
  const handleDeleteArgumentBlock = async (blockId: string) => {
    const blockIndex = argumentBlocks.findIndex((b) => b.id === blockId);
    const updatedBlocks = argumentBlocks
      .filter((b) => b.id !== blockId)
      .map((block, idx) => ({ ...block, order: idx + 1 }));

    setArgumentBlocks(updatedBlocks);

    // 自动调整结构
    try {
      const { data, error } = await supabase.functions.invoke('adjust-article-structure', {
        body: {
          project_id: projectId,
          coreThesis,
          argumentBlocks: updatedBlocks,
          operation: 'delete',
          blockIndex,
        },
      });

      if (error) {
        console.error('Adjust structure error:', error);
        throw new Error(error.message || '调整失败');
      }

      if (data && data.argument_blocks) {
        setArgumentBlocks(data.argument_blocks);
        toast({
          title: '已删除',
          description: '论证结构已自动调整',
        });
      }
    } catch (error: any) {
      console.error('Delete block error:', error);
      toast({
        title: '自动调整失败',
        description: error.message || '请手动调整论证块内容',
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = async () => {
    if (!coreThesis || argumentBlocks.length === 0) {
      toast({
        title: '请先完成文章级论证结构',
        variant: 'destructive',
      });
      return;
    }

    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'drafting' });
      toast({
        title: '确认成功',
        description: '进入草稿生成阶段',
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
                    onClick={() => handleAddArgumentBlock(argumentBlocks.length)}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加到末尾
                  </Button>
                </div>
                <div className="space-y-3">
                  {argumentBlocks.map((block, index) => (
                    <Card key={block.id} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            论证块 {index + 1}
                            {index === argumentBlocks.length - 1 && (
                              <Badge variant="secondary" className="ml-2">
                                结尾
                              </Badge>
                            )}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => handleAddArgumentBlock(index + 1)}
                              size="sm"
                              variant="ghost"
                              title="在此后插入"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteArgumentBlock(block.id)}
                              size="sm"
                              variant="ghost"
                              disabled={argumentBlocks.length <= 3}
                              title={argumentBlocks.length <= 3 ? '至少保留3个论证块' : '删除'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                          placeholder={
                            index === argumentBlocks.length - 1
                              ? '该论证块的作用（结尾应复述总论点/总结升华/展望未来）'
                              : '该论证块的作用和要证明的内容'
                          }
                          rows={2}
                        />
                        {block.relation && (
                          <p className="text-xs text-muted-foreground">
                            与前一块关系：{block.relation}
                          </p>
                        )}
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
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold">
                                  {index + 1}. {block.title}
                                </p>
                                {index === argumentBlocks.length - 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    结尾
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{block.description}</p>
                              {block.relation && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  关系：{block.relation}
                                </p>
                              )}
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

      {/* 确认按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleConfirm} disabled={confirming || !coreThesis || argumentBlocks.length === 0}>
          {confirming ? '确认中...' : '确认并进入段落结构'}
        </Button>
      </div>
    </div>
  );
}
