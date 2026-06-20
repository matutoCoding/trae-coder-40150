import { cn } from '@/lib/utils';
import { Badge, BadgeProps } from '@/components/ui/Badge';
import { BillStatus } from '@/types';

/**
 * BillStatusBadge 账单状态徽章组件属性
 */
export interface BillStatusBadgeProps extends Omit<BadgeProps, 'variant' | 'seal'> {
  /** 账单状态 */
  status: BillStatus;
}

/**
 * 账单状态映射配置
 * 根据 Bill.status 返回对应的 Badge variant、seal 模式、中文显示文本
 */
const STATUS_CONFIG: Record<
  BillStatus,
  { variant: BadgeProps['variant']; seal: boolean; label: string }
> = {
  pending: {
    variant: 'amber',
    seal: false,
    label: '待支付',
  },
  paid: {
    variant: 'success',
    seal: true,
    label: '已支付',
  },
  overdue: {
    variant: 'danger',
    seal: false,
    label: '已逾期',
  },
  void: {
    variant: 'slate',
    seal: false,
    label: '已作废',
  },
};

/**
 * 账单状态徽章组件
 * 根据 Bill.status 自动选择颜色变体、印章模式和中文显示文本：
 * - pending: amber 变体，显示"待支付"
 * - paid: success 变体 + seal 印章，显示"已支付"
 * - overdue: danger 变体，显示"已逾期"
 * - void: slate 变体，显示"已作废"
 */
export function BillStatusBadge({ status, className, ...props }: BillStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      seal={config.seal}
      className={cn(className)}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
