import React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";

/**
 * 空状态操作按钮配置
 */
export interface EmptyStateAction {
  /** 按钮文案 */
  label: string;
  /** 点击回调 */
  onClick: () => void;
  /** 按钮变体 */
  variant?: ButtonProps["variant"];
  /** 按钮尺寸 */
  size?: ButtonProps["size"];
  /** 禁用状态 */
  disabled?: boolean;
}

/**
 * EmptyState 空状态组件属性
 */
export interface EmptyStateProps {
  /** 自定义图标（Lucide 图标组件），默认 Inbox */
  icon?: LucideIcon;
  /** 主文案（标题） */
  title: React.ReactNode;
  /** 副文案（描述） */
  description?: React.ReactNode;
  /** 单个操作按钮（简单场景） */
  action?: EmptyStateAction;
  /** 多个操作按钮（复杂场景，优先级高于 action） */
  actions?: EmptyStateAction[];
  /** 尺寸规格 */
  size?: "sm" | "md" | "lg";
  /** 外层容器类名 */
  className?: string;
  /** 图标包装区类名 */
  iconClassName?: string;
}

/**
 * 尺寸样式映射
 */
const sizeClasses = {
  sm: {
    wrapper: "py-8",
    iconWrapper: "p-3",
    icon: "h-8 w-8",
    title: "text-base",
    desc: "text-xs",
  },
  md: {
    wrapper: "py-12",
    iconWrapper: "p-4",
    icon: "h-10 w-10",
    title: "text-lg",
    desc: "text-sm",
  },
  lg: {
    wrapper: "py-20",
    iconWrapper: "p-5",
    icon: "h-14 w-14",
    title: "text-xl",
    desc: "text-sm",
  },
};

/**
 * 空状态组件
 * 特点：
 * - 图标 + 主文案 + 副文案 + 可选操作按钮的标准布局
 * - 支持 sm/md/lg 三种规格
 * - 支持单个或多个操作按钮
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actions,
  size = "md",
  className,
  iconClassName,
}: EmptyStateProps) {
  const styles = sizeClasses[size];

  /** 合并操作按钮：actions 优先级高于 action */
  const mergedActions: EmptyStateAction[] = actions
    ? actions
    : action
      ? [action]
      : [];

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center text-center px-4",
        styles.wrapper,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/* 图标区域 */}
      <div
        className={cn(
          "rounded-full bg-ink-50 mb-4",
          styles.iconWrapper,
          iconClassName,
        )}
      >
        <Icon className={cn("text-ink-300", styles.icon)} />
      </div>

      {/* 主文案 */}
      <div
        className={cn(
          "font-medium text-ink-600 font-serif-semibold",
          styles.title,
        )}
      >
        {title}
      </div>

      {/* 副文案 */}
      {description && (
        <div
          className={cn(
            "text-ink-400 mt-1.5 max-w-md leading-relaxed",
            styles.desc,
          )}
        >
          {description}
        </div>
      )}

      {/* 操作按钮区 */}
      {mergedActions.length > 0 && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {mergedActions.map((act, idx) => (
            <Button
              key={idx}
              variant={act.variant ?? "primary"}
              size={act.size ?? "md"}
              onClick={act.onClick}
              disabled={act.disabled}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
