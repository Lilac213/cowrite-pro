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
      // 使用学术搜索工作流
      const result = await academicSearchWorkflow(query);
      setWorkflowResult(result);
      
      // 保存搜索结果到知识库
      for (const paper of result.papers) {
        await createKnowledgeBase({
          project_id: projectId,
          title: paper.title,
          content: paper.content,
          source: paper.source,
          source_url: paper.url,
          published_at: paper.publishedAt || undefined,
          collected_at: new Date().toISOString(),
          next_update_suggestion: '建议 30 天后更新',
          selected: false,
          keywords: result.keywords.main_keywords || [],
        });
      }

      await loadKnowledge();
      toast({
        title: '学术搜索完成',
        description: `找到 ${result.papers.length} 篇高质量论文`,
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
            {/* 学术关键词 */}
            <div>
              <h4 className="text-sm font-semibold mb-2">学术关键词</h4>
              <div className="flex flex-wrap gap-2">
                {workflowResult.keywords.main_keywords.map((keyword: string) => (
                  <Badge key={keyword} variant="default">{keyword}</Badge>
                ))}
                {workflowResult.keywords.related_keywords.map((keyword: string) => (
                  <Badge key={keyword} variant="outline">{keyword}</Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* 研究关注重点 */}
            {workflowResult.searchIntent && workflowResult.searchIntent.focus && (
              <div>
                <h4 className="text-sm font-semibold mb-2">研究关注重点</h4>
                <div className="flex flex-wrap gap-2">
                  {workflowResult.searchIntent.focus.map((focus: string) => (
                    <Badge key={focus} variant="secondary">{focus}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* 学术共识要点 */}
            {workflowResult.consensusPoints && workflowResult.consensusPoints.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">学术共识要点</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {workflowResult.consensusPoints.map((point: string, index: number) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* CoWrite 写作素材 */}
            {workflowResult.cowriteInput && (
              <div>
                <h4 className="text-sm font-semibold mb-2">写作素材</h4>
                <div className="space-y-3 text-sm">
                  {workflowResult.cowriteInput.research_background && (
                    <div>
                      <p className="font-medium">研究背景</p>
                      <p className="text-muted-foreground">{workflowResult.cowriteInput.research_background}</p>
                    </div>
                  )}
                  {workflowResult.cowriteInput.technical_progress && workflowResult.cowriteInput.technical_progress.length > 0 && (
                    <div>
                      <p className="font-medium">技术进展</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {workflowResult.cowriteInput.technical_progress.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {workflowResult.cowriteInput.open_challenges && workflowResult.cowriteInput.open_challenges.length > 0 && (
                    <div>
                      <p className="font-medium">开放挑战</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {workflowResult.cowriteInput.open_challenges.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
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
