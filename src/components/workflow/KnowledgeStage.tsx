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
  updateRetrievedMaterialSelection,
  batchUpdateRetrievedMaterialSelection,
  updateInsightDecision,
  updateGapDecision,
  callArticleStructureAgent,
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
  const [logDialogType, setLogDialogType] = useState<'search' | 'synthesis'>('search'); // 新增：日志类型
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

  // 新增：localStorage 缓存相关函数
  const getCacheKey = (projectId: string) => `search_cache_${projectId}`;
  
  const saveSearchCache = (projectId: string, data: {
    searchPlan: any;
    retrievedMaterials: RetrievedMaterial[];
    searchLogs: string[];
    lastSearchTime: string;
    query: string;
  }) => {
    try {
      const cacheKey = getCacheKey(projectId);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      console.log('[saveSearchCache] 缓存已保存:', cacheKey);
    } catch (error) {
      console.error('[saveSearchCache] 保存缓存失败:', error);
    }
  };
  
  const loadSearchCache = (projectId: string) => {
    try {
      const cacheKey = getCacheKey(projectId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        console.log('[loadSearchCache] 缓存已加载:', data);
        return data;
      }
    } catch (error) {
      console.error('[loadSearchCache] 加载缓存失败:', error);
    }
    return null;
  };
  
  const clearSearchCache = (projectId: string) => {
    try {
      const cacheKey = getCacheKey(projectId);
      localStorage.removeItem(cacheKey);
      console.log('[clearSearchCache] 缓存已清除:', cacheKey);
    } catch (error) {
      console.error('[clearSearchCache] 清除缓存失败:', error);
    }
  };

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
        
        // 尝试从数据库加载检索资料
        console.log('[initSession] 尝试从数据库加载检索资料，sessionId:', session.id);
        try {
          const dbMaterials = await getRetrievedMaterials(session.id);
          console.log('[initSession] 从数据库加载的资料数量:', dbMaterials.length);
          
          if (dbMaterials.length > 0) {
            // 如果数据库中有资料，使用数据库的数据（包含最新的 is_selected 状态）
            console.log('[initSession] 使用数据库中的资料');
            setRetrievedMaterials(dbMaterials);
            
            // 转换为 knowledge 格式
            const knowledgeItems: KnowledgeBase[] = dbMaterials.map((material: RetrievedMaterial) => {
              let publishedAt = material.published_at;
              if (!publishedAt && material.year) {
                publishedAt = `${material.year}-01-01T00:00:00Z`;
              }
              
              return {
                id: material.id,
                project_id: projectId,
                title: material.title,
                content: material.abstract || material.full_text || '',
                source: material.source_type,
                source_url: material.url,
                published_at: publishedAt,
                collected_at: material.created_at,
                selected: material.is_selected,
                content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
                extracted_content: material.full_text ? [material.full_text] : [],
                full_text: material.full_text,
                created_at: material.created_at,
              };
            });
            setKnowledge(knowledgeItems);
            setAutoSearched(true);
            
            // 尝试从缓存加载其他信息（搜索计划、日志等）
            const cached = loadSearchCache(projectId);
            if (cached) {
              console.log('[initSession] 从缓存加载搜索计划和日志');
              setSearchPlan(cached.searchPlan);
              setSearchLogs(cached.searchLogs || []);
              setLastSearchTime(cached.lastSearchTime || '');
              setQuery(cached.query || '');
            }
            
            toast({
              title: '已加载检索资料',
              description: `共 ${dbMaterials.length} 条资料`,
            });
          } else {
            // 如果数据库中没有资料，尝试从缓存加载
            console.log('[initSession] 数据库中没有资料，尝试从缓存加载');
            const cached = loadSearchCache(projectId);
            if (cached && cached.retrievedMaterials && cached.retrievedMaterials.length > 0) {
              console.log('[initSession] 从缓存加载搜索结果');
              setSearchPlan(cached.searchPlan);
              setRetrievedMaterials(cached.retrievedMaterials);
              setSearchLogs(cached.searchLogs || []);
              setLastSearchTime(cached.lastSearchTime || '');
              setQuery(cached.query || '');
              
              // 转换为 knowledge 格式
              const knowledgeItems: KnowledgeBase[] = cached.retrievedMaterials.map((material: RetrievedMaterial) => {
                let publishedAt = material.published_at;
                if (!publishedAt && material.year) {
                  publishedAt = `${material.year}-01-01T00:00:00Z`;
                }
                
                return {
                  id: material.id,
                  project_id: projectId,
                  title: material.title,
                  content: material.abstract || material.full_text || '',
                  source: material.source_type,
                  source_url: material.url,
                  published_at: publishedAt,
                  collected_at: material.created_at,
                  selected: material.is_selected,
                  content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
                  extracted_content: material.full_text ? [material.full_text] : [],
                  full_text: material.full_text,
                  created_at: material.created_at,
                };
              });
              setKnowledge(knowledgeItems);
              setAutoSearched(true);
              
              toast({
                title: '已加载缓存的搜索结果',
                description: `共 ${cached.retrievedMaterials.length} 条资料`,
              });
            }
          }
        } catch (error) {
          console.error('[initSession] 加载检索资料失败:', error);
          // 如果加载失败，尝试从缓存加载
          const cached = loadSearchCache(projectId);
          if (cached && cached.retrievedMaterials && cached.retrievedMaterials.length > 0) {
            console.log('[initSession] 从缓存加载搜索结果（数据库加载失败）');
            setSearchPlan(cached.searchPlan);
            setRetrievedMaterials(cached.retrievedMaterials);
            setSearchLogs(cached.searchLogs || []);
            setLastSearchTime(cached.lastSearchTime || '');
            setQuery(cached.query || '');
            
            // 转换为 knowledge 格式
            const knowledgeItems: KnowledgeBase[] = cached.retrievedMaterials.map((material: RetrievedMaterial) => {
              let publishedAt = material.published_at;
              if (!publishedAt && material.year) {
                publishedAt = `${material.year}-01-01T00:00:00Z`;
              }
              
              return {
                id: material.id,
                project_id: projectId,
                title: material.title,
                content: material.abstract || material.full_text || '',
                source: material.source_type,
                source_url: material.url,
                published_at: publishedAt,
                collected_at: material.created_at,
                selected: material.is_selected,
                content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
                extracted_content: material.full_text ? [material.full_text] : [],
                full_text: material.full_text,
                created_at: material.created_at,
              };
            });
            setKnowledge(knowledgeItems);
            setAutoSearched(true);
            
            toast({
              title: '已加载缓存的搜索结果',
              description: `共 ${cached.retrievedMaterials.length} 条资料`,
            });
          }
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
          const knowledgeItems: KnowledgeBase[] = loadedMaterials.map(material => {
            // 处理 published_at：如果只有 year，转换为该年的1月1日
            let publishedAt = material.published_at;
            if (!publishedAt && material.year) {
              // 将年份转换为 ISO 时间戳（该年的1月1日）
              publishedAt = `${material.year}-01-01T00:00:00Z`;
            }
            
            return {
              id: material.id,
              project_id: projectId,
              title: material.title,
              content: material.abstract || material.full_text || '',
              source: material.source_type,
              source_url: material.url,
              published_at: publishedAt,
              collected_at: material.created_at,
              selected: material.is_selected,
              content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
              extracted_content: material.full_text ? [material.full_text] : [],
              full_text: material.full_text,
              created_at: material.created_at,
            };
          });
          setKnowledge(knowledgeItems);
          
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
        message: `已检索到 ${loadedMaterials.length} 条资料，可以开始资料整理`,
      });
      setSearchLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ 资料检索完成']);

      toast({
        title: '✅ 资料检索完成',
        description: `已检索到 ${loadedMaterials.length} 条资料，可以开始资料整理`,
      });

      // 注意：资料将在用户点击"资料整理"时自动保存到知识库
      // 旧的自动保存代码已被注释

      // 保存综合结果到项目（暂时为空）
      setWorkflowResult({
        retrievalResults,
        synthesisResults: null,
      });

      // 更新最后搜索时间
      const searchTime = new Date().toLocaleString('zh-CN');
      setLastSearchTime(searchTime);
      
      // 保存搜索结果到 localStorage 缓存
      saveSearchCache(projectId, {
        searchPlan: retrievalResults?.search_summary || null,
        retrievedMaterials: loadedMaterials,
        searchLogs: [...searchLogs, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ 资料检索完成'],
        lastSearchTime: searchTime,
        query: queryToUse,
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
    console.log('[handleNextStep] 开始进入下一阶段');
    console.log('[handleNextStep] writingSession:', writingSession);
    console.log('[handleNextStep] retrievedMaterials.length:', retrievedMaterials.length);
    console.log('[handleNextStep] knowledge.length:', knowledge.length);
    console.log('[handleNextStep] researchStageComplete:', researchStageComplete);

    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }

    // 如果 retrievedMaterials 为空但 knowledge 有数据，使用 knowledge
    const materialsToUse = retrievedMaterials.length > 0 ? retrievedMaterials : knowledge;
    
    if (materialsToUse.length === 0) {
      toast({
        title: '暂无资料',
        description: '请先进行资料搜索',
        variant: 'destructive',
      });
      return;
    }

    try {
      setConfirming(true);
      
      // 如果还没有完成研究综合，先执行综合
      if (!researchStageComplete) {
        console.log('[handleNextStep] 需要先执行研究综合');
        
        toast({
          title: '正在整理资料',
          description: '正在分析检索到的资料并生成研究洞察...',
        });
        
        setSynthesisLogs(['[' + new Date().toLocaleTimeString('zh-CN') + '] 开始资料整理...']);
        
        // 1. 获取所有检索到的资料
        console.log('[handleNextStep] 调用 getRetrievedMaterials，sessionId:', writingSession.id);
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在获取检索到的资料...']);
        const allMaterials = await getRetrievedMaterials(writingSession.id);
        console.log('[handleNextStep] getRetrievedMaterials 返回结果:', allMaterials);
        console.log('[handleNextStep] 资料总数:', allMaterials.length);
        
        // 如果数据库中没有资料，使用当前的 knowledge 或 retrievedMaterials
        const finalMaterials = allMaterials.length > 0 ? allMaterials : materialsToUse;
        
        if (finalMaterials.length === 0) {
          console.error('[handleNextStep] 没有可用的资料');
          toast({
            title: '暂无资料',
            description: '请先进行资料搜索',
            variant: 'destructive',
          });
          setConfirming(false);
          return;
        }

        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 共 ' + finalMaterials.length + ' 条资料待整理']);

        // 2. 将所有资料保存到 knowledge_base 表
        console.log('[handleNextStep] 开始保存资料到 knowledge_base，数量:', finalMaterials.length);
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在保存资料到知识库...']);
        
        const existingKnowledge = await getKnowledgeBase(projectId);
        const existingUrls = new Set(existingKnowledge.map(k => k.source_url).filter(Boolean));
        
        let savedCount = 0;
        for (const material of finalMaterials) {
          // 处理 RetrievedMaterial 和 KnowledgeBase 类型
          const isRetrievedMaterial = 'url' in material;
          const materialUrl = isRetrievedMaterial ? material.url : (material as any).source_url;
          const materialSourceType = isRetrievedMaterial ? material.source_type : (material as any).source;
          const materialAbstract = isRetrievedMaterial ? material.abstract : '';
          const materialYear = isRetrievedMaterial ? material.year : null;
          const materialContent = isRetrievedMaterial ? '' : (material as any).content;
          
          if (materialUrl && existingUrls.has(materialUrl)) {
            console.log('[handleNextStep] 资料已存在，跳过:', material.title);
            continue;
          }
          
          try {
            let publishedAt = material.published_at;
            if (!publishedAt && materialYear) {
              publishedAt = `${materialYear}-01-01T00:00:00Z`;
            }
            
            await createKnowledgeBase({
              project_id: projectId,
              title: material.title,
              content: materialAbstract || material.full_text || materialContent || '',
              source: materialSourceType,
              source_url: materialUrl,
              published_at: publishedAt,
              collected_at: material.created_at,
              selected: true,
              content_status: material.full_text ? 'full_text' : materialAbstract ? 'abstract_only' : 'insufficient_content',
              extracted_content: material.full_text ? [material.full_text] : [],
              full_text: material.full_text,
            });
            savedCount++;
          } catch (error: any) {
            console.error('[handleNextStep] 保存资料失败:', material.title, error);
            setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 保存资料失败: ' + material.title]);
          }
        }
        
        console.log('[handleNextStep] 资料保存完成，新增:', savedCount, '条，开始调用研究综合 Agent');
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 资料保存完成，新增 ' + savedCount + ' 条']);

        // 3. 调用研究综合 Agent
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 🤖 启动 Research Synthesis Agent...']);
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在分析资料并生成研究洞察...']);
        
        const result: SynthesisResult = await callResearchSynthesisAgent(projectId, writingSession.id);
        
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ Research Synthesis Agent 完成']);
        
        // 4. 获取保存的洞察和空白
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在加载研究洞察和空白...']);
        const insights = await getResearchInsights(writingSession.id);
        const gaps = await getResearchGaps(writingSession.id);
        
        setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 已生成 ' + insights.length + ' 条研究洞察，' + gaps.length + ' 条研究空白']);
        
        console.log('[handleNextStep] 研究综合完成，insights:', insights.length, 'gaps:', gaps.length);
      }
      
      // 更新项目状态到资料整理阶段
      console.log('[handleNextStep] 更新项目状态到 material_review');
      await updateProject(projectId, { 
        status: 'material_review'
      });
      
      toast({
        title: '已进入资料整理阶段',
        description: '请审阅研究资料并做出决策',
      });
      
      onComplete();
    } catch (error: any) {
      console.error('[handleNextStep] 进入下一阶段失败:', error);
      
      // 记录错误日志
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ❌ 操作失败: ' + error.message]);
      
      let errorMessage = '请稍后重试';
      let errorTitle = '操作失败';
      
      if (error.message) {
        errorMessage = error.message;
        
        if (error.message.includes('Api key is invalid') || error.message.includes('API 密钥')) {
          errorTitle = '⚠️ API 密钥配置问题';
          errorMessage = 'LLM API 密钥未配置或无效。请按以下步骤配置：\n\n1. 访问 https://cloud.siliconflow.cn 获取 API Key\n2. 在 Supabase 项目的 Edge Functions Secrets 中添加 QIANWEN_API_KEY\n3. 重新部署 Edge Function';
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 10000,
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleToggleSelect = async (id: string, selected: boolean) => {
    console.log('[handleToggleSelect] 开始更新选中状态:', { id, selected });
    try {
      // 同时更新 retrieved_materials 表
      // 注意：knowledge 中的 id 对应 retrieved_materials 中的 id
      console.log('[handleToggleSelect] 更新 retrieved_materials 表');
      await updateRetrievedMaterialSelection(id, selected);
      console.log('[handleToggleSelect] retrieved_materials 表更新成功');
      
      // 更新本地状态
      setRetrievedMaterials(prev => {
        const updated = prev.map(m => m.id === id ? { ...m, is_selected: selected } : m);
        console.log('[handleToggleSelect] 本地状态已更新，选中数量:', updated.filter(m => m.is_selected).length);
        return updated;
      });
      
      // 尝试更新 knowledge_base 表（如果存在）
      try {
        await updateKnowledgeBase(id, { selected });
        console.log('[handleToggleSelect] knowledge_base 表更新成功');
      } catch (kbError) {
        // knowledge_base 中可能还不存在该记录，忽略错误
        console.log('[handleToggleSelect] knowledge_base 更新跳过（记录可能不存在）:', id);
      }
      
      await loadKnowledge();
      console.log('[handleToggleSelect] 完成');
    } catch (error) {
      console.error('[handleToggleSelect] 更新选中状态失败:', error);
      toast({
        title: '更新失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
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
    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // 批量更新 retrieved_materials 表
      await batchUpdateRetrievedMaterialSelection(writingSession.id, ids, selected);
      
      // 更新本地状态
      setRetrievedMaterials(prev => 
        prev.map(m => ids.includes(m.id) ? { ...m, is_selected: selected } : m)
      );
      
      // 尝试更新 knowledge_base 表（如果存在）
      for (const id of ids) {
        try {
          await updateKnowledgeBase(id, { selected });
        } catch (kbError) {
          // knowledge_base 中可能还不存在该记录，忽略错误
          console.log('[handleBatchFavorite] knowledge_base 更新跳过（记录可能不存在）:', id);
        }
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
    // 清除缓存
    clearSearchCache(projectId);
    
    setRetrievedMaterials([]);
    setAutoSearched(false); // 重置自动搜索标记
    
    // 触发重新搜索
    if (query.trim()) {
      handleSearch();
    } else {
      // 如果没有查询词，尝试从需求文档自动搜索
      autoSearchFromBrief();
    }
  };

  // 资料整理 - 调用研究综合 Agent
  const handleOrganize = async () => {
    console.log('[handleOrganize] 开始资料整理');
    console.log('[handleOrganize] writingSession:', writingSession);
    console.log('[handleOrganize] knowledge.length:', knowledge.length);
    console.log('[handleOrganize] retrievedMaterials.length:', retrievedMaterials.length);
    
    if (!writingSession) {
      toast({
        title: '会话未初始化',
        description: '请刷新页面重试',
        variant: 'destructive',
      });
      return;
    }

    if (retrievedMaterials.length === 0) {
      toast({
        title: '暂无资料',
        description: '请先进行资料搜索',
        variant: 'destructive',
      });
      return;
    }

    setSynthesizing(true);
    setSynthesisLogs([]); // 清空旧日志
    
    try {
      // 添加初始日志
      setSynthesisLogs(['[' + new Date().toLocaleTimeString('zh-CN') + '] 开始资料整理...']);
      
      // 1. 获取所有检索到的资料（不再只获取选中的资料）
      console.log('[handleOrganize] 调用 getRetrievedMaterials，sessionId:', writingSession.id);
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在获取检索到的资料...']);
      const allMaterials = await getRetrievedMaterials(writingSession.id);
      console.log('[handleOrganize] getRetrievedMaterials 返回结果:', allMaterials);
      console.log('[handleOrganize] 资料总数:', allMaterials.length);
      
      if (allMaterials.length === 0) {
        console.error('[handleOrganize] 没有可用的资料');
        toast({
          title: '暂无资料',
          description: '请先进行资料搜索',
          variant: 'destructive',
        });
        setSynthesizing(false);
        return;
      }

      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 共 ' + allMaterials.length + ' 条资料待整理']);

      // 2. 将所有资料保存到 knowledge_base 表（检查是否已存在）
      console.log('[handleOrganize] 开始保存资料到 knowledge_base，数量:', allMaterials.length);
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在保存资料到知识库...']);
      
      // 先获取已存在的资料
      const existingKnowledge = await getKnowledgeBase(projectId);
      const existingUrls = new Set(existingKnowledge.map(k => k.source_url).filter(Boolean));
      
      let savedCount = 0;
      for (const material of allMaterials) {
        // 跳过已存在的资料（通过 URL 判断）
        if (material.url && existingUrls.has(material.url)) {
          console.log('[handleOrganize] 资料已存在，跳过:', material.title);
          continue;
        }
        
        try {
          // 处理 published_at：如果只有 year，转换为该年的1月1日
          let publishedAt = material.published_at;
          if (!publishedAt && material.year) {
            // 将年份转换为 ISO 时间戳（该年的1月1日）
            publishedAt = `${material.year}-01-01T00:00:00Z`;
          }
          
          await createKnowledgeBase({
            project_id: projectId,
            title: material.title,
            content: material.abstract || material.full_text || '',
            source: material.source_type,
            source_url: material.url,
            published_at: publishedAt,
            collected_at: material.created_at,
            selected: true,
            content_status: material.full_text ? 'full_text' : material.abstract ? 'abstract_only' : 'insufficient_content',
            extracted_content: material.full_text ? [material.full_text] : [],
            full_text: material.full_text,
          });
          savedCount++;
        } catch (error: any) {
          console.error('[handleOrganize] 保存资料失败:', material.title, error);
          setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 保存资料失败: ' + material.title]);
          // 继续保存其他资料
        }
      }
      
      console.log('[handleOrganize] 资料保存完成，新增:', savedCount, '条，开始调用研究综合 Agent');
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 资料保存完成，新增 ' + savedCount + ' 条']);

      // 3. 调用研究综合 Agent
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 🤖 启动 Research Synthesis Agent...']);
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在分析资料并生成研究洞察...']);
      
      const result: SynthesisResult = await callResearchSynthesisAgent(projectId, writingSession.id);
      
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ Research Synthesis Agent 完成']);
      
      // 4. 获取保存的洞察和空白
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在加载研究洞察和空白...']);
      const insights = await getResearchInsights(writingSession.id);
      const gaps = await getResearchGaps(writingSession.id);
      
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 已生成 ' + insights.length + ' 条研究洞察，' + gaps.length + ' 条研究空白']);
      
      // 5. 设置审阅数据
      setSynthesisReviewData({
        insights,
        gaps,
        thought: result.thought,
      });
      
      // 6. 显示审阅界面
      setShowSynthesisReview(true);
      
      toast({
        title: '资料整理完成',
        description: `已生成 ${insights.length} 条研究洞察，请审阅并做出决策`,
      });
    } catch (error: any) {
      console.error('资料整理失败:', error);
      
      // 记录错误日志
      setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ❌ 资料整理失败: ' + error.message]);
      
      // 提供更详细的错误信息
      let errorMessage = '请稍后重试';
      let errorTitle = '资料整理失败';
      
      if (error.message) {
        errorMessage = error.message;
        
        // 检测 API 密钥相关错误
        if (error.message.includes('Api key is invalid') || error.message.includes('API 密钥')) {
          errorTitle = '⚠️ API 密钥配置问题';
          errorMessage = 'LLM API 密钥未配置或无效。请按以下步骤配置：\n\n1. 访问 https://cloud.siliconflow.cn 获取 API Key\n2. 在 Supabase 项目的 Edge Functions Secrets 中添加 QIANWEN_API_KEY\n3. 重新部署 Edge Function\n\n详细说明请查看项目根目录的 API_KEY_SETUP.md 文件';
        }
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 10000, // API 密钥错误需要更长的显示时间
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
                    <></>
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

      {/* 底部操作按钮 */}
      {knowledge.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {retrievedMaterials.length > 0 ? (
                  <span>
                    已检索到 {retrievedMaterials.length} 条资料，点击"进入下一阶段"开始整理
                  </span>
                ) : (
                  <span>
                    已加载 {knowledge.length} 条资料，点击"进入下一阶段"开始整理
                  </span>
                )}
              </div>
              <div className="flex gap-4">
                <Button 
                  onClick={handleNextStep}
                  className="min-w-[140px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  disabled={confirming || (retrievedMaterials.length === 0 && knowledge.length === 0)}
                >
                  {confirming ? '处理中...' : '进入下一阶段'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索分析 - 固定底部日志栏 */}
      {searchLogs.length > 0 && !synthesizing && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-black text-white border-t border-gray-800 shadow-lg z-50 cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => {
            setLogDialogType('search');
            setShowLogsDialog(true);
          }}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${searching ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium text-gray-300">资料搜索日志</span>
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

      {/* 资料整理日志 - 固定底部日志栏 */}
      {synthesisLogs.length > 0 && synthesizing && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-purple-900 text-white border-t border-purple-700 shadow-lg z-50 cursor-pointer hover:bg-purple-800 transition-colors"
          onClick={() => {
            setLogDialogType('synthesis');
            setShowLogsDialog(true);
          }}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${synthesizing ? 'bg-purple-300 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium text-purple-200">资料整理日志</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-purple-700" />
                <span className="text-sm text-purple-300">
                  {(() => {
                    const latestLog = synthesisLogs[synthesisLogs.length - 1] || '';
                    const timeMatch = latestLog.match(/\[(\d{2}:\d{2}:\d{2})\]/);
                    return timeMatch ? timeMatch[1] : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  })()}
                </span>
                <span className="text-sm text-white">
                  {(() => {
                    const latestLog = synthesisLogs[synthesisLogs.length - 1] || '';
                    // 移除时间戳部分，只显示消息内容
                    const message = latestLog.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                    return message.substring(0, 80) || '正在整理资料...';
                  })()}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-white hover:bg-purple-700">
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
        onUpdateInsightDecision={async (insightId, decision) => {
          try {
            await updateInsightDecision(insightId, decision);
            toast({
              title: '已更新决策',
              description: `洞察决策已更新为：${decision === 'adopt' ? '采用' : decision === 'downgrade' ? '降级使用' : '排除'}`,
            });
          } catch (error) {
            console.error('更新洞察决策失败:', error);
            toast({
              title: '更新失败',
              description: '无法更新洞察决策',
              variant: 'destructive',
            });
          }
        }}
        onUpdateGapDecision={async (gapId, decision) => {
          try {
            await updateGapDecision(gapId, decision);
            toast({
              title: '已更新决策',
              description: `空白决策已更新为：${decision === 'respond' ? '需要处理' : '忽略'}`,
            });
          } catch (error) {
            console.error('更新空白决策失败:', error);
            toast({
              title: '更新失败',
              description: '无法更新空白决策',
              variant: 'destructive',
            });
          }
        }}
        onBatchAcceptAll={async () => {
          try {
            if (writingSession) {
              const insights = await getResearchInsights(writingSession.id);
              const gaps = await getResearchGaps(writingSession.id);
              
              await Promise.all([
                ...insights.map(insight => updateInsightDecision(insight.id, 'adopt')),
                ...gaps.map(gap => updateGapDecision(gap.id, 'respond')),
              ]);
              
              toast({
                title: '批量操作成功',
                description: '已将所有洞察设为采用，所有空白设为需要处理',
              });
            }
          } catch (error) {
            console.error('批量操作失败:', error);
            toast({
              title: '批量操作失败',
              description: '无法完成批量操作',
              variant: 'destructive',
            });
          }
        }}
      />

      {/* 搜索日志弹窗 */}
      <SearchLogsDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        projectTitle={projectTitle}
        logs={logDialogType === 'synthesis' ? synthesisLogs : searchLogs}
        logType={logDialogType}
      />
        </>
      )}
    </div>
  );
}
