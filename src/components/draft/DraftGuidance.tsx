import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Sparkles, MessageSquare } from 'lucide-react';
import type { ParagraphAnnotation, ResearchGap, ResearchInsight } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { refineParagraph } from '@/api/draft.api';
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
  insights?: ResearchInsight[];
  gaps?: ResearchGap[];
  structureResult?: any;
  lastEditedParagraphId?: string;
  lastEditedContent?: string;
  lastEditSource?: 'manual' | 'coach';
}

export default function DraftGuidance({ 
  guidance, 
  activeParagraphId, 
  paragraphContent = '',
  onUpdateParagraph,
  onSaveToLibrary,
  insights = [],
  gaps = [],
  structureResult,
  lastEditedParagraphId,
  lastEditedContent = '',
  lastEditSource
}: DraftGuidanceProps) {
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [caseInput, setCaseInput] = useState('');
  const [checkingIssue, setCheckingIssue] = useState(false);
  const [issueSummary, setIssueSummary] = useState<string | null>(null);
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);

  useEffect(() => {
    setIssueSummary(null);
    setSuggestedFix(null);
    setCaseInput('');
    setCaseDialogOpen(false);
    setSaveConfirmOpen(false);
  }, [activeParagraphId]);

  // Find guidance for active paragraph or show all if none selected
  const displayGuidance = activeParagraphId
    ? guidance.filter(g => g.paragraph_id === activeParagraphId)
    : guidance;

  const paragraphWordCount = paragraphContent.replace(/\s+/g, '').length;
  const paragraphIndex = activeParagraphId ? parseInt(activeParagraphId.replace('P', ''), 10) : 0;
  const currentBlock = structureResult?.argument_blocks?.[Math.max(0, paragraphIndex - 1)];
  const relatedInsights = insights.slice(0, 3);
  const relatedGaps = gaps.slice(0, 2);
  const manualEditActive = lastEditSource === 'manual' && lastEditedParagraphId === activeParagraphId;
  const manualEditContent = manualEditActive ? lastEditedContent : paragraphContent;

  const detectIssues = (text: string) => {
    const issues: string[] = [];
    if (/的[。！？!?]?$/.test(text.trim())) {
      issues.push('句子以“的”结尾，可能缺少宾语或中心词');
    }
    if (/[，,]{2,}/.test(text) || /[。！？!?]{2,}/.test(text)) {
      issues.push('标点重复，可能影响阅读流畅度');
    }
    if (text.length > 0 && !/[。！？!?]$/.test(text.trim())) {
      issues.push('段落结尾缺少句号，建议补全');
    }
    return issues;
  };

  const handleQuickFix = async () => {
    if (!onUpdateParagraph || !manualEditContent || checkingIssue) return;
    setCheckingIssue(true);
    try {
      const result: any = await refineParagraph(
        manualEditContent,
        '请仅修正逻辑不完整或语言不通顺的问题，保持原意，尽量小幅修改。'
      );
      if (result?.refined_content) {
        setSuggestedFix(result.refined_content);
        setIssueSummary(result.explanation || '已完成基础通顺修正');
      } else {
        setIssueSummary('未检测到明显问题');
      }
    } catch (error) {
      setIssueSummary('检测失败，请稍后再试');
    } finally {
      setCheckingIssue(false);
    }
  };

  const applyQuickFix = () => {
    if (suggestedFix && onUpdateParagraph && activeParagraphId) {
      onUpdateParagraph(activeParagraphId, suggestedFix);
      toast.success('已一键修正');
      setSuggestedFix(null);
    }
  };

  const insertCaseIntoParagraph = (caseContent: string) => {
    if (!onUpdateParagraph || !activeParagraphId) return;
    const trimmed = caseContent.trim();
    if (!trimmed) return;
    const text = paragraphContent || '';
    const firstSentenceMatch = text.match(/^[^。！？!?]+[。！？!?]/);
    if (firstSentenceMatch) {
      const insertIndex = firstSentenceMatch[0].length;
      const updated = `${text.slice(0, insertIndex)}\n\n${trimmed}${text.slice(insertIndex)}`;
      onUpdateParagraph(activeParagraphId, updated);
    } else {
      onUpdateParagraph(activeParagraphId, text ? `${text}\n\n${trimmed}` : trimmed);
    }
  };

  const handleCaseConfirm = () => {
    if (!caseInput.trim()) return;
    setCaseDialogOpen(false);
    setSaveConfirmOpen(true);
  };

  const handleSaveDecision = (saveToLibrary: boolean) => {
    if (!caseInput.trim()) return;
    if (saveToLibrary && onSaveToLibrary) {
      onSaveToLibrary(caseInput.trim());
    }
    insertCaseIntoParagraph(caseInput.trim());
    toast.success('已插入个人案例');
    setCaseInput('');
    setSaveConfirmOpen(false);
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
        {activeParagraphId && (
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold tracking-wider text-[10px] uppercase">
                  当前段落内容
                </Badge>
                <span className="text-xs text-slate-400 font-mono ml-auto">
                  #{activeParagraphId} · 字数 {paragraphWordCount}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {paragraphContent || '该段落暂无内容'}
              </p>
            </CardContent>
          </Card>
        )}

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
                {currentBlock && (
                  <div className="mb-3 text-xs text-slate-500">
                    结构基础：{currentBlock.title} · {currentBlock.main_argument}
                  </div>
                )}
                <p className="text-sm text-slate-700 leading-relaxed">
                  {generationRationale}
                </p>

                {relatedInsights.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-bold text-slate-500 uppercase">洞察来源 (INSIGHTS)</span>
                    </div>
                    <div className="space-y-2">
                      {relatedInsights.map((insight) => (
                        <div key={insight.id} className="text-xs text-slate-600">
                          {insight.insight}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
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

                {relatedGaps.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3 w-3 text-slate-500" />
                      <span className="text-xs font-bold text-slate-500 uppercase">空白补足 (GAPS)</span>
                    </div>
                    <div className="space-y-2">
                      {relatedGaps.map((gap) => (
                        <div key={gap.id} className="text-xs text-slate-600">
                          {gap.description || gap.issue}
                        </div>
                      ))}
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

                 {manualEditActive && manualEditContent && (
                   <div className="bg-slate-900/70 rounded-md p-3 border border-slate-800">
                     <div className="text-[11px] text-slate-300 mb-2">基础可读性检查</div>
                     <div className="text-xs text-slate-400">
                       {issueSummary || detectIssues(manualEditContent).join('；') || '暂未发现明显问题'}
                     </div>
                     <div className="mt-3 flex gap-2">
                       <Button
                         size="sm"
                         className="bg-white text-black hover:bg-slate-200 font-bold h-8"
                         onClick={handleQuickFix}
                         disabled={checkingIssue}
                       >
                         {checkingIssue ? '检测中...' : '一键修正'}
                       </Button>
                       {suggestedFix && (
                         <Button
                           size="sm"
                           className="bg-green-600 hover:bg-green-700 text-white h-8"
                           onClick={applyQuickFix}
                         >
                           应用修正
                         </Button>
                       )}
                     </div>
                   </div>
                 )}

                 {personalSuggestions.length > 0 && (
                   <div className="bg-slate-900/70 rounded-md p-3 border border-slate-800 space-y-2">
                     <div className="text-[11px] text-slate-300">个人案例补充提示</div>
                     <div className="text-xs text-slate-400">
                       你可以补充真实经历来增强说服力，例如：
                     </div>
                     <div className="text-xs text-slate-300 space-y-1">
                       <div>1. 这段观点对应的真实场景是什么？</div>
                       <div>2. 当时你遇到的具体问题是什么？</div>
                       <div>3. 你采取了什么行动，结果如何？</div>
                     </div>
                   </div>
                 )}
                 
                 <Button 
                   className="w-full bg-white text-black hover:bg-slate-200 font-bold h-10 transition-transform active:scale-95"
                   onClick={() => setCaseDialogOpen(true)}
                 >
                   <div className="flex items-center gap-2">
                     <div className="bg-black text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">+</div>
                     插入个人案例
                   </div>
                 </Button>

                 <AlertDialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>填写个人案例</AlertDialogTitle>
                     </AlertDialogHeader>
                     <Textarea
                       value={caseInput}
                       onChange={(e) => setCaseInput(e.target.value)}
                       placeholder="请描述个人案例（背景-过程-结果）"
                       className="min-h-[140px]"
                     />
                     <AlertDialogFooter>
                       <AlertDialogCancel>取消</AlertDialogCancel>
                       <AlertDialogAction onClick={handleCaseConfirm}>下一步</AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>

                 <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>是否加入个人案例库？</AlertDialogTitle>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel onClick={() => handleSaveDecision(false)}>不加入</AlertDialogCancel>
                       <AlertDialogAction onClick={() => handleSaveDecision(true)}>加入并插入</AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
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
