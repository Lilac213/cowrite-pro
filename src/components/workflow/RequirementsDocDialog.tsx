import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Target, Calendar, Users } from 'lucide-react';

interface RequirementsDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementsDoc: string;
}

export default function RequirementsDocDialog({ 
  open, 
  onOpenChange, 
  requirementsDoc 
}: RequirementsDocDialogProps) {
  // 解析需求文档内容
  const parseRequirements = () => {
    try {
      const parsed = JSON.parse(requirementsDoc);
      return parsed;
    } catch {
      return null;
    }
  };

  const requirements = parseRequirements();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileText className="w-6 h-6" />
            需求文档
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6 py-4">
            {requirements ? (
              <>
                {/* 主题 */}
                {requirements.topic && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-bold">主题</h3>
                    </div>
                    <p className="text-base leading-relaxed bg-primary/5 p-4 rounded-lg">
                      {requirements.topic}
                    </p>
                  </div>
                )}

                <Separator />

                {/* 目标 */}
                {requirements.goal && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">目标</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {requirements.goal}
                    </p>
                  </div>
                )}

                {/* 关键维度 */}
                {requirements.key_dimensions && requirements.key_dimensions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">关键维度</h3>
                    <div className="flex flex-wrap gap-2">
                      {requirements.key_dimensions.map((dimension: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-sm py-1">
                          {dimension}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 时间范围 */}
                {(requirements.time_range || requirements.year_start || requirements.year_end) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-bold">时间范围</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requirements.time_range || 
                       `${requirements.year_start || ''} - ${requirements.year_end || ''}`}
                    </p>
                  </div>
                )}

                {/* 目标受众 */}
                {requirements.target_audience && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-bold">目标受众</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requirements.target_audience}
                    </p>
                  </div>
                )}

                {/* 其他字段 */}
                {Object.keys(requirements).map((key) => {
                  if (['topic', 'goal', 'key_dimensions', 'time_range', 'year_start', 'year_end', 'target_audience'].includes(key)) {
                    return null;
                  }
                  const value = requirements[key];
                  if (!value) return null;
                  
                  return (
                    <div key={key} className="space-y-2">
                      <h3 className="text-lg font-bold capitalize">
                        {key.replace(/_/g, ' ')}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {typeof value === 'string' ? (
                          <p>{value}</p>
                        ) : Array.isArray(value) ? (
                          <ul className="list-disc list-inside space-y-1">
                            {value.map((item, idx) => (
                              <li key={idx}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                            ))}
                          </ul>
                        ) : (
                          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {requirementsDoc}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
