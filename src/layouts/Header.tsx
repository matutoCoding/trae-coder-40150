import { Menu, Bell, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

// 路由路径 -> 面包屑名称映射表
const breadcrumbMap: Record<string, string> = {
  "/": "仪表盘",
  "/tenants": "租户管理",
  "/tiers": "等级配置",
  "/quota": "额度台账",
  "/pricing": "计费规则",
  "/bills": "账单管理",
  "/access": "门禁授权",
  "/audit": "变更审计",
};

// 根据当前路径生成面包屑数组
function generateBreadcrumbs(pathname: string): Array<{ label: string; path: string }> {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [
    { label: "首页", path: "/" },
  ];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    // 尝试在映射表中查找完整路径
    if (breadcrumbMap[currentPath]) {
      crumbs.push({ label: breadcrumbMap[currentPath], path: currentPath });
    } else {
      // 动态路径（如 :id）显示为详情
      crumbs.push({ label: "详情", path: currentPath });
    }
  }

  return crumbs;
}

// 顶部栏组件
export default function Header() {
  // 从 store 获取状态
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const operatorName = useAppStore((s) => s.session.operatorName);
  const location = useLocation();
  const breadcrumbs = generateBreadcrumbs(location.pathname);

  // 从管理员名称提取首字母作为头像
  const adminInitial = operatorName.charAt(0).toUpperCase();

  return (
    <header
      className={cn(
        // 基础样式
        "sticky top-0 z-30 flex h-16 items-center gap-4",
        "bg-white/80 backdrop-blur-md border-b border-ink-100",
        // 左右内边距
        "px-4 md:px-6"
      )}
    >
      {/* 汉堡菜单按钮：移动端打开侧边栏 */}
      <button
        onClick={() => setMobileNavOpen(true)}
        className={cn(
          "flex items-center justify-center",
          "w-10 h-10 rounded-md",
          "text-ink-500 hover:text-ink-700 hover:bg-ink-100",
          "transition-colors md:hidden"
        )}
      >
        <Menu size={20} />
      </button>

      {/* 面包屑导航 */}
      <nav className="hidden sm:flex items-center gap-2 text-sm text-ink-400">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex items-center gap-2">
            {index > 0 && <span className="text-ink-200">/</span>}
            <span
              className={cn(
                // 最后一项为当前页，样式加深
                index === breadcrumbs.length - 1
                  ? "text-ink-700 font-medium"
                  : "hover:text-ink-600 transition-colors"
              )}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* 右侧区域占位，用于把后面内容推到右边 */}
      <div className="flex-1" />

      {/* 全局搜索框 */}
      <div className="hidden lg:flex items-center relative w-72">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300"
        />
        <input
          type="text"
          placeholder="搜索租户/仓号/账单..."
          className={cn(
            "w-full h-9 pl-10 pr-4 rounded-lg",
            "bg-ink-50 border border-ink-200",
            "text-sm text-ink-700 placeholder:text-ink-300",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400",
            "transition-all"
          )}
        />
      </div>

      {/* 通知铃铛（带小红点） */}
      <button
        className={cn(
          "relative flex items-center justify-center",
          "w-10 h-10 rounded-md",
          "text-ink-500 hover:text-ink-700 hover:bg-ink-100",
          "transition-colors"
        )}
      >
        <Bell size={20} />
        {/* 未读消息小红点 */}
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-danger border-2 border-white" />
      </button>

      {/* 管理员头像（首字母） */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-9 h-9 rounded-full",
          "bg-brand-gradient text-white text-sm font-semibold",
          "shadow-sm ring-2 ring-ink-100"
        )}
      >
        {adminInitial}
      </div>
    </header>
  );
}
