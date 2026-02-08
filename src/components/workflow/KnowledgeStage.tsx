import { useState, useEffect } from 'react';
import { 
  getKnowledgeBase, 
  createKnowledgeBase, 
  updateKnowledgeBase, 
  updateProject, 
  academicSearchWorkflow,
  agentDrivenResearchWorkflow,
  researchSynthesisAgent,
  generateWritingSummary, 
  saveToReferenceLibrary,
  getBrief,
  getMaterials,
  getReferenceArticles,
  searchMaterials,
  searchReferenceArticles,
  callLLMGenerate,
  clearProjectKnowledge
} from '@/db/api';
import type { KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import SearchPlanPanel from './SearchPlanPanel';
import SearchResultsPanel from './SearchResultsPanel';

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
  const [searchProgress, setSearchProgress] = useState<{
    stage: string;
    message: string;
    details?: string;
  } | null>(null);
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [retrievalResults, setRetrievalResults] = useState<any>(null);
  const [synthesisLogs, setSynthesisLogs] = useState<string[]>([]);
  const [synthesisResults, setSynthesisResults] = useState<any>(null);
  const [lastSearchTime, setLastSearchTime] = useState<string>('');
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
        
        // 清空旧的知识库数据
        console.log('[KnowledgeStage] 清空旧的知识库数据...');
        await clearProjectKnowledge(projectId);
        setKnowledge([]);
        
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

      // 清空旧的知识库数据（如果不是自动搜索触发的）
      if (!autoSearched) {
        console.log('[KnowledgeStage] 清空旧的知识库数据...');
        await clearProjectKnowledge(projectId);
        setKnowledge([]);
      }

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

      console.log('[KnowledgeStage] 调用 agentDrivenResearchWorkflow，需求文档:', requirementsDoc);

      // 清空之前的日志
      setSearchLogs([]);

      // 使用新的 Agent 驱动的研究工作流
      const { retrievalResults, synthesisResults } = await agentDrivenResearchWorkflow(
        requirementsDoc,
        projectId,
        user.id
      );

      console.log('[KnowledgeStage] agentDrivenResearchWorkflow 返回结果:');
      console.log('  - retrievalResults:', retrievalResults);
      console.log('  - synthesisResults:', synthesisResults);

      // 提取并显示日志
      if (retrievalResults.logs && Array.isArray(retrievalResults.logs)) {
        setSearchLogs(retrievalResults.logs);
      }

      // 保存 retrievalResults 以便后续使用
      setRetrievalResults(retrievalResults);
      setSynthesisResults(synthesisResults);

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
        ...(retrievalResults.academic_sources || []),
        ...(retrievalResults.news_sources || []),
        ...(retrievalResults.web_sources || []),
        ...(retrievalResults.user_library_sources || []),
        ...(retrievalResults.personal_sources || []),
      ];

      console.log('[KnowledgeStage] 所有来源数量:', allSources.length);
      console.log('[KnowledgeStage] 来源详情:', {
        academic: retrievalResults.academic_sources?.length || 0,
        news: retrievalResults.news_sources?.length || 0,
        web: retrievalResults.web_sources?.length || 0,
        user_library: retrievalResults.user_library_sources?.length || 0,
        personal: retrievalResults.personal_sources?.length || 0,
      });

      setSearchProgress({ 
        stage: '保存资料', 
        message: `正在保存 ${allSources.length} 条资料到知识库...`
      });

      // 保存到知识库
      for (const source of allSources) {
        let title = source.title || '无标题';
        let content = '';
        let sourceLabel = '';
        let sourceUrl = source.url || '';
        let contentStatus = source.content_status || 'abstract_only';
        let extractedContent = source.extracted_content || [];
        let fullText = source.full_text || '';

        // 根据 source_type 构建内容
        if (source.source_type === 'GoogleScholar') {
          sourceLabel = 'Google Scholar';
          content = `作者: ${source.authors || '未知'}\n年份: ${source.year || '未知'}\n引用次数: ${source.citation_count || 0}\n\n`;
          
          if (fullText && fullText.length > 100) {
            content += `全文:\n${fullText}`;
          } else if (extractedContent.length > 0) {
            content += `摘要:\n${extractedContent.join('\n\n')}`;
          } else {
            content += `摘要:\n${source.abstract || '暂无摘要'}`;
          }
          
          if (source.notes) {
            content += `\n\n备注: ${source.notes}`;
          }
        } else if (source.source_type === 'TheNews') {
          sourceLabel = 'TheNews';
          content = `来源: ${source.source || '未知'}\n发布时间: ${source.published_at || '未知'}\n\n`;
          
          if (fullText && fullText.length > 100) {
            content += `全文:\n${fullText}`;
          } else if (extractedContent.length > 0) {
            content += `内容:\n${extractedContent.join('\n\n')}`;
          } else {
            content += `摘要:\n${source.summary || '暂无内容'}`;
          }
          
          if (source.notes) {
            content += `\n\n备注: ${source.notes}`;
          }
        } else if (source.source_type === 'SmartSearch') {
          sourceLabel = 'Smart Search';
          content = `网站: ${source.site_name || '未知'}\n\n`;
          
          if (fullText && fullText.length > 100) {
            content += `全文:\n${fullText}`;
          } else if (extractedContent.length > 0) {
            content += `内容:\n${extractedContent.join('\n\n')}`;
          } else {
            content += `摘要:\n${source.snippet || '暂无内容'}`;
          }
          
          if (source.notes) {
            content += `\n\n备注: ${source.notes}`;
          }
        } else if (source.source_type === 'UserLibrary') {
          sourceLabel = '参考文章库';
          content = fullText || extractedContent.join('\n\n') || '暂无内容';
        } else if (source.source_type === 'PersonalMaterial') {
          sourceLabel = '个人素材库';
          content = fullText || extractedContent.join('\n\n') || '暂无内容';
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
          content_status: contentStatus,
          extracted_content: extractedContent.length > 0 ? extractedContent : undefined,
          full_text: fullText || undefined,
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
      
      // 更新最后搜索时间
      setLastSearchTime(new Date().toLocaleString('zh-CN'));
      
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

  const handleSynthesize = async () => {
    const selectedKnowledge = knowledge.filter((k) => k.selected);
    
    if (selectedKnowledge.length === 0) {
      toast({
        title: '请先选择资料',
        description: '至少选择一条资料进行综合分析',
        variant: 'destructive',
      });
      return;
    }

    if (!retrievalResults) {
      toast({
        title: '请先搜索资料',
        variant: 'destructive',
      });
      return;
    }

    setSynthesizing(true);
    setSynthesisLogs([]);
    
    try {
      toast({
        title: '🧠 启动 Research Synthesis Agent',
        description: `正在整理 ${selectedKnowledge.length} 条资料...`,
      });

      // 构建筛选后的 retrievalResults
      const filteredResults: {
        academic_sources: any[];
        news_sources: any[];
        web_sources: any[];
        user_library_sources: any[];
        personal_sources: any[];
      } = {
        academic_sources: [],
        news_sources: [],
        web_sources: [],
        user_library_sources: [],
        personal_sources: []
      };

      // 根据选中的知识库项目，筛选对应的来源
      for (const item of selectedKnowledge) {
        if (item.source === 'Google Scholar') {
          // 从原始 retrievalResults 中找到对应的项目
          const source = retrievalResults.academic_sources?.find((s: any) => 
            s.title === item.title || s.url === item.source_url
          );
          if (source) filteredResults.academic_sources.push(source);
        } else if (item.source === 'TheNews') {
          const source = retrievalResults.news_sources?.find((s: any) => 
            s.title === item.title || s.url === item.source_url
          );
          if (source) filteredResults.news_sources.push(source);
        } else if (item.source === 'Smart Search') {
          const source = retrievalResults.web_sources?.find((s: any) => 
            s.title === item.title || s.url === item.source_url
          );
          if (source) filteredResults.web_sources.push(source);
        } else if (item.source === '参考文章库') {
          filteredResults.user_library_sources.push({
            title: item.title,
            content: item.content,
            url: item.source_url
          });
        } else if (item.source === '个人素材库') {
          filteredResults.personal_sources.push({
            title: item.title,
            content: item.content
          });
        }
      }

      // 获取需求文档
      const brief = await getBrief(projectId);
      
      // 构建需求文档
      const requirements = brief?.requirements 
        ? (typeof brief.requirements === 'string' ? JSON.parse(brief.requirements) : brief.requirements)
        : {};
      
      const requirementsDoc = {
        主题: requirements.主题 || brief?.topic || '',
        关键要点: requirements.关键要点 || [],
        核心观点: requirements.核心观点 || [],
        目标读者: requirements.目标读者 || '通用读者',
        写作风格: requirements.写作风格 || '专业',
        预期长度: requirements.预期长度 || '中等',
      };

      // 调用 synthesis agent
      const result = await researchSynthesisAgent(filteredResults, requirementsDoc);

      // 提取并显示日志
      if (result.logs && Array.isArray(result.logs)) {
        setSynthesisLogs(result.logs);
      }

      // 保存综合结果
      setSynthesisResults(result);
      setWritingSummary(result);

      toast({
        title: '✅ 综合摘要已生成',
        description: '可以查看并确认进入下一阶段',
      });
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

  // 批量收藏
  const handleBatchFavorite = async (ids: string[], selected: boolean) => {
    try {
      for (const id of ids) {
        await updateKnowledgeBase(id, { selected });
      }
      await loadKnowledge();
      toast({
        title: '✅ 批量收藏成功',
        description: `已收藏 ${ids.length} 条资料`,
      });
    } catch (error) {
      console.error('批量收藏失败:', error);
      toast({
        title: '❌ 批量收藏失败',
        description: '操作失败，请重试',
        variant: 'destructive',
      });
    }
  };

  // 批量删除
  const handleBatchDelete = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await supabase.from('knowledge_base').delete().eq('id', id);
      }
      await loadKnowledge();
      toast({
        title: '✅ 批量删除成功',
        description: `已删除 ${ids.length} 条资料`,
      });
    } catch (error) {
      console.error('批量删除失败:', error);
      toast({
        title: '❌ 批量删除失败',
        description: '操作失败，请重试',
        variant: 'destructive',
      });
    }
  };

  // 刷新搜索
  const handleRefreshSearch = () => {
    if (query.trim()) {
      handleSearch();
    } else {
      toast({
        title: '请输入搜索内容',
        variant: 'destructive',
      });
    }
  };

  // 解析搜索计划
  const searchSummary = retrievalResults?.search_summary ? {
    interpreted_topic: retrievalResults.search_summary.interpreted_topic,
    key_dimensions: retrievalResults.search_summary.key_dimensions,
    academic_queries: retrievalResults.search_summary.academic_queries,
    news_queries: retrievalResults.search_summary.news_queries,
    web_queries: retrievalResults.search_summary.web_queries,
    user_library_queries: retrievalResults.search_summary.user_library_queries,
  } : undefined;

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle>资料查询</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              {lastSearchTime && (
                <span className="text-sm text-muted-foreground">
                  上次更新: {lastSearchTime}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshSearch}
                disabled={searching}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${searching ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {searching ? '搜索中...' : '开始搜索'}
            </Button>
          </div>

          {/* 搜索进度显示 */}
          {searchProgress && (
            <Card className={`mt-4 border-2 ${
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

      {/* 搜索计划和搜索结果 - 合并到一个卡片 */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* 左侧：搜索计划 */}
            <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r pb-4 lg:pb-0 lg:pr-6">
              <h3 className="text-base font-semibold mb-4">搜索计划</h3>
              <SearchPlanPanel 
                searchSummary={searchSummary} 
                isSearching={searching}
              />
            </div>

            {/* 右侧：搜索结果 */}
            <div className="lg:col-span-2">
              <h3 className="text-base font-semibold mb-4">搜索结果</h3>
              <SearchResultsPanel
                results={knowledge}
                onToggleFavorite={handleToggleSelect}
                onDelete={handleBatchDelete}
                onBatchFavorite={handleBatchFavorite}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      {knowledge.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                已选择 {knowledge.filter((k) => k.selected).length} / {knowledge.length} 条资料
              </div>
              <div className="flex gap-2">
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* 显示搜索日志 */}
      {searchLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>搜索分析</CardTitle>
            <CardDescription>实时搜索日志</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-96 overflow-y-auto bg-muted p-4 rounded-lg font-mono text-xs">
              {searchLogs.map((log, index) => (
                <div key={index} className="text-foreground whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 显示综合分析日志 */}
      {synthesisLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>综合分析日志</CardTitle>
            <CardDescription>Research Synthesis Agent 处理过程</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-96 overflow-y-auto bg-muted p-4 rounded-lg font-mono text-xs">
              {synthesisLogs.map((log, index) => (
                <div key={index} className="text-foreground whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 显示综合分析结果 */}
      {synthesisResults && (
        <Card>
          <CardHeader>
            <CardTitle>综合分析结果</CardTitle>
            <CardDescription>结构化的写作素材</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 综合洞察 */}
            {synthesisResults.synthesized_insights && synthesisResults.synthesized_insights.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">综合洞察</h4>
                <div className="space-y-2">
                  {synthesisResults.synthesized_insights.map((insight: any, idx: number) => (
                    <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-sm">{typeof insight === 'string' ? insight : insight.insight || JSON.stringify(insight)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* 关键数据点 */}
            {synthesisResults.key_data_points && synthesisResults.key_data_points.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">关键数据点</h4>
                <div className="space-y-2">
                  {synthesisResults.key_data_points.map((point: any, idx: number) => {
                    // 解析 JSON 内容
                    let displayText = '';
                    if (typeof point === 'string') {
                      displayText = point;
                    } else if (point && typeof point === 'object') {
                      displayText = point.data_point || point.point || point.text || JSON.stringify(point);
                    } else {
                      displayText = String(point);
                    }
                    
                    return (
                      <div key={idx} className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-sm">{displayText}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* 矛盾或空白 */}
            {synthesisResults.contradictions_or_gaps && synthesisResults.contradictions_or_gaps.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">矛盾或研究空白</h4>
                <div className="space-y-2">
                  {synthesisResults.contradictions_or_gaps.map((item: any, idx: number) => {
                    // 解析 JSON 内容
                    let displayText = '';
                    if (typeof item === 'string') {
                      displayText = item;
                    } else if (item && typeof item === 'object') {
                      displayText = item.gap || item.contradiction || item.text || item.description || JSON.stringify(item);
                    } else {
                      displayText = String(item);
                    }
                    
                    return (
                      <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-sm">{displayText}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
