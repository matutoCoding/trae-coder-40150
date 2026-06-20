import { create } from 'zustand';
import {
  initDB,
  getCollection,
  insert,
  update,
  remove,
  COLLECTION_KEYS,
} from '../data/db';
import { calculateRental } from '../utils/pricing';
import type {
  TenantTier,
  Tenant,
  QuotaLedger,
  TierChangeRecord,
  PricingRule,
  StorageUnit,
  RentalContract,
  Bill,
  BillItem,
  AccessGrant,
  AuditLog,
  TierChangePayload,
  QuotaAdjustPayload,
} from '../types';

// 当前登录的管理员会话信息
interface Session {
  operatorId: string;
  operatorName: string;
  operatorIp: string;
}

// 审计日志写入工具函数的 store 上下文类型
type StoreState = AppStoreState & AppStoreActions;

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

// 计算两个日期之间的天数（含首尾）
function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// 通用审计日志写入函数
export function writeAudit(
  store: StoreState,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown
): void {
  const log: AuditLog = {
    id: uid('LOG'),
    operatorId: store.session.operatorId,
    operatorName: store.session.operatorName,
    operatorIp: store.session.operatorIp,
    action,
    targetType,
    targetId,
    beforeSnapshot: before,
    afterSnapshot: after,
    createdAt: nowStr(),
  };
  const updated = insert<AuditLog>(COLLECTION_KEYS.auditLogs, log);
  store.auditLogs = [...store.auditLogs, updated];
}

// ====== Zustand Store 状态定义 ======
interface AppStoreState {
  // 会话信息
  session: Session;
  // 租户等级列表
  tiers: TenantTier[];
  // 租户列表
  tenants: Tenant[];
  // 额度流水
  quotaLedgers: QuotaLedger[];
  // 等级变更记录
  tierChangeRecords: TierChangeRecord[];
  // 计费规则
  pricing: PricingRule | null;
  // 仓库单元
  storageUnits: StorageUnit[];
  // 租期合同
  contracts: RentalContract[];
  // 账单
  bills: Bill[];
  // 门禁授权
  accessGrants: AccessGrant[];
  // 审计日志
  auditLogs: AuditLog[];
  // UI 状态：当前选中的租户 ID
  selectedTenantId: string | null;
  // UI 状态：移动端导航栏是否展开
  mobileNavOpen: boolean;
}

