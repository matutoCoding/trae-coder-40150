import {
  format,
  subDays,
  subMonths,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 租户等级
export interface TenantTier {
  id: string;
  name: string;
  level: number;
  freeQuota: number;
  upgradeCarryRatio: number;
  downgradeCarryRatio: number;
  resetOnDowngrade: boolean;
  color: string;
}

// 租户
export interface Tenant {
  id: string;
  name: string;
  phone: string;
  idCardNo: string;
  tierId: string;
  currentQuota: number;
  totalUsedQuota: number;
  status: 'active' | 'frozen' | 'terminated';
  createdAt: string;
  remark?: string;
}

// 额度流水
export interface QuotaLedger {
  id: string;
  tenantId: string;
  type: 'grant' | 'consume' | 'refund' | 'carry' | 'reset' | 'manual';
  delta: number;
  balanceAfter: number;
  operatorId: string;
  operatorName: string;
  reason: string;
  relatedTierChangeId?: string;
  createdAt: string;
}

// 等级变更记录
export interface TierChangeRecord {
  id: string;
  tenantId: string;
  fromTierId: string;
  toTierId: string;
  carryStrategy: 'ratio' | 'reset';
  carryRatio?: number;
  quotaBefore: number;
  quotaAfter: number;
  calculation: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  createdAt: string;
}

// 计费规则
export interface PricingRule {
  id: string;
  minDays: number;
  minPrice: number;
  maxDays: number;
  maxPrice: number;
  unitPricePerDay: number;
  overdueFreezeThreshold: number;
  updatedAt: string;
  updatedBy: string;
}

// 仓库单元
export interface StorageUnit {
  id: string;
  code: string;
  zone: string;
  size: 'S' | 'M' | 'L' | 'XL';
  status: 'idle' | 'rented' | 'maintenance';
}

// 租期
export interface RentalContract {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'ended';
  actualDays?: number;
}

// 账单明细
export interface BillItem {
  id: string;
  billId: string;
  contractId: string;
  unitCode: string;
  days: number;
  pricingType: 'min' | 'normal' | 'max';
  unitPrice: number;
  subtotal: number;
  remark: string;
}

// 账单
export interface Bill {
  id: string;
  billNo: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'void';
  items: BillItem[];
  issuedAt: string;
  paidAt?: string;
}

// 门禁授权
export interface AccessGrant {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'frozen' | 'expired';
  frozenReason?: string;
  createdAt: string;
}

// 审计日志
export interface AuditLog {
  id: string;
  operatorId: string;
  operatorName: string;
  operatorIp: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeSnapshot: Record<string, any> | null;
  afterSnapshot: Record<string, any> | null;
  createdAt: string;
}

const TODAY = parseISO('2026-06-21');
const OPERATORS = [
  { id: 'OP001', name: '张管理员', ip: '192.168.1.101' },
  { id: 'OP002', name: '李运营', ip: '192.168.1.102' },
  { id: 'OP003', name: '王主管', ip: '192.168.1.103' },
];

const TENANT_NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静',
  '杨帆', '赵磊', '黄敏', '周杰', '吴婷',
  '徐强', '孙丽', '马超', '朱琳', '胡军',
  '郭燕', '林峰', '何雪', '高翔', '罗梅',
];

function randomPhone(): string {
  const prefix = ['138', '139', '150', '151', '152', '158', '159', '186', '187', '188'];
  const p = prefix[Math.floor(Math.random() * prefix.length)];
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += Math.floor(Math.random() * 10).toString();
  }
  return p + suffix;
}

function randomIdCard(): string {
  const area = '310101';
  const year = 1970 + Math.floor(Math.random() * 30);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return area + year + month + day + seq;
}

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
}

function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd', { locale: zhCN });
}

