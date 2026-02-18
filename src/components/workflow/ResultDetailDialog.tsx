import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, BookmarkPlus, Bookmark } from 'lucide-react';
import type { RetrievedMaterial } from '@/types';

interface ResultDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: RetrievedMaterial | null;
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
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('academic')) return 'bg-blue-500';
    if (lowerSource.includes('news')) return 'bg-orange-500';
    if (lowerSource.includes('web')) return 'bg-green-500';
    if (lowerSource.includes('user_library')) return 'bg-purple-500';
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
                  onClick={() => onToggleFavorite(result.id, !result.is_selected)}
                >
                  {result.is_selected ? (
                    <Bookmark className="w-4 h-4 fill-current" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4" />
                  )}
                </Button>
              )}
              {result.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(result.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={getSourceBadgeColor(result.source_type)}>
              {result.source_type}
            </Badge>
            {result.published_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(result.published_at).toLocaleDateString('zh-CN')}
              </span>
            )}
            {result.year && !result.published_at && (
              <span className="text-xs text-muted-foreground">{result.year}</span>
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-12rem)] pr-4">
          <div className="space-y-4">
            {result.authors && result.authors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">作者</h4>
                <p className="text-sm text-muted-foreground">{result.authors.join(', ')}</p>
              </div>
            )}

            {(result.abstract || result.full_text) && (
              <div>
                <h4 className="text-sm font-semibold mb-2">摘要与内容</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {(result.full_text || result.abstract || '').trim()}
                </p>
              </div>
            )}

            {result.url && (
              <div>
                <h4 className="text-sm font-semibold mb-2">来源链接</h4>
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {result.url}
                </a>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
