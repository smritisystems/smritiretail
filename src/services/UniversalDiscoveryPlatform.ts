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

import { SPK, NormalizedLookupItem } from "../kernel/SPK.js";
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
  public rankResults(rawItems: NormalizedLookupItem[], query?: string): RankedDiscoveryResult[] {
    const q = (query || "").trim().toLowerCase();

    const ranked = rawItems.map((item) => {
      const itemCode = (item.code || "").toLowerCase();
      const itemName = (item.name || "").toLowerCase();
      const itemBarcode = (item.data?.barcode || "").toLowerCase();
      const itemArticle = ((item.data?.articleNo || item.data?.styleCode || "") as string).toLowerCase();

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

      return {
        id: item.id,
        code: item.code,
        title: item.name,
        subtitle: item.data?.category || item.data?.group || item.data?.phone || "",
        domain: (item.master_type_id?.toUpperCase() as DiscoveryDomain) || "ITEM",
        badge: item.badge,
        relevanceScore: score,
        data: item.data || {},
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
    let rawItems: NormalizedLookupItem[] = [];

    if (lookupProvider) {
      rawItems = await SPK.ule.search(domain, query, { limit: context.limit || 100 });
    }

    const ranked = this.rankResults(rawItems, query);
    const duration = performance.now() - startTime;

    return ranked.slice(0, context.limit || 100);
  }
}
