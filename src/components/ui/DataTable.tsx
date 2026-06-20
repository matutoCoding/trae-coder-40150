import React from "react";
import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 表格列定义
 */
export interface DataTableColumn<T = any> {
  /** 列唯一标识 */
  key: string;
  /** 列标题 */
  title: React.ReactNode;
  /** 自定义渲染函数，返回 React 节点 */
  render?: (row: T, index: number) => React.ReactNode;
  /** 列宽（CSS width 值，如 '120px'、'20%'） */
  width?: string | number;
  /** 文本对齐方式 */
  align?: "left" | "center" | "right";
}

/**
 * DataTable 通用表格组件属性
 */
export interface DataTableProps<T = any> {
  /** 列配置数组 */
  columns: DataTableColumn<T>[];
  /** 表格数据源 */
  data: T[];
  /** 行唯一键，可以是字符串（取对象属性）或函数 */
  rowKey: keyof T | ((row: T) => string | number);
  /** 空状态文案 */
  emptyText?: string;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 行点击事件回调 */
  onRowClick?: (row: T, index: number) => void;
  /** 外层容器类名 */
  className?: string;
  /** 表格元素类名 */
  tableClassName?: string;
}

/**
 * 获取行的唯一 key 值
 */
function getRowKey<T>(
  row: T,
  rowKey: DataTableProps<T>["rowKey"],
  index: number,
): string | number {
  if (typeof rowKey === "function") {
    return rowKey(row);
  }
  const val = row[rowKey];
  return val !== undefined && val !== null ? String(val) : index;
}

/**
 * 通用表格组件
 * 特点：
 * - thead 使用 brand-50 背景 + brand-700 文字 + font-serif-semibold
 * - tbody 斑马纹（偶数行背景）+ 行 hover 高亮 amber-50/50
 * - 集成空状态和加载状态
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  emptyText = "暂无数据",
  loading = false,
  onRowClick,
  className,
  tableClassName,
}: DataTableProps<T>) {
  /** 对齐方式样式映射 */
  const alignClasses: Record<NonNullable<DataTableColumn["align"]>, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  /** 是否显示空状态 */
  const showEmpty = !loading && data.length === 0;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-ink-100 bg-white",
        className,
      )}
    >
      <div className="w-full overflow-x-auto">
        <table className={cn("w-full border-collapse", tableClassName)}>
          {/* 表头 */}
          <thead>
            <tr className="bg-brand-50 text-brand-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "px-4 py-3 font-serif font-semibold text-sm",
                    "whitespace-nowrap border-b border-brand-100",
                    alignClasses[col.align ?? "left"],
                  )}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>

          {/* 表体 */}
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-ink-400">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    <span className="text-sm">加载中...</span>
                  </div>
                </td>
              </tr>
            )}

            {showEmpty && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-full bg-ink-50">
                      <Inbox className="h-10 w-10 text-ink-300" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-ink-600 font-medium">
                        {emptyText}
                      </span>
                      <span className="text-ink-400 text-xs">
                        暂无匹配的记录
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              data.map((row, rowIndex) => (
                <tr
                  key={getRowKey(row, rowKey, rowIndex)}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  className={cn(
                    "transition-colors duration-150",
                    rowIndex % 2 === 1 ? "bg-ink-50/50" : "bg-white",
                    "hover:bg-amber-50/50",
                    onRowClick && "cursor-pointer",
                    "border-b border-ink-100 last:border-b-0",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn(
                        "px-4 py-3 text-sm text-ink-700",
                        "whitespace-nowrap",
                        alignClasses[col.align ?? "left"],
                      )}
                    >
                      {col.render
                        ? col.render(row, rowIndex)
                        : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
