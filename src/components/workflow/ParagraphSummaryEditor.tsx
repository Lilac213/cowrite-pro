import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Sparkles, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { Outline } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/api/http';

interface ParagraphStructure {
  input_assumption: string;
  core_claim: string;
  sub_claims: string[];
  output_state: string;
}

interface SupportingMaterial {
  type: string;
  content: string;
  uncertainty?: string;
}

interface SubClaimWithMaterials {
  sub_claim: string;
  materials: SupportingMaterial[];
  selected_materials: number[];
}

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
  previousOutline?: Outline;
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
  previousOutline,
  referenceArticles = [],
  materials = [],
  knowledgeBase = [],
  onSave,
  onClose,
}: ParagraphSummaryEditorProps) {
  const { toast } = useToast();
  
  const [paragraphStructure, setParagraphStructure] = useState<ParagraphStructure | null>(
    outline.paragraph_structure || null
  );
  
  const [subClaimsWithMaterials, setSubClaimsWithMaterials] = useState<SubClaimWithMaterials[]>([]);
  
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [generatingEvidence, setGeneratingEvidence] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (outline.paragraph_structure) {
      setParagraphStructure(outline.paragraph_structure);
      
      if (outline.paragraph_structure.sub_claims) {
        setSubClaimsWithMaterials(
          outline.paragraph_structure.sub_claims.map((sc: string) => ({
            sub_claim: sc,
            materials: [],
            selected_materials: [],
          }))
        );
      }
    }
  }, [outline]);

  const handleGenerateParagraphStructure = async () => {
    setGeneratingStructure(true);
    try {
      const currentBlock = articleStructure?.argument_blocks.find(
        (block) => block.order === Math.ceil(outline.paragraph_order / 2)
      );

      const data = await apiJson('/api/generate-paragraph-structure', {
        coreThesis: articleStructure?.core_thesis,
        currentArgumentBlock: currentBlock?.title,
        blockTask: currentBlock?.description,
        previousParagraphTask: previousOutline?.paragraph_structure?.core_claim,
        relationWithPrevious: '承接',
        newInformation: outline.summary,
        referenceContent: referenceArticles.map((r) => r.content).join('\n'),
        authorMaterials: materials.map((m) => m.content).join('\n'),
        retrievedData: knowledgeBase.map((k) => k.content).join('\n'),
      });

      setParagraphStructure(data);
      
      setSubClaimsWithMaterials(
        data.sub_claims.map((sc: string) => ({
          sub_claim: sc,
          materials: [],
          selected_materials: [],
        }))
      );

      toast({
        title: '生成成功',
        description: '段落论证结构已生成',
      });
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingStructure(false);
    }
  };

  const handleGenerateEvidence = async (index: number) => {
    if (!paragraphStructure) return;

    setGeneratingEvidence(index);
    try {
      const data = await apiJson('/api/generate-evidence', {
        articleTopic: articleStructure?.core_thesis,
        coreClaim: paragraphStructure.core_claim,
        subClaim: subClaimsWithMaterials[index].sub_claim,
      });

      const updated = [...subClaimsWithMaterials];
      updated[index].materials = data.supporting_materials;
      setSubClaimsWithMaterials(updated);

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
    } finally {
      setGeneratingEvidence(null);
    }
  };

  const toggleMaterialSelection = (subClaimIndex: number, materialIndex: number) => {
    const updated = [...subClaimsWithMaterials];
    const selected = updated[subClaimIndex].selected_materials;
    
    if (selected.includes(materialIndex)) {
      updated[subClaimIndex].selected_materials = selected.filter((i) => i !== materialIndex);
    } else {
      updated[subClaimIndex].selected_materials = [...selected, materialIndex];
    }
    
    setSubClaimsWithMaterials(updated);
  };

  const handleSave = async () => {
    if (!paragraphStructure) {
      toast({
        title: '请先生成论证结构',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('outlines')
        // @ts-ignore - JSONB fields not in generated types
        .update({
          paragraph_structure: paragraphStructure,
          sub_claims_materials: subClaimsWithMaterials,
        })
        .eq('id', outline.id);

      if (error) throw error;

      toast({
        title: '保存成功',
      });
      
      onSave();
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>段落 {outline.paragraph_order} - 论证结构编辑</CardTitle>
              <CardDescription className="mt-1">{outline.summary}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !paragraphStructure}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">段落级论证结构</h3>
                <Button
                  onClick={handleGenerateParagraphStructure}
                  disabled={generatingStructure}
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatingStructure ? '生成中...' : '生成结构'}
                </Button>
              </div>

              {paragraphStructure ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Input Assumption（承接前文的前提）
                    </label>
                    <Textarea
                      value={paragraphStructure.input_assumption}
                      onChange={(e) =>
                        setParagraphStructure({ ...paragraphStructure, input_assumption: e.target.value })
                      }
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Core Claim（本段要证明的核心主张）
                    </label>
                    <Textarea
                      value={paragraphStructure.core_claim}
                      onChange={(e) =>
                        setParagraphStructure({ ...paragraphStructure, core_claim: e.target.value })
                      }
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Sub Claims（分论据）
                    </label>
                    <div className="space-y-2 mt-1">
                      {paragraphStructure.sub_claims.map((claim, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={claim}
                            onChange={(e) => {
                              const updated = [...paragraphStructure.sub_claims];
                              updated[index] = e.target.value;
                              setParagraphStructure({ ...paragraphStructure, sub_claims: updated });
                              
                              const updatedMaterials = [...subClaimsWithMaterials];
                              updatedMaterials[index].sub_claim = e.target.value;
                              setSubClaimsWithMaterials(updatedMaterials);
                            }}
                            placeholder={`分论据 ${index + 1}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = paragraphStructure.sub_claims.filter((_, i) => i !== index);
                              setParagraphStructure({ ...paragraphStructure, sub_claims: updated });
                              setSubClaimsWithMaterials(subClaimsWithMaterials.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setParagraphStructure({
                            ...paragraphStructure,
                            sub_claims: [...paragraphStructure.sub_claims, ''],
                          });
                          setSubClaimsWithMaterials([
                            ...subClaimsWithMaterials,
                            { sub_claim: '', materials: [], selected_materials: [] },
                          ]);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        添加分论据
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Output State（为下一段铺垫的逻辑出口）
                    </label>
                    <Textarea
                      value={paragraphStructure.output_state}
                      onChange={(e) =>
                        setParagraphStructure({ ...paragraphStructure, output_state: e.target.value })
                      }
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>暂无论证结构</p>
                  <p className="text-sm mt-2">点击"生成结构"开始</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">论据及支撑材料</h3>

              {subClaimsWithMaterials.length > 0 ? (
                <div className="space-y-4">
                  {subClaimsWithMaterials.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            分论据 {index + 1}：{item.sub_claim || '（未填写）'}
                          </p>
                          <Button
                            onClick={() => handleGenerateEvidence(index)}
                            disabled={generatingEvidence === index || !item.sub_claim}
                            size="sm"
                            variant="outline"
                          >
                            {generatingEvidence === index ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            生成材料
                          </Button>
                        </div>

                        {item.materials.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">可选支撑材料：</p>
                            {item.materials.map((material, mIndex) => (
                              <div
                                key={mIndex}
                                className="flex items-start gap-2 p-2 border border-border rounded-md"
                              >
                                <Checkbox
                                  checked={item.selected_materials.includes(mIndex)}
                                  onCheckedChange={() => toggleMaterialSelection(index, mIndex)}
                                />
                                <div className="flex-1">
                                  <Badge variant="secondary" className="text-xs mb-1">
                                    {material.type}
                                  </Badge>
                                  <p className="text-sm">{material.content}</p>
                                  {material.uncertainty && (
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      {material.uncertainty}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无支撑材料，点击"生成材料"
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>请先生成左侧的论证结构</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
