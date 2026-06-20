// 格式化日期
export function formatDate(d: string | Date, fmt: string = 'yyyy-MM-dd'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  let result = fmt;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  result = result.replace(/yyyy/g, year.toString());
  result = result.replace(/MM/g, month.toString().padStart(2, '0'));
  result = result.replace(/dd/g, day.toString().padStart(2, '0'));

  return result;
}

// 格式化日期时间
export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${formatDate(date)} ${hours}:${minutes}:${seconds}`;
}

// 计算两个日期之间的天数（含首尾）
export function daysBetween(start: string | Date, end: string | Date): number {
  const startDate = new Date(formatDate(start));
  const endDate = new Date(formatDate(end));
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

// 日期增加天数
export function addDays(date: string | Date, n: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

// 获取当月第一天
export function startOfMonth(date: string | Date = new Date()): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// 获取当月最后一天
export function endOfMonth(date: string | Date = new Date()): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// 获取近30天的日期范围 [start, end]
export function last30DaysRange(date: string | Date = new Date()): [Date, Date] {
  const end = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const start = addDays(end, -29);
  return [startOfDay(start), startOfDay(end)];
}

// 判断日期1是否在日期2之后
export function isAfter(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1).getTime() : date1.getTime();
  const d2 = typeof date2 === 'string' ? new Date(date2).getTime() : date2.getTime();
  return d1 > d2;
}

// 判断日期1是否在日期2之前
export function isBefore(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1).getTime() : date1.getTime();
  const d2 = typeof date2 === 'string' ? new Date(date2).getTime() : date2.getTime();
  return d1 < d2;
}

// 将时间归零（仅比较日期）
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
