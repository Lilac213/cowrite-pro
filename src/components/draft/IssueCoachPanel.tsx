import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { diffWords } from 'diff';
import { generateIssues, getActiveIssues, applyIssue, ignoreIssue, resolveDecisionGuide } from '@/api/issues.api';
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
  onReplaceContent: (content: string) => void;
  onUpdateParagraph: (paragraphId: string, content: string) => void;
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
  onReplaceContent,
  onUpdateParagraph
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
  const debounceRef = useRef<number | undefined>(undefined);

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
    await ignoreIssue({ document_id: documentId, issue_id: issueId });
    await refreshIssues();
  };

  const handleApply = async (issue: Issue) => {
    if (!documentId) return;
    if (!issue.suggested_fix) {
      toast.error('该问题暂无可用修正');
      return;
    }
    const result: any = await applyIssue({
      document_id: documentId,
      issue_id: issue.id,
      content: fullContent
    });
    if (result?.new_content) {
      onReplaceContent(result.new_content);
      await refreshIssues();
      toast.success('已应用修正');
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
    if (!diffIssue || !diffIssue.suggested_fix || !diffIssue.target_text) return [];
    return diffWords(diffIssue.target_text, diffIssue.suggested_fix);
  }, [diffIssue]);

  const handleInsertSupplement = () => {
    if (!activeParagraphId) return;
    if (!insertText.trim()) return;
    onUpdateParagraph(activeParagraphId, `${paragraphContent || ''}\n\n${insertText.trim()}`);
    setInsertText('');
    setInsertOpen(false);
    toast.success('已补充到正文');
  };

  const decisionSummary = decisionGuide?.summary || '';
  const decisionAutoFix = decisionGuide?.auto_fix_result?.rewritten_text || '';

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold tracking-wider text-[10px] uppercase">
                当前段落
              </Badge>
              <span className="text-xs text-slate-400 font-mono ml-auto">{activeParagraphId || '--'}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {paragraphContent || '请选择段落查看'}
            </p>
          </CardContent>
        </Card>

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

        <div className="space-y-3">
          {issues.map(issue => (
            <Card key={issue.id} className="border border-slate-200 shadow-sm transition-all duration-200">
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

      <AlertDialog open={diffIssue !== null} onOpenChange={() => setDiffIssue(null)}>
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
            <AlertDialogAction onClick={() => diffIssue && handleApply(diffIssue)}>
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
