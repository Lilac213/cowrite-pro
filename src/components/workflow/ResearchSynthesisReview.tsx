import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight,
  Info,
  BookOpen,
  FileText,
  Lightbulb
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ResearchInsight, ResearchGap, UserDecision } from '@/types';

interface ResearchSynthesisReviewProps {
  sessionId: string;
  insights: ResearchInsight[];
  gaps: ResearchGap[];
  thought: string;
  onDecisionsComplete: () => void;
  onCancel: () => void;
}

export default function ResearchSynthesisReview({
  sessionId,
  insights,
  gaps,
  thought,
  onDecisionsComplete,
  onCancel,
}: ResearchSynthesisReviewProps) {
  const [localInsights, setLocalInsights] = useState<ResearchInsight[]>(insights);
  const [localGaps, setLocalGaps] = useState<ResearchGap[]>(gaps);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLocalInsights(insights);
    setLocalGaps(gaps);
  }, [insights, gaps]);

  // 按分类分组洞察
  const groupedInsights = localInsights.reduce((acc, insight) => {
    if (!acc[insight.category]) {
      acc[insight.category] = [];
    }
    acc[insight.category].push(insight);
    return acc;
  }, {} as Record<string, ResearchInsight[]>);

  // 更新洞察决策
  const handleInsightDecisionChange = (insightId: string, decision: UserDecision) => {
    setLocalInsights(prev =>
      prev.map(insight =>
        insight.insight_id === insightId
          ? { ...insight, user_decision: decision }
          : insight
      )
    );
  };

  // 更新空白决策
  const handleGapDecisionChange = (gapId: string, decision: 'respond' | 'ignore') => {
    setLocalGaps(prev =>
      prev.map(gap =>
        gap.gap_id === gapId
          ? { ...gap, user_decision: decision }
          : gap
      )
    );
  };

  // 检查是否所有决策都已完成
  const allDecisionsComplete = () => {
    const insightsComplete = localInsights.every(i => i.user_decision !== 'pending');
    const gapsComplete = localGaps.every(g => g.user_decision !== 'pending');
    return insightsComplete && gapsComplete;
  };

  // 保存决策
  const handleSaveDecisions = async () => {
    if (!allDecisionsComplete()) {
      toast({
        title: '请完成所有决策',
        description: '请为每条洞察和矛盾点做出选择',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // 导入 API 函数
      const { batchUpdateInsightDecisions, updateGapDecision } = await import('@/db/api');

      // 批量更新洞察决策
      const insightDecisions = localInsights.map(insight => ({
        id: insight.id,
        decision: insight.user_decision,
      }));
      await batchUpdateInsightDecisions(insightDecisions);

      // 更新空白决策
      for (const gap of localGaps) {
        if (gap.user_decision !== 'pending') {
          await updateGapDecision(gap.id, gap.user_decision as 'respond' | 'ignore');
        }
      }

      toast({
        title: '决策已保存',
        description: '您的选择已保存，可以进入下一阶段',
      });

      onDecisionsComplete();
    } catch (error: any) {
      console.error('保存决策失败:', error);
      toast({
        title: '保存失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // 获取推荐使用标签颜色
  const getUsageBadgeVariant = (usage: string) => {
    switch (usage) {
      case 'direct':
        return 'default';
      case 'background':
        return 'secondary';
      case 'optional':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // 获取可引用性标签颜色
  const getCitabilityBadgeVariant = (citability: string) => {
    switch (citability) {
      case 'direct':
        return 'default';
      case 'background':
        return 'secondary';
      case 'controversial':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // 获取决策图标
  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'adopt':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'downgrade':
        return <Info className="h-4 w-4 text-blue-600" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* AI 思考过程 */}
      {thought && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI 分析思路</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{thought}</p>
          </CardContent>
        </Card>
      )}

      {/* 说明卡片 */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">请审阅以下研究洞察，并为每条做出决策：</p>
          <ul className="text-sm space-y-1 ml-4">
            <li>• <strong>必须使用</strong>：核心观点，将直接用于文章论证</li>
            <li>• <strong>背景补充</strong>：辅助信息，可作为背景或补充说明</li>
            <li>• <strong>排除</strong>：不相关或不适用的内容</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* 研究洞察 */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">研究洞察</h2>
          <Badge variant="secondary">
            {localInsights.length} 条
          </Badge>
        </div>

        {Object.entries(groupedInsights).map(([category, categoryInsights]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
              <CardDescription>
                {categoryInsights.length} 条洞察
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryInsights.map((insight, index) => (
                <div key={insight.id} className="space-y-3">
                  {index > 0 && <Separator />}
                  
                  {/* 洞察内容 */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-base leading-relaxed">{insight.insight}</p>
                      </div>
                      {getDecisionIcon(insight.user_decision)}
                    </div>

                    {/* 支持数据 */}
                    {insight.supporting_data && insight.supporting_data.length > 0 && (
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">支持数据：</p>
                        <ul className="text-sm space-y-1">
                          {insight.supporting_data.map((data, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{data}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 标签 */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getUsageBadgeVariant(insight.recommended_usage)}>
                        推荐: {insight.recommended_usage === 'direct' ? '直接使用' : insight.recommended_usage === 'background' ? '背景' : '可选'}
                      </Badge>
                      <Badge variant={getCitabilityBadgeVariant(insight.citability)}>
                        可引用性: {insight.citability === 'direct' ? '直接引用' : insight.citability === 'background' ? '背景引用' : '有争议'}
                      </Badge>
                      <Badge variant="outline">{insight.source_type}</Badge>
                    </div>

                    {/* 局限性 */}
                    {insight.limitations && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm">
                          <strong>局限性：</strong> {insight.limitations}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* 决策选项 */}
                  <RadioGroup
                    value={insight.user_decision}
                    onValueChange={(value) => handleInsightDecisionChange(insight.insight_id, value as UserDecision)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="adopt" id={`${insight.insight_id}-must`} />
                      <Label htmlFor={`${insight.insight_id}-must`} className="cursor-pointer">
                        必须使用
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="downgrade" id={`${insight.insight_id}-bg`} />
                      <Label htmlFor={`${insight.insight_id}-bg`} className="cursor-pointer">
                        背景补充
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="reject" id={`${insight.insight_id}-ex`} />
                      <Label htmlFor={`${insight.insight_id}-ex`} className="cursor-pointer">
                        排除
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 矛盾和空白 */}
      {localGaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold">矛盾与空白</h2>
            <Badge variant="secondary">
              {localGaps.length} 个
            </Badge>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              {localGaps.map((gap, index) => (
                <div key={gap.id} className="space-y-3">
                  {index > 0 && <Separator />}
                  
                  <div className="space-y-2">
                    <p className="font-medium text-base">{gap.issue}</p>
                    <p className="text-sm text-muted-foreground">{gap.description}</p>
                  </div>

                  <RadioGroup
                    value={gap.user_decision}
                    onValueChange={(value) => handleGapDecisionChange(gap.gap_id, value as 'respond' | 'ignore')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="respond" id={`${gap.id}-respond`} />
                      <Label htmlFor={`${gap.id}-respond`} className="cursor-pointer">
                        需要处理
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ignore" id={`${gap.id}-ignore`} />
                      <Label htmlFor={`${gap.id}-ignore`} className="cursor-pointer">
                        忽略
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 底部操作按钮 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {allDecisionsComplete() ? (
                <span className="text-green-600 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  所有决策已完成
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  还有 {localInsights.filter(i => i.user_decision === 'pending').length + localGaps.filter(g => g.user_decision === 'pending').length} 项待决策
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                取消
              </Button>
              <Button 
                onClick={handleSaveDecisions}
                disabled={!allDecisionsComplete() || saving}
                className="min-w-[140px]"
              >
                {saving ? '保存中...' : '确认并继续'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
