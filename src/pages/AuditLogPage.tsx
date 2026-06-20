import { useMemo, useState } from 'react';
import {
  Search,
  Shield,
  ChevronDown,
  Calendar as CalendarIcon,
  User,
  FileCode,
  ArrowLeftRight,
  CheckSquare,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/date';
import type { AuditLog } from '@/types';

type BadgeVariant = 'default' | 'amber' | 'success' | 'warning' | 'danger' | 'slate';

// 操作类型选项
const ACTION_OPTIONS = [
  { value: 'tenant.create', label: '创建租户' },
  { value: 'tier.change', label: '等级变更' },
  { value: 'quota.adjust', label: '额度调整' },
  { value: 'bill.issue', label: '生成账单' },
  { value: 'bill.paid', label: '账单支付' },
  { value: 'access.grant', label: '门禁授权' },
  { value: 'access.freeze', label: '门禁冻结' },
  { value: 'pricing.update', label: '计费更新' },
];

// 目标类型选项
const TARGET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'Tenant', label: '租户 (Tenant)' },
  { value: 'Bill', label: '账单 (Bill)' },
  { value: 'AccessGrant', label: '门禁授权 (AccessGrant)' },
  { value: 'PricingRule', label: '计费规则 (PricingRule)' },
  { value: 'TenantTier', label: '等级 (Tier)' },
];

// 操作类型彩色 Badge 配置
const ACTION_BADGE_CONFIG: Record<string, { variant: BadgeVariant; label: string }> = {
  'tenant.create': { variant: 'success', label: '创建租户' },
  'tier.change': { variant: 'default', label: '等级变更' },
  'quota.adjust': { variant: 'amber', label: '额度调整' },
  'bill.issue': { variant: 'default', label: '生成账单' },
  'bill.paid': { variant: 'success', label: '账单支付' },
  'access.grant': { variant: 'default', label: '门禁授权' },
  'access.freeze': { variant: 'danger', label: '门禁冻结' },
  'pricing.update': { variant: 'warning', label: '计费更新' },
  'default': { variant: 'slate', label: '未知操作' },
};

