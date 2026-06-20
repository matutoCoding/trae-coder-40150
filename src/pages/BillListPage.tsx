import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, Search, Eye, CheckCircle2, ChevronDown, CheckSquare, Loader2, AlertTriangle, Eye as PreviewIcon, XCircle, Calendar, List as ListIcon, Receipt, DollarSign, ShieldAlert, TrendingDown, Users, CalendarCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillStatusBadge } from '@/components/shared/BillStatusBadge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { TierBadge } from '@/components/shared/TierBadge';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import type { Bill, BillStatus, BillPreviewResult, PricingType, AccessGrant, Tenant } from '@/types';

// 付款明细
interface PaymentRecord {
  billId: string;
  billNo: string;
  tenantId: string;
  tenantName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  paidAt: string;
}

// 收款批次
interface PaymentBatch {
  date: string;
  totalAmount: number;
  billCount: number;
  tenantCount: number;
  payments: PaymentRecord[];
}

// 账期选项（2026-04 / 05 / 06）
const PERIOD_OPTIONS = [
  { value: 'all', label: '全部账期' },
  { value: '2026-04', label: '2026年04月' },
  { value: '2026-05', label: '2026年05月' },
  { value: '2026-06', label: '2026年06月' },
];

// 账单状态选项
const STATUS_OPTIONS: { value: BillStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'overdue', label: '已逾期' },
  { value: 'void', label: '已作废' },
];

