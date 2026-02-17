/**
 * 语义化色彩系统
 * 基于功能和语义定义颜色，而非具体的颜色名称
 * 支持亮色和暗色模式
 */

export const semanticColors = {
  // 主色调 - 用于主要交互元素
  primary: {
    light: {
      background: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100',
      focus: 'focus:ring-blue-500',
      gradient: 'from-blue-500 to-blue-600',
    },
    dark: {
      background: 'dark:bg-blue-900',
      text: 'dark:text-blue-400',
      border: 'dark:border-blue-700',
      hover: 'dark:hover:bg-blue-800',
      focus: 'dark:focus:ring-blue-400',
      gradient: 'dark:from-blue-600 dark:to-blue-700',
    },
  },

  // 成功状态 - 用于成功、完成、正面反馈
  success: {
    light: {
      background: 'bg-green-50',
      text: 'text-green-600',
      border: 'border-green-200',
      hover: 'hover:bg-green-100',
      focus: 'focus:ring-green-500',
      gradient: 'from-green-500 to-green-600',
    },
    dark: {
      background: 'dark:bg-green-900',
      text: 'dark:text-green-400',
      border: 'dark:border-green-700',
      hover: 'dark:hover:bg-green-800',
      focus: 'dark:focus:ring-green-400',
      gradient: 'dark:from-green-600 dark:to-green-700',
    },
  },

  // 警告状态 - 用于警告、注意、需要关注
  warning: {
    light: {
      background: 'bg-yellow-50',
      text: 'text-yellow-600',
      border: 'border-yellow-200',
      hover: 'hover:bg-yellow-100',
      focus: 'focus:ring-yellow-500',
      gradient: 'from-yellow-500 to-yellow-600',
    },
    dark: {
      background: 'dark:bg-yellow-900',
      text: 'dark:text-yellow-400',
      border: 'dark:border-yellow-700',
      hover: 'dark:hover:bg-yellow-800',
      focus: 'dark:focus:ring-yellow-400',
      gradient: 'dark:from-yellow-600 dark:to-yellow-700',
    },
  },

  // 错误状态 - 用于错误、失败、负面反馈
  error: {
    light: {
      background: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      hover: 'hover:bg-red-100',
      focus: 'focus:ring-red-500',
      gradient: 'from-red-500 to-red-600',
    },
    dark: {
      background: 'dark:bg-red-900',
      text: 'dark:text-red-400',
      border: 'dark:border-red-700',
      hover: 'dark:hover:bg-red-800',
      focus: 'dark:focus:ring-red-400',
      gradient: 'dark:from-red-600 dark:to-red-700',
    },
  },

  // 信息状态 - 用于信息、提示、中性反馈
  info: {
    light: {
      background: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100',
      focus: 'focus:ring-blue-500',
      gradient: 'from-blue-500 to-blue-600',
    },
    dark: {
      background: 'dark:bg-blue-900',
      text: 'dark:text-blue-400',
      border: 'dark:border-blue-700',
      hover: 'dark:hover:bg-blue-800',
      focus: 'dark:focus:ring-blue-400',
      gradient: 'dark:from-blue-600 dark:to-blue-700',
    },
  },

  // 中性色 - 用于背景、边框、次要元素
  neutral: {
    light: {
      background: 'bg-gray-50',
      text: 'text-gray-600',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-100',
      focus: 'focus:ring-gray-500',
      gradient: 'from-gray-500 to-gray-600',
    },
    dark: {
      background: 'dark:bg-gray-900',
      text: 'dark:text-gray-400',
      border: 'dark:border-gray-700',
      hover: 'dark:hover:bg-gray-800',
      focus: 'dark:focus:ring-gray-400',
      gradient: 'dark:from-gray-600 dark:to-gray-700',
    },
  },

  // 强调色 - 用于需要突出的元素
  accent: {
    light: {
      background: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-200',
      hover: 'hover:bg-purple-100',
      focus: 'focus:ring-purple-500',
      gradient: 'from-purple-500 to-purple-600',
    },
    dark: {
      background: 'dark:bg-purple-900',
      text: 'dark:text-purple-400',
      border: 'dark:border-purple-700',
      hover: 'dark:hover:bg-purple-800',
      focus: 'dark:focus:ring-purple-400',
      gradient: 'dark:from-purple-600 dark:to-purple-700',
    },
  },
};

