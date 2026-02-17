import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Target, Calendar, Users, Settings, Lightbulb, CheckCircle } from 'lucide-react';

interface RequirementsDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementsDoc: string;
}

interface ParsedSection {
  title: string;
  content: string;
  isJson?: boolean;
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
      return { type: 'json', data: parsed };
    } catch {
      return null;
    }
  };

  const parseStructuredText = (text: string): ParsedSection[] => {
    const sections: ParsedSection[] = [];
    const lines = text.split('\n').map(line => line.trim());
    
    let currentSection: ParsedSection | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      if (line === '需求文档' || line === 'Requirement Meta' || 
          line === 'User Core Thesis' || line === 'Confirmed Insights' || 
          line === '主题') {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line, content: '' };
      } else if (line.startsWith('{')) {
        let jsonContent = line;
        let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        while (i + 1 < lines.length && braceCount > 0) {
          i++;
          jsonContent += '\n' + lines[i];
          braceCount += (lines[i].match(/{/g) || []).length - (lines[i].match(/}/g) || []).length;
        }
        
        if (currentSection) {
          currentSection.content = jsonContent;
          currentSection.isJson = true;
        }
      } else {
        if (currentSection) {
          currentSection.content += (currentSection.content ? '\n' : '') + line;
        }
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  const requirements = parseRequirements();
  const structuredSections = !requirements ? parseStructuredText(requirementsDoc) : null;

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
            {requirements && requirements.type === 'json' ? (
              <>
                {/* JSON 格式的需求文档 */}
                {requirements.data.topic && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-bold">主题</h3>
                    </div>
                    <p className="text-base leading-relaxed bg-primary/5 p-4 rounded-lg">
                      {requirements.data.topic}
                    </p>
                  </div>
                )}

                <Separator />

                {requirements.data.goal && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">目标</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {requirements.data.goal}
                    </p>
                  </div>
                )}

                {requirements.data.key_dimensions && requirements.data.key_dimensions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">关键维度</h3>
                    <div className="flex flex-wrap gap-2">
                      {requirements.data.key_dimensions.map((dimension: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-sm py-1">
                          {dimension}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(requirements.data.time_range || requirements.data.year_start || requirements.data.year_end) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-bold">时间范围</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requirements.data.time_range || 
                       `${requirements.data.year_start || ''} - ${requirements.data.year_end || ''}`}
                    </p>
                  </div>
                )}

                {requirements.data.target_audience && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-bold">目标受众</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requirements.data.target_audience}
                    </p>
                  </div>
                )}

                {Object.keys(requirements.data).map((key) => {
                  if (['topic', 'goal', 'key_dimensions', 'time_range', 'year_start', 'year_end', 'target_audience'].includes(key)) {
                    return null;
                  }
                  const value = requirements.data[key];
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
            ) : structuredSections && structuredSections.length > 0 ? (
              <>
                {/* 结构化中文标题格式 */}
                {structuredSections.map((section, index) => {
                  let icon: ReactNode = null;
                  let bgColor = '';
                  
                  if (section.title === '需求文档' || section.title === '主题') {
                    icon = <FileText className="w-5 h-5 text-primary" />;
                    bgColor = 'bg-primary/5';
                  } else if (section.title === 'Requirement Meta') {
                    icon = <Settings className="w-5 h-5 text-blue-500" />;
                    bgColor = 'bg-blue-50';
                  } else if (section.title === 'User Core Thesis') {
                    icon = <Lightbulb className="w-5 h-5 text-amber-500" />;
                    bgColor = 'bg-amber-50';
                  } else if (section.title === 'Confirmed Insights') {
                    icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                    bgColor = 'bg-green-50';
                  }
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="text-lg font-bold">{section.title}</h3>
                      </div>
                      
                      {section.isJson ? (
                        <div className={`p-4 rounded-lg ${bgColor}`}>
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                            {section.content}
                          </pre>
                        </div>
                      ) : (
                        <div className={`p-4 rounded-lg ${bgColor}`}>
                          <p className="text-base leading-relaxed whitespace-pre-wrap">
                            {section.content}
                          </p>
                        </div>
                      )}
                      
                      {index < structuredSections.length - 1 && <Separator className="my-4" />}
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