export default function BillListPage() {
  const { bills, tenants, accessGrants, storageUnits, generateBills, previewBills, markBillPaid } = useAppStore();
  const [viewMode, setViewMode] = useState<'list' | 'reconciliation'>('list');
  const [reconMode, setReconMode] = useState<'tenant' | 'payment'>('tenant');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<BillStatus | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [currentPayBillId, setCurrentPayBillId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('2026-06-01');
  const [periodEnd, setPeriodEnd] = useState('2026-06-30');
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateResult, setGenerateResult] = useState<{
    billCount: number;
    frozenCount: number;
  } | null>(null);
  const [previewResult, setPreviewResult] = useState<BillPreviewResult | null>(null);
  const [previewStep, setPreviewStep] = useState<'form' | 'preview' | 'result'>('form');
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<string | null>(null);
  const [detailPaymentDate, setDetailPaymentDate] = useState<string | null>(null);

  const dateRangeInvalid =
    periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd);
  const dateRangeDays = useMemo(() => {
    if (!periodStart || !periodEnd || dateRangeInvalid) return 0;
    return (
      Math.round(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [periodStart, periodEnd, dateRangeInvalid]);

  // 筛选后的账单列表
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // 账期筛选
      if (selectedPeriod !== 'all') {
        const billPeriod = bill.periodStart.slice(0, 7);
        if (billPeriod !== selectedPeriod) return false;
      }
      // 状态筛选
      if (selectedStatus !== 'all' && bill.status !== selectedStatus) return false;
      // 仓号筛选
      if (selectedUnit !== 'all') {
        const hasUnit = bill.items.some((item) => item.unitId === selectedUnit);
        if (!hasUnit) return false;
      }
      // 租户搜索
      if (searchKeyword.trim()) {
        const tenant = tenants.find((t) => t.id === bill.tenantId);
        const keyword = searchKeyword.trim().toLowerCase();
        if (!tenant) return false;
        if (
          !tenant.name.toLowerCase().includes(keyword) &&
          !tenant.phone.includes(keyword)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [bills, tenants, selectedPeriod, selectedStatus, selectedUnit, searchKeyword]);

  // 全部可选的 bill（pending / overdue 状态）
  const payableBills = useMemo(
    () => filteredBills.filter((b) => b.status === 'pending' || b.status === 'overdue'),
    [filteredBills],
  );

  // 是否全选
  const isAllSelected =
    payableBills.length > 0 && payableBills.every((b) => selectedIds.has(b.id));

  // 切换全选
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payableBills.map((b) => b.id)));
    }
  };

  // 切换单个选择
  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 确认单个标记已支付
  const handleConfirmPaid = () => {
    if (currentPayBillId) {
      markBillPaid(currentPayBillId);
    }
    setConfirmPaidOpen(false);
    setCurrentPayBillId(null);
  };

  // 批量标记已支付
  const handleBatchPaid = () => {
    selectedIds.forEach((id) => markBillPaid(id));
    setBatchConfirmOpen(false);
    setSelectedIds(new Set());
  };

  // 点击标记已支付按钮
  const openPayConfirm = (billId: string) => {
    setCurrentPayBillId(billId);
    setConfirmPaidOpen(true);
  };

  // 导出 Excel
  const handleExportExcel = () => {
    const exportData = filteredBills.map((bill) => {
      const tenant = tenants.find((t) => t.id === bill.tenantId);
      return {
        账单编号: bill.billNo,
        账期: `${bill.periodStart} ~ ${bill.periodEnd}`,
        租户姓名: tenant?.name ?? '未知',
        联系电话: tenant?.phone ?? '',
        总金额: bill.totalAmount,
        已付金额: bill.paidAmount,
        账单状态: (
          { pending: '待支付', paid: '已支付', overdue: '已逾期', void: '已作废' } as Record<
            BillStatus,
            string
          >
        )[bill.status],
        开票日期: formatDate(bill.issuedAt),
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '账单列表');
    const fileName = `账单列表_${formatDate(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handlePreviewBills = useCallback(() => {
    if (!periodStart || !periodEnd) return;
    const result = previewBills(periodStart, periodEnd);
    setPreviewResult(result);
    setPreviewStep('preview');
  }, [periodStart, periodEnd, previewBills]);

  const handleGenerateBills = async () => {
    setGenerating(true);
    setGenerateProgress(0);
    setGenerateResult(null);

    const totalSteps = 10;
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      setGenerateProgress((i / totalSteps) * 100);
    }

    const beforeCount = bills.length;
    const beforeActiveGrants = useAppStore.getState().accessGrants.filter(
      (g) => g.status === 'active',
    ).length;

    generateBills(periodStart, periodEnd);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const latestState = useAppStore.getState();
    const afterCount = latestState.bills.length;
    const afterActiveGrants = latestState.accessGrants.filter(
      (g) => g.status === 'active',
    ).length;

    setGenerateResult({
      billCount: afterCount - beforeCount,
      frozenCount: beforeActiveGrants - afterActiveGrants,
    });
    setGenerating(false);
    setPreviewStep('result');
  };

  const handleCloseGenerateModal = () => {
    setGenerateModalOpen(false);
    setGenerateResult(null);
    setGenerateProgress(0);
    setPreviewResult(null);
    setPreviewStep('form');
  };

  // 从 store 获取租户信息（表格渲染用）
  const getTenantById = (id: string) => tenants.find((t) => t.id === id);

  // 当筛选条件变化时，清空选中
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedPeriod, selectedStatus, searchKeyword]);

  // 表格列定义
  const columns: DataTableColumn<Bill>[] = [
    {
      key: 'select',
      title: (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={toggleSelectAll}
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              isAllSelected
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'border-ink-300 hover:border-brand-400 bg-white',
            )}
          >
            {isAllSelected && <CheckSquare className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
      width: '48px',
      align: 'center',
      render: (row) => {
        const isPayable = row.status === 'pending' || row.status === 'overdue';
        const isChecked = selectedIds.has(row.id);
        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              disabled={!isPayable}
              onClick={() => isPayable && toggleSelectOne(row.id)}
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                !isPayable && 'opacity-40 cursor-not-allowed',
                isChecked
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'border-ink-300 hover:border-brand-400 bg-white',
              )}
            >
              {isChecked && <CheckSquare className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      },
    },
    {
      key: 'billNo',
      title: '账单编号',
      width: '160px',
      render: (row) => <span className="font-mono text-brand-600">{row.billNo}</span>,
    },
    {
      key: 'period',
      title: '账期',
      width: '200px',
      render: (row) => (
        <span className="text-sm text-ink-600 font-mono">
          {row.periodStart} ~ {row.periodEnd}
        </span>
      ),
    },
    {
      key: 'tenant',
      title: '租户',
      width: '220px',
      render: (row) => {
        const tenant = getTenantById(row.tenantId);
        if (!tenant) {
          return <span className="text-ink-400">未知租户</span>;
        }
        return (
          <div className="flex items-center gap-3">
            <TenantAvatar name={tenant.name} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium text-ink-800">{tenant.name}</span>
              <TierBadge tierId={tenant.tierId} size="sm" />
            </div>
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      title: '总金额',
      width: '120px',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-semibold text-brand-700 text-base">
          ¥{row.totalAmount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      title: '已付金额',
      width: '120px',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-mono text-sm',
            row.paidAmount > 0 ? 'text-success font-medium' : 'text-ink-400',
          )}
        >
          ¥{row.paidAmount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      align: 'center',
      render: (row) => <BillStatusBadge status={row.status} />,
    },
    {
      key: 'issuedAt',
      title: '开票日期',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-ink-500 font-mono">{formatDate(row.issuedAt)}</span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '180px',
      align: 'right',
      render: (row) => {
        const canMarkPaid = row.status === 'pending' || row.status === 'overdue';
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              as="a"
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
              }}
            >
              <Link
                to={`/bills/${row.id}`}
                className="flex items-center gap-1 text-ink-600 hover:text-brand-600"
              >
                <Eye className="w-3.5 h-3.5" />
                查看详情
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canMarkPaid}
              onClick={() => openPayConfirm(row.id)}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              标记已支付
            </Button>
          </div>
        );
      },
    },
  ];

  // ========== 对账视图数据计算 ==========

  interface ReconciliationRow {
    period: string;
    tenantId: string;
    tenantName: string;
    totalReceivable: number;
    totalPaid: number;
    totalUnpaid: number;
    billCount: number;
    unpaidBillCount: number;
    frozenAccessCount: number;
    bills: Bill[];
  }

  const reconciliationRows = useMemo(() => {
    const rowsMap = new Map<string, ReconciliationRow>();
    let scopeBills = bills;
    if (selectedPeriod !== 'all') {
      scopeBills = scopeBills.filter(b => b.periodStart.slice(0, 7) === selectedPeriod);
    }
    if (selectedUnit !== 'all') {
      scopeBills = scopeBills.filter(b => b.items.some(item => item.unitId === selectedUnit));
    }

    for (const bill of scopeBills) {
      const period = bill.periodStart.slice(0, 7);
      const key = `${period}-${bill.tenantId}`;
      const tenant = tenants.find(t => t.id === bill.tenantId);
      if (!tenant) continue;

      const unpaid = Math.max(0, bill.totalAmount - bill.paidAmount);
      const row = rowsMap.get(key) ?? {
        period,
        tenantId: bill.tenantId,
        tenantName: tenant.name,
        totalReceivable: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        billCount: 0,
        unpaidBillCount: 0,
        frozenAccessCount: accessGrants.filter(
          g => g.tenantId === bill.tenantId && g.status === 'frozen'
        ).length,
        bills: [],
      };
      row.totalReceivable += bill.totalAmount;
      row.totalPaid += bill.paidAmount;
      row.totalUnpaid += unpaid;
      row.billCount += 1;
      if (unpaid > 0) row.unpaidBillCount += 1;
      row.bills.push(bill);
      rowsMap.set(key, row);
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => {
      if (a.period !== b.period) return b.period.localeCompare(a.period);
      return b.totalUnpaid - a.totalUnpaid;
    });

    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      return rows.filter(r =>
        r.tenantName.toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [bills, tenants, accessGrants, selectedPeriod, selectedUnit, searchKeyword]);

  const reconciliationSummary = useMemo(() => {
    return reconciliationRows.reduce((acc, r) => {
      acc.totalReceivable += r.totalReceivable;
      acc.totalPaid += r.totalPaid;
      acc.totalUnpaid += r.totalUnpaid;
      acc.tenantWithDebt += r.totalUnpaid > 0 ? 1 : 0;
      return acc;
    }, { totalReceivable: 0, totalPaid: 0, totalUnpaid: 0, tenantWithDebt: 0 });
  }, [reconciliationRows]);

  const paymentBatches = useMemo(() => {
    let scopeBills = bills.filter(b => b.status === 'paid' && b.paidAt);
    if (selectedPeriod !== 'all') {
      scopeBills = scopeBills.filter(b => b.periodStart.slice(0, 7) === selectedPeriod);
    }
    if (selectedUnit !== 'all') {
      scopeBills = scopeBills.filter(b => b.items.some(item => item.unitId === selectedUnit));
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      scopeBills = scopeBills.filter(b => {
        const t = tenants.find(tt => tt.id === b.tenantId);
        return t && (t.name.toLowerCase().includes(kw) || t.phone.includes(kw));
      });
    }

    const batchMap = new Map<string, PaymentBatch>();
    for (const bill of scopeBills) {
      const tenant = tenants.find(t => t.id === bill.tenantId);
      if (!tenant || !bill.paidAt) continue;
      const date = bill.paidAt.split(' ')[0];
      const batch = batchMap.get(date) ?? {
        date,
        totalAmount: 0,
        billCount: 0,
        tenantCount: 0,
        payments: [],
      };
      batch.totalAmount += bill.paidAmount;
      batch.billCount += 1;
      batch.payments.push({
        billId: bill.id,
        billNo: bill.billNo,
        tenantId: bill.tenantId,
        tenantName: tenant.name,
        period: bill.periodStart.slice(0, 7),
        periodStart: bill.periodStart,
        periodEnd: bill.periodEnd,
        amount: bill.paidAmount,
        paidAt: bill.paidAt,
      });
      batchMap.set(date, batch);
    }

    for (const batch of batchMap.values()) {
      const tenantSet = new Set(batch.payments.map(p => p.tenantId));
      batch.tenantCount = tenantSet.size;
    }

    return Array.from(batchMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [bills, tenants, selectedPeriod, selectedUnit, searchKeyword]);

  return (
    <div className="space-y-6">
      {/* 页面标题区 + 右上角操作按钮 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">账单管理</h2>
          <p className="text-sm text-ink-400 mt-1">
            管理所有租赁账单，支持生成、导出、标记支付
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleExportExcel}
            disabled={filteredBills.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            导出Excel
          </Button>
          <Button variant="primary" size="md" onClick={() => setGenerateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            生成账单
          </Button>
        </div>
      </div>

      {/* 批量操作提示条 */}
      {selectedIds.size > 0 && (
        <div className="panel-card panel-card-accent p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-brand-500" />
            <span className="text-sm text-ink-700">
              已选择 <strong className="text-brand-700">{selectedIds.size}</strong> 张账单
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={() => setBatchConfirmOpen(true)}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            批量标记已支付
          </Button>
        </div>
      )}

      {/* 视图切换条 */}
      <div className="flex items-center gap-2 bg-ink-50 rounded-lg border border-ink-200 p-1 w-fit">
        {[
          { value: 'list', label: '账单列表', icon: ListIcon },
          { value: 'reconciliation', label: '收款对账', icon: Receipt },
        ].map(opt => {
          const isActive = viewMode === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewMode(opt.value as 'list' | 'reconciliation')}
              className={cn(
                'flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white text-brand-700 shadow-sm border border-ink-200'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 账期年月选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">账期：</span>
              <div className="relative">
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="h-9 pl-3 pr-8 pr-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {viewMode === 'list' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-600 whitespace-nowrap">状态：</span>
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as BillStatus | 'all')}
                    className="h-9 pl-3 pr-8 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* 仓号筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">仓号：</span>
              <div className="relative">
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="h-9 pl-3 pr-8 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                >
                  <option value="all">全部仓号</option>
                  {storageUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
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
              共 <strong className="text-ink-700 font-mono">{
                viewMode === 'list' ? filteredBills.length : reconciliationRows.length
              }</strong> 条记录
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'list' ? (
        <>
          {/* 批量操作提示条 */}
          {selectedIds.size > 0 && (
            <div className="panel-card panel-card-accent p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-brand-500" />
                <span className="text-sm text-ink-700">
                  已选择 <strong className="text-brand-700">{selectedIds.size}</strong> 张账单
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={() => setBatchConfirmOpen(true)}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                批量标记已支付
              </Button>
            </div>
          )}

          {/* 账单表格 */}
          <DataTable
            columns={columns}
            data={filteredBills}
            rowKey="id"
            emptyText="暂无账单记录"
          />
        </>
      ) : (
        <div className="space-y-5">
          {/* 对账子视图切换 */}
          <div className="flex items-center gap-2 bg-ink-50 rounded-lg border border-ink-200 p-1 w-fit">
            {[
              { value: 'tenant', label: '按租户汇总', icon: Users },
              { value: 'payment', label: '按收款日期', icon: CalendarCheck },
            ].map(opt => {
              const isActive = reconMode === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReconMode(opt.value as 'tenant' | 'payment')}
                  className={cn(
                    'flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white text-brand-700 shadow-sm border border-ink-200'
                      : 'text-ink-500 hover:text-ink-700',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {reconMode === 'tenant' ? (
            <ReconciliationView
              rows={reconciliationRows}
              summary={reconciliationSummary}
              onOpenDetail={(tid, period) => {
                setDetailTenantId(tid);
                setDetailPeriod(period);
              }}
              onPayBill={(billId) => {
                setCurrentPayBillId(billId);
                setConfirmPaidOpen(true);
              }}
            />
          ) : (
            <PaymentBatchView
              batches={paymentBatches}
              onOpenDetail={(date) => {
                setDetailPaymentDate(date);
              }}
            />
          )}
        </div>
      )}

      {/* 对账详情 Modal */}
      <ReconciliationDetailModal
        open={detailTenantId !== null}
        onClose={() => {
          setDetailTenantId(null);
          setDetailPeriod(null);
        }}
        tenantId={detailTenantId ?? ''}
        period={detailPeriod ?? ''}
        bills={bills}
        onPayBill={(billId) => {
          setCurrentPayBillId(billId);
          setConfirmPaidOpen(true);
        }}
      />

      {/* 收款批次详情 Modal */}
      <PaymentBatchDetailModal
        open={detailPaymentDate !== null}
        onClose={() => setDetailPaymentDate(null)}
        date={detailPaymentDate ?? ''}
        batches={paymentBatches}
        accessGrants={accessGrants}
        tenants={tenants}
        bills={bills}
      />

      {/* 单个标记已支付确认弹窗 */}
      <ConfirmDialog
        open={confirmPaidOpen}
        onClose={() => setConfirmPaidOpen(false)}
        onConfirm={handleConfirmPaid}
        title="确认标记已支付"
        message="确认将该账单标记为已支付吗？此操作会更新已付金额并记录审计日志。"
        confirmText="确认已支付"
        danger={false}
      />

      {/* 批量标记已支付确认弹窗 */}
      <ConfirmDialog
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        onConfirm={handleBatchPaid}
        title="批量标记已支付"
        message={`确认将选中的 ${selectedIds.size} 张账单全部标记为已支付吗？`}
        confirmText="确认批量支付"
        danger={false}
      />

      {/* 生成账单 Modal */}
      <Modal
        open={generateModalOpen}
        onClose={handleCloseGenerateModal}
        maxWidth={previewStep === 'preview' ? 'lg' : 'md'}
        title={
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-500" />
            生成账单
            <div className="ml-3 flex items-center gap-1.5 text-xs">
              {(['form', 'preview', 'result'] as const).map((step, idx) => (
                <div
                  key={step}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                    previewStep === step
                      ? 'bg-brand-500 text-white border-brand-500'
                      : idx < ['form', 'preview', 'result'].indexOf(previewStep)
                        ? 'bg-success text-white border-success'
                        : 'bg-white text-ink-400 border-ink-200',
                  )}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={handleCloseGenerateModal}
              disabled={generating}
            >
              {previewStep === 'result' ? '关闭' : '取消'}
            </Button>
            {previewStep === 'form' && (
              <Button
                variant="primary"
                size="md"
                onClick={handlePreviewBills}
                disabled={!periodStart || !periodEnd || dateRangeInvalid}
              >
                <PreviewIcon className="w-4 h-4" />
                预览账单
              </Button>
            )}
            {previewStep === 'preview' && (
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setPreviewStep('form')}
                  disabled={generating}
                >
                  返回修改
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateBills}
                  loading={generating}
                  disabled={previewResult && previewResult.billCount === 0}
                >
                  <Plus className="w-4 h-4" />
                  确认生成
                </Button>
              </>
            )}
          </>
        }
      >
        {previewStep === 'form' && (
          <div className="space-y-5">
            <p className="text-sm text-ink-500">
              选择需要生成账单的账期范围，系统将根据活跃的租期合同自动计算并生成账单。
            </p>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                账期开始日期
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={cn(
                  'w-full h-10 px-3 text-sm rounded-md border bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                  dateRangeInvalid ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-ink-200',
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                账期结束日期
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={cn(
                  'w-full h-10 px-3 text-sm rounded-md border bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                  dateRangeInvalid ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-ink-200',
                )}
              />
            </div>

            {dateRangeInvalid ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">日期范围错误</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    开始日期不能晚于结束日期，请重新选择账期。
                  </p>
                </div>
              </div>
            ) : dateRangeDays > 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-sm">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">账期共 {dateRangeDays} 天</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    包含起止日期，按自然日 {dateRangeDays === 1 ? '单日账期按 1 天计费' : `(${periodStart} ~ ${periodEnd})`}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">温馨提示</p>
                <p className="text-xs mt-0.5 opacity-90">
                  生成账单时，若账单金额超过欠费门禁冻结阈值，将自动冻结对应租户的门禁授权。
                </p>
              </div>
            </div>
          </div>
        )}

        {previewStep === 'preview' && previewResult && (
          <div className="space-y-4">
            {generating ? (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-600">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    正在生成账单...
                  </span>
                  <span className="font-mono text-brand-600 font-medium">
                    {Math.round(generateProgress)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-gradient rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${generateProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-brand-50 border border-brand-100 text-center">
                    <div className="text-2xl font-serif font-bold text-brand-700 font-mono">
                      {previewResult.billCount}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">预计账单数</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                    <div className="text-2xl font-serif font-bold text-amber-600 font-mono">
                      ¥{previewResult.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">预计总金额</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
                    <div className="text-2xl font-serif font-bold text-danger font-mono">
                      {previewResult.frozenCount}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">预计冻结门禁</div>
                  </div>
                </div>

                {previewResult.items.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-3 text-ink-300">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-ink-500 text-sm">该账期内无活跃合同，预计生成 0 张账单</p>
                  </div>
                ) : (
                  <div className="border border-ink-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-ink-50 border-b border-ink-100">
                          <th className="text-left px-3 py-2.5 text-ink-600 font-medium">租户</th>
                          <th className="text-left px-3 py-2.5 text-ink-600 font-medium">仓号</th>
                          <th className="text-center px-3 py-2.5 text-ink-600 font-medium">天数</th>
                          <th className="text-center px-3 py-2.5 text-ink-600 font-medium">计费类型</th>
                          <th className="text-right px-3 py-2.5 text-ink-600 font-medium">单价</th>
                          <th className="text-right px-3 py-2.5 text-ink-600 font-medium">小计</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              'border-b border-ink-50',
                              idx % 2 === 0 ? 'bg-white' : 'bg-ink-25',
                            )}
                          >
                            <td className="px-3 py-2.5 text-ink-700 font-medium">{item.tenantName}</td>
                            <td className="px-3 py-2.5 font-mono text-brand-600">{item.unitCode}</td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums">{item.days}</td>
                            <td className="px-3 py-2.5 text-center">
                              <PricingTypeBadge type={item.pricingType} />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">¥{item.unitPrice.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-brand-700">¥{item.subtotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-brand-50/50 border-t border-ink-200">
                          <td colSpan={5} className="px-3 py-2.5 text-right text-ink-600 font-medium">
                            合计
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-brand-700">
                            ¥{previewResult.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {previewResult.frozenCount > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">冻结提醒</p>
                      <p className="text-xs mt-0.5 opacity-90">
                        生成后将冻结 {previewResult.frozenCount} 个门禁授权（账单金额超过冻结阈值）。
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {previewStep === 'result' && generateResult && (
          <div className="py-4 space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-success">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-xl text-ink-800 mb-1">
                账单生成完成
              </h3>
              <p className="text-sm text-ink-500">以下是本次生成的统计信息</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-brand-50 border border-brand-100">
                <div className="text-3xl font-serif font-bold text-brand-700 font-mono">
                  {generateResult.billCount}
                </div>
                <div className="text-sm text-ink-500 mt-1">生成账单数</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                <div className="text-3xl font-serif font-bold text-danger font-mono">
                  {generateResult.frozenCount}
                </div>
                <div className="text-sm text-ink-500 mt-1">冻结门禁数</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== 对账视图 ====================
interface ReconciliationRowData {
  period: string;
  tenantId: string;
  tenantName: string;
  totalReceivable: number;
  totalPaid: number;
  totalUnpaid: number;
  billCount: number;
  unpaidBillCount: number;
  frozenAccessCount: number;
  bills: Bill[];
}

interface ReconciliationSummary {
  totalReceivable: number;
  totalPaid: number;
  totalUnpaid: number;
  tenantWithDebt: number;
}

interface ReconciliationViewProps {
  rows: ReconciliationRowData[];
  summary: ReconciliationSummary;
  onOpenDetail: (tenantId: string, period: string) => void;
  onPayBill: (billId: string) => void;
}

function ReconciliationView({ rows, summary, onOpenDetail }: ReconciliationViewProps) {
  return (
    <div className="space-y-4">
      {/* 顶部汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="panel-card p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <Receipt className="w-3.5 h-3.5" />
            应收金额
          </div>
          <div className="text-2xl font-serif font-bold text-ink-800 font-mono tabular-nums">
            ¥{summary.totalReceivable.toFixed(2)}
          </div>
        </div>
        <div className="panel-card p-4 border-l-4 border-l-success">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            已收金额
          </div>
          <div className="text-2xl font-serif font-bold text-success font-mono tabular-nums">
            ¥{summary.totalPaid.toFixed(2)}
          </div>
        </div>
        <div className="panel-card p-4 border-l-4 border-l-danger">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <TrendingDown className="w-3.5 h-3.5" />
            欠费总额
          </div>
          <div className="text-2xl font-serif font-bold text-danger font-mono tabular-nums">
            ¥{summary.totalUnpaid.toFixed(2)}
          </div>
        </div>
        <div className="panel-card p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            欠费租户
          </div>
          <div className="text-2xl font-serif font-bold text-ink-800 font-mono tabular-nums">
            {summary.tenantWithDebt}
            <span className="text-sm font-normal text-ink-500 ml-1">人</span>
          </div>
        </div>
      </div>

      {/* 对账明细表格 */}
      <div className="panel-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-ink-400 text-sm">暂无对账数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-3 text-ink-600 font-medium whitespace-nowrap">账期</th>
                  <th className="text-left px-4 py-3 text-ink-600 font-medium whitespace-nowrap">租户</th>
                  <th className="text-right px-4 py-3 text-ink-600 font-medium whitespace-nowrap">应收</th>
                  <th className="text-right px-4 py-3 text-ink-600 font-medium whitespace-nowrap">已收</th>
                  <th className="text-right px-4 py-3 text-ink-600 font-medium whitespace-nowrap">欠费</th>
                  <th className="text-center px-4 py-3 text-ink-600 font-medium whitespace-nowrap">账单数</th>
                  <th className="text-center px-4 py-3 text-ink-600 font-medium whitespace-nowrap">冻结门禁</th>
                  <th className="text-right px-4 py-3 text-ink-600 font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={`${row.period}-${row.tenantId}`}
                    className={cn(
                      'border-b border-ink-50',
                      idx % 2 === 0 ? 'bg-white' : 'bg-ink-25',
                      row.totalUnpaid > 0 && 'bg-red-50/40',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-ink-700">{row.period}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TenantAvatar name={row.tenantName} size="xs" />
                        <span className="font-medium text-ink-800">{row.tenantName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-700">¥{row.totalReceivable.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-success">¥{row.totalPaid.toFixed(2)}</td>
                    <td className={cn(
                      'px-4 py-3 text-right font-mono tabular-nums font-semibold',
                      row.totalUnpaid > 0 ? 'text-danger' : 'text-ink-400',
                    )}>
                      ¥{row.totalUnpaid.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {row.billCount}
                      {row.unpaidBillCount > 0 && (
                        <span className="text-danger text-xs ml-1">({row.unpaidBillCount}未付)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {row.frozenAccessCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-danger font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {row.frozenAccessCount}
                        </span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDetail(row.tenantId, row.period)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        查看明细
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 对账详情 Modal ====================
interface ReconciliationDetailModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  period: string;
  bills: Bill[];
  onPayBill: (billId: string) => void;
}

function ReconciliationDetailModal({
  open,
  onClose,
  tenantId,
  period,
  bills,
  onPayBill,
}: ReconciliationDetailModalProps) {
  const { tenants } = useAppStore();

  const tenant = tenants.find(t => t.id === tenantId);
  const tenantBills = useMemo(() => {
    return bills.filter(b => b.tenantId === tenantId && b.periodStart.slice(0, 7) === period)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [bills, tenantId, period]);

  const summary = useMemo(() => {
    return tenantBills.reduce((acc, b) => {
      acc.receivable += b.totalAmount;
      acc.paid += b.paidAmount;
      acc.unpaid += Math.max(0, b.totalAmount - b.paidAmount);
      return acc;
    }, { receivable: 0, paid: 0, unpaid: 0 });
  }, [tenantBills]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-500" />
          对账明细
          {tenant && <span className="text-ink-500">— {tenant.name} ({period})
            </span>
          }
        </div>
      }
      footer={
        <Button variant="ghost" size="md" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 汇总 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-brand-50 border border-brand-100 text-center">
            <div className="text-xs text-ink-500">应收</div>
            <div className="text-xl font-serif font-bold text-brand-700 font-mono tabular-nums mt-0.5">¥{summary.receivable.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
            <div className="text-xs text-ink-500">已收</div>
            <div className="text-xl font-serif font-bold text-success font-mono tabular-nums mt-0.5">¥{summary.paid.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
            <div className="text-xs text-ink-500">欠费</div>
            <div className="text-xl font-serif font-bold text-danger font-mono tabular-nums mt-0.5">¥{summary.unpaid.toFixed(2)}</div>
          </div>
        </div>

        {/* 账单列表 */}
        {tenantBills.length === 0 ? (
          <div className="py-10 text-center text-ink-400 text-sm">该账期无账单</div>
        ) : (
          <div className="border border-ink-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-3 py-2.5 text-ink-600 font-medium">账单编号</th>
                  <th className="text-left px-3 py-2.5 text-ink-600 font-medium">账期</th>
                  <th className="text-right px-3 py-2.5 text-ink-600 font-medium">应收</th>
                  <th className="text-right px-3 py-2.5 text-ink-600 font-medium">已收</th>
                  <th className="text-right px-3 py-2.5 text-ink-600 font-medium">欠费</th>
                  <th className="text-center px-3 py-2.5 text-ink-600 font-medium">状态</th>
                  <th className="text-right px-3 py-2.5 text-ink-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {tenantBills.map(bill => {
                  const unpaid = Math.max(0, bill.totalAmount - bill.paidAmount);
                  return (
                    <tr key={bill.id} className="border-b border-ink-50">
                      <td className="px-3 py-2.5 font-mono text-brand-600">{bill.billNo}</td>
                      <td className="px-3 py-2.5 text-ink-600 font-mono text-xs">
                        {bill.periodStart} ~ {bill.periodEnd}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-700">¥{bill.totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-success">¥{bill.paidAmount.toFixed(2)}</td>
                      <td className={cn(
                        'px-3 py-2.5 text-right font-mono tabular-nums font-semibold',
                        unpaid > 0 ? 'text-danger' : 'text-ink-400',
                      )}>
                        ¥{unpaid.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <BillStatusBadge status={bill.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {unpaid > 0 ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onPayBill(bill.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            标记已支付
                          </Button>
                        ) : (
                          <Link
                            to={`/bills/${bill.id}`}
                            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 欠费来源说明 */}
        {tenantBills.some(b => b.status === 'pending' || b.status === 'overdue') && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-xs">欠费来源</p>
              <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside opacity-90">
                {tenantBills
                  .filter(b => b.status === 'pending' || b.status === 'overdue')
                .map(b => (
                  <li key={b.id}>
                  {b.billNo} — ¥{Math.max(0, b.totalAmount - b.paidAmount).toFixed(2)} 未支付
                </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ==================== 收款批次视图 ====================
interface PaymentBatchViewProps {
  batches: PaymentBatch[];
  onOpenDetail: (date: string) => void;
}

function PaymentBatchView({ batches, onOpenDetail }: PaymentBatchViewProps) {
  const totalStats = useMemo(() => {
    return batches.reduce((acc, b) => {
      acc.totalAmount += b.totalAmount;
      acc.billCount += b.billCount;
      acc.tenantCount += b.tenantCount;
      return acc;
    }, { totalAmount: 0, billCount: 0, tenantCount: 0 });
  }, [batches]);

  const statsCards = [
    { label: '累计收款', value: `¥${totalStats.totalAmount.toFixed(2)}`, icon: DollarSign, tone: 'success' },
    { label: '收款笔数', value: totalStats.billCount, icon: Receipt, tone: 'brand' },
    { label: '涉及租户', value: totalStats.tenantCount, icon: Users, tone: 'amber' },
    { label: '收款天数', value: `${batches.length} 天`, icon: CalendarCheck, tone: 'slate' },
  ];

  return (
    <div className="space-y-5">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsCards.map((card) => {
          const Icon = card.icon;
          const toneClass: Record<string, string> = {
            success: 'text-emerald-600 bg-emerald-50',
            brand: 'text-brand-600 bg-brand-50',
            amber: 'text-amber-600 bg-amber-50',
            slate: 'text-ink-600 bg-ink-50',
          };
          return (
            <div key={card.label} className="rounded-lg border border-ink-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-500">{card.label}</span>
                <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', toneClass[card.tone])}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold font-mono text-ink-800">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* 收款日期列表 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-ink-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          收款日期明细（共 {batches.length} 天）
        </h4>
        {batches.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-8 text-center text-sm text-ink-400 italic">
            暂无收款记录
          </div>
        ) : (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div
                key={batch.date}
                className="rounded-lg border border-ink-200 bg-white hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => onOpenDetail(batch.date)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-700 flex flex-col items-center justify-center shrink-0">
                      <div className="text-xs font-medium">{batch.date.slice(5, 7)}月</div>
                      <div className="text-lg font-bold leading-none">{batch.date.slice(8, 10)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-800">
                        {batch.date} 收款
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        {batch.billCount} 笔账单 · {batch.tenantCount} 位租户
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono text-success-700">
                        ¥{batch.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-ink-400">当日收款</div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-ink-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 收款批次详情 Modal ====================
interface PaymentBatchDetailModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  batches: PaymentBatch[];
  accessGrants: AccessGrant[];
  tenants: Tenant[];
  bills: Bill[];
}

function PaymentBatchDetailModal({
  open,
  onClose,
  date,
  batches,
  accessGrants,
  tenants,
  bills,
}: PaymentBatchDetailModalProps) {
  const batch = batches.find(b => b.date === date);

  const tenantGroups = useMemo(() => {
    if (!batch) return [];
    const map = new Map<string, {
      tenantId: string;
      tenantName: string;
      payments: PaymentRecord[];
      totalPaid: number;
      beforeDebt: number;
      afterDebt: number;
      hasFrozenBefore: boolean;
      hasFrozenAfter: boolean;
    }>();

    for (const p of batch.payments) {
      const group = map.get(p.tenantId) ?? {
        tenantId: p.tenantId,
        tenantName: p.tenantName,
        payments: [],
        totalPaid: 0,
        beforeDebt: 0,
        afterDebt: 0,
        hasFrozenBefore: false,
        hasFrozenAfter: false,
      };
      group.payments.push(p);
      group.totalPaid += p.amount;
      map.set(p.tenantId, group);
    }

    for (const group of map.values()) {
      const tenantBills = bills.filter(b => b.tenantId === group.tenantId);
      let beforeDebt = 0;
      let afterDebt = 0;
      for (const b of tenantBills) {
        const unpaid = Math.max(0, b.totalAmount - b.paidAmount);
        if (b.status === 'paid') {
          beforeDebt += b.totalAmount;
        } else {
          beforeDebt += unpaid;
          afterDebt += unpaid;
        }
      }
      group.beforeDebt = beforeDebt;
      group.afterDebt = afterDebt;

      const frozenGrants = accessGrants.filter(
        g => g.tenantId === group.tenantId && g.status === 'frozen'
      );
      group.hasFrozenAfter = frozenGrants.length > 0;
      group.hasFrozenBefore = true;
    }

    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [batch, bills, accessGrants]);

  if (!batch) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-brand-500" />
          收款明细 — {date}
        </div>
      }
    >
      <div className="space-y-5">
        {/* 汇总卡 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-success-200 bg-success-50 p-3">
            <div className="text-xs text-success-600 mb-1">当日收款</div>
            <div className="text-xl font-bold font-mono text-success-700">
              ¥{batch.totalAmount.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
            <div className="text-xs text-brand-600 mb-1">收款笔数</div>
            <div className="text-xl font-bold font-mono text-brand-700">
              {batch.billCount} 笔
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-600 mb-1">涉及租户</div>
            <div className="text-xl font-bold font-mono text-amber-700">
              {batch.tenantCount} 位
            </div>
          </div>
        </div>

        {/* 按租户分组明细 */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-ink-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            按租户汇总
          </h4>
          {tenantGroups.map((group) => (
            <div
              key={group.tenantId}
              className="rounded-lg border border-ink-200 bg-white overflow-hidden"
            >
              <div className="p-4 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {group.tenantName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-ink-800 text-sm">{group.tenantName}</div>
                    <div className="text-xs text-ink-500">
                      本次付 {group.payments.length} 笔
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-success-700">
                    +¥{group.totalPaid.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* 欠费变化 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded bg-danger-50">
                    <div className="text-xs text-danger-600 mb-1">付款前欠费</div>
                    <div className="font-mono font-semibold text-danger-700 text-sm">
                      ¥{group.beforeDebt.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-success-50">
                    <div className="text-xs text-success-600 mb-1">本次还款</div>
                    <div className="font-mono font-semibold text-success-700 text-sm">
                      -¥{group.totalPaid.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-ink-50">
                    <div className="text-xs text-ink-600 mb-1">当前欠费</div>
                    <div className={cn(
                      'font-mono font-semibold text-sm',
                      group.afterDebt > 0 ? 'text-danger-700' : 'text-success-700',
                    )}>
                      ¥{group.afterDebt.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 门禁状态 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">门禁状态</span>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>
                      {group.hasFrozenAfter
                        ? '仍有冻结门禁（欠费未结清）'
                        : group.afterDebt > 0
                          ? '存在欠费但未冻结'
                          : '无冻结，已自动恢复'
                      }
                    </span>
                  </div>
                </div>

                {/* 账单明细 */}
                <div className="space-y-1.5">
                  <div className="text-xs text-ink-500 font-medium">本次付款账单：</div>
                  {group.payments.map((p) => (
                    <div
                      key={p.billId}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-ink-50"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-brand-400" />
                        <span className="font-mono text-ink-600">{p.billNo}</span>
                        <span className="text-xs text-ink-400">
                          {p.period} 账期
                        </span>
                      </div>
                      <span className="font-mono text-success-700 font-medium">
                        ¥{p.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const PRICING_TYPE_LABELS: Record<PricingType, { label: string; className: string }> = {
  min: { label: '起步价', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  normal: { label: '正常计费', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  max: { label: '封顶价', className: 'bg-violet-100 text-violet-700 border-violet-200' },
};

function PricingTypeBadge({ type }: { type: PricingType }) {
  const cfg = PRICING_TYPE_LABELS[type];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  );
}
