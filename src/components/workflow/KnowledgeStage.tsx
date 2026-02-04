import { useState, useEffect } from 'react';
import { 
  getKnowledgeBase, 
  createKnowledgeBase, 
  updateKnowledgeBase, 
  updateProject, 
  academicSearchWorkflow, 
  generateWritingSummary, 
  saveToReferenceLibrary,
  getBrief,
  getMaterials,
  getReferenceArticles,
  searchMaterials,
  searchReferenceArticles,
  callLLMGenerate
} from '@/db/api';
import type { KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Sparkles, CheckCircle2, BookmarkPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

interface KnowledgeStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function KnowledgeStage({ projectId, onComplete }: KnowledgeStageProps) {
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [writingSummary, setWritingSummary] = useState<any>(null);
  const [autoSearched, setAutoSearched] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadKnowledge();
    autoSearchFromBrief();
  }, [projectId]);

  // 根据需求文档自动搜索
  const autoSearchFromBrief = async () => {
    if (autoSearched) return;
    
    try {
      const brief = await getBrief(projectId);
      if (!brief || !brief.requirements) return;

      const requirements = typeof brief.requirements === 'string' 
        ? JSON.parse(brief.requirements) 
        : brief.requirements;

      // 构建搜索查询
      const searchQuery = [
        requirements.主题 || brief.topic,
        ...(requirements.核心观点 || []),
        ...(requirements.关键要点 || [])
      ].filter(Boolean).join(' ');

      if (searchQuery.trim()) {
        setQuery(searchQuery);
        setAutoSearched(true);
        // 自动执行搜索
        await handleSearch(searchQuery);
      }
    } catch (error) {
      console.error('自动搜索失败:', error);
    }
  };

  const loadKnowledge = async () => {
    try {
      const data = await getKnowledgeBase(projectId);
      setKnowledge(data);
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const queryToUse = searchQuery || query;
    if (!queryToUse.trim()) return;

    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      // 1. 搜索个人素材库
      const materials = await searchMaterials(user.id, queryToUse);
      
      // 2. 搜索参考文章库
      const references = await searchReferenceArticles(user.id, queryToUse);

      // 3. 使用混合搜索工作流搜索外部资源
      const result = await academicSearchWorkflow(queryToUse);
      setWorkflowResult(result);
      
      // 保存个人素材到知识库（标记来源）
      if (materials && materials.length > 0) {
        for (const material of materials) {
          await createKnowledgeBase({
            project_id: projectId,
            title: material.title || '无标题',
            content: material.content || '暂无内容',
            source: '个人素材库',
            source_url: undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '个人素材无需更新',
            selected: false,
            keywords: material.keywords || [],
          });
        }
      }

      // 保存参考文章到知识库（标记来源）
      if (references && references.length > 0) {
        for (const reference of references) {
          await createKnowledgeBase({
            project_id: projectId,
            title: reference.title || '无标题',
            content: reference.content || '暂无内容',
            source: '参考文章库',
            source_url: reference.source_url || undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '参考文章无需更新',
            selected: false,
            keywords: reference.keywords || [],
          });
        }
      }

      // 辅助函数：翻译并提取英文内容
      const translateIfNeeded = async (title: string, content: string) => {
        try {
          // 检测是否为英文内容（简单判断：包含较多英文字符）
          const englishRatio = (content.match(/[a-zA-Z]/g) || []).length / content.length;
          if (englishRatio > 0.5 && content.length > 50) {
            const { data: translationData, error: translationError } = await supabase.functions.invoke('translate-extract-content', {
              body: { 
                content: content,
                title: title
              },
            });

            if (translationError) {
              console.error('翻译错误:', translationError);
              return { title, content, translated: false, error: translationError.message };
            }

            if (translationData && translationData.translated_title) {
              // 构建包含数据和观点的内容
              let enhancedContent = translationData.summary || content;
              
              if (translationData.data_points && translationData.data_points.length > 0) {
                enhancedContent += '\n\n【关键数据】\n';
                translationData.data_points.forEach((dp: any) => {
                  enhancedContent += `• ${dp.translated}`;
                  if (dp.context) enhancedContent += ` (${dp.context})`;
                  enhancedContent += '\n';
                });
              }

              if (translationData.viewpoints && translationData.viewpoints.length > 0) {
                enhancedContent += '\n【核心观点】\n';
                translationData.viewpoints.forEach((vp: any) => {
                  enhancedContent += `• ${vp.translated}`;
                  if (vp.supporting_evidence) enhancedContent += ` - ${vp.supporting_evidence}`;
                  enhancedContent += '\n';
                });
              }

              return {
                title: translationData.translated_title,
                content: enhancedContent,
                translated: true,
                error: null
              };
            }
          }
          return { title, content, translated: false, error: null };
        } catch (error: any) {
          console.error('翻译异常:', error);
          return { title, content, translated: false, error: error.message };
        }
      };

      // 保存学术论文结果到知识库（处理英文内容）
      if (result.academicPapers && result.academicPapers.length > 0) {
        let translatedCount = 0;
        let failedCount = 0;
        
        for (const paper of result.academicPapers) {
          const originalTitle = paper.title || '无标题';
          const originalContent = paper.abstract || paper.content || '暂无摘要';
          
          const { title, content, translated, error } = await translateIfNeeded(originalTitle, originalContent);
          
          if (translated) {
            translatedCount++;
          } else if (error) {
            failedCount++;
            console.warn(`论文 "${originalTitle}" 翻译失败:`, error);
          }

          await createKnowledgeBase({
            project_id: projectId,
            title: title + (translated ? ' (已翻译并提取数据观点)' : ''),
            content: content,
            source: paper.source || 'Google Scholar',
            source_url: paper.url || undefined,
            published_at: paper.publishedAt || undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '建议 30 天后更新',
            selected: false,
            keywords: result.academicKeywords?.main_keywords || [],
          });
        }
        
        if (translatedCount > 0) {
          console.log(`成功翻译 ${translatedCount} 篇学术论文`);
        }
        if (failedCount > 0) {
          console.warn(`${failedCount} 篇论文翻译失败`);
        }
      }

      // 保存网页搜索结果到知识库（处理英文内容）
      if (result.webPapers && result.webPapers.length > 0) {
        let translatedCount = 0;
        let failedCount = 0;
        
        for (const paper of result.webPapers) {
          const originalTitle = paper.title || '无标题';
          const originalContent = paper.abstract || paper.content || '暂无摘要';
          
          const { title, content, translated, error } = await translateIfNeeded(originalTitle, originalContent);
          
          if (translated) {
            translatedCount++;
          } else if (error) {
            failedCount++;
            console.warn(`网页 "${originalTitle}" 翻译失败:`, error);
          }

          await createKnowledgeBase({
            project_id: projectId,
            title: title + (translated ? ' (已翻译并提取数据观点)' : ''),
            content: content,
            source: paper.source || 'Web Search',
            source_url: paper.url || undefined,
            published_at: paper.publishedAt || undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '建议 7 天后更新',
            selected: false,
            keywords: result.webQueries?.queries || [],
          });
        }
        
        if (translatedCount > 0) {
          console.log(`成功翻译 ${translatedCount} 条网页内容`);
        }
        if (failedCount > 0) {
          console.warn(`${failedCount} 条网页翻译失败`);
        }
      }

      await loadKnowledge();
      
      const totalResults = (materials?.length || 0) + (references?.length || 0) + (result.academicPapers?.length || 0) + (result.webPapers?.length || 0);
      toast({
        title: '智能搜索完成',
        description: `找到 ${materials?.length || 0} 条个人素材，${references?.length || 0} 篇参考文章，${result.academicPapers?.length || 0} 篇学术论文，${result.webPapers?.length || 0} 条实时信息`,
      });
    } catch (error: any) {
      toast({
        title: '搜索失败',
        description: error.message || '无法搜索信息',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleToggleSelect = async (id: string, selected: boolean) => {
    try {
      await updateKnowledgeBase(id, { selected: !selected });
      await loadKnowledge();
    } catch (error) {
      toast({
        title: '更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleSynthesize = async () => {
    const selectedKnowledge = knowledge.filter((k) => k.selected);
    if (selectedKnowledge.length === 0) {
      toast({
        title: '请至少选择一条信息',
        variant: 'destructive',
      });
      return;
    }

    setSynthesizing(true);
    try {
      // 获取需求文档
      const brief = await getBrief(projectId);
      const requirements = brief?.requirements 
        ? (typeof brief.requirements === 'string' ? JSON.parse(brief.requirements) : brief.requirements)
        : null;

      // 调用增强的综合摘要生成
      const summary = await generateWritingSummaryWithRequirements(selectedKnowledge, requirements);
      setWritingSummary(summary);
      
      toast({
        title: '综合完成',
        description: '已生成写作级研究摘要，并结合需求文档进行补充论证',
      });
    } catch (error: any) {
      toast({
        title: '综合失败',
        description: error.message || '无法生成研究摘要',
        variant: 'destructive',
      });
    } finally {
      setSynthesizing(false);
    }
  };

  // 增强的综合摘要生成函数（结合需求文档）
  const generateWritingSummaryWithRequirements = async (selectedKnowledge: any[], requirements: any) => {
    const systemMessage = `你是 CoWrite 的"研究摘要生成模块"。

基于已筛选的高质量来源和需求文档，请完成以下任务：

1️⃣ 用 **中立、专业、可引用的语言** 总结核心观点  
2️⃣ 明确区分：
   - 学术共识
   - 行业实践 / 现实应用
3️⃣ **重点关注需求文档中的主题、核心观点和关键要点**
4️⃣ 罗列出与需求文档相关的数据和观点，对需求文档进行补充和论证
5️⃣ 避免编造结论，不确定的地方需标注
6️⃣ 生成一份后续生成文章结构时能直接引用的版本

输出结构必须包含：

{
  "requirement_alignment": {
    "topic": "需求文档主题",
    "core_viewpoints": ["需求文档核心观点"],
    "key_points": ["需求文档关键要点"]
  },
  "background_summary": "背景总结（结合需求文档）",
  "supporting_data": [
    {
      "data_point": "具体数据",
      "source": "来源",
      "relevance_to_requirement": "与需求文档的关联性"
    }
  ],
  "supporting_viewpoints": [
    {
      "viewpoint": "观点",
      "evidence": "证据",
      "source": "来源",
      "supports_requirement": "支持需求文档的哪个部分"
    }
  ],
  "academic_insights": [
    {
      "point": "学术观点",
      "evidence_source": "academic",
      "relevance": "与需求的相关性"
    }
  ],
  "industry_insights": [
    {
      "point": "行业实践",
      "evidence_source": "industry",
      "relevance": "与需求的相关性"
    }
  ],
  "open_questions_or_debates": ["待探讨的问题"],
  "suggested_writing_angles": ["建议的写作角度（基于需求文档）"],
  "ready_to_cite": "可直接引用的综合版本（整合需求文档和研究资料）"
}`;

    const prompt = `需求文档：
${requirements ? JSON.stringify(requirements, null, 2) : '无需求文档'}

已筛选的高质量来源：
${JSON.stringify(selectedKnowledge, null, 2)}

请根据需求文档，从已筛选的来源中提炼相关数据和观点，生成可直接用于文章结构生成的综合摘要。`;

    const result = await callLLMGenerate(prompt, '', systemMessage);
    
    try {
      return JSON.parse(result);
    } catch (e) {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('无法解析写作摘要');
    }
  };

  const handleConfirm = async () => {
    if (!writingSummary) {
      toast({
        title: '请先生成综合摘要',
        description: '点击"生成综合摘要"按钮',
        variant: 'destructive',
      });
      return;
    }

    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'outline_confirmed' });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            学术资料查询
          </CardTitle>
          <CardDescription>
            输入中文研究需求，AI 将自动转换为学术关键词并搜索高质量论文
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="例如：人工智能在医学影像中的应用"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button onClick={() => handleSearch()} disabled={searching || !query.trim()}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? '搜索中...' : '智能搜索'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 显示工作流结果 */}
      {workflowResult && (
        <Card>
          <CardHeader>
            <CardTitle>搜索分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 搜索意图拆解 */}
            {workflowResult.intentDecomposition && (
              <div>
                <h4 className="text-sm font-semibold mb-2">搜索意图拆解</h4>
                <div className="space-y-2">
                  {workflowResult.intentDecomposition.academic_intent && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">学术意图</p>
                      <p className="text-sm">{workflowResult.intentDecomposition.academic_intent}</p>
                    </div>
                  )}
                  {workflowResult.intentDecomposition.web_intent && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">实时意图</p>
                      <p className="text-sm">{workflowResult.intentDecomposition.web_intent}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* 学术关键词 */}
            {workflowResult.academicKeywords && workflowResult.academicKeywords.main_keywords.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">学术关键词（Google Scholar）</h4>
                <div className="flex flex-wrap gap-2">
                  {workflowResult.academicKeywords.main_keywords.map((keyword: any, index: number) => {
                    const keywordText = typeof keyword === 'string' ? keyword : (keyword.key_point || keyword.citation || keyword.source || JSON.stringify(keyword));
                    return <Badge key={`main-${index}`} variant="default">{keywordText}</Badge>;
                  })}
                  {workflowResult.academicKeywords.related_keywords.map((keyword: any, index: number) => {
                    const keywordText = typeof keyword === 'string' ? keyword : (keyword.key_point || keyword.citation || keyword.source || JSON.stringify(keyword));
                    return <Badge key={`related-${index}`} variant="outline">{keywordText}</Badge>;
                  })}
                </div>
              </div>
            )}

            {/* 网页搜索查询 */}
            {workflowResult.webQueries && workflowResult.webQueries.queries.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">网页搜索查询（TheNews + Smart Search）</h4>
                <div className="flex flex-wrap gap-2">
                  {workflowResult.webQueries.queries.map((query: any, index: number) => {
                    const queryText = typeof query === 'string' ? query : (query.key_point || query.citation || query.source || JSON.stringify(query));
                    return <Badge key={`query-${index}`} variant="secondary">{queryText}</Badge>;
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* 结构化摘要 */}
            {workflowResult.structuredSummary && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">结构化研究素材</h4>
                
                {/* 学术共识 */}
                {workflowResult.structuredSummary.academic_consensus && workflowResult.structuredSummary.academic_consensus.length > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <h5 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Academic Consensus</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.academic_consensus.map((point: any, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-blue-500">•</span>
                          <span>{typeof point === 'string' ? point : point.title || point.key_points || JSON.stringify(point)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 产业实践 */}
                {workflowResult.structuredSummary.industry_practice && workflowResult.structuredSummary.industry_practice.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">Industry Practice</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.industry_practice.map((point: any, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-green-500">•</span>
                          <span>{typeof point === 'string' ? point : point.title || point.key_points || JSON.stringify(point)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 最新趋势 */}
                {workflowResult.structuredSummary.recent_trends && workflowResult.structuredSummary.recent_trends.length > 0 && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <h5 className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Recent Trends</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.recent_trends.map((point: any, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-purple-500">•</span>
                          <span>{typeof point === 'string' ? point : point.trend || JSON.stringify(point)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {knowledge.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>搜索结果</CardTitle>
            <CardDescription>
              已选择 {knowledge.filter((k) => k.selected).length} / {knowledge.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledge.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => handleToggleSelect(item.id, item.selected)}
                  />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.content}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge 
                        variant={
                          item.source === '个人素材库' ? 'default' :
                          item.source === '参考文章库' ? 'secondary' :
                          'outline'
                        }
                        className={
                          item.source === '个人素材库' ? 'bg-blue-500 text-white' :
                          item.source === '参考文章库' ? 'bg-green-500 text-white' :
                          ''
                        }
                      >
                        {item.source}
                      </Badge>
                      {item.published_at && (
                        <span>{new Date(item.published_at).toLocaleDateString('zh-CN')}</span>
                      )}
                      {item.source_url && (
                        <a 
                          href={item.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          查看原文 →
                        </a>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) {
                          toast({
                            title: '请先登录',
                            variant: 'destructive',
                          });
                          return;
                        }

                        await saveToReferenceLibrary(user.id, {
                          title: item.title,
                          content: item.content,
                          source: item.source,
                          source_url: item.source_url,
                          keywords: item.keywords,
                          published_at: item.published_at,
                        });

                        toast({
                          title: '收藏成功',
                          description: '已保存到参考文章库',
                        });
                      } catch (error: any) {
                        toast({
                          title: '收藏失败',
                          description: error.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <BookmarkPlus className="h-4 w-4 mr-1" />
                    收藏
                  </Button>
                </div>
              </Card>
            ))}
            <div className="flex justify-end gap-2">
              <Button 
                onClick={handleSynthesize} 
                disabled={synthesizing || knowledge.filter((k) => k.selected).length === 0}
                variant="outline"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {synthesizing ? '生成中...' : '生成综合摘要'}
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={confirming || !writingSummary}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {confirming ? '确认中...' : '确认并进入下一步'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 写作级综合摘要 */}
      {writingSummary && (
        <Card>
          <CardHeader>
            <CardTitle>写作级研究摘要</CardTitle>
            <CardDescription>
              基于需求文档和已选择的高质量来源生成的结构化写作素材
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 需求文档对齐 */}
            {writingSummary.requirement_alignment && (
              <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <h4 className="text-sm font-semibold text-primary mb-3">需求文档对齐</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">主题：</span>
                    <span className="ml-2">{writingSummary.requirement_alignment.topic}</span>
                  </div>
                  {writingSummary.requirement_alignment.core_viewpoints && writingSummary.requirement_alignment.core_viewpoints.length > 0 && (
                    <div>
                      <span className="font-medium">核心观点：</span>
                      <ul className="ml-4 mt-1 space-y-1">
                        {writingSummary.requirement_alignment.core_viewpoints.map((vp: string, idx: number) => (
                          <li key={idx}>• {vp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {writingSummary.requirement_alignment.key_points && writingSummary.requirement_alignment.key_points.length > 0 && (
                    <div>
                      <span className="font-medium">关键要点：</span>
                      <ul className="ml-4 mt-1 space-y-1">
                        {writingSummary.requirement_alignment.key_points.map((kp: string, idx: number) => (
                          <li key={idx}>• {kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 背景总结 */}
            {writingSummary.background_summary && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="text-sm font-semibold mb-2">背景总结</h4>
                <p className="text-sm">{writingSummary.background_summary}</p>
              </div>
            )}

            <Separator />

            {/* 支持数据 */}
            {writingSummary.supporting_data && writingSummary.supporting_data.length > 0 && (
              <div className="p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                <h4 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-3">支持数据</h4>
                <div className="space-y-3">
                  {writingSummary.supporting_data.map((data: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-cyan-500 pl-3">
                      <p className="text-sm font-medium">{data.data_point}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          来源：{data.source}
                        </Badge>
                        {data.relevance_to_requirement && (
                          <Badge variant="secondary" className="text-xs">
                            关联：{data.relevance_to_requirement}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 支持观点 */}
            {writingSummary.supporting_viewpoints && writingSummary.supporting_viewpoints.length > 0 && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-3">支持观点</h4>
                <div className="space-y-3">
                  {writingSummary.supporting_viewpoints.map((vp: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-indigo-500 pl-3">
                      <p className="text-sm font-medium">{vp.viewpoint}</p>
                      <p className="text-xs text-muted-foreground mt-1">{vp.evidence}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          来源：{vp.source}
                        </Badge>
                        {vp.supports_requirement && (
                          <Badge variant="secondary" className="text-xs">
                            支持：{vp.supports_requirement}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 学术洞察 */}
            {writingSummary.academic_insights && writingSummary.academic_insights.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">学术洞察</h4>
                <div className="space-y-2">
                  {writingSummary.academic_insights.map((insight: any, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <div className="flex-1">
                        <p className="text-sm">{insight.point}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            来源：{insight.evidence_source}
                          </Badge>
                          {insight.relevance && (
                            <Badge variant="secondary" className="text-xs">
                              {insight.relevance}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 产业洞察 */}
            {writingSummary.industry_insights && writingSummary.industry_insights.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">产业洞察</h4>
                <div className="space-y-2">
                  {writingSummary.industry_insights.map((insight: any, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <div className="flex-1">
                        <p className="text-sm">{insight.point}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            来源：{insight.evidence_source}
                          </Badge>
                          {insight.relevance && (
                            <Badge variant="secondary" className="text-xs">
                              {insight.relevance}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 开放问题或争议 */}
            {writingSummary.open_questions_or_debates && writingSummary.open_questions_or_debates.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">开放问题或争议</h4>
                <ul className="space-y-1 text-sm">
                  {writingSummary.open_questions_or_debates.map((question: string, idx: number) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 建议写作角度 */}
            {writingSummary.suggested_writing_angles && writingSummary.suggested_writing_angles.length > 0 && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3">建议写作角度（基于需求文档）</h4>
                <ul className="space-y-1 text-sm">
                  {writingSummary.suggested_writing_angles.map((angle: string, idx: number) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-purple-500">•</span>
                      <span>{angle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 可直接引用版本 */}
            {writingSummary.ready_to_cite && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border-2 border-emerald-500/20">
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-3">
                  可直接引用版本（用于文章结构生成）
                </h4>
                <p className="text-sm whitespace-pre-wrap">{writingSummary.ready_to_cite}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
