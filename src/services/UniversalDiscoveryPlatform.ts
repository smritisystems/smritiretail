/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Universal Discovery Platform (UDP / ADR-UDP-001)
 * Standard     : UFR-001 / SCS-UIX-001 — Universal Discovery Platform Standard
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 2.0.0
 *
 * Single, unified enterprise discovery engine powering F2, Search Button, Barcode Scan,
 * and AI Assistant across Products, Customers, Suppliers, Accounts, and Documents.
 */

import { SPK, ILookupItem } from "../kernel/SPK.js";
import { ItemQueryBuilder } from "./ItemQueryBuilder.js";

export type DiscoveryDomain = "ITEM" | "CUSTOMER" | "SUPPLIER" | "ACCOUNT" | "DOCUMENT" | "USER";

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
  data: Record<string, any>;
}

export class UniversalDiscoveryPlatform {
  private static instance: UniversalDiscoveryPlatform;

  public static getInstance(): UniversalDiscoveryPlatform {
    if (!UniversalDiscoveryPlatform.instance) {
      UniversalDiscoveryPlatform.instance = new UniversalDiscoveryPlatform();
    }
    return UniversalDiscoveryPlatform.instance;
  }

  /**
   * 1. Context-Aware Domain Auto-Resolution
   */
  public resolveDomainFromWorkspace(workspaceId?: string): DiscoveryDomain {
    if (!workspaceId) return "ITEM";
    const w = workspaceId.toLowerCase();

    if (w.includes("purchase") || w.includes("supplier")) return "SUPPLIER";
    if (w.includes("sales") || w.includes("customer") || w.includes("crm")) return "CUSTOMER";
    if (w.includes("ledger") || w.includes("accounting")) return "ACCOUNT";
    return "ITEM";
  }

  /**
   * 2. Smart Relevance Ranking Algorithm (Exact Barcode -> SKU -> Code -> Prefix -> Substring)
   */
  public rankResults(rawItems: ILookupItem[], query?: string): RankedDiscoveryResult[] {
    const q = (query || "").trim().toLowerCase();

    const ranked: RankedDiscoveryResult[] = rawItems.map((item) => {
      const itemCode = (item.code || item.id || "").toLowerCase();
      const itemName = (item.name || item.title || "").toLowerCase();
      const itemBarcode = String(item.metadata?.barcode || "").toLowerCase();
      const itemArticle = String(item.metadata?.articleNo || item.metadata?.styleCode || "").toLowerCase();

      let score = 0;

      if (q) {
        if (itemBarcode === q) score += 1000;
        else if (itemCode === q) score += 800;
        else if (itemArticle === q) score += 600;
        else if (itemName.startsWith(q)) score += 400;
        else if (itemName.includes(q) || itemCode.includes(q) || itemBarcode.includes(q)) score += 200;
      } else {
        score = 100; // Default browse score
      }

      const badgeStr = typeof item.badge === "string" ? item.badge : item.badge?.label;

      return {
        id: item.id,
        code: item.code || item.id,
        title: item.name || item.title || item.id,
        subtitle: (item.metadata?.category || item.metadata?.group || item.metadata?.phone || item.subtitle || "") as string,
        domain: (item.type?.toUpperCase() as DiscoveryDomain) || "ITEM",
        badge: badgeStr,
        relevanceScore: score,
        data: item.metadata || {},
      };
    });

    return ranked
      .filter((r) => !q || r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 3. Unified Discovery Execution Pipeline
   */
  public async discover(query: string, context: DiscoveryContext = {}): Promise<RankedDiscoveryResult[]> {
    const startTime = performance.now();
    const domain = this.resolveDomainFromWorkspace(context.activeWorkspaceId);

    const lookupProvider = SPK.ule.getProvider(domain);
    let rawItems: ILookupItem[] = [];

    if (lookupProvider) {
      const searchRes = await SPK.ule.search(domain, query);
      rawItems = searchRes as ILookupItem[];
    }

    const ranked = this.rankResults(rawItems, query);
    return ranked.slice(0, context.limit || 100);
  }
}
