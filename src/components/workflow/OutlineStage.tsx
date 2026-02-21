import { useState, useEffect } from 'react';
import {
  getProject,
  updateProject,
  getBrief,
  getKnowledgeBase,
  getReferenceArticles,
  getMaterials,
  callStructureAgent,
  callDraftAgent,
} from '@/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Sparkles, Save, X, Edit, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { apiJson } from '@/api/http';

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
  const [hasAttemptedAutoGenerate, setHasAttemptedAutoGenerate] = useState(false);
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

      // 尝试获取最新的 article_structure (优先于 projects 表中的缓存)
      const { data: latestStructure } = await supabase
        .from('article_structures')
        .select('payload_jsonb')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestStructure && (latestStructure as any).payload_jsonb) {
        const structure = (latestStructure as any).payload_jsonb as any;
        setCoreThesis(structure.core_thesis || '');
        // Normalize block_id to id
        const blocks = (structure.argument_blocks || []).map((b: any) => ({
          ...b,
          id: b.id || b.block_id,
        }));
        setArgumentBlocks(blocks);
      } else if (projectData?.article_argument_structure) {
        setCoreThesis(projectData.article_argument_structure.core_thesis || '');
        const blocks = (projectData.article_argument_structure.argument_blocks || []).map((b: any) => ({
          ...b,
          id: b.id || b.block_id,
        }));
        setArgumentBlocks(blocks);
      } else if (!hasAttemptedAutoGenerate && !generatingStructure) {
        // 如果没有结构且未尝试生成过，则自动生成
        setHasAttemptedAutoGenerate(true);
        // 使用 setTimeout 避免在渲染期间直接触发副作用，并确保 handleGenerateArticleStructure 已定义
        setTimeout(() => handleGenerateArticleStructure(), 0);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 生成文章级论证结构
  const handleGenerateArticleStructure = async () => {
    setGeneratingStructure(true);
    try {
      console.log('[OutlineStage] Calling structure-agent for project:', projectId);
      // 调用新的 structure-agent
      const result = await callStructureAgent(projectId);
      console.log('[OutlineStage] structure-agent result:', result);
      
      if (result.error) {
        throw new Error(result.details || result.error);
      }

      // 优先使用接口返回的结构
      if (result.argument_outline) {
        const argumentOutline = result.argument_outline;
        setCoreThesis(argumentOutline.core_thesis);
        const blocks = (argumentOutline.argument_blocks || []).map((b: any) => ({
          ...b,
          id: b.id || b.block_id,
        }));
        setArgumentBlocks(blocks);
        
        // 保存到 projects 表（保持兼容性）
        await supabase
          .from('projects')
          // @ts-ignore
          .update({
            article_argument_structure: {
              core_thesis: argumentOutline.core_thesis,
              argument_blocks: blocks,
            },
          })
          .eq('id', projectId);
        toast({
          title: '生成成功',
          description: '文章级论证结构已生成',
        });
        return;
      }

      // 如果接口未返回结构，则尝试从 article_structures 表读取 (兼容旧逻辑)
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
      const msg = error.message || '';
      
      if (msg.includes('未找到 research_pack') || msg.includes('未找到有效的 research_insights')) {
        errorMessage = '请先完成资料搜索和整理';
      } else if (msg) {
        errorMessage = msg;
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
      // 直接保存用户的修改，不再强制调用 AI 调整
      // 如果需要 AI 优化，应该提供单独的按钮
      
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
        description: '论证结构已保存',
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
      main_argument: '',
      description: '',
      supporting_points: [],
      estimated_word_count: 500,
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
      const data = await apiJson('/api/adjust-article-structure', {
        project_id: projectId,
        coreThesis,
        argumentBlocks: updatedBlocks,
        operation: 'add',
        blockIndex: index,
      }, true);

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
      const data = await apiJson('/api/adjust-article-structure', {
        project_id: projectId,
        coreThesis,
        argumentBlocks: updatedBlocks,
        operation: 'delete',
        blockIndex,
      }, true);

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

  // 移动论证块
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === argumentBlocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...argumentBlocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // 交换位置
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    
    // 更新 order
    const updatedBlocks = newBlocks.map((block, idx) => ({
      ...block,
      order: idx + 1
    }));

    setArgumentBlocks(updatedBlocks);
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
      // 更新项目状态为草稿生成阶段
      await updateProject(projectId, { status: 'drafting' });
      
      toast({
        title: '确认成功',
        description: '正在启动草稿生成...',
      });

      // 异步调用 draft-agent，不阻塞页面跳转
      callDraftAgent(projectId)
        .then(() => {
          console.log('Draft agent completed successfully');
        })
        .catch((error) => {
          console.error('Draft agent failed:', error);
          // 即使失败也不影响用户体验，用户可以在草稿页面手动生成
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
                              onClick={() => handleMoveBlock(index, 'up')}
                              size="sm"
                              variant="ghost"
                              disabled={index === 0}
                              title="上移"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleMoveBlock(index, 'down')}
                              size="sm"
                              variant="ghost"
                              disabled={index === argumentBlocks.length - 1}
                              title="下移"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
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
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">主要论点</label>
                          <Textarea
                            value={block.main_argument || block.description || ''}
                            onChange={(e) =>
                              setArgumentBlocks(
                                argumentBlocks.map((b) =>
                                  b.id === block.id ? { ...b, main_argument: e.target.value, description: e.target.value } : b
                                )
                              )
                            }
                            placeholder={
                              index === argumentBlocks.length - 1
                                ? '该论证块的作用（结尾应复述总论点/总结升华/展望未来）'
                                : '该论证块的作用和要证明的内容'
                            }
                            rows={3}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">支持论据 / 细分点</label>
                          <div className="space-y-2 pl-2 border-l-2 border-muted">
                            {(block.supporting_points || []).map((point: string, pIndex: number) => (
                              <div key={pIndex} className="flex gap-2">
                                <div className="flex-none pt-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                </div>
                                <Textarea
                                  value={point}
                                  onChange={(e) => {
                                    const newPoints = [...(block.supporting_points || [])];
                                    newPoints[pIndex] = e.target.value;
                                    setArgumentBlocks(
                                      argumentBlocks.map((b) =>
                                        b.id === block.id ? { ...b, supporting_points: newPoints } : b
                                      )
                                    );
                                  }}
                                  rows={2}
                                  className="text-sm min-h-[60px]"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const newPoints = (block.supporting_points || []).filter((_: any, idx: number) => idx !== pIndex);
                                    setArgumentBlocks(
                                      argumentBlocks.map((b) =>
                                        b.id === block.id ? { ...b, supporting_points: newPoints } : b
                                      )
                                    );
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs dashed"
                              onClick={() => {
                                const newPoints = [...(block.supporting_points || []), ''];
                                setArgumentBlocks(
                                  argumentBlocks.map((b) =>
                                    b.id === block.id ? { ...b, supporting_points: newPoints } : b
                                  )
                                );
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> 添加支持点
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">预估字数</label>
                          <Input
                            type="number"
                            value={block.estimated_word_count || 0}
                            onChange={(e) =>
                              setArgumentBlocks(
                                argumentBlocks.map((b) =>
                                  b.id === block.id ? { ...b, estimated_word_count: parseInt(e.target.value) || 0 } : b
                                )
                              )
                            }
                            className="w-24 h-8 text-sm"
                          />
                        </div>

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
                              <p className="text-sm mb-2 whitespace-pre-wrap text-foreground">
                                <span className="font-semibold text-xs text-muted-foreground block mb-1">主要论点:</span>
                                {block.main_argument || block.description}
                              </p>
                              
                              {block.supporting_points && block.supporting_points.length > 0 && (
                                <div className="pl-2 border-l-2 border-muted mb-2 space-y-1">
                                  <span className="font-semibold text-xs text-muted-foreground block mb-1">支持论据:</span>
                                  {block.supporting_points.map((point: string, idx: number) => (
                                    <p key={idx} className="text-xs flex gap-2 text-foreground">
                                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                                      {point}
                                    </p>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                {block.estimated_word_count && (
                                  <span className="flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded">
                                    约 {block.estimated_word_count} 字
                                  </span>
                                )}
                                {block.relation && (
                                  <span>关系：{block.relation}</span>
                                )}
                              </div>
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
