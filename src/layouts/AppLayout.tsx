import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAppInit } from "@/hooks/useAppInit";
import { cn } from "@/lib/utils";

// 加载遮罩组件：显示品牌 logo + loading 文案
function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-gradient">
      {/* 内层背景纹理 */}
      <div className="absolute inset-0 bg-grain opacity-20" />

      {/* 加载内容容器 */}
      <div className="relative flex flex-col items-center gap-6">
        {/* 品牌图标：🏠 + 金色圆形背景（带脉冲发光动画） */}
        <div className="relative">
          {/* 外层发光圈 */}
          <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-pulse-glow blur-xl" />
          {/* 图标本体 */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-amber-400 shadow-xl">
            <span className="text-4xl">🏠</span>
          </div>
        </div>

        {/* 品牌名称 */}
        <h1 className="font-serif-semibold text-2xl text-white tracking-wide">
          迷你仓运营中心
        </h1>

        {/* Loading 文案 + 跳动小圆点 */}
        <div className="flex items-center gap-2 text-ink-200">
          <span className="text-sm tracking-widest">正在初始化</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
          </span>
        </div>
      </div>
    </div>
  );
}

// 应用整体布局组件
export default function AppLayout() {
  // 执行应用初始化逻辑，获取加载状态
  const { loading } = useAppInit();

  // 初始化中显示加载遮罩
  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div
      className={cn(
        // 基础布局：最小屏幕高度
        "min-h-screen",
        // 背景色 + 纹理
        "bg-ink-50",
        "relative"
      )}
    >
      {/* 背景纹理层（opacity-40） */}
      <div className="pointer-events-none fixed inset-0 bg-grain opacity-40" />

      {/* 左侧导航栏 */}
      <Sidebar />

      {/* 主内容区：右侧偏移（桌面端为侧边栏宽度 240px） */}
      <div className="md:pl-60 min-h-screen relative z-10">
        {/* 顶部栏 */}
        <Header />

        {/* 页面内容区：padding 24px */}
        <main className="p-6">
          {/* 子路由内容 */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
