import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowUpDown,
  Wallet,
  KeyRound,
  FileText,
  History,
  TrendingUp,
  Package,
  CalendarPlus,
  Calendar,
  Snowflake,
  PlayCircle,
  Check,
  Eye,
  ChevronRight,
  ChevronDown,
  GitMerge,
  TrendingDown,
  CreditCard,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { calculateCarryQuota } from '@/utils/quota';
import type {
  RentalContract,
  AccessGrant,
  Bill,
  QuotaLedger,
  StorageUnit,
  TenantTier,
  TierChangeRecord,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Badge } from '@/components/ui/Badge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { TierBadge } from '@/components/shared/TierBadge';
import { AccessStatusBadge } from '@/components/shared/AccessStatusBadge';
import { BillStatusBadge } from '@/components/shared/BillStatusBadge';
import { TierChangeTimeline } from '@/components/shared/TierChangeTimeline';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

// 状态徽章配置
const STATUS_CONFIG = {
  active: { variant: 'success' as const, label: '正常' },
  frozen: { variant: 'danger' as const, label: '冻结' },
  terminated: { variant: 'slate' as const, label: '已解约' },
};

// 规格徽章配置
const SIZE_CONFIG = {
  S: { variant: 'default' as const, label: '小型 S' },
  M: { variant: 'success' as const, label: '中型 M' },
  L: { variant: 'warning' as const, label: '大型 L' },
  XL: { variant: 'danger' as const, label: '超大 XL' },
};

// 额度流水类型配置
const QUOTA_TYPE_CONFIG: Record<
  QuotaLedger['type'],
  { label: string; variant: 'default' | 'success' | 'danger' | 'amber' | 'slate' | 'warning' }
> = {
  grant: { label: '发放', variant: 'success' },
  consume: { label: '消费', variant: 'danger' },
  refund: { label: '退还', variant: 'success' },
  carry: { label: '结转', variant: 'default' },
  reset: { label: '清零', variant: 'amber' },
  manual: { label: '人工', variant: 'warning' },
};

// Tab 定义
const TABS = [
  { id: 'storage', label: '仓储清单', icon: Package },
  { id: 'access', label: '门禁授权', icon: KeyRound },
  { id: 'bills', label: '账单历史', icon: FileText },
  { id: 'changes', label: '变更轨迹', icon: History },
  { id: 'quota', label: '额度流水', icon: TrendingUp },
  { id: 'timeline', label: '综合时间线', icon: GitMerge },
] as const;

type TabId = (typeof TABS)[number]['id'];

// 格式化日期
function formatDate(isoStr: string): string {
  return isoStr.split(' ')[0];
}

// 格式化日期时间
function formatDateTime(isoStr: string): string {
  return isoStr;
}

// 身份证脱敏
function maskIdCard(id: string): string {
  if (!id || id.length < 8) return id;
  return id.slice(0, 4) + ' **** **** ' + id.slice(-4);
}

// 手机号脱敏
function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// ==================== 新增门禁授权表单 Schema ====================
const AccessGrantSchema = z.object({
  unitId: z.string().min(1, '请选择仓库单元'),
  startDate: z.string().min(1, '请选择开始日期'),
  endDate: z.string().min(1, '请选择结束日期'),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: '结束日期不能早于开始日期',
  path: ['endDate'],
});

type AccessGrantForm = z.infer<typeof AccessGrantSchema>;

// ==================== 调整额度表单 Schema ====================
const AdjustQuotaSchema = z.object({
  delta: z.coerce
    .number()
    .int('请输入整数')
    .refine((n) => n !== 0, '调整数量不能为 0'),
  reason: z.string().min(1, '请输入调整原因'),
});

type AdjustQuotaForm = z.infer<typeof AdjustQuotaSchema>;

