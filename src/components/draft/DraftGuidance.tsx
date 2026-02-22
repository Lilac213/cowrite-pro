import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, User, Heart, Sparkles, MessageSquare } from 'lucide-react';
import type { ParagraphAnnotation } from '@/types';
import CoachingChat from './CoachingChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface DraftGuidanceProps {
  guidance: ParagraphAnnotation[];
  activeParagraphId?: string;
  paragraphContent?: string;
  onUpdateParagraph?: (id: string, content: string) => void;
  onSaveToLibrary?: (content: string) => void;
}

export default function DraftGuidance({ 
  guidance, 
  activeParagraphId, 
  paragraphContent = '',
  onUpdateParagraph,
  onSaveToLibrary
}: DraftGuidanceProps) {
  const [insertTarget, setInsertTarget] = useState<{ key: string; suggestion: string } | null>(null);
  const [insertInput, setInsertInput] = useState('');

  useEffect(() => {
    setInsertTarget(null);
    setInsertInput('');
  }, [activeParagraphId]);

  // Find guidance for active paragraph or show all if none selected
  const displayGuidance = activeParagraphId
    ? guidance.filter(g => g.paragraph_id === activeParagraphId)
    : guidance;

  const handleInsertSuggestion = (key: string, suggestion: string) => {
    if (!activeParagraphId || !onUpdateParagraph) return;

    if (insertTarget?.key === key) {
      const userCase = insertInput.trim();
      if (!userCase) return;

      // Simulate "Analysis & Integration"
      // TODO: Call actual AI agent to integrate the case naturally
      const integratedContent = paragraphContent 
        ? `${paragraphContent}\n\n${userCase}` 
        : userCase;

      onUpdateParagraph(activeParagraphId, integratedContent);
      toast.success('已插入个人经历');
      
      // Trigger "Save to Personal Library" dialog for the raw case content
      if (onSaveToLibrary) {
        onSaveToLibrary(userCase);
      }

      setInsertTarget(null);
      setInsertInput('');
      return;
    }

    setInsertTarget({ key, suggestion });
    setInsertInput('');
  };

  if (displayGuidance.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-6 p-4">
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
            <Sparkles className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium text-slate-400">本段落暂无AI生成说明</p>
            <p className="text-xs text-slate-300 mt-1">您可以在下方直接与AI协作</p>
          </div>

          {activeParagraphId && onUpdateParagraph && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CoachingChat 
                paragraphId={activeParagraphId}
                paragraphContent={paragraphContent}
                onUpdateParagraph={(newContent) => onUpdateParagraph(activeParagraphId, newContent)}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {displayGuidance.map((item) => {
          const isActive = activeParagraphId === item.paragraph_id;
          
          // Map fields if missing
          const generationRationale = item.generation_rationale || item.development_logic;
          const collaborationPrompt = item.collaboration_prompt || item.editing_suggestions;
          const personalSuggestions = item.personal_content_suggestions || [];
          
          if (!isActive) return null; // Only show active paragraph guidance in this new design

          return (
          <div key={item.paragraph_id} className="space-y-4 animate-in fade-in duration-500">
            {/* 1. Logic Analysis Card (Light) */}
            <Card className="border-0 shadow-sm bg-slate-50">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold tracking-wider text-[10px] uppercase">
                    段落逻辑 (LOGIC)
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono ml-auto">#{item.paragraph_id}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {generationRationale}
                </p>
                
                {personalSuggestions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                       <Lightbulb className="h-3 w-3 text-amber-500" />
                       <span className="text-xs font-bold text-slate-500 uppercase">建议补充 (SUGGESTIONS)</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                      <p className="text-sm text-slate-700 italic">
                        "{personalSuggestions[0]}"
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Active Collaboration Card (Dark) */}
            <Card className="border-0 shadow-lg bg-black text-white overflow-hidden relative group">
               <div className="absolute top-0 right-0 p-2">
                 <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
               </div>
               <CardHeader className="pb-2 pt-4 px-4">
                 <Badge variant="outline" className="w-fit border-slate-700 text-slate-300 font-bold tracking-wider text-[10px] uppercase bg-slate-900/50">
                    实时协作 (ACTIVE)
                 </Badge>
               </CardHeader>
               <CardContent className="px-4 pb-6 space-y-4">
                 <div>
                   <h4 className="text-sm font-bold text-white mb-1">激发协作：插入个人视角</h4>
                   <p className="text-xs text-slate-400 leading-relaxed">
                     系统检测到您在前期笔记中提到过相关内容。
                     {collaborationPrompt ? `提示：${collaborationPrompt}` : '点击下方按钮快速插入您的经历。'}
                   </p>
                 </div>
                 
                 <Button 
                   className="w-full bg-white text-black hover:bg-slate-200 font-bold h-10 transition-transform active:scale-95"
                   onClick={() => handleInsertSuggestion(`${item.paragraph_id}-collab`, collaborationPrompt || '我的个人经历...')}
                 >
                   <div className="flex items-center gap-2">
                     <div className="bg-black text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">+</div>
                     插入我的创业亲身经历
                   </div>
                 </Button>

                 {insertTarget?.key === `${item.paragraph_id}-collab` && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <Textarea
                        value={insertInput}
                        onChange={(e) => setInsertInput(e.target.value)}
                        placeholder="描述您的经历（背景-经过-结果）..."
                        className="bg-slate-900 border-slate-800 text-slate-200 text-sm min-h-[100px] placeholder:text-slate-600 focus-visible:ring-slate-700"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => handleInsertSuggestion(`${item.paragraph_id}-collab`, collaborationPrompt || '')}
                      >
                        确认插入并分析
                      </Button>
                    </div>
                 )}
               </CardContent>
            </Card>

            {/* 3. AI Chat Interface */}
            {onUpdateParagraph && (
              <div className="pt-2">
                <CoachingChat 
                  paragraphId={item.paragraph_id}
                  paragraphContent={paragraphContent}
                  onUpdateParagraph={(newContent) => onUpdateParagraph(item.paragraph_id, newContent)}
                />
              </div>
            )}
          </div>
        )})}
      </div>
    </ScrollArea>
  );
}
