import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import "./index.css";

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 请求失败重试次数
      retry: 1,
      // 窗口重新聚焦时是否重新获取
      refetchOnWindowFocus: false,
      // 数据缓存时间（5 分钟）
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // 变更操作失败重试次数
      retry: 0,
    },
  },
});

// 应用入口：渲染根组件
createRoot(document.getElementById("root")!).render(
  // React Query Provider：提供全局数据请求能力
  <QueryClientProvider client={queryClient}>
    {/* Router Provider：使用 Hash 路由 */}
    <RouterProvider router={router} />
  </QueryClientProvider>
);
