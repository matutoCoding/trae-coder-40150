import { cn } from '@/lib/utils';

/**
 * TenantAvatar 租户头像组件属性
 */
export interface TenantAvatarProps {
  /** 租户姓名 */
  name: string;
  /** 尺寸：xs 超小 / sm 小 / md 中 / lg 大 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
}

/**
 * 6 种柔和背景色（用于根据 name.hashCode % 6 取色）
 */
const SOFT_COLORS: { bg: string; text: string }[] = [
  { bg: '#DBEAFE', text: '#1D4ED8' }, // 柔和蓝
  { bg: '#D1FAE5', text: '#047857' }, // 柔和绿
  { bg: '#FCE7F3', text: '#BE185D' }, // 柔和粉
  { bg: '#FEF3C7', text: '#B45309' }, // 柔和黄
  { bg: '#EDE9FE', text: '#6D28D9' }, // 柔和紫
  { bg: '#FFEDD5', text: '#C2410C' }, // 柔和橙
];

/**
 * 尺寸样式映射
 */
const sizeClasses: Record<NonNullable<TenantAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

/**
 * 计算字符串的 hashCode
 * 用于根据姓名生成一致的颜色索引
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 获取姓名的第一个字符
 * 支持中英文，中文取首字，英文取首字母大写
 */
function getFirstChar(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const first = trimmed.charAt(0);
  return first.toUpperCase();
}

/**
 * 租户头像组件
 * 根据姓名取首字作为头像内容，颜色根据 name.hashCode % 6 从柔和色板中选取
 */
export function TenantAvatar({ name, size = 'md', className }: TenantAvatarProps) {
  const colorIndex = name ? hashCode(name) % 6 : 0;
  const colors = SOFT_COLORS[colorIndex];
  const firstChar = getFirstChar(name);

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'font-semibold shrink-0 select-none',
        'ring-2 ring-white shadow-sm',
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
      title={name}
    >
      {firstChar}
    </div>
  );
}
