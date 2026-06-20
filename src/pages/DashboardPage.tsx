import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/index';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TierBadge } from '@/components/shared/TierBadge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import {
  Warehouse,
  CircleDollarSign,
  Users,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis as RechartsXAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer as RechartsResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

const TODAY = '2026-06-21';

export default function DashboardPage() {
  const {
    tiers,
    tenants,
    contracts,
    bills,
    tierChangeRecords,
    loadTiers,
    loadTenants,
    loadContracts,
    loadBills,
    loadTierChangeRecords,
  } = useAppStore();

  // 初始化加载数据
  useEffect(() => {
    loadTiers();
    loadTenants();
    loadContracts();
    loadBills();
    loadTierChangeRecords();
  }, [loadTiers, loadTenants, loadContracts, loadBills, loadTierChangeRecords]);

  // 1. 在租仓库数
  const activeContractsCount = useMemo(
    () => contracts.filter((c) => c.status === 'active').length,
    [contracts]
  );

  // 模拟同比数据（上月同期活跃合同数）
  const contractsDelta = useMemo(() => {
    if (activeContractsCount === 0) return 0;
    const prev = Math.max(1, Math.floor(activeContractsCount * 0.85));
    return Math.round(((activeContractsCount - prev) / prev) * 100);
  }, [activeContractsCount]);

  // 2. 本月收入（2026-06，状态 paid + pending）
  const monthlyRevenue = useMemo(() => {
    return bills
      .filter((b) => {
        const periodStart = b.periodStart;
        return (
          periodStart.startsWith('2026-06') &&
          (b.status === 'paid' || b.status === 'pending')
        );
      })
      .reduce((sum, b) => sum + b.totalAmount, 0);
  }, [bills]);

  // 3. 活跃租户
  const activeTenantsCount = useMemo(
    () => tenants.filter((t) => t.status === 'active').length,
    [tenants]
  );

  // 4. 额度使用率
  const quotaUsageRate = useMemo(() => {
    if (tiers.length === 0 || tenants.length === 0) return 0;
    const tierMap = new Map(tiers.map((t) => [t.id, t]));
    let totalFreeQuota = 0;
    let totalUsedQuota = 0;
    for (const tenant of tenants) {
      const tier = tierMap.get(tenant.tierId);
      if (tier) {
        totalFreeQuota += tier.freeQuota;
      }
      totalUsedQuota += tenant.totalUsedQuota;
    }
    if (totalFreeQuota === 0) return 0;
    return Math.min(100, Math.round((totalUsedQuota / totalFreeQuota) * 100));
  }, [tiers, tenants]);

  // 近30天收入趋势
  const revenueTrend = useMemo(() => {
    const result: { date: string; label: string; amount: number }[] = [];
    const today = parseISO(TODAY);
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const label = format(d, 'MM/dd', { locale: zhCN });
      const dayBills = bills.filter((b) => {
        const issuedDate = b.issuedAt.slice(0, 10);
        return issuedDate === dateStr && (b.status === 'paid' || b.status === 'pending');
      });
      const amount = dayBills.reduce((s, b) => s + b.totalAmount, 0);
      result.push({
        date: dateStr,
        label,
        amount: Math.round(amount * 100) / 100,
      });
    }
    return result;
  }, [bills]);

  // 等级租户分布
  const tierDistribution = useMemo(() => {
    const tierMap = new Map(tiers.map((t) => [t.id, { ...t, count: 0 }]));
    for (const tenant of tenants) {
      const tier = tierMap.get(tenant.tierId);
      if (tier) tier.count++;
    }
    return Array.from(tierMap.values())
      .filter((t) => t.count > 0)
      .sort((a, b) => a.level - b.level);
  }, [tiers, tenants]);

  const totalTenantsInTiers = tierDistribution.reduce((s, t) => s + t.count, 0);

  // 最近8条升降级事件，按 createdAt desc 排序
  const recentTierChanges = useMemo(() => {
    const tierMap = new Map(tiers.map((t) => [t.id, t]));
    return [...tierChangeRecords]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((r) => {
        const fromTier = tierMap.get(r.fromTierId);
        const toTier = tierMap.get(r.toTierId);
        const isUpgrade = (toTier?.level ?? 0) > (fromTier?.level ?? 0);
        const tenant = tenants.find((t) => t.id === r.tenantId);
        return {
          ...r,
          fromTierName: fromTier?.name ?? '未知',
          toTierName: toTier?.name ?? '未知',
          fromTierColor: fromTier?.color ?? '#94A3B8',
          toTierColor: toTier?.color ?? '#94A3B8',
          isUpgrade,
          tenantName: tenant?.name ?? '未知租户',
        };
      });
  }, [tierChangeRecords, tiers, tenants]);

  // 额度使用率 Top10 租户
  const topQuotaTenants = useMemo(() => {
    const tierMap = new Map(tiers.map((t) => [t.id, t]));
    return tenants
      .map((t) => {
        const tier = tierMap.get(t.tierId);
        const freeQuota = tier?.freeQuota ?? 1;
        const usage =
          freeQuota === 0 ? 0 : Math.min(100, Math.round((t.totalUsedQuota / freeQuota) * 100));
        return {
          id: t.id,
          name: t.name,
          tierId: t.tierId,
          usage,
          freeQuota,
          used: t.totalUsedQuota,
        };
      })
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);
  }, [tenants, tiers]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-serif-semibold text-ink-700">今日总览</h2>
        <p className="text-sm text-ink-400 mt-1">今日总览 / {TODAY}</p>
      </div>

      {/* 第1行：4个 StatCard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <StatCard
            label="在租仓库数"
            value={<span className="tabular-nums">{activeContractsCount}</span>}
            delta={contractsDelta}
            accent="brand"
            icon={Warehouse}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <StatCard
            label="本月收入"
            value={
              <span className="tabular-nums">
                ¥{monthlyRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            }
            accent="amber"
            icon={CircleDollarSign}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <StatCard
            label="活跃租户"
            value={<span className="tabular-nums">{activeTenantsCount}</span>}
            accent="success"
            icon={Users}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <StatCard
            label="额度使用率"
            value={<span className="tabular-nums">{quotaUsageRate}%</span>}
            accent="brand"
            icon={Gauge}
          />
        </div>
      </div>

      {/* 第2行：收入趋势 + 等级分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 近30天收入趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>近30天收入趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#91A9D0" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#91A9D0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#6B7A8C' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E8EDF3' }}
                    interval={Math.floor(revenueTrend.length / 6)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6B7A8C' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `¥${v}`}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E8EDF3',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: 12,
                    }}
                    labelFormatter={(l) => `日期：${l}`}
                    formatter={(v: number) => [`¥${v.toFixed(2)}`, '收入']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#1E3A5F"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 等级租户分布 */}
        <Card>
          <CardHeader>
            <CardTitle>等级租户分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {tierDistribution.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E8EDF3',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, { payload }) => [
                      `${v} 人 (${totalTenantsInTiers ? Math.round((v / totalTenantsInTiers) * 100) : 0}%)`,
                      payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-serif font-bold text-ink-800 tabular-nums">
                  {totalTenantsInTiers}
                </div>
                <div className="text-xs text-ink-400 mt-1">总人数</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {tierDistribution.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs text-ink-600">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span>{t.name}</span>
                  <span className="tabular-nums text-ink-400">({t.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 第3行：升降级时间线 + 额度使用率Top10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 升降级事件时间线 */}
        <Card>
          <CardHeader>
            <CardTitle>升降级事件</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTierChanges.length === 0 ? (
              <div className="py-16 text-center text-ink-400 text-sm">暂无升降级记录</div>
            ) : (
              <div className="relative">
                <div className="absolute left-16 top-0 bottom-0 w-px bg-ink-100" />
                <div className="space-y-4">
                  {recentTierChanges.map((r) => (
                    <div key={r.id} className="relative flex gap-4">
                      <div className="w-14 shrink-0 pt-1 text-right">
                        <div className="text-xs font-medium text-ink-500 tabular-nums leading-tight">
                          {r.createdAt.slice(5, 10)}
                        </div>
                        <div className="text-[11px] text-ink-400 tabular-nums mt-0.5">
                          {r.createdAt.slice(11, 16)}
                        </div>
                      </div>
                      <div className="relative z-10 shrink-0 pt-1.5">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center',
                            r.isUpgrade ? 'bg-green-500' : 'bg-red-500'
                          )}
                        >
                          {r.isUpgrade ? (
                            <ArrowUpRight className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          ) : (
                            <ArrowDownRight className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium',
                                r.isUpgrade
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              )}
                            >
                              {r.isUpgrade ? '升级' : '降级'}
                            </span>
                            <span className="text-xs text-ink-700 font-medium truncate">
                              {r.tenantName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-ink-600">
                            <span
                              className="inline-flex w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: r.fromTierColor }}
                            />
                            <span className="truncate max-w-[60px]">{r.fromTierName}</span>
                            <span className="text-ink-300 shrink-0">→</span>
                            <span
                              className="inline-flex w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: r.toTierColor }}
                            />
                            <span className="font-semibold text-ink-800 truncate max-w-[60px]">
                              {r.toTierName}
                            </span>
                          </div>
                          <div className="text-[11px] text-ink-400 mt-1.5 truncate">
                            操作人：{r.operatorName}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 额度使用率 Top10 租户 */}
        <Card>
          <CardHeader>
            <CardTitle>额度使用率 Top10</CardTitle>
          </CardHeader>
          <CardContent>
            {topQuotaTenants.length === 0 ? (
              <div className="py-16 text-center text-ink-400 text-sm">暂无租户数据</div>
            ) : (
              <div className="space-y-3">
                {topQuotaTenants.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs text-ink-400 tabular-nums shrink-0">
                      {idx + 1}
                    </span>
                    <TenantAvatar name={t.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-ink-700 truncate">
                          {t.name}
                        </span>
                        <TierBadge tierId={t.tierId} size="sm" />
                        <span className="ml-auto text-xs font-semibold tabular-nums text-ink-700 shrink-0">
                          {t.usage}%
                        </span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            t.usage >= 90
                              ? 'bg-red-500'
                              : t.usage >= 70
                              ? 'bg-amber-400'
                              : 'bg-brand-500'
                          )}
                          style={{ width: `${t.usage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