// 生成等级数据
function createTiers(): TenantTier[] {
  return [
    {
      id: 'TIER-L1',
      name: 'L1 普通',
      level: 1,
      freeQuota: 1,
      upgradeCarryRatio: 0.8,
      downgradeCarryRatio: 0,
      resetOnDowngrade: true,
      color: '#94A3B8',
    },
    {
      id: 'TIER-L2',
      name: 'L2 白银',
      level: 2,
      freeQuota: 3,
      upgradeCarryRatio: 0.7,
      downgradeCarryRatio: 0.5,
      resetOnDowngrade: false,
      color: '#60A5FA',
    },
    {
      id: 'TIER-L3',
      name: 'L3 黄金',
      level: 3,
      freeQuota: 6,
      upgradeCarryRatio: 0.6,
      downgradeCarryRatio: 0.4,
      resetOnDowngrade: false,
      color: '#F59E0B',
    },
    {
      id: 'TIER-L4',
      name: 'L4 铂金',
      level: 4,
      freeQuota: 10,
      upgradeCarryRatio: 0.5,
      downgradeCarryRatio: 0.3,
      resetOnDowngrade: false,
      color: '#A855F7',
    },
    {
      id: 'TIER-L5',
      name: 'L5 钻石',
      level: 5,
      freeQuota: 20,
      upgradeCarryRatio: 0,
      downgradeCarryRatio: 0,
      resetOnDowngrade: true,
      color: '#EF4444',
    },
  ];
}

// 生成租户数据
function createTenants(tiers: TenantTier[]): Tenant[] {
  const tierIds = tiers.map(t => t.id);
  const tierDistribution = [
    tierIds[0], tierIds[0], tierIds[0], tierIds[0],
    tierIds[1], tierIds[1], tierIds[1], tierIds[1], tierIds[1],
    tierIds[2], tierIds[2], tierIds[2], tierIds[2],
    tierIds[3], tierIds[3], tierIds[3],
    tierIds[4], tierIds[4],
    tierIds[0],
    tierIds[1],
  ];
  const statuses: ('active' | 'frozen' | 'terminated')[] = [
    'active', 'active', 'active', 'active', 'active',
    'active', 'active', 'active', 'active', 'active',
    'active', 'active', 'active', 'active', 'active',
    'active', 'active', 'frozen', 'frozen', 'terminated',
  ];

  const tenants: Tenant[] = [];
  for (let i = 0; i < 20; i++) {
    const tierId = tierDistribution[i];
    const tier = tiers.find(t => t.id === tierId)!;
    const createdAt = subDays(TODAY, randomBetween(30, 300));
    tenants.push({
      id: uid('TEN'),
      name: TENANT_NAMES[i],
      phone: randomPhone(),
      idCardNo: randomIdCard(),
      tierId,
      currentQuota: tier.freeQuota + randomBetween(0, 5),
      totalUsedQuota: randomBetween(1, 50),
      status: statuses[i],
      createdAt: formatDate(createdAt),
      remark: i === 19 ? '合同到期未续约' : undefined,
    });
  }
  return tenants;
}

// 生成额度流水
function createQuotaLedgers(tenants: Tenant[], tiers: TenantTier[]): QuotaLedger[] {
  const ledgers: QuotaLedger[] = [];
  const types: QuotaLedger['type'][] = ['grant', 'consume', 'refund', 'carry', 'reset', 'manual'];
  const reasons: Record<string, string[]> = {
    grant: ['新租户注册赠送额度', '等级提升发放免费额度', '活动奖励额度'],
    consume: ['租用仓库 A-01', '租用仓库 B-05', '租用仓库 C-12', '租用仓库 A-08'],
    refund: ['退租仓库 A-01', '提前结束合同退还'],
    carry: ['等级升级额度结转', '等级降级额度结转'],
    reset: ['等级变更额度清零', '降级额度重置'],
    manual: ['人工调整额度', '补偿额度', '特殊审批调整'],
  };

  tenants.forEach(tenant => {
    const count = randomBetween(5, 15);
    let balance = 0;
    for (let i = 0; i < count; i++) {
      const type = pick(types);
      let delta = 0;
      if (type === 'grant' || type === 'carry' || type === 'refund') {
        delta = randomBetween(1, 10);
      } else if (type === 'consume') {
        delta = -randomBetween(1, 3);
      } else if (type === 'reset') {
        delta = -balance;
      } else {
        delta = randomBetween(-5, 5);
      }
      balance = Math.max(0, balance + delta);
      const operator = pick(OPERATORS);
      const created = subDays(TODAY, randomBetween(1, 180));
      ledgers.push({
        id: uid('QL'),
        tenantId: tenant.id,
        type,
        delta,
        balanceAfter: balance,
        operatorId: operator.id,
        operatorName: operator.name,
        reason: pick(reasons[type]),
        createdAt: formatDate(created),
      });
    }
    tenant.currentQuota = balance;
  });
  return ledgers;
}

