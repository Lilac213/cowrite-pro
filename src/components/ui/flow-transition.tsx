import React from 'react';
import { cn } from '@/lib/utils';
import { useFlowTransition, TransitionStage, TransitionConfig, FlowTransitionState } from '@/hooks/use-flow-transition';

export interface FlowTransitionProps {
  /**
   * 阶段列表
   */
  stages: TransitionStage[];
  /**
   * 当前激活的阶段内容
   */
  children: (stage: TransitionStage, index: number) => React.ReactNode;
  /**
   * 过渡配置
   */
  config?: TransitionConfig;
  /**
   * 自定义类名
   */
  className?: string;
  /**
   * 是否显示进度指示器
   */
  showProgress?: boolean;
  /**
   * 进度指示器位置
   */
  progressPosition?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * 自定义进度指示器
   */
  customProgress?: (state: FlowTransitionState) => React.ReactNode;
}

/**
 * 流程过渡组件
 */
export function FlowTransition({
  stages,
  children,
  config,
  className,
  showProgress = true,
  progressPosition = 'top',
  customProgress,
}: FlowTransitionProps) {
  const transition = useFlowTransition(stages, config);
  
  const progressClasses = cn(
    'flex items-center gap-2',
    progressPosition === 'top' && 'mb-4',
    progressPosition === 'bottom' && 'mt-4',
    progressPosition === 'left' && 'flex-col mr-4',
    progressPosition === 'right' && 'flex-col ml-4'
  );
  
  return (
    <div className={cn('relative', className)}>
      {/* 进度指示器 */}
      {showProgress && (
        <div className={progressClasses}>
          {customProgress ? (
            customProgress(transition.state)
          ) : (
            <>
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={cn(
                    'flex items-center gap-2',
                    index === transition.state.currentIndex && 'font-semibold'
                  )}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full transition-all duration-200',
                      index < transition.state.currentIndex && 'bg-green-500',
                      index === transition.state.currentIndex && 'bg-blue-500 scale-125',
                      index > transition.state.currentIndex && 'bg-gray-300'
                    )}
                  />
                  <span className="text-sm">{stage.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      
      {/* 阶段内容 */}
      <div className="relative overflow-hidden">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={cn(
              'absolute inset-0',
              transition.getTransitionClasses(index)
            )}
          >
            {children(stage, index)}
          </div>
        ))}
      </div>
      
      {/* 控制按钮 */}
      <div className="flex justify-between mt-4">
        <button
          onClick={transition.previous}
          disabled={!transition.canGoPrevious}
          className={cn(
            'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200'
          )}
        >
          上一步
        </button>
        
        <button
          onClick={transition.next}
          disabled={!transition.canGoNext}
          className={cn(
            'px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200'
          )}
        >
          下一步
        </button>
      </div>
    </div>
  );
}