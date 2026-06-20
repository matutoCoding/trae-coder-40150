import { cn } from '@/lib/utils';
import { Badge, BadgeProps } from '@/components/ui/Badge';
import { AccessGrantStatus } from '@/types';

/**
 * AccessStatusBadge 门禁授权状态徽章组件属性
 */
export interface AccessStatusBadgeProps extends Omit<BadgeProps, 'variant' | 'seal'> {
  /** 授权状态 */
  status: AccessGrantStatus;
}

/**
 * 门禁授权状态映射配置
 * 根据 AccessGrant.status 返回对应的 Badge variant、seal 模式、中文显示文本
 */
const STATUS_CONFIG: Record<
  AccessGrantStatus,
  { variant: BadgeProps['variant']; seal: boolean; label: string }
> = {
  active: {
    variant: 'success',
    seal: true,
    label: '正常',
  },
  frozen: {
    variant: 'danger',
    seal: false,
    label: '冻结',
  },
  expired: {
    variant: 'slate',
    seal: false,
    label: '过期',
  },
};

/**
 * 门禁授权状态徽章组件
 * 根据 AccessGrant.status 自动选择颜色变体、印章模式和中文显示文本：
 * - active: success 变体 + seal 印章，显示"正常"
 * - frozen: danger 变体，显示"冻结"
 * - expired: slate 变体，显示"过期"
 */
export function AccessStatusBadge({ status, className, ...props }: AccessStatusBadgeProps) {
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
