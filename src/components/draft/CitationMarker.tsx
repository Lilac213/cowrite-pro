import { useState } from 'react';
import { ExternalLink, FileText, X, Lightbulb } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Citation } from '@/types';

interface CitationMarkerProps {
  citation: Citation;
  index: number;
  onSelect?: (citation: Citation) => void;
}

export default function CitationMarker({ citation, index, onSelect }: CitationMarkerProps) {
  const [open, setOpen] = useState(false);

  // If onSelect is provided, we use it instead of Popover (for side panel display)
  if (onSelect) {
    return (
      <button
        className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-sm hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer mx-0.5 align-super"
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
          className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-sm hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer mx-0.5 align-super"
          onClick={() => setOpen(true)}
        >
          {index}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 overflow-hidden rounded-xl shadow-xl border-slate-200" align="start" sideOffset={8}>
        <div className="bg-white">
            <div className="p-4 border-b bg-white relative z-20">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="default" className="bg-black hover:bg-black text-white px-3 py-1 text-xs font-bold rounded-full">
                    来源详情 [{index}]
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                
                <h3 className="text-base font-bold text-slate-900 mb-3 leading-snug line-clamp-2">
                  {citation.material_title}
                </h3>
                
                {citation.insight && (
                  <div className="bg-amber-50 rounded-lg p-3 space-y-2 mb-3 border border-amber-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                      <Lightbulb className="h-3 w-3" />
                      观点洞察
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {citation.insight}
                    </p>
                  </div>
                )}
                
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 mb-3 border border-slate-100">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">摘要:</div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                    {citation.material_summary || "暂无摘要"}
                  </p>
                </div>

                {citation.material_url && (
                  <a
                    href={citation.material_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors group bg-blue-50 p-2 rounded-md hover:bg-blue-100"
                  >
                    <ExternalLink className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    查看原始文档
                  </a>
                )}
              </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
