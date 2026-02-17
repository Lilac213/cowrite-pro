/**
 * 8pt 网格系统
 * 基于8像素的倍数进行间距和尺寸设计
 * 提供一致的视觉节奏和层次感
 */

/**
 * 基础间距单位 (8px)
 */
export const BASE_UNIT = 8;

/**
 * 间距等级
 * 每个等级都是8px的倍数
 */
export const spacing = {
  xs: BASE_UNIT * 0.5,   // 4px
  sm: BASE_UNIT * 1,     // 8px
  md: BASE_UNIT * 2,     // 16px
  lg: BASE_UNIT * 3,     // 24px
  xl: BASE_UNIT * 4,     // 32px
  xxl: BASE_UNIT * 6,    // 48px
  xxxl: BASE_UNIT * 8,   // 64px
};

/**
 * Tailwind CSS 间距类名
 */
export const spacingClasses = {
  xs: 'p-0.5',     // 4px
  sm: 'p-1',       // 8px
  md: 'p-2',       // 16px
  lg: 'p-3',       // 24px
  xl: 'p-4',       // 32px
  xxl: 'p-6',      // 48px
  xxxl: 'p-8',     // 64px
};

/**
 * 外边距类名
 */
export const marginClasses = {
  xs: 'm-0.5',     // 4px
  sm: 'm-1',       // 8px
  md: 'm-2',       // 16px
  lg: 'm-3',       // 24px
  xl: 'm-4',       // 32px
  xxl: 'm-6',      // 48px
  xxxl: 'm-8',     // 64px
};

/**
 * 内边距类名（方向性）
 */
export const paddingClasses = {
  top: {
    xs: 'pt-0.5', sm: 'pt-1', md: 'pt-2', lg: 'pt-3', xl: 'pt-4', xxl: 'pt-6', xxxl: 'pt-8',
  },
  bottom: {
    xs: 'pb-0.5', sm: 'pb-1', md: 'pb-2', lg: 'pb-3', xl: 'pb-4', xxl: 'pb-6', xxxl: 'pb-8',
  },
  left: {
    xs: 'pl-0.5', sm: 'pl-1', md: 'pl-2', lg: 'pl-3', xl: 'pl-4', xxl: 'pl-6', xxxl: 'pl-8',
  },
  right: {
    xs: 'pr-0.5', sm: 'pr-1', md: 'pr-2', lg: 'pr-3', xl: 'pr-4', xxl: 'pr-6', xxxl: 'pr-8',
  },
  x: {
    xs: 'px-0.5', sm: 'px-1', md: 'px-2', lg: 'px-3', xl: 'px-4', xxl: 'px-6', xxxl: 'px-8',
  },
  y: {
    xs: 'py-0.5', sm: 'py-1', md: 'py-2', lg: 'py-3', xl: 'py-4', xxl: 'py-6', xxxl: 'py-8',
  },
};

/**
 * 外边距类名（方向性）
 */
export const marginDirectionClasses = {
  top: {
    xs: 'mt-0.5', sm: 'mt-1', md: 'mt-2', lg: 'mt-3', xl: 'mt-4', xxl: 'mt-6', xxxl: 'mt-8',
  },
  bottom: {
    xs: 'mb-0.5', sm: 'mb-1', md: 'mb-2', lg: 'mb-3', xl: 'mb-4', xxl: 'mb-6', xxxl: 'mb-8',
  },
  left: {
    xs: 'ml-0.5', sm: 'ml-1', md: 'ml-2', lg: 'ml-3', xl: 'ml-4', xxl: 'ml-6', xxxl: 'ml-8',
  },
  right: {
    xs: 'mr-0.5', sm: 'mr-1', md: 'mr-2', lg: 'mr-3', xl: 'mr-4', xxl: 'mr-6', xxxl: 'mr-8',
  },
  x: {
    xs: 'mx-0.5', sm: 'mx-1', md: 'mx-2', lg: 'mx-3', xl: 'mx-4', xxl: 'mx-6', xxxl: 'mx-8',
  },
  y: {
    xs: 'my-0.5', sm: 'my-1', md: 'my-2', lg: 'my-3', xl: 'my-4', xxl: 'my-6', xxxl: 'my-8',
  },
};

/**
 * 间隙类名（Gap）
 */
export const gapClasses = {
  xs: 'gap-0.5', sm: 'gap-1', md: 'gap-2', lg: 'gap-3', xl: 'gap-4', xxl: 'gap-6', xxxl: 'gap-8',
};

/**
 * 尺寸系统
 * 基于8pt网格的尺寸定义
 */
