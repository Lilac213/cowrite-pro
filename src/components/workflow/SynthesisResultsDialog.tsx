import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lightbulb, TrendingUp, AlertTriangle, Brain, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ResearchInsight, ResearchGap, UserDecision } from '@/types';

interface SynthesisResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  synthesisResults: {
    thought?: string;
    synthesis?: {
      synthesized_insights: Array<{
        id: string;
        category: string;
        insight: string;
        supporting_data: string[];
        source_type: string;
        recommended_usage: 'direct' | 'background' | 'optional';
        citability: 'direct' | 'background' | 'controversial';
        limitations: string;
        user_decision: string;
      }>;
      contradictions_or_gaps: Array<{
        id: string;
        issue: string;
        description: string;
        user_decision: string;
      }>;
    };
    // 兼容旧格式
    synthesized_insights?: any[];
    key_data_points?: any[];
    contradictions_or_gaps?: any[];
  } | null;
  onUpdateInsightDecision?: (insightId: string, decision: UserDecision) => void;
  onUpdateGapDecision?: (gapId: string, decision: 'respond' | 'ignore') => void;
  onBatchAcceptAll?: () => void;
}

export default function SynthesisResultsDialog({ 
  open, 
  onOpenChange, 
  synthesisResults,
  onUpdateInsightDecision,
  onUpdateGapDecision,
  onBatchAcceptAll,
}: SynthesisResultsDialogProps) {
  const [localInsights, setLocalInsights] = useState<any[]>([]);
  const [localGaps, setLocalGaps] = useState<any[]>([]);

  useEffect(() => {
    if (synthesisResults?.synthesis) {
      setLocalInsights(synthesisResults.synthesis.synthesized_insights || []);
      setLocalGaps(synthesisResults.synthesis.contradictions_or_gaps || []);
    } else if (synthesisResults) {
      // 兼容旧格式
      setLocalInsights(synthesisResults.synthesized_insights || []);
      setLocalGaps(synthesisResults.contradictions_or_gaps || []);
    }
  }, [synthesisResults]);

  if (!synthesisResults) return null;

  const hasNewFormat = synthesisResults.synthesis !== undefined;
  const thought = synthesisResults.thought;

  const handleInsightDecision = (insightId: string, decision: UserDecision) => {
    setLocalInsights(prev => 
      prev.map(insight => 
        insight.id === insightId ? { ...insight, user_decision: decision } : insight
      )
    );
    onUpdateInsightDecision?.(insightId, decision);
  };

  const handleGapDecision = (gapId: string, decision: 'respond' | 'ignore') => {
    setLocalGaps(prev => 
      prev.map(gap => 
        gap.id === gapId ? { ...gap, user_decision: decision } : gap
      )
    );
    onUpdateGapDecision?.(gapId, decision);
  };

  const handleBatchAcceptAll = () => {
    setLocalInsights(prev => 
      prev.map(insight => ({ ...insight, user_decision: 'adopt' }))
    );
    setLocalGaps(prev => 
      prev.map(gap => ({ ...gap, user_decision: 'respond' }))
    );
    onBatchAcceptAll?.();
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'adopt':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'reject':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'downgrade':
        return <MinusCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getUsageBadgeColor = (usage: string) => {
    switch (usage) {
      case 'direct':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'background':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'optional':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCitabilityBadgeColor = (citability: string) => {
    switch (citability) {
      case 'direct':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'background':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'controversial':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 解析 JSON 内容的辅助函数（兼容旧格式）
  const parseContent = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return item.insight || item.data_point || item.point || item.text || 
             item.description || item.gap || item.contradiction || JSON.stringify(item);
    }
    return String(item);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl">资料整理结果</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6">
            {/* THOUGHT 部分 */}
            {thought && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-bold">分析思路</h3>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border-l-4 border-purple-500">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {thought}
                  </p>
                </div>
              </div>
            )}

            {thought && <Separator />}

            {/* 批量操作按钮 */}
            {hasNewFormat && localInsights.length > 0 && (
              <div className="flex justify-end">
                <Button 
                  onClick={handleBatchAcceptAll}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  全部采用
                </Button>
              </div>
            )}

            {/* 综合洞察（新格式） */}
            {hasNewFormat && localInsights.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold">研究洞察</h3>
                  <Badge variant="secondary">{localInsights.length} 条</Badge>
                </div>
                <div className="space-y-4">
                  {localInsights.map((insight: any) => (
                    <div 
                      key={insight.id} 
                      className={`p-4 rounded-lg border-2 transition-all ${
                        insight.user_decision === 'adopt' 
                          ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                          : insight.user_decision === 'reject'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950 opacity-60'
                          : insight.user_decision === 'downgrade'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {/* 分类和标签 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-semibold">
                            {insight.category}
                          </Badge>
                          <Badge className={getUsageBadgeColor(insight.recommended_usage)}>
                            {insight.recommended_usage === 'direct' ? '直接使用' : 
                             insight.recommended_usage === 'background' ? '背景参考' : '可选'}
                          </Badge>
                          <Badge className={getCitabilityBadgeColor(insight.citability)}>
                            {insight.citability === 'direct' ? '可直接引用' : 
                             insight.citability === 'background' ? '背景引用' : '存在争议'}
                          </Badge>
                          <Badge variant="secondary">
                            {insight.source_type === 'academic' ? '学术' : 
                             insight.source_type === 'news' ? '新闻' : '网络'}
                          </Badge>
                        </div>
                        {getDecisionIcon(insight.user_decision)}
                      </div>

                      {/* 核心洞察 */}
                      <p className="text-sm leading-relaxed mb-3 font-medium">
                        {insight.insight}
                      </p>

                      {/* 支撑数据 */}
                      {insight.supporting_data && insight.supporting_data.length > 0 && (
                        <div className="mb-3 space-y-1">
                          <p className="text-xs text-muted-foreground font-semibold">支撑数据：</p>
                          <ul className="list-disc list-inside space-y-1">
                            {insight.supporting_data.map((data: string, idx: number) => (
                              <li key={idx} className="text-xs text-muted-foreground">
                                {data}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 局限性 */}
                      {insight.limitations && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold">局限性：</span>{insight.limitations}
                          </p>
                        </div>
                      )}

                      {/* 用户决策按钮 */}
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant={insight.user_decision === 'adopt' ? 'default' : 'outline'}
                          onClick={() => handleInsightDecision(insight.id, 'adopt')}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          采用
                        </Button>
                        <Button
                          size="sm"
                          variant={insight.user_decision === 'downgrade' ? 'default' : 'outline'}
                          onClick={() => handleInsightDecision(insight.id, 'downgrade')}
                        >
                          <MinusCircle className="w-3 h-3 mr-1" />
                          降级使用
                        </Button>
                        <Button
                          size="sm"
                          variant={insight.user_decision === 'reject' ? 'destructive' : 'outline'}
                          onClick={() => handleInsightDecision(insight.id, 'reject')}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          排除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasNewFormat && localInsights.length > 0 && localGaps.length > 0 && <Separator />}

            {/* 矛盾或研究空白（新格式） */}
            {hasNewFormat && localGaps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold">矛盾或研究空白</h3>
                  <Badge variant="secondary">{localGaps.length} 条</Badge>
                </div>
                <div className="space-y-4">
                  {localGaps.map((gap: any) => (
                    <div 
                      key={gap.id} 
                      className={`p-4 rounded-lg border-2 transition-all ${
                        gap.user_decision === 'respond' 
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' 
                          : gap.user_decision === 'ignore'
                          ? 'border-gray-300 bg-gray-50 dark:bg-gray-900 opacity-60'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">{gap.issue}</p>
                        {gap.user_decision === 'respond' && <CheckCircle2 className="w-4 h-4 text-yellow-500" />}
                        {gap.user_decision === 'ignore' && <XCircle className="w-4 h-4 text-gray-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {gap.description}
                      </p>
                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          size="sm"
                          variant={gap.user_decision === 'respond' ? 'default' : 'outline'}
                          onClick={() => handleGapDecision(gap.id, 'respond')}
                        >
                          需要处理
                        </Button>
                        <Button
                          size="sm"
                          variant={gap.user_decision === 'ignore' ? 'secondary' : 'outline'}
                          onClick={() => handleGapDecision(gap.id, 'ignore')}
                        >
                          忽略
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 兼容旧格式的显示 */}
            {!hasNewFormat && (
              <>
                {/* 综合洞察（旧格式） */}
                {synthesisResults.synthesized_insights && synthesisResults.synthesized_insights.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-bold">综合洞察</h3>
                    </div>
                    <div className="space-y-3">
                      {synthesisResults.synthesized_insights.map((insight: any, idx: number) => {
                        const content = parseContent(insight);
                        return (
                          <div 
                            key={idx} 
                            className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-l-4 border-blue-500"
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {synthesisResults.synthesized_insights && synthesisResults.synthesized_insights.length > 0 && <Separator />}

                {/* 关键数据点（旧格式） */}
                {synthesisResults.key_data_points && synthesisResults.key_data_points.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-bold">关键数据点</h3>
                    </div>
                    <div className="space-y-3">
                      {synthesisResults.key_data_points.map((point: any, idx: number) => {
                        if (point && typeof point === 'object' && (point.data || point.context || point.source)) {
                          const context = point.context || '';
                          const data = point.data || point.data_point || '';
                          const source = point.source || '';
                          
                          return (
                            <div 
                              key={idx} 
                              className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-l-4 border-green-500 space-y-2"
                            >
                              {context && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                                  {context}
                                </p>
                              )}
                              {data && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-bold">
                                  {data}
                                </p>
                              )}
                              {source && (
                                <p className="text-xs text-muted-foreground">
                                  来源：{source}
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        const content = parseContent(point);
                        const formattedContent = content.replace(
                          /(\d+(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?[MBK]?)/g,
                          '<strong>$1</strong>'
                        );
                        
                        return (
                          <div 
                            key={idx} 
                            className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-l-4 border-green-500"
                          >
                            <p 
                              className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                              dangerouslySetInnerHTML={{ __html: formattedContent }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {synthesisResults.key_data_points && synthesisResults.key_data_points.length > 0 && <Separator />}

                {/* 矛盾或研究空白（旧格式） */}
                {synthesisResults.contradictions_or_gaps && synthesisResults.contradictions_or_gaps.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <h3 className="text-lg font-bold">矛盾或研究空白</h3>
                    </div>
                    <div className="space-y-3">
                      {synthesisResults.contradictions_or_gaps.map((item: any, idx: number) => {
                        const content = parseContent(item);
                        const formattedContent = content.replace(
                          /(矛盾|空白|缺乏|不足|问题|挑战|争议)/g,
                          '<strong>$1</strong>'
                        );
                        
                        return (
                          <div 
                            key={idx} 
                            className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border-l-4 border-yellow-500"
                          >
                            <p 
                              className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                              dangerouslySetInnerHTML={{ __html: formattedContent }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 如果没有任何内容 */}
            {!hasNewFormat && 
             (!synthesisResults.synthesized_insights || synthesisResults.synthesized_insights.length === 0) && 
             (!synthesisResults.key_data_points || synthesisResults.key_data_points.length === 0) &&
             (!synthesisResults.contradictions_or_gaps || synthesisResults.contradictions_or_gaps.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无整理结果</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
