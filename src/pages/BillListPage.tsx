import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, Search, Eye, CheckCircle2, ChevronDown, CheckSquare, Loader2, AlertTriangle } from 'lucide-react';
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
import type { Bill, BillStatus } from '@/types';

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
  const { bills, tenants, generateBills, markBillPaid } = useAppStore();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<BillStatus | 'all'>('all');
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
  }, [bills, tenants, selectedPeriod, selectedStatus, searchKeyword]);

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

  // 生成账单
  const handleGenerateBills = async () => {
    setGenerating(true);
    setGenerateProgress(0);
    setGenerateResult(null);

    // 模拟进度条动画
    const totalSteps = 10;
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      setGenerateProgress((i / totalSteps) * 100);
    }

    // 记录生成前的数量
    const beforeCount = bills.length;
    const beforeActiveGrants = useAppStore.getState().accessGrants.filter(
      (g) => g.status === 'active',
    ).length;

    // 调用 store 方法生成账单
    generateBills(periodStart, periodEnd);

    // 等待一个 tick，让 store 更新
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
  };

  // 重置生成结果（关闭 Modal 时）
  const handleCloseGenerateModal = () => {
    setGenerateModalOpen(false);
    setGenerateResult(null);
    setGenerateProgress(0);
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

            {/* 状态筛选 */}
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
              共 <strong className="text-ink-700 font-mono">{filteredBills.length}</strong> 条记录
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账单表格 */}
      <DataTable
        columns={columns}
        data={filteredBills}
        rowKey="id"
        emptyText="暂无账单记录"
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
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-500" />
            生成账单
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
              {generateResult ? '关闭' : '取消'}
            </Button>
            {!generateResult && (
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerateBills}
                loading={generating}
                disabled={!periodStart || !periodEnd}
              >
                <Plus className="w-4 h-4" />
                开始生成
              </Button>
            )}
          </>
        }
      >
        {!generateResult ? (
          <div className="space-y-5">
            <p className="text-sm text-ink-500">
              选择需要生成账单的账期范围，系统将根据活跃的租期合同自动计算并生成账单。
            </p>

            {/* 开始日期 */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                账期开始日期
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
              />
            </div>

            {/* 结束日期 */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                账期结束日期
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
              />
            </div>

            {/* 警告提示 */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">温馨提示</p>
                <p className="text-xs mt-0.5 opacity-90">
                  生成账单时，若账单金额超过欠费门禁冻结阈值，将自动冻结对应租户的门禁授权。
                </p>
              </div>
            </div>

            {/* 进度条 */}
            {generating && (
              <div className="space-y-2">
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
            )}
          </div>
        ) : (
          // 生成结果展示
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
