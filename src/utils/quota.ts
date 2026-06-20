import type { TenantTier, CarryStrategy } from '../types';

// 四舍五入取整
export function round(n: number): number {
  return Math.round(n);
}

interface CalculateCarryQuotaParams {
  currentQuota: number;
  fromTier: TenantTier;
  toTier: TenantTier;
}

interface CalculateCarryQuotaResult {
  newQuota: number;
  strategy: CarryStrategy;
  ratio?: number;
  calculation: string;
}

// 计算结转额度
export function calculateCarryQuota(
  params: CalculateCarryQuotaParams
): CalculateCarryQuotaResult {
  const { currentQuota, fromTier, toTier } = params;
  const isUpgrade = toTier.level > fromTier.level;

  let strategy: CarryStrategy;
  let ratio: number | undefined;
  let newQuota: number;
  let calculation: string;

  if (isUpgrade) {
    strategy = 'ratio';
    ratio = fromTier.upgradeCarryRatio;
    const rawQuota = round(currentQuota * (toTier.freeQuota / fromTier.freeQuota) * ratio);
    newQuota = Math.min(rawQuota, toTier.freeQuota);
    calculation = `${currentQuota} × (${toTier.freeQuota}/${fromTier.freeQuota}) × ${ratio} = ${rawQuota}${rawQuota > toTier.freeQuota ? `，上限 ${toTier.freeQuota}` : ''}`;
  } else {
    if (toTier.resetOnDowngrade) {
      strategy = 'reset';
      newQuota = toTier.freeQuota;
      calculation = `降级清零，新额度 = ${toTier.freeQuota}`;
    } else {
      strategy = 'ratio';
      ratio = fromTier.downgradeCarryRatio;
      const rawQuota = round(currentQuota * (toTier.freeQuota / fromTier.freeQuota) * ratio);
      newQuota = Math.min(rawQuota, toTier.freeQuota);
      calculation = `${currentQuota} × (${toTier.freeQuota}/${fromTier.freeQuota}) × ${ratio} = ${rawQuota}${rawQuota > toTier.freeQuota ? `，上限 ${toTier.freeQuota}` : ''}`;
    }
  }

  const result: CalculateCarryQuotaResult = {
    newQuota,
    strategy,
    calculation
  };

  if (ratio !== undefined) {
    result.ratio = ratio;
  }

  return result;
}
