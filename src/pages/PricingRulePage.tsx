import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Calculator, AlertTriangle, CheckCircle2, Minus, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { calculateRental, roundMoney } from '@/utils/pricing';
import type { PricingType } from '@/types';

// 计费规则表单校验 Schema
const pricingFormSchema = z.object({
  minDays: z.coerce.number().int().min(1, '起步天数至少为1天').max(365, '起步天数不能超过365天'),
  minPrice: z.coerce.number().min(0, '起步金额不能为负数').max(100000, '起步金额过大'),
  maxDays: z.coerce.number().int().min(1, '封顶天数至少为1天').max(3650, '封顶天数不能超过3650天'),
  maxPrice: z.coerce.number().min(0, '封顶金额不能为负数').max(1000000, '封顶金额过大'),
  unitPricePerDay: z.coerce.number().min(0, '单价不能为负数').max(10000, '单价过大'),
  overdueFreezeThreshold: z.coerce.number().min(0, '冻结阈值不能为负数').max(1000000, '阈值过大'),
}).refine((data) => data.maxDays > data.minDays, {
  message: '封顶天数必须大于起步天数',
  path: ['maxDays'],
}).refine((data) => data.maxPrice > data.minPrice, {
  message: '封顶金额必须大于起步金额',
  path: ['maxPrice'],
});

type PricingFormValues = z.infer<typeof pricingFormSchema>;

// 计费类型标签配置
const PRICING_TYPE_CONFIG: Record<PricingType, { label: string; className: string; blinkClass: string }> = {
  min: {
    label: '起步价',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    blinkClass: 'animate-pulse',
  },
  normal: {
    label: '正常计费',
    className: 'bg-brand-50 text-brand-700 border-brand-200',
    blinkClass: '',
  },
  max: {
    label: '封顶价',
    className: 'bg-amber-100 text-amber-700 border-amber-300',
    blinkClass: 'animate-pulse',
  },
};

