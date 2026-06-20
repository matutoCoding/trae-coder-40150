import { cn } from '@/lib/utils';

/**
 * QuotaBar 额度进度条组件属性
 */
export interface QuotaBarProps {
  /** 已用额度 */
  used: number;
  /** 总额度 */
  total: number;
  /** 紧凑模式：仅显示文字条，不显示大号数字 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 根据使用率返回进度条颜色样式
 * >= 85% -> 红色（危险）
 * >= 60% -> 琥珀色（警告）
 * 否则 -> 绿色（正常）
 */
function getProgressColor(ratio: number): { bar: string; text: string } {
  if (ratio >= 0.85) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-600',
    };
  }
  if (ratio >= 0.6) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600',
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
  };
}

/**
 * 额度进度条组件
 * 展示已用额度 / 总额度，带颜色警示的进度条
 * 支持紧凑模式，仅显示简洁的文字条
 */
export function QuotaBar({ used, total, compact = false, className }: QuotaBarProps) {
  /** 使用率，处理 total 为 0 的边界情况 */
  const ratio = total > 0 ? Math.min(used / total, 1) : 0;
  const percent = Math.round(ratio * 100);
  const colors = getProgressColor(ratio);

  /** 紧凑模式：仅显示文字 + 背景色条 */
  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2',
          'px-2 py-1 rounded-md text-xs font-medium',
          'bg-ink-50 border border-ink-100',
          className,
        )}
      >
        <span className="text-ink-500">额度</span>
        <span className={cn('font-semibold tabular-nums', colors.text)}>
          {used}
        </span>
        <span className="text-ink-300">/</span>
        <span className="text-ink-600 tabular-nums">{total}</span>
      </div>
    );
  }

  /** 标准模式：进度条 + 大号数字 */
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between mb-2">
        {/* 左侧标签 */}
        <span className="text-xs text-ink-500 font-medium">额度使用</span>
        {/* 右侧大号数字显示 */}
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'text-2xl font-serif font-bold tabular-nums',
              colors.text,
            )}
          >
            {used}
          </span>
          <span className="text-ink-300 text-sm">/</span>
          <span className="text-ink-500 text-sm font-medium tabular-nums">
            {total}
          </span>
          <span className="text-ink-400 text-xs ml-1">({percent}%)</span>
        </div>
      </div>

      {/* 进度条容器 */}
      <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            colors.bar,
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
