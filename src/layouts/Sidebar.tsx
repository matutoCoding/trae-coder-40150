import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BadgeCheck,
  ListPlus,
  Calculator,
  Receipt,
  KeyRound,
  ScrollText,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

// 导航项配置：路径、名称、图标组件
const navItems = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard },
  { path: "/tenants", label: "租户管理", icon: Users },
  { path: "/tiers", label: "等级配置", icon: BadgeCheck },
  { path: "/quota", label: "额度台账", icon: ListPlus },
  { path: "/pricing", label: "计费规则", icon: Calculator },
  { path: "/bills", label: "账单管理", icon: Receipt },
  { path: "/access", label: "门禁授权", icon: KeyRound },
  { path: "/audit", label: "变更审计", icon: ScrollText },
];

// 侧边栏组件
export default function Sidebar() {
  // 从 store 读取会话状态
  const operatorName = useAppStore((s) => s.session.operatorName);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const location = useLocation();

  // 从管理员名称提取首字母作为头像
  const adminInitial = operatorName.charAt(0).toUpperCase();

  return (
    <>
      {/* 移动端遮罩层：点击可关闭侧边栏 */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* 侧边栏主体 */}
      <aside
        className={cn(
          // 基础样式：深色背景 + 右侧分隔线
          "fixed left-0 top-0 z-50 flex h-full w-60 flex-col",
          "bg-ink-800 text-ink-100 border-r border-ink-700/60",
          "transition-transform duration-300 ease-in-out",
          // 桌面端：始终显示
          "md:translate-x-0",
          // 移动端：根据状态控制显示/隐藏
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* 顶部品牌区 */}
        <div className="relative flex flex-col items-center justify-center px-6 py-6 border-b border-ink-700/60">
          {/* 移动端关闭按钮 */}
          <button
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1.5 text-ink-300 hover:bg-ink-700 hover:text-white md:hidden"
          >
            <X size={18} />
          </button>

          {/* 品牌图标：🏠 + 金色圆形背景 */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-400 mb-3 shadow-glow">
            <span className="text-2xl">🏠</span>
          </div>

          {/* 品牌名称 */}
          <h1 className="font-serif-semibold text-lg text-white tracking-wide">
            迷你仓运营中心
          </h1>
          {/* 副文案 */}
          <p className="text-xs text-ink-400 mt-1 tracking-widest uppercase">
            Mini Storage Admin
          </p>
        </div>

        {/* 导航列表 */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            // 精确匹配根路径，其他路径用 startsWith 判断
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  // 基础样式
                  "relative flex items-center gap-3 px-4 py-2.5 rounded-md mx-2 mb-1",
                  "transition-all duration-200 group",
                  // 未激活状态
                  isActive
                    ? "bg-brand-600/40 text-white"
                    : "bg-transparent text-ink-200 hover:bg-ink-700/50 hover:text-white"
                )}
              >
                {/* 激活状态左侧 3px amber-400 装饰条 */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-amber-400" />
                )}

                {/* 导航图标 */}
                <Icon
                  size={18}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-amber-300" : "text-ink-300 group-hover:text-white"
                  )}
                />

                {/* 导航文字 */}
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* 底部：版本号 + 管理员信息 */}
        <div className="border-t border-ink-700/60 px-5 py-4">
          <div className="flex items-center gap-3">
            {/* 管理员头像 */}
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-600/60 text-white text-sm font-semibold border border-brand-500/40">
              {adminInitial}
            </div>
            {/* 管理员名称 + 版本号 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {operatorName}
              </p>
              <p className="text-xs text-ink-400">v1.0.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