export default function PricingRulePage() {
  const { pricing, updatePricing } = useAppStore();
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [rentalDays, setRentalDays] = useState(15);
  const [rentalUnits, setRentalUnits] = useState(1);
  const [amountFlashKey, setAmountFlashKey] = useState(0);
  const [prevSubtotal, setPrevSubtotal] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      minDays: 7,
      minPrice: 100,
      maxDays: 60,
      maxPrice: 800,
      unitPricePerDay: 15,
      overdueFreezeThreshold: 500,
    },
  });

  // 监听表单值，用于实时试算
  const formValues = watch();

  // 构建用于试算的规则对象（优先用表单当前值，回退到 store 中保存的值）
  const trialRule = useMemo(() => {
    const savedRule = pricing ?? {
      id: 'temp',
      minDays: 7,
      minPrice: 100,
      maxDays: 60,
      maxPrice: 800,
      unitPricePerDay: 15,
      overdueFreezeThreshold: 500,
      updatedAt: '',
      updatedBy: '',
    };
    return {
      ...savedRule,
      ...formValues,
    };
  }, [formValues, pricing]);

  // 初始化表单默认值
  useEffect(() => {
    if (pricing) {
      reset({
        minDays: pricing.minDays,
        minPrice: pricing.minPrice,
        maxDays: pricing.maxDays,
        maxPrice: pricing.maxPrice,
        unitPricePerDay: pricing.unitPricePerDay,
        overdueFreezeThreshold: pricing.overdueFreezeThreshold,
      });
    }
  }, [pricing, reset]);

  // 实时试算结果
  const trialResult = useMemo(() => {
    return calculateRental(trialRule, rentalDays, rentalUnits);
  }, [trialRule, rentalDays, rentalUnits]);

  // 金额变化时触发 flash 动画
  useEffect(() => {
    if (prevSubtotal !== null && prevSubtotal !== trialResult.subtotal) {
      setAmountFlashKey((k) => k + 1);
    }
    setPrevSubtotal(trialResult.subtotal);
  }, [trialResult.subtotal, prevSubtotal]);

  // 提交表单：保存计费规则
  const onSubmit = async (values: PricingFormValues) => {
    updatePricing(values);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2500);
  };

  // 超出起步部分的天数
  const extraDays = Math.max(0, Math.min(rentalDays, trialRule.maxDays) - trialRule.minDays);
  // 是否显示边界提示
  const showBoundaryHint = rentalDays < trialRule.minDays || rentalDays > trialRule.maxDays;

  const pricingTypeConfig = PRICING_TYPE_CONFIG[trialResult.pricingType];

  return (
    <div className="space-y-6 relative">
      {/* 页面标题区 */}
      <div>
        <h2 className="text-2xl font-serif-semibold text-ink-700">计费规则</h2>
        <p className="text-sm text-ink-400 mt-1">配置租赁计费参数，并实时试算应收金额</p>
      </div>

      {/* 保存成功 Toast */}
      {showSaveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <Badge
            variant="success"
            className="px-5 py-2.5 text-sm shadow-cardHover bg-green-600 text-white border-green-500"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            保存成功
          </Badge>
        </div>
      )}

      {/* 两列布局：左规则配置 / 右实时试算 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========== 左列：规则配置表单 ========== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-brand-500" />
              规则配置
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* 起步价区块 */}
              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    起
                  </span>
                  <h4 className="font-serif font-semibold text-ink-800">起步价规则</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1.5">
                      起步天数 <span className="text-ink-400">(天)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      {...register('minDays')}
                      className={cn(
                        'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors',
                        'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                        errors.minDays
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    />
                    {errors.minDays && (
                      <p className="mt-1 text-xs text-red-500">{errors.minDays.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1.5">
                      起步金额 <span className="text-ink-400">(元)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      {...register('minPrice')}
                      className={cn(
                        'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors font-mono',
                        'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                        errors.minPrice
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    />
                    {errors.minPrice && (
                      <p className="mt-1 text-xs text-red-500">{errors.minPrice.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 封顶价区块 */}
              <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
                    封
                  </span>
                  <h4 className="font-serif font-semibold text-ink-800">封顶价规则</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1.5">
                      封顶天数 <span className="text-ink-400">(天)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      {...register('maxDays')}
                      className={cn(
                        'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors',
                        'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                        errors.maxDays
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    />
                    {errors.maxDays && (
                      <p className="mt-1 text-xs text-red-500">{errors.maxDays.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1.5">
                      封顶金额 <span className="text-ink-400">(元)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      {...register('maxPrice')}
                      className={cn(
                        'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors font-mono',
                        'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                        errors.maxPrice
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    />
                    {errors.maxPrice && (
                      <p className="mt-1 text-xs text-red-500">{errors.maxPrice.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 单价区块 */}
              <div className="p-4 rounded-lg bg-brand-50/50 border border-brand-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold">
                    价
                  </span>
                  <h4 className="font-serif font-semibold text-ink-800">超出起步价后单价</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-600 mb-1.5">
                    超出起步后单价 <span className="text-ink-400">(元 / 仓 / 天)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register('unitPricePerDay')}
                    className={cn(
                      'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors font-mono',
                      'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                      errors.unitPricePerDay
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  />
                  {errors.unitPricePerDay && (
                    <p className="mt-1 text-xs text-red-500">{errors.unitPricePerDay.message}</p>
                  )}
                </div>
              </div>

              {/* 欠费门禁冻结阈值 */}
              <div className="p-4 rounded-lg bg-red-50/40 border border-red-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                    冻
                  </span>
                  <h4 className="font-serif font-semibold text-ink-800">欠费门禁冻结阈值</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-600 mb-1.5">
                    欠费冻结阈值 <span className="text-ink-400">(元) - 账单金额超过时冻结门禁</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register('overdueFreezeThreshold')}
                    className={cn(
                      'w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors font-mono',
                      'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
                      errors.overdueFreezeThreshold
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  />
                  {errors.overdueFreezeThreshold && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.overdueFreezeThreshold.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                className="w-full"
              >
                <Save className="w-4 h-4" />
                保存计费规则
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* ========== 右列：实时试算工具 ========== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-500" />
              计费试算
            </CardTitle>
            <p className="text-sm text-ink-400">输入租期与仓位，实时计算应收</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 租期天数：滑块 + 数字输入联动 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-ink-600">租期天数</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRentalDays((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={rentalDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) setRentalDays(Math.max(1, Math.min(90, v)));
                    }}
                    className="w-20 h-8 text-center text-sm font-mono font-semibold rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => setRentalDays((d) => Math.min(90, d + 1))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-ink-400 ml-1">天</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={90}
                step={1}
                value={rentalDays}
                onChange={(e) => setRentalDays(parseInt(e.target.value))}
                className="w-full h-2 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
              <div className="flex justify-between text-xs text-ink-400 mt-1">
                <span>1 天</span>
                <span>30 天</span>
                <span>60 天</span>
                <span>90 天</span>
              </div>
            </div>

            {/* 租用仓位：数字步进器 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-ink-600">租用仓位</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRentalUnits((u) => Math.max(1, u - 1))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={rentalUnits}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) setRentalUnits(Math.max(1, Math.min(20, v)));
                    }}
                    className="w-20 h-8 text-center text-sm font-mono font-semibold rounded-md border border-ink-200 bg-white outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => setRentalUnits((u) => Math.min(20, u + 1))}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-ink-400 ml-1">仓</span>
                </div>
              </div>
            </div>

            {/* 边界提示条 */}
            {showBoundaryHint && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-lg text-sm',
                  rentalDays < trialRule.minDays
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200',
                )}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  {rentalDays < trialRule.minDays ? (
                    <>
                      当前租期 <strong className="font-mono">{rentalDays}</strong> 天少于起步天数{' '}
                      <strong className="font-mono">{trialRule.minDays}</strong> 天，
                      <br />
                      将按<strong>起步价 {roundMoney(trialRule.minPrice)} 元/仓</strong>计费。
                    </>
                  ) : (
                    <>
                      当前租期 <strong className="font-mono">{rentalDays}</strong> 天超过封顶天数{' '}
                      <strong className="font-mono">{trialRule.maxDays}</strong> 天，
                      <br />
                      将按<strong>封顶价 {roundMoney(trialRule.maxPrice)} 元/仓</strong>计费。
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 计算结果展示 */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-brand-50/80 to-white border border-brand-100">
              {/* 大号金额 */}
              <div
                key={amountFlashKey}
                className={cn(
                  'flex items-baseline justify-center py-4 rounded-lg mb-3',
                  'animate-flash',
                )}
              >
                <span className="text-lg text-brand-600 font-serif mr-1">¥</span>
                <span className="font-serif font-bold text-5xl text-brand-700 font-mono tabular-nums">
                  {roundMoney(trialResult.subtotal).toFixed(2)}
                </span>
              </div>

              {/* 计费类型标签 */}
              <div className="flex justify-center mb-5">
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-md border text-sm font-medium',
                    pricingTypeConfig.className,
                    pricingTypeConfig.blinkClass,
                  )}
                >
                  {pricingTypeConfig.label}
                </span>
              </div>

              {/* 明细行 */}
              <div className="space-y-2 text-sm">
                {trialResult.pricingType === 'normal' && (
                  <>
                    <div className="flex justify-between text-ink-600">
                      <span>起步天数计算</span>
                      <span className="font-mono">
                        {trialRule.minDays} 天 × {roundMoney(trialRule.minPrice)} 元/仓
                      </span>
                    </div>
                    <div className="flex justify-between text-ink-600">
                      <span>超出部分计算</span>
                      <span className="font-mono">
                        {extraDays} 天 × {roundMoney(trialRule.unitPricePerDay)} 元/天/仓 × {rentalUnits} 仓
                      </span>
                    </div>
                  </>
                )}
                {trialResult.pricingType === 'min' && (
                  <div className="flex justify-between text-ink-600">
                    <span>起步价计算</span>
                    <span className="font-mono">
                      {rentalUnits} 仓 × {roundMoney(trialRule.minPrice)} 元/仓
                    </span>
                  </div>
                )}
                {trialResult.pricingType === 'max' && (
                  <div className="flex justify-between text-ink-600">
                    <span>封顶价计算</span>
                    <span className="font-mono">
                      {rentalUnits} 仓 × {roundMoney(trialRule.maxPrice)} 元/仓
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-ink-600">
                  <span>单仓单价</span>
                  <span className="font-mono">¥{roundMoney(trialResult.unitPrice).toFixed(2)} / 仓</span>
                </div>
                <div className="border-t border-brand-100 my-2" />
                <div className="flex justify-between font-semibold text-ink-800">
                  <span>合计明细</span>
                  <span className="font-mono text-brand-700">
                    {rentalUnits} 仓 × ¥{roundMoney(trialResult.unitPrice).toFixed(2)} ={' '}
                    <strong>¥{roundMoney(trialResult.subtotal).toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
