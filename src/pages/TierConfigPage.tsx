import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '@/store/index';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TierBadge } from '@/components/shared/TierBadge';
import { Pencil, Trash2, Plus, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TenantTier } from '@/types';

const PRESET_COLORS = [
  '#94A3B8',
  '#60A5FA',
  '#F59E0B',
  '#A855F7',
  '#EF4444',
  '#22C55E',
  '#06B6D4',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
];

const tierFormSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, '请输入等级名称'),
    level: z
      .number({ required_error: '请输入等级数字', invalid_type_error: '请输入数字' })
      .int('等级必须为整数')
      .min(1, '等级最小为1'),
    freeQuota: z
      .number({ required_error: '请输入免费仓位数', invalid_type_error: '请输入数字' })
      .int('仓位数必须为整数')
      .min(0, '仓位数不能小于0'),
    upgradeCarryRatio: z
      .number({ invalid_type_error: '请输入数字' })
      .min(0, '比例不能小于0%')
      .max(100, '比例不能大于100%')
      .default(0),
    downgradeMode: z.enum(['ratio', 'reset']).default('reset'),
    downgradeCarryRatio: z
      .number({ invalid_type_error: '请输入数字' })
      .min(0, '比例不能小于0%')
      .max(100, '比例不能大于100%')
      .default(0),
    color: z.string().min(1, '请选择标识颜色'),
  })
  .superRefine((val, ctx) => {
    if (val.downgradeMode === 'ratio') {
      if (val.downgradeCarryRatio === undefined || val.downgradeCarryRatio === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['downgradeCarryRatio'],
          message: '请输入降级结转比例',
        });
      }
    }
  });

type TierFormValues = z.infer<typeof tierFormSchema>;

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