export const sizes = {
  // 图标尺寸
  icon: {
    xs: 'w-3 h-3',      // 12px
    sm: 'w-4 h-4',      // 16px
    md: 'w-5 h-5',      // 20px
    lg: 'w-6 h-6',      // 24px
    xl: 'w-8 h-8',      // 32px
    xxl: 'w-12 h-12',    // 48px
  },
  
  // 按钮尺寸
  button: {
    xs: 'px-2 py-1 text-xs',     // 高度约24px
    sm: 'px-3 py-1.5 text-sm',   // 高度约32px
    md: 'px-4 py-2 text-base',   // 高度约40px
    lg: 'px-6 py-3 text-lg',     // 高度约48px
    xl: 'px-8 py-4 text-xl',     // 高度约64px
  },
  
  // 输入框尺寸
  input: {
    xs: 'px-2 py-1 text-xs h-7',    // 高度约28px
    sm: 'px-3 py-1.5 text-sm h-9',  // 高度约36px
    md: 'px-4 py-2 text-base h-11', // 高度约44px
    lg: 'px-6 py-3 text-lg h-14',    // 高度约56px
  },
  
  // 卡片尺寸
  card: {
    sm: 'p-4',    // 内边距16px
    md: 'p-6',    // 内边距24px
    lg: 'p-8',    // 内边距32px
    xl: 'p-10',   // 内边距40px
  },
  
  // 圆角尺寸
  radius: {
    none: 'rounded-none',
    xs: 'rounded',        // 4px
    sm: 'rounded-md',     // 6px
    md: 'rounded-lg',     // 8px
    lg: 'rounded-xl',     // 12px
    xl: 'rounded-2xl',    // 16px
    full: 'rounded-full', // 50%
  },
  
  // 阴影尺寸
  shadow: {
    none: 'shadow-none',
    sm: 'shadow-sm',      // 小阴影
    md: 'shadow-md',      // 中等阴影
    lg: 'shadow-lg',      // 大阴影
    xl: 'shadow-xl',      // 超大阴影
    xxl: 'shadow-2xl',    // 巨大阴影
  },
};

/**
 * 布局系统
 * 基于8pt网格的布局工具类
 */
export const layout = {
  // 容器宽度
  container: {
    xs: 'max-w-xs',   // 320px
    sm: 'max-w-sm',   // 384px
    md: 'max-w-md',   // 448px
    lg: 'max-w-lg',   // 512px
    xl: 'max-w-xl',   // 576px
    xxl: 'max-w-2xl', // 672px
    xxxl: 'max-w-3xl', // 768px
    full: 'max-w-full',
  },
  
  // 网格间距
  grid: {
    gap: gapClasses,
  },
  
  // 弹性布局
  flex: {
    // 主轴对齐
    justify: {
      start: 'justify-start',
      end: 'justify-end',
      center: 'justify-center',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    },
    // 交叉轴对齐
    align: {
      start: 'items-start',
      end: 'items-end',
      center: 'items-center',
      baseline: 'items-baseline',
      stretch: 'items-stretch',
    },
    // 换行
    wrap: {
      no: 'flex-nowrap',
      yes: 'flex-wrap',
      reverse: 'flex-wrap-reverse',
    },
    // 方向
    direction: {
      row: 'flex-row',
      col: 'flex-col',
      reverse: 'flex-row-reverse',
      colReverse: 'flex-col-reverse',
    },
  },
};

/**
 * 响应式断点
 * 基于8pt网格的响应式设计
 */
export const breakpoints = {
  sm: '640px',   // 80 * 8px
  md: '768px',   // 96 * 8px
  lg: '1024px',  // 128 * 8px
  xl: '1280px',  // 160 * 8px
  xxl: '1536px', // 192 * 8px
};

/**
 * 工具函数：获取间距类名
 */
export function getSpacingClass(size: keyof typeof spacing, direction?: 'x' | 'y' | 'top' | 'bottom' | 'left' | 'right') {
  if (direction) {
    return paddingClasses[direction][size];
  }
  return spacingClasses[size];
}

/**
 * 工具函数：获取外边距类名
 */
export function getMarginClass(size: keyof typeof spacing, direction?: 'x' | 'y' | 'top' | 'bottom' | 'left' | 'right') {
  if (direction) {
    return marginDirectionClasses[direction][size];
  }
  return marginClasses[size];
}

/**
 * 工具函数：获取间隙类名
 */
export function getGapClass(size: keyof typeof spacing) {
  return gapClasses[size];
}

/**
 * 工具函数：组合多个间距类名
 */
export function combineSpacingClasses(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * 预设的常用组合
 */
export const commonCombos = {
  // 卡片容器
  card: {
    base: 'p-6 rounded-lg shadow-md',
    compact: 'p-4 rounded-md shadow-sm',
    spacious: 'p-8 rounded-xl shadow-lg',
  },
  
  // 按钮
  button: {
    primary: 'px-4 py-2 rounded-lg shadow-sm',
    secondary: 'px-3 py-1.5 rounded-md',
    large: 'px-6 py-3 rounded-xl shadow-md',
  },
  
  // 输入框
  input: {
    base: 'px-4 py-2 rounded-lg border',
    compact: 'px-3 py-1.5 rounded-md border',
    large: 'px-6 py-3 rounded-xl border-2',
  },
  
  // 间距组合
  section: 'mb-8 last:mb-0',  // 章节间距
  group: 'mb-6 last:mb-0',    // 组件组间距
  item: 'mb-4 last:mb-0',     // 项目间距
  inline: 'mr-4 last:mr-0',   // 内联元素间距
};

/**
 * CSS变量定义
 * 用于在CSS中直接使用8pt网格系统
 */
export const cssVariables = {
  '--spacing-xs': `${spacing.xs}px`,
  '--spacing-sm': `${spacing.sm}px`,
  '--spacing-md': `${spacing.md}px`,
  '--spacing-lg': `${spacing.lg}px`,
  '--spacing-xl': `${spacing.xl}px`,
  '--spacing-xxl': `${spacing.xxl}px`,
  '--spacing-xxxl': `${spacing.xxxl}px`,
  '--base-unit': `${BASE_UNIT}px`,
} as const;