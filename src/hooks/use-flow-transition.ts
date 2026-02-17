import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * 过渡阶段定义
 */
export interface TransitionStage {
  /**
   * 阶段ID
   */
  id: string;
  /**
   * 阶段名称
   */
  name: string;
  /**
   * 阶段描述
   */
  description?: string;
  /**
   * 是否可跳过
   */
  skippable?: boolean;
  /**
   * 自定义数据
   */
  data?: any;
}

/**
 * 预加载配置
 */
export interface PreloadConfig {
  /**
   * 是否启用预加载
   */
  enabled?: boolean;
  /**
   * 预加载提前量（提前几个阶段开始预加载）
   */
  lookahead?: number;
  /**
   * 预加载延迟（毫秒）
   */
  delay?: number;
  /**
   * 预加载函数
   */
  preloadFn?: (stage: TransitionStage, index: number) => Promise<void>;
  /**
   * 重试次数
   */
  retryCount?: number;
  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;
}

/**
 * 过渡配置
 */
export interface TransitionConfig {
  /**
   * 过渡持续时间 (毫秒)
   */
  duration?: number;
  /**
   * 过渡类型
   */
  type?: 'slide' | 'fade' | 'scale' | 'rotate' | 'flip' | 'zoom';
  /**
   * 方向
   */
  direction?: 'left' | 'right' | 'up' | 'down';
  /**
   * 缓动函数
   */
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  /**
   * 是否启用硬件加速
   */
  hardwareAcceleration?: boolean;
  /**
   * 自定义类名
   */
  className?: string;
  /**
   * 预加载配置
   */
  preload?: PreloadConfig;
}

/**
 * 流程过渡状态
 */
export interface FlowTransitionState {
  /**
   * 当前阶段索引
   */
  currentIndex: number;
  /**
   * 当前阶段
   */
  currentStage: TransitionStage | null;
  /**
   * 过渡状态
   */
  status: 'idle' | 'transitioning' | 'completed';
  /**
   * 方向
   */
  direction: 'forward' | 'backward' | 'none';
  /**
   * 进度
   */
  progress: number;
}

/**
 * 流程过渡Hook
 */