// 目标类型彩色 Badge 配置
const TARGET_TYPE_BADGE_CONFIG: Record<string, string> = {
  Tenant: 'bg-sky-50 text-sky-700 border-sky-200',
  Bill: 'bg-violet-50 text-violet-700 border-violet-200',
  AccessGrant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PricingRule: 'bg-amber-50 text-amber-700 border-amber-200',
  TenantTier: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function AuditLogPage() {
  const { auditLogs } = useAppStore();

  // 筛选状态
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [operatorKeyword, setOperatorKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTargetType, setSelectedTargetType] = useState('all');

  // 差异 Modal
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState<AuditLog | null>(null);

  // ========== 辅助函数 ==========

  // 切换操作类型多选
  const toggleAction = (action: string) => {
    const next = new Set(selectedActions);
    if (next.has(action)) {
      next.delete(action);
    } else {
      next.add(action);
    }
    setSelectedActions(next);
  };

  // 全选/取消全选操作类型
  const toggleAllActions = () => {
    if (selectedActions.size === ACTION_OPTIONS.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(ACTION_OPTIONS.map((o) => o.value)));
    }
  };

  // 获取操作类型的 badge 配置
  const getActionBadge = (action: string) => {
    return ACTION_BADGE_CONFIG[action] ?? ACTION_BADGE_CONFIG['default'];
  };

  // 将 unknown 安全转换为 Record<string, unknown>
  const safeToRecord = (
    obj: unknown,
  ): Record<string, unknown> => {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return {};
  };

  // 简单 JSON 对比：找出不同的字段
  const findDiffFields = (
    before: unknown,
    after: unknown,
  ): Set<string> => {
    const diffFields = new Set<string>();
    const beforeObj = safeToRecord(before);
    const afterObj = safeToRecord(after);
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const key of allKeys) {
      const bVal = beforeObj[key];
      const aVal = afterObj[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        diffFields.add(key);
      }
    }
    return diffFields;
  };

  // 渲染高亮 JSON（变更字段标黄色背景）
  const renderHighlightedJSON = (
    obj: unknown,
    diffFields: Set<string>,
    side: 'before' | 'after',
  ) => {
    const recordObj = safeToRecord(obj);
    if (Object.keys(recordObj).length === 0) {
      return (
        <span className="text-ink-400 italic">{side === 'before' ? '(无数据 - 新增)' : '(无数据 - 删除)'}</span>
      );
    }

    // 序列化对象并按行渲染，识别变更字段
    const lines: { indent: number; content: string; key?: string }[] = [];
    const jsonStr = JSON.stringify(recordObj, null, 2);
    const rawLines = jsonStr.split('\n');

    for (const line of rawLines) {
      // 计算缩进（空格数 / 2）
      const leadingSpaces = line.match(/^\s*/)?.[0].length ?? 0;
      const indent = Math.floor(leadingSpaces / 2);
      const trimmed = line.trim();

      // 提取 key（形如 "key": value）
      const keyMatch = trimmed.match(/^"([^"]+)":/);
      const key = keyMatch?.[1];

      lines.push({
        indent,
        content: line,
        key,
      });
    }

    return (
      <>
        {lines.map((line, idx) => {
          const isDiffLine = line.key && diffFields.has(line.key);
          return (
            <div
              key={idx}
              className={cn(
                'whitespace-pre',
                isDiffLine && 'bg-amber-200/60 rounded -mx-1 px-1',
              )}
            >
              {line.content}
            </div>
          );
        })}
      </>
    );
  };

  // ========== 筛选逻辑 ==========

  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((log) => {
        // 操作类型筛选
        if (selectedActions.size > 0 && !selectedActions.has(log.action)) {
          return false;
        }
        // 操作人搜索
        if (operatorKeyword.trim()) {
          const keyword = operatorKeyword.trim().toLowerCase();
          if (!log.operatorName.toLowerCase().includes(keyword)) {
            return false;
          }
        }
        // 开始日期筛选
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (new Date(log.createdAt) < fromDate) {
            return false;
          }
        }
        // 结束日期筛选
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (new Date(log.createdAt) > toDate) {
            return false;
          }
        }
        // 目标类型筛选
        if (selectedTargetType !== 'all' && log.targetType !== selectedTargetType) {
          return false;
        }
        return true;
      })
      // 按时间倒序
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    auditLogs,
    selectedActions,
    operatorKeyword,
    dateFrom,
    dateTo,
    selectedTargetType,
  ]);

  // 打开差异 Modal
  const openDiffModal = (log: AuditLog) => {
    setCurrentLog(log);
    setDiffModalOpen(true);
  };

  // 表格列定义
  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      title: '时间戳',
      width: '170px',
      render: (row) => (
        <span className="font-mono text-xs text-ink-600">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      width: '140px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700">
            <User className="w-3.5 h-3.5" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-800">
              {row.operatorName}
            </span>
            <span className="text-[10px] text-ink-400 font-mono">
              ID: {row.operatorId}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'operatorIp',
      title: 'IP地址',
      width: '130px',
      render: (row) => (
        <span className="font-mono text-xs text-ink-500 bg-ink-50 px-2 py-1 rounded border border-ink-100">
          {row.operatorIp}
        </span>
      ),
    },
    {
      key: 'action',
      title: '操作类型',
      width: '120px',
      align: 'center',
      render: (row) => {
        const config = getActionBadge(row.action);
        return (
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'target',
      title: '目标类型 + ID',
      width: '200px',
      render: (row) => {
        const targetClass = TARGET_TYPE_BADGE_CONFIG[row.targetType] ?? '';
        return (
          <div className="flex flex-col gap-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium w-fit',
                targetClass || 'bg-ink-50 text-ink-600 border-ink-200',
              )}
            >
              <FileCode className="w-3 h-3 mr-1" />
              {row.targetType}
            </span>
            <span className="font-mono text-xs text-ink-500">
              ID: {row.targetId}
            </span>
          </div>
        );
      },
    },
    {
      key: 'diff',
      title: '变更前后对比',
      width: '140px',
      align: 'center',
      render: (row) => {
        const hasDiff = row.beforeSnapshot || row.afterSnapshot;
        return (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasDiff}
            onClick={() => openDiffModal(row)}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            查看差异
          </Button>
        );
      },
    },
  ];

  // 计算变更字段（用于差异 Modal）
  const diffFields = useMemo(() => {
    if (!currentLog) return new Set<string>();
    return findDiffFields(currentLog.beforeSnapshot, currentLog.afterSnapshot);
  }, [currentLog]);

  return (
    <div className="space-y-6">
      {/* 页面标题区 */}
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-600 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">变更审计</h2>
          <p className="text-sm text-ink-400 mt-1">
            全系统操作审计，不可篡改。记录所有关键操作的变更前后快照。
          </p>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-6">
            {/* 操作类型多选 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">操作类型：</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
                  className="h-9 px-3 pr-8 min-w-[200px] text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 flex items-center justify-between"
                >
                  <span className={selectedActions.size === 0 ? 'text-ink-400' : 'text-ink-700'}>
                    {selectedActions.size === 0
                      ? '全部操作类型'
                      : `已选 ${selectedActions.size} 项`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
                </button>

                {actionDropdownOpen && (
                  <>
                    {/* 遮罩层关闭 */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setActionDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 z-20 w-full min-w-[220px] bg-white rounded-lg shadow-cardHover border border-ink-100 overflow-hidden">
                      {/* 全选按钮 */}
                      <button
                        type="button"
                        onClick={toggleAllActions}
                        className="w-full px-3 py-2 flex items-center gap-2 text-sm text-ink-600 hover:bg-brand-50 border-b border-ink-100"
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                            selectedActions.size === ACTION_OPTIONS.length
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-ink-300 bg-white',
                          )}
                        >
                          {selectedActions.size === ACTION_OPTIONS.length && (
                            <CheckSquare className="w-3 h-3" />
                          )}
                        </span>
                        <span
                          className={selectedActions.size === ACTION_OPTIONS.length
                            ? 'text-brand-700 font-medium'
                            : ''
                          }
                        >
                          全选 / 取消全选
                        </span>
                      </button>
                      {/* 选项列表 */}
                      <div className="max-h-[280px] overflow-y-auto py-1">
                        {ACTION_OPTIONS.map((opt) => {
                          const checked = selectedActions.has(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleAction(opt.value)}
                              className="w-full px-3 py-2 flex items-center gap-2 text-sm text-ink-600 hover:bg-ink-50"
                            >
                              <span
                                className={cn(
                                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                                  checked
                                    ? 'bg-brand-500 border-brand-500 text-white'
                                    : 'border-ink-300 bg-white',
                                )}
                              >
                                {checked && <CheckSquare className="w-3 h-3" />}
                              </span>
                              <span className={checked ? 'text-brand-700 font-medium' : ''}>
                                {opt.label}
                              </span>
                              <span className="ml-auto font-mono text-[10px] text-ink-400">
                                {opt.value}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* 清除按钮 */}
                      {selectedActions.size > 0 && (
                        <div className="p-2 border-t border-ink-100 bg-ink-50">
                          <button
                            type="button"
                            onClick={() => setSelectedActions(new Set())}
                            className="text-xs text-ink-500 hover:text-brand-600 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            清除已选
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 操作人输入 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">操作人：</span>
              <div className="relative">
                <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={operatorKeyword}
                  onChange={(e) => setOperatorKeyword(e.target.value)}
                  placeholder="搜索操作人姓名..."
                  className="w-[200px] h-9 pl-9 pr-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
            </div>

            {/* 时间范围 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                时间范围：
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
                <span className="text-ink-400 text-sm">至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 px-3 text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                />
              </div>
            </div>

            {/* 目标类型筛选 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600 whitespace-nowrap">目标类型：</span>
              <div className="relative">
                <select
                  value={selectedTargetType}
                  onChange={(e) => setSelectedTargetType(e.target.value)}
                  className="h-9 pl-3 pr-8 min-w-[180px] text-sm rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 appearance-none cursor-pointer"
                >
                  {TARGET_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 统计信息 */}
            <div className="ml-auto pt-6 text-sm text-ink-500">
              共{' '}
              <strong className="text-ink-700 font-mono">{filteredLogs.length}</strong>{' '}
              条审计记录
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 审计日志表格 */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        rowKey="id"
        emptyText="暂无审计记录"
      />

      {/* ========== 差异 Modal ========== */}
      <Modal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        maxWidth="3xl"
        title={
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-brand-500" />
            变更前后对比
            {currentLog && (
              <span className="ml-2 text-xs font-normal text-ink-400 font-mono">
                #{currentLog.id}
              </span>
            )}
          </div>
        }
      >
        {currentLog ? (
          <div className="space-y-5">
            {/* 操作元信息 */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-ink-50 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">操作:</span>
                <Badge variant={getActionBadge(currentLog.action).variant}>
                  {getActionBadge(currentLog.action).label}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">操作人:</span>
                <span className="font-medium text-ink-700">
                  {currentLog.operatorName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">时间:</span>
                <span className="font-mono text-ink-600">
                  {formatDateTime(currentLog.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">目标:</span>
                <span className="font-mono text-ink-600">
                  {currentLog.targetType} / {currentLog.targetId}
                </span>
              </div>
            </div>

            {/* 变更字段提示 */}
            {diffFields.size > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                <div>
                  <span className="font-medium">
                    检测到 {diffFields.size} 个变更字段：
                  </span>
                  <span className="ml-1 font-mono">
                    {Array.from(diffFields).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* 左右分栏 JSON 对比 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 左：变更前 */}
              <div className="border border-ink-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-ink-100 border-b border-ink-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
                    Before - 变更前
                  </span>
                  <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
                </div>
                <div className="p-4 bg-white overflow-auto max-h-[400px]">
                  <pre className="font-mono text-xs leading-relaxed text-ink-700">
                    {renderHighlightedJSON(
                      currentLog.beforeSnapshot,
                      diffFields,
                      'before',
                    )}
                  </pre>
                </div>
              </div>

              {/* 右：变更后 */}
              <div className="border border-ink-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-ink-100 border-b border-ink-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
                    After - 变更后
                  </span>
                  <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                </div>
                <div className="p-4 bg-white overflow-auto max-h-[400px]">
                  <pre className="font-mono text-xs leading-relaxed text-ink-700">
                    {renderHighlightedJSON(
                      currentLog.afterSnapshot,
                      diffFields,
                      'after',
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-ink-400 text-sm">
            请选择一条审计记录
          </div>
        )}
      </Modal>
    </div>
  );
}
