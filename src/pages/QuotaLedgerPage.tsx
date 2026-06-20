import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '@/store/index';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { TierBadge } from '@/components/shared/TierBadge';
import {
  HandCoins,
  CalendarRange,
  ChevronDown,
  Plus,
  Check,
  Wand2,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/date';
import type { QuotaLedger, QuotaLedgerType, Tenant } from '@/types';

const TYPE_OPTIONS: {
  value: QuotaLedgerType;
  label: string;
  variant: 'default' | 'amber' | 'success' | 'warning' | 'danger' | 'slate';
}[] = [
  { value: 'grant', label: '发放', variant: 'success' },
  { value: 'consume', label: '消耗', variant: 'danger' },
  { value: 'refund', label: '退还', variant: 'default' },
  { value: 'carry', label: '结转', variant: 'amber' },
  { value: 'reset', label: '清零', variant: 'warning' },
  { value: 'manual', label: '手工', variant: 'slate' },
];

const adjustFormSchema = z
  .object({
    tenantId: z.string().min(1, '请选择租户'),
    adjustMode: z.enum(['grant', 'deduct']).default('grant'),
    amount: z
      .number({ required_error: '请输入数量', invalid_type_error: '请输入数字' })
      .int('数量必须为整数')
      .min(1, '数量最小为1'),
    reason: z
      .string()
      .min(5, '原因至少5个字符')
      .max(200, '原因不能超过200个字符'),
  });

type AdjustFormValues = z.infer<typeof adjustFormSchema>;

export default function QuotaLedgerPage() {
  const {
    tiers,
    tenants,
    quotaLedgers,
    session,
    loadTiers,
    loadTenants,
    loadQuotaLedgers,
    adjustQuota,
  } = useAppStore();

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<Set<QuotaLedgerType>>(new Set());
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingAdjust, setPendingAdjust] = useState<AdjustFormValues | null>(null);

  useEffect(() => {
    loadTiers();
    loadTenants();
    loadQuotaLedgers();
  }, [loadTiers, loadTenants, loadQuotaLedgers]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setValue,
    clearErrors,
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustFormSchema),
    defaultValues: {
      tenantId: '',
      adjustMode: 'grant',
      amount: 1,
      reason: '',
    },
  });

  const watchTenantId = watch('tenantId');
  const watchAdjustMode = watch('adjustMode');

  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [tenants]
  );

  const filteredLedgers = useMemo(() => {
    let result = [...quotaLedgers];
    if (selectedTenantId) {
      result = result.filter((l) => l.tenantId === selectedTenantId);
    }
    if (selectedTypes.size > 0) {
      result = result.filter((l) => selectedTypes.has(l.type));
    }
    if (dateStart) {
      const startTs = new Date(dateStart + ' 00:00:00').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() >= startTs);
    }
    if (dateEnd) {
      const endTs = new Date(dateEnd + ' 23:59:59').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() <= endTs);
    }
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [quotaLedgers, selectedTenantId, selectedTypes, dateStart, dateEnd]);

  const summary = useMemo(() => {
    let totalGrant = 0;
    let totalDeduct = 0;
    for (const l of filteredLedgers) {
      if (l.delta > 0) totalGrant += l.delta;
      else totalDeduct += Math.abs(l.delta);
    }
    return {
      totalGrant,
      totalDeduct,
      net: totalGrant - totalDeduct,
    };
  }, [filteredLedgers]);

  const toggleType = (type: QuotaLedgerType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedTenantId('');
    setSelectedTypes(new Set());
    setDateStart('');
    setDateEnd('');
  };

  const getTypeInfo = (type: QuotaLedgerType) => {
    return TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[5];
  };

  const getTenantById = (id: string): Tenant | undefined => {
    return tenants.find((t) => t.id === id);
  };

  const openAdjustModal = () => {
    reset({
      tenantId: '',
      adjustMode: 'grant',
      amount: 1,
      reason: '',
    });
    clearErrors();
    setAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustModalOpen(false);
    setPendingAdjust(null);
  };

  const onSubmitAdjust = (values: AdjustFormValues) => {
    setPendingAdjust(values);
    setConfirmDialogOpen(true);
  };

  const confirmAdjust = () => {
    if (!pendingAdjust) return;
    setConfirmLoading(true);
    const delta = pendingAdjust.adjustMode === 'grant' ? pendingAdjust.amount : -pendingAdjust.amount;
    adjustQuota({
      tenantId: pendingAdjust.tenantId,
      delta,
      reason: `${pendingAdjust.adjustMode === 'grant' ? '[发放]' : '[扣减]'} ${pendingAdjust.reason}`,
      operatorId: session.operatorId,
      operatorName: session.operatorName,
    });
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirmDialogOpen(false);
      setAdjustModalOpen(false);
      setPendingAdjust(null);
    }, 300);
  };

  const columns: DataTableColumn<QuotaLedger>[] = [
    {
      key: 'createdAt',
      title: '时间',
      width: '160px',
      render: (row) => (
        <span className="text-xs tabular-nums text-ink-600">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'tenant',
      title: '租户',
      width: '200px',
      render: (row) => {
        const tenant = getTenantById(row.tenantId);
        if (!tenant) {
          return <span className="text-ink-400 text-xs">未知租户</span>;
        }
        return (
          <div className="flex items-center gap-2 min-w-0">
            <TenantAvatar name={tenant.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-700 truncate">
                {tenant.name}
              </div>
              <TierBadge tierId={tenant.tierId} size="sm" />
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      title: '流水类型',
      width: '100px',
      render: (row) => {
        const info = getTypeInfo(row.type);
        return (
          <Badge variant={info.variant} className="text-[11px]">
            {info.label}
          </Badge>
        );
      },
    },
    {
      key: 'delta',
      title: '变动',
      width: '100px',
      align: 'right',
      render: (row) => {
        const positive = row.delta > 0;
        const negative = row.delta < 0;
        return (
          <span
            className={cn(
              'inline-flex items-center font-mono tabular-nums text-sm font-semibold',
              positive && 'text-green-600',
              negative && 'text-red-600',
              !positive && !negative && 'text-ink-400'
            )}
          >
            {positive && '+'}
            {row.delta}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter',
      title: '变动后余额',
      width: '110px',
      align: 'right',
      render: (row) => (
        <span className="inline-flex font-mono tabular-nums text-sm text-ink-700">
          {row.balanceAfter}
        </span>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      width: '100px',
      render: (row) => (
        <span className="text-xs text-ink-600">{row.operatorName}</span>
      ),
    },
    {
      key: 'reason',
      title: '原因备注',
      render: (row) => (
        <span className="text-xs text-ink-500 truncate block max-w-[300px]" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 顶部标题 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">额度台账</h2>
          <p className="text-sm text-ink-400 mt-1">存储空间额度发放、消耗、结转等流水记录</p>
        </div>
        <Button onClick={openAdjustModal} size="md">
          <Wand2 className="w-4 h-4" />
          手工调整额度
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setTenantDropdownOpen((v) => !v);
                  setTypeDropdownOpen(false);
                }}
                className={cn(
                  'inline-flex items-center gap-2 h-10 px-3 rounded-md border text-sm transition-colors',
                  selectedTenantId
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-ink-200 hover:border-ink-300 text-ink-600 bg-white'
                )}
              >
                <HandCoins className="w-4 h-4 shrink-0 text-ink-400" />
                <span className="max-w-[160px] truncate">
                  {selectedTenantId
                    ? getTenantById(selectedTenantId)?.name ?? '选择租户'
                    : '全部租户'}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-ink-400" />
              </button>
              {tenantDropdownOpen && (
                <div className="absolute z-20 top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto rounded-lg border border-ink-100 bg-white shadow-cardHover animate-fade-in">
                  <div
                    className="px-3 py-2 text-xs text-ink-400 border-b border-ink-100 cursor-pointer hover:bg-ink-50"
                    onClick={() => {
                      setSelectedTenantId('');
                      setTenantDropdownOpen(false);
                    }}
                  >
                    {!selectedTenantId && (
                      <Check className="w-3.5 h-3.5 text-brand-500 inline mr-1.5" />
                    )}
                    全部租户
                  </div>
                  {sortedTenants.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        'px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors',
                        'hover:bg-ink-50 border-b border-ink-50 last:border-b-0'
                      )}
                      onClick={() => {
                        setSelectedTenantId(t.id);
                        setTenantDropdownOpen(false);
                      }}
                    >
                      <TenantAvatar name={t.name} size="xs" />
                      <span className="flex-1 text-sm text-ink-700 truncate">{t.name}</span>
                      <TierBadge tierId={t.tierId} size="sm" />
                      {selectedTenantId === t.id && (
                        <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setTypeDropdownOpen((v) => !v);
                  setTenantDropdownOpen(false);
                }}
                className={cn(
                  'inline-flex items-center gap-2 h-10 px-3 rounded-md border text-sm transition-colors',
                  selectedTypes.size > 0
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-ink-200 hover:border-ink-300 text-ink-600 bg-white'
                )}
              >
                <span className="text-ink-400">类型</span>
                <span className="max-w-[200px] truncate">
                  {selectedTypes.size > 0
                    ? `已选 ${selectedTypes.size} 项`
                    : '全部类型'}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-ink-400" />
              </button>
              {typeDropdownOpen && (
                <div className="absolute z-20 top-full left-0 mt-1 w-44 rounded-lg border border-ink-100 bg-white shadow-cardHover animate-fade-in p-1">
                  {TYPE_OPTIONS.map((opt) => {
                    const checked = selectedTypes.has(opt.value);
                    return (
                      <div
                        key={opt.value}
                        className={cn(
                          'px-2.5 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
                          'hover:bg-ink-50',
                          checked && 'bg-brand-50'
                        )}
                        onClick={() => toggleType(opt.value)}
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                            checked
                              ? 'bg-brand-500 border-brand-500'
                              : 'border-ink-300 bg-white'
                          )}
                        >
                          {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </span>
                        <Badge variant={opt.variant} className="text-[11px]">
                          {opt.label}
                        </Badge>
                      </div>
                    );
                  })}
                  {selectedTypes.size > 0 && (
                    <div
                      className="mt-1 pt-1 border-t border-ink-100 px-2.5 py-1.5 text-xs text-ink-400 hover:text-brand-600 cursor-pointer rounded-md hover:bg-ink-50"
                      onClick={() => setSelectedTypes(new Set())}
                    >
                      清空选择
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-ink-400 shrink-0" />
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="h-10 px-2.5 rounded-md border border-ink-200 text-sm text-ink-600 hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors"
              />
              <span className="text-ink-300 text-sm">至</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="h-10 px-2.5 rounded-md border border-ink-200 text-sm text-ink-600 hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors"
              />
            </div>

            {(selectedTenantId || selectedTypes.size > 0 || dateStart || dateEnd) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="ml-auto"
              >
                清除筛选
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 流水表格 */}
      <DataTable
        columns={columns}
        data={filteredLedgers}
        rowKey="id"
        emptyText="暂无符合条件的额度流水"
      />

      {/* 汇总卡 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-ink-400" />
            <h3 className="font-serif font-semibold text-base text-ink-800">
              当前筛选结果汇总
            </h3>
            <span className="text-xs text-ink-400 tabular-nums ml-1">
              共 {filteredLedgers.length} 条记录
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-green-50/60 border border-green-100">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">发放总额</span>
              </div>
              <div className="font-mono tabular-nums text-2xl font-bold text-green-700">
                +{summary.totalGrant}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-red-50/60 border border-red-100">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700 font-medium">扣减总额</span>
              </div>
              <div className="font-mono tabular-nums text-2xl font-bold text-red-700">
                -{summary.totalDeduct}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-brand-50/60 border border-brand-100">
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart3 className="w-4 h-4 text-brand-600" />
                <span className="text-sm text-brand-700 font-medium">净变动</span>
              </div>
              <div
                className={cn(
                  'font-mono tabular-nums text-2xl font-bold',
                  summary.net > 0 && 'text-green-700',
                  summary.net < 0 && 'text-red-700',
                  summary.net === 0 && 'text-brand-700'
                )}
              >
                {summary.net > 0 ? '+' : ''}
                {summary.net}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 点击外部关闭下拉 */}
      {(typeDropdownOpen || tenantDropdownOpen) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setTypeDropdownOpen(false);
            setTenantDropdownOpen(false);
          }}
        />
      )}

      {/* 手工调整 Modal */}
      <Modal
        open={adjustModalOpen}
        onClose={closeAdjustModal}
        maxWidth="md"
        title="手工调整额度"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={closeAdjustModal} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit(onSubmitAdjust)}
              loading={isSubmitting}
            >
              <Plus className="w-4 h-4" />
              提交调整
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmitAdjust)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              选择租户 <span className="text-danger">*</span>
            </label>
            <select
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm bg-white',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                errors.tenantId
                  ? 'border-danger bg-red-50'
                  : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
              )}
              {...register('tenantId')}
              defaultValue=""
            >
              <option value="" disabled>
                请选择要调整额度的租户
              </option>
              {sortedTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（当前额度：{t.currentQuota}）
                </option>
              ))}
            </select>
            {errors.tenantId && (
              <p className="mt-1 text-xs text-danger">{errors.tenantId.message}</p>
            )}
            {watchTenantId && (
              <p className="mt-1 text-xs text-ink-400">
                当前额度：
                <span className="tabular-nums font-medium text-ink-600">
                  {getTenantById(watchTenantId)?.currentQuota ?? 0}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              调整方式
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={cn(
                  'relative flex items-center justify-center gap-2 h-12 rounded-md border cursor-pointer transition-all',
                  watchAdjustMode === 'grant'
                    ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                    : 'border-ink-200 hover:border-ink-300 bg-white'
                )}
              >
                <input
                  type="radio"
                  value="grant"
                  checked={watchAdjustMode === 'grant'}
                  onChange={() => setValue('adjustMode', 'grant')}
                  className="sr-only"
                />
                <TrendingUp
                  className={cn(
                    'w-4 h-4',
                    watchAdjustMode === 'grant' ? 'text-green-600' : 'text-ink-400'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    watchAdjustMode === 'grant' ? 'text-green-700' : 'text-ink-600'
                  )}
                >
                  发放额度
                </span>
              </label>
              <label
                className={cn(
                  'relative flex items-center justify-center gap-2 h-12 rounded-md border cursor-pointer transition-all',
                  watchAdjustMode === 'deduct'
                    ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                    : 'border-ink-200 hover:border-ink-300 bg-white'
                )}
              >
                <input
                  type="radio"
                  value="deduct"
                  checked={watchAdjustMode === 'deduct'}
                  onChange={() => setValue('adjustMode', 'deduct')}
                  className="sr-only"
                />
                <TrendingDown
                  className={cn(
                    'w-4 h-4',
                    watchAdjustMode === 'deduct' ? 'text-red-600' : 'text-ink-400'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    watchAdjustMode === 'deduct' ? 'text-red-700' : 'text-ink-600'
                  )}
                >
                  扣减额度
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              调整数量 <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="请输入数量（大于0的整数）"
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                errors.amount
                  ? 'border-danger bg-red-50'
                  : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
              )}
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              调整原因 <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="请输入调整原因（至少5个字，例如：活动补偿、违规扣减等）"
              maxLength={200}
              className={cn(
                'w-full px-3 py-2.5 rounded-md border text-sm resize-none',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                errors.reason
                  ? 'border-danger bg-red-50'
                  : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
              )}
              {...register('reason')}
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.reason ? (
                <p className="text-xs text-danger">{errors.reason.message}</p>
              ) : (
                <span className="text-xs text-ink-400">
                  请清晰说明调整原因，便于后续审计追溯
                </span>
              )}
              <span className="text-xs text-ink-400 tabular-nums ml-auto shrink-0">
                {(watch('reason') ?? '').length}/200
              </span>
            </div>
          </div>
        </form>
      </Modal>

      {/* 确认提交对话框 */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmDialogOpen(false);
            setPendingAdjust(null);
          }
        }}
        onConfirm={confirmAdjust}
        title="确认调整额度"
        message={
          pendingAdjust
            ? `确定要对租户「${getTenantById(pendingAdjust.tenantId)?.name ?? ''}」${
                pendingAdjust.adjustMode === 'grant' ? '发放' : '扣减'
              } ${pendingAdjust.amount} 个仓位额度吗？\n\n原因：${pendingAdjust.reason}\n\n此操作将写入额度流水并永久留痕。`
            : ''
        }
        confirmText="确认调整"
        danger={pendingAdjust?.adjustMode === 'deduct'}
        loading={confirmLoading}
      />
    </div>
  );
}