// 生成等级变更记录
function createTierChangeRecords(tenants: Tenant[], tiers: TenantTier[]): TierChangeRecord[] {
  const records: TierChangeRecord[] = [];
  const changeTenants = [2, 5, 8, 11, 14, 17];

  changeTenants.forEach(idx => {
    const tenant = tenants[idx];
    if (!tenant) return;
    const currentTier = tiers.find(t => t.id === tenant.tierId)!;
    const tierIdx = tiers.indexOf(currentTier);
    if (tierIdx <= 0 || tierIdx >= tiers.length - 1) return;

    const isUpgrade = Math.random() > 0.4;
    const fromTier = isUpgrade ? tiers[tierIdx - 1] : tiers[tierIdx + 1];
    const toTier = currentTier;
    const carryStrategy = isUpgrade ? 'ratio' : (toTier.resetOnDowngrade ? 'reset' : 'ratio');
    const carryRatio = carryStrategy === 'ratio'
      ? (isUpgrade ? fromTier.upgradeCarryRatio : fromTier.downgradeCarryRatio)
      : undefined;
    const quotaBefore = fromTier.freeQuota + randomBetween(1, 5);
    const quotaAfter = carryStrategy === 'reset'
      ? toTier.freeQuota
      : toTier.freeQuota + Math.floor(quotaBefore * (carryRatio || 0));
    const operator = pick(OPERATORS);
    const calculation = carryStrategy === 'reset'
      ? `降级清零，新等级基础额度: ${toTier.freeQuota}`
      : `旧额度(${quotaBefore}) × 结转比例(${carryRatio}) + 新等级基础(${toTier.freeQuota}) = ${quotaAfter}`;

    records.push({
      id: uid('TCR'),
      tenantId: tenant.id,
      fromTierId: fromTier.id,
      toTierId: toTier.id,
      carryStrategy,
      carryRatio,
      quotaBefore,
      quotaAfter,
      calculation,
      operatorId: operator.id,
      operatorName: operator.name,
      reason: isUpgrade ? '租户申请升级等级' : '租户申请降级等级',
      createdAt: formatDate(subDays(TODAY, randomBetween(10, 120))),
    });
  });
  return records;
}

// 生成计费规则
function createPricingRule(): PricingRule {
  return {
    id: 'PR-001',
    minDays: 3,
    minPrice: 50,
    maxDays: 30,
    maxPrice: 300,
    unitPricePerDay: 12,
    overdueFreezeThreshold: 500,
    updatedAt: formatDate(subDays(TODAY, 60)),
    updatedBy: '王主管',
  };
}

// 生成仓库单元
function createStorageUnits(): StorageUnit[] {
  const units: StorageUnit[] = [];
  const zones = ['A', 'B', 'C'];
  const sizes: ('S' | 'M' | 'L' | 'XL')[] = ['S', 'M', 'L', 'XL'];
  const statuses: ('idle' | 'rented' | 'maintenance')[] = [
    'idle', 'idle', 'rented', 'rented', 'rented',
    'rented', 'rented', 'idle', 'maintenance', 'idle',
  ];

  zones.forEach(zone => {
    for (let i = 1; i <= 20; i++) {
      const code = `${zone}-${String(i).padStart(2, '0')}`;
      const sizeIdx = (i - 1) % 4;
      const statusIdx = (i + zones.indexOf(zone) * 7) % 10;
      units.push({
        id: uid('SU'),
        code,
        zone,
        size: sizes[sizeIdx],
        status: statuses[statusIdx],
      });
    }
  });
  return units;
}

