import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { diffWords } from 'diff';
import { generateIssues, getActiveIssues, applyIssue, ignoreIssue, resolveDecisionGuide } from '@/api/issues.api';
import { refineParagraph } from '@/api/draft.api';
import type { Issue } from '@/types';
import { toast } from 'sonner';

interface DecisionGuideState {
  summary: string;
  options: Array<{ type: 'auto_fix' | 'multi_version' | 'manual_edit' }>;
  auto_fix_result?: { rewritten_text: string };
}

interface IssueCoachPanelProps {
  documentId?: string;
  fullContent: string;
  activeParagraphId?: string;
  paragraphContent?: string;
  selectedText?: string;
  annotations: Array<{
    paragraph_id: string;
    paragraph_type: string;
    development_logic: string;
    editing_suggestions: string;
    viewpoint_generation: string;
    char_start?: number;
    char_end?: number;
  }>;
  onReplaceContent: (content: string) => void;
  onUpdateParagraph: (paragraphId: string, content: string) => void;
  onRemoveAnnotation: (paragraphId: string) => void;
  onHighlightRange: (paragraphId: string, start?: number, end?: number) => void;
  onPushUndo: () => void;
  onUndo: () => void;
  undoAvailable: boolean;
}

const severityStyle: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600'
};

export default function IssueCoachPanel({
  documentId,
  fullContent,
  activeParagraphId,
  paragraphContent,
  selectedText,
  annotations,
  onReplaceContent,
  onUpdateParagraph,
  onRemoveAnnotation,
  onHighlightRange,
  onPushUndo,
  onUndo,
  undoAvailable
}: IssueCoachPanelProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [decisionGuide, setDecisionGuide] = useState<DecisionGuideState | null>(null);
  const [diffIssue, setDiffIssue] = useState<Issue | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertText, setInsertText] = useState('');
  const [autoFixOpen, setAutoFixOpen] = useState(false);
  const [lowIntervention, setLowIntervention] = useState(false);
  const [ignoreCount, setIgnoreCount] = useState(0);
  const [coachHintVisible, setCoachHintVisible] = useState(false);
  const [consecutiveRejects, setConsecutiveRejects] = useState(0);
  const [decisionPromptVisible, setDecisionPromptVisible] = useState(false);
  const [annotationFixes, setAnnotationFixes] = useState<Record<string, string>>({});
  const [diffAnnotation, setDiffAnnotation] = useState<{
    paragraphId: string;
    targetText: string;
    suggestedFix: string;
  } | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const coachTimerRef = useRef<number | undefined>(undefined);

  const logAgentEvent = (agent: string, condition: string, action: string, status: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[AgentLog] ${timestamp} | ${agent} | ${condition} | ${action} | ${status}`);
  };

  const refreshIssues = async () => {
    if (!documentId) return;
    const result: any = await getActiveIssues(documentId);
    if (result?.issues) {
      setIssues(result.issues as Issue[]);
      setLowIntervention(Boolean(result.low_intervention));
      setIgnoreCount(result.ignore_count || 0);
    }
  };

  useEffect(() => {
    refreshIssues();
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !activeParagraphId || !paragraphContent) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        await generateIssues({
          document_id: documentId,
          content: paragraphContent,
          paragraph_id: activeParagraphId,
          agent: 'live',
          stage: 'draft'
        });
        await refreshIssues();
      } catch (error) {
        toast.error('生成句子级建议失败');
      }
    }, 800);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [documentId, activeParagraphId, paragraphContent]);

  useEffect(() => {
    if (coachTimerRef.current) window.clearTimeout(coachTimerRef.current);
    const activeAnnotation = annotations.find(a => a.paragraph_id === activeParagraphId);
    if (!activeAnnotation || !activeAnnotation.editing_suggestions || activeAnnotation.editing_suggestions === '无建议') {
      setCoachHintVisible(false);
      logAgentEvent('coach', 'editing_suggestions为空', '未触发提示', '静默失效');
      return;
    }
    coachTimerRef.current = window.setTimeout(() => {
      setCoachHintVisible(true);
      logAgentEvent('coach', '停留>3s且有编辑建议', '推送提示', '触发');
    }, 3000);
    return () => {
      if (coachTimerRef.current) window.clearTimeout(coachTimerRef.current);
    };
  }, [activeParagraphId, annotations]);

  useEffect(() => {
    if (consecutiveRejects >= 3) {
      setDecisionPromptVisible(true);
      logAgentEvent('decision', '连续拒绝>=3', '展示决策引导', '触发');
    }
  }, [consecutiveRejects]);

  useEffect(() => {
    if (!documentId || !selectedText || !selectedText.trim()) return;
    generateIssues({
      document_id: documentId,
      content: selectedText,
      selection: selectedText,
      paragraph_id: activeParagraphId,
      agent: 'live',
      stage: 'draft'
    }).then(refreshIssues).catch(() => toast.error('生成选中文本建议失败'));
  }, [selectedText, documentId, activeParagraphId]);

  const handleAnalyzeStructure = async () => {
    if (!documentId || !fullContent) return;
    setLoading(true);
    try {
      await generateIssues({
        document_id: documentId,
        content: fullContent,
        paragraph_id: activeParagraphId,
        agent: 'coach',
        stage: 'draft'
      });
      await refreshIssues();
    } catch (error) {
      toast.error('结构分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async (issueId: string) => {
    if (!documentId) return;
    setIssues(prev => prev.filter(issue => issue.id !== issueId));
    await ignoreIssue({ document_id: documentId, issue_id: issueId });
    await refreshIssues();
    setConsecutiveRejects(prev => prev + 1);
    logAgentEvent('live', '点击忽略', '忽略建议', '用户拒绝');
  };

  const handleApply = async (issue: Issue) => {
    if (!documentId) return;
    if (!issue.suggested_fix) {
      toast.error('该问题暂无可用修正');
      return;
    }
    const patched = issue.target_text ? applyDiffPatch(fullContent, issue.target_text, issue.suggested_fix) : null;
    if (!patched) {
      toast.error('无法定位变更句');
      logAgentEvent('live', 'diff定位失败', '应用修正', '失败');
      return;
    }
    onPushUndo();
    const result: any = await applyIssue({
      document_id: documentId,
      issue_id: issue.id,
      content: fullContent
    });
    if (result?.new_content) {
      setIssues(prev => prev.filter(item => item.id !== issue.id));
      onReplaceContent(result.new_content === patched.newContent ? result.new_content : patched.newContent);
      await refreshIssues();
      toast.success('已应用修正');
      logAgentEvent('live', '点击一键修正', '应用修正', '成功');
    }
  };

  const handleDecisionGuide = async (mode: 'normal' | 'auto_fix' = 'normal') => {
    if (!documentId) return;
    const payloadIssues = issues.map(issue => ({
      type: issue.type,
      severity: issue.severity,
      suggestion_text: issue.suggestion_text
    }));
    const result: any = await resolveDecisionGuide({
      document_id: documentId,
      content: fullContent,
      issues: payloadIssues,
      mode
    });
    if (result?.summary) {
      setDecisionGuide(result);
    }
  };

  const isStructureIssue = (issue: Issue) => ['structure', 'logic', 'argument'].includes(issue.type);

  const diffPreview = useMemo(() => {
    if (diffAnnotation) {
      return diffWords(diffAnnotation.targetText, diffAnnotation.suggestedFix);
    }
    if (!diffIssue || !diffIssue.suggested_fix || !diffIssue.target_text) return [];
    return diffWords(diffIssue.target_text, diffIssue.suggested_fix);
  }, [diffIssue, diffAnnotation]);

  const handleInsertSupplement = () => {
    if (!activeParagraphId) return;
    if (!insertText.trim()) return;
    onUpdateParagraph(activeParagraphId, `${paragraphContent || ''}\n\n${insertText.trim()}`);
    setInsertText('');
    setInsertOpen(false);
    toast.success('已补充到正文');
  };

  const applyDiffPatch = (content: string, targetText: string, suggestedFix: string) => {
    const index = content.indexOf(targetText);
    if (index < 0) return null;
    const before = content.slice(0, index);
    const after = content.slice(index + targetText.length);
    const diff = diffWords(targetText, suggestedFix);
    const patched = diff.map(part => (part.added ? part.value : part.removed ? '' : part.value)).join('');
    const newContent = `${before}${patched}${after}`;
    if (content.slice(0, index) !== before || content.slice(index + targetText.length) !== after) {
      return null;
    }
    return { newContent, diff };
  };

  const handleAnnotationFix = async (paragraphId: string, instruction: string) => {
    if (!paragraphContent) return;
    const targetText = paragraphContent;
    const result: any = await refineParagraph(targetText, instruction, fullContent);
    if (!result?.refined_content) {
      toast.error('修正生成失败');
      return;
    }
    const suggestedFix = result.refined_content;
    setAnnotationFixes(prev => ({ ...prev, [paragraphId]: suggestedFix }));
    const patched = applyDiffPatch(fullContent, targetText, suggestedFix);
    if (!patched) {
      toast.error('修正应用失败');
      return;
    }
    onPushUndo();
    onReplaceContent(patched.newContent);
    onRemoveAnnotation(paragraphId);
    setConsecutiveRejects(0);
    logAgentEvent('coach', '点击一键修正', '应用修正', '成功');
  };

  const handleAnnotationDiff = async (paragraphId: string, instruction: string) => {
    if (!paragraphContent) return;
    const cached = annotationFixes[paragraphId];
    if (cached) {
      setDiffAnnotation({ paragraphId, targetText: paragraphContent, suggestedFix: cached });
      return;
    }
    const result: any = await refineParagraph(paragraphContent, instruction, fullContent);
    if (!result?.refined_content) {
      toast.error('Diff 生成失败');
      return;
    }
    setAnnotationFixes(prev => ({ ...prev, [paragraphId]: result.refined_content }));
    setDiffAnnotation({ paragraphId, targetText: paragraphContent, suggestedFix: result.refined_content });
  };

  const decisionSummary = decisionGuide?.summary || '';
  const decisionAutoFix = decisionGuide?.auto_fix_result?.rewritten_text || '';
  const activeAnnotation = annotations.find(a => a.paragraph_id === activeParagraphId);
  const annotationCount = annotations.length;
  const issueCount = issues.length;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold tracking-wider text-[10px] uppercase">
                当前段落定位
              </Badge>
              <span className="text-xs text-slate-400 font-mono ml-auto">{activeParagraphId || '--'}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xs text-slate-500">
              当前段落已选中，点击注释卡片可定位并高亮对应文本范围。
            </div>
          </CardContent>
        </Card>

        {activeAnnotation && (
          <Card
            className="border border-slate-200 shadow-sm transition-all duration-200 cursor-pointer"
            onClick={() => onHighlightRange(activeAnnotation.paragraph_id, activeAnnotation.char_start, activeAnnotation.char_end)}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px] uppercase">
                  段落注释
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {activeAnnotation.paragraph_type}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {activeAnnotation.viewpoint_generation}
                </Badge>
                <span className="text-[11px] text-slate-400 ml-auto">
                  {activeAnnotation.paragraph_id}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">发展逻辑</div>
                <div className="text-sm text-slate-700 line-clamp-3">
                  {activeAnnotation.development_logic}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">编辑建议</div>
                <div className="text-sm text-slate-700 line-clamp-3">
                  {activeAnnotation.editing_suggestions}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAnnotationFix(activeAnnotation.paragraph_id, activeAnnotation.editing_suggestions);
                  }}
                >
                  一键修正
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAnnotationDiff(activeAnnotation.paragraph_id, activeAnnotation.editing_suggestions);
                  }}
                >
                  查看 diff
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveAnnotation(activeAnnotation.paragraph_id);
                    setConsecutiveRejects(prev => prev + 1);
                    logAgentEvent('coach', '点击忽略', '忽略建议', '用户拒绝');
                  }}
                >
                  忽略
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline" className="text-[10px] text-slate-500">
            注释卡片 {annotationCount}
          </Badge>
          <Badge variant="outline" className="text-[10px] text-slate-500">
            建议卡片 {issueCount}
          </Badge>
          {undoAvailable && (
            <Button size="sm" variant="outline" onClick={onUndo}>
              撤销修正
            </Button>
          )}
        </div>

        {coachHintVisible && (
          <Card className="border border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="px-4 py-3 text-sm text-amber-700">
              已检测到段落编辑建议，点击卡片查看详细指引。
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 transition-all duration-200">
          <Button size="sm" variant="outline" onClick={handleAnalyzeStructure} disabled={loading}>
            {loading ? '分析中...' : '分析结构'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDecisionGuide('normal')}>
            优化全部
          </Button>
          {lowIntervention && (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              低干预模式 · 已忽略 {ignoreCount}
            </Badge>
          )}
        </div>

        {decisionPromptVisible && (
          <Card className="border border-slate-200 shadow-sm transition-all duration-200">
            <CardHeader className="pb-2 pt-3 px-4">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px] uppercase">
                决策引导
              </Badge>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="text-sm text-slate-700">已连续拒绝 3 次修正，是否坚持原案或寻求替代方案？</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDecisionPromptVisible(false);
                    setConsecutiveRejects(0);
                    logAgentEvent('decision', '用户坚持原案', '关闭决策引导', '完成');
                  }}
                >
                  坚持原案
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDecisionPromptVisible(false);
                    setConsecutiveRejects(0);
                    handleDecisionGuide('normal');
                    logAgentEvent('decision', '寻求替代方案', '触发决策引导', '完成');
                  }}
                >
                  寻求替代方案
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {issues.map(issue => (
            <Card
              key={issue.id}
              className="border border-slate-200 shadow-sm transition-all duration-200 cursor-pointer"
              onClick={() => {
                const annotation = annotations.find(a => a.paragraph_id === issue.paragraph_id);
                if (annotation) {
                  onHighlightRange(annotation.paragraph_id, annotation.char_start, annotation.char_end);
                }
              }}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={severityStyle[issue.severity] || 'bg-slate-100 text-slate-600'}>
                    {issue.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {issue.type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {issue.scope}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {issue.source_agent}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="text-sm text-slate-700">{issue.suggestion_text}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApply(issue)} disabled={!issue.suggested_fix}>
                    一键修正
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDiffIssue(issue)} disabled={!issue.suggested_fix || !issue.target_text}>
                    查看 diff
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleIgnore(issue.id)}>
                    忽略
                  </Button>
                  {isStructureIssue(issue) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setInsertOpen(true)}>
                        补充
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDecisionGuide('auto_fix')}>
                        重写
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleIgnore(issue.id)}>
                        稍后处理
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {issues.length === 0 && (
            <div className="text-xs text-slate-400">
              {lowIntervention ? '低干预模式下仅展示高优先级建议' : '暂无可用建议'}
            </div>
          )}
        </div>

        {decisionGuide && (
          <Card className="border border-slate-200 shadow-sm transition-all duration-200">
            <CardHeader className="pb-2 pt-3 px-4">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold tracking-wider text-[10px] uppercase">
                决策指导
              </Badge>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="text-sm text-slate-700">{decisionSummary}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAutoFixOpen(true)}>
                  auto_fix
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDecisionGuide('auto_fix')}>
                  multi_version
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast('请手动编辑正文')}>
                  manual_edit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog
        open={diffIssue !== null || diffAnnotation !== null}
        onOpenChange={() => {
          setDiffIssue(null);
          setDiffAnnotation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Diff 预览</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-slate-700 space-y-2 max-h-[50vh] overflow-auto">
            {diffPreview.map((part, index) => (
              <span
                key={index}
                className={
                  part.added ? 'bg-green-100 text-green-700' : part.removed ? 'bg-red-100 text-red-700 line-through' : ''
                }
              >
                {part.value}
              </span>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>关闭</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (diffIssue) {
                  handleApply(diffIssue);
                } else if (diffAnnotation) {
                  const patched = applyDiffPatch(fullContent, diffAnnotation.targetText, diffAnnotation.suggestedFix);
                  if (!patched) {
                    toast.error('修正应用失败');
                    return;
                  }
                  onPushUndo();
                  onReplaceContent(patched.newContent);
                  onRemoveAnnotation(diffAnnotation.paragraphId);
                  setDiffAnnotation(null);
                  logAgentEvent('coach', '点击应用修正', '应用修正', '成功');
                }
              }}
            >
              应用修正
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={insertOpen} onOpenChange={setInsertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>补充内容</AlertDialogTitle>
          </AlertDialogHeader>
          <Textarea
            value={insertText}
            onChange={(e) => setInsertText(e.target.value)}
            placeholder="请输入补充内容"
            className="min-h-[120px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleInsertSupplement}>确认补充</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={autoFixOpen} onOpenChange={setAutoFixOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>是否应用 auto_fix？</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-[50vh] overflow-auto">
            {decisionAutoFix || '未生成可替换版本'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!decisionAutoFix) return;
                onReplaceContent(decisionAutoFix);
                setAutoFixOpen(false);
                setDecisionGuide(null);
              }}
            >
              确认替换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
