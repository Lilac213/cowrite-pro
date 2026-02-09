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
  clearProjectKnowledge,
  getOrCreateWritingSession,
  callResearchSynthesisAgent,
  getResearchInsights,
  getResearchGaps,
  isResearchStageComplete,
  updateWritingSessionStage,
  getRetrievedMaterials,
  getSelectedMaterials,
} from '@/db/api';
import type { KnowledgeBase, WritingSession, ResearchInsight, ResearchGap, SynthesisResult, RetrievedMaterial } from '@/types';
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
import ResearchSynthesisReview from './ResearchSynthesisReview';
import MaterialSelectionPanel from './MaterialSelectionPanel';

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
  
  // 新增：写作会话和研究综合相关状态
  const [writingSession, setWritingSession] = useState<WritingSession | null>(null);
  const [showSynthesisReview, setShowSynthesisReview] = useState(false);
  const [synthesisReviewData, setSynthesisReviewData] = useState<{
    insights: ResearchInsight[];
    gaps: ResearchGap[];
    thought: string;
  } | null>(null);
  const [researchStageComplete, setResearchStageComplete] = useState(false);
  
  // 新增：资料选择相关状态
  const [retrievedMaterials, setRetrievedMaterials] = useState<RetrievedMaterial[]>([]);
  const [showMaterialSelection, setShowMaterialSelection] = useState(false);
  const [materialsConfirmed, setMaterialsConfirmed] = useState(false);
  
  // 新增：搜索计划相关状态
  const [searchPlan, setSearchPlan] = useState<{
    interpreted_topic?: string;
    key_dimensions?: string[];
    academic_queries?: string[];
    news_queries?: string[];
    web_queries?: string[];
    user_library_queries?: string[];
  } | null>(null);
  
  const { toast } = useToast();

  // 初始化写作会话
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await getOrCreateWritingSession(projectId);
        setWritingSession(session);
        
        // 检查研究阶段是否已完成
        if (session.current_stage !== 'research') {
          setResearchStageComplete(true);
        } else {
          const complete = await isResearchStageComplete(session.id);
          setResearchStageComplete(complete);
        }
      } catch (error) {
        console.error('初始化写作会话失败:', error);
      }
    };
    
    initSession();
  }, [projectId]);

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
    // 重置自动搜索标志，确保每次进入页面都会重新搜索
    setAutoSearched(false);
    loadKnowledge();
    loadProjectTitle();
    autoSearchFromBrief();
  }, [projectId]);

  // 当 writingSession 初始化后，尝试自动搜索
  useEffect(() => {
    if (writingSession && !autoSearched) {
      autoSearchFromBrief();
    }
  }, [writingSession]);

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
    
    // 等待写作会话初始化
    if (!writingSession) {
      console.log('[autoSearchFromBrief] 等待 writingSession 初始化');
      return;
    }
    
    try {
      console.log('[autoSearchFromBrief] 开始从需求文档自动搜索');
      const brief = await getBrief(projectId);
      if (!brief || !brief.requirements) {
        console.log('[autoSearchFromBrief] 未找到需求文档或需求内容');
        return;
      }

      const requirements = typeof brief.requirements === 'string' 
        ? JSON.parse(brief.requirements) 
        : brief.requirements;

      console.log('[autoSearchFromBrief] 需求文档内容:', requirements);

      // 构建搜索查询（用于显示）
      const searchQuery = [
        requirements.主题 || brief.topic,
        ...(requirements.核心观点 || []),
        ...(requirements.关键要点 || [])
      ].filter(Boolean).join(' ');

      if (searchQuery.trim()) {
        setQuery(searchQuery);
        setAutoSearched(true);
        
        // 清空旧的知识库数据
        console.log('[autoSearchFromBrief] 清空旧的知识库数据...');
        await clearProjectKnowledge(projectId);
        setKnowledge([]);
        
        // 显示提示信息
        toast({
          title: '📋 已加载需求文档',
          description: '正在根据需求文档生成搜索计划并检索资料...',
        });
        
        // 自动执行搜索（传入完整的需求文档）
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

    // 确保写作会话已初始化
    if (!writingSession) {
      toast({
        title: '初始化中',
        description: '请稍等片刻后再试',
        variant: 'destructive',
      });
      console.error('[handleSearch] writingSession 未初始化');
      return;
    }

    setSearching(true);
    setSearchProgress({ stage: '准备中', message: '正在初始化搜索...' });
    
    // 添加初始日志
    setSearchLogs(['[' + new Date().toLocaleTimeString('zh-CN') + '] 开始搜索资料...']);

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
      setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在读取需求文档...']);

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

      console.log('[KnowledgeStage] 完整需求文档:', requirementsDoc);

      setSearchProgress({ 
        stage: '生成搜索计划', 
        message: 'Research Retrieval Agent 正在分析需求文档，生成搜索计划...',
        details: '将根据需求文档的主题、核心观点和关键要点，为不同数据源生成针对性的搜索关键词'
      });
      setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] Research Retrieval Agent 正在分析需求文档...']);

      toast({
        title: '🤖 启动 Research Retrieval Agent',
        description: '正在分析需求文档并生成搜索计划...',
      });

      // 等待一小段时间让用户看到搜索计划生成的提示
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSearchProgress({ 
        stage: '资料检索', 
        message: '正在从 5 个数据源检索相关资料...',
        details: '数据源：Google Scholar、TheNews、Smart Search、参考文章库、个人素材库'
      });
      setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在从 5 个数据源检索相关资料...']);

      console.log('[KnowledgeStage] 调用 agentDrivenResearchWorkflow，需求文档:', requirementsDoc);
      console.log('[KnowledgeStage] writingSession:', writingSession);
      console.log('[KnowledgeStage] writingSession.id:', writingSession?.id);

      // 使用新的 Agent 驱动的研究工作流（传入 sessionId）
      const { retrievalResults, synthesisResults } = await agentDrivenResearchWorkflow(
        requirementsDoc,
        projectId,
        user.id,
        writingSession?.id // 传入 sessionId
      );

      console.log('[KnowledgeStage] agentDrivenResearchWorkflow 返回结果:');
      console.log('  - retrievalResults:', retrievalResults);
      console.log('  - synthesisResults:', synthesisResults);

      // 提取并显示日志
      if (retrievalResults.logs && Array.isArray(retrievalResults.logs)) {
        const formattedLogs = retrievalResults.logs.map(log => 
          '[' + new Date().toLocaleTimeString('zh-CN') + '] ' + log
        );
        setSearchLogs(prev => [...prev, ...formattedLogs]);
      }

      // 提取搜索计划
      if (retrievalResults?.search_summary) {
        console.log('[KnowledgeStage] 搜索计划:', retrievalResults.search_summary);
        setSearchPlan(retrievalResults.search_summary);
        setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 搜索计划已生成']);
        
        // 显示搜索计划
        const planDetails: string[] = [];
        if (retrievalResults.search_summary.interpreted_topic) {
          planDetails.push(`主题理解：${retrievalResults.search_summary.interpreted_topic}`);
        }
        if (retrievalResults.search_summary.academic_queries?.length > 0) {
          planDetails.push(`学术搜索：${retrievalResults.search_summary.academic_queries.join(', ')}`);
        }
        if (retrievalResults.search_summary.news_queries?.length > 0) {
          planDetails.push(`新闻搜索：${retrievalResults.search_summary.news_queries.join(', ')}`);
        }
        if (retrievalResults.search_summary.web_queries?.length > 0) {
          planDetails.push(`网络搜索：${retrievalResults.search_summary.web_queries.join(', ')}`);
        }
        
        if (planDetails.length > 0) {
          toast({
            title: '📋 搜索计划已生成',
            description: planDetails[0],
          });
        }
      }

      // 保存 retrievalResults 以便后续使用
      setRetrievalResults(retrievalResults);
      setSynthesisResults(synthesisResults);

      // 加载检索到的资料
      let loadedMaterials: RetrievedMaterial[] = [];
      if (writingSession) {
        console.log('[KnowledgeStage] 开始加载检索资料，sessionId:', writingSession.id);
        setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在加载检索到的资料...']);
        try {
          loadedMaterials = await getRetrievedMaterials(writingSession.id);
          console.log('[KnowledgeStage] 成功加载资料数量:', loadedMaterials.length);
          console.log('[KnowledgeStage] 资料详情:', loadedMaterials);
          setRetrievedMaterials(loadedMaterials);
          
          // 转换 RetrievedMaterial 为 KnowledgeBase 格式并更新 knowledge 状态
          const knowledgeItems: KnowledgeBase[] = loadedMaterials.map(material => ({
            id: material.id,
            project_id: projectId,
            title: material.title,
            content: material.abstract || material.full_text || '',
            source: material.source_type,
            source_url: material.url,
            published_at: material.published_at || material.year,
            collected_at: material.created_at,
            selected: material.is_selected,
            content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
            extracted_content: material.full_text ? [material.full_text] : [],
            full_text: material.full_text,
            created_at: material.created_at,
          }));
          setKnowledge(knowledgeItems);
          
          setShowMaterialSelection(true);
          setMaterialsConfirmed(false);
          setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 成功加载 ' + loadedMaterials.length + ' 条资料']);
        } catch (error: any) {
          console.error('[KnowledgeStage] 加载资料失败:', error);
          setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 加载资料失败: ' + error.message]);
          toast({
            title: '加载资料失败',
            description: error.message || '请稍后重试',
            variant: 'destructive',
          });
        }
      } else {
        console.warn('[KnowledgeStage] writingSession 为空，无法加载资料');
        setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 错误：写作会话未初始化']);
      }

      setSearchProgress({ 
        stage: '完成', 
        message: `已检索到 ${loadedMaterials.length} 条资料，请选择需要的资料`,
      });
      setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ 资料检索完成']);

      toast({
        title: '✅ 资料检索完成',
        description: `已检索到 ${loadedMaterials.length} 条资料，请选择需要的资料`,
      });

      // 注意：不再自动保存到知识库，等待用户选择资料后再保存
      // 旧的自动保存代码已被注释

      // 保存综合结果到项目（暂时为空）
      setWorkflowResult({
        retrievalResults,
        synthesisResults: null,
      });

      // 更新最后搜索时间
      setLastSearchTime(new Date().toLocaleString('zh-CN'));
      
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
    // 检查是否已完成研究阶段决策
    if (!researchStageComplete) {
      toast({
        title: '请先完成资料整理',
        description: '需要先点击"资料整理"并完成所有决策后才能进入下一阶段',
        variant: 'destructive',
      });
      return;
    }

    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 更新写作会话阶段
      await updateWritingSessionStage(writingSession.id, 'structure');
      
      // 更新项目状态
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

  // 重新搜索
  const handleRefreshSearch = () => {
    setShowMaterialSelection(false);
    setMaterialsConfirmed(false);
    setRetrievedMaterials([]);
    // 触发重新搜索
    if (query.trim()) {
      handleSearch();
    } else {
      toast({
        title: '请输入搜索内容',
        variant: 'destructive',
      });
    }
  };

  // 资料整理 - 调用研究综合 Agent
  // 处理资料选择确认
  const handleMaterialSelectionConfirm = async () => {
    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 获取选中的资料
      const selectedMaterials = await getSelectedMaterials(writingSession.id);
      
      if (selectedMaterials.length === 0) {
        toast({
          title: '请选择资料',
          description: '至少选择一条资料才能继续',
          variant: 'destructive',
        });
        return;
      }

      setMaterialsConfirmed(true);
      setShowMaterialSelection(false);

      toast({
        title: '✅ 资料选择已确认',
        description: `已选择 ${selectedMaterials.length} 条资料，现在可以进行整理`,
      });
    } catch (error: any) {
      console.error('确认资料选择失败:', error);
      toast({
        title: '确认失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleOrganize = async () => {
    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }

    if (knowledge.length === 0) {
      toast({
        title: '暂无资料',
        description: '请先进行资料搜索',
        variant: 'destructive',
      });
      return;
    }

    setSynthesizing(true);
    try {
      // 调用研究综合 Agent
      const result: SynthesisResult = await callResearchSynthesisAgent(projectId, writingSession.id);
      
      // 获取保存的洞察和空白
      const insights = await getResearchInsights(writingSession.id);
      const gaps = await getResearchGaps(writingSession.id);
      
      // 设置审阅数据
      setSynthesisReviewData({
        insights,
        gaps,
        thought: result.thought,
      });
      
      // 显示审阅界面
      setShowSynthesisReview(true);
      
      toast({
        title: '资料整理完成',
        description: `已生成 ${insights.length} 条研究洞察，请审阅并做出决策`,
      });
    } catch (error: any) {
      console.error('资料整理失败:', error);
      toast({
        title: '资料整理失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSynthesizing(false);
    }
  };

  // 处理综合审阅完成
  const handleSynthesisReviewComplete = async () => {
    if (!writingSession) return;
    
    try {
      // 检查是否所有决策都已完成
      const complete = await isResearchStageComplete(writingSession.id);
      setResearchStageComplete(complete);
      setShowSynthesisReview(false);
      
      toast({
        title: '决策已保存',
        description: '您现在可以进入下一阶段',
      });
    } catch (error: any) {
      console.error('检查完成状态失败:', error);
    }
  };

  // 取消综合审阅
  const handleSynthesisReviewCancel = () => {
    setShowSynthesisReview(false);
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

  // Debug logging
  console.log('[KnowledgeStage] searchSummary:', searchSummary);
  console.log('[KnowledgeStage] academic_queries:', searchSummary?.academic_queries);
  console.log('[KnowledgeStage] news_queries:', searchSummary?.news_queries);
  console.log('[KnowledgeStage] web_queries:', searchSummary?.web_queries);
  console.log('[KnowledgeStage] user_library_queries:', searchSummary?.user_library_queries);

  return (
    <div className="space-y-4">
      {/* 如果正在显示综合审阅，则显示审阅界面 */}
      {showSynthesisReview && synthesisReviewData ? (
        <ResearchSynthesisReview
          sessionId={writingSession!.id}
          insights={synthesisReviewData.insights}
          gaps={synthesisReviewData.gaps}
          thought={synthesisReviewData.thought}
          onDecisionsComplete={handleSynthesisReviewComplete}
          onCancel={handleSynthesisReviewCancel}
        />
      ) : (
        <>
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资料选择面板 - 显示在搜索结果下方 */}
      {showMaterialSelection && retrievedMaterials.length > 0 && (
        <MaterialSelectionPanel
          materials={retrievedMaterials}
          onConfirm={handleMaterialSelectionConfirm}
          onRefresh={handleRefreshSearch}
        />
      )}

      {/* 底部操作按钮 */}
      {knowledge.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {researchStageComplete ? (
                  <span className="text-green-600 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    研究阶段已完成，可以进入下一阶段
                  </span>
                ) : materialsConfirmed ? (
                  <span>
                    请点击"资料整理"并完成决策
                  </span>
                ) : retrievedMaterials.length > 0 ? (
                  <span>
                    请选择需要的资料
                  </span>
                ) : (
                  <span>
                    请先进行资料搜索
                  </span>
                )}
              </div>
              <div className="flex gap-4">
                <Button 
                  onClick={handleOrganize} 
                  variant="outline"
                  className="min-w-[140px]"
                  disabled={synthesizing || !materialsConfirmed}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {synthesizing ? '整理中...' : '资料整理'}
                </Button>
                <Button 
                  onClick={handleNextStep}
                  className="min-w-[140px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  disabled={!researchStageComplete}
                >
                  进入下一阶段
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className={`w-2 h-2 rounded-full ${searching ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium text-gray-300">LATEST LOG</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-gray-700" />
                <span className="text-sm text-gray-400">
                  {(() => {
                    const latestLog = searchLogs[searchLogs.length - 1] || '';
                    const timeMatch = latestLog.match(/\[(\d{2}:\d{2}:\d{2})\]/);
                    return timeMatch ? timeMatch[1] : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  })()}
                </span>
                <span className="text-sm text-gray-200">
                  {(() => {
                    const latestLog = searchLogs[searchLogs.length - 1] || '';
                    // 移除时间戳部分，只显示消息内容
                    const message = latestLog.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                    return message.substring(0, 80) || searchProgress?.message || '正在解析搜索结果内容...';
                  })()}
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
        </>
      )}
    </div>
  );
}