export function useFlowTransition(
  stages: TransitionStage[],
  config: TransitionConfig = {}
) {
  const {
    duration = 300,
    type = 'slide',
    direction = 'left',
    easing = 'ease-in-out',
    hardwareAcceleration = true,
    preload = {
      enabled: false,
      lookahead: 1,
      delay: 100,
      retryCount: 3,
      retryDelay: 1000,
    },
  } = config;

  const [state, setState] = useState<FlowTransitionState>({
    currentIndex: 0,
    currentStage: stages[0] || null,
    status: 'idle',
    direction: 'none',
    progress: 0,
  });

  const [preloadedStages, setPreloadedStages] = useState<Set<number>>(new Set());
  const preloadTimeoutRef = useRef<any>(null);
  const transitionTimeoutRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  /**
   * 开始过渡动画
   */
  const startTransition = useCallback((
    newIndex: number,
    transitionDirection: 'forward' | 'backward'
  ) => {
    // 清除之前的定时器
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setState(prev => ({
      ...prev,
      status: 'transitioning',
      direction: transitionDirection,
      progress: 0,
    }));

    // 进度动画
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setState(prev => ({ ...prev, progress }));
      
      if (progress >= 1) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
    }, 16);

    // 完成过渡
    transitionTimeoutRef.current = setTimeout(() => {
      setState({
        currentIndex: newIndex,
        currentStage: stages[newIndex] || null,
        status: 'idle',
        direction: 'none',
        progress: 0,
      });
      
      // 触发智能预加载
      smartPreload(newIndex);
    }, duration);
  }, [stages, duration]);

  /**
   * 预加载阶段数据
   */
  const preloadStage = useCallback(async (index: number) => {
    if (!preload.enabled || !preload.preloadFn) return;
    if (preloadedStages.has(index)) return;
    if (index >= stages.length) return;

    const stage = stages[index];
    if (!stage) return;

    try {
      // 延迟预加载，避免阻塞当前操作
      if (preload.delay && preload.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, preload.delay));
      }

      // 重试机制
      let retryCount = 0;
      const maxRetries = preload.retryCount || 3;
      
      while (retryCount < maxRetries) {
        try {
          await preload.preloadFn(stage, index);
          setPreloadedStages(prev => new Set([...prev, index]));
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.warn(`预加载阶段 ${stage.name} 失败:`, error);
            break;
          }
          // 重试延迟
          if (preload.retryDelay && preload.retryDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, preload.retryDelay));
          }
        }
      }
    } catch (error) {
      console.warn(`预加载阶段 ${stage.name} 失败:`, error);
    }
  }, [preload, stages, preloadedStages]);

  /**
   * 智能预加载
   */
  const smartPreload = useCallback((currentIndex: number) => {
    if (!preload.enabled) return;

    // 清除之前的预加载定时器
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // 预加载后续阶段
    const lookahead = preload.lookahead || 1;
    for (let i = 1; i <= lookahead; i++) {
      const targetIndex = currentIndex + i;
      if (targetIndex < stages.length) {
        preloadTimeoutRef.current = setTimeout(() => {
          preloadStage(targetIndex);
        }, i * 100); // 错开预加载时间，避免同时加载
      }
    }
  }, [preload, stages, preloadStage]);

  /**
   * 进入下一阶段
   */
  const next = useCallback(() => {
    if (state.status === 'transitioning') return;
    
    const nextIndex = state.currentIndex + 1;
    if (nextIndex < stages.length) {
      startTransition(nextIndex, 'forward');
    }
  }, [state.currentIndex, state.status, stages.length, startTransition]);

  /**
   * 返回上一阶段
   */
  const previous = useCallback(() => {
    if (state.status === 'transitioning') return;
    
    const prevIndex = state.currentIndex - 1;
    if (prevIndex >= 0) {
      startTransition(prevIndex, 'backward');
    }
  }, [state.currentIndex, state.status, startTransition]);

  /**
   * 跳转到指定阶段
   */
  const goTo = useCallback((index: number) => {
    if (state.status === 'transitioning') return;
    if (index < 0 || index >= stages.length) return;
    if (index === state.currentIndex) return;
    
    const direction = index > state.currentIndex ? 'forward' : 'backward';
    startTransition(index, direction);
  }, [state.currentIndex, state.status, stages.length, startTransition]);

  /**
   * 跳转到指定阶段ID
   */
  const goToStage = useCallback((stageId: string) => {
    const index = stages.findIndex(stage => stage.id === stageId);
    if (index !== -1) {
      goTo(index);
    }
  }, [stages, goTo]);

  /**
   * 重置到第一阶段
   */
  const reset = useCallback(() => {
    if (state.status === 'transitioning') return;
    goTo(0);
  }, [state.status, goTo]);

  /**
   * 完成流程
   */
  const complete = useCallback(() => {
    setState(prev => ({ ...prev, status: 'completed' }));
  }, []);

  /**
   * 是否可以前进
   */
  const canGoNext = state.currentIndex < stages.length - 1 && state.status !== 'transitioning';

  /**
   * 是否可以后退
   */
  const canGoPrevious = state.currentIndex > 0 && state.status !== 'transitioning';

  /**
   * 获取过渡类名
   */
  const getTransitionClasses = useCallback((index: number) => {
    if (state.status !== 'transitioning') {
      return index === state.currentIndex ? 'opacity-100 translate-x-0' : 'opacity-0';
    }

    const isCurrent = index === state.currentIndex;
    const isNext = index === state.currentIndex + 1;
    const isPrevious = index === state.currentIndex - 1;

    let classes = 'transition-all duration-300';
    
    if (hardwareAcceleration) {
      classes += ' transform-gpu';
    }

    switch (type) {
      case 'slide':
        if (isCurrent) {
          classes += state.direction === 'forward' 
            ? ' opacity-0 -translate-x-full' 
            : ' opacity-0 translate-x-full';
        } else if (isNext && state.direction === 'forward') {
          classes += ' opacity-100 translate-x-0';
        } else if (isPrevious && state.direction === 'backward') {
          classes += ' opacity-100 translate-x-0';
        } else {
          classes += ' opacity-0';
        }
        break;
        
      case 'fade':
        if (isCurrent) {
          classes += ' opacity-0';
        } else if (isNext && state.direction === 'forward') {
          classes += ' opacity-100';
        } else if (isPrevious && state.direction === 'backward') {
          classes += ' opacity-100';
        } else {
          classes += ' opacity-0';
        }
        break;
        
      case 'scale':
        if (isCurrent) {
          classes += ' opacity-0 scale-95';
        } else if (isNext && state.direction === 'forward') {
          classes += ' opacity-100 scale-100';
        } else if (isPrevious && state.direction === 'backward') {
          classes += ' opacity-100 scale-100';
        } else {
          classes += ' opacity-0';
        }
        break;
        
      default:
        classes += ' opacity-0';
    }

    return classes;
  }, [state, type, hardwareAcceleration]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  // 初始预加载
  useEffect(() => {
    if (preload.enabled && stages.length > 0) {
      smartPreload(0);
    }
  }, []); // 只在挂载时执行一次

  return {
    // 状态
    state,
    
    // 预加载状态
    preloadedStages,
    isPreloaded: (index: number) => preloadedStages.has(index),
    
    // 控制方法
    next,
    previous,
    goTo,
    goToStage,
    reset,
    complete,
    preloadStage,
    smartPreload,
    
    // 状态检查
    canGoNext,
    canGoPrevious,
    isTransitioning: state.status === 'transitioning',
    isCompleted: state.status === 'completed',
    
    // 工具方法
    getTransitionClasses,
  };
}



/**
 * 智能预加载Hook
 */
export function useSmartPreload<T>(
  loader: () => Promise<T>,
  options: {
    /**
     * 预加载延迟 (毫秒)
     */
    delay?: number;
    /**
     * 是否启用预加载
     */
    enabled?: boolean;
    /**
     * 重试次数
     */
    retryCount?: number;
    /**
     * 重试延迟
     */
    retryDelay?: number;
    /**
     * 成功回调
     */
    onSuccess?: (data: T) => void;
    /**
     * 失败回调
     */
    onError?: (error: Error) => void;
  } = {}
) {
  const {
    delay = 1000,
    enabled = true,
    retryCount = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const retryRef = useRef(0);
  const timeoutRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await loader();
      setData(result);
      setIsLoading(false);
      onSuccess?.(result);
      retryRef.current = 0;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setIsLoading(false);
      
      if (retryRef.current < retryCount) {
        retryRef.current++;
        timeoutRef.current = setTimeout(() => {
          load();
        }, retryDelay * retryRef.current);
      } else {
        onError?.(error);
      }
    }
  }, [loader, enabled, retryCount, retryDelay, onSuccess, onError]);

  const preload = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      load();
    }, delay);
  }, [delay, load]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    preload,
    load,
    cancel,
  };
}