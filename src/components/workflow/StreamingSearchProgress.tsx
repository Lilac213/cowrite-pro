import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, BookOpen, CheckCircle2, Brain } from 'lucide-react';

interface StreamingSearchProgressProps {
  stage: 'idle' | 'planning' | 'searching' | 'top3' | 'complete';
  message?: string;
}

export default function StreamingSearchProgress({ 
  stage, 
  message 
}: StreamingSearchProgressProps) {
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
              {stage === 'idle' && '准备搜索'}
              {stage === 'planning' && '生成搜索计划'}
              {stage === 'searching' && '正在检索资料'}
              {stage === 'top3' && '初步发现'}
              {stage === 'complete' && '搜索完成'}
            </CardTitle>
          </div>
          <Badge variant={stage === 'complete' ? 'default' : 'secondary'}>
            {stage === 'idle' && '待开始'}
            {stage === 'planning' && '阶段 1/4'}
            {stage === 'searching' && '阶段 2/4'}
            {stage === 'top3' && '阶段 3/4'}
            {stage === 'complete' && '已完成'}
          </Badge>
        </div>
        {message && (
          <CardDescription className="mt-2">{message}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {stage === 'planning' && (
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <Brain className="h-12 w-12 text-yellow-500 mx-auto mb-2 animate-bounce" />
              <p className="text-sm text-muted-foreground">正在分析需求文档，生成搜索计划...</p>
            </div>
          </div>
        )}

        {stage === 'searching' && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
            <p className="text-sm text-muted-foreground">正在检索资料...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
