import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, BookmarkPlus, Bookmark } from 'lucide-react';
import type { KnowledgeBase } from '@/types';

interface ResultDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: KnowledgeBase | null;
  onToggleFavorite?: (id: string, selected: boolean) => void;
}

export default function ResultDetailDialog({ 
  open, 
  onOpenChange, 
  result,
  onToggleFavorite 
}: ResultDetailDialogProps) {
  if (!result) return null;

  const getSourceBadgeColor = (source: string) => {
    if (source.includes('Scholar')) return 'bg-blue-500';
    if (source.includes('News')) return 'bg-orange-500';
    if (source.includes('Search')) return 'bg-green-500';
    if (source.includes('资料库') || source.includes('素材')) return 'bg-purple-500';
    return 'bg-muted';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl flex-1 pr-4">{result.title}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {onToggleFavorite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(result.id, !result.selected)}
                >
                  {result.selected ? (
                    <Bookmark className="w-4 h-4 fill-current" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4" />
                  )}
                </Button>
              )}
              {result.source_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(result.source_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={getSourceBadgeColor(result.source)}>
              {result.source}
            </Badge>
            {result.published_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(result.published_at).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* 关键词 */}
            {result.keywords && result.keywords.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">关键词</h4>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 提取的内容片段 */}
            {result.extracted_content && result.extracted_content.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">提取的关键内容</h4>
                <div className="space-y-2">
                  {result.extracted_content.map((excerpt, index) => (
                    <div key={index} className="text-sm bg-accent/50 p-3 rounded-md border-l-2 border-primary">
                      {excerpt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 来源链接 */}
            {result.source_url && (
              <div>
                <h4 className="text-sm font-semibold mb-2">来源链接</h4>
                <a 
                  href={result.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {result.source_url}
                </a>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
