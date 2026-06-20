import { lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import Home from "@/pages/Home";

// 统一的懒加载 fallback 组件
const LazyFallback = () => (
  <div className="p-10 text-ink-400">加载中...</div>
);

// 页面懒加载包装器：统一处理 Suspense
const withLazy = (importFn: () => Promise<{ default: React.ComponentType }>) => {
  const LazyComponent = lazy(importFn);
  return (
    <Suspense fallback={<LazyFallback />}>
      <LazyComponent />
    </Suspense>
  );
};

// 所有页面懒加载
const DashboardPage = () =>
  withLazy(() => import("@/pages/DashboardPage"));
const TenantListPage = () =>
  withLazy(() => import("@/pages/TenantListPage"));
const TenantDetailPage = () =>
  withLazy(() => import("@/pages/TenantDetailPage"));
const TierConfigPage = () =>
  withLazy(() => import("@/pages/TierConfigPage"));
const QuotaLedgerPage = () =>
  withLazy(() => import("@/pages/QuotaLedgerPage"));
const PricingRulePage = () =>
  withLazy(() => import("@/pages/PricingRulePage"));
const BillListPage = () =>
  withLazy(() => import("@/pages/BillListPage"));
const BillDetailPage = () =>
  withLazy(() => import("@/pages/BillDetailPage"));
const AccessControlPage = () =>
  withLazy(() => import("@/pages/AccessControlPage"));
const AuditLogPage = () =>
  withLazy(() => import("@/pages/AuditLogPage"));

// 404 页面：用 Home 暂时代替
const NotFoundPage = () => <Home />;

// 创建 Hash 路由
export const router = createHashRouter([
  {
    // 根路由：使用 AppLayout 作为布局
    path: "/",
    element: <AppLayout />,
    children: [
      // 仪表盘
      {
        index: true,
        element: <DashboardPage />,
      },
      // 租户管理列表
      {
        path: "tenants",
        element: <TenantListPage />,
      },
      // 租户详情
      {
        path: "tenants/:id",
        element: <TenantDetailPage />,
      },
      // 等级配置
      {
        path: "tiers",
        element: <TierConfigPage />,
      },
      // 额度台账
      {
        path: "quota",
        element: <QuotaLedgerPage />,
      },
      // 计费规则
      {
        path: "pricing",
        element: <PricingRulePage />,
      },
      // 账单管理列表
      {
        path: "bills",
        element: <BillListPage />,
      },
      // 账单详情
      {
        path: "bills/:id",
        element: <BillDetailPage />,
      },
      // 门禁授权
      {
        path: "access",
        element: <AccessControlPage />,
      },
      // 变更审计
      {
        path: "audit",
        element: <AuditLogPage />,
      },
      // 404 通配路由
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