// 生成租期合同
function createContracts(tenants: Tenant[], units: StorageUnit[]): RentalContract[] {
  const contracts: RentalContract[] = [];
  const rentedUnits = units.filter(u => u.status === 'rented');
  let unitIdx = 0;

  tenants.forEach(tenant => {
    if (tenant.status === 'terminated') return;
    const contractCount = tenant.status === 'frozen' ? 1 : randomBetween(1, 4);
    for (let i = 0; i < contractCount && unitIdx < rentedUnits.length; i++) {
      const unit = rentedUnits[unitIdx++];
      const start = subDays(TODAY, randomBetween(5, 90));
      const isLongTerm = Math.random() > 0.6;
      const end = isLongTerm ? null : addDays(start, randomBetween(30, 180));
      contracts.push({
        id: uid('CT'),
        tenantId: tenant.id,
        unitId: unit.id,
        startDate: formatDateOnly(start),
        endDate: end ? formatDateOnly(end) : null,
        status: 'active',
      });
    }
  });
  return contracts;
}

// 计算单个合同的账单金额
function calculateBill(
  contract: RentalContract,
  unit: StorageUnit,
  periodStart: Date,
  periodEnd: Date,
  rule: PricingRule
): { days: number; pricingType: 'min' | 'normal' | 'max'; unitPrice: number; subtotal: number; remark: string } {
  const cStart = parseISO(contract.startDate);
  const cEnd = contract.endDate ? parseISO(contract.endDate) : periodEnd;
  const effectiveStart = cStart > periodStart ? cStart : periodStart;
  const effectiveEnd = cEnd < periodEnd ? cEnd : periodEnd;
  const days = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));

  let pricingType: 'min' | 'normal' | 'max' = 'normal';
  let unitPrice = rule.unitPricePerDay;
  let subtotal = days * rule.unitPricePerDay;

  if (days <= rule.minDays) {
    pricingType = 'min';
    subtotal = rule.minPrice;
    unitPrice = rule.minPrice / rule.minDays;
  } else if (days >= rule.maxDays) {
    pricingType = 'max';
    subtotal = rule.maxPrice;
    unitPrice = rule.maxPrice / rule.maxDays;
  }

  const remark = `${unit.code} 租期 ${formatDateOnly(effectiveStart)} ~ ${formatDateOnly(effectiveEnd)} 共${days}天`;
  return { days, pricingType, unitPrice, subtotal, remark };
}

