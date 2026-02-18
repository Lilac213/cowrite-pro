import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { callLLMGenerate } from '@/db/api';
import { 
  Globe, 
  BookOpen, 
  Newspaper, 
  Search as SearchIcon, 
  Database,
  Bookmark,
  Trash2
} from 'lucide-react';
import type { RetrievedMaterial } from '@/types';
import ResultDetailDialog from './ResultDetailDialog';

interface SearchResultsPanelProps {
  results: RetrievedMaterial[];
  onToggleFavorite: (id: string, selected: boolean) => void;
  onDelete: (ids: string[]) => void;
  onBatchFavorite: (ids: string[], selected: boolean) => void;
  onFetchFullText?: (material: RetrievedMaterial) => Promise<void>;
}

type SourceType = 'all' | 'academic' | 'news' | 'web' | 'library';
type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';

export default function SearchResultsPanel({ 
  results, 
  onToggleFavorite, 
  onDelete,
  onBatchFavorite,
  onFetchFullText
}: SearchResultsPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<RetrievedMaterial | null>(null);
  const [translationMap, setTranslationMap] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // 过滤结果
  const filteredResults = useMemo(() => {
    let filtered = results;

    // 按数据源过滤
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(result => {
        const source = result.source_type.toLowerCase();
        switch (sourceFilter) {
          case 'academic':
            return source.includes('academic');
          case 'news':
            return source.includes('news');
          case 'web':
            return source.includes('web');
          case 'library':
            return source.includes('user_library');
          default:
            return true;
        }
      });
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result => {
        const content = result.abstract || result.full_text || '';
        return result.title.toLowerCase().includes(query) ||
          content.toLowerCase().includes(query);
      });
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
        // 优先使用 published_at，如果没有则使用 created_at
        const dateStr = result.published_at || result.created_at;
        if (!dateStr) return false;
        
        const resultDate = new Date(dateStr);
        return resultDate >= filterDate;
      });
    }

    return filtered;
  }, [results, sourceFilter, searchQuery, timeFilter]);

  const getRelevanceScore = (result: RetrievedMaterial) => {
    const metadata = result.metadata || {};
    const similarity = typeof metadata.similarity_score === 'number' ? metadata.similarity_score : 0;
    const embedding = typeof metadata.embedding_similarity === 'number' ? metadata.embedding_similarity : 0;
    const quality = typeof metadata.quality_score === 'number' ? metadata.quality_score : 0;
    const rankBoost = typeof metadata.rank === 'number' && metadata.rank > 0 ? 1 / metadata.rank : 0;
    return similarity + embedding + quality + rankBoost;
  };

  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
  }, [filteredResults]);

  const top3Ids = useMemo(() => {
    return new Set(sortedResults.slice(0, 3).map(result => result.id));
  }, [sortedResults]);

  const isLikelyEnglish = (text: string) => {
    const letters = text.match(/[A-Za-z]/g)?.length || 0;
    const han = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    return letters > 40 && letters > han * 2;
  };

  useEffect(() => {
    let cancelled = false;
    const translateAbstracts = async () => {
      for (const result of sortedResults) {
        const content = result.abstract || result.full_text || '';
        if (!content || !isLikelyEnglish(content)) continue;
        if (translationMap[result.id] || translatingIds.has(result.id)) continue;
        setTranslatingIds(prev => new Set(prev).add(result.id));
        try {
          const prompt = content.slice(0, 1200);
          const translated = await callLLMGenerate(prompt, undefined, '将以下英文摘要翻译成中文，只输出翻译结果，不要添加额外说明。', {
            required: ['translation'],
            defaults: { translation: '' }
          });
          const text =
            typeof translated === 'string'
              ? translated
              : translated?.translation || '';
          if (!cancelled && text) {
            setTranslationMap(prev => ({ ...prev, [result.id]: text }));
          }
        } catch (error) {
          if (!cancelled) {
            toast({
              title: '摘要翻译失败',
              description: result.title,
              variant: 'destructive',
            });
          }
        } finally {
          if (!cancelled) {
            setTranslatingIds(prev => {
              const next = new Set(prev);
              next.delete(result.id);
              return next;
            });
          }
        }
      }
    };
    translateAbstracts();
    return () => {
      cancelled = true;
    };
  }, [sortedResults, translationMap, translatingIds, toast]);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedResults.map(r => r.id)));
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
  const handleOpenDetail = (result: RetrievedMaterial) => {
    setSelectedResult(result);
    setDetailDialogOpen(true);
  };

  const getSourceIcon = (sourceType: string) => {
    const lowerSource = sourceType.toLowerCase();
    if (lowerSource.includes('academic')) return <BookOpen className="w-4 h-4" />;
    if (lowerSource.includes('news')) return <Newspaper className="w-4 h-4" />;
    if (lowerSource.includes('web')) return <Globe className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  const getSourceBadgeVariant = (sourceType: string): "default" | "secondary" | "destructive" | "outline" => {
    const lowerSource = sourceType.toLowerCase();
    if (lowerSource.includes('academic')) return 'default'; // 蓝色
    if (lowerSource.includes('news')) return 'destructive'; // 橙色/红色
    if (lowerSource.includes('web')) return 'secondary'; // 绿色
    return 'outline';
  };

  const getSourceName = (sourceType: string) => {
    switch (sourceType) {
      case 'academic': return '学术';
      case 'news': return '资讯';
      case 'web': return '网页';
      case 'user_library': return '资料库';
      default: return sourceType;
    }
  };

  const isAllSelected = sortedResults.length > 0 && selectedIds.size === sortedResults.length;

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
              找到 {sortedResults.length} 条相关结果
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
        {sortedResults.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <SearchIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">暂无搜索结果</p>
          </Card>
        ) : (
          sortedResults.map((result) => {
            const content = result.abstract || result.full_text || '';
            const translated = translationMap[result.id];
            const displayContent = translated || content;
            const isTop3 = Boolean(result.metadata?.is_top3) || top3Ids.has(result.id);
            return (
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
                        <Badge variant={getSourceBadgeVariant(result.source_type)} className="flex items-center gap-1">
                          {getSourceIcon(result.source_type)}
                          <span>{getSourceName(result.source_type)}</span>
                        </Badge>
                        {isTop3 && (
                          <Badge variant="secondary">TOP 3</Badge>
                        )}
                        {result.published_at && (
                          <span className="text-muted-foreground">
                            {new Date(result.published_at).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {result.year && !result.published_at && (
                          <span className="text-muted-foreground">
                            {result.year}
                          </span>
                        )}
                      </div>

                      {/* 内容摘要 */}
                      {displayContent && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {displayContent.substring(0, 200)}
                          {displayContent.length > 200 && '...'}
                        </p>
                      )}
                      {isLikelyEnglish(content) && !translated && translatingIds.has(result.id) && (
                        <p className="text-xs text-muted-foreground">摘要翻译中...</p>
                      )}

                      {/* 作者 */}
                      {result.authors && result.authors.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          作者：{result.authors.join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!onFetchFullText || fetchingIds.has(result.id)) return;
                              setFetchingIds(prev => new Set(prev).add(result.id));
                              onFetchFullText(result)
                                .then(() => {
                                  toast({
                                    title: '已抓取原文',
                                    description: result.title,
                                  });
                                })
                                .catch((error) => {
                                  toast({
                                    title: '抓取失败',
                                    description: error instanceof Error ? error.message : '请稍后重试',
                                    variant: 'destructive',
                                  });
                                })
                                .finally(() => {
                                  setFetchingIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(result.id);
                                    return next;
                                  });
                                });
                            }}
                            className="text-primary hover:underline"
                          >
                            {fetchingIds.has(result.id) ? '抓取中...' : '原文链接'}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 收藏按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(result.id, !result.is_selected);
                      }}
                    >
                      {result.is_selected ? (
                        <Bookmark className="w-4 h-4 fill-current" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 详情弹窗 - 暂时注释掉，需要更新ResultDetailDialog */}
      {/* <ResultDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        result={selectedResult}
        onToggleFavorite={onToggleFavorite}
      /> */}
    </div>
  );
}
