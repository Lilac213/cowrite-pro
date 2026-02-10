import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  getResearchInsights, 
  getResearchGaps, 
  updateInsightDecision,
  updateGapDecision,
  callArticleStructureAgent,
  updateWritingSessionStage,
  updateProject,
  getWritingSession
} from '@/db/api';
import type { ResearchInsight, ResearchGap } from '@/types';
import { CheckCircle2, Circle, ChevronRight, FileText, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaterialReviewStageProps {
  projectId: string;
  onComplete: () => void;
}

interface MaterialItem {
  id: string;
  type: 'insight' | 'gap';
  category: string;
  content: string;
  decision: 'adopt' | 'downgrade' | 'reject' | 'respond' | 'ignore' | 'pending';
  data: ResearchInsight | ResearchGap;
}

export default function MaterialReviewStage({ projectId, onComplete }: MaterialReviewStageProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string>('');
  const [synthesisLog, setSynthesisLog] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const { toast } = useToast();

  // 分类统计（包含未决策数量）
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; pending: number }> = {};
    materials.forEach(item => {
      if (item.type === 'insight') {
        if (!stats[item.category]) {
          stats[item.category] = { total: 0, pending: 0 };
        }
        stats[item.category].total += 1;
        if (item.decision === 'pending') {
          stats[item.category].pending += 1;
        }
      }
    });
    return stats;
  }, [materials]);

  // 未决策数量
  const pendingCount = useMemo(() => {
    return materials.filter(m => m.decision === 'pending').length;
  }, [materials]);

  // 已决策数量
  const decidedCount = useMemo(() => {
    return materials.filter(m => m.decision !== 'pending').length;
  }, [materials]);

  // 过滤后的资料列表
  const filteredMaterials = useMemo(() => {
    if (!selectedCategory) return materials;
    return materials.filter(m => m.category === selectedCategory);
  }, [materials, selectedCategory]);

  useEffect(() => {
    loadMaterials();
  }, [projectId]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      
      console.log('[MaterialReviewStage] 开始加载资料，projectId:', projectId);
      
      // 获取 writing session
      const session = await getWritingSession(projectId);
      console.log('[MaterialReviewStage] getWritingSession 返回:', session);
      
      if (!session) {
        console.error('[MaterialReviewStage] 会话未找到');
        toast({
          title: '会话未找到',
          description: '请先完成资料查询阶段',
          variant: 'destructive',
        });
        return;
      }
      
      if (!session.id) {
        console.error('[MaterialReviewStage] session.id 为空');
        toast({
          title: '会话ID无效',
          description: '请刷新页面重试',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('[MaterialReviewStage] session.id:', session.id);
      setSessionId(session.id);
      
      // 获取研究洞察和空白
      console.log('[MaterialReviewStage] 开始获取 insights 和 gaps');
      const [insights, gaps] = await Promise.all([
        getResearchInsights(session.id),
        getResearchGaps(session.id)
      ]);
      
      console.log('[MaterialReviewStage] insights:', insights.length, 'gaps:', gaps.length);

      // 转换为统一格式
      const insightItems: MaterialItem[] = insights.map(insight => ({
        id: insight.id,
        type: 'insight',
        category: insight.category,
        content: insight.insight,
        decision: insight.user_decision,
        data: insight
      }));

      const gapItems: MaterialItem[] = gaps.map(gap => ({
        id: gap.id,
        type: 'gap',
        category: '矛盾与空白',
        content: gap.issue,
        decision: gap.user_decision,
        data: gap
      }));

      console.log('[MaterialReviewStage] 转换后的资料数量:', insightItems.length + gapItems.length);
      setMaterials([...insightItems, ...gapItems]);
      
      // 尝试从 session 中恢复日志（从 synthesis_result 字段）
      if (session.synthesis_result) {
        try {
          const result = typeof session.synthesis_result === 'string' 
            ? JSON.parse(session.synthesis_result) 
            : session.synthesis_result;
          setSynthesisLog(result);
          console.log('[MaterialReviewStage] synthesis_result 已恢复');
        } catch (e) {
          console.error('[MaterialReviewStage] 解析 synthesis_result 失败:', e);
        }
      }
      
      console.log('[MaterialReviewStage] 资料加载完成');
    } catch (error: any) {
      console.error('[MaterialReviewStage] 加载资料失败:', error);
      console.error('[MaterialReviewStage] 错误详情:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      toast({
        title: '加载失败',
        description: error.message || '无法加载研究资料',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 批量选择
  const handleSelectAll = () => {
    if (selectedIds.size === materials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(materials.map(m => m.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 批量设置决策
  const handleBatchDecision = async (decision: 'adopt' | 'downgrade' | 'reject') => {
    if (selectedIds.size === 0) {
      toast({
        title: '请先选择资料',
        description: '请勾选要批量处理的资料项',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      
      const selectedMaterials = materials.filter(m => selectedIds.has(m.id));
      
      // 批量更新
      await Promise.all(
        selectedMaterials.map(material => {
          if (material.type === 'insight') {
            return updateInsightDecision(material.id, decision);
          } else {
            // gaps 使用 respond/ignore
            const gapDecision = decision === 'adopt' ? 'respond' : 'ignore';
            return updateGapDecision(material.id, gapDecision);
          }
        })
      );

      // 更新本地状态
      setMaterials(prev => prev.map(m => {
        if (selectedIds.has(m.id)) {
          if (m.type === 'insight') {
            return { ...m, decision };
          } else {
            const gapDecision = decision === 'adopt' ? 'respond' : 'ignore';
            return { ...m, decision: gapDecision };
          }
        }
        return m;
      }));

      setSelectedIds(new Set());

      toast({
        title: '批量设置成功',
        description: `已将 ${selectedIds.size} 项资料设置为${getDecisionLabel(decision)}`,
      });
    } catch (error: any) {
      console.error('批量设置失败:', error);
      toast({
        title: '设置失败',
        description: error.message || '批量设置决策失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // 单个设置决策
  const handleSingleDecision = async (materialId: string, decision: 'adopt' | 'downgrade' | 'reject') => {
    try {
      const material = materials.find(m => m.id === materialId);
      if (!material) return;

      if (material.type === 'insight') {
        await updateInsightDecision(materialId, decision);
      } else {
        const gapDecision = decision === 'adopt' ? 'respond' : 'ignore';
        await updateGapDecision(materialId, gapDecision);
      }

      // 更新本地状态
      setMaterials(prev => prev.map(m => {
        if (m.id === materialId) {
          if (m.type === 'insight') {
            return { ...m, decision };
          } else {
            const gapDecision = decision === 'adopt' ? 'respond' : 'ignore';
            return { ...m, decision: gapDecision };
          }
        }
        return m;
      }));
    } catch (error: any) {
      console.error('设置决策失败:', error);
      toast({
        title: '设置失败',
        description: error.message || '设置决策失败',
        variant: 'destructive',
      });
    }
  };

  // 跳转到未决策项
  const scrollToFirstPending = () => {
    const firstPending = materials.find(m => m.decision === 'pending');
    if (firstPending) {
      const element = document.getElementById(`material-${firstPending.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 进入下一阶段
  const handleNextStage = async () => {
    if (pendingCount > 0) {
      toast({
        title: '还有未决策的资料',
        description: `还有 ${pendingCount} 项资料未决策，请完成所有决策后再进入下一阶段`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      toast({
        title: '正在生成文章结构',
        description: '基于您确认的研究洞察生成论证结构...',
      });

      // 调用文章结构生成
      await callArticleStructureAgent(sessionId, projectId);

      // 更新会话阶段
      await updateWritingSessionStage(sessionId, 'structure');

      // 更新项目状态
      await updateProject(projectId, {
        status: 'outline_confirmed'
      });

      toast({
        title: '已进入下一阶段',
        description: '文章结构已生成，开始结构设计',
      });

      onComplete();
    } catch (error: any) {
      console.error('进入下一阶段失败:', error);
      toast({
        title: '操作失败',
        description: error.message || '无法生成文章结构',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getDecisionLabel = (decision: string) => {
    switch (decision) {
      case 'adopt': return '必须使用';
      case 'downgrade': return '背景补充';
      case 'reject': return '排除';
      case 'respond': return '必须使用';
      case 'ignore': return '排除';
      default: return '待决策';
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'adopt':
      case 'respond':
        return 'text-green-600 bg-green-50';
      case 'downgrade':
        return 'text-blue-600 bg-blue-50';
      case 'reject':
      case 'ignore':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-orange-600 bg-orange-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载资料中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>资料整理</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                审阅研究资料，决定每项资料的使用方式
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">已决策：</span>
                <span className="font-semibold text-green-600">{decidedCount}</span>
                <span className="text-muted-foreground mx-2">/</span>
                <span className="font-semibold">{materials.length}</span>
              </div>
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToFirstPending}
                  className="text-orange-600"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  还有 {pendingCount} 项未决策
                </Button>
              )}
              <Button
                onClick={handleNextStage}
                disabled={saving || pendingCount > 0}
              >
                {saving ? '处理中...' : '进入下一阶段'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 主内容区 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：分类和指南 */}
        <div className="col-span-3 space-y-4">
          {/* 资料类型统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">资料类型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div 
                className={cn(
                  "flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-colors hover:bg-accent",
                  !selectedCategory && "bg-accent"
                )}
                onClick={() => setSelectedCategory(null)}
              >
                <span className="text-sm font-medium">全部</span>
                <Badge variant="secondary">{materials.length} 条</Badge>
              </div>
              {Object.entries(categoryStats).map(([category, stats]) => (
                <div 
                  key={category} 
                  className={cn(
                    "flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-colors hover:bg-accent",
                    selectedCategory === category && "bg-accent"
                  )}
                  onClick={() => setSelectedCategory(category)}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{category}</span>
                    {stats.pending > 0 && (
                      <span className="text-xs text-orange-600">
                        还剩 {stats.pending} 条未决策
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary">{stats.total} 条</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 审阅指南 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">审阅指南</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-green-600">必须使用</div>
                  <div className="text-muted-foreground">核心观点，将直接用于文章论证</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Circle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-blue-600">背景补充</div>
                  <div className="text-muted-foreground">辅助信息，可作为背景或补充说明</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Circle className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-gray-600">排除</div>
                  <div className="text-muted-foreground">不相关或不适用的内容</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：资料列表 */}
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">资料内容</CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size === materials.length && materials.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">全选</span>
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground ml-4">
                        已选 {selectedIds.size} 项
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBatchDecision('adopt')}
                        disabled={saving}
                      >
                        批量设为必须使用
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBatchDecision('downgrade')}
                        disabled={saving}
                      >
                        批量设为背景补充
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBatchDecision('reject')}
                        disabled={saving}
                      >
                        批量排除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredMaterials.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <p>该分类下暂无资料</p>
                    </div>
                  ) : (
                    filteredMaterials.map((material) => (
                    <div
                      key={material.id}
                      id={`material-${material.id}`}
                      className={cn(
                        "border rounded-lg p-4 transition-all",
                        material.decision === 'pending' && "border-orange-300 bg-orange-50/50",
                        selectedIds.has(material.id) && "ring-2 ring-primary"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.has(material.id)}
                          onCheckedChange={() => handleToggleSelect(material.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{material.category}</Badge>
                                <Badge className={getDecisionColor(material.decision)}>
                                  {getDecisionLabel(material.decision)}
                                </Badge>
                              </div>
                              <p className="text-sm leading-relaxed">{material.content}</p>
                            </div>
                          </div>
                          <RadioGroup
                            value={material.decision === 'respond' ? 'adopt' : material.decision === 'ignore' ? 'reject' : material.decision}
                            onValueChange={(value) => handleSingleDecision(material.id, value as any)}
                            className="flex items-center gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="adopt" id={`${material.id}-adopt`} />
                              <Label htmlFor={`${material.id}-adopt`} className="text-sm cursor-pointer">
                                必须使用
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="downgrade" id={`${material.id}-downgrade`} />
                              <Label htmlFor={`${material.id}-downgrade`} className="text-sm cursor-pointer">
                                背景补充
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="reject" id={`${material.id}-reject`} />
                              <Label htmlFor={`${material.id}-reject`} className="text-sm cursor-pointer">
                                排除
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 底部固定日志栏 */}
      {synthesisLog && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-black text-white border-t border-gray-800 shadow-lg z-50 cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => setShowLogsDialog(true)}
        >
          <div className="container mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-green-600 text-white">
                LATEST LOG
              </Badge>
              <span className="text-sm">
                {new Date().toLocaleTimeString('zh-CN')} 研究综合已完成
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:text-white hover:bg-white/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              日志详情
            </Button>
          </div>
        </div>
      )}

      {/* 日志详情对话框 */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>研究综合日志</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 p-4">
              {synthesisLog ? (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">思考过程 (Thought)</h3>
                    <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                      {synthesisLog.thought || '无思考过程记录'}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">输入数据</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                      {JSON.stringify(synthesisLog.input || {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">输出结果</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                      {JSON.stringify(synthesisLog.synthesis || {}, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无日志数据</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
