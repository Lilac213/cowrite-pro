import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Globe, 
  BookOpen, 
  Newspaper, 
  Search as SearchIcon, 
  Database,
  Bookmark,
  Trash2,
  ArrowRight
} from 'lucide-react';
import type { KnowledgeBase } from '@/types';
import ResultDetailDialog from './ResultDetailDialog';

interface SearchResultsPanelProps {
  results: KnowledgeBase[];
  onToggleFavorite: (id: string, selected: boolean) => void;
  onDelete: (ids: string[]) => void;
  onBatchFavorite: (ids: string[], selected: boolean) => void;
  onOrganize?: () => void;
  onNextStep?: () => void;
}

type SourceType = 'all' | 'academic' | 'news' | 'web' | 'library';
type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';

export default function SearchResultsPanel({ 
  results, 
  onToggleFavorite, 
  onDelete,
  onBatchFavorite,
  onOrganize,
  onNextStep
}: SearchResultsPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<KnowledgeBase | null>(null);
  const { toast } = useToast();

  // 过滤结果
  const filteredResults = useMemo(() => {
    let filtered = results;

    // 按数据源过滤
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(result => {
        const source = result.source.toLowerCase();
        switch (sourceFilter) {
          case 'academic':
            return source.includes('scholar');
          case 'news':
            return source.includes('news');
          case 'web':
            return source.includes('search');
          case 'library':
            return source.includes('资料库') || source.includes('素材');
          default:
            return true;
        }
      });
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result => 
        result.title.toLowerCase().includes(query) ||
        result.content.toLowerCase().includes(query) ||
        result.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }

    // 按时间过滤
    if (timeFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (timeFilter) {
        case 'today':
          filterDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(result => {
        // 优先使用 published_at，如果没有则使用 collected_at
        const dateStr = result.published_at || result.collected_at;
        if (!dateStr) return false;
        
        const resultDate = new Date(dateStr);
        return resultDate >= filterDate;
      });
    }

    return filtered;
  }, [results, sourceFilter, searchQuery, timeFilter]);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredResults.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 单选
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 批量收藏
  const handleBatchFavorite = () => {
    if (selectedIds.size === 0) {
      toast({
        title: '请先选择资料',
        description: '请勾选要收藏的资料',
        variant: 'destructive',
      });
      return;
    }
    onBatchFavorite(Array.from(selectedIds), true);
    setSelectedIds(new Set());
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      toast({
        title: '请先选择资料',
        description: '请勾选要删除的资料',
        variant: 'destructive',
      });
      return;
    }
    if (confirm(`确定要删除选中的 ${selectedIds.size} 条结果吗？`)) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // 打开详情
  const handleOpenDetail = (result: KnowledgeBase) => {
    setSelectedResult(result);
    setDetailDialogOpen(true);
  };

  const getSourceIcon = (source: string) => {
    if (source.includes('Scholar')) return <BookOpen className="w-4 h-4" />;
    if (source.includes('News')) return <Newspaper className="w-4 h-4" />;
    if (source.includes('Search')) return <Globe className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  const getSourceBadgeColor = (source: string) => {
    if (source.includes('Scholar')) return 'bg-blue-500';
    if (source.includes('News')) return 'bg-orange-500';
    if (source.includes('Search')) return 'bg-green-500';
    if (source.includes('资料库') || source.includes('素材')) return 'bg-purple-500';
    return 'bg-muted';
  };

  const isAllSelected = filteredResults.length > 0 && selectedIds.size === filteredResults.length;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 数据源筛选 Tabs */}
      <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceType)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            全部
          </TabsTrigger>
          <TabsTrigger value="academic" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            学术
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            资讯
          </TabsTrigger>
          <TabsTrigger value="web" className="flex items-center gap-2">
            <SearchIcon className="w-4 h-4" />
            网页
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            资料库
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 搜索框和时间筛选 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="在当前数据源中搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部时间</SelectItem>
            <SelectItem value="today">今天</SelectItem>
            <SelectItem value="week">最近一周</SelectItem>
            <SelectItem value="month">最近一月</SelectItem>
            <SelectItem value="year">最近一年</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 结果统计和批量操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              找到 {filteredResults.length} 条相关结果
              {selectedIds.size > 0 && ` (已选择 ${selectedIds.size} 条)`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchFavorite}
          >
            <Bookmark className="w-4 h-4 mr-1" />
            收藏
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchDelete}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
        </div>
      </div>

      {/* 搜索结果列表 */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredResults.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <SearchIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">暂无搜索结果</p>
            <p className="text-xs mt-2">点击左侧"开始搜索"按钮查询资料</p>
          </Card>
        ) : (
          filteredResults.map((result) => (
            <Card 
              key={result.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(result.id)}
                    onCheckedChange={(checked) => handleSelectOne(result.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div 
                    className="flex-1 space-y-2"
                    onClick={() => handleOpenDetail(result)}
                  >
                    {/* 标题 */}
                    <h3 className="font-semibold text-base hover:text-primary transition-colors">
                      {result.title}
                    </h3>

                    {/* 来源和时间 */}
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className={getSourceBadgeColor(result.source)}>
                        {getSourceIcon(result.source)}
                        <span className="ml-1">{result.source}</span>
                      </Badge>
                      {result.published_at && (
                        <span className="text-muted-foreground">
                          {new Date(result.published_at).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>

                    {/* 内容摘要 */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {result.content.substring(0, 200)}
                      {result.content.length > 200 && '...'}
                    </p>

                    {/* 关键词 */}
                    {result.keywords && result.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {result.keywords.slice(0, 5).map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 收藏按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(result.id, !result.selected);
                    }}
                  >
                    {result.selected ? (
                      <Bookmark className="w-4 h-4 fill-current" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 资料整理和进入下一步按钮 */}
      {filteredResults.length > 0 && (
        <div className="flex justify-end gap-2 mt-4">
          {onOrganize && (
            <Button onClick={onOrganize} variant="outline">
              资料整理
            </Button>
          )}
          {onNextStep && (
            <Button onClick={onNextStep}>
              <ArrowRight className="h-4 w-4 mr-2" />
              进入下一步
            </Button>
          )}
        </div>
      )}

      {/* 详情弹窗 */}
      <ResultDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        result={selectedResult}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
