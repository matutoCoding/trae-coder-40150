import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal 通用对话框组件属性
 */
export interface ModalProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 对话框标题 */
  title?: React.ReactNode;
  /** 对话框主体内容 */
  children?: React.ReactNode;
  /** 对话框底部操作区（如按钮组） */
  footer?: React.ReactNode;
  /** 对话框最大宽度，支持 tailwind 预设值或自定义 */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full" | string;
  /** 点击遮罩是否关闭，默认 true */
  closeOnMaskClick?: boolean;
  /** 外层容器类名 */
  className?: string;
}

/**
 * 最大宽度预设映射
 */
const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  full: "max-w-full",
};

/**
 * 通用对话框组件
 * 特点：
 * - 背景遮罩 bg-ink-900/50 + backdrop-blur-sm
 * - 面板 rounded-lg + shadow-cardHover
 * - 进场动画 animate-slide-up
 * - 支持 ESC 键关闭
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "md",
  closeOnMaskClick = true,
  className,
}: ModalProps) {
  /** ESC 键关闭 */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    /** 禁止背景滚动 */
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  /** 解析最大宽度：预设值 or 自定义字符串 */
  const widthClass =
    maxWidthClasses[maxWidth] ??
    (maxWidth.startsWith("max-w-") ? maxWidth : undefined);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in"
        onClick={() => closeOnMaskClick && onClose()}
      />

      {/* 对话框面板 */}
      <div
        className={cn(
          "relative w-full bg-white rounded-lg shadow-cardHover",
          "flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden",
          "animate-slide-up",
          widthClass,
        )}
      >
        {/* 头部：标题 + 关闭按钮 */}
        {(title || true) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-ink-100 shrink-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="font-serif font-semibold text-lg text-ink-800 leading-tight pr-4">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 -m-1.5 rounded-md text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* 主体内容区：可滚动 */}
        {children && (
          <div className="flex-1 overflow-y-auto px-6 py-5 text-ink-700 text-sm leading-relaxed">
            {children}
          </div>
        )}

        {/* 底部操作区 */}
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-ink-100 bg-ink-50/50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