// ==================== 主页面组件 ====================
export default function TenantDetailPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const {
    tenants,
    tiers,
    contracts,
    storageUnits,
    accessGrants,
    bills,
    quotaLedgers,
    tierChangeRecords,
    initData,
    getTenantById,
    changeTenantTier,
    markBillPaid,
    freezeAccess,
    unfreezeAccess,
    createAccessGrant,
    session,
    adjustQuota,
  } = useAppStore();

  // 当前激活的 Tab
  const [activeTab, setActiveTab] = useState<TabId>('storage');

  // 弹窗状态
  const [adjustQuotaOpen, setAdjustQuotaOpen] = useState(false);
  const [changeTierOpen, setChangeTierOpen] = useState(false);
  const [accessGrantOpen, setAccessGrantOpen] = useState(false);

  // 冻结弹窗状态
  const [freezeTarget, setFreezeTarget] = useState<AccessGrant | null>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeConfirmOpen, setFreezeConfirmOpen] = useState(false);

  useEffect(() => {
    if (
      tenants.length === 0 ||
      tiers.length === 0 ||
      contracts.length === 0
    ) {
      initData();
    }
  }, [tenants.length, tiers.length, contracts.length, initData]);

  const tenant = getTenantById(id);
  const tier = tenant ? tiers.find((t) => t.id === tenant.tierId) : undefined;

  // ==================== 当前租户关联数据 ====================
  const tenantContracts = useMemo(
    () => contracts.filter((c) => c.tenantId === id),
    [contracts, id]
  );

  const tenantAccessGrants = useMemo(
    () => accessGrants.filter((g) => g.tenantId === id),
    [accessGrants, id]
  );

  const tenantBills = useMemo(
    () =>
      bills
        .filter((b) => b.tenantId === id)
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()),
    [bills, id]
  );

  const tenantQuotaLedgers = useMemo(
    () =>
      quotaLedgers
        .filter((l) => l.tenantId === id)
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [quotaLedgers, id]
  );

  // 已租用的仓库单元（用于门禁授权选择）
  const rentedUnits = useMemo(() => {
    return tenantContracts
      .filter((c) => c.status === 'active')
      .map((c) => ({
        contract: c,
        unit: storageUnits.find((u) => u.id === c.unitId),
      }))
      .filter((x) => x.unit) as { contract: RentalContract; unit: StorageUnit }[];
  }, [tenantContracts, storageUnits]);

  // 404 空状态
  if (!tenant) {
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate('/tenants')}
        >
          <ArrowLeft className="w-4 h-4" />
          返回租户列表
        </Button>
        <EmptyState
          title="租户不存在"
          description="该租户信息可能已被删除，或链接无效。"
          action={{
            label: '返回租户列表',
            onClick: () => navigate('/tenants'),
            variant: 'primary',
          }}
        />
      </div>
    );
  }

  const freeQuota = tier?.freeQuota ?? 0;
  const usedQuota = Math.max(0, freeQuota - tenant.currentQuota);
  const usagePercent = freeQuota > 0 ? Math.round((usedQuota / freeQuota) * 100) : 0;

  // 进度环颜色
  const ringColor =
    usagePercent >= 85
      ? '#DC2626'
      : usagePercent >= 60
        ? '#E8A838'
        : '#2E8B57';

  return (
    <div className="space-y-5">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate('/tenants')}
      >
        <ArrowLeft className="w-4 h-4" />
        返回租户列表
      </Button>

      {/* 顶部信息横幅 */}
      <div className="rounded-xl overflow-hidden border border-ink-100 shadow-card">
        <div className="bg-brand-soft relative">
          <div
            className="absolute inset-0 opacity-30 bg-grain pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            {/* 左侧：个人信息 */}
            <div className="flex items-start gap-5">
              <TenantAvatar name={tenant.name} size="lg" className="!w-20 !h-20 !text-3xl ring-4 ring-white shadow-lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  <h1 className="text-2xl font-serif font-bold text-ink-800">
                    {tenant.name}
                  </h1>
                  <TierBadge tierId={tenant.tierId} />
                  <Badge variant={STATUS_CONFIG[tenant.status].variant}>
                    {STATUS_CONFIG[tenant.status].label}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-ink-600">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-400">手机</span>
                    <span className="font-mono tabular-nums">
                      {maskPhone(tenant.phone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-400">身份证</span>
                    <span className="font-mono tabular-nums text-xs">
                      {maskIdCard(tenant.idCardNo)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-400">加入日期</span>
                    <span>{formatDate(tenant.createdAt)}</span>
                  </div>
                  {tenant.remark && (
                    <div className="flex items-start gap-2 mt-1.5 pt-1.5 border-t border-ink-100/60">
                      <span className="text-ink-400 shrink-0">备注</span>
                      <span className="text-amber-700 text-xs">
                        {tenant.remark}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧：额度概览大卡 */}
            <div className="w-full md:w-auto shrink-0 bg-white/80 backdrop-blur rounded-xl border border-white shadow-lg p-5">
              <div className="flex items-center gap-5">
                {/* 环形进度 */}
                <ProgressRing
                  percent={usagePercent}
                  size={110}
                  stroke={12}
                  color={ringColor}
                />
                {/* 额度数字 + 按钮 */}
                <div className="flex flex-col gap-3 min-w-[200px]">
                  <div>
                    <div className="text-xs text-ink-400 mb-1">当前额度 / 总额度</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-serif font-bold text-ink-800 tabular-nums">
                        {tenant.currentQuota}
                      </span>
                      <span className="text-ink-300 text-lg">/</span>
                      <span className="text-xl text-ink-500 font-medium tabular-nums">
                        {freeQuota}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-400">
                      已使用 {usedQuota} · 累计使用{' '}
                      <span className="font-mono tabular-nums">{tenant.totalUsedQuota}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAdjustQuotaOpen(true)}
                    >
                      <Wallet className="w-4 h-4" />
                      调整额度
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeTierOpen(true)}
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      升降级
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab 导航条 */}
        <div className="bg-white border-t border-ink-100 px-4 md:px-6">
          <div className="flex items-center gap-1 overflow-x-auto -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 px-4 py-3.5 text-sm whitespace-nowrap transition-colors',
                    active
                      ? 'text-brand-700 font-semibold'
                      : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50/50'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-500 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab 内容区 */}
      <div className="animate-fade-in">
        {activeTab === 'storage' && (
          <StorageTab
            contracts={tenantContracts}
            units={storageUnits}
          />
        )}
        {activeTab === 'access' && (
          <AccessTab
            grants={tenantAccessGrants}
            units={storageUnits}
            onAdd={() => setAccessGrantOpen(true)}
            onFreeze={(g) => {
              setFreezeTarget(g);
              setFreezeReason('');
            }}
            onUnfreeze={(id) => unfreezeAccess(id)}
          />
        )}
        {activeTab === 'bills' && (
          <BillsTab
            bills={tenantBills}
            onMarkPaid={(billId) => markBillPaid(billId)}
          />
        )}
        {activeTab === 'changes' && (
          <div className="panel-card p-6">
            <TierChangeTimeline tenantId={id} />
          </div>
        )}
        {activeTab === 'quota' && <QuotaTab ledgers={tenantQuotaLedgers} />}
        {activeTab === 'timeline' && (
          <MergedTimelineTab
            tenantId={id}
            tierChangeRecords={tierChangeRecords}
            quotaLedgers={tenantQuotaLedgers}
            accessGrants={tenantAccessGrants}
            bills={tenantBills}
            tiers={tiers}
            storageUnits={storageUnits}
            contracts={tenantContracts}
          />
        )}
      </div>

      {/* 调整额度弹窗 */}
      {adjustQuotaOpen && (
        <AdjustQuotaModal
          tenantName={tenant.name}
          currentQuota={tenant.currentQuota}
          onClose={() => setAdjustQuotaOpen(false)}
          onConfirm={(delta, reason) => {
            adjustQuota({
              tenantId: id,
              delta,
              reason,
              operatorId: session.operatorId,
              operatorName: session.operatorName,
            });
            setAdjustQuotaOpen(false);
          }}
        />
      )}

      {/* 升降级弹窗（复用列表页的模式） */}
      {changeTierOpen && (
        <ChangeTierInlineModal
          tenantId={id}
          tenantName={tenant.name}
          currentTierId={tenant.tierId}
          currentQuota={tenant.currentQuota}
          tiers={tiers}
          onClose={() => setChangeTierOpen(false)}
          onConfirm={(toTierId, reason) => {
            changeTenantTier({
              tenantId: id,
              toTierId,
              reason,
              operatorId: session.operatorId,
              operatorName: session.operatorName,
            });
            setChangeTierOpen(false);
          }}
        />
      )}

      {/* 新增门禁授权弹窗 */}
      <AccessGrantModal
        open={accessGrantOpen}
        rentedUnits={rentedUnits}
        onClose={() => setAccessGrantOpen(false)}
        onSubmit={(data) => {
          createAccessGrant({
            tenantId: id,
            unitId: data.unitId,
            startDate: data.startDate,
            endDate: data.endDate,
          });
          setAccessGrantOpen(false);
        }}
      />

      {/* 冻结门禁二次确认 */}
      {freezeTarget && (
        <>
          <ConfirmDialog
            open={freezeConfirmOpen}
            onClose={() => setFreezeConfirmOpen(false)}
            onConfirm={() => {
              if (freezeTarget && freezeReason.trim()) {
                freezeAccess(freezeTarget.id, freezeReason.trim());
              }
              setFreezeConfirmOpen(false);
              setFreezeTarget(null);
              setFreezeReason('');
            }}
            title="确认冻结门禁"
            message="确认后该租户将无法使用对应仓库门禁，是否继续？"
            confirmText="确认冻结"
            danger={true}
          />
          {/* 冻结原因弹窗 */}
          <Modal
            open={!freezeConfirmOpen && freezeTarget !== null}
            onClose={() => setFreezeTarget(null)}
            maxWidth="sm"
            title="冻结门禁原因"
            footer={
              <>
                <Button variant="ghost" size="md" onClick={() => setFreezeTarget(null)}>
                  取消
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    if (freezeReason.trim()) {
                      setFreezeConfirmOpen(true);
                    }
                  }}
                  disabled={!freezeReason.trim()}
                >
                  提交冻结
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="text-sm text-ink-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                冻结仓库：
                <span className="font-medium text-amber-800">
                  {storageUnits.find((u) => u.id === freezeTarget.unitId)?.code}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1.5">
                  冻结原因 <span className="text-danger">*</span>
                </label>
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  rows={3}
                  placeholder="请输入冻结原因（必填）"
                  className={cn(
                    'w-full rounded-md border border-ink-200 bg-white p-3',
                    'text-sm text-ink-700 placeholder:text-ink-400',
                    'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                    'resize-none transition-all'
                  )}
                />
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

// ==================== Tab① 仓储清单 ====================
interface StorageTabProps {
  contracts: RentalContract[];
  units: StorageUnit[];
}

function StorageTab({ contracts, units }: StorageTabProps) {
  const columns: DataTableColumn<RentalContract>[] = [
    {
      key: 'code',
      title: '仓号',
      width: '120px',
      render: (row) => {
        const unit = units.find((u) => u.id === row.unitId);
        return (
          <span className="font-mono font-medium text-brand-700">
            {unit?.code ?? '-'}
          </span>
        );
      },
    },
    {
      key: 'zone',
      title: '区域',
      width: '100px',
      render: (row) => {
        const unit = units.find((u) => u.id === row.unitId);
        return <span>{unit?.zone ? `${unit.zone} 区` : '-'}</span>;
      },
    },
    {
      key: 'size',
      title: '规格',
      width: '120px',
      render: (row) => {
        const unit = units.find((u) => u.id === row.unitId);
        if (!unit) return '-';
        const cfg = SIZE_CONFIG[unit.size];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'startDate',
      title: '起租日',
      width: '120px',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      title: '到期日',
      width: '120px',
      render: (row) => (row.endDate ? formatDate(row.endDate) : '—'),
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'slate'}>
          {row.status === 'active' ? '租赁中' : '已结束'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={row.status !== 'active'}
          onClick={() => alert(`退租：合同 ${row.id}`)}
        >
          退租
        </Button>
      ),
    },
  ];

  if (contracts.length === 0) {
    return (
      <div className="panel-card p-8">
        <EmptyState
          icon={Package}
          title="暂无仓储记录"
          description="该租户当前没有租用中的仓库。"
          size="sm"
        />
      </div>
    );
  }

  return (
    <DataTable<RentalContract>
      columns={columns}
      data={contracts}
      rowKey="id"
      emptyText="暂无仓储记录"
    />
  );
}

// ==================== Tab② 门禁授权 ====================
interface AccessTabProps {
  grants: AccessGrant[];
  units: StorageUnit[];
  onAdd: () => void;
  onFreeze: (g: AccessGrant) => void;
  onUnfreeze: (id: string) => void;
}

function AccessTab({ grants, units, onAdd, onFreeze, onUnfreeze }: AccessTabProps) {
  const columns: DataTableColumn<AccessGrant>[] = [
    {
      key: 'code',
      title: '仓号',
      width: '120px',
      render: (row) => {
        const unit = units.find((u) => u.id === row.unitId);
        return (
          <span className="font-mono font-medium text-brand-700">
            {unit?.code ?? '-'}
          </span>
        );
      },
    },
    {
      key: 'startDate',
      title: '授权开始',
      width: '120px',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      title: '授权结束',
      width: '120px',
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      render: (row) => <AccessStatusBadge status={row.status} />,
    },
    {
      key: 'frozenReason',
      title: '冻结原因',
      width: '200px',
      render: (row) =>
        row.frozenReason ? (
          <span className="text-xs text-danger">{row.frozenReason}</span>
        ) : (
          <span className="text-ink-300 text-xs">—</span>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '160px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFreeze(row)}
            >
              <Snowflake className="w-4 h-4" />
              冻结
            </Button>
          ) : row.status === 'frozen' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onUnfreeze(row.id)}
            >
              <PlayCircle className="w-4 h-4" />
              解冻
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={onAdd}>
          <CalendarPlus className="w-4 h-4" />
          新增门禁授权
        </Button>
      </div>
      {grants.length === 0 ? (
        <div className="panel-card p-8">
          <EmptyState
            icon={KeyRound}
            title="暂无门禁授权"
            description="点击右上角按钮为该租户添加门禁授权。"
            size="sm"
          />
        </div>
      ) : (
        <DataTable<AccessGrant>
          columns={columns}
          data={grants}
          rowKey="id"
          emptyText="暂无门禁授权"
        />
      )}
    </div>
  );
}

// ==================== Tab③ 账单历史 ====================
interface BillsTabProps {
  bills: Bill[];
  onMarkPaid: (id: string) => void;
}

function BillsTab({ bills, onMarkPaid }: BillsTabProps) {
  if (bills.length === 0) {
    return (
      <div className="panel-card p-8">
        <EmptyState
          icon={FileText}
          title="暂无账单记录"
          description="该租户目前没有产生账单。"
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {bills.map((bill) => (
        <Card key={bill.id} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-5 border-b border-ink-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-ink-800 text-sm truncate">
                    {bill.billNo}
                  </div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    账期 {formatDate(bill.periodStart)} ~ {formatDate(bill.periodEnd)}
                  </div>
                </div>
                <BillStatusBadge status={bill.status} className="shrink-0" />
              </div>
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-xs text-ink-400">¥</span>
                <span className="text-2xl font-serif font-bold text-ink-800 tabular-nums">
                  {bill.totalAmount.toFixed(2)}
                </span>
              </div>
              {bill.status !== 'pending' && (
                <div className="text-xs text-ink-400 text-right mt-1">
                  已支付 ¥
                  <span className="tabular-nums">{bill.paidAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="p-3 bg-ink-50/50 flex items-center justify-between gap-2">
              <Button
                as="a"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                <Eye className="w-4 h-4" />
                查看详情
                <ChevronRight className="w-4 h-4" />
              </Button>
              {bill.status === 'pending' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => onMarkPaid(bill.id)}
                >
                  <Check className="w-4 h-4" />
                  标记已支付
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== Tab⑤ 额度流水 ====================
interface QuotaTabProps {
  ledgers: QuotaLedger[];
}

function QuotaTab({ ledgers }: QuotaTabProps) {
  const columns: DataTableColumn<QuotaLedger>[] = [
    {
      key: 'type',
      title: '变动类型',
      width: '120px',
      render: (row) => {
        const cfg = QUOTA_TYPE_CONFIG[row.type];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'delta',
      title: '变动',
      width: '120px',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            row.delta > 0 ? 'text-success' : 'text-danger'
          )}
        >
          {row.delta > 0 ? '+' : ''}
          {row.delta}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      title: '余额',
      width: '100px',
      align: 'right',
      render: (row) => (
        <span className="font-mono tabular-nums font-medium">
          {row.balanceAfter}
        </span>
      ),
    },
    {
      key: 'reason',
      title: '原因 / 说明',
      render: (row) => (
        <span className="text-sm text-ink-600">{row.reason}</span>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      width: '100px',
      render: (row) => (
        <span className="text-xs text-ink-500">{row.operatorName}</span>
      ),
    },
    {
      key: 'createdAt',
      title: '时间',
      width: '170px',
      render: (row) => (
        <span className="text-xs text-ink-400 font-mono tabular-nums">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  if (ledgers.length === 0) {
    return (
      <div className="panel-card p-8">
        <EmptyState
          icon={TrendingUp}
          title="暂无额度流水"
          description="该租户目前没有额度变动记录。"
          size="sm"
        />
      </div>
    );
  }

  return (
    <DataTable<QuotaLedger>
      columns={columns}
      data={ledgers}
      rowKey="id"
      emptyText="暂无额度流水"
    />
  );
}

// ==================== 调整额度弹窗 ====================
interface AdjustQuotaModalProps {
  tenantName: string;
  currentQuota: number;
  onClose: () => void;
  onConfirm: (delta: number, reason: string) => void;
}

function AdjustQuotaModal({
  tenantName,
  currentQuota,
  onClose,
  onConfirm,
}: AdjustQuotaModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdjustQuotaForm>({
    resolver: zodResolver(AdjustQuotaSchema),
    defaultValues: {
      delta: 1,
      reason: '',
    },
  });

  const delta = watch('delta') ?? 0;
  const previewBalance = Math.max(0, currentQuota + delta);

  return (
    <Modal
      open={true}
      onClose={onClose}
      maxWidth="md"
      title={`为【${tenantName}】调整额度`}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit((d) => onConfirm(d.delta, d.reason))}
            loading={isSubmitting}
          >
            确认调整
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit((d) => onConfirm(d.delta, d.reason))} className="space-y-5">
        {/* 当前余额 */}
        <div className="rounded-lg border border-ink-100 bg-ink-50 p-4 flex items-center justify-between">
          <span className="text-sm text-ink-500">当前剩余额度</span>
          <span className="text-2xl font-serif font-bold text-brand-700 tabular-nums">
            {currentQuota}
          </span>
        </div>

        {/* 调整数量 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            调整数量 <span className="text-danger">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              {...register('delta')}
              type="number"
              step={1}
              className={cn(
                'flex-1 h-10 px-3 rounded-md border text-sm font-mono tabular-nums',
                'text-ink-700 placeholder:text-ink-400',
                'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                errors.delta ? 'border-danger' : 'border-ink-200'
              )}
            />
            <div className="text-sm text-ink-400">正数增加 / 负数扣减</div>
          </div>
          {errors.delta && (
            <p className="mt-1 text-xs text-danger">{errors.delta.message}</p>
          )}
        </div>

        {/* 预览 */}
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4">
          <div className="text-xs font-medium text-brand-700 mb-2">调整预览</div>
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="text-xl font-mono tabular-nums text-ink-500">
              {currentQuota}
            </span>
            <span
              className={cn(
                'text-xl font-mono tabular-nums font-semibold',
                delta >= 0 ? 'text-success' : 'text-danger'
              )}
            >
              {delta >= 0 ? `+ ${delta}` : `- ${Math.abs(delta)}`}
            </span>
            <span className="text-xl text-ink-300">=</span>
            <span className="text-2xl font-serif font-bold text-brand-700 tabular-nums">
              {previewBalance}
            </span>
          </div>
        </div>

        {/* 调整原因 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            调整原因 <span className="text-danger">*</span>
          </label>
          <textarea
            {...register('reason')}
            rows={3}
            placeholder="请输入调整原因（必填）"
            className={cn(
              'w-full rounded-md border border-ink-200 bg-white p-3',
              'text-sm text-ink-700 placeholder:text-ink-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
              'resize-none transition-all'
            )}
          />
          {errors.reason && (
            <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ==================== 升降级弹窗（详情页内联版） ====================
interface ChangeTierInlineModalProps {
  tenantId: string;
  tenantName: string;
  currentTierId: string;
  currentQuota: number;
  tiers: TenantTier[];
  onClose: () => void;
  onConfirm: (toTierId: string, reason: string) => void;
}

function ChangeTierInlineModal({
  tenantName,
  currentTierId,
  currentQuota,
  tiers,
  onClose,
  onConfirm,
}: ChangeTierInlineModalProps) {
  const currentTier = tiers.find((t) => t.id === currentTierId);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const availableTiers = tiers.filter((t) => t.id !== currentTierId);
  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  const preview = useMemo(() => {
    if (!currentTier || !selectedTier) return null;
    return calculateCarryQuota({
      currentQuota,
      fromTier: currentTier,
      toTier: selectedTier,
    });
  }, [currentTier, selectedTier, currentQuota]);

  const isUpgrade =
    selectedTier && currentTier && selectedTier.level > currentTier.level;

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        maxWidth="lg"
        title={`为【${tenantName}】调整等级`}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (selectedTierId && reason.trim()) {
                  setConfirmOpen(true);
                }
              }}
              disabled={!selectedTierId || !reason.trim()}
            >
              确认调整
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* 当前等级 */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-2">
              当前等级
            </label>
            <div className="rounded-lg border border-ink-100 bg-ink-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: currentTier?.color ?? '#94A3B8' }}
                >
                  L{currentTier?.level ?? '?'}
                </div>
                <div>
                  <div className="font-serif-semibold text-ink-800">
                    {currentTier?.name ?? '未知'}
                  </div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    基础额度 {currentTier?.freeQuota ?? 0} · 当前剩余{' '}
                    <span className="font-mono tabular-nums">{currentQuota}</span>
                  </div>
                </div>
              </div>
              <Badge variant="slate">不可选</Badge>
            </div>
          </div>

          {/* 目标等级选择 */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-2">
              目标等级
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableTiers.map((tier) => {
                const selected = selectedTierId === tier.id;
                const tierIsUpgrade =
                  currentTier && tier.level > currentTier.level;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      selected
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-400/30 shadow-sm'
                        : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: tier.color }}
                      >
                        L{tier.level}
                      </div>
                      <span className="font-medium text-ink-800 text-sm truncate">
                        {tier.name}
                      </span>
                    </div>
                    <div className="text-xs text-ink-400">
                      基础额度 {tier.freeQuota}
                    </div>
                    <div className="mt-1.5">
                      <Badge
                        variant={tierIsUpgrade ? 'success' : 'amber'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tierIsUpgrade ? '升级' : '降级'}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 预览区 */}
          {preview && selectedTier && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <span className="font-serif-semibold text-brand-700 text-sm">
                  变更预览
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">结转策略</span>
                  <Badge
                    variant={preview.strategy === 'reset' ? 'amber' : 'default'}
                  >
                    {preview.strategy === 'ratio' ? '按比例结转' : '清零策略'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">变更方向</span>
                  <Badge variant={isUpgrade ? 'success' : 'danger'}>
                    {isUpgrade ? '升级' : '降级'}
                  </Badge>
                </div>
                <div className="rounded border border-ink-200 bg-white p-3 font-mono text-xs text-ink-600 break-all leading-relaxed">
                  {preview.calculation}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-ink-100">
                  <span className="text-ink-500">变更后新额度</span>
                  <span className="text-xl font-serif font-bold text-brand-700 tabular-nums">
                    {preview.newQuota}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 变更原因 */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-2">
              变更原因 <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入升降级原因（必填）"
              rows={3}
              className={cn(
                'w-full rounded-md border border-ink-200 bg-white p-3',
                'text-sm text-ink-700 placeholder:text-ink-400',
                'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                'resize-none transition-all'
              )}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          onConfirm(selectedTierId, reason.trim());
          setConfirmOpen(false);
        }}
        title="确认等级调整"
        message={`确定要将【${tenantName}】从【${currentTier?.name}】调整为【${selectedTier?.name}】吗？\n调整后额度将变为：${preview?.newQuota ?? '?'}（${preview?.strategy === 'ratio' ? '按比例结转' : '清零策略'}）`}
        confirmText="确认调整"
        danger={!isUpgrade}
      />
    </>
  );
}

// ==================== 新增门禁授权弹窗 ====================
interface AccessGrantModalProps {
  open: boolean;
  rentedUnits: { contract: RentalContract; unit: StorageUnit }[];
  onClose: () => void;
  onSubmit: (data: AccessGrantForm) => void;
}

function AccessGrantModal({
  open,
  rentedUnits,
  onClose,
  onSubmit,
}: AccessGrantModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AccessGrantForm>({
    resolver: zodResolver(AccessGrantSchema),
    defaultValues: {
      unitId: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
    },
  });

  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  const dateRangeInvalid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return new Date(startDate) > new Date(endDate);
  }, [startDate, endDate]);

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate || dateRangeInvalid) return 0;
    return Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  }, [startDate, endDate, dateRangeInvalid]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="md"
      title="新增门禁授权"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={rentedUnits.length === 0 || dateRangeInvalid}
          >
            确认授权
          </Button>
        </>
      }
    >
      {rentedUnits.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center">
          该租户当前没有已租用的仓库单元，无法新增门禁授权。
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          {/* 仓库选择 */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">
              仓库单元 <span className="text-danger">*</span>
            </label>
            <select
              {...register('unitId')}
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm text-ink-700 bg-white',
                'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                errors.unitId ? 'border-danger' : 'border-ink-200'
              )}
            >
              <option value="">请选择已租用的仓库</option>
              {rentedUnits.map(({ unit, contract }) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code}（{unit.zone}区 · {SIZE_CONFIG[unit.size].label}
                  {contract.endDate
                    ? ` · 租期至 ${formatDate(contract.endDate)}`
                    : ''}
                  ）
                </option>
              ))}
            </select>
            {errors.unitId && (
              <p className="mt-1 text-xs text-danger">
                {errors.unitId.message}
              </p>
            )}
          </div>

          {/* 起止日期 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                授权开始 <span className="text-danger">*</span>
              </label>
              <input
                {...register('startDate')}
                type="date"
                className={cn(
                  'w-full h-10 px-3 rounded-md border text-sm text-ink-700',
                  'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                  dateRangeInvalid ? 'border-danger' : errors.startDate ? 'border-danger' : 'border-ink-200'
                )}
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-danger">
                  {errors.startDate.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                授权结束 <span className="text-danger">*</span>
              </label>
              <input
                {...register('endDate')}
                type="date"
                className={cn(
                  'w-full h-10 px-3 rounded-md border text-sm text-ink-700',
                  'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                  dateRangeInvalid ? 'border-danger' : errors.endDate ? 'border-danger' : 'border-ink-200'
                )}
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-danger">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          {dateRangeInvalid ? (
            <p className="text-xs text-danger flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              开始日期晚于结束日期，请调整
            </p>
          ) : startDate && endDate ? (
            <p className="text-xs text-brand-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              授权共 {dateRangeDays} 天
            </p>
          ) : null}
        </form>
      )}
    </Modal>
  );
}

// ==================== 综合时间线 Tab ====================
type TimelineEventType = 'tier_change' | 'quota' | 'access' | 'bill';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  time: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
  colorClass: string;
  unitIds: string[];
  periodStart?: string;
  periodEnd?: string;
}

const EVENT_TYPE_STYLES: Record<TimelineEventType, { icon: React.ReactNode; colorClass: string }> = {
  tier_change: {
    icon: <TrendingDown className="w-4 h-4" />,
    colorClass: 'bg-violet-100 text-violet-700 border-violet-300',
  },
  quota: {
    icon: <Wallet className="w-4 h-4" />,
    colorClass: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  access: {
    icon: <ShieldCheck className="w-4 h-4" />,
    colorClass: 'bg-sky-100 text-sky-700 border-sky-300',
  },
  bill: {
    icon: <CreditCard className="w-4 h-4" />,
    colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
};

interface MergedTimelineTabProps {
  tenantId: string;
  tierChangeRecords: TierChangeRecord[];
  quotaLedgers: QuotaLedger[];
  accessGrants: AccessGrant[];
  bills: Bill[];
  tiers: TenantTier[];
  storageUnits: StorageUnit[];
  contracts: RentalContract[];
}

function MergedTimelineTab({
  tenantId,
  tierChangeRecords,
  quotaLedgers,
  accessGrants,
  bills,
  tiers,
  storageUnits,
  contracts,
}: MergedTimelineTabProps) {
  const [filterType, setFilterType] = useState<TimelineEventType | 'all'>('all');
  const [filterUnitId, setFilterUnitId] = useState<string | 'all'>('all');
  const [filterPeriod, setFilterPeriod] = useState<string | 'all'>('all');

  const availableUnits = useMemo(() => {
    const unitSet = new Set<string>();
    for (const g of accessGrants) unitSet.add(g.unitId);
    for (const c of contracts) unitSet.add(c.unitId);
    for (const b of bills) {
      for (const item of b.items) {
        if (item.unitId) unitSet.add(item.unitId);
      }
    }
    return storageUnits.filter(u => unitSet.has(u.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accessGrants, contracts, bills, storageUnits]);

  const availablePeriods = useMemo(() => {
    const periodSet = new Set<string>();
    for (const bill of bills) periodSet.add(bill.periodStart.slice(0, 7));
    return Array.from(periodSet).sort().reverse();
  }, [bills]);

  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    for (const rec of tierChangeRecords.filter(r => r.tenantId === tenantId)) {
      const fromTier = tiers.find(t => t.id === rec.fromTierId);
      const toTier = tiers.find(t => t.id === rec.toTierId);
      events.push({
        id: rec.id,
        type: 'tier_change',
        time: rec.createdAt,
        title: `等级变更：${fromTier?.name ?? '?'} → ${toTier?.name ?? '?'}`,
        detail: `额度 ${rec.quotaBefore} → ${rec.quotaAfter}（${rec.carryStrategy === 'ratio' ? '按比例结转' : '清零策略'}）${rec.reason ? `，原因：${rec.reason}` : ''}`,
        icon: EVENT_TYPE_STYLES.tier_change.icon,
        colorClass: EVENT_TYPE_STYLES.tier_change.colorClass,
        unitIds: [],
      });
    }

    for (const ledger of quotaLedgers) {
      const cfg = QUOTA_TYPE_CONFIG[ledger.type];
      const relatedBill = bills.find(b => ledger.billId === b.id);
      const relatedUnitIds: string[] = [];
      let periodStart: string | undefined;
      let periodEnd: string | undefined;
      if (relatedBill) {
        periodStart = relatedBill.periodStart;
        periodEnd = relatedBill.periodEnd;
        for (const item of relatedBill.items) {
          if (item.unitId) relatedUnitIds.push(item.unitId);
        }
      }
      events.push({
        id: ledger.id,
        type: 'quota',
        time: ledger.createdAt,
        title: `额度${cfg.label}：${ledger.delta > 0 ? '+' : ''}${ledger.delta}`,
        detail: `余额 ${ledger.balanceAfter}，${ledger.reason}${relatedBill ? `（关联账单 ${relatedBill.billNo}）` : ''}`,
        icon: EVENT_TYPE_STYLES.quota.icon,
        colorClass: EVENT_TYPE_STYLES.quota.colorClass,
        unitIds: relatedUnitIds,
        periodStart,
        periodEnd,
      });
    }

    for (const grant of accessGrants) {
      const unit = storageUnits.find(u => u.id === grant.unitId);
      const grantEvents = grant.events && grant.events.length > 0
        ? grant.events
        : [{ id: `${grant.id}-default`, type: 'created' as const, time: grant.createdAt }];

      for (const ev of grantEvents) {
        let title = '';
        let detail = '';
        let colorClass = EVENT_TYPE_STYLES.access.colorClass;

        switch (ev.type) {
          case 'created':
            title = `门禁授权：${unit?.code ?? '?'}`;
            detail = `有效期 ${grant.startDate} ~ ${grant.endDate}`;
            if (ev.operatorName) detail += `，操作人：${ev.operatorName}`;
            break;
          case 'frozen':
            title = `门禁冻结：${unit?.code ?? '?'}`;
            detail = ev.reason ? `原因：${ev.reason}` : '欠费冻结';
            if (ev.operatorName) detail += `，操作人：${ev.operatorName}`;
            colorClass = 'bg-danger-100 text-danger-700 border-danger-300';
            break;
          case 'unfrozen':
            title = `门禁解冻：${unit?.code ?? '?'}`;
            detail = ev.reason ? `原因：${ev.reason}` : '欠费结清自动解冻';
            if (ev.operatorName) detail += `，操作人：${ev.operatorName}`;
            colorClass = 'bg-success-100 text-success-700 border-success-300';
            break;
          case 'expired':
            title = `门禁到期：${unit?.code ?? '?'}`;
            detail = `授权至 ${grant.endDate} 自然到期`;
            colorClass = 'bg-ink-100 text-ink-600 border-ink-300';
            break;
          case 'superseded':
            title = `授权被覆盖：${unit?.code ?? '?'}`;
            detail = ev.relatedGrantTenantName
              ? `被 ${ev.relatedGrantTenantName} 的新授权覆盖`
              : '被新授权覆盖';
            colorClass = 'bg-amber-100 text-amber-700 border-amber-300';
            break;
          default:
            title = `门禁事件：${unit?.code ?? '?'}`;
        }

        events.push({
          id: `${grant.id}-${ev.id}`,
          type: 'access',
          time: ev.time,
          title,
          detail,
          icon: EVENT_TYPE_STYLES.access.icon,
          colorClass,
          unitIds: [grant.unitId],
          periodStart: grant.startDate,
          periodEnd: grant.endDate,
        });
      }
    }

    for (const bill of bills) {
      const unitIds: string[] = [];
      for (const item of bill.items) if (item.unitId) unitIds.push(item.unitId);
      events.push({
        id: bill.id,
        type: 'bill',
        time: bill.issuedAt,
        title: `账单生成：${bill.billNo}`,
        detail: `账期 ${formatDate(bill.periodStart)} ~ ${formatDate(bill.periodEnd)}，金额 ¥${bill.totalAmount.toFixed(2)}，${bill.status === 'paid' ? '已支付' : '待支付'}`,
        icon: EVENT_TYPE_STYLES.bill.icon,
        colorClass: EVENT_TYPE_STYLES.bill.colorClass,
        unitIds,
        periodStart: bill.periodStart,
        periodEnd: bill.periodEnd,
      });
    }

    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [tenantId, tierChangeRecords, quotaLedgers, accessGrants, bills, tiers, storageUnits]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterUnitId !== 'all') {
        const hasUnit = e.unitIds.includes(filterUnitId)
          || (e.type === 'tier_change');
        if (!hasUnit) return false;
      }
      if (filterPeriod !== 'all') {
        if (e.periodStart && e.periodEnd) {
          const eventStartYM = e.periodStart.slice(0, 7);
          const eventEndYM = e.periodEnd.slice(0, 7);
          const inRange = filterPeriod >= eventStartYM && filterPeriod <= eventEndYM;
          if (!inRange) return false;
        } else {
          const eventYM = e.time.slice(0, 7);
          if (eventYM !== filterPeriod) return false;
        }
      }
      return true;
    });
  }, [allEvents, filterType, filterUnitId, filterPeriod]);

  return (
    <div className="space-y-4">
      {/* 筛选条件 */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-500 shrink-0">事件类型：</span>
          {([
            { value: 'all', label: '全部' },
            { value: 'tier_change', label: '升降级' },
            { value: 'quota', label: '额度变动' },
            { value: 'access', label: '门禁授权' },
            { value: 'bill', label: '账单' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterType(opt.value)}
              className={cn(
                'px-3 h-7 rounded-md text-xs font-medium border transition-colors',
                filterType === opt.value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-ink-500 border-ink-200 hover:border-brand-300',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-500 shrink-0">关联仓号：</span>
          <div className="relative">
            <select
              value={filterUnitId}
              onChange={e => setFilterUnitId(e.target.value)}
              className="h-7 pl-2 pr-7 text-xs rounded-md border border-ink-200 bg-white outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
            >
              <option value="all">全部仓号</option>
              {availableUnits.map(u => (
                <option key={u.id} value={u.id}>{u.code}（{u.zone}区）</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-ink-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <span className="text-sm text-ink-500 shrink-0 ml-2">关联账期：</span>
          <div className="relative">
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="h-7 pl-2 pr-7 text-xs rounded-md border border-ink-200 bg-white outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
            >
              <option value="all">全部账期</option>
              {availablePeriods.map(ym => (
                <option key={ym} value={ym}>{ym.replace('-', '年')}月</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-ink-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {(filterUnitId !== 'all' || filterPeriod !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFilterUnitId('all');
                setFilterPeriod('all');
                setFilterType('all');
              }}
              className="ml-auto text-xs text-ink-400 hover:text-brand-600 underline-offset-2 hover:underline"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-ink-400">
        共 {filteredEvents.length} 条记录
        {(filterUnitId !== 'all' || filterPeriod !== 'all' || filterType !== 'all') && (
          <span className="text-ink-300 mx-1">·</span>
        )}
        {filterUnitId !== 'all' && (
          <span>仓号：<strong className="text-brand-600">{availableUnits.find(u => u.id === filterUnitId)?.code}</strong></span>
        )}
        {filterPeriod !== 'all' && (
          <span>{filterUnitId !== 'all' && ' · '}账期：<strong className="text-brand-600">{filterPeriod.replace('-', '年')}月</strong></span>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="panel-card p-8">
          <EmptyState
            icon={GitMerge}
            title="暂无匹配的时间线记录"
            description="请尝试调整筛选条件。"
            size="sm"
          />
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-ink-100" />
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative flex items-start gap-4 pl-1">
                <div
                  className={cn(
                    'relative z-10 w-[38px] h-[38px] rounded-full border-2 flex items-center justify-center shrink-0',
                    event.colorClass,
                  )}
                >
                  {event.icon}
                </div>
                <div className="flex-1 min-w-0 panel-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-800">{event.title}</div>
                      <div className="text-xs text-ink-500 mt-1 leading-relaxed">{event.detail}</div>
                      {event.unitIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.unitIds.map(uid => {
                            const unit = storageUnits.find(u => u.id === uid);
                            if (!unit) return null;
                            return (
                              <span
                                key={uid}
                                className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                                  filterUnitId === uid
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-brand-50 text-brand-700 border-brand-200',
                                )}
                              >
                                {unit.code}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {event.periodStart && event.periodEnd && (
                        <div className="mt-2">
                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                            filterPeriod !== 'all' && event.periodStart.slice(0, 7) <= filterPeriod && event.periodEnd.slice(0, 7) >= filterPeriod
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          )}>
                            {event.periodStart.slice(0, 7)} 账期
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-ink-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {formatDateTime(event.time)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}