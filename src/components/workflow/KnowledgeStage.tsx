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
import { Search, Sparkles, CheckCircle2, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import SearchPlanPanel from './SearchPlanPanel';
import SearchResultsPanel from './SearchResultsPanel';
import SynthesisResultsDialog from './SynthesisResultsDialog';
import SearchLogsDialog from './SearchLogsDialog';

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
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const { toast } = useToast();

  // 数据清理函数
  const cleanSearchResults = (results: KnowledgeBase[], requirementsDoc: string): KnowledgeBase[] => {
    // 1. 过滤不当内容
    const inappropriateKeywords = [
      '黄色', '色情', '情欲', '性爱', '裸体', '成人', 'porn', 'sex', 'xxx',
      '赌博', '博彩', '彩票', '六合彩', 'gambling', 'casino',
      '毒品', '大麻', 'drug', 'marijuana'
    ];

    const filtered = results.filter(result => {
      const content = `${result.title} ${result.content || ''}`.toLowerCase();
      return !inappropriateKeywords.some(keyword => content.includes(keyword.toLowerCase()));
    });

    // 2. 标题去重 - 保留内容更完整的
    const titleMap = new Map<string, KnowledgeBase>();
    filtered.forEach(result => {
      const normalizedTitle = result.title.trim().toLowerCase();
      const existing = titleMap.get(normalizedTitle);
      
      if (!existing) {
        titleMap.set(normalizedTitle, result);
      } else {
        // 保留内容更完整的（extracted_content 更多的）
        const existingContentLength = existing.extracted_content?.length || 0;
        const currentContentLength = result.extracted_content?.length || 0;
        if (currentContentLength > existingContentLength) {
          titleMap.set(normalizedTitle, result);
        }
      }
    });

    const deduplicated = Array.from(titleMap.values());

    // 3. 时效性验证 - 从需求文档中提取时间限制
    try {
      const reqDoc = JSON.parse(requirementsDoc);
      const yearStart = reqDoc.year_start || reqDoc.time_range?.start;
      const yearEnd = reqDoc.year_end || reqDoc.time_range?.end;

      if (yearStart || yearEnd) {
        return deduplicated.filter(result => {
          if (!result.published_at) return true; // 没有时间信息的保留
          
          const year = new Date(result.published_at).getFullYear();
          if (!year) return true;

          if (yearStart && year < parseInt(yearStart)) return false;
          if (yearEnd && year > parseInt(yearEnd)) return false;
          return true;
        });
      }
    } catch (error) {
      console.error('解析需求文档时间限制失败:', error);
    }

    return deduplicated;
  };

  useEffect(() => {
    loadKnowledge();
    loadProjectTitle();
    autoSearchFromBrief();
  }, [projectId]);

  // 加载项目标题
  const loadProjectTitle = async () => {
    try {
      const brief = await getBrief(projectId);
      if (brief && brief.topic) {
        setProjectTitle(brief.topic);
      }
    } catch (error) {
      console.error('加载项目标题失败:', error);
    }
  };

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
      
      // 应用数据清理
      const brief = await getBrief(projectId);
      if (brief && brief.requirements) {
        const requirementsDoc = typeof brief.requirements === 'string' 
          ? brief.requirements 
          : JSON.stringify(brief.requirements);
        const cleaned = cleanSearchResults(data, requirementsDoc);
        setKnowledge(cleaned);
      } else {
        setKnowledge(data);
      }
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

  // 处理进入下一步（从搜索结果直接进入）
  const handleNextStep = async () => {
    try {
      await updateProject(projectId, { 
        status: 'outline_confirmed'
      });
      
      toast({
        title: '已进入下一阶段',
        description: '开始文章结构设计',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '操作失败',
        variant: 'destructive',
      });
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

  // 资料整理 - 打开综合分析结果弹窗
  const handleOrganize = () => {
    if (!synthesisResults) {
      toast({
        title: '暂无整理结果',
        description: '请先进行资料综合分析',
        variant: 'destructive',
      });
      return;
    }
    setShowSynthesisDialog(true);
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
      {/* 标题栏 - 移除搜索框 */}
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

        {/* 搜索进度显示 */}
        {searchProgress && (
          <CardContent>
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
          </CardContent>
        )}

        {/* 搜索计划和搜索结果 - 直接放在资料查询卡片下 */}
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 min-h-[400px]">
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
                onOrganize={handleOrganize}
                onNextStep={handleNextStep}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索分析 - 固定底部日志栏 */}
      {searchLogs.length > 0 && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-black text-white border-t border-gray-800 shadow-lg z-50 cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => setShowLogsDialog(true)}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-gray-300">LATEST LOG</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-gray-700" />
                <span className="text-sm text-gray-400">
                  {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-sm text-gray-200">
                  {searchProgress?.message || searchLogs[searchLogs.length - 1]?.substring(0, 50) || '正在解析搜索结果内容...'}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800">
                <FileText className="w-4 h-4 mr-2" />
                日志详情
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 资料整理结果弹窗 */}
      <SynthesisResultsDialog
        open={showSynthesisDialog}
        onOpenChange={setShowSynthesisDialog}
        synthesisResults={synthesisResults}
      />

      {/* 搜索日志弹窗 */}
      <SearchLogsDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        projectTitle={projectTitle}
        logs={searchLogs}
      />
    </div>
  );
}
