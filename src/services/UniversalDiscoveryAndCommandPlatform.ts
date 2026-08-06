/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Universal Discovery & Command Platform (UDCP / ADR-UDP-002)
 * Standard     : UFR-001 / SCS-UIX-001 — Universal Discovery & Command Standard
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 3.0.0
 *
 * Universal Spotlight & Command Palette engine powering F2, Search Button, Barcode Scan,
 * and AI Assistant with Control-Aware Resolution, Discovery Memory, and Instant Command Actions!
 */

import { SPK, ILookupItem } from "../kernel/SPK.js";
import { WindowManager } from "../sdk/WindowManager.ts";

export type DiscoveryDomain = "ITEM" | "CUSTOMER" | "SUPPLIER" | "ACCOUNT" | "DOCUMENT" | "USER" | "ACTION";

export interface DiscoveryAction {
  id: string;
  label: string;
  icon?: string;
  execute(record: RankedDiscoveryResult): void;
}

export interface DiscoveryContext {
  activeWorkspaceId?: string;
  targetFieldId?: string;
  prefilledQuery?: string;
  tenantId?: string;
  limit?: number;
}

export interface RankedDiscoveryResult {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  domain: DiscoveryDomain;
  badge?: string;
  relevanceScore: number;
  frequentlyUsedCount: number;
  actions: DiscoveryAction[];
  data: Record<string, any>;
}

export interface IDiscoveryProvider {
  domain: DiscoveryDomain;
  search(query: string, context?: DiscoveryContext): Promise<ILookupItem[]>;
}

export class UniversalDiscoveryAndCommandPlatform {
  private static instance: UniversalDiscoveryAndCommandPlatform;
  private providers: Map<DiscoveryDomain, IDiscoveryProvider> = new Map();
  private memoryStore: Map<string, number> = new Map();

  constructor() {
    this.loadMemoryFromStorage();
  }

  public static getInstance(): UniversalDiscoveryAndCommandPlatform {
    if (!UniversalDiscoveryAndCommandPlatform.instance) {
      UniversalDiscoveryAndCommandPlatform.instance = new UniversalDiscoveryAndCommandPlatform();
    }
    return UniversalDiscoveryAndCommandPlatform.instance;
  }

  /**
   * 1. Register Custom Industry Pack & AI Discovery Providers
   */
  public registerProvider(domain: DiscoveryDomain, provider: IDiscoveryProvider): void {
    this.providers.set(domain, provider);
  }

  /**
   * 2. Control-Aware Context Resolution (Field Control Priority > Workspace Priority)
   */
  public resolveDomainFromContext(context: DiscoveryContext = {}): DiscoveryDomain {
    const field = (context.targetFieldId || "").toLowerCase();
    if (field.includes("customer") || field.includes("crm")) return "CUSTOMER";
    if (field.includes("supplier") || field.includes("vendor")) return "SUPPLIER";
    if (field.includes("account") || field.includes("ledger")) return "ACCOUNT";
    if (field.includes("barcode") || field.includes("item") || field.includes("product") || field.includes("sku")) return "ITEM";

    const w = (context.activeWorkspaceId || "").toLowerCase();
    if (w.includes("purchase") || w.includes("supplier")) return "SUPPLIER";
    if (w.includes("sales") || w.includes("customer") || w.includes("crm")) return "CUSTOMER";
    if (w.includes("ledger") || w.includes("accounting")) return "ACCOUNT";

    return "ITEM";
  }

  public resolveDomainFromWorkspace(workspaceId?: string): DiscoveryDomain {
    return this.resolveDomainFromContext({ activeWorkspaceId: workspaceId });
  }

