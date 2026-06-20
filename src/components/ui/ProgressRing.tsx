import React from "react";
import { cn } from "@/lib/utils";

/**
 * ProgressRing 环形进度条组件属性
 */
export interface ProgressRingProps {
  /** 进度百分比，范围 0-100 */
  percent: number;
  /** 环形整体尺寸（直径，单位 px），默认 120 */
  size?: number;
  /** 圆环线条粗细（单位 px），默认 10 */
  stroke?: number;
  /** 进度条颜色（任意 CSS color 值），默认 brand-500 */
  color?: string;
  /** 背景轨道颜色，默认 ink-100 */
  trackColor?: string;
  /** 中心区域自定义内容（如文字、图标），不传则显示百分比 */
  children?: React.ReactNode;
  /** 是否显示中心百分比数字（仅 children 未传时生效），默认 true */
  showLabel?: boolean;
  /** 百分比数字样式类名 */
  labelClassName?: string;
  /** 外层容器类名 */
  className?: string;
}

/**
 * 环形进度条组件
 * 基于 SVG circle + stroke-dasharray 实现
 * 适用于额度使用率、完成率、占比等指标的可视化展示
 */
export function ProgressRing({
  percent,
  size = 120,
  stroke = 10,
  color = "#1E3A5F",
  trackColor = "#E8EDF3",
  children,
  showLabel = true,
  labelClassName,
  className,
}: ProgressRingProps) {
  /** 百分比夹取到 0-100 范围 */
  const clampedPercent = Math.max(0, Math.min(100, percent));

  /** 半径：从中心点到线条中心的距离，留出 stroke 宽度避免裁剪 */
  const radius = (size - stroke) / 2;
  /** 圆周长 */
  const circumference = 2 * Math.PI * radius;
  /** 已填充长度 */
  const dashOffset = circumference - (clampedPercent / 100) * circumference;
  /** 中心点坐标 */
  const center = size / 2;

  /** 中心内容：优先 children，其次百分比数字 */
  const renderCenter = () => {
    if (children !== undefined && children !== null) {
      return children;
    }
    if (!showLabel) return null;
    return (
      <div
        className={cn(
          "font-serif font-bold text-ink-800 leading-none",
          labelClassName,
        )}
        style={{ fontSize: size * 0.22 }}
      >
        {Math.round(clampedPercent)}
        <span className="text-ink-400 font-normal align-top" style={{ fontSize: size * 0.1 }}>
          %
        </span>
      </div>
    );
  };

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="rotate-[-90deg]"
        aria-hidden="true"
      >
        {/* 背景轨道圆 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* 进度圆：使用 round 线帽使端点圆润 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out, stroke 0.3s ease" }}
        />
      </svg>

      {/* 中心内容叠加层 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {renderCenter()}
      </div>
    </div>
  );
}
