import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Badge 徽章组件属性
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 徽章颜色变体：default 使用 brand 色系 */
  variant?: "default" | "amber" | "success" | "warning" | "danger" | "slate";
  /** 印章模式：旋转-4度 + 粗边框 + 印章动画 */
  seal?: boolean;
}

/**
 * 普通徽章变体样式映射
 */
const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-brand-50 text-brand-700 border-brand-100",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-green-50 text-success border-green-200",
  warning: "bg-orange-50 text-warning border-orange-200",
  danger: "bg-red-50 text-danger border-red-200",
  slate: "bg-ink-100 text-ink-600 border-ink-200",
};

/**
 * 印章模式变体样式映射（更强烈的对比色 + 粗边框）
 */
const sealVariantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "text-brand-600 border-brand-500",
  amber: "text-amber-600 border-amber-500",
  success: "text-success border-green-600",
  warning: "text-warning border-orange-500",
  danger: "text-danger border-red-500",
  slate: "text-ink-600 border-ink-500",
};

/**
 * 徽章组件
 * 用于展示状态、标签、分类等信息
 * 支持印章模式：适合"已通过""已归档"等文档状态展示
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", seal = false, ...props }, ref) => {
    const baseSealClasses = seal
      ? cn(
          "bg-white/80 border-2 font-serif font-bold tracking-wider",
          "px-3 py-1.5 text-sm rounded-sm",
          "-rotate-4 shadow-sm",
          "animate-stamp",
          sealVariantClasses[variant],
        )
      : cn(
          "inline-flex items-center gap-1 border",
          "px-2 py-0.5 text-xs font-medium rounded-md",
          variantClasses[variant],
        );

    return (
      <span
        ref={ref}
        className={cn(baseSealClasses, className)}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";
