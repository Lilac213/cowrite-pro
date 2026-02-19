import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Sparkles, BookOpen, CheckCircle2, Brain } from 'lucide-react';

interface StreamingSearchProgressProps {
  stage: 'idle' | 'planning' | 'searching' | 'top3' | 'complete';
  message?: string;
}

export default function StreamingSearchProgress({ 
  stage, 
  message 
}: StreamingSearchProgressProps) {
  const stageInfo = {
    idle: {
      title: '准备开始',
      badge: '待开始',
      progress: 0,
      detail: '已准备就绪，下一步将读取需求并拆解要点。'
    },
    planning: {
      title: '梳理搜索计划',
      badge: '阶段 1/4',
      progress: 25,
      detail: '正在理解你的目标、关键词和核心观点，形成清晰的检索路线。'
    },
    searching: {
      title: '多源检索进行中',
      badge: '阶段 2/4',
      progress: 60,
      detail: '正在从学术、新闻、网页与本地资料中抓取并去重排序。'
    },
    top3: {
      title: '提炼高相关结果',
      badge: '阶段 3/4',
      progress: 85,
      detail: '已锁定最相关的重点资料，继续补齐完整结果列表。'
    },
    complete: {
      title: '搜索完成',
      badge: '已完成',
      progress: 100,
      detail: '全部结果已准备好，可以开始筛选与阅读。'
    }
  } as const;
  const info = stageInfo[stage];
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stage === 'planning' && <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />}
            {stage === 'searching' && <Search className="h-5 w-5 text-blue-500 animate-pulse" />}
            {stage === 'top3' && <BookOpen className="h-5 w-5 text-green-500" />}
            {stage === 'complete' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            <CardTitle className="text-lg">
              {info.title}
            </CardTitle>
          </div>
          <Badge variant={stage === 'complete' ? 'default' : 'secondary'}>{info.badge}</Badge>
        </div>
        <div className="mt-3 space-y-2">
          <Progress value={info.progress} className="h-2" />
        </div>
        <CardDescription className="mt-3">
          {message || info.detail}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {stage === 'planning' && (
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <Brain className="h-12 w-12 text-yellow-500 mx-auto mb-2 animate-bounce" />
              <p className="text-sm text-muted-foreground">正在提炼主题、要点与关键词，准备展开检索。</p>
            </div>
          </div>
        )}

        {stage === 'searching' && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
            <p className="text-sm text-muted-foreground">正在抓取资料并实时更新结果列表。</p>
          </div>
        )}
        {stage === 'top3' && (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">已标出 TOP 3 重点结果，完整列表继续补齐。</p>
          </div>
        )}
        {stage === 'complete' && (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">搜索完成，可以开始筛选与查看详情。</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
