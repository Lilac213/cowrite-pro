import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export type FeedbackType = 'loading' | 'success' | 'error' | 'warning' | 'info';

export interface FeedbackState {
  type: FeedbackType;
  message: string;
  duration?: number;
  isLoading?: boolean;
  progress?: number;
}

interface FeedbackOptions {
  duration?: number;
  showProgress?: boolean;
  autoClose?: boolean;
}

/**
 * 统一的反馈管理钩子
 * 提供标准化的加载、成功、错误等反馈状态管理
 */
export function useFeedback() {
  const { toast } = useToast();
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);

  /**
   * 显示加载状态
   */
  const showLoading = useCallback((message: string, options?: FeedbackOptions) => {
    const feedback: FeedbackState = {
      type: 'loading',
      message,
      isLoading: true,
      progress: options?.showProgress ? 0 : undefined,
    };
    
    setFeedbackState(feedback);
    
    // 显示toast通知
    toast({
      title: message,
      duration: options?.duration || 0,
      className: 'loading-toast',
    });
    
    return feedback;
  }, [toast]);

  /**
   * 显示成功状态
   */
  const showSuccess = useCallback((message: string, options?: FeedbackOptions) => {
    const feedback: FeedbackState = {
      type: 'success',
      message,
      duration: options?.duration ?? 3000,
    };
    
    setFeedbackState(feedback);
    
    toast({
      title: '✅ 操作成功',
      description: message,
      duration: options?.duration ?? 3000,
      className: 'success-toast',
    });
    
    // 自动关闭
    if (options?.autoClose !== false) {
      setTimeout(() => {
        setFeedbackState(null);
      }, options?.duration ?? 3000);
    }
  }, [toast]);

  /**
   * 显示错误状态
   */
  const showError = useCallback((message: string, options?: FeedbackOptions) => {
    const feedback: FeedbackState = {
      type: 'error',
      message,
      duration: options?.duration ?? 5000,
    };
    
    setFeedbackState(feedback);
    
    toast({
      title: '❌ 操作失败',
      description: message,
      duration: options?.duration ?? 5000,
      variant: 'destructive',
      className: 'error-toast',
    });
    
    // 自动关闭
    if (options?.autoClose !== false) {
      setTimeout(() => {
        setFeedbackState(null);
      }, options?.duration ?? 5000);
    }
  }, [toast]);

  /**
   * 显示警告状态
   */
  const showWarning = useCallback((message: string, options?: FeedbackOptions) => {
    const feedback: FeedbackState = {
      type: 'warning',
      message,
      duration: options?.duration ?? 4000,
    };
    
    setFeedbackState(feedback);
    
    toast({
      title: '⚠️ 注意',
      description: message,
      duration: options?.duration ?? 4000,
      className: 'warning-toast',
    });
    
    // 自动关闭
    if (options?.autoClose !== false) {
      setTimeout(() => {
        setFeedbackState(null);
      }, options?.duration ?? 4000);
    }
  }, [toast]);

  /**
   * 显示信息状态
   */
  const showInfo = useCallback((message: string, options?: FeedbackOptions) => {
    const feedback: FeedbackState = {
      type: 'info',
      message,
      duration: options?.duration ?? 3000,
    };
    
    setFeedbackState(feedback);
    
    toast({
      title: 'ℹ️ 提示',
      description: message,
      duration: options?.duration ?? 3000,
      className: 'info-toast',
    });
    
    // 自动关闭
    if (options?.autoClose !== false) {
      setTimeout(() => {
        setFeedbackState(null);
      }, options?.duration ?? 3000);
    }
  }, [toast]);

  /**
   * 更新加载进度
   */
  const updateProgress = useCallback((progress: number) => {
    setFeedbackState(prev => {
      if (!prev || prev.type !== 'loading') return prev;
      return { ...prev, progress: Math.min(100, Math.max(0, progress)) };
    });
  }, []);

  /**
   * 隐藏反馈
   */
  const hideFeedback = useCallback(() => {
    setFeedbackState(null);
  }, []);

  /**
   * 包装异步函数，自动处理加载和错误状态
   */
  const withFeedback = useCallback(async <T,>(
    promise: Promise<T>,
    options?: {
      loading?: string;
      success?: string;
      error?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: any) => void;
    }
  ): Promise<T> => {
    const loadingFeedback = options?.loading ? showLoading(options.loading) : null;
    
    try {
      const result = await promise;
      
      if (options?.success) {
        showSuccess(options.success);
      }
      
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error) {
      const errorMessage = options?.error || (error as Error).message || '操作失败';
      showError(errorMessage);
      
      if (options?.onError) {
        options.onError(error);
      }
      
      throw error;
    } finally {
      if (loadingFeedback) {
        hideFeedback();
      }
    }
  }, [showLoading, showSuccess, showError, hideFeedback]);

  return {
    feedbackState,
    showLoading,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    updateProgress,
    hideFeedback,
    withFeedback,
  };
}