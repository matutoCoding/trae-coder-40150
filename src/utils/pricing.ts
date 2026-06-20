import type { PricingRule, PricingCalculateResult, PricingType } from '../types';

// 金额四舍五入保留两位小数
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

// 计算租赁费用
export function calculateRental(
  rule: PricingRule,
  days: number,
  units: number
): PricingCalculateResult {
  let pricingType: PricingType;
  let unitPrice: number;
  let subtotal: number;
  let remark: string;

  if (days <= rule.minDays) {
    pricingType = 'min';
    unitPrice = roundMoney(rule.minPrice);
    subtotal = roundMoney(rule.minPrice * units);
    remark = '起步价';
  } else if (days >= rule.maxDays) {
    pricingType = 'max';
    unitPrice = roundMoney(rule.maxPrice);
    subtotal = roundMoney(rule.maxPrice * units);
    remark = '封顶价';
  } else {
    pricingType = 'normal';
    const extraDays = days - rule.minDays;
    unitPrice = roundMoney(rule.minPrice + extraDays * rule.unitPricePerDay);
    subtotal = roundMoney(unitPrice * units);
    remark = '';
  }

  return {
    pricingType,
    days,
    unitPrice,
    subtotal,
    remark
  };
}
