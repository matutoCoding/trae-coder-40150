import React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatCard 数据概览卡组件属性
 */
export interface StatCardProps {
  /** 指标标签名称 */
  label: React.ReactNode;
  /** 指标数值 */
  value: React.ReactNode;
  /** 同比/环比变化值（正数上涨、负数下跌、0 持平） */
  delta?: number;
  /** 顶部装饰条强调色 */
  accent?: "brand" | "amber" | "success" | "danger";
  /** 左侧图标（Lucide 图标组件） */
  icon?: LucideIcon;
  /** 图标背景色与装饰条不同时使用 */
  iconAccent?: StatCardProps["accent"];
  /** 点击事件（可选，设为可点击样式） */
  onClick?: () => void;
  /** 外层容器类名 */
  className?: string;
}

/**
 * 强调色样式映射：顶部装饰条背景色
 */
const accentBarClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  brand: "bg-brand-500",
  amber: "bg-amber-400",
  success: "bg-success",
  danger: "bg-danger",
};

/**
 * 图标背景色样式映射
 */
const iconBgClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  success: "bg-green-50 text-success",
  danger: "bg-red-50 text-danger",
};

/**
 * 数据概览卡组件
 * 特点：
 * - 顶部 3px 强调色装饰条
 * - delta 使用 ↑/↓/— 图标区分涨跌
 * - 支持自定义 Lucide 图标
 */
export function StatCard({
  label,
  value,
  delta,
  accent = "brand",
  icon: Icon,
  iconAccent,
  onClick,
  className,
}: StatCardProps) {
  const actualIconAccent = iconAccent ?? accent;

  /** 计算 delta 展示：图标 + 颜色 + 文案 */
  const renderDelta = () => {
    if (delta === undefined) return null;

    if (delta > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+{delta}%</span>
        </span>
      );
    }

    if (delta < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
          <TrendingDown className="h-3.5 w-3.5" />
          <span>{delta}%</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-400">
        <Minus className="h-3.5 w-3.5" />
        <span>持平</span>
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-white rounded-xl border border-ink-100 shadow-card",
        "overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-cardHover hover:-translate-y-0.5",
        className,
      )}
    >
      {/* 顶部 3px 装饰条 */}
      <div className={cn("h-[3px] w-full", accentBarClasses[accent])} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* 左侧文字区 */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-ink-500 mb-1.5 truncate">
              {label}
            </div>
            <div className="font-serif font-bold text-2xl text-ink-800 tracking-tight leading-none">
              {value}
            </div>
            {delta !== undefined && (
              <div className="mt-2">{renderDelta()}</div>
            )}
          </div>

          {/* 右侧图标区 */}
          {Icon && (
            <div
              className={cn(
                "shrink-0 p-2.5 rounded-lg",
                iconBgClasses[actualIconAccent],
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
