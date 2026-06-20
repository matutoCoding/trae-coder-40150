import { useEffect, useState } from "react";
import { useAppStore } from "@/store";

/**
 * 应用初始化 Hook
 * 负责执行系统启动时的初始化逻辑
 * 包括：加载配置、验证会话、预加载数据等
 * @returns 初始化状态对象
 */
export function useAppInit() {
  const [loading, setLoading] = useState(true);
  const _init = useAppStore((s) => s._init);
  const loadTiers = useAppStore((s) => s.loadTiers);
  const loadTenants = useAppStore((s) => s.loadTenants);
  const loadPricing = useAppStore((s) => s.loadPricing);
  const loadStorageUnits = useAppStore((s) => s.loadStorageUnits);
  const loadContracts = useAppStore((s) => s.loadContracts);
  const loadBills = useAppStore((s) => s.loadBills);
  const loadAccessGrants = useAppStore((s) => s.loadAccessGrants);
  const loadAuditLogs = useAppStore((s) => s.loadAuditLogs);
  const loadQuotaLedgers = useAppStore((s) => s.loadQuotaLedgers);
  const loadTierChangeRecords = useAppStore((s) => s.loadTierChangeRecords);

  useEffect(() => {
    // 模拟异步初始化过程
    const initApp = async () => {
      try {
        // 模拟网络请求延迟
        await new Promise((resolve) => setTimeout(resolve, 800));

        // 执行 store 初始化（数据库连接等）
        _init();

        // 并行加载所有基础数据
        await Promise.all([
          loadTiers(),
          loadTenants(),
          loadPricing(),
          loadStorageUnits(),
          loadContracts(),
          loadBills(),
          loadAccessGrants(),
          loadAuditLogs(),
          loadQuotaLedgers(),
          loadTierChangeRecords(),
        ]);
      } catch (error) {
        console.error("应用初始化失败:", error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, [
    _init,
    loadTiers,
    loadTenants,
    loadPricing,
    loadStorageUnits,
    loadContracts,
    loadBills,
    loadAccessGrants,
    loadAuditLogs,
    loadQuotaLedgers,
    loadTierChangeRecords,
  ]);

  return { loading };
}
