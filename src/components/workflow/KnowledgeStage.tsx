import { useState, useEffect } from 'react';
import { 
  getKnowledgeBase, 
  createKnowledgeBase, 
  updateKnowledgeBase, 
  updateProject, 
  academicSearchWorkflow,
  agentDrivenResearchWorkflow,
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Sparkles, CheckCircle2, BookmarkPlus, Edit, Trash2 } from 'lucide-react';
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeBase | null>(null);
  const [searchProgress, setSearchProgress] = useState<{
    stage: string;
    message: string;
    details?: string;
  } | null>(null);
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
    setSearchProgress({ stage: '准备中', message: '正在初始化搜索...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      setSearchProgress({ stage: '读取需求', message: '正在读取需求文档...' });

      // 获取需求文档
      const brief = await getBrief(projectId);
      if (!brief) throw new Error('未找到需求文档');

      const requirements = typeof brief.requirements === 'string' 
        ? JSON.parse(brief.requirements) 
        : brief.requirements;

      // 构建需求文档 JSON
      const requirementsDoc = {
        主题: requirements.主题 || brief.topic || queryToUse,
        关键要点: requirements.关键要点 || [],
        核心观点: requirements.核心观点 || [],
        目标读者: requirements.目标读者 || '通用读者',
        写作风格: requirements.写作风格 || '专业',
        预期长度: requirements.预期长度 || '中等',
      };

      setSearchProgress({ 
        stage: '资料查询', 
        message: '正在从 5 个数据源检索相关资料...',
        details: '数据源：Google Scholar、TheNews、Smart Search、参考文章库、个人素材库'
      });

      toast({
        title: '🔍 启动 Research Retrieval Agent',
        description: '正在从 5 个数据源检索相关资料...',
      });

      // 使用新的 Agent 驱动的研究工作流
      const { retrievalResults, synthesisResults } = await agentDrivenResearchWorkflow(
        requirementsDoc,
        projectId,
        user.id
      );

      setSearchProgress({ 
        stage: '资料整理', 
        message: '正在整理检索结果...',
        details: `已检索到资料，正在分类整理`
      });

      toast({
        title: '✅ Research Synthesis Agent 完成',
        description: '资料已整理为中文写作素材',
      });

      // 保存检索结果到知识库
      const allSources = [
        ...(retrievalResults.academic_sources || []).map((s: any) => ({ ...s, sourceType: 'academic' })),
        ...(retrievalResults.news_sources || []).map((s: any) => ({ ...s, sourceType: 'news' })),
        ...(retrievalResults.web_sources || []).map((s: any) => ({ ...s, sourceType: 'web' })),
        ...(retrievalResults.user_library_sources || []).map((s: any) => ({ ...s, sourceType: 'user_library' })),
        ...(retrievalResults.personal_sources || []).map((s: any) => ({ ...s, sourceType: 'personal' })),
      ];

      setSearchProgress({ 
        stage: '保存资料', 
        message: `正在保存 ${allSources.length} 条资料到知识库...`
      });

      // 保存到知识库
      for (const source of allSources) {
        let title = '';
        let content = '';
        let sourceLabel = '';
        let sourceUrl = '';

        if (source.sourceType === 'academic') {
          title = source.title || '无标题';
          content = `作者: ${source.authors || '未知'}\n年份: ${source.year || '未知'}\n引用次数: ${source.citation_count || 0}\n\n摘要:\n${source.abstract || '暂无摘要'}`;
          sourceLabel = 'Google Scholar';
          sourceUrl = source.url || '';
        } else if (source.sourceType === 'news') {
          title = source.title || '无标题';
          content = `来源: ${source.source || '未知'}\n发布时间: ${source.published_at || '未知'}\n\n${source.snippet || '暂无内容'}`;
          sourceLabel = 'TheNews';
          sourceUrl = source.url || '';
        } else if (source.sourceType === 'web') {
          title = source.title || '无标题';
          content = `网站: ${source.site_name || '未知'}\n最后爬取: ${source.last_crawled_at || '未知'}\n\n${source.snippet || '暂无内容'}`;
          sourceLabel = 'Smart Search';
          sourceUrl = source.url || '';
        } else if (source.sourceType === 'user_library') {
          title = source.title || '无标题';
          content = source.content || '暂无内容';
          sourceLabel = '参考文章库';
          sourceUrl = source.url || '';
        } else if (source.sourceType === 'personal') {
          title = source.title || '无标题';
          content = source.content || '暂无内容';
          sourceLabel = '个人素材库';
          sourceUrl = '';
        }

        await createKnowledgeBase({
          project_id: projectId,
          title: title,
          content: content,
          source: sourceLabel,
          source_url: sourceUrl || undefined,
          collected_at: new Date().toISOString(),
          selected: false,
          keywords: retrievalResults.search_queries?.academic_keywords || [],
        });
      }

      // 保存综合结果到项目
      setWorkflowResult({
        retrievalResults,
        synthesisResults,
      });

      // 将 synthesisResults 保存为 writingSummary
      setWritingSummary(synthesisResults);

      await loadKnowledge();
      
      setSearchProgress({ 
        stage: '完成', 
        message: `搜索完成！已从 5 个数据源检索并整理了 ${allSources.length} 条资料`
      });
      
      toast({
        title: '✅ 搜索完成',
        description: `已从 5 个数据源检索并整理了 ${allSources.length} 条资料`,
      });
    } catch (error: any) {
      console.error('搜索失败 - 完整错误对象:', error);
      console.error('错误类型:', typeof error);
      console.error('错误属性:', Object.keys(error));
      
      // 提取详细错误信息
      let errorMessage = '请稍后重试';
      let errorStage = '未知阶段';
      
      if (searchProgress) {
        errorStage = searchProgress.stage;
      }
      
      if (error?.message) {
        errorMessage = error.message;
        console.error('错误消息:', errorMessage);
      }
      
      // 如果是 Supabase Edge Function 错误，尝试提取更详细的信息
      if (error?.context) {
        console.error('发现 error.context');
        try {
          const contextText = typeof error.context === 'string' 
            ? error.context 
            : await error.context.text?.();
          console.error('context 文本:', contextText);
          
          if (contextText) {
            try {
              const contextJson = JSON.parse(contextText);
              errorMessage = contextJson.error || contextText;
              console.error('解析后的错误:', errorMessage);
            } catch {
              errorMessage = contextText;
              console.error('使用原始 context 文本:', errorMessage);
            }
          }
        } catch (e) {
          console.error('提取 context 失败:', e);
        }
      }
      
      setSearchProgress({ 
        stage: '失败', 
        message: `在 ${errorStage} 阶段失败`,
        details: errorMessage
      });
      
      toast({
        title: '❌ 资料检索失败',
        description: `${errorStage}：${errorMessage}`,
        variant: 'destructive',
      });
      
      // 如果是 API 密钥相关错误，提供额外提示
      if (errorMessage.includes('API密钥') || errorMessage.includes('API key') || errorMessage.includes('INTEGRATIONS_API_KEY')) {
        setTimeout(() => {
          toast({
            title: '💡 提示',
            description: '请检查 Supabase 项目的 Secrets 配置，确保 INTEGRATIONS_API_KEY 已正确设置',
            duration: 8000,
          });
        }, 1000);
      }
    } finally {
      setSearching(false);
      // 3秒后清除进度信息
      setTimeout(() => setSearchProgress(null), 3000);
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
      // 保存写作摘要到项目
      await updateProject(projectId, { 
        status: 'outline_confirmed',
        writing_summary: writingSummary
      });
      
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

  const handleToggleSelect = async (id: string, selected: boolean) => {
    try {
      await updateKnowledgeBase(id, { selected });
      await loadKnowledge();
    } catch (error) {
      console.error('更新选中状态失败:', error);
    }
  };

  const handleEditKnowledge = (item: KnowledgeBase) => {
    setEditingKnowledge(item);
    setEditDialogOpen(true);
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadKnowledge();
      toast({
        title: '删除成功',
      });
    } catch (error) {
      console.error('删除失败:', error);
      toast({
        title: '删除失败',
        variant: 'destructive',
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingKnowledge) return;
    
    try {
      await updateKnowledgeBase(editingKnowledge.id, {
        title: editingKnowledge.title,
        content: editingKnowledge.content,
      });
      
      await loadKnowledge();
      setEditDialogOpen(false);
      setEditingKnowledge(null);
      
      toast({
        title: '保存成功',
      });
    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: '保存失败',
        variant: 'destructive',
      });
    }
  };

  const handleSynthesize = async () => {
    if (!workflowResult) {
      toast({
        title: '请先搜索资料',
        variant: 'destructive',
      });
      return;
    }

    setSynthesizing(true);
    try {
      // 使用已有的 synthesisResults
      if (workflowResult.synthesisResults) {
        setWritingSummary(workflowResult.synthesisResults);
        toast({
          title: '✅ 综合摘要已生成',
          description: '可以查看并确认进入下一阶段',
        });
      } else {
        toast({
          title: '❌ 未找到综合摘要',
          description: '请重新搜索',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('生成综合摘要失败:', error);
      toast({
        title: '❌ 生成失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSynthesizing(false);
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

          {/* 搜索进度显示 */}
          {searchProgress && (
            <Card className={`border-2 ${
              searchProgress.stage === '失败' 
                ? 'border-destructive bg-destructive/5' 
                : searchProgress.stage === '完成'
                ? 'border-primary bg-primary/5'
                : 'border-primary bg-primary/5'
            }`}>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {searchProgress.stage === '失败' ? (
                        <span className="text-destructive text-lg">❌</span>
                      ) : searchProgress.stage === '完成' ? (
                        <span className="text-primary text-lg">✅</span>
                      ) : (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                      <span className="font-semibold text-sm">
                        {searchProgress.stage}
                      </span>
                    </div>
                    <Badge variant={
                      searchProgress.stage === '失败' 
                        ? 'destructive' 
                        : searchProgress.stage === '完成'
                        ? 'default'
                        : 'secondary'
                    }>
                      {searchProgress.stage === '失败' ? '失败' : searchProgress.stage === '完成' ? '完成' : '进行中'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {searchProgress.message}
                  </p>
                  {searchProgress.details && (
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      {searchProgress.details}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditKnowledge(item)}
                      size="sm"
                      variant="ghost"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteKnowledge(item.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

      {/* 编辑参考文章对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑参考文章</DialogTitle>
            <DialogDescription>修改参考文章的标题和内容</DialogDescription>
          </DialogHeader>
          {editingKnowledge && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">标题</Label>
                <Input
                  id="edit-title"
                  value={editingKnowledge.title}
                  onChange={(e) => setEditingKnowledge({ ...editingKnowledge, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">内容</Label>
                <Textarea
                  id="edit-content"
                  value={editingKnowledge.content}
                  onChange={(e) => setEditingKnowledge({ ...editingKnowledge, content: e.target.value })}
                  rows={15}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveEdit}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
