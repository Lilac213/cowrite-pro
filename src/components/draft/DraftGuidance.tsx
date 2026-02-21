import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, User, Heart, Sparkles, MessageSquare } from 'lucide-react';
import type { ParagraphAnnotation } from '@/types';
import CoachingChat from './CoachingChat';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface DraftGuidanceProps {
  guidance: ParagraphAnnotation[];
  activeParagraphId?: string;
  paragraphContent?: string;
  onUpdateParagraph?: (id: string, content: string) => void;
}

export default function DraftGuidance({ 
  guidance, 
  activeParagraphId, 
  paragraphContent = '',
  onUpdateParagraph 
}: DraftGuidanceProps) {
  // Find guidance for active paragraph or show all if none selected
  const displayGuidance = activeParagraphId
    ? guidance.filter(g => g.paragraph_id === activeParagraphId)
    : guidance;

  const handleInsertSuggestion = (suggestion: string) => {
     if (activeParagraphId && onUpdateParagraph) {
        // Append suggestion to current paragraph
        const newContent = paragraphContent ? `${paragraphContent}\n${suggestion}` : suggestion;
        onUpdateParagraph(activeParagraphId, newContent);
        toast.success('已插入建议内容');
     }
  };

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
        {displayGuidance.map((item, index) => {
          const isActive = activeParagraphId === item.paragraph_id;
          
          // Map fields if missing
          const generationRationale = item.generation_rationale || item.development_logic;
          const collaborationPrompt = item.collaboration_prompt || item.editing_suggestions;
          const personalSuggestions = item.personal_content_suggestions || [];
          const experienceSuggestions = item.experience_suggestions || [];

          return (
          <Card key={item.paragraph_id} className={`border-l-4 ${isActive ? 'border-l-primary ring-2 ring-primary/20' : 'border-l-muted'}`}>
            <CardHeader className="pb-3 bg-slate-50/50">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  段落 {item.paragraph_id}
                </div>
                {isActive && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">当前聚焦</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {/* Generation Rationale */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  生成逻辑
                </div>
                <p className="text-sm text-slate-600 pl-6 leading-relaxed bg-slate-50 p-2 rounded">
                  {generationRationale}
                </p>
              </div>

              {/* Personal Content Suggestions */}
              {personalSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <User className="h-4 w-4 text-blue-500" />
                    建议补充 (个人内容)
                  </div>
                  <ul className="space-y-2 pl-6">
                    {personalSuggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-slate-600 list-disc group">
                        <div className="flex flex-col gap-1">
                          <span>{suggestion}</span>
                          {isActive && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-fit h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 -ml-2"
                              onClick={() => handleInsertSuggestion(suggestion)}
                            >
                              + 插入此观点
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Experience Suggestions */}
              {experienceSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Heart className="h-4 w-4 text-rose-500" />
                    建议补充 (个人经历)
                  </div>
                  <ul className="space-y-2 pl-6">
                    {experienceSuggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-slate-600 list-disc group">
                         <div className="flex flex-col gap-1">
                          <span>{suggestion}</span>
                          {isActive && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-fit h-6 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 -ml-2"
                              onClick={() => handleInsertSuggestion(suggestion)}
                            >
                              + 插入此经历
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collaboration Prompt */}
              {collaborationPrompt && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-sm text-foreground italic flex gap-2">
                    <span className="not-italic">💡</span>
                    {collaborationPrompt}
                  </p>
                </div>
              )}

              {/* AI Chat Interface (Only for active paragraph) */}
              {isActive && onUpdateParagraph && (
                <div className="mt-6 pt-4 border-t animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CoachingChat 
                    paragraphId={item.paragraph_id}
                    paragraphContent={paragraphContent}
                    onUpdateParagraph={(newContent) => onUpdateParagraph(item.paragraph_id, newContent)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )})}
      </div>
    </ScrollArea>
  );
}
