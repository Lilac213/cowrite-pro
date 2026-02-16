import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, BookOpen, CheckCircle2, Brain, ExternalLink } from 'lucide-react';

interface SearchPlan {
  interpreted_topic?: string;
  key_dimensions?: string[];
  academic_queries?: string[];
  news_queries?: string[];
  web_queries?: string[];
  user_library_queries?: string[];
}

interface Top3Item {
  title: string;
  source: string;
  conclusion: string;
  url: string;
}

interface StreamingSearchProgressProps {
  stage: 'idle' | 'planning' | 'searching' | 'top3' | 'complete';
  searchPlan?: SearchPlan | null;
  top3?: Top3Item[];
  message?: string;
}

export default function StreamingSearchProgress({ 
  stage, 
  searchPlan, 
  top3, 
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

        {(stage === 'searching' || stage === 'top3' || stage === 'complete') && searchPlan && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-primary mb-2">🧠 主题理解</p>
              <p className="text-sm text-muted-foreground">
                {searchPlan.interpreted_topic || '正在分析...'}
              </p>
            </div>

            {searchPlan.key_dimensions && searchPlan.key_dimensions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-primary mb-2">关键维度</p>
                <div className="flex flex-wrap gap-2">
                  {searchPlan.key_dimensions.map((dim, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {dim}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-primary mb-2">搜索计划</p>
              <div className="space-y-2">
                {searchPlan.academic_queries && searchPlan.academic_queries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">学术搜索</p>
                    <div className="flex flex-wrap gap-1">
                      {searchPlan.academic_queries.map((q, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-blue-50">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {searchPlan.news_queries && searchPlan.news_queries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">新闻搜索</p>
                    <div className="flex flex-wrap gap-1">
                      {searchPlan.news_queries.map((q, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-green-50">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {searchPlan.web_queries && searchPlan.web_queries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">网络搜索</p>
                    <div className="flex flex-wrap gap-1">
                      {searchPlan.web_queries.map((q, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-purple-50">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {stage === 'searching' && !searchPlan && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
            <p className="text-sm text-muted-foreground">正在检索资料...</p>
          </div>
        )}

        {(stage === 'top3' || stage === 'complete') && top3 && top3.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary">初步发现（Top 3 核心观点）</p>
            {top3.map((item, idx) => (
              <Card key={idx} className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm flex-1">{item.title}</h4>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {idx + 1}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">来源：{item.source}</p>
                  <p className="text-sm">{item.conclusion}</p>
                  {item.url && (
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> 查看原文
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
