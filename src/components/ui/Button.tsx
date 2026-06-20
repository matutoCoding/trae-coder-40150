import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 按钮组件属性定义
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体样式 */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  /** 按钮尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 自定义渲染元素（简化版 asChild，传字符串如 'a' 或组件） */
  as?: keyof JSX.IntrinsicElements | React.ComponentType<any>;
}

/**
 * 变体样式映射
 */
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-gradient text-white rounded-md shadow-sm hover:-translate-y-[1px] hover:shadow-cardHover active:translate-y-0",
  secondary:
    "bg-brand-50 text-brand-700 rounded-md hover:bg-brand-100 active:bg-brand-200",
  ghost:
    "bg-transparent text-ink-600 rounded-md hover:bg-ink-100 active:bg-ink-200",
  danger:
    "bg-danger text-white rounded-md shadow-sm hover:bg-red-600 active:bg-red-700",
  outline:
    "bg-white text-ink-700 rounded-md border border-ink-200 hover:border-brand-300 hover:text-brand-600 active:bg-ink-50",
};

/**
 * 尺寸样式映射
 */
const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

/**
 * 基础按钮组件
 * 支持多种变体、尺寸、加载状态、禁用状态
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      as: Component = "button",
      children,
      ...props
    },
    ref,
  ) => {
    const mergedDisabled = disabled || loading;

    const baseClasses = cn(
      "inline-flex items-center justify-center font-medium",
      "transition-all duration-200 ease-out select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
      variantClasses[variant],
      sizeClasses[size],
      className,
    );

    const content = (
      <>
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </>
    );

    /**
     * 由于未安装 @radix-ui/react-slot，使用简化的 as 属性方案
     * 当 Component 为字符串（如 'a'）时，直接使用对应元素
     */
    if (Component !== "button") {
      const { type, ...restProps } = props as any;
      return (
        <Component
          ref={ref as any}
          className={baseClasses}
          aria-disabled={mergedDisabled || undefined}
          {...restProps}
        >
          {content}
        </Component>
      );
    }

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={mergedDisabled}
        {...props}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = "Button";
