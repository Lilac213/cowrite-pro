import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';

interface SynthesisResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  synthesisResults: any;
}

export default function SynthesisResultsDialog({ 
  open, 
  onOpenChange, 
  synthesisResults 
}: SynthesisResultsDialogProps) {
  if (!synthesisResults) return null;

  // 解析 JSON 内容的辅助函数
  const parseContent = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return item.insight || item.data_point || item.point || item.text || 
             item.description || item.gap || item.contradiction || JSON.stringify(item);
    }
    return String(item);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl">资料整理结果</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6">
            {/* 综合洞察 */}
            {synthesisResults.synthesized_insights && synthesisResults.synthesized_insights.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold">综合洞察</h3>
                </div>
                <div className="space-y-3">
                  {synthesisResults.synthesized_insights.map((insight: any, idx: number) => {
                    const content = parseContent(insight);
                    return (
                      <div 
                        key={idx} 
                        className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-l-4 border-blue-500"
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* 关键数据点 */}
            {synthesisResults.key_data_points && synthesisResults.key_data_points.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-bold">关键数据点</h3>
                </div>
                <div className="space-y-3">
                  {synthesisResults.key_data_points.map((point: any, idx: number) => {
                    const content = parseContent(point);
                    // 提取数字和百分比并加粗
                    const formattedContent = content.replace(
                      /(\d+(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?[MBK]?)/g,
                      '<strong>$1</strong>'
                    );
                    
                    return (
                      <div 
                        key={idx} 
                        className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-l-4 border-green-500"
                      >
                        <p 
                          className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: formattedContent }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* 矛盾或研究空白 */}
            {synthesisResults.contradictions_or_gaps && synthesisResults.contradictions_or_gaps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold">矛盾或研究空白</h3>
                </div>
                <div className="space-y-3">
                  {synthesisResults.contradictions_or_gaps.map((item: any, idx: number) => {
                    const content = parseContent(item);
                    // 加粗关键词
                    const formattedContent = content.replace(
                      /(矛盾|空白|缺乏|不足|问题|挑战|争议)/g,
                      '<strong>$1</strong>'
                    );
                    
                    return (
                      <div 
                        key={idx} 
                        className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border-l-4 border-yellow-500"
                      >
                        <p 
                          className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: formattedContent }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 如果没有任何内容 */}
            {(!synthesisResults.synthesized_insights || synthesisResults.synthesized_insights.length === 0) && 
             (!synthesisResults.key_data_points || synthesisResults.key_data_points.length === 0) &&
             (!synthesisResults.contradictions_or_gaps || synthesisResults.contradictions_or_gaps.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无整理结果</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
