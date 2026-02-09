import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, BookOpen, Newspaper, Globe, Database } from 'lucide-react';

interface SearchPlanPanelProps {
  searchSummary?: {
    interpreted_topic?: string;
    key_dimensions?: string[];
    academic_queries?: string[] | any[];
    news_queries?: string[] | any[];
    web_queries?: string[] | any[];
    user_library_queries?: string[] | any[];
  };
  isSearching?: boolean;
}

export default function SearchPlanPanel({ searchSummary, isSearching }: SearchPlanPanelProps) {
  // Helper function to extract query text from query objects
  const extractQueryText = (query: string | any): string => {
    if (typeof query === 'string') return query;
    if (query && typeof query === 'object') {
      return query.query || query.text || query.keywords || JSON.stringify(query);
    }
    return String(query);
  };

  if (!searchSummary && !isSearching) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
        <Search className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-sm">暂无搜索计划</p>
        <p className="text-xs mt-2">点击"开始搜索"生成搜索计划</p>
      </div>
    );
  }

  if (isSearching && !searchSummary) {
    return (
      <div className="h-full">
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm">正在生成搜索计划...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto space-y-4">
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
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">数据源查询</h4>
          <Badge variant="outline" className="text-xs">
            共 {
              (searchSummary?.academic_queries?.length || 0) +
              (searchSummary?.news_queries?.length || 0) +
              (searchSummary?.web_queries?.length || 0) +
              (searchSummary?.user_library_queries?.length || 0)
            } 条查询
          </Badge>
        </div>

        {/* 如果没有任何查询 */}
        {!searchSummary?.academic_queries?.length && 
         !searchSummary?.news_queries?.length && 
         !searchSummary?.web_queries?.length && 
         !searchSummary?.user_library_queries?.length && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>暂无查询计划</p>
          </div>
        )}

        {/* 学术调研 */}
        {searchSummary?.academic_queries && searchSummary.academic_queries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span>学术调研 (Google Scholar)</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {searchSummary.academic_queries.length} 条
              </Badge>
            </div>
            <div className="ml-6 space-y-1">
              {searchSummary.academic_queries.map((query, index) => (
                <div key={index} className="text-sm bg-blue-50 dark:bg-blue-950 px-3 py-2 rounded border border-blue-200 dark:border-blue-800">
                  {extractQueryText(query)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 行业资讯 */}
        {searchSummary?.news_queries && searchSummary.news_queries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Newspaper className="w-4 h-4 text-orange-500" />
              <span>行业资讯 (SerpAPI - Google News)</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {searchSummary.news_queries.length} 条
              </Badge>
            </div>
            <div className="ml-6 space-y-1">
              {searchSummary.news_queries.map((query, index) => (
                <div key={index} className="text-sm bg-orange-50 dark:bg-orange-950 px-3 py-2 rounded border border-orange-200 dark:border-orange-800">
                  {extractQueryText(query)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 网页内容 */}
        {searchSummary?.web_queries && searchSummary.web_queries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="w-4 h-4 text-green-500" />
              <span>网页内容 (SerpAPI - Google Search)</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {searchSummary.web_queries.length} 条
              </Badge>
            </div>
            <div className="ml-6 space-y-1">
              {searchSummary.web_queries.map((query, index) => (
                <div key={index} className="text-sm bg-green-50 dark:bg-green-950 px-3 py-2 rounded border border-green-200 dark:border-green-800">
                  {extractQueryText(query)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 资料库 */}
        {searchSummary?.user_library_queries && searchSummary.user_library_queries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="w-4 h-4 text-purple-500" />
              <span>资料库</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {searchSummary.user_library_queries.length} 条
              </Badge>
            </div>
            <div className="ml-6 space-y-1">
              {searchSummary.user_library_queries.map((query, index) => (
                <div key={index} className="text-sm bg-purple-50 dark:bg-purple-950 px-3 py-2 rounded border border-purple-200 dark:border-purple-800">
                  {extractQueryText(query)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