// 生成账单数据
function createBills(
  tenants: Tenant[],
  contracts: RentalContract[],
  units: StorageUnit[],
  rule: PricingRule
): Bill[] {
  const bills: Bill[] = [];
  const months = [
    { start: startOfMonth(subMonths(TODAY, 2)), end: endOfMonth(subMonths(TODAY, 2)) },
    { start: startOfMonth(subMonths(TODAY, 1)), end: endOfMonth(subMonths(TODAY, 1)) },
    { start: startOfMonth(TODAY), end: TODAY },
  ];
  const billStatuses: Bill['status'][] = ['paid', 'paid', 'paid', 'paid', 'pending', 'pending', 'overdue'];

  let billSeq = 1;
  tenants.forEach(tenant => {
    if (tenant.status === 'terminated') return;
    const tenantContracts = contracts.filter(c => c.tenantId === tenant.id);
    if (tenantContracts.length === 0) return;

    months.forEach((month, mIdx) => {
      const activeContracts = tenantContracts.filter(c => {
        const cStart = parseISO(c.startDate);
        const cEnd = c.endDate ? parseISO(c.endDate) : new Date('2099-12-31');
        return cStart <= month.end && cEnd >= month.start;
      });
      if (activeContracts.length === 0 && mIdx === 2) return;
      if (activeContracts.length === 0) return;

      const statusIdx = (billSeq + mIdx * 3) % billStatuses.length;
      const status = billStatuses[statusIdx];
      const items: BillItem[] = [];
      let totalAmount = 0;
      const billId = uid('BILL');

      activeContracts.forEach(contract => {
        const unit = units.find(u => u.id === contract.unitId)!;
        const calc = calculateBill(contract, unit, month.start, month.end, rule);
        items.push({
          id: uid('BI'),
          billId,
          contractId: contract.id,
          unitCode: unit.code,
          days: calc.days,
          pricingType: calc.pricingType,
          unitPrice: Math.round(calc.unitPrice * 100) / 100,
          subtotal: calc.subtotal,
          remark: calc.remark,
        });
        totalAmount += calc.subtotal;
      });

      const issuedAt = addDays(month.start, 1);
      const paidAt = status === 'paid' ? addDays(issuedAt, randomBetween(1, 10)) : undefined;

      bills.push({
        id: billId,
        billNo: `INV-${format(month.start, 'yyyyMM')}-${String(billSeq).padStart(4, '0')}`,
        tenantId: tenant.id,
        periodStart: formatDateOnly(month.start),
        periodEnd: formatDateOnly(month.end),
        totalAmount: Math.round(totalAmount * 100) / 100,
        paidAmount: status === 'paid' ? Math.round(totalAmount * 100) / 100 : (status === 'overdue' ? 0 : Math.round(totalAmount * randomBetween(0, 50) / 100) / 10),
        status,
        items,
        issuedAt: formatDate(issuedAt),
        paidAt: paidAt ? formatDate(paidAt) : undefined,
      });
      billSeq++;
    });
  });
  return bills;
}

// 生成门禁授权
function createAccessGrants(contracts: RentalContract[], units: StorageUnit[]): AccessGrant[] {
  const grants: AccessGrant[] = [];
  const activeContracts = contracts.filter(c => c.status === 'active');

  activeContracts.forEach((contract, idx) => {
    const start = parseISO(contract.startDate);
    const end = contract.endDate ? parseISO(contract.endDate) : addMonths(start, 12);
    const isFrozen = idx === 3 || idx === 15;

    grants.push({
      id: uid('AG'),
      tenantId: contract.tenantId,
      unitId: contract.unitId,
      startDate: formatDateOnly(start),
      endDate: formatDateOnly(end),
      status: isFrozen ? 'frozen' : 'active',
      frozenReason: isFrozen ? (idx === 3 ? '欠费超过阈值' : '违规使用被冻结') : undefined,
      createdAt: formatDate(start),
    });
  });
  return grants;
}

