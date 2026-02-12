import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, User, Heart, Sparkles } from 'lucide-react';
import type { ParagraphGuidance } from '@/types';

interface DraftGuidanceProps {
  guidance: ParagraphGuidance[];
  activeParagraphId?: string;
}

export default function DraftGuidance({ guidance, activeParagraphId }: DraftGuidanceProps) {
  // Find guidance for active paragraph or show all if none selected
  const displayGuidance = activeParagraphId
    ? guidance.filter(g => g.paragraph_id === activeParagraphId)
    : guidance;

  if (displayGuidance.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <Sparkles className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm">暂无生成说明</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {displayGuidance.map((item, index) => (
          <Card key={item.paragraph_id} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                段落 {index + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generation Rationale */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  生成说明
                </div>
                <p className="text-sm text-foreground pl-6">
                  {item.generation_rationale}
                </p>
              </div>

              {/* Personal Content Suggestions */}
              {item.personal_content_suggestions && item.personal_content_suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    建议补充的个人内容
                  </div>
                  <ul className="space-y-1 pl-6">
                    {item.personal_content_suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-foreground list-disc">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Experience Suggestions */}
              {item.experience_suggestions && item.experience_suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Heart className="h-4 w-4" />
                    建议补充的个人经历
                  </div>
                  <ul className="space-y-1 pl-6">
                    {item.experience_suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-foreground list-disc">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collaboration Prompt */}
              {item.collaboration_prompt && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-sm text-foreground italic">
                    💡 {item.collaboration_prompt}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
