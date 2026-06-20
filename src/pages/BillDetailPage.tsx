import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, FileSpreadsheet, User, Phone, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { BillStatusBadge } from '@/components/shared/BillStatusBadge';
import { TierBadge } from '@/components/shared/TierBadge';
import { TenantAvatar } from '@/components/shared/TenantAvatar';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import type { Bill, BillItem, PricingType } from '@/types';

// ========== 数字转中文大写金额函数 ==========

// 中文数字字符
const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
// 整数部分单位
const CN_INT_UNITS = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿', '拾', '佰', '仟'];
// 小数部分单位
const CN_DEC_UNITS = ['角', '分'];

/**
 * 将数字金额转换为中文大写金额格式
 * 支持最大 9999 亿，精确到分
 * 示例：1234.56 → 壹仟贰佰叁拾肆元伍角陆分
 *       100.00 → 壹佰元整
 *       0.80 → 捌角
 */
function toChineseAmount(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '无效金额';
  if (amount === 0) return '零元整';
  if (amount < 0) return '负' + toChineseAmount(Math.abs(amount));

  // 四舍五入保留两位小数
  const rounded = Math.round(amount * 100) / 100;

  // 拆分为整数和小数部分
  const intPart = Math.floor(rounded);
  const decPart = Math.round((rounded - intPart) * 100);

  let result = '';

  // ===== 整数部分 =====
  if (intPart > 0) {
    const intStr = intPart.toString();
    const len = intStr.length;
    let zeroFlag = false; // 标记是否有连续的零

    for (let i = 0; i < len; i++) {
      const digit = parseInt(intStr[i]);
      const unitIndex = len - 1 - i;

      if (digit === 0) {
        zeroFlag = true;
        // 特殊单位（万/亿）即使是零也要输出单位
        if (unitIndex === 4 || unitIndex === 8) {
          // 检查万位或亿位前面是否都是零
          const sectionStr = intStr.substring(
            Math.max(0, i - (unitIndex % 4)),
            i + 1,
          );
          if (!/^0+$/.test(sectionStr)) {
            result += CN_INT_UNITS[unitIndex];
          }
          zeroFlag = false;
        }
      } else {
        // 如果前面有零，先补一个"零"
        if (zeroFlag) {
          result += '零';
          zeroFlag = false;
        }
        result += CN_DIGITS[digit] + CN_INT_UNITS[unitIndex];
      }
    }

    result += '元';
  }

  // ===== 小数部分 =====
  if (decPart === 0) {
    result += '整';
  } else {
    const jiao = Math.floor(decPart / 10); // 角
    const fen = decPart % 10; // 分

    if (jiao > 0) {
      result += CN_DIGITS[jiao] + CN_DEC_UNITS[0];
    } else if (intPart > 0) {
      // 有整数部分且角为零，补"零"
      result += '零';
    }

    if (fen > 0) {
      result += CN_DIGITS[fen] + CN_DEC_UNITS[1];
    }
  }

  return result;
}

