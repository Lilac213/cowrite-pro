import { Progress } from '@/components/ui/progress';
import { useState, useEffect } from 'react';
import RequirementsDocDialog from './RequirementsDocDialog';
import { WORKFLOW_STAGES } from '@/constants/workflow';

const stages = WORKFLOW_STAGES;

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

  // 监听打开需求文档弹窗的事件
  useEffect(() => {
    const handleOpenDialog = () => {
      setShowRequirementsDialog(true);
    };
    window.addEventListener('openRequirementsDialog', handleOpenDialog);
    return () => {
      window.removeEventListener('openRequirementsDialog', handleOpenDialog);
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>进度</span>
        <span>{current.progress}%</span>
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
