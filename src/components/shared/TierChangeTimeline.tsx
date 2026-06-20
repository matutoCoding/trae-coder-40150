import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { TierChangeRecord, CarryStrategy } from '@/types';
import { Badge } from '@/components/ui/Badge';

/**
 * TierChangeTimeline 升降级时间轴组件属性
 */
export interface TierChangeTimelineProps {
  /** 租户 ID */
  tenantId: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 单条时间轴记录数据（包含解析后的等级名称）
 */
interface ProcessedRecord extends TierChangeRecord {
  fromTierName: string;
  toTierName: string;
  fromTierColor: string;
  toTierColor: string;
  isUpgrade: boolean;
}

/**
 * 格式化时间显示
 */
function formatTime(isoStr: string): string {
  const date = new Date(isoStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

/**
 * 获取结转策略标签的显示文本和变体
 */
function getStrategyInfo(strategy: CarryStrategy): { label: string; variant: 'default' | 'amber' } {
  if (strategy === 'reset') {
    return { label: '清零策略', variant: 'amber' };
  }
  return { label: '按比例结转', variant: 'default' };
}

/**
 * 升降级时间轴组件
 * 根据 tenantId 从 Store 中过滤等级变更记录，以竖向时间轴形式展示
 * 每个节点包含：圆点（升级绿/降级红）、左侧时间、右侧卡片
 * 卡片内容：从 XX → YY、策略标签、计算式；可展开查看操作人与原因
 */
export function TierChangeTimeline({ tenantId, className }: TierChangeTimelineProps) {
  const { tierChangeRecords, tiers, initData } = useAppStore();
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /** 初始化数据并处理记录 */
  useEffect(() => {
    if (tiers.length === 0 || tierChangeRecords.length === 0) {
      initData();
    }

    /** 过滤指定租户的记录，并补充等级名称 */
    const filtered = tierChangeRecords
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => {
        const fromTier = tiers.find((t) => t.id === r.fromTierId);
        const toTier = tiers.find((t) => t.id === r.toTierId);
        const fromLevel = fromTier?.level ?? 0;
        const toLevel = toTier?.level ?? 0;
        return {
          ...r,
          fromTierName: fromTier?.name ?? '未知等级',
          toTierName: toTier?.name ?? '未知等级',
          fromTierColor: fromTier?.color ?? '#94A3B8',
          toTierColor: toTier?.color ?? '#94A3B8',
          isUpgrade: toLevel > fromLevel,
        };
      });

    setRecords(filtered);
  }, [tenantId, tierChangeRecords, tiers, initData]);

  /** 切换某条记录的展开/收起状态 */
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** 无记录时显示空状态 */
  if (records.length === 0) {
    return (
      <div
        className={cn(
          'py-10 text-center text-ink-400 text-sm',
          className,
        )}
      >
        暂无等级变更记录
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* 竖向连接线 */}
      <div className="absolute left-[72px] top-0 bottom-0 w-px bg-ink-100" />

      <div className="space-y-5">
        {records.map((record) => {
          const isExpanded = expandedIds.has(record.id);
          const strategyInfo = getStrategyInfo(record.carryStrategy);

          return (
            <div key={record.id} className="relative flex gap-4">
              {/* 左侧时间列 */}
              <div className="w-16 shrink-0 pt-1.5 text-right">
                <div className="text-xs font-medium text-ink-500 tabular-nums leading-tight">
                  {formatTime(record.createdAt).split(' ')[0]}
                </div>
                <div className="text-[11px] text-ink-400 tabular-nums mt-0.5">
                  {formatTime(record.createdAt).split(' ')[1]}
                </div>
              </div>

              {/* 中间圆点列 */}
              <div className="relative z-10 shrink-0">
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 border-white shadow-md',
                    record.isUpgrade ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
              </div>

              {/* 右侧卡片列 */}
              <div className="flex-1 min-w-0 pb-1">
                <div
                  className={cn(
                    'rounded-lg border bg-white p-4',
                    'shadow-sm transition-shadow hover:shadow-md',
                    'border-ink-100',
                  )}
                >
                  {/* 顶部：升降级方向 + 等级名称 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={record.isUpgrade ? 'success' : 'danger'}
                        className="shrink-0"
                      >
                        {record.isUpgrade ? '升级' : '降级'}
                      </Badge>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: record.fromTierColor }}
                          />
                          <span className="text-sm text-ink-600 font-medium truncate max-w-[80px]">
                            {record.fromTierName}
                          </span>
                        </span>
                        <span className="text-ink-300 shrink-0">→</span>
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: record.toTierColor }}
                          />
                          <span className="text-sm font-semibold text-ink-800 truncate max-w-[80px]">
                            {record.toTierName}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* 展开/收起按钮 */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(record.id)}
                      className={cn(
                        'shrink-0 p-1 -m-1 rounded-md',
                        'text-ink-400 hover:text-ink-600 hover:bg-ink-50',
                        'transition-colors',
                      )}
                      aria-label={isExpanded ? '收起详情' : '展开详情'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* 策略标签 + 额度变化 + 计算式 */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={strategyInfo.variant} className="text-[11px]">
                      {strategyInfo.label}
                    </Badge>
                    <span className="text-xs text-ink-500">
                      额度{' '}
                      <span className="tabular-nums text-ink-600 font-medium">
                        {record.quotaBefore}
                      </span>
                      {' → '}
                      <span
                        className={cn(
                          'tabular-nums font-semibold',
                          record.quotaAfter >= record.quotaBefore
                            ? 'text-emerald-600'
                            : 'text-amber-600',
                        )}
                      >
                        {record.quotaAfter}
                      </span>
                    </span>
                  </div>

                  {/* 计算式 */}
                  <div className="text-xs text-ink-500 bg-ink-50 rounded px-2.5 py-1.5 font-mono break-all">
                    {record.calculation}
                  </div>

                  {/* 展开区域：操作人 + 原因 */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-ink-400 shrink-0 w-14">操作人</span>
                        <span className="text-xs text-ink-700 font-medium">
                          {record.operatorName}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-ink-400 shrink-0 w-14">原因</span>
                        <span className="text-xs text-ink-700 leading-relaxed">
                          {record.reason}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
