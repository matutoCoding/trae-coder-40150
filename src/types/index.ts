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
export type QuotaLedgerType = 'grant' | 'consume' | 'refund' | 'carry' | 'reset' | 'manual';

export interface QuotaLedger {
  id: string;
  tenantId: string;
  type: QuotaLedgerType;
  delta: number;
  balanceAfter: number;
  operatorId: string;
  operatorName: string;
  reason: string;
  relatedTierChangeId?: string;
  billId?: string;
  createdAt: string;
}

// 等级变更记录
export type CarryStrategy = 'ratio' | 'reset';

export interface TierChangeRecord {
  id: string;
  tenantId: string;
  fromTierId: string;
  toTierId: string;
  carryStrategy: CarryStrategy;
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
export type StorageUnitSize = 'S' | 'M' | 'L' | 'XL';
export type StorageUnitStatus = 'idle' | 'rented' | 'maintenance';

export interface StorageUnit {
  id: string;
  code: string;
  zone: string;
  size: StorageUnitSize;
  status: StorageUnitStatus;
}

// 租期合同
export type RentalContractStatus = 'active' | 'ended';

export interface RentalContract {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string | null;
  status: RentalContractStatus;
  actualDays?: number;
}

// 账单
export type BillStatus = 'pending' | 'paid' | 'overdue' | 'void';
export type PricingType = 'min' | 'normal' | 'max';

export interface BillItem {
  id: string;
  billId: string;
  contractId: string;
  unitId?: string;
  unitCode: string;
  days: number;
  pricingType: PricingType;
  unitPrice: number;
  subtotal: number;
  remark: string;
}

export interface Bill {
  id: string;
  billNo: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  paidAmount: number;
  status: BillStatus;
  items: BillItem[];
  issuedAt: string;
  paidAt?: string;
}

// 门禁授权
export type AccessGrantStatus = 'active' | 'frozen' | 'expired' | 'revoked';

export type AccessGrantEventType = 'created' | 'frozen' | 'unfrozen' | 'expired' | 'superseded';

export interface AccessGrantEvent {
  id: string;
  type: AccessGrantEventType;
  time: string;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
  relatedGrantId?: string;
  relatedGrantTenantName?: string;
}

export interface AccessGrant {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  status: AccessGrantStatus;
  frozenReason?: string;
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  supersededByGrantId?: string;
  events: AccessGrantEvent[];
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
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  createdAt: string;
}

// 升降级请求载荷
export interface TierChangePayload {
  tenantId: string;
  toTierId: string;
  reason: string;
  operatorId: string;
  operatorName: string;
}

// 额度手工调整请求载荷
export interface QuotaAdjustPayload {
  tenantId: string;
  delta: number;
  reason: string;
  operatorId: string;
  operatorName: string;
}

// 计费试算请求
export interface PricingCalculateRequest {
  rule: PricingRule;
  days: number;
  units: number;
}

// 计费试算结果
export interface PricingCalculateResult {
  pricingType: PricingType;
  days: number;
  unitPrice: number;
  subtotal: number;
  remark: string;
}

// 账单预览明细行
export interface BillPreviewItem {
  tenantId: string;
  tenantName: string;
  unitCode: string;
  days: number;
  pricingType: PricingType;
  unitPrice: number;
  subtotal: number;
  remark: string;
}

// 账单预览结果
export interface BillPreviewResult {
  items: BillPreviewItem[];
  billCount: number;
  totalAmount: number;
  frozenCount: number;
}
