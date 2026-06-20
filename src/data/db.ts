import { createSeedData } from './seed';

const KEY_PREFIX = 'mini-storage-db-v1:';

export const COLLECTION_KEYS = {
  tiers: `${KEY_PREFIX}tiers`,
  tenants: `${KEY_PREFIX}tenants`,
  quotaLedgers: `${KEY_PREFIX}quotaLedgers`,
  tierChangeRecords: `${KEY_PREFIX}tierChangeRecords`,
  pricingRule: `${KEY_PREFIX}pricingRule`,
  storageUnits: `${KEY_PREFIX}storageUnits`,
  contracts: `${KEY_PREFIX}contracts`,
  bills: `${KEY_PREFIX}bills`,
  accessGrants: `${KEY_PREFIX}accessGrants`,
  auditLogs: `${KEY_PREFIX}auditLogs`,
};

export type CollectionKey = typeof COLLECTION_KEYS[keyof typeof COLLECTION_KEYS];

const INIT_FLAG_KEY = `${KEY_PREFIX}initialized`;

function safeParse<T>(raw: string | null): T {
  if (!raw) return [] as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return [] as unknown as T;
  }
}

export function initDB(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(INIT_FLAG_KEY) === 'true') return;

  const seed = createSeedData();

  localStorage.setItem(COLLECTION_KEYS.tiers, JSON.stringify(seed.tiers));
  localStorage.setItem(COLLECTION_KEYS.tenants, JSON.stringify(seed.tenants));
  localStorage.setItem(COLLECTION_KEYS.quotaLedgers, JSON.stringify(seed.quotaLedgers));
  localStorage.setItem(COLLECTION_KEYS.tierChangeRecords, JSON.stringify(seed.tierChangeRecords));
  localStorage.setItem(COLLECTION_KEYS.pricingRule, JSON.stringify([seed.pricingRule]));
  localStorage.setItem(COLLECTION_KEYS.storageUnits, JSON.stringify(seed.storageUnits));
  localStorage.setItem(COLLECTION_KEYS.contracts, JSON.stringify(seed.contracts));
  localStorage.setItem(COLLECTION_KEYS.bills, JSON.stringify(seed.bills));
  localStorage.setItem(COLLECTION_KEYS.accessGrants, JSON.stringify(seed.accessGrants));
  localStorage.setItem(COLLECTION_KEYS.auditLogs, JSON.stringify(seed.auditLogs));

  localStorage.setItem(INIT_FLAG_KEY, 'true');
}

export function resetDB(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(INIT_FLAG_KEY);
  Object.values(COLLECTION_KEYS).forEach(key => localStorage.removeItem(key));
  initDB();
}

export function getCollection<T>(key: CollectionKey): T[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(key);
  return safeParse<T[]>(raw);
}

export function setCollection<T>(key: CollectionKey, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function findById<T extends { id: string }>(key: CollectionKey, id: string): T | undefined {
  const list = getCollection<T>(key);
  return list.find(item => item.id === id);
}

export function insert<T extends { id?: string }>(key: CollectionKey, item: T): T {
  const list = getCollection<T>(key);
  if (!item.id) {
    item.id = 'AUTO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }
  const newList = [...list, item];
  setCollection(key, newList);
  return item;
}

export function update<T extends { id: string }>(
  key: CollectionKey,
  id: string,
  patch: Partial<T>
): T {
  const list = getCollection<T>(key);
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) {
    throw new Error(`Item with id "${id}" not found in collection "${key}"`);
  }
  const updated = { ...list[idx], ...patch } as T;
  const newList = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
  setCollection(key, newList);
  return updated;
}

export function remove(key: CollectionKey, id: string): void {
  const list = getCollection<{ id: string }>(key);
  const newList = list.filter(item => item.id !== id);
  setCollection(key, newList);
}
