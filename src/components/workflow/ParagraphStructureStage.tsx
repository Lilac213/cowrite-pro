import { useState, useEffect } from 'react';
import { getProject, updateProject, getKnowledgeBase, getReferenceArticles, getMaterials } from '@/api';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

interface ParagraphStructureStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function ParagraphStructureStage({ projectId, onComplete }: ParagraphStructureStageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [argumentBlocks, setArgumentBlocks] = useState<any[]>([]);
  const [paragraphStructures, setParagraphStructures] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [coherenceResult, setCoherenceResult] = useState<any>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [referenceArticles, setReferenceArticles] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const { toast } = useToast();

  // Helper function to save paragraph structures
  const saveParagraphStructures = async (structures: any[]) => {
    const { error } = await (supabase.from('projects').update as any)({ paragraph_structures: structures }).eq('id', projectId);
    if (error) throw error;
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [projectData, kb, refs, mats] = await Promise.all([
        getProject(projectId),
        getKnowledgeBase(projectId),
        getReferenceArticles(user.id),
        getMaterials(user.id),
      ]);

      setProject(projectData);
      setKnowledgeBase(kb.filter((k) => k.selected));
      setReferenceArticles(refs);
      setMaterials(mats);

      if (projectData?.article_argument_structure) {
        setArgumentBlocks(projectData.article_argument_structure.argument_blocks || []);
      }

      if (projectData?.paragraph_structures) {
        setParagraphStructures(projectData.paragraph_structures);
      } else {
        // 初始化段落结构数组
        const initialStructures = (projectData?.article_argument_structure?.argument_blocks || []).map((block: any) => ({
          blockId: block.id,
          blockTitle: block.title,
          paragraphReasoning: null,
          evidenceMaterials: [],
        }));
        setParagraphStructures(initialStructures);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 生成段落级论据
  const handleGenerateParagraphReasoning = async (blockId: string) => {
    setGenerating(blockId);
    try {
      const block = argumentBlocks.find((b) => b.id === blockId);
      if (!block) return;

      const blockIndex = argumentBlocks.findIndex((b) => b.id === blockId);
      const previousBlock = blockIndex > 0 ? argumentBlocks[blockIndex - 1] : null;

      const { data, error } = await supabase.functions.invoke('generate-paragraph-reasoning', {
        body: {
          coreThesis: project?.article_argument_structure?.core_thesis,
          currentBlock: block,
          previousParagraph: previousBlock?.description || null,
          relationToPrevious: block.relation || '引入',
          newInformation: block.description,
          referenceMaterials: referenceArticles,
          personalMaterials: materials,
          knowledgeBase: knowledgeBase,
        },
      });

      if (error) {
        console.error('Generate reasoning error:', error);
        throw new Error(error.message || '生成失败');
      }

      // 更新段落结构
      const updatedStructures = paragraphStructures.map((ps) =>
        ps.blockId === blockId ? { ...ps, paragraphReasoning: data } : ps
      );
      setParagraphStructures(updatedStructures);
      await saveParagraphStructures(updatedStructures);
      await saveParagraphStructures(updatedStructures);

      toast({
        title: '生成成功',
        description: '段落级论据已生成',
      });
    } catch (error: any) {
      console.error('Generate paragraph reasoning error:', error);
      toast({
        title: '生成失败',
        description: error.message || '无法生成段落级论据',
        variant: 'destructive',
      });
    } finally {
      setGenerating(null);
    }
  };

  // 生成论据级支撑材料
  const handleGenerateEvidence = async (blockId: string, subClaim: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-evidence', {
        body: {
          articleTopic: project?.article_argument_structure?.core_thesis,
          coreClaim: paragraphStructures.find((ps) => ps.blockId === blockId)?.paragraphReasoning?.core_claim,
          subClaim: subClaim,
        },
      });

      if (error) throw new Error(error.message || '生成失败');

      // 更新段落结构中的支撑材料
      const updatedStructures = paragraphStructures.map((ps) => {
        if (ps.blockId === blockId) {
          const existingMaterials = ps.evidenceMaterials || [];
          return {
            ...ps,
            evidenceMaterials: [...existingMaterials, data],
          };
        }
        return ps;
      });
      setParagraphStructures(updatedStructures);

      await saveParagraphStructures(updatedStructures);
      await saveParagraphStructures(updatedStructures);
      toast({
        title: '生成成功',
        description: '支撑材料已生成',
      });
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 连贯性校验
  const handleVerifyCoherence = async () => {
    setVerifying(true);
    try {
      const paragraphs = paragraphStructures
        .filter((ps) => ps.paragraphReasoning)
        .map((ps) => ps.paragraphReasoning);

      if (paragraphs.length === 0) {
        toast({
          title: '请先生成段落级论据',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('verify-coherence', {
        body: {
          coreThesis: project?.article_argument_structure?.core_thesis,
          paragraphs: paragraphs,
        },
      });

      if (error) throw error;

      setCoherenceResult(data);

      const hasIssues = data.coherence_check.some((c: any) => c.coherence_status === '有问题');

      if (hasIssues) {
        toast({
          title: '发现连贯性问题',
          description: '请查看详细报告',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '连贯性校验通过',
          description: '可以确认初稿',
        });
      }
    } catch (error: any) {
      toast({
        title: '校验失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  // 确认初稿
  const handleConfirm = async () => {
    try {
      await updateProject(projectId, { status: 'drafting' });
      toast({
        title: '确认成功',
        description: '进入文章生成阶段',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '确认失败',
        variant: 'destructive',
      });
    }
  };

  const allParagraphsGenerated = paragraphStructures.every((ps) => ps.paragraphReasoning);
  const coherencePassed = coherenceResult && !coherenceResult.coherence_check.some((c: any) => c.coherence_status === '有问题');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>段落结构</CardTitle>
          <CardDescription>为每个论证块生成段落级论据和支撑材料</CardDescription>
        </CardHeader>
      </Card>

      {/* 论证块列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：论证块和段落级论据 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">论证块与段落级论据</h3>
          {argumentBlocks.map((block) => {
            const structure = paragraphStructures.find((ps) => ps.blockId === block.id);
            const isGenerating = generating === block.id;

            return (
              <Card key={block.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{block.title}</CardTitle>
                    <Button
                      onClick={() => handleGenerateParagraphReasoning(block.id)}
                      disabled={isGenerating}
                      size="sm"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          生成段落级论据
                        </>
                      )}
                    </Button>
                  </div>
                  <CardDescription>{block.description}</CardDescription>
                </CardHeader>
                {structure?.paragraphReasoning && (
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">承接前提：</span>
                      <p className="text-sm">{structure.paragraphReasoning.input_assumption}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">核心主张：</span>
                      <p className="text-sm font-semibold">{structure.paragraphReasoning.core_claim}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">分论据：</span>
                      <ul className="list-disc list-inside space-y-1">
                        {structure.paragraphReasoning.sub_claims?.map((claim: string, idx: number) => (
                          <li key={idx} className="text-sm">{claim}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">逻辑出口：</span>
                      <p className="text-sm">{structure.paragraphReasoning.output_state}</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* 右侧：论据级支撑材料 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">论据级支撑材料</h3>
          {argumentBlocks.map((block) => {
            const structure = paragraphStructures.find((ps) => ps.blockId === block.id);

            return (
              <Card key={block.id}>
                <CardHeader>
                  <CardTitle className="text-base">{block.title} - 支撑材料</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {structure?.paragraphReasoning?.sub_claims?.map((claim: string, idx: number) => (
                    <div key={idx} className="border border-border rounded-md p-3">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium flex-1">{claim}</p>
                        <Button
                          onClick={() => handleGenerateEvidence(block.id, claim)}
                          size="sm"
                          variant="outline"
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          生成支撑
                        </Button>
                      </div>
                      {structure.evidenceMaterials
                        ?.filter((em: any) => em.sub_claim === claim)
                        .map((em: any, emIdx: number) => (
                          <div key={emIdx} className="mt-2 space-y-1">
                            {em.supporting_materials?.map((sm: any, smIdx: number) => (
                              <div key={smIdx} className="text-xs bg-muted p-2 rounded">
                                <Badge variant="secondary" className="mb-1">
                                  {sm.type}
                                </Badge>
                                <p>{sm.content}</p>
                                {sm.uncertainty && (
                                  <p className="text-amber-600 mt-1">⚠️ {sm.uncertainty}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  ))}
                  {!structure?.paragraphReasoning && (
                    <p className="text-sm text-muted-foreground">请先生成段落级论据</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 连贯性校验结果 */}
      {coherenceResult && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>连贯性校验结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coherenceResult.coherence_check.map((check: any, index: number) => (
              <div key={index} className="p-3 border border-border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">段落 {check.paragraph_index}</span>
                  <Badge variant={check.coherence_status === '通过' ? 'default' : 'destructive'}>
                    {check.coherence_status}
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">论证角色：</span>
                    {check.role}
                  </p>
                  {check.issues && (
                    <p className="text-destructive">
                      <span className="text-muted-foreground">问题：</span>
                      {check.issues}
                    </p>
                  )}
                  {check.needs_transition === '是' && (
                    <p className="text-amber-600">
                      <span className="text-muted-foreground">建议：</span>
                      需要增加过渡 - {check.transition_reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <p className="text-sm">
                <span className="font-medium">整体评价：</span>
                {coherenceResult.overall_assessment}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 底部操作按钮 */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleVerifyCoherence}
          disabled={!allParagraphsGenerated || verifying}
          variant="outline"
        >
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              校验中...
            </>
          ) : (
            '段落连贯性校验'
          )}
        </Button>
        <Button onClick={handleConfirm} disabled={!coherencePassed}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          确认初稿
        </Button>
      </div>
    </div>
  );
}
