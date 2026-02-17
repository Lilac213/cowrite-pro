import { cn } from '@/lib/utils';
import { getSemanticColors } from '@/styles/semantic-colors';
import { 
  spacingClasses, 
  sizes, 
  commonCombos,
  getSpacingClass 
} from '@/styles/8pt-grid';
import { ReactNode } from 'react';

export interface SemanticCardProps {
  /**
   * 卡片内容
   */
  children: ReactNode;
  /**
   * 语义类型
   */
  semantic?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';
  /**
   * 变体类型
   */
  variant?: 'elevated' | 'outlined' | 'ghost' | 'filled';
  /**
   * 内边距大小
   */
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
  /**
   * 圆角大小
   */
  radius?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /**
   * 阴影大小
   */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  /**
   * 自定义类名
   */
  className?: string;
  /**
   * 点击事件
   */
  onClick?: () => void;
  /**
   * 是否可交互
   */
  interactive?: boolean;
  /**
   * 是否禁用
   */
  disabled?: boolean;
  /**
   * 悬停效果
   */
  hover?: boolean;
  /**
   * 自定义样式
   */
  style?: React.CSSProperties;
}

/**
 * 语义化卡片组件
 * 提供基于语义和8pt网格系统的卡片设计
 */
export function SemanticCard({
  children,
  semantic = 'neutral',
  variant = 'elevated',
  padding = 'md',
  radius = 'md',
  shadow = 'md',
  className,
  onClick,
  interactive = false,
  disabled = false,
  hover = true,
  style,
}: SemanticCardProps) {
  // 基础样式
  const baseClasses = 'relative overflow-hidden transition-all duration-200';
  
  // 语义颜色
  const semanticClasses = getSemanticColors(semantic);
  
  // 变体样式
  const variantClasses = {
    elevated: `${getSemanticColors(semantic, 'background')} border ${getSemanticColors(semantic, 'border')}`,
    outlined: `bg-transparent border-2 ${getSemanticColors(semantic, 'border')}`,
    ghost: `${getSemanticColors(semantic, 'background')} border border-transparent`,
    filled: `${getSemanticColors(semantic, 'background')} border ${getSemanticColors(semantic, 'border')}`,
  }[variant];
  
  // 内边距
  const paddingClass = spacingClasses[padding];
  
  // 圆角
  const radiusClass = sizes.radius[radius];
  
  // 阴影
  const shadowClass = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    xxl: 'shadow-2xl',
  }[shadow];
  
  // 交互状态
  const interactiveClasses = interactive && !disabled && hover
    ? `${getSemanticColors(semantic, 'hover')} cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]`
    : '';
  
  // 禁用状态
  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : '';
  
  // 状态指示器（可选）
  const statusIndicator = semantic !== 'neutral' && variant === 'elevated' ? (
    <div className={`absolute top-0 left-0 w-1 h-full ${getSemanticColors(semantic, 'background')}`} />
  ) : null;
  
  return (
    <div
      className={cn(
        baseClasses,
        variantClasses,
        paddingClass,
        radiusClass,
        shadowClass,
        interactiveClasses,
        disabledClasses,
        className
      )}
      onClick={!disabled ? onClick : undefined}
      style={style}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {statusIndicator}
      {children}
    </div>
  );
}

/**
 * 卡片头部组件
 */
export interface CardHeaderProps {
  /**
   * 头部内容
   */
  children: ReactNode;
  /**
   * 语义类型
   */
  semantic?: SemanticCardProps['semantic'];
  /**
   * 内边距
   */
  padding?: SemanticCardProps['padding'];
  /**
   * 底部边框
   */
  border?: boolean;
  /**
   * 自定义类名
   */
  className?: string;
}

export function CardHeader({
  children,
  semantic = 'neutral',
  padding = 'md',
  border = true,
  className,
}: CardHeaderProps) {
  const borderClass = border 
    ? `border-b ${getSemanticColors(semantic, 'border')}` 
    : '';
  
  return (
    <div className={cn(
      spacingClasses[padding],
      borderClass,
      className
    )}>
      {children}
    </div>
  );
}

/**
 * 卡片内容组件
 */
export interface CardContentProps {
  /**
   * 内容
   */
  children: ReactNode;
  /**
   * 内边距
   */
  padding?: SemanticCardProps['padding'];
  /**
   * 语义类型
   */
  semantic?: SemanticCardProps['semantic'];
  /**
   * 自定义类名
   */
  className?: string;
}

