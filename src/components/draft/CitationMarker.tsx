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

  const isRetrievedMaterial = citation.source_kind === 'retrieved_material';
  const badgeClasses =
    'inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-sm cursor-pointer mx-0.5 align-super transition-colors';
  const retrievedClasses =
    'text-white bg-blue-600 hover:bg-blue-700';
  const insightClasses =
    'text-amber-800 bg-amber-100 hover:bg-amber-200';
  const headerLabel = isRetrievedMaterial ? '原始资料' : '分析洞察';

  if (onSelect) {
    return (
      <button
        className={`${badgeClasses} ${isRetrievedMaterial ? retrievedClasses : insightClasses}`}
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
          className={`${badgeClasses} ${isRetrievedMaterial ? retrievedClasses : insightClasses}`}
          onClick={() => setOpen(true)}
        >
          {index}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 overflow-hidden rounded-xl shadow-xl border-slate-200" align="start" sideOffset={8}>
        <div className="bg-white">
            <div className="p-4 border-b bg-white relative z-20">
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant="default"
                    className={`${isRetrievedMaterial ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'} text-white px-3 py-1 text-xs font-bold rounded-full`}
                  >
                    {headerLabel} [{index}]
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
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">摘要</div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                    {citation.material_summary || '暂无摘要'}
                  </p>
                </div>

                {Array.isArray(citation.citations_detail) && citation.citations_detail.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2 mb-3 border border-slate-100">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">引用信息</div>
                    <div className="space-y-1">
                      {citation.citations_detail.map((item: any, idx: number) => {
                        if (typeof item === 'string') {
                          return (
                            <div key={idx} className="text-xs text-slate-600 leading-relaxed">
                              {idx + 1}. {item}
                            </div>
                          );
                        }

                        const title = item.title || item.text || item.label || '';
                        const author = item.author || item.authors;
                        const year = item.year;
                        const url = item.url || item.link;

                        return (
                          <div key={idx} className="text-xs text-slate-600 leading-relaxed">
                            <div>
                              {idx + 1}. {title || '未命名引用'}
                            </div>
                            {(author || year) && (
                              <div className="text-[11px] text-slate-500">
                                {[author, year].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mt-0.5"
                              >
                                <ExternalLink className="h-3 w-3" />
                                查看引用来源
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {citation.material_url && (
                  <a
                    href={citation.material_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors group bg-blue-50 p-2 rounded-md hover:bg-blue-100"
                  >
                    <ExternalLink className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    查看全文
                  </a>
                )}
              </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