export default function TierConfigPage() {
  const { tiers, tenants, loadTiers, loadTenants, upsertTier, deleteTier, session } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<TenantTier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTier, setDeletingTier] = useState<TenantTier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadTiers();
    loadTenants();
  }, [loadTiers, loadTenants]);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.level - b.level),
    [tiers]
  );

  const maxFreeQuota = useMemo(
    () => (tiers.length > 0 ? Math.max(...tiers.map((t) => t.freeQuota)) : 1),
    [tiers]
  );

  const defaultTierId = useMemo(() => {
    if (sortedTiers.length === 0) return '';
    return sortedTiers[0].id;
  }, [sortedTiers]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<TierFormValues>({
    resolver: zodResolver(tierFormSchema),
    defaultValues: {
      name: '',
      level: 1,
      freeQuota: 1,
      upgradeCarryRatio: 80,
      downgradeMode: 'reset',
      downgradeCarryRatio: 0,
      color: PRESET_COLORS[0],
    },
  });

  const downgradeMode = watch('downgradeMode');
  const selectedColor = watch('color');

  const openCreateModal = () => {
    setEditingTier(null);
    reset({
      name: '',
      level: sortedTiers.length + 1,
      freeQuota: 1,
      upgradeCarryRatio: 80,
      downgradeMode: 'reset',
      downgradeCarryRatio: 0,
      color: PRESET_COLORS[sortedTiers.length % PRESET_COLORS.length],
    });
    setModalOpen(true);
  };

  const openEditModal = (tier: TenantTier) => {
    setEditingTier(tier);
    reset({
      id: tier.id,
      name: tier.name,
      level: tier.level,
      freeQuota: tier.freeQuota,
      upgradeCarryRatio: Math.round(tier.upgradeCarryRatio * 100),
      downgradeMode: tier.resetOnDowngrade ? 'reset' : 'ratio',
      downgradeCarryRatio: tier.resetOnDowngrade ? 0 : Math.round(tier.downgradeCarryRatio * 100),
      color: tier.color,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTier(null);
  };

  const onSubmitForm = (values: TierFormValues) => {
    const tier: TenantTier = {
      id: values.id ?? uid('TIER'),
      name: values.name,
      level: values.level,
      freeQuota: values.freeQuota,
      upgradeCarryRatio: (values.upgradeCarryRatio ?? 0) / 100,
      downgradeCarryRatio:
        values.downgradeMode === 'ratio' ? (values.downgradeCarryRatio ?? 0) / 100 : 0,
      resetOnDowngrade: values.downgradeMode === 'reset',
      color: values.color,
    };
    upsertTier(tier);
    closeModal();
  };

  const openDeleteDialog = (tier: TenantTier) => {
    setDeletingTier(tier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingTier) return;
    setDeleteLoading(true);
    const tierId = deletingTier.id;
    const isDefault = tierId === defaultTierId;
    if (!isDefault && defaultTierId) {
      for (const t of tenants) {
        if (t.tierId === tierId) {
          // 手动调用 upsertTenant 重置为默认等级
          useAppStore.getState().upsertTenant({ ...t, tierId: defaultTierId });
        }
      }
    }
    setTimeout(() => {
      deleteTier(deletingTier.id);
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setDeletingTier(null);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题与按钮 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">租户等级配置</h2>
          <p className="text-sm text-ink-400 mt-1">配置租户等级权益、免费额度与结转策略</p>
        </div>
        <Button onClick={openCreateModal} size="md">
          <Plus className="w-4 h-4" />
          新增等级
        </Button>
      </div>

      {/* 等级卡片网格 */}
      {sortedTiers.length === 0 ? (
        <div className="panel-card p-16 flex flex-col items-center justify-center text-ink-300 gap-3">
          <RotateCcw className="w-12 h-12 opacity-50" />
          <span>暂无等级配置，点击右上角新增等级</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTiers.map((tier) => {
            const ringPercent =
              maxFreeQuota > 0 ? Math.round((tier.freeQuota / maxFreeQuota) * 100) : 0;
            const tenantCount = tenants.filter((t) => t.tierId === tier.id).length;
            return (
              <Card key={tier.id} className="relative overflow-hidden">
                {/* 左侧色条 */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: tier.color }}
                />
                <CardContent className="pl-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="slate" className="font-mono text-[11px] tracking-wider">
                          L{tier.level}
                        </Badge>
                        <TierBadge tierId={tier.id} size="sm" />
                      </div>
                      <h3 className="font-serif font-semibold text-xl text-ink-800 leading-tight truncate">
                        {tier.name}
                      </h3>
                      {tenantCount > 0 && (
                        <p className="text-xs text-ink-400 mt-1">
                          <span className="tabular-nums">{tenantCount}</span> 个租户
                        </p>
                      )}
                    </div>
                    <ProgressRing
                      percent={ringPercent}
                      size={72}
                      stroke={8}
                      color={tier.color}
                      labelClassName="text-xs"
                    />
                  </div>

                  <div className="mb-4 p-4 rounded-lg bg-ink-50/80 border border-ink-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-serif font-bold text-4xl text-ink-800 tabular-nums leading-none">
                        {tier.freeQuota}
                      </span>
                      <span className="text-sm text-ink-500">免费仓位</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-ink-600">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                      <span className="text-ink-400 shrink-0 w-16">升级结转</span>
                      <Badge variant="default" className="text-[11px]">
                        按比例 {Math.round(tier.upgradeCarryRatio * 100)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-600">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                      <span className="text-ink-400 shrink-0 w-16">降级结转</span>
                      {tier.resetOnDowngrade ? (
                        <Badge variant="amber" className="text-[11px]">
                          清零重置
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[11px]">
                          按比例 {Math.round(tier.downgradeCarryRatio * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-ink-100 pl-6">
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(tier)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(tier)}
                      className="text-danger hover:text-danger hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* 新增/编辑 Modal 表单 */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        maxWidth="md"
        title={editingTier ? '编辑等级' : '新增等级'}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={closeModal} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit(onSubmitForm)}
              loading={isSubmitting}
            >
              {editingTier ? '保存修改' : '确认新增'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">
                等级名称 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="如 L1 普通"
                className={cn(
                  'w-full h-10 px-3 rounded-md border text-sm',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                  errors.name
                    ? 'border-danger bg-red-50'
                    : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
                )}
                {...register('name')}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">
                等级数字 <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="1 / 2 / 3"
                className={cn(
                  'w-full h-10 px-3 rounded-md border text-sm',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                  errors.level
                    ? 'border-danger bg-red-50'
                    : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
                )}
                {...register('level', { valueAsNumber: true })}
              />
              {errors.level && (
                <p className="mt-1 text-xs text-danger">{errors.level.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              免费仓位数 <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="每租户可使用的免费仓位数"
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                errors.freeQuota
                  ? 'border-danger bg-red-50'
                  : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
              )}
              {...register('freeQuota', { valueAsNumber: true })}
            />
            {errors.freeQuota && (
              <p className="mt-1 text-xs text-danger">{errors.freeQuota.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              升级结转比例（%）
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="80"
                className={cn(
                  'w-full h-10 pl-3 pr-8 rounded-md border text-sm',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                  errors.upgradeCarryRatio
                    ? 'border-danger bg-red-50'
                    : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
                )}
                {...register('upgradeCarryRatio', { valueAsNumber: true })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              租户升级时，旧额度按此比例结转到新等级
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">降级方式</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-700">
                <input
                  type="radio"
                  value="reset"
                  checked={downgradeMode === 'reset'}
                  onChange={() => {
                    setValue('downgradeMode', 'reset');
                  }}
                  className="w-4 h-4 text-brand-500 focus:ring-brand-400"
                />
                <span>清零重置</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-700">
                <input
                  type="radio"
                  value="ratio"
                  checked={downgradeMode === 'ratio'}
                  onChange={() => {
                    setValue('downgradeMode', 'ratio');
                  }}
                  className="w-4 h-4 text-brand-500 focus:ring-brand-400"
                />
                <span>按比例结转</span>
              </label>
            </div>
          </div>

          {downgradeMode === 'ratio' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-ink-700 mb-1.5">
                降级结转比例（%） <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="50"
                  className={cn(
                    'w-full h-10 pl-3 pr-8 rounded-md border text-sm',
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
                    errors.downgradeCarryRatio
                      ? 'border-danger bg-red-50'
                      : 'border-ink-200 hover:border-ink-300 focus:border-brand-400'
                  )}
                  {...register('downgradeCarryRatio', { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                  %
                </span>
              </div>
              {errors.downgradeCarryRatio && (
                <p className="mt-1 text-xs text-danger">
                  {errors.downgradeCarryRatio.message}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-400">
                租户降级时，旧额度按此比例结转到新等级
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              标识颜色 <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    'border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-400',
                    selectedColor === color
                      ? 'border-ink-700 scale-110 shadow-md'
                      : 'border-white hover:scale-105 hover:shadow-sm'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`颜色 ${color}`}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setValue('color', e.target.value)}
                  className="w-8 h-8 rounded-md border border-ink-200 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={selectedColor}
                  onChange={(e) => setValue('color', e.target.value)}
                  className="w-24 h-8 px-2 rounded-md border border-ink-200 text-xs font-mono text-ink-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
            </div>
            {errors.color && (
              <p className="mt-2 text-xs text-danger">{errors.color.message}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingTier(null);
        }}
        onConfirm={confirmDelete}
        title="确认删除等级"
        message={
          deletingTier
            ? `确定要删除等级「${deletingTier.name}」吗？\n\n删除后，已分配该等级的租户将被重置为默认等级。`
            : ''
        }
        confirmText="确认删除"
        danger={true}
        loading={deleteLoading}
      />
    </div>
  );
}
