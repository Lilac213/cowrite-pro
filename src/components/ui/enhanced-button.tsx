import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/hooks/use-feedback';

export interface EnhancedButtonProps extends ButtonProps {
  /**
   * 是否显示加载状态
   */
  loading?: boolean;
  /**
   * 加载时的文本
   */
  loadingText?: string;
  /**
   * 是否禁用加载时的点击
   */
  disableOnLoading?: boolean;
  /**
   * 点击时的反馈配置
   */
  feedbackConfig?: {
    loading?: string;
    success?: string;
    error?: string;
    onSuccess?: () => void;
    onError?: (error: any) => void;
  };
  /**
   * 异步点击处理函数
   */
  onAsyncClick?: () => Promise<void>;
}

/**
 * 增强版按钮组件
 * 提供加载状态、自动反馈等增强功能
 */
export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    loading = false,
    loadingText,
    disableOnLoading = true,
    feedbackConfig,
    onAsyncClick,
    onClick,
    children,
    disabled,
    className,
    ...props 
  }, ref) => {
    const { withFeedback } = useFeedback();
    
    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onAsyncClick && feedbackConfig) {
        // 使用反馈包装异步操作
        await withFeedback(
          onAsyncClick(),
          {
            loading: feedbackConfig.loading || '处理中...',
            success: feedbackConfig.success || '操作成功',
            error: feedbackConfig.error || '操作失败',
            onSuccess: feedbackConfig.onSuccess,
            onError: feedbackConfig.onError,
          }
        );
      } else if (onClick) {
        // 同步操作直接调用
        onClick(e);
      }
    };
    
    const isActuallyLoading = loading || (disableOnLoading && disabled);
    const isActuallyDisabled = disabled || (disableOnLoading && loading);
    
    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isActuallyDisabled}
        className={cn(
          'relative transition-all duration-200',
          isActuallyLoading && 'opacity-80 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {/* 加载指示器 */}
        {isActuallyLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        
        {/* 按钮内容 */}
        <span className={cn(
          'flex items-center gap-2 transition-opacity',
          isActuallyLoading && 'opacity-0'
        )}>
          {isActuallyLoading && loadingText ? loadingText : children}
        </span>
      </Button>
    );
  }
);

EnhancedButton.displayName = 'EnhancedButton';

/**
 * 操作反馈按钮 - 专门用于需要用户反馈的操作
 */
export interface ActionFeedbackButtonProps extends Omit<EnhancedButtonProps, 'feedbackConfig' | 'onAsyncClick'> {
  /**
   * 操作类型，用于生成默认反馈消息
   */
  actionType?: 'save' | 'generate' | 'search' | 'sync' | 'delete' | 'update';
  /**
   * 自定义反馈消息
   */
  feedbackMessages?: {
    loading?: string;
    success?: string;
    error?: string;
  };
  /**
   * 异步操作函数
   */
  asyncAction: () => Promise<void>;
}

/**
 * 预设的操作反馈按钮
 * 根据操作类型提供合适的默认反馈
 */
export const ActionFeedbackButton = forwardRef<HTMLButtonElement, ActionFeedbackButtonProps>(
  ({ 
    actionType = 'save',
    feedbackMessages = {},
    asyncAction,
    children,
    ...props 
  }, ref) => {
    
    // 根据操作类型生成默认消息
    const getDefaultMessages = () => {
      switch (actionType) {
        case 'save':
          return {
            loading: '正在保存...',
            success: '保存成功',
            error: '保存失败',
          };
        case 'generate':
          return {
            loading: '正在生成...',
            success: '生成成功',
            error: '生成失败',
          };
        case 'search':
          return {
            loading: '正在搜索...',
            success: '搜索完成',
            error: '搜索失败',
          };
        case 'sync':
          return {
            loading: '正在同步...',
            success: '同步成功',
            error: '同步失败',
          };
        case 'delete':
          return {
            loading: '正在删除...',
            success: '删除成功',
            error: '删除失败',
          };
        case 'update':
          return {
            loading: '正在更新...',
            success: '更新成功',
            error: '更新失败',
          };
        default:
          return {
            loading: '处理中...',
            success: '操作成功',
            error: '操作失败',
          };
      }
    };
    
    const defaultMessages = getDefaultMessages();
    const finalMessages = {
      loading: feedbackMessages.loading || defaultMessages.loading,
      success: feedbackMessages.success || defaultMessages.success,
      error: feedbackMessages.error || defaultMessages.error,
    };
    
    return (
      <EnhancedButton
        ref={ref}
        onAsyncClick={asyncAction}
        feedbackConfig={finalMessages}
        {...props}
      >
        {children}
      </EnhancedButton>
    );
  }
);

ActionFeedbackButton.displayName = 'ActionFeedbackButton';