// 计费类型彩色标签样式
const PRICING_TYPE_STYLE: Record<PricingType, { label: string; className: string }> = {
  min: {
    label: '起步价',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  normal: {
    label: '正常计费',
    className: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  max: {
    label: '封顶价',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
};

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { bills, tenants } = useAppStore();

  // 根据 ID 查找账单
  const bill = useMemo<Bill | undefined>(
    () => bills.find((b) => b.id === id),
    [bills, id],
  );

  // 关联租户信息
  const tenant = useMemo(
    () => (bill ? tenants.find((t) => t.id === bill.tenantId) : undefined),
    [tenants, bill],
  );

  // 计算账单明细的合计
  const itemsTotal = useMemo(
    () => (bill ? bill.items.reduce((sum, item) => sum + item.subtotal, 0) : 0),
    [bill],
  );

  // 打印
  const handlePrint = () => {
    window.print();
  };

  // 导出 Excel
  const handleExportExcel = () => {
    if (!bill || !tenant) return;

    // 构建导出数据
    const headerData = [
      { 项目: '公司抬头', 内容: '迷你仓运营中心' },
      { 项目: '账单编号', 内容: bill.billNo },
      { 项目: '开票日期', 内容: formatDate(bill.issuedAt) },
      { 项目: '账期', 内容: `${bill.periodStart} ~ ${bill.periodEnd}` },
      { 项目: '租户姓名', 内容: tenant.name },
      { 项目: '联系电话', 内容: tenant.phone },
      {},
      { 项目: '序号', 内容: '仓库编号' },
    ];

    const detailData = bill.items.map((item: BillItem, idx: number) => ({
      序号: idx + 1,
      仓库编号: item.unitCode,
      起租日期: bill.periodStart,
      结束日期: bill.periodEnd,
      租期_天: item.days,
      计费类型: PRICING_TYPE_STYLE[item.pricingType].label,
      单价_元: item.unitPrice.toFixed(2),
      小计_元: item.subtotal.toFixed(2),
    }));

    const summaryData = [
      {},
      { 项目: '', 内容: '' },
      { 项目: '合计金额', 内容: `¥${bill.totalAmount.toFixed(2)}` },
      { 项目: '大写金额', 内容: toChineseAmount(bill.totalAmount) },
    ];

    const exportData = [...headerData, ...detailData, ...summaryData];

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `账单_${bill.billNo}`);
    const fileName = `账单_${bill.billNo}_${formatDate(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 账单不存在时显示
  if (!bill) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-serif-semibold text-ink-700">账单详情</h2>
          <p className="text-sm text-ink-400 mt-1">查看账单的详细信息</p>
        </div>
        <div className="panel-card p-16 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl text-ink-300">📄</div>
          <div className="text-ink-500">账单不存在或已被删除</div>
          <Link to="/bills">
            <Button variant="primary" size="md">
              <ArrowLeft className="w-4 h-4" />
              返回账单列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========== 页面头部工具条 ========== */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <Link
            to="/bills"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回账单列表
          </Link>
          <h2 className="text-2xl font-serif-semibold text-ink-700">账单详情</h2>
          <p className="text-sm text-ink-400 mt-1">查看账单 {bill.billNo} 的详细信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4" />
            导出Excel
          </Button>
          <Button variant="primary" size="md" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            打印发票
          </Button>
        </div>
      </div>

      {/* ========== 发票主体：仿纸质发票样式 ========== */}
      <div className="flex justify-center">
        <div
          className={cn(
            // A4 比例（约 1:1.414）
            'w-full max-w-[210mm] bg-white border border-ink-200 shadow-card',
            'print:shadow-none print:border-0 print:max-w-none',
          )}
          style={{ aspectRatio: '1 / 1.414' }}
        >
          <div className="p-10 h-full flex flex-col">
            {/* ===== 顶部：公司抬头 + 税务章 ===== */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-double border-ink-300">
              <div className="flex flex-col">
                <h1 className="font-serif font-bold text-3xl text-ink-800 tracking-widest">
                  迷你仓运营中心
                </h1>
                <div className="text-xs text-ink-400 mt-2 space-y-0.5">
                  <div>地址：上海市浦东新区张江高科技园区</div>
                  <div>电话：021-8888-6666 | 税号：91310000MA1FL000XX</div>
                </div>
              </div>
              {/* 税务章样式：BillStatusBadge + seal 模式 */}
              <div className="shrink-0 mt-2">
                <BillStatusBadge status={bill.status} className="text-lg px-4 py-2" />
              </div>
            </div>

            {/* ===== 信息栏：左右分栏 ===== */}
            <div className="grid grid-cols-2 gap-8 py-6 border-b border-dashed border-ink-200">
              {/* 左：账单信息 */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-ink-400 text-xs">账单编号</div>
                    <div className="font-mono font-semibold text-ink-800">
                      {bill.billNo}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-ink-400 text-xs">开票日期</div>
                    <div className="font-mono text-ink-800">{formatDate(bill.issuedAt)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-ink-400 text-xs">账期</div>
                    <div className="font-mono text-ink-800">
                      {bill.periodStart} ~ {bill.periodEnd}
                    </div>
                  </div>
                </div>
              </div>

              {/* 右：租户信息 */}
              <div className="space-y-3 text-sm">
                {tenant && (
                  <>
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                      <div className="flex items-center gap-2">
                        <TenantAvatar name={tenant.name} size="sm" />
                        <div>
                          <div className="text-ink-400 text-xs">租户姓名</div>
                          <div className="font-semibold text-ink-800">{tenant.name}</div>
                        </div>
                        <TierBadge tierId={tenant.tierId} size="sm" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-ink-400 text-xs">联系电话</div>
                        <div className="font-mono text-ink-800">{tenant.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-ink-400 text-xs">租户等级</div>
                        <TierBadge tierId={tenant.tierId} size="md" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ===== 明细表格 ===== */}
            <div className="flex-1 py-6 overflow-hidden">
              <div className="w-full border-collapse border border-ink-200 rounded-sm overflow-hidden">
                {/* 表头 */}
                <div className="flex bg-brand-50 text-brand-700">
                  {[
                    { key: 'idx', label: '序号', width: '6%', align: 'center' },
                    { key: 'code', label: '仓库编号', width: '12%', align: 'center' },
                    { key: 'start', label: '起租日期', width: '14%', align: 'center' },
                    { key: 'end', label: '结束日期', width: '14%', align: 'center' },
                    { key: 'days', label: '租期(天)', width: '10%', align: 'right' },
                    { key: 'type', label: '计费类型', width: '12%', align: 'center' },
                    { key: 'price', label: '单价(元)', width: '12%', align: 'right' },
                    { key: 'sub', label: '小计(元)', width: '12%', align: 'right' },
                  ].map((col) => (
                    <div
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn(
                        'py-2.5 px-2 text-xs font-serif font-semibold border-b border-r border-brand-100 last:border-r-0',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* 表体：明细行 */}
                {bill.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex text-sm',
                      idx % 2 === 1 ? 'bg-ink-50/40' : 'bg-white',
                    )}
                  >
                    <div
                      style={{ width: '6%' }}
                      className="py-2.5 px-2 text-center text-ink-600 border-b border-r border-ink-100 last:border-r-0"
                    >
                      {idx + 1}
                    </div>
                    <div
                      style={{ width: '12%' }}
                      className="py-2.5 px-2 text-center font-mono text-brand-600 font-medium border-b border-r border-ink-100 last:border-r-0"
                    >
                      {item.unitCode}
                    </div>
                    <div
                      style={{ width: '14%' }}
                      className="py-2.5 px-2 text-center text-ink-600 font-mono text-xs border-b border-r border-ink-100 last:border-r-0"
                    >
                      {bill.periodStart}
                    </div>
                    <div
                      style={{ width: '14%' }}
                      className="py-2.5 px-2 text-center text-ink-600 font-mono text-xs border-b border-r border-ink-100 last:border-r-0"
                    >
                      {bill.periodEnd}
                    </div>
                    <div
                      style={{ width: '10%' }}
                      className="py-2.5 px-2 text-right font-mono text-ink-700 border-b border-r border-ink-100 last:border-r-0"
                    >
                      {item.days}
                    </div>
                    <div
                      style={{ width: '12%' }}
                      className="py-2.5 px-2 flex items-center justify-center border-b border-r border-ink-100 last:border-r-0"
                    >
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                          PRICING_TYPE_STYLE[item.pricingType].className,
                        )}
                      >
                        {PRICING_TYPE_STYLE[item.pricingType].label}
                      </span>
                    </div>
                    <div
                      style={{ width: '12%' }}
                      className="py-2.5 px-2 text-right font-mono text-ink-700 border-b border-r border-ink-100 last:border-r-0"
                    >
                      {item.unitPrice.toFixed(2)}
                    </div>
                    <div
                      style={{ width: '12%' }}
                      className="py-2.5 px-2 text-right font-mono font-semibold text-ink-800 border-b border-ink-100"
                    >
                      {item.subtotal.toFixed(2)}
                    </div>
                  </div>
                ))}

                {/* 合计行 */}
                <div className="flex bg-brand-50 border-t-2 border-brand-200">
                  <div
                    style={{ width: '6%' }}
                    className="py-3 px-2 text-center font-serif font-bold text-brand-800 border-r border-brand-100 last:border-r-0"
                  >
                    -
                  </div>
                  <div
                    style={{ width: '64%' }}
                    className="py-3 px-4 text-right font-serif font-bold text-brand-800 border-r border-brand-100 last:border-r-0"
                  >
                    合 计 （共 {bill.items.length} 项）
                  </div>
                  <div
                    style={{ width: '12%' }}
                    className="py-3 px-2 text-right font-mono font-bold text-brand-800 border-r border-brand-100 last:border-r-0"
                  >
                    -
                  </div>
                  <div
                    style={{ width: '12%' }}
                    className="py-3 px-2 text-right font-mono font-bold text-lg text-brand-800"
                  >
                    ¥{itemsTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== 底部：大写金额 + 备注 + 签章区 ===== */}
            <div className="pt-4 border-t-2 border-double border-ink-300 space-y-6">
              {/* 大写金额 */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-sm">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 text-xs text-amber-700 font-medium pt-0.5">
                    大写金额：
                  </div>
                  <div className="flex-1 font-serif font-bold text-amber-800 text-base tracking-wide">
                    {toChineseAmount(bill.totalAmount)}
                  </div>
                  <div className="shrink-0 font-mono font-bold text-brand-700 text-xl">
                    ¥{bill.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 备注栏 */}
              <div>
                <div className="text-xs text-ink-400 mb-1 font-medium">备注</div>
                <div className="min-h-[48px] p-3 border border-dashed border-ink-200 rounded-sm text-sm text-ink-500">
                  {bill.items.length > 0 ? (
                    <div>
                      本次账单包含 {bill.items.length} 个仓位租赁费用。
                      {bill.status === 'paid' && bill.paidAt && (
                        <> 已于 {formatDate(bill.paidAt)} 完成支付。</>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink-300">暂无备注信息</span>
                  )}
                </div>
              </div>

              {/* 签章区 */}
              <div className="grid grid-cols-4 gap-4 pt-4 text-sm">
                <div className="flex flex-col items-center">
                  <div className="text-xs text-ink-400 mb-1">制单人</div>
                  <div className="w-full h-14 border-b border-ink-300 flex items-end justify-center pb-1 font-serif text-ink-600">
                    管理员
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs text-ink-400 mb-1">审核人</div>
                  <div className="w-full h-14 border-b border-ink-300 flex items-end justify-center pb-1 font-serif text-ink-600">
                    —
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs text-ink-400 mb-1">收款日期</div>
                  <div className="w-full h-14 border-b border-ink-300 flex items-end justify-center pb-1 font-mono text-ink-600">
                    {bill.status === 'paid' && bill.paidAt ? formatDate(bill.paidAt) : '—'}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs text-ink-400 mb-1">收款章</div>
                  <div className="w-full h-14 flex items-center justify-center">
                    {bill.status === 'paid' && (
                      <div className="w-12 h-12 rounded-full border-2 border-red-500 flex items-center justify-center text-red-600 text-xs font-bold rotate-[-12deg] opacity-80">
                        已收讫
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 打印样式 ========== */}
      <style>{`
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
