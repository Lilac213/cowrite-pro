import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import RequirementsDocDialog from './RequirementsDocDialog';

const stages = [
  { key: 'init', label: '开始', progress: 0 },
  { key: 'confirm_brief', label: '明确需求', progress: 12 },
  { key: 'knowledge_selected', label: '资料查询', progress: 24 },
  { key: 'outline_confirmed', label: '文章结构', progress: 36 },
  { key: 'paragraph_structure_confirmed', label: '段落结构', progress: 48 },
  { key: 'drafting', label: '文章生成', progress: 60 },
  { key: 'review_pass_1', label: '内容审校', progress: 75 },
  { key: 'layout_export', label: '排版导出', progress: 90 },
  { key: 'completed', label: '完成', progress: 100 },
];

interface WorkflowProgressProps {
  currentStage: string;
  onStageClick?: (stageKey: string) => void;
  clickable?: boolean;
  requirementsDoc?: string;
}

export default function WorkflowProgress({ 
  currentStage, 
  onStageClick, 
  clickable = false,
  requirementsDoc 
}: WorkflowProgressProps) {
  const current = stages.find((s) => s.key === currentStage) || stages[0];
  const currentIndex = stages.findIndex((s) => s.key === currentStage);
  const [showRequirementsDialog, setShowRequirementsDialog] = useState(false);

  // 只在明确需求阶段之后显示需求文档图标
  const showRequirementsIcon = currentIndex >= 1 && requirementsDoc;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>进度</span>
        <div className="flex items-center gap-4">
          <span>{current.progress}%</span>
          {showRequirementsIcon && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRequirementsDialog(true)}
              className="h-8"
            >
              <FileText className="w-4 h-4 mr-2" />
              需求文档
            </Button>
          )}
        </div>
      </div>
      <Progress value={current.progress} />
      <div className="flex justify-between text-xs text-muted-foreground mt-4">
        {stages.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = stage.key === currentStage;
          const isClickableStage = clickable && (isCompleted || isCurrent);
          
          return (
            <div
              key={stage.key}
              className={`flex flex-col items-center ${
                isClickableStage ? 'cursor-pointer hover:text-primary transition-colors' : ''
              } ${
                index <= currentIndex ? 'text-foreground' : ''
              }`}
              onClick={() => isClickableStage && onStageClick?.(stage.key)}
            >
              <div
                className={`w-2 h-2 rounded-full mb-1 ${
                  index <= currentIndex ? 'bg-primary' : 'bg-muted'
                } ${isClickableStage ? 'hover:scale-125 transition-transform' : ''}`}
              />
              <span className="hidden md:block">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* 需求文档弹窗 */}
      {requirementsDoc && (
        <RequirementsDocDialog
          open={showRequirementsDialog}
          onOpenChange={setShowRequirementsDialog}
          requirementsDoc={requirementsDoc}
        />
      )}
    </div>
  );
}