export function CardContent({
  children,
  padding = 'md',
  semantic = 'neutral',
  className,
}: CardContentProps) {
  return (
    <div className={cn(
      spacingClasses[padding],
      getSemanticColors(semantic, 'text'),
      className
    )}>
      {children}
    </div>
  );
}

/**
 * 卡片底部组件
 */
export interface CardFooterProps {
  /**
   * 底部内容
   */
  children: ReactNode;
  /**
   * 语义类型
   */
  semantic?: SemanticCardProps['semantic'];
  /**
   * 内边距
   */
  padding?: SemanticCardProps['padding'];
  /**
   * 顶部边框
   */
  border?: boolean;
  /**
   * 内容对齐
   */
  align?: 'left' | 'center' | 'right' | 'between';
  /**
   * 自定义类名
   */
  className?: string;
}

export function CardFooter({
  children,
  semantic = 'neutral',
  padding = 'md',
  border = true,
  align = 'right',
  className,
}: CardFooterProps) {
  const borderClass = border 
    ? `border-t ${getSemanticColors(semantic, 'border')}` 
    : '';
  
  const alignClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  }[align];
  
  return (
    <div className={cn(
      spacingClasses[padding],
      borderClass,
      `flex ${alignClass} items-center gap-2`,
      className
    )}>
      {children}
    </div>
  );
}

/**
 * 卡片标题组件
 */
export interface CardTitleProps {
  /**
   * 标题文本
   */
  children: ReactNode;
  /**
   * 标题等级
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * 语义类型
   */
  semantic?: SemanticCardProps['semantic'];
  /**
   * 自定义类名
   */
  className?: string;
}

export function CardTitle({
  children,
  level = 3,
  semantic = 'neutral',
  className,
}: CardTitleProps) {
  const textSize = {
    1: 'text-2xl',
    2: 'text-xl',
    3: 'text-lg',
    4: 'text-base',
    5: 'text-sm',
    6: 'text-xs',
  }[level];
  
  const Tag = `h${level}` as any;
  
  return (
    <Tag className={cn(
      textSize,
      'font-semibold',
      getSemanticColors(semantic, 'text'),
      'mb-2',
      className
    )}>
      {children}
    </Tag>
  );
}

/**
 * 卡片描述组件
 */
export interface CardDescriptionProps {
  /**
   * 描述内容
   */
  children: ReactNode;
  /**
   * 语义类型
   */
  semantic?: SemanticCardProps['semantic'];
  /**
   * 自定义类名
   */
  className?: string;
}

export function CardDescription({
  children,
  semantic = 'neutral',
  className,
}: CardDescriptionProps) {
  return (
    <p className={cn(
      'text-sm',
      semantic === 'neutral' ? 'text-gray-600 dark:text-gray-400' : getSemanticColors(semantic, 'text'),
      className
    )}>
      {children}
    </p>
  );
}

/**
 * 预设的卡片样式组合
 */
export const cardPresets = {
  // 信息卡片
  info: {
    semantic: 'info' as const,
    variant: 'elevated' as const,
    padding: 'md' as const,
    radius: 'lg' as const,
    shadow: 'md' as const,
  },
  
  // 成功卡片
  success: {
    semantic: 'success' as const,
    variant: 'elevated' as const,
    padding: 'md' as const,
    radius: 'lg' as const,
    shadow: 'md' as const,
  },
  
  // 警告卡片
  warning: {
    semantic: 'warning' as const,
    variant: 'elevated' as const,
    padding: 'md' as const,
    radius: 'lg' as const,
    shadow: 'md' as const,
  },
  
  // 错误卡片
  error: {
    semantic: 'error' as const,
    variant: 'elevated' as const,
    padding: 'md' as const,
    radius: 'lg' as const,
    shadow: 'md' as const,
  },
  
  // 主要卡片
  primary: {
    semantic: 'primary' as const,
    variant: 'elevated' as const,
    padding: 'lg' as const,
    radius: 'xl' as const,
    shadow: 'lg' as const,
  },
  
  // 紧凑卡片
  compact: {
    semantic: 'neutral' as const,
    variant: 'outlined' as const,
    padding: 'sm' as const,
    radius: 'md' as const,
    shadow: 'sm' as const,
  },
  
  // 大卡片
  large: {
    semantic: 'neutral' as const,
    variant: 'elevated' as const,
    padding: 'xl' as const,
    radius: 'xl' as const,
    shadow: 'xl' as const,
  },
};

/**
 * 快速创建卡片的辅助函数
 */
export function createCardPreset(
  preset: keyof typeof cardPresets,
  overrides?: Partial<SemanticCardProps>
) {
  return {
    ...cardPresets[preset],
    ...overrides,
  };
}