/**
 * 获取语义化颜色类名
 * @param semantic - 语义类型
 * @param variant - 变体类型
 * @param includeDark - 是否包含暗色模式
 */
export function getSemanticColors(
  semantic: keyof typeof semanticColors,
  variant: 'background' | 'text' | 'border' | 'hover' | 'focus' | 'gradient' = 'background',
  includeDark = true
) {
  const colorSet = semanticColors[semantic];
  const lightClass = colorSet.light[variant];
  const darkClass = includeDark ? colorSet.dark[variant] : '';
  
  return `${lightClass} ${darkClass}`.trim();
}

/**
 * 状态颜色映射
 * 用于根据状态获取对应的颜色
 */
export const statusColors = {
  active: 'primary',
  inactive: 'neutral',
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  pending: 'warning',
  completed: 'success',
  failed: 'error',
  draft: 'neutral',
  published: 'success',
} as const;

/**
 * 根据状态获取颜色
 */
export function getStatusColor(
  status: keyof typeof statusColors,
  variant: 'background' | 'text' | 'border' | 'hover' | 'focus' | 'gradient' = 'background',
  includeDark = true
) {
  const semantic = statusColors[status];
  return getSemanticColors(semantic, variant, includeDark);
}

/**
 * 交互状态颜色
 */
export const interactionColors = {
  // 主要交互
  primary: getSemanticColors('primary'),
  // 次要交互
  secondary: getSemanticColors('neutral'),
  // 危险操作
  danger: getSemanticColors('error'),
  // 成功操作
  success: getSemanticColors('success'),
  // 警告操作
  warning: getSemanticColors('warning'),
  // 信息操作
  info: getSemanticColors('info'),
};

/**
 * 渐变背景颜色
 */
export const gradientColors = {
  primary: 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
  success: 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
  warning: 'bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700',
  error: 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
  accent: 'bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
  neutral: 'bg-gradient-to-r from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700',
};

/**
 * 阴影颜色系统
 */
export const shadowColors = {
  light: 'shadow-sm',
  medium: 'shadow-md',
  large: 'shadow-lg',
  xl: 'shadow-xl',
  primary: 'shadow-blue-500/20',
  success: 'shadow-green-500/20',
  warning: 'shadow-yellow-500/20',
  error: 'shadow-red-500/20',
  accent: 'shadow-purple-500/20',
  neutral: 'shadow-gray-500/20',
};

/**
 * 卡片样式
 */
export const cardStyles = {
  base: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg',
  elevated: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md',
  outlined: 'bg-transparent border-2 border-gray-200 dark:border-gray-700 rounded-lg',
  ghost: 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg',
};

/**
 * 按钮样式
 */
export const buttonStyles = {
  primary: `${getSemanticColors('primary')} hover:${getSemanticColors('primary', 'hover')} focus:${getSemanticColors('primary', 'focus')}`,
  success: `${getSemanticColors('success')} hover:${getSemanticColors('success', 'hover')} focus:${getSemanticColors('success', 'focus')}`,
  warning: `${getSemanticColors('warning')} hover:${getSemanticColors('warning', 'hover')} focus:${getSemanticColors('warning', 'focus')}`,
  error: `${getSemanticColors('error')} hover:${getSemanticColors('error', 'hover')} focus:${getSemanticColors('error', 'focus')}`,
  info: `${getSemanticColors('info')} hover:${getSemanticColors('info', 'hover')} focus:${getSemanticColors('info', 'focus')}`,
  neutral: `${getSemanticColors('neutral')} hover:${getSemanticColors('neutral', 'hover')} focus:${getSemanticColors('neutral', 'focus')}`,
  accent: `${getSemanticColors('accent')} hover:${getSemanticColors('accent', 'hover')} focus:${getSemanticColors('accent', 'focus')}`,
};

/**
 * 文本样式
 */
export const textStyles = {
  primary: getSemanticColors('primary', 'text'),
  success: getSemanticColors('success', 'text'),
  warning: getSemanticColors('warning', 'text'),
  error: getSemanticColors('error', 'text'),
  info: getSemanticColors('info', 'text'),
  neutral: getSemanticColors('neutral', 'text'),
  accent: getSemanticColors('accent', 'text'),
  muted: 'text-gray-500 dark:text-gray-400',
  subtle: 'text-gray-400 dark:text-gray-500',
};