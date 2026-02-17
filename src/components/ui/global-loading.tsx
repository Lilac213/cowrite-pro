import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GlobalLoadingIndicatorProps {
  /**
   * 是否显示
   */
  visible: boolean;
  /**
   * 加载文本
   */
  text?: string;
  /**
   * 进度 (0-100)
   */
  progress?: number;
  /**
   * 类型
   */
  type?: 'loading' | 'success' | 'error' | 'warning' | 'info';
  /**
   * 持续时间 (毫秒)
   */
  duration?: number;
  /**
   * 位置
   */
  position?: 'top' | 'center' | 'bottom';
  /**
   * 大小
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 是否可关闭
   */
  closable?: boolean;
  /**
   * 关闭回调
   */
  onClose?: () => void;
}

/**
 * 全局加载指示器组件
 * 提供统一的加载、成功、错误等状态展示
 */
export function GlobalLoadingIndicator({
  visible,
  text = '处理中...',
  progress,
  type = 'loading',
  duration,
  position = 'center',
  size = 'md',
  closable = false,
  onClose,
}: GlobalLoadingIndicatorProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setIsAnimating(true);
      
      // 自动关闭
      if (duration && duration > 0) {
        const timer = setTimeout(() => {
          setIsAnimating(false);
          setTimeout(() => {
            setIsVisible(false);
            onClose?.();
          }, 300);
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
  }, [visible, duration, onClose]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'loading':
        return <Loader2 className="animate-spin" />;
      case 'success':
        return <CheckCircle2 className="text-green-500" />;
      case 'error':
        return <XCircle className="text-red-500" />;
      case 'warning':
        return <AlertCircle className="text-yellow-500" />;
      case 'info':
        return <Info className="text-blue-500" />;
      default:
        return <Loader2 className="animate-spin" />;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm p-2';
      case 'lg':
        return 'text-lg p-4';
      default:
        return 'text-base p-3';
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      default:
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  return (
    <div
      className={cn(
        'fixed z-50 transition-all duration-300',
        getPositionClasses(),
        isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      )}
    >
      <div
        className={cn(
          'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
          'flex items-center gap-3 min-w-[200px] max-w-[400px]',
          getSizeClasses()
        )}
      >
        {/* 图标 */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        {/* 文本内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
            {text}
          </p>
          
          {/* 进度条 */}
          {progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {progress}%
              </p>
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        {closable && (
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 页面级加载遮罩
 */
export function PageLoadingOverlay({
  visible,
  text = '页面加载中...',
  progress,
  type = 'loading',
}: Omit<GlobalLoadingIndicatorProps, 'position'>) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm mx-4">
        <div className="flex items-center gap-4 mb-4">
          {type === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
          {type === 'success' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          {type === 'error' && <XCircle className="h-6 w-6 text-red-500" />}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {text}
          </h3>
        </div>
        
        {progress !== undefined && (
          <div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
              {progress}% 完成
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 骨架屏加载组件
 */
export function SkeletonLoader({
  count = 1,
  height = 'h-4',
  width = 'w-full',
  className,
}: {
  count?: number;
  height?: string;
  width?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-gray-200 dark:bg-gray-700 rounded animate-pulse',
            height,
            width
          )}
        />
      ))}
    </div>
  );
}