// ====== Zustand Store 动作定义 ======
interface AppStoreActions {
  // 初始化时调用
  _init: () => void;
  // 等级相关
  loadTiers: () => Promise<void>;
  upsertTier: (t: TenantTier) => void;
  deleteTier: (id: string) => void;
  // 租户相关
  loadTenants: () => Promise<void>;
  getTenantById: (id: string) => Tenant | undefined;
  upsertTenant: (t: Tenant) => void;
  changeTenantTier: (payload: TierChangePayload) => void;
  // 额度流水相关
  loadQuotaLedgers: (tenantId?: string) => Promise<void>;
  adjustQuota: (payload: QuotaAdjustPayload) => void;
  // 等级变更记录相关
  loadTierChangeRecords: (tenantId?: string) => Promise<void>;
  // 计费规则相关
  loadPricing: () => Promise<void>;
  updatePricing: (partial: Partial<PricingRule>) => void;
  // 仓库单元相关
  loadStorageUnits: () => Promise<void>;
  // 合同相关
  loadContracts: () => Promise<void>;
  // 账单相关
  loadBills: () => Promise<void>;
  getBillById: (id: string) => Bill | undefined;
  markBillPaid: (id: string) => void;
  generateBills: (periodStart: string, periodEnd: string) => void;
  // 门禁授权相关
  loadAccessGrants: () => Promise<void>;
  freezeAccess: (id: string, reason: string) => void;
  unfreezeAccess: (id: string) => void;
  createAccessGrant: (
    payload: Omit<AccessGrant, 'id' | 'status' | 'createdAt'>
  ) => void;
  // 审计日志相关
  loadAuditLogs: () => Promise<void>;
  // UI 状态
  setSelectedTenantId: (id: string | null) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export type AppStore = AppStoreState & AppStoreActions;

// ====== 创建 Zustand Store ======
export const useAppStore = create<AppStore>((set, get) => ({
  // ====== 状态初始值 ======
  session: {
    operatorId: 'OP-001',
    operatorName: '系统管理员',
    operatorIp: '127.0.0.1',
  },
  tiers: [],
  tenants: [],
  quotaLedgers: [],
  tierChangeRecords: [],
  pricing: null,
  storageUnits: [],
  contracts: [],
  bills: [],
  accessGrants: [],
  auditLogs: [],
  selectedTenantId: null,
  mobileNavOpen: false,

  // ====== 初始化动作 ======
  _init: () => {
    initDB();
  },

  // ====== 租户等级 ======
  loadTiers: async () => {
    get()._init();
    const list = getCollection<TenantTier>(COLLECTION_KEYS.tiers);
    set({ tiers: list });
  },
  upsertTier: (t: TenantTier) => {
    const store = get();
    const before = store.tiers.find(x => x.id === t.id) || null;
    const exists = store.tiers.some(x => x.id === t.id);
    let updated: TenantTier;
    if (exists) {
      updated = update<TenantTier>(COLLECTION_KEYS.tiers, t.id, t);
    } else {
      updated = insert<TenantTier>(COLLECTION_KEYS.tiers, t);
    }
    const newList = exists
      ? store.tiers.map(x => (x.id === t.id ? updated : x))
      : [...store.tiers, updated];
    set({ tiers: newList });
    writeAudit(
      get(),
      exists ? 'tier.update' : 'tier.create',
      'TenantTier',
      updated.id,
      before,
      updated
    );
  },
  deleteTier: (id: string) => {
    const store = get();
    const before = store.tiers.find(x => x.id === id) || null;
    remove(COLLECTION_KEYS.tiers, id);
    set({ tiers: store.tiers.filter(x => x.id !== id) });
    writeAudit(get(), 'tier.delete', 'TenantTier', id, before, null);
  },

  // ====== 租户 ======
  loadTenants: async () => {
    get()._init();
    const list = getCollection<Tenant>(COLLECTION_KEYS.tenants);
    set({ tenants: list });
  },
  getTenantById: (id: string) => {
    return get().tenants.find(t => t.id === id);
  },
  upsertTenant: (t: Tenant) => {
    const store = get();
    const before = store.tenants.find(x => x.id === t.id) || null;
    const exists = store.tenants.some(x => x.id === t.id);
    let updated: Tenant;
    if (exists) {
      updated = update<Tenant>(COLLECTION_KEYS.tenants, t.id, t);
    } else {
      updated = insert<Tenant>(COLLECTION_KEYS.tenants, t);
    }
    const newList = exists
      ? store.tenants.map(x => (x.id === t.id ? updated : x))
      : [...store.tenants, updated];
    set({ tenants: newList });
    writeAudit(
      get(),
      exists ? 'tenant.update' : 'tenant.create',
      'Tenant',
      updated.id,
      before,
      updated
    );
  },
  changeTenantTier: (payload: TierChangePayload) => {
    const store = get();
    const tenant = store.tenants.find(t => t.id === payload.tenantId);
    if (!tenant) return;
    const fromTier = store.tiers.find(t => t.id === tenant.tierId);
    const toTier = store.tiers.find(t => t.id === payload.toTierId);
    if (!fromTier || !toTier) return;

    const beforeTenant = { ...tenant };
    const isUpgrade = toTier.level > fromTier.level;

    // 决定结转策略
    let carryStrategy: 'ratio' | 'reset';
    let carryRatio: number | undefined;
    let quotaAfter: number;
    let calculation: string;
    const quotaBefore = tenant.currentQuota;

    if (isUpgrade) {
      // 升级：使用 fromTier 的升级结转比例
      carryStrategy = 'ratio';
      carryRatio = fromTier.upgradeCarryRatio;
      const carryAmount = Math.floor(quotaBefore * carryRatio);
      quotaAfter = toTier.freeQuota + carryAmount;
      calculation = `升级：旧额度(${quotaBefore}) × 结转比例(${carryRatio}) + 新等级基础(${toTier.freeQuota}) = ${quotaAfter}`;
    } else {
      // 降级
      if (toTier.resetOnDowngrade) {
        carryStrategy = 'reset';
        quotaAfter = toTier.freeQuota;
        calculation = `降级清零，新等级基础额度: ${toTier.freeQuota}`;
      } else {
        carryStrategy = 'ratio';
        carryRatio = fromTier.downgradeCarryRatio;
        const carryAmount = Math.floor(quotaBefore * carryRatio);
        quotaAfter = toTier.freeQuota + carryAmount;
        calculation = `降级：旧额度(${quotaBefore}) × 结转比例(${carryRatio}) + 新等级基础(${toTier.freeQuota}) = ${quotaAfter}`;
      }
    }

    // 1. 写入等级变更记录
    const tierChangeId = uid('TCR');
    const tierChangeRecord: TierChangeRecord = {
      id: tierChangeId,
      tenantId: payload.tenantId,
      fromTierId: fromTier.id,
      toTierId: toTier.id,
      carryStrategy,
      carryRatio,
      quotaBefore,
      quotaAfter,
      calculation,
      operatorId: payload.operatorId,
      operatorName: payload.operatorName,
      reason: payload.reason,
      createdAt: nowStr(),
    };
    const savedTierChange = insert<TierChangeRecord>(
      COLLECTION_KEYS.tierChangeRecords,
      tierChangeRecord
    );

    // 2. 写入额度流水（carry 或 reset）
    const ledgerType: 'carry' | 'reset' =
      carryStrategy === 'reset' ? 'reset' : 'carry';
    const carryLedger: QuotaLedger = {
      id: uid('QL'),
      tenantId: payload.tenantId,
      type: ledgerType,
      delta: quotaAfter - quotaBefore,
      balanceAfter: quotaAfter,
      operatorId: payload.operatorId,
      operatorName: payload.operatorName,
      reason: `等级变更：${fromTier.name} → ${toTier.name}（${ledgerType === 'reset' ? '额度清零重置' : '额度按比例结转'}）`,
      relatedTierChangeId: tierChangeId,
      createdAt: nowStr(),
    };
    const savedLedger = insert<QuotaLedger>(
      COLLECTION_KEYS.quotaLedgers,
      carryLedger
    );

    // 3. 更新租户的 tierId 和 currentQuota
    const updatedTenant = update<Tenant>(COLLECTION_KEYS.tenants, tenant.id, {
      tierId: toTier.id,
      currentQuota: quotaAfter,
    });

    // 同步更新 store 状态
    set({
      tierChangeRecords: [...store.tierChangeRecords, savedTierChange],
      quotaLedgers: [...store.quotaLedgers, savedLedger],
      tenants: store.tenants.map(t =>
        t.id === tenant.id ? updatedTenant : t
      ),
    });

    // 4. 写审计日志
    writeAudit(
      get(),
      'tier.change',
      'Tenant',
      tenant.id,
      { tierId: fromTier.id, currentQuota: quotaBefore, ...beforeTenant },
      { tierId: toTier.id, currentQuota: quotaAfter, ...updatedTenant }
    );
  },

  // ====== 额度流水 ======
  loadQuotaLedgers: async (tenantId?: string) => {
    get()._init();
    let list = getCollection<QuotaLedger>(COLLECTION_KEYS.quotaLedgers);
    if (tenantId) {
      list = list.filter(l => l.tenantId === tenantId);
    }
    set({ quotaLedgers: list });
  },
  adjustQuota: (payload: QuotaAdjustPayload) => {
    const store = get();
    const tenant = store.tenants.find(t => t.id === payload.tenantId);
    if (!tenant) return;

    const beforeTenant = { ...tenant };
    const newBalance = Math.max(0, tenant.currentQuota + payload.delta);

    // 1. 添加额度流水（类型 manual）
    const ledger: QuotaLedger = {
      id: uid('QL'),
      tenantId: payload.tenantId,
      type: 'manual',
      delta: payload.delta,
      balanceAfter: newBalance,
      operatorId: payload.operatorId,
      operatorName: payload.operatorName,
      reason: payload.reason,
      createdAt: nowStr(),
    };
    const savedLedger = insert<QuotaLedger>(COLLECTION_KEYS.quotaLedgers, ledger);

    // 2. 更新租户 currentQuota
    const updatedTenant = update<Tenant>(COLLECTION_KEYS.tenants, tenant.id, {
      currentQuota: newBalance,
    });

    // 同步状态
    set({
      quotaLedgers: [...store.quotaLedgers, savedLedger],
      tenants: store.tenants.map(t =>
        t.id === tenant.id ? updatedTenant : t
      ),
    });

    // 3. 写审计日志
    writeAudit(
      get(),
      'quota.adjust',
      'Tenant',
      tenant.id,
      { currentQuota: beforeTenant.currentQuota },
      { currentQuota: newBalance, delta: payload.delta, reason: payload.reason }
    );
  },

  // ====== 等级变更记录 ======
  loadTierChangeRecords: async (tenantId?: string) => {
    get()._init();
    let list = getCollection<TierChangeRecord>(
      COLLECTION_KEYS.tierChangeRecords
    );
    if (tenantId) {
      list = list.filter(r => r.tenantId === tenantId);
    }
    set({ tierChangeRecords: list });
  },

  // ====== 计费规则 ======
  loadPricing: async () => {
    get()._init();
    const list = getCollection<PricingRule>(COLLECTION_KEYS.pricingRule);
    set({ pricing: list[0] || null });
  },
  updatePricing: (partial: Partial<PricingRule>) => {
    const store = get();
    if (!store.pricing) return;
    const before = { ...store.pricing };
    const updated = update<PricingRule>(
      COLLECTION_KEYS.pricingRule,
      store.pricing.id,
      {
        ...partial,
        updatedAt: nowStr(),
        updatedBy: store.session.operatorName,
      }
    );
    set({ pricing: updated });
    writeAudit(
      get(),
      'pricing.update',
      'PricingRule',
      updated.id,
      before,
      updated
    );
  },

  // ====== 仓库单元 ======
  loadStorageUnits: async () => {
    get()._init();
    const list = getCollection<StorageUnit>(COLLECTION_KEYS.storageUnits);
    set({ storageUnits: list });
  },

  // ====== 租期合同 ======
  loadContracts: async () => {
    get()._init();
    const list = getCollection<RentalContract>(COLLECTION_KEYS.contracts);
    set({ contracts: list });
  },

  // ====== 账单 ======
  loadBills: async () => {
    get()._init();
    const list = getCollection<Bill>(COLLECTION_KEYS.bills);
    set({ bills: list });
  },
  getBillById: (id: string) => {
    return get().bills.find(b => b.id === id);
  },
  markBillPaid: (id: string) => {
    const store = get();
    const bill = store.bills.find(b => b.id === id);
    if (!bill) return;
    const before = { ...bill };
    const updated = update<Bill>(COLLECTION_KEYS.bills, id, {
      status: 'paid',
      paidAmount: bill.totalAmount,
      paidAt: nowStr(),
    });
    set({
      bills: store.bills.map(b => (b.id === id ? updated : b)),
    });
    writeAudit(
      get(),
      'bill.paid',
      'Bill',
      id,
      { status: before.status, paidAmount: before.paidAmount },
      { status: 'paid', paidAmount: updated.paidAmount, paidAt: updated.paidAt }
    );
  },
  generateBills: (periodStart: string, periodEnd: string) => {
    const store = get();
    const { pricing, contracts, storageUnits, accessGrants } = store;
    if (!pricing) return;

    // 按租户分组活跃合同
    const activeContracts = contracts.filter(c => c.status === 'active');

    // 构建按 tenantId 分组的合同 map
    const contractsByTenant = new Map<string, RentalContract[]>();
    for (const contract of activeContracts) {
      const arr = contractsByTenant.get(contract.tenantId) || [];
      arr.push(contract);
      contractsByTenant.set(contract.tenantId, arr);
    }

    const newBills: Bill[] = [];
    const newBillItems: BillItem[] = [];
    // 待冻结门禁列表（账单总额超过阈值的租户）
    const tenantsToFreeze: string[] = [];

    let billSeq = store.bills.length + 1;

    // 遍历每个租户的合同
    for (const [tenantId, tenantContracts] of contractsByTenant) {
      const items: BillItem[] = [];
      let totalAmount = 0;
      const billId = uid('BILL');

      for (const contract of tenantContracts) {
        // 计算合同在账期内的有效天数
        const cStart = new Date(contract.startDate);
        const cEnd = contract.endDate
          ? new Date(contract.endDate)
          : new Date(periodEnd);
        const pStart = new Date(periodStart);
        const pEnd = new Date(periodEnd);
        const effectiveStart = cStart > pStart ? cStart : pStart;
        const effectiveEnd = cEnd < pEnd ? cEnd : pEnd;
        const days = Math.max(
          1,
          Math.ceil(
            (effectiveEnd.getTime() - effectiveStart.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

        // 找到对应仓库单元
        const unit = storageUnits.find(u => u.id === contract.unitId);
        if (!unit) continue;

        // 计算租赁费用
        const calc = calculateRental(pricing, days, 1);

        const item: BillItem = {
          id: uid('BI'),
          billId,
          contractId: contract.id,
          unitCode: unit.code,
          days,
          pricingType: calc.pricingType,
          unitPrice: calc.unitPrice,
          subtotal: calc.subtotal,
          remark: `${unit.code} 租期 ${periodStart} ~ ${periodEnd} 共${days}天${calc.remark ? '(' + calc.remark + ')' : ''}`,
        };
        items.push(item);
        newBillItems.push(item);
        totalAmount += calc.subtotal;
      }

      // 跳过没有明细的账单
      if (items.length === 0) continue;

      // 四舍五入总金额
      totalAmount = Math.round(totalAmount * 100) / 100;

      // 生成账单号
      const periodYM = periodStart.slice(0, 7).replace(/-/g, '');
      const billNo = `INV-${periodYM}-${String(billSeq).padStart(4, '0')}`;
      billSeq++;

      const bill: Bill = {
        id: billId,
        billNo,
        tenantId,
        periodStart,
        periodEnd,
        totalAmount,
        paidAmount: 0,
        status: 'pending',
        items,
        issuedAt: nowStr(),
      };
      newBills.push(bill);

      // 检查是否超过逾期冻结阈值
      if (totalAmount > pricing.overdueFreezeThreshold) {
        tenantsToFreeze.push(tenantId);
      }
    }

    // 持久化新账单
    for (const bill of newBills) {
      insert<Bill>(COLLECTION_KEYS.bills, bill);
    }

    // 处理门禁冻结
    const updatedAccessGrants = [...accessGrants];
    if (tenantsToFreeze.length > 0) {
      for (let i = 0; i < updatedAccessGrants.length; i++) {
        const grant = updatedAccessGrants[i];
        if (
          tenantsToFreeze.includes(grant.tenantId) &&
          grant.status === 'active'
        ) {
          const updated = update<AccessGrant>(
            COLLECTION_KEYS.accessGrants,
            grant.id,
            {
              status: 'frozen',
              frozenReason: `账单金额超过冻结阈值 ${pricing.overdueFreezeThreshold} 元`,
            }
          );
          updatedAccessGrants[i] = updated;
          writeAudit(
            get(),
            'access.freeze',
            'AccessGrant',
            grant.id,
            { status: 'active' },
            { status: 'frozen', reason: updated.frozenReason }
          );
        }
      }
    }

    // 更新 store 状态
    set({
      bills: [...store.bills, ...newBills],
      accessGrants: updatedAccessGrants,
    });

    // 写入账单生成的审计日志
    for (const bill of newBills) {
      writeAudit(
        get(),
        'bill.issue',
        'Bill',
        bill.id,
        null,
        {
          billNo: bill.billNo,
          tenantId: bill.tenantId,
          totalAmount: bill.totalAmount,
        }
      );
    }
  },

  // ====== 门禁授权 ======
  loadAccessGrants: async () => {
    get()._init();
    const list = getCollection<AccessGrant>(COLLECTION_KEYS.accessGrants);
    set({ accessGrants: list });
  },
  freezeAccess: (id: string, reason: string) => {
    const store = get();
    const grant = store.accessGrants.find(g => g.id === id);
    if (!grant) return;
    const before = { ...grant };
    const updated = update<AccessGrant>(COLLECTION_KEYS.accessGrants, id, {
      status: 'frozen',
      frozenReason: reason,
    });
    set({
      accessGrants: store.accessGrants.map(g =>
        g.id === id ? updated : g
      ),
    });
    writeAudit(
      get(),
      'access.freeze',
      'AccessGrant',
      id,
      { status: before.status },
      { status: 'frozen', reason }
    );
  },
  unfreezeAccess: (id: string) => {
    const store = get();
    const grant = store.accessGrants.find(g => g.id === id);
    if (!grant) return;
    const before = { ...grant };
    const updated = update<AccessGrant>(COLLECTION_KEYS.accessGrants, id, {
      status: 'active',
      frozenReason: undefined,
    });
    set({
      accessGrants: store.accessGrants.map(g =>
        g.id === id ? updated : g
      ),
    });
    writeAudit(
      get(),
      'access.unfreeze',
      'AccessGrant',
      id,
      { status: before.status, frozenReason: before.frozenReason },
      { status: 'active' }
    );
  },
  createAccessGrant: (
    payload: Omit<AccessGrant, 'id' | 'status' | 'createdAt'>
  ) => {
    const store = get();
    const grant: AccessGrant = {
      id: uid('AG'),
      tenantId: payload.tenantId,
      unitId: payload.unitId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: 'active',
      createdAt: nowStr(),
    };
    const saved = insert<AccessGrant>(COLLECTION_KEYS.accessGrants, grant);
    set({ accessGrants: [...store.accessGrants, saved] });
    writeAudit(
      get(),
      'access.grant',
      'AccessGrant',
      saved.id,
      null,
      {
        tenantId: saved.tenantId,
        unitId: saved.unitId,
        startDate: saved.startDate,
        endDate: saved.endDate,
      }
    );
  },

  // ====== 审计日志 ======
  loadAuditLogs: async () => {
    get()._init();
    const list = getCollection<AuditLog>(COLLECTION_KEYS.auditLogs);
    set({ auditLogs: list });
  },

  // ====== UI 状态 ======
  setSelectedTenantId: (id: string | null) => {
    set({ selectedTenantId: id });
  },
  setMobileNavOpen: (open: boolean) => {
    set({ mobileNavOpen: open });
  },
}));
