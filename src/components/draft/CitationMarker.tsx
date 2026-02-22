import { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Citation } from '@/types';

interface CitationMarkerProps {
  citation: Citation;
  index: number;
  onSelect?: (citation: Citation) => void;
}

export default function CitationMarker({ citation, index, onSelect }: CitationMarkerProps) {
  const [open, setOpen] = useState(false);

  if (onSelect) {
    return (
      <button
        className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors cursor-pointer mx-0.5"
        onClick={() => onSelect(citation)}
      >
        {index}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors cursor-pointer mx-0.5"
          onClick={() => setOpen(true)}
        >
          {index}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <Card className="border-0 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <CardTitle className="text-sm font-medium line-clamp-2">
                  {citation.material_title}
                </CardTitle>
              </div>
            </div>
            {citation.material_source && (
              <CardDescription className="text-xs mt-1">
                来源：{citation.material_source}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {citation.insight && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">观点洞察</p>
                <p className="text-sm text-foreground line-clamp-4">
                  {citation.insight}
                </p>
              </div>
            )}
            {citation.material_summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">摘要</p>
                <p className="text-sm text-foreground line-clamp-4">
                  {citation.material_summary}
                </p>
              </div>
            )}
            {citation.quote && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">引用内容</p>
                <p className="text-sm text-foreground italic border-l-2 border-primary pl-2">
                  "{citation.quote}"
                </p>
              </div>
            )}
            {citation.material_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <a
                  href={citation.material_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  查看原文
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