// 生成审计日志
function createAuditLogs(
  tenants: Tenant[],
  tiers: TenantTier[],
  bills: Bill[],
  grants: AccessGrant[],
  tierChanges: TierChangeRecord[],
  ledgers: QuotaLedger[]
): AuditLog[] {
  const logs: AuditLog[] = [];
  const actions = [
    { action: 'tenant.create', targetType: 'Tenant' },
    { action: 'tenant.update', targetType: 'Tenant' },
    { action: 'tier.change', targetType: 'Tenant' },
    { action: 'tier.create', targetType: 'TenantTier' },
    { action: 'tier.update', targetType: 'TenantTier' },
    { action: 'bill.issue', targetType: 'Bill' },
    { action: 'bill.paid', targetType: 'Bill' },
    { action: 'quota.adjust', targetType: 'Tenant' },
    { action: 'access.grant', targetType: 'AccessGrant' },
    { action: 'access.freeze', targetType: 'AccessGrant' },
    { action: 'pricing.update', targetType: 'PricingRule' },
    { action: 'contract.create', targetType: 'RentalContract' },
  ];

  function addLog(
    action: string,
    targetType: string,
    targetId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
    daysAgo: number
  ) {
    const op = pick(OPERATORS);
    logs.push({
      id: uid('LOG'),
      operatorId: op.id,
      operatorName: op.name,
      operatorIp: op.ip,
      action,
      targetType,
      targetId,
      beforeSnapshot: before,
      afterSnapshot: after,
      createdAt: formatDate(subDays(TODAY, daysAgo)),
    });
  }

  // 租户创建日志
  tenants.slice(0, 15).forEach((t, i) => {
    addLog('tenant.create', 'Tenant', t.id, null, { name: t.name, tierId: t.tierId }, 180 - i * 8);
  });

  // 等级变更日志
  tierChanges.forEach(tc => {
    addLog('tier.change', 'Tenant', tc.tenantId, { tierId: tc.fromTierId }, { tierId: tc.toTierId }, randomBetween(20, 100));
  });

  // 账单相关日志
  bills.slice(0, 20).forEach((b, i) => {
    addLog('bill.issue', 'Bill', b.id, null, { billNo: b.billNo, amount: b.totalAmount }, 60 - i * 2);
    if (b.status === 'paid') {
      addLog('bill.paid', 'Bill', b.id, { status: 'pending' }, { status: 'paid', paidAmount: b.paidAmount }, 55 - i * 2);
    }
  });

  // 门禁相关日志
  grants.slice(0, 12).forEach((g, i) => {
    addLog('access.grant', 'AccessGrant', g.id, null, { unitId: g.unitId, tenantId: g.tenantId }, 30 + i);
    if (g.status === 'frozen') {
      addLog('access.freeze', 'AccessGrant', g.id, { status: 'active' }, { status: 'frozen', reason: g.frozenReason }, randomBetween(5, 20));
    }
  });

  // 额度调整日志
  ledgers.filter(l => l.type === 'manual').slice(0, 10).forEach(l => {
    addLog('quota.adjust', 'Tenant', l.tenantId, null, { delta: l.delta, reason: l.reason }, randomBetween(10, 90));
  });

  // 等级配置变更日志
  tiers.slice(0, 3).forEach(t => {
    addLog('tier.update', 'TenantTier', t.id, { ...t, freeQuota: t.freeQuota - 1 }, { ...t }, randomBetween(50, 150));
  });

  // 计费规则更新日志
  addLog('pricing.update', 'PricingRule', 'PR-001',
    { minPrice: 45, unitPricePerDay: 10 },
    { minPrice: 50, unitPricePerDay: 12 },
    60
  );

  // 租户信息更新日志
  tenants.slice(0, 5).forEach(t => {
    addLog('tenant.update', 'Tenant', t.id, { phone: '13800000000' }, { phone: t.phone }, randomBetween(20, 120));
  });

  // 补充到50+条
  while (logs.length < 55) {
    const act = pick(actions);
    const tenant = pick(tenants);
    addLog(act.action, act.targetType, tenant.id, null, { note: '系统自动记录' }, randomBetween(1, 200));
  }

  // 按时间倒序
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return logs;
}

export function createSeedData() {
  const tiers = createTiers();
  const tenants = createTenants(tiers);
  const quotaLedgers = createQuotaLedgers(tenants, tiers);
  const tierChangeRecords = createTierChangeRecords(tenants, tiers);
  const pricingRule = createPricingRule();
  const storageUnits = createStorageUnits();
  const contracts = createContracts(tenants, storageUnits);
  const bills = createBills(tenants, contracts, storageUnits, pricingRule);
  const accessGrants = createAccessGrants(contracts, storageUnits);
  const auditLogs = createAuditLogs(tenants, tiers, bills, accessGrants, tierChangeRecords, quotaLedgers);

  return {
    tiers,
    tenants,
    quotaLedgers,
    tierChangeRecords,
    pricingRule,
    storageUnits,
    contracts,
    bills,
    accessGrants,
    auditLogs,
  };
}
