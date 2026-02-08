import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, BookOpen, Newspaper, Globe, Database } from 'lucide-react';

interface SearchPlanPanelProps {
  searchSummary?: {
    interpreted_topic?: string;
    key_dimensions?: string[];
    academic_queries?: string[];
    news_queries?: string[];
    web_queries?: string[];
    user_library_queries?: string[];
  };
  isSearching?: boolean;
}

export default function SearchPlanPanel({ searchSummary, isSearching }: SearchPlanPanelProps) {
  if (!searchSummary && !isSearching) {
    return (
      <Card className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <Search className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-sm">暂无搜索计划</p>
        <p className="text-xs mt-2">点击"开始搜索"生成搜索计划</p>
      </Card>
    );
  }

  if (isSearching && !searchSummary) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">搜索计划</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">正在生成搜索计划...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <CardTitle className="text-lg">搜索计划</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 理解的主题 */}
        {searchSummary?.interpreted_topic && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Search className="w-4 h-4" />
              理解的主题
            </h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {searchSummary.interpreted_topic}
            </p>
          </div>
        )}

        {/* 关键维度 */}
        {searchSummary?.key_dimensions && searchSummary.key_dimensions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">关键维度</h4>
            <div className="flex flex-wrap gap-2">
              {searchSummary.key_dimensions.map((dimension, index) => (
                <Badge key={index} variant="secondary">
                  {dimension}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* 各数据源查询计划 */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">数据源查询</h4>

          {/* 学术调研 */}
          {searchSummary?.academic_queries && searchSummary.academic_queries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>学术调研</span>
              </div>
              <ul className="space-y-1 ml-6">
                {searchSummary.academic_queries.map((query, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 行业资讯 */}
          {searchSummary?.news_queries && searchSummary.news_queries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Newspaper className="w-4 h-4 text-orange-500" />
                <span>行业资讯</span>
              </div>
              <ul className="space-y-1 ml-6">
                {searchSummary.news_queries.map((query, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 网页内容 */}
          {searchSummary?.web_queries && searchSummary.web_queries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4 text-green-500" />
                <span>网页内容</span>
              </div>
              <ul className="space-y-1 ml-6">
                {searchSummary.web_queries.map((query, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 资料库 */}
          {searchSummary?.user_library_queries && searchSummary.user_library_queries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="w-4 h-4 text-purple-500" />
                <span>资料库</span>
              </div>
              <ul className="space-y-1 ml-6">
                {searchSummary.user_library_queries.map((query, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
