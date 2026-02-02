import { useState, useEffect } from 'react';
import { getKnowledgeBase, createKnowledgeBase, updateKnowledgeBase, updateProject, academicSearchWorkflow } from '@/db/api';
import type { KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function KnowledgeStage({ projectId, onComplete }: KnowledgeStageProps) {
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadKnowledge();
  }, [projectId]);

  const loadKnowledge = async () => {
    try {
      const data = await getKnowledgeBase(projectId);
      setKnowledge(data);
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    try {
      // 使用混合搜索工作流
      const result = await academicSearchWorkflow(query);
      setWorkflowResult(result);
      
      // 保存学术论文结果到知识库
      if (result.academicPapers && result.academicPapers.length > 0) {
        for (const paper of result.academicPapers) {
          await createKnowledgeBase({
            project_id: projectId,
            title: paper.title || '无标题',
            content: paper.abstract || paper.content || '暂无摘要',
            source: paper.source || 'OpenAlex',
            source_url: paper.url || undefined,
            published_at: paper.publishedAt || undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '建议 30 天后更新',
            selected: false,
            keywords: result.academicKeywords?.main_keywords || [],
          });
        }
      }

      // 保存网页搜索结果到知识库
      if (result.webPapers && result.webPapers.length > 0) {
        for (const paper of result.webPapers) {
          await createKnowledgeBase({
            project_id: projectId,
            title: paper.title || '无标题',
            content: paper.abstract || paper.content || '暂无摘要',
            source: paper.source || 'Tavily',
            source_url: paper.url || undefined,
            published_at: paper.publishedAt || undefined,
            collected_at: new Date().toISOString(),
            next_update_suggestion: '建议 7 天后更新',
            selected: false,
            keywords: result.webQueries?.queries || [],
          });
        }
      }

      await loadKnowledge();
      
      const totalResults = (result.academicPapers?.length || 0) + (result.webPapers?.length || 0);
      toast({
        title: '混合搜索完成',
        description: `找到 ${result.academicPapers?.length || 0} 篇学术论文，${result.webPapers?.length || 0} 条实时信息`,
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

  const handleConfirm = async () => {
    const selectedCount = knowledge.filter((k) => k.selected).length;
    if (selectedCount === 0) {
      toast({
        title: '请至少选择一条信息',
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
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
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
                <h4 className="text-sm font-semibold mb-2">学术关键词（OpenAlex）</h4>
                <div className="flex flex-wrap gap-2">
                  {workflowResult.academicKeywords.main_keywords.map((keyword: string) => (
                    <Badge key={keyword} variant="default">{keyword}</Badge>
                  ))}
                  {workflowResult.academicKeywords.related_keywords.map((keyword: string) => (
                    <Badge key={keyword} variant="outline">{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 网页搜索查询 */}
            {workflowResult.webQueries && workflowResult.webQueries.queries.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">网页搜索查询（Tavily）</h4>
                <div className="flex flex-wrap gap-2">
                  {workflowResult.webQueries.queries.map((query: string) => (
                    <Badge key={query} variant="secondary">{query}</Badge>
                  ))}
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
                    <h5 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">学术共识</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.academic_consensus.map((point: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-blue-500">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 产业实践 */}
                {workflowResult.structuredSummary.industry_practice && workflowResult.structuredSummary.industry_practice.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">产业实践</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.industry_practice.map((point: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-green-500">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 最新趋势 */}
                {workflowResult.structuredSummary.recent_trends && workflowResult.structuredSummary.recent_trends.length > 0 && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <h5 className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">最新趋势</h5>
                    <ul className="space-y-1 text-sm">
                      {workflowResult.structuredSummary.recent_trends.map((point: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-purple-500">•</span>
                          <span>{point}</span>
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
                      <Badge variant="outline">{item.source}</Badge>
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
                </div>
              </Card>
            ))}
            <div className="flex justify-end">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? '确认中...' : '确认选择'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
