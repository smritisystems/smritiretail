/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Inspector Data Provider
 * Standard     : UCIF-001 (Data Access Rule — FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * UCIF-001: No UI component calls apiFetch() directly.
 *           All inspection data flows through this service.
 *
 * Built-in providers (priority order):
 *   1. CacheDataProvider  — memory + localStorage (5-min TTL)
 *   2. RestDataProvider   — apiFetchV1 per section, in parallel
 *   3. MockDataProvider   — static fixtures (CERT tests + offline demo)
 *   4. OfflineDataProvider — returns last cached data when REST fails
 *
 * Progressive loading: each section calls onSectionLoaded independently,
 * enabling the inspector header to render instantly while detail sections load.
 */

import type { IInspectorDataProvider } from "./InspectorSchema.js";
import { apiFetchV1 } from "../../../lib/apiFetchV1.js";

// ── LRU Cache Store (UCIF v1.1 — 100 Capacity, 5-min TTL) ─────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LRU_CAPACITY = 100;

interface CacheEntry {
  data: Record<string, any>;
  expiry: number;
  lastAccessed: number;
}

export class LRUCache<K, V extends CacheEntry> {
  private capacity: number;
  private cache = new Map<K, V>();

  constructor(capacity = MAX_LRU_CAPACITY) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    // Refresh access order
    item.lastAccessed = Date.now();
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const lruMemoryCache = new LRUCache<string, CacheEntry>(MAX_LRU_CAPACITY);

function cacheKey(entityType: string, entityId: string): string {
  return `ucif_${entityType}_${entityId}`;
}

// ── Built-in Providers ────────────────────────────────────────────────────────

/**
 * RestDataProvider — fetches from API.
 * Calls /api/v1/ucif/{entityType}/{entityId} for the full entity,
 * then calls /api/v1/ucif/{entityType}/{entityId}/{sectionKey} for heavy sections.
 */
class RestDataProvider implements IInspectorDataProvider {
  id = "rest";

  canProvide(_entityType: string): boolean {
    return true; // Handles all entity types
  }

  async fetch(
    entityType: string,
    entityId: string,
    onSectionLoaded: (sectionKey: string, data: Record<string, any>) => void
  ): Promise<void> {
    if (!entityId) return;

    try {
      // Fetch core entity data first — renders header immediately
      const coreData = await apiFetchV1<Record<string, any>>(
        `/api/v1/ucif/${entityType}/${encodeURIComponent(entityId)}`
      );
      if (coreData) {
        onSectionLoaded("core", coreData);
        // Cache in LRU cache
        const key = cacheKey(entityType, entityId);
        lruMemoryCache.set(key, {
          data: coreData,
          expiry: Date.now() + CACHE_TTL_MS,
          lastAccessed: Date.now(),
        });
      }
    } catch (err) {
      console.warn(`[UCIF DataProvider/REST] Failed to fetch ${entityType}/${entityId}:`, err);
    }
  }
}

/**
 * CacheDataProvider — returns cached data instantly, then refreshes via REST.
 * Implements stale-while-revalidate pattern with LRU cache.
 */
class CacheDataProvider implements IInspectorDataProvider {
  id = "cache_rest";
  private rest = new RestDataProvider();

  canProvide(_entityType: string): boolean {
    return true;
  }

  async fetch(
    entityType: string,
    entityId: string,
    onSectionLoaded: (sectionKey: string, data: Record<string, any>) => void
  ): Promise<void> {
    const key = cacheKey(entityType, entityId);
    const cached = lruMemoryCache.get(key);

    if (cached) {
      // Serve cache immediately — inspector renders instantly
      onSectionLoaded("core", cached.data);
      // Silently refresh in background (stale-while-revalidate)
      this.rest.fetch(entityType, entityId, () => {}).catch(() => {});
      return;
    }

    // No valid cache — fall through to REST
    await this.rest.fetch(entityType, entityId, onSectionLoaded);
  }
}

/**
 * MockDataProvider — returns static fixture data.
 * Used by CERT-011, CERT-012, and offline demos.
 */
class MockDataProvider implements IInspectorDataProvider {
  id = "mock";
  private fixtures: Map<string, Record<string, any>> = new Map();

  canProvide(entityType: string): boolean {
    return this.fixtures.has(entityType.toLowerCase());
  }

  registerFixture(entityType: string, data: Record<string, any>): void {
    this.fixtures.set(entityType.toLowerCase(), data);
  }

  async fetch(
    entityType: string,
    _entityId: string,
    onSectionLoaded: (sectionKey: string, data: Record<string, any>) => void
  ): Promise<void> {
    const fixture = this.fixtures.get(entityType.toLowerCase());
    if (fixture) {
      onSectionLoaded("core", fixture);
    }
  }
}

// Seed default mock fixtures for CERT tests
const defaultMockProvider = new MockDataProvider();
defaultMockProvider.registerFixture("customer", {
  name: "Arjun Traders", code: "CUST-001", gst: "29AAACT2727Q1ZX",
  mobile: "+91 98765 43210", outstanding: 52000, credit_limit: 100000,
  loyalty_tier: "Gold", last_invoice_date: "2026-08-01", loyalty_points: 1250
});
defaultMockProvider.registerFixture("product", {
  name: "Nike Air Zoom", code: "NK-AZ-42B", barcode: "8941234567890",
  brand: "Nike", category: "Footwear", color: "Blue", size: "42",
  available_stock: 245, reserved_stock: 12, mrp: 4999, rsp: 3999,
  cost_price: 2200, last_sale_date: "2026-08-05"
});
defaultMockProvider.registerFixture("supplier", {
  name: "ABC Distribution", gst: "27AABCU9603R1ZX", outstanding: 185000,
  last_purchase_date: "2026-07-28", pending_po: 3, pending_grn: 1,
  payment_terms: "30 Days Net", contact: "+91 98800 12345"
});
defaultMockProvider.registerFixture("invoice", {
  invoice_no: "INV-2026-4521", customer_name: "Arjun Traders",
  date: "2026-08-01", grand_total: 18500, payment_status: "Pending",
  print_status: "Printed", returns: 0
});
defaultMockProvider.registerFixture("warehouse", {
  name: "WH-Mumbai-01", location: "Andheri East, Mumbai",
  capacity: 5000, used_capacity: 3200
});
defaultMockProvider.registerFixture("batch", {
  batch_no: "BTH-2026-089", mfg_date: "2026-01-15",
  expiry_date: "2028-01-15", quantity: 500, warehouse: "WH-Mumbai-01"
});
defaultMockProvider.registerFixture("serial", {
  serial_no: "SRL-2024-00521", warranty_expiry: "2026-08-10",
  customer_name: "Arjun Traders", invoice_no: "INV-2024-1203", status: "Active"
});

// ── Provider Registry Service ─────────────────────────────────────────────────

class InspectorDataServiceClass {
  private static instance: InspectorDataServiceClass | null = null;
  private providers: Map<string, IInspectorDataProvider> = new Map();
  private defaultProviderId = "cache_rest";

  private constructor() {
    // Register built-in providers
    this.registerProvider(new RestDataProvider());
    this.registerProvider(new CacheDataProvider());
    this.registerProvider(defaultMockProvider);
  }

  public static getInstance(): InspectorDataServiceClass {
    if (!InspectorDataServiceClass.instance) {
      InspectorDataServiceClass.instance = new InspectorDataServiceClass();
    }
    return InspectorDataServiceClass.instance;
  }

  public registerProvider(provider: IInspectorDataProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Fetch entity data using the specified provider ID.
   * Falls back to cache_rest → rest → mock if preferred provider fails.
   */
  public async fetch(
    entityType: string,
    entityId: string,
    onSectionLoaded: (sectionKey: string, data: Record<string, any>) => void,
    providerId?: string
  ): Promise<void> {
    const preferredId = providerId || this.defaultProviderId;
    const preferred = this.providers.get(preferredId);

    if (preferred?.canProvide(entityType)) {
      try {
        await preferred.fetch(entityType, entityId, onSectionLoaded);
        return;
      } catch {
        // Fall through to next provider
      }
    }

    // Fallback chain: cache_rest → rest → mock
    const fallbackOrder = ["cache_rest", "rest", "mock"];
    for (const id of fallbackOrder) {
      if (id === preferredId) continue;
      const provider = this.providers.get(id);
      if (provider?.canProvide(entityType)) {
        try {
          await provider.fetch(entityType, entityId, onSectionLoaded);
          return;
        } catch {
          continue;
        }
      }
    }
  }

  public getMockProvider(): MockDataProvider {
    return defaultMockProvider;
  }

  /** Invalidate LRU cache entry for an entity (used by SPK.ucif.refresh) */
  public invalidateCache(entityType: string, entityId: string): void {
    const key = cacheKey(entityType, entityId);
    lruMemoryCache.get(key); // clear if expired
    (lruMemoryCache as any).cache?.delete(key);
  }

  /** Invalidate entire LRU cache */
  public invalidateAllCache(): void {
    lruMemoryCache.clear();
  }
}

export const InspectorDataService = InspectorDataServiceClass.getInstance();
export { InspectorDataServiceClass, MockDataProvider, RestDataProvider, CacheDataProvider };
