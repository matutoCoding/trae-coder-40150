import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Card 卡片容器属性
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card 卡片根容器
 * 提供基础的卡片外观：圆角、阴影、背景、边框
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl bg-white border border-ink-100 shadow-card",
        "overflow-hidden transition-shadow duration-200",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

/**
 * CardHeader 卡片头部属性
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card 卡片头部区域
 * 通常放置标题、描述、操作按钮等
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-5 pb-0 flex flex-col gap-1.5", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

/**
 * CardTitle 卡片标题属性
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Card 卡片标题
 * 使用 font-serif-semibold 字体，适配文档型系统的视觉风格
 */
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "font-serif font-semibold text-lg text-ink-800 leading-tight",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

/**
 * CardContent 卡片内容区域属性
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card 卡片内容主体
 * 默认上下内边距，与 Header/Footer 衔接自然
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

/**
 * CardFooter 卡片底部属性
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card 卡片底部区域
 * 通常放置操作按钮、分页、提示信息等
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-5 pt-0 flex items-center gap-3",
        "border-t border-transparent",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";
