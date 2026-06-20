import { useCallback, useMemo, useState } from 'react';
import {
  Search,
  Eye,
  Snowflake,
  Sun,
  UserPlus,
  ChevronDown,
  AlertTriangle,
  MapPin,
  Calendar as CalendarIcon,
  Ruler,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AccessStatusBadge } from '@/components/shared/AccessStatusBadge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import type { StorageUnit, StorageUnitSize, AccessGrantStatus, AccessGrant } from '@/types';

// 规格徽章颜色配置
const SIZE_BADGE_CONFIG: Record<StorageUnitSize, { label: string; className: string }> = {
  S: {
    label: 'S 小型',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  M: {
    label: 'M 中型',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  L: {
    label: 'L 大型',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  XL: {
    label: 'XL 超大型',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

// 卡片左侧状态色条配置
const STATUS_COLOR_BAR: Record<AccessGrantStatus | 'idle', string> = {
  active: 'bg-success',
  frozen: 'bg-danger',
  expired: 'bg-ink-400',
  idle: 'bg-brand-400',
};

// 状态筛选选项
const STATUS_FILTER_OPTIONS: { value: AccessGrantStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'frozen', label: '冻结' },
  { value: 'expired', label: '过期' },
];

// 区域选项
const ZONE_OPTIONS = ['A', 'B', 'C'];

export default function AccessControlPage() {
  const {
    storageUnits,
    accessGrants,
    tenants,
    bills,
    createAccessGrant,
    freezeAccess,
    unfreezeAccess,
  } = useAppStore();

  // 筛选状态
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<AccessGrantStatus | 'all'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 授权 Modal 状态
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<StorageUnit | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [grantStartDate, setGrantStartDate] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
  const [grantEndDate, setGrantEndDate] = useState('');

  // 详情 Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // ========== 辅助函数 ==========

  // 切换区域多选
  const toggleZone = (zone: string) => {
    const next = new Set(selectedZones);
    if (next.has(zone)) {
      next.delete(zone);
    } else {
      next.add(zone);
    }
    setSelectedZones(next);
  };

  // 为每个仓库单元找到对应的授权记录
  const getGrantForUnit = useCallback(
    (unitId: string): AccessGrant | undefined => {
      const grants = accessGrants.filter((g) => g.unitId === unitId && g.status !== 'expired');
      if (grants.length === 0) return undefined;
      return grants[grants.length - 1];
    },
    [accessGrants],
  );

  // 计算单元的展示状态
  const getDisplayStatus = useCallback(
    (
      unit: StorageUnit,
      grant?: AccessGrant,
    ): AccessGrantStatus | 'idle' => {
      if (!grant) return 'idle';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(grant.endDate) < today && grant.status !== 'frozen') {
        return 'expired';
      }
      return grant.status;
    },
    [],
  );

  // 检查租户是否有欠费账单（用于授权时警告）
  const hasUnpaidBills = useCallback(
    (tenantId: string): boolean => {
      return bills.some(
        (b) =>
          b.tenantId === tenantId &&
          (b.status === 'pending' || b.status === 'overdue') &&
          b.totalAmount - b.paidAmount > 0,
      );
    },
    [bills],
  );

  // 找到授权对应的租户
  const getTenantById = useCallback(
    (tenantId: string) => tenants.find((t) => t.id === tenantId),
    [tenants],
  );

  // ========== 筛选逻辑 ==========
  const filteredUnits = useMemo(() => {
    return storageUnits.filter((unit) => {
      // 区域筛选
      if (selectedZones.size > 0 && !selectedZones.has(unit.zone)) {
        return false;
      }

      // 状态筛选
      if (selectedStatus !== 'all') {
        const grant = getGrantForUnit(unit.id);
        const displayStatus = getDisplayStatus(unit, grant);
        if (displayStatus !== selectedStatus) {
          return false;
        }
      }

      // 租户搜索
      if (searchKeyword.trim()) {
        const grant = getGrantForUnit(unit.id);
        if (!grant) return false;
        const tenant = getTenantById(grant.tenantId);
        if (!tenant) return false;
        const keyword = searchKeyword.trim().toLowerCase();
        if (
          !tenant.name.toLowerCase().includes(keyword) &&
          !tenant.phone.includes(keyword)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [storageUnits, selectedZones, selectedStatus, searchKeyword, getGrantForUnit, getDisplayStatus, getTenantById]);

  // ========== 操作处理 ==========

  // 打开授权 Modal
  const openGrantModal = (unit: StorageUnit) => {
    setCurrentUnit(unit);
    // 预填当前已授权的租户
    const existingGrant = getGrantForUnit(unit.id);
    if (existingGrant) {
      setSelectedTenantId(existingGrant.tenantId);
      setGrantStartDate(existingGrant.startDate);
      setGrantEndDate(existingGrant.endDate);
    } else {
      setSelectedTenantId('');
      setGrantStartDate(formatDate(new Date(), 'yyyy-MM-dd'));
      setGrantEndDate('');
    }
    setGrantModalOpen(true);
  };

  // 提交授权
  const handleSubmitGrant = () => {
    if (!currentUnit || !selectedTenantId || !grantStartDate || !grantEndDate) return;
    createAccessGrant({
      tenantId: selectedTenantId,
      unitId: currentUnit.id,
      startDate: grantStartDate,
      endDate: grantEndDate,
    });
    setGrantModalOpen(false);
  };

  // 查看详情
  const handleViewDetail = (unit: StorageUnit) => {
    setCurrentUnit(unit);
    setDetailModalOpen(true);
  };

  // 冻结
  const handleFreeze = (unit: StorageUnit) => {
    const grant = getGrantForUnit(unit.id);
    if (!grant) return;
    freezeAccess(grant.id, '管理员手动冻结');
  };

  // 解冻
  const handleUnfreeze = (unit: StorageUnit) => {
    const grant = getGrantForUnit(unit.id);
    if (!grant) return;
    unfreezeAccess(grant.id);
  };

  // ========== 渲染 ==========

  // 当前选中的租户（用于欠费警告）
  const selectedTenant = selectedTenantId ? getTenantById(selectedTenantId) : null;
  const selectedTenantHasUnpaid = selectedTenant ? hasUnpaidBills(selectedTenant.id) : false;

  return (
    <div className="space-y-6">
      {/* 页面标题区 */}
      <div>
        <h2 className="text-2xl font-serif-semibold text-ink-700">门禁授权</h2>
        <p className="text-sm text-ink-400 mt-1">
          管理各仓库单元的门禁授权，支持冻结、解冻与重新授权
        </p>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* 区域多选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-ink-600 whitespace-nowrap">区域：</span>
              <div className="flex items-center gap-2">
                {ZONE_OPTIONS.map((zone) => {
                  const isActive = selectedZones.has(zone);
                  const isAll = selectedZones.size === 0;
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => toggleZone(zone)}
                      className={cn(
                        'px-3 h-8 rounded-md text-sm font-medium border transition-colors',
                        isActive
                          ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                          : isAll
                            ? 'bg-white text-ink-500 border-ink-200 hover:border-brand-300 hover:text-brand-600'
                            : 'bg-white text-ink-500 border-ink-200 hover:border-brand-300 hover:text-brand-600',
                      )}
                    >
                      {zone} 区
                    </button>
                  );
                })}
                {selectedZones.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedZones(new Set())}
                    className="text-xs text-ink-400 hover:text-brand-600 underline-offset-2 hover:underline"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">状态：</span>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as AccessGrantStatus | 'all')}
                  className="h-9 pl-3 pr-8 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 租户搜索 */}
            <div className="flex-1 min-w-[240px] max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索租户姓名或手机号..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
            </div>

            {/* 统计信息 */}
            <div className="ml-auto text-sm text-ink-500">
              共{' '}
              <strong className="text-ink-700 font-mono">{filteredUnits.length}</strong>{' '}
              个仓库单元
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 仓号列表 卡片网格 */}
      {filteredUnits.length === 0 ? (
        <div className="panel-card p-16 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center text-ink-300">
            <MapPin className="w-8 h-8" />
          </div>
          <div className="text-ink-500">暂无匹配的仓库单元</div>
          <div className="text-ink-400 text-xs">请调整筛选条件后重试</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map((unit) => {
            const grant = getGrantForUnit(unit.id);
            const displayStatus = getDisplayStatus(unit, grant);
            const tenant = grant ? getTenantById(grant.tenantId) : undefined;
            const sizeConfig = SIZE_BADGE_CONFIG[unit.size];
            const statusColor = STATUS_COLOR_BAR[displayStatus];

            return (
              <div
                key={unit.id}
                className={cn(
                  'relative panel-card overflow-hidden transition-all duration-200',
                  'hover:shadow-cardHover hover:-translate-y-[2px]',
                )}
              >
                {/* 左侧竖条：状态色条 */}
                <div
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-1.5',
                    statusColor,
                  )}
                />

                <div className="pl-4 pr-4 pt-4 pb-4 space-y-4">
                  {/* 顶部：仓号 + 区域 + 规格徽章 */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="font-serif font-bold text-3xl text-ink-800 font-mono tracking-wide">
                        {unit.code}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-500">
                        <MapPin className="w-3 h-3" />
                        {unit.zone} 区
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                          sizeConfig.className,
                        )}
                      >
                        <Ruler className="w-3 h-3 mr-0.5" />
                        {sizeConfig.label}
                      </span>
                      {displayStatus !== 'idle' ? (
                        <AccessStatusBadge
                          status={displayStatus as AccessGrantStatus}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-brand-50 text-brand-600 border-brand-200 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                          待授权
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 中部：授权租户信息 */}
                  <div className="min-h-[56px]">
                    {tenant && grant ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <TenantAvatar name={tenant.name} size="sm" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-ink-800 text-sm truncate">
                              {tenant.name}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-ink-500">
                              <CalendarIcon className="w-3 h-3" />
                              <span className="font-mono">
                                {grant.startDate} ~ {grant.endDate}
                              </span>
                            </div>
                          </div>
                        </div>
                        {grant.status === 'frozen' && grant.frozenReason && (
                          <div className="flex items-start gap-1.5 p-2 rounded bg-red-50 text-red-600 text-xs">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{grant.frozenReason}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-ink-400 italic">
                        暂无授权租户
                      </div>
                    )}
                  </div>

                  {/* 底部：操作按钮组 */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-ink-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={!grant}
                      onClick={() => handleViewDetail(unit)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      查看
                    </Button>
                    {displayStatus === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-danger hover:bg-red-50 hover:text-danger"
                        onClick={() => handleFreeze(unit)}
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        冻结
                      </Button>
                    )}
                    {displayStatus === 'frozen' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-success hover:bg-green-50 hover:text-success"
                        onClick={() => handleUnfreeze(unit)}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        解冻
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => openGrantModal(unit)}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      授权
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== 门禁授权 Modal ========== */}
      <Modal
        open={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-500" />
            门禁授权
          </div>
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setGrantModalOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmitGrant}
              disabled={
                !currentUnit ||
                !selectedTenantId ||
                !grantStartDate ||
                !grantEndDate
              }
            >
              <UserPlus className="w-4 h-4" />
              确认授权
            </Button>
          </>
        }
      >
        {currentUnit && (
          <div className="space-y-5">
            {/* 仓号（只读） */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                仓库单元
              </label>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-ink-50 border border-ink-200">
                <div>
                  <div className="font-mono font-bold text-2xl text-brand-700">
                    {currentUnit.code}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {currentUnit.zone} 区 · {SIZE_BADGE_CONFIG[currentUnit.size].label}
                  </div>
                </div>
              </div>
            </div>

            {/* 租户选择（下拉） */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                授权租户
              </label>
              <div className="relative">
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                >
                  <option value="">请选择租户...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.phone})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 欠费租户警告 */}
            {selectedTenant && selectedTenantHasUnpaid && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">欠费警告</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    该租户存在欠费账单，授权后将在下次账单生成时自动冻结门禁。
                  </p>
                </div>
              </div>
            )}

            {/* 日期范围 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  授权开始日期
                </label>
                <input
                  type="date"
                  value={grantStartDate}
                  onChange={(e) => setGrantStartDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  授权结束日期
                </label>
                <input
                  type="date"
                  value={grantEndDate}
                  onChange={(e) => setGrantEndDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========== 查看详情 Modal ========== */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-500" />
            授权详情 — {currentUnit?.code ?? ''}
          </div>
        }
      >
        {currentUnit ? (() => {
          const currentGrant = getGrantForUnit(currentUnit.id);
          const historyGrants = accessGrants
            .filter((g) => g.unitId === currentUnit.id && g.status === 'expired')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          return (
            <div className="space-y-5">
              {/* 当前有效授权 */}
              <div>
                <h4 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  当前授权
                </h4>
                {currentGrant ? (() => {
                  const tenant = getTenantById(currentGrant.tenantId);
                  const displayStatus = getDisplayStatus(currentUnit, currentGrant) as AccessGrantStatus;
                  return (
                    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-500">授权状态</span>
                        <AccessStatusBadge status={displayStatus} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-500">授权租户</span>
                        {tenant && (
                          <div className="flex items-center gap-2">
                            <TenantAvatar name={tenant.name} size="xs" />
                            <span className="font-medium text-ink-800">{tenant.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-500">授权有效期</span>
                        <span className="font-mono text-sm text-ink-700">
                          {currentGrant.startDate} ~ {currentGrant.endDate}
                        </span>
                      </div>
                      {currentGrant.status === 'frozen' && currentGrant.frozenReason && (
                        <div className="p-3 rounded bg-red-50 border border-red-100">
                          <div className="text-xs text-red-500 font-medium mb-1">冻结原因</div>
                          <div className="text-sm text-red-700">{currentGrant.frozenReason}</div>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-center text-sm text-ink-400 italic">
                    该仓号暂无有效授权
                  </div>
                )}
              </div>

              {/* 历史授权记录 */}
              {historyGrants.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-ink-400" />
                    历史授权（{historyGrants.length}）
                  </h4>
                  <div className="space-y-2">
                    {historyGrants.map((grant) => {
                      const histTenant = getTenantById(grant.tenantId);
                      return (
                        <div
                          key={grant.id}
                          className="rounded-lg border border-ink-100 bg-white p-3 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {histTenant && <TenantAvatar name={histTenant.name} size="xs" />}
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink-700 truncate">
                                {histTenant?.name ?? '未知'}
                              </div>
                              <div className="text-xs text-ink-400 font-mono">
                                {grant.startDate} ~ {grant.endDate}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-ink-400 shrink-0">
                            {grant.createdAt.split(' ')[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="py-8 text-center text-ink-400 text-sm">
            暂无授权记录
          </div>
        )}
      </Modal>
    </div>
  );
}
