import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { TenantTier } from '@/types';

/**
 * TierBadge 等级徽章组件属性
 */
export interface TierBadgeProps {
  /** 等级 ID */
  tierId: string;
  /** 尺寸：sm 紧凑 / md 标准 */
  size?: 'sm' | 'md';
  /** 自定义类名 */
  className?: string;
}

/**
 * 尺寸样式映射
 */
const sizeClasses: Record<NonNullable<TierBadgeProps['size']>, { dot: string; text: string }> = {
  sm: {
    dot: 'w-2.5 h-2.5',
    text: 'text-xs',
  },
  md: {
    dot: 'w-3.5 h-3.5',
    text: 'text-sm font-medium',
  },
};

/**
 * 未知等级的回退数据
 */
const FALLBACK_TIER: Pick<TenantTier, 'name' | 'color'> = {
  name: '未知',
  color: '#94A3B8',
};

/**
 * 等级徽章组件
 * 根据 tierId 从 Store 中查找对应等级，显示彩色圆点 + 等级名称
 * 无匹配时显示灰色"未知"
 */
export function TierBadge({ tierId, size = 'md', className }: TierBadgeProps) {
  const { tiers, initData } = useAppStore();
  const [tier, setTier] = useState<Pick<TenantTier, 'name' | 'color'> | null>(null);

  /** 初始化数据并查找对应等级 */
  useEffect(() => {
    if (tiers.length === 0) {
      initData();
    }
    const found = tiers.find((t) => t.id === tierId);
    setTier(found ?? FALLBACK_TIER);
  }, [tierId, tiers, initData]);

  const styles = sizeClasses[size];
  const displayTier = tier ?? FALLBACK_TIER;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 select-none',
        className,
      )}
    >
      {/* 圆形色块 */}
      <span
        className={cn(
          'rounded-full shrink-0 ring-2 ring-white/60',
          styles.dot,
        )}
        style={{ backgroundColor: displayTier.color }}
      />
      {/* 等级名称 */}
      <span
        className={cn(
          'text-ink-700',
          styles.text,
        )}
      >
        {displayTier.name}
      </span>
    </span>
  );
}