  /**
   * 3. Discovery Memory — Local Usage Store Persistence
   */
  private loadMemoryFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const data = localStorage.getItem("udcp_discovery_memory");
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([k, v]) => this.memoryStore.set(k, Number(v) || 0));
      }
    } catch {
      // Ignore fallback
    }
  }

  public recordSelection(recordId: string): void {
    const current = this.memoryStore.get(recordId) || 0;
    this.memoryStore.set(recordId, current + 1);

    if (typeof localStorage !== "undefined") {
      try {
        const obj: Record<string, number> = {};
        this.memoryStore.forEach((val, key) => {
          obj[key] = val;
        });
        localStorage.setItem("udcp_discovery_memory", JSON.stringify(obj));
      } catch {
        // Ignore fallback
      }
    }
  }

  /**
   * 4. Smart Relevance Ranking Engine (Barcode -> SKU -> Code -> Usage Memory -> Prefix -> Substring)
   */
  public rankResults(rawItems: ILookupItem[], query?: string): RankedDiscoveryResult[] {
    const q = (query || "").trim().toLowerCase();

    const ranked: RankedDiscoveryResult[] = rawItems.map((item) => {
      const itemCode = (item.code || item.id || "").toLowerCase();
      const itemName = (item.name || item.title || "").toLowerCase();
      const itemBarcode = String(item.metadata?.barcode || "").toLowerCase();
      const itemArticle = String(item.metadata?.articleNo || item.metadata?.styleCode || "").toLowerCase();

      let score = 0;

      // Discovery Memory Boost (Local Usage Ranking)
      const usageCount = this.memoryStore.get(item.id) || 0;
      score += Math.min(usageCount * 50, 300);

      if (q) {
        if (itemBarcode === q) score += 1000;
        else if (itemCode === q) score += 800;
        else if (itemArticle === q) score += 600;
        else if (itemName.startsWith(q)) score += 400;
        else if (itemName.includes(q) || itemCode.includes(q) || itemBarcode.includes(q)) score += 200;
      } else {
        score += 100; // Default browse score
      }

      const badgeStr = typeof item.badge === "string" ? item.badge : item.badge?.label;

      // 5. Dynamic Command Palette Actions
      const defaultActions: DiscoveryAction[] = [
        {
          id: "open",
          label: "Open Record",
          execute: (rec) => {
            this.recordSelection(rec.id);
            WindowManager.openTransaction({
              transactionType: "SalesInvoice",
              mode: "standalone",
              recordId: rec.id,
            });
          },
        },
        {
          id: "print",
          label: "Print Barcode Labels",
          execute: (rec) => {
            this.recordSelection(rec.id);
          },
        },
        {
          id: "stock",
          label: "View Stock Ledger",
          execute: (rec) => {
            this.recordSelection(rec.id);
          },
        },
      ];

      return {
        id: item.id,
        code: item.code || item.id,
        title: item.name || item.title || item.id,
        subtitle: (item.metadata?.category || item.metadata?.group || item.metadata?.phone || item.subtitle || "") as string,
        domain: (item.type?.toUpperCase() as DiscoveryDomain) || "ITEM",
        badge: badgeStr,
        relevanceScore: score,
        frequentlyUsedCount: usageCount,
        actions: defaultActions,
        data: item.metadata || {},
      };
    });

    return ranked
      .filter((r) => !q || r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 6. Unified Discovery & Command Execution Pipeline
   */
  public async discover(query: string, context: DiscoveryContext = {}): Promise<RankedDiscoveryResult[]> {
    const domain = this.resolveDomainFromContext(context);

    // Custom Registered Provider check
    const customProvider = this.providers.get(domain);
    let rawItems: ILookupItem[] = [];

    if (customProvider) {
      rawItems = await customProvider.search(query, context);
    } else {
      const lookupProvider = SPK.ule.getProvider(domain);
      if (lookupProvider) {
        const searchRes = await SPK.ule.search(domain, query);
        rawItems = searchRes as ILookupItem[];
      }
    }

    const ranked = this.rankResults(rawItems, query);
    return ranked.slice(0, context.limit || 100);
  }
}
