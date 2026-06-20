import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import {
  Search,
  LayoutGrid,
  List,
  UserPlus,
  Download,
  Eye,
  ArrowUpDown,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { calculateCarryQuota } from '@/utils/quota';
import type { Tenant, TenantTier } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { TierBadge } from '@/components/shared/TierBadge';
import { QuotaBar } from '@/components/shared/QuotaBar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

// 状态徽章配置
const STATUS_CONFIG = {
  active: { variant: 'success' as const, label: '正常' },
  frozen: { variant: 'danger' as const, label: '冻结' },
  terminated: { variant: 'slate' as const, label: '已解约' },
};

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

// 格式化日期
function formatDate(isoStr: string): string {
  return isoStr.split(' ')[0];
}

// 生成唯一 ID
function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// 获取当前时间字符串
function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ==================== 新增租户表单 Schema ====================
const NewTenantSchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),
  idCardNo: z
    .string()
    .regex(/^\d{17}[\dXx]$/, '请输入有效的 18 位身份证号'),
  tierId: z.string().min(1, '请选择等级'),
  initialQuota: z.coerce.number().min(0, '初始额度不能小于 0'),
  remark: z.string().optional(),
});

type NewTenantForm = z.infer<typeof NewTenantSchema>;

// ==================== 主页面组件 ====================
export default function TenantListPage() {
  const navigate = useNavigate();
  const {
    tenants,
    tiers,
    initData,
    upsertTenant,
    changeTenantTier,
    session,
    adjustQuota,
  } = useAppStore();

  // 视图模式
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  // 搜索关键字
  const [keyword, setKeyword] = useState('');
  // 选中的等级筛选（多选）
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);
  // 选中的状态筛选
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'active' | 'frozen' | 'terminated'
  >('all');

  // 弹窗状态
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [changeTierTenant, setChangeTierTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (tenants.length === 0 || tiers.length === 0) {
      initData();
    }
  }, [tenants.length, tiers.length, initData]);

  // ==================== 筛选逻辑 ====================
  const filteredTenants = useMemo(() => {
    let result = [...tenants];
    // 关键字搜索
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          t.phone.includes(kw) ||
          t.idCardNo.includes(kw)
      );
    }
    // 等级筛选
    if (selectedTierIds.length > 0) {
      result = result.filter((t) => selectedTierIds.includes(t.tierId));
    }
    // 状态筛选
    if (selectedStatus !== 'all') {
      result = result.filter((t) => t.status === selectedStatus);
    }
    return result;
  }, [tenants, keyword, selectedTierIds, selectedStatus]);

  // ==================== 等级筛选切换 ====================
  const toggleTierFilter = (tierId: string) => {
    setSelectedTierIds((prev) =>
      prev.includes(tierId) ? prev.filter((id) => id !== tierId) : [...prev, tierId]
    );
  };

  // ==================== 导出 Excel ====================
  const handleExportExcel = () => {
    const exportData = filteredTenants.map((t) => {
      const tier = tiers.find((x) => x.id === t.tierId);
      return {
        姓名: t.name,
        手机号: t.phone,
        身份证号: t.idCardNo,
        等级: tier?.name ?? '未知',
        当前额度: t.currentQuota,
        累计使用: t.totalUsedQuota,
        状态: STATUS_CONFIG[t.status].label,
        加入日期: formatDate(t.createdAt),
        备注: t.remark ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '租户列表');
    XLSX.writeFile(wb, `租户列表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ==================== 跳转到详情 ====================
  const goToDetail = (id: string) => {
    navigate(`/tenants/${id}`);
  };

  // ==================== 卡片视图渲染 ====================
  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filteredTenants.map((tenant) => {
        const tier = tiers.find((t) => t.id === tenant.tierId);
        const statusCfg = STATUS_CONFIG[tenant.status];
        const freeQuota = tier?.freeQuota ?? 0;
        const used = Math.max(0, freeQuota - tenant.currentQuota);

        return (
          <Card
            key={tenant.id}
            className="hover:shadow-cardHover transition-shadow cursor-pointer"
            onClick={() => goToDetail(tenant.id)}
          >
            <CardContent className="p-5">
              <div className="flex gap-4">
                {/* 左侧头像 */}
                <TenantAvatar name={tenant.name} size="lg" />

                {/* 右侧内容 */}
                <div className="flex-1 min-w-0">
                  {/* 顶部：姓名 + 等级 + 状态 */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-serif-semibold text-ink-800 text-base truncate">
                        {tenant.name}
                      </h3>
                      <TierBadge tierId={tenant.tierId} size="sm" />
                    </div>
                    <Badge variant={statusCfg.variant} className="shrink-0">
                      {statusCfg.label}
                    </Badge>
                  </div>

                  {/* 中部：联系方式 */}
                  <div className="space-y-1.5 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-ink-600">
                      <span className="text-ink-400 w-14 shrink-0">手机</span>
                      <span className="font-mono tabular-nums">
                        {maskPhone(tenant.phone)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-ink-600">
                      <span className="text-ink-400 w-14 shrink-0">身份证</span>
                      <span className="font-mono tabular-nums text-xs">
                        {maskIdCard(tenant.idCardNo)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-ink-600">
                      <span className="text-ink-400 w-14 shrink-0">加入</span>
                      <span>{formatDate(tenant.createdAt)}</span>
                    </div>
                  </div>

                  {/* 额度使用 */}
                  <QuotaBar used={used} total={freeQuota} />
                </div>
              </div>
            </CardContent>

            {/* 底部快捷按钮 */}
            <CardFooter className="border-t border-ink-100 px-5 py-3 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  goToDetail(tenant.id);
                }}
              >
                <Eye className="w-4 h-4" />
                详情
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setChangeTierTenant(tenant);
                }}
              >
                <ArrowUpDown className="w-4 h-4" />
                升降级
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  goToDetail(tenant.id);
                }}
              >
                <KeyRound className="w-4 h-4" />
                门禁
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );

  // ==================== 列表视图列配置 ====================
  const listColumns: DataTableColumn<Tenant>[] = [
    {
      key: 'info',
      title: '租户信息',
      width: '240px',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TenantAvatar name={row.name} size="md" />
          <div className="min-w-0">
            <div className="font-medium text-ink-800 text-sm truncate">
              {row.name}
            </div>
            <div className="mt-0.5">
              <TierBadge tierId={row.tierId} size="sm" />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      title: '联系方式',
      width: '240px',
      render: (row) => (
        <div className="space-y-0.5 text-sm">
          <div className="text-ink-700 font-mono tabular-nums">
            {maskPhone(row.phone)}
          </div>
          <div className="text-ink-400 font-mono text-xs tabular-nums">
            {maskIdCard(row.idCardNo)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      render: (row) => (
        <Badge variant={STATUS_CONFIG[row.status].variant}>
          {STATUS_CONFIG[row.status].label}
        </Badge>
      ),
    },
    {
      key: 'quota',
      title: '额度进度',
      width: '200px',
      render: (row) => {
        const tier = tiers.find((t) => t.id === row.tierId);
        const freeQuota = tier?.freeQuota ?? 0;
        const used = Math.max(0, freeQuota - row.currentQuota);
        return <QuotaBar used={used} total={freeQuota} compact />;
      },
    },
    {
      key: 'createdAt',
      title: '加入日期',
      width: '120px',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'actions',
      title: '操作',
      width: '220px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => goToDetail(row.id)}>
            <Eye className="w-4 h-4" />
            详情
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setChangeTierTenant(row)}
          >
            <ArrowUpDown className="w-4 h-4" />
            升降级
          </Button>
        </div>
      ),
    },
  ];

  // ==================== 列表视图渲染 ====================
  const renderListView = () => (
    <DataTable<Tenant>
      columns={listColumns}
      data={filteredTenants}
      rowKey="id"
      emptyText="暂无租户数据"
      onRowClick={(row) => goToDetail(row.id)}
    />
  );

  return (
    <div className="space-y-5">
      {/* 顶部标题栏 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">租户管理</h2>
          <p className="text-sm text-ink-400 mt-1">
            管理所有租户信息、等级与额度
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="md" onClick={handleExportExcel}>
            <Download className="w-4 h-4" />
            导出 Excel
          </Button>
          <Button variant="primary" size="md" onClick={() => setNewTenantOpen(true)}>
            <UserPlus className="w-4 h-4" />
            新增租户
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* 搜索框 */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索姓名 / 手机 / 身份证号"
              className={cn(
                'w-full h-10 pl-9 pr-4 rounded-md border border-ink-200',
                'text-sm text-ink-700 placeholder:text-ink-400',
                'bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                'transition-all'
              )}
            />
          </div>

          {/* 等级筛选 */}
          <div className="flex flex-wrap items-center gap-2">
            {tiers.map((tier) => {
              const active = selectedTierIds.includes(tier.id);
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => toggleTierFilter(tier.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
                    'border text-xs font-medium transition-all',
                    active
                      ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                  {tier.name}
                </button>
              );
            })}
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-1.5">
            {(['all', 'active', 'frozen', 'terminated'] as const).map((s) => {
              const label =
                s === 'all' ? '全部' : STATUS_CONFIG[s].label;
              const active = selectedStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStatus(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all border',
                    active
                      ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 视图切换 */}
          <div className="inline-flex rounded-md border border-ink-200 overflow-hidden shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'card'
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-ink-500 hover:bg-ink-50'
              )}
              aria-label="卡片视图"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors border-l border-ink-200',
                viewMode === 'list'
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-ink-500 hover:bg-ink-50'
              )}
              aria-label="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 筛选结果统计 */}
        <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-400 flex items-center justify-between">
          <span>
            共 <span className="text-brand-600 font-semibold">{filteredTenants.length}</span> 条结果
            {selectedTierIds.length > 0 && (
              <span className="ml-2">
                （已选 {selectedTierIds.length} 个等级
                <button
                  type="button"
                  onClick={() => setSelectedTierIds([])}
                  className="ml-1 text-brand-600 hover:underline"
                >
                  清除
                </button>
                ）
              </span>
            )}
          </span>
        </div>
      </Card>

      {/* 内容区 */}
      {filteredTenants.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-ink-400">
            <div className="text-sm">没有找到匹配的租户</div>
            <div className="text-xs mt-1">请尝试调整筛选条件或新增租户</div>
          </div>
        </Card>
      ) : viewMode === 'card' ? (
        renderCardView()
      ) : (
        renderListView()
      )}

      {/* 升降级弹窗 */}
      {changeTierTenant && (
        <ChangeTierModal
          tenant={changeTierTenant}
          tiers={tiers}
          onClose={() => setChangeTierTenant(null)}
          onConfirm={(toTierId, reason) => {
            changeTenantTier({
              tenantId: changeTierTenant.id,
              toTierId,
              reason,
              operatorId: session.operatorId,
              operatorName: session.operatorName,
            });
            setChangeTierTenant(null);
          }}
        />
      )}

      {/* 新增租户弹窗 */}
      <NewTenantModal
        open={newTenantOpen}
        tiers={tiers}
        onClose={() => setNewTenantOpen(false)}
        onSubmit={(data) => {
          const tier = tiers.find((t) => t.id === data.tierId);
          const tenantId = uid('TEN');
          const newTenant: Tenant = {
            id: tenantId,
            name: data.name,
            phone: data.phone,
            idCardNo: data.idCardNo,
            tierId: data.tierId,
            currentQuota: data.initialQuota,
            totalUsedQuota: 0,
            status: 'active',
            createdAt: nowStr(),
            remark: data.remark,
          };
          upsertTenant(newTenant);
          // 写额度流水（grant）
          if (data.initialQuota > 0) {
            adjustQuota({
              tenantId,
              delta: data.initialQuota,
              reason: `新租户注册，${tier?.name ?? ''} 初始额度发放`,
              operatorId: session.operatorId,
              operatorName: session.operatorName,
            });
          }
          setNewTenantOpen(false);
        }}
      />
    </div>
  );
}

// ==================== 升降级弹窗组件 ====================
interface ChangeTierModalProps {
  tenant: Tenant;
  tiers: TenantTier[];
  onClose: () => void;
  onConfirm: (toTierId: string, reason: string) => void;
}

function ChangeTierModal({ tenant, tiers, onClose, onConfirm }: ChangeTierModalProps) {
  const currentTier = tiers.find((t) => t.id === tenant.tierId);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 可选等级列表（排除当前等级）
  const availableTiers = tiers.filter((t) => t.id !== tenant.tierId);
  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  // 预览计算
  const preview = useMemo(() => {
    if (!currentTier || !selectedTier) return null;
    return calculateCarryQuota({
      currentQuota: tenant.currentQuota,
      fromTier: currentTier,
      toTier: selectedTier,
    });
  }, [currentTier, selectedTier, tenant.currentQuota]);

  const isUpgrade = selectedTier && currentTier && selectedTier.level > currentTier.level;

  // 提交前校验 + 二次确认
  const handleSubmit = () => {
    if (!selectedTierId) return;
    if (!reason.trim()) return;
    setConfirmOpen(true);
  };

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        maxWidth="lg"
        title={`为【${tenant.name}】调整等级`}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={!selectedTierId || !reason.trim()}
            >
              确认调整
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* 当前等级（只读） */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-2">
              当前等级
            </label>
            <div
              className={cn(
                'rounded-lg border p-4 bg-ink-50 border-ink-100',
                'flex items-center justify-between'
              )}
            >
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
                    <span className="font-mono tabular-nums">{tenant.currentQuota}</span>
                  </div>
                </div>
              </div>
              <Badge variant="slate" className="shrink-0">
                不可选
              </Badge>
            </div>
          </div>

          {/* 目标等级选择 */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-2">
              目标等级
              <ChevronDown className="w-3 h-3 inline ml-1" />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableTiers.map((tier) => {
                const selected = selectedTierId === tier.id;
                const tierIsUpgrade = currentTier && tier.level > currentTier.level;
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
                  <Badge variant={preview.strategy === 'reset' ? 'amber' : 'default'}>
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
                    <span className="text-sm text-ink-400 font-normal ml-1">
                      ({selectedTier.freeQuota} 基础
                      {preview.newQuota > selectedTier.freeQuota ? ` + 结转 ${preview.newQuota - selectedTier.freeQuota}` : ''}
                      )
                    </span>
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

      {/* 二次确认弹窗 */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          onConfirm(selectedTierId, reason.trim());
          setConfirmOpen(false);
        }}
        title="确认等级调整"
        message={`确定要将【${tenant.name}】从【${currentTier?.name}】调整为【${selectedTier?.name}】吗？\n调整后额度将变为：${preview?.newQuota ?? '?'}（${preview?.strategy === 'ratio' ? '按比例结转' : '清零策略'}）`}
        confirmText="确认调整"
        danger={!isUpgrade}
      />
    </>
  );
}

// ==================== 新增租户弹窗组件 ====================
interface NewTenantModalProps {
  open: boolean;
  tiers: TenantTier[];
  onClose: () => void;
  onSubmit: (data: NewTenantForm) => void;
}

function NewTenantModal({ open, tiers, onClose, onSubmit }: NewTenantModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewTenantForm>({
    resolver: zodResolver(NewTenantSchema),
    defaultValues: {
      name: '',
      phone: '',
      idCardNo: '',
      tierId: '',
      initialQuota: 0,
      remark: '',
    },
  });

  const selectedTierId = watch('tierId');

  // 当选择等级时，自动填充默认初始额度
  useEffect(() => {
    if (selectedTierId) {
      const tier = tiers.find((t) => t.id === selectedTierId);
      if (tier) {
        setValue('initialQuota', tier.freeQuota);
      }
    }
  }, [selectedTierId, tiers, setValue]);

  // 关闭时重置表单
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const submitForm = (data: NewTenantForm) => {
    onSubmit(data);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="md"
      title="新增租户"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit(submitForm)}
            loading={isSubmitting}
          >
            确认新增
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
        {/* 姓名 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            姓名 <span className="text-danger">*</span>
          </label>
          <input
            {...register('name')}
            type="text"
            placeholder="请输入租户姓名"
            className={cn(
              'w-full h-10 px-3 rounded-md border text-sm text-ink-700 placeholder:text-ink-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
              errors.name ? 'border-danger' : 'border-ink-200'
            )}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
          )}
        </div>

        {/* 手机号 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            手机号 <span className="text-danger">*</span>
          </label>
          <input
            {...register('phone')}
            type="tel"
            placeholder="请输入 11 位手机号"
            maxLength={11}
            className={cn(
              'w-full h-10 px-3 rounded-md border text-sm text-ink-700 placeholder:text-ink-400 font-mono',
              'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
              errors.phone ? 'border-danger' : 'border-ink-200'
            )}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>
          )}
        </div>

        {/* 身份证号 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            身份证号 <span className="text-danger">*</span>
          </label>
          <input
            {...register('idCardNo')}
            type="text"
            placeholder="请输入 18 位身份证号"
            maxLength={18}
            className={cn(
              'w-full h-10 px-3 rounded-md border text-sm text-ink-700 placeholder:text-ink-400 font-mono',
              'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
              errors.idCardNo ? 'border-danger' : 'border-ink-200'
            )}
          />
          {errors.idCardNo && (
            <p className="mt-1 text-xs text-danger">{errors.idCardNo.message}</p>
          )}
        </div>

        {/* 等级 + 初始额度 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">
              等级 <span className="text-danger">*</span>
            </label>
            <select
              {...register('tierId')}
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm text-ink-700 bg-white',
                'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                errors.tierId ? 'border-danger' : 'border-ink-200'
              )}
            >
              <option value="">请选择等级</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}（额度 {tier.freeQuota}）
                </option>
              ))}
            </select>
            {errors.tierId && (
              <p className="mt-1 text-xs text-danger">{errors.tierId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">
              初始额度
            </label>
            <input
              {...register('initialQuota')}
              type="number"
              min={0}
              placeholder="默认 = 等级基础额度"
              className={cn(
                'w-full h-10 px-3 rounded-md border text-sm text-ink-700 placeholder:text-ink-400 font-mono',
                'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all',
                errors.initialQuota ? 'border-danger' : 'border-ink-200'
              )}
            />
            {errors.initialQuota && (
              <p className="mt-1 text-xs text-danger">
                {errors.initialQuota.message}
              </p>
            )}
          </div>
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            备注
          </label>
          <textarea
            {...register('remark')}
            rows={2}
            placeholder="选填，可记录特殊说明等"
            className={cn(
              'w-full rounded-md border border-ink-200 bg-white p-3',
              'text-sm text-ink-700 placeholder:text-ink-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
              'resize-none transition-all'
            )}
          />
        </div>
      </form>
    </Modal>
  );
}
