/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.75.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export interface CachedPriceRevision {
  revision_id: string;
  price: number;
  mrp: number;
  cost_price?: number;
  effective_from: string; // ISO 8601 UTC
  effective_to?: string | null; // ISO 8601 UTC
  reason_code?: string;
}

export interface ResolvedOfflinePrice {
  price: number;
  mrp: number;
  source: "REVISION_HISTORY" | "ACTIVE_BASELINE" | "STALE_FALLBACK";
  revision_id?: string;
  is_stale_warning: boolean;
  warning_detail?: string;
  isScheduled?: boolean;
}

export interface CachedProduct {
  id: string;
  code: string;
  name: string;
  sku?: string;
  barcode?: string;
  barcodes?: string[];
  category?: string;
  price: number;
  mrp: number;
  cost_price?: number;
  tax_rate: number;
  hsn_code?: string;
  stock?: number;
  uom?: string;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  revision_id?: string;
  revisions?: CachedPriceRevision[];
  last_synced_at?: string;
}

export interface CachedCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  outstanding_balance?: number;
  loyalty_points?: number;
  credit_limit?: number;
}

export interface CatalogCacheStats {
  product_count: number;
  barcode_index_count: number;
  customer_count: number;
  last_synced_at: string | null;
}

export class ProPosMasterCatalogCache {
  private static productMap: Map<string, CachedProduct> = new Map();
  private static barcodeIndex: Map<string, string> = new Map(); // barcode -> product_id
  private static customerMap: Map<string, CachedCustomer> = new Map();
  private static customerPhoneIndex: Map<string, string> = new Map(); // phone -> customer_id
  private static lastSyncedAt: string | null = null;

  /**
   * Clears the in-memory/edge cache (useful for testing or full catalog wipe).
   */
  public static clearCache(): void {
    this.productMap.clear();
    this.barcodeIndex.clear();
    this.customerMap.clear();
    this.customerPhoneIndex.clear();
    this.lastSyncedAt = null;
  }

  /**
   * Ingests and indexes product items into the edge cache.
   */
  public static seedProducts(products: CachedProduct[]): void {
    for (const prod of products) {
      this.productMap.set(prod.id, prod);

      // Index primary barcode
      if (prod.barcode) {
        this.barcodeIndex.set(prod.barcode.trim().toUpperCase(), prod.id);
      }
      // Index secondary/alias barcodes
      if (prod.barcodes && Array.isArray(prod.barcodes)) {
        for (const bc of prod.barcodes) {
          if (bc) this.barcodeIndex.set(bc.trim().toUpperCase(), prod.id);
        }
      }
      // Index product code as lookup key
      if (prod.code) {
        this.barcodeIndex.set(prod.code.trim().toUpperCase(), prod.id);
      }
    }
  }

  private static normalizePhone(phone?: string): string {
    if (!phone) return "";
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  /**
   * Ingests and indexes customer items into the edge cache.
   */
  public static seedCustomers(customers: CachedCustomer[]): void {
    for (const cust of customers) {
      this.customerMap.set(cust.id, cust);
      if (cust.phone) {
        const rawDigits = cust.phone.replace(/[^0-9]/g, "");
        const normPhone = this.normalizePhone(cust.phone);
        if (rawDigits) this.customerPhoneIndex.set(rawDigits, cust.id);
        if (normPhone) this.customerPhoneIndex.set(normPhone, cust.id);
      }
    }
  }

  /**
   * Performs sub-millisecond barcode lookup for point-of-sale scanner input.
   */
  public static lookupByBarcode(barcode: string): CachedProduct | null {
    if (!barcode) return null;
    const cleanKey = barcode.trim().toUpperCase();
    const productId = this.barcodeIndex.get(cleanKey);
    if (productId) {
      return this.productMap.get(productId) || null;
    }
    return null;
  }

  /**
   * Resolves authoritative offline price for a cached product against transaction timestamp.
   *
   * Fallback & Integrity Policy (Safeguard C):
   * 1. Temporal Revisions Array:
   *    Evaluates revisions where effective_from <= txTime < (effective_to or infinity).
   *    Selects the latest effective_from revision matching the interval.
   * 2. Active Baseline Fallback:
   *    If no temporal revision covers txTime, falls back to product.price & product.mrp.
   * 3. Statutory Ceiling Safeguard:
   *    Guarantees price <= mrp. Clamps price to mrp if invariant violated.
   * 4. Cache Freshness & Clock Drift Policy:
   *    If cache has not synced in > maxCacheAgeDays, flags warning for cashier review.
   */
  public static resolveEffectiveProductPrice(
    product: CachedProduct,
    asOfDate: Date = new Date(),
    maxCacheAgeDays: number = 7
  ): ResolvedOfflinePrice {
    const txTime = asOfDate.getTime();
    let selectedRevision: CachedPriceRevision | null = null;
    let isScheduled = false;

    // 1. Evaluate temporal revisions array if present
    if (product.revisions && product.revisions.length > 0) {
      // Sort revisions by effective_from descending
      const sorted = [...product.revisions].sort(
        (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime()
      );

      for (const rev of sorted) {
        const effFrom = new Date(rev.effective_from).getTime();
        const effTo = rev.effective_to ? new Date(rev.effective_to).getTime() : Infinity;

        if (txTime < effFrom) {
          isScheduled = true;
        } else if (effFrom <= txTime && txTime < effTo) {
          selectedRevision = rev;
          break;
        }
      }
    } else if (product.effective_from) {
      // Legacy single revision fallback
      const effFrom = new Date(product.effective_from).getTime();
      const effTo = product.effective_to ? new Date(product.effective_to).getTime() : Infinity;
      if (txTime < effFrom) {
        isScheduled = true;
      } else if (effFrom <= txTime && txTime < effTo) {
        selectedRevision = {
          revision_id: product.revision_id || "rev-single",
          price: product.price,
          mrp: product.mrp,
          effective_from: product.effective_from,
          effective_to: product.effective_to,
        };
      }
    }

    let finalPrice = product.price;
    let finalMrp = product.mrp;
    let source: "REVISION_HISTORY" | "ACTIVE_BASELINE" | "STALE_FALLBACK" = "ACTIVE_BASELINE";
    let revisionId: string | undefined = undefined;

    if (selectedRevision) {
      finalPrice = selectedRevision.price;
      finalMrp = selectedRevision.mrp;
      source = "REVISION_HISTORY";
      revisionId = selectedRevision.revision_id;
    }

    // Statutory ceiling invariant safeguard: selling price <= mrp
    if (finalPrice > finalMrp) {
      finalPrice = finalMrp;
    }

    // Cache Staleness & Clock Drift Check
    let isStale = false;
    let warningDetail: string | undefined = undefined;
    if (product.last_synced_at) {
      const syncAgeMs = Date.now() - new Date(product.last_synced_at).getTime();
      const maxAgeMs = maxCacheAgeDays * 24 * 60 * 60 * 1000;
      if (syncAgeMs > maxAgeMs) {
        isStale = true;
        warningDetail = `Offline catalog cache is older than ${maxCacheAgeDays} days. Please synchronize with server.`;
        source = "STALE_FALLBACK";
      }
    }

    return {
      price: finalPrice,
      mrp: finalMrp,
      source,
      revision_id: revisionId,
      is_stale_warning: isStale,
      warning_detail: warningDetail,
      isScheduled,
    };
  }

  /**
   * Performs high-speed fuzzy search across product code, name, category, or SKU.
   */
  public static searchProducts(query: string, limit: number = 20): CachedProduct[] {
    if (!query || query.trim() === "") {
      return Array.from(this.productMap.values()).slice(0, limit);
    }
    const q = query.toLowerCase().trim();
    const matches: CachedProduct[] = [];

    for (const prod of this.productMap.values()) {
      if (!prod.is_active) continue;

      if (
        (prod.name && prod.name.toLowerCase().includes(q)) ||
        (prod.code && prod.code.toLowerCase().includes(q)) ||
        (prod.sku && prod.sku.toLowerCase().includes(q)) ||
        (prod.category && prod.category.toLowerCase().includes(q)) ||
        (prod.hsn_code && prod.hsn_code.toLowerCase().includes(q))
      ) {
        matches.push(prod);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }

  /**
   * Looks up a customer by phone number, name, or GSTIN.
   */
  public static lookupCustomer(query: string): CachedCustomer | null {
    if (!query) return null;
    const rawDigits = query.replace(/[^0-9]/g, "");
    const normDigits = this.normalizePhone(query);

    if (rawDigits && this.customerPhoneIndex.has(rawDigits)) {
      const custId = this.customerPhoneIndex.get(rawDigits);
      if (custId) return this.customerMap.get(custId) || null;
    }

    if (normDigits && this.customerPhoneIndex.has(normDigits)) {
      const custId = this.customerPhoneIndex.get(normDigits);
      if (custId) return this.customerMap.get(custId) || null;
    }

    const q = query.toLowerCase().trim();
    for (const cust of this.customerMap.values()) {
      if (
        (cust.name && cust.name.toLowerCase().includes(q)) ||
        (cust.gstin && cust.gstin.toLowerCase().includes(q)) ||
        (cust.email && cust.email.toLowerCase().includes(q))
      ) {
        return cust;
      }
    }
    return null;
  }

  /**
   * Synchronizes and refreshes the master product and customer catalogs from the FastAPI backend.
   */
  public static async syncCatalogFromServer(
    companyId: string = "COMP-001",
    branchId: string = "BR-MAIN-001"
  ): Promise<CatalogCacheStats> {
    try {
      // 1. Fetch Products
      const productsRes = await apiFetchV1(`/products?limit=5000&company_id=${companyId}`);
      const rawProducts = Array.isArray(productsRes) ? productsRes : productsRes?.items || [];

      const formattedProducts: CachedProduct[] = rawProducts.map((p: any) => ({
        id: p.id || p._id,
        code: p.code || p.item_code || "",
        name: p.name || p.item_name || "",
        sku: p.sku || p.code,
        barcode: p.barcode,
        barcodes: p.barcodes || [],
        category: p.category || "General",
        price: Number(p.price || p.selling_price || p.rate || 0),
        mrp: Number(p.mrp || p.price || 0),
        cost_price: Number(p.cost_price || p.buying_price || 0),
        tax_rate: Number(p.tax_rate || p.gst_rate || 0),
        hsn_code: p.hsn_code,
        stock: Number(p.stock || p.current_stock || 0),
        uom: p.uom || "PCS",
        is_active: p.is_active !== false,
        revisions: Array.isArray(p.revisions)
          ? p.revisions.map((r: any) => ({
              revision_id: r.id || r.revision_id,
              price: Number(r.revised_selling_price || r.price || 0),
              mrp: Number(r.revised_mrp || r.mrp || 0),
              cost_price: r.revised_cost_price != null ? Number(r.revised_cost_price) : undefined,
              effective_from: r.effective_from,
              effective_to: r.effective_to,
              reason_code: r.reason_code,
            }))
          : [],
        last_synced_at: new Date().toISOString(),
      }));

      // 2. Fetch Customers
      const customersRes = await apiFetchV1(`/crm/customers?limit=1000&company_id=${companyId}`);
      const rawCustomers = Array.isArray(customersRes) ? customersRes : customersRes?.items || [];

      const formattedCustomers: CachedCustomer[] = rawCustomers.map((c: any) => ({
        id: c.id || c._id,
        name: c.name || c.customer_name || "Walk-in Customer",
        phone: c.phone || c.mobile,
        email: c.email,
        gstin: c.gstin,
        outstanding_balance: Number(c.outstanding || c.balance || 0),
        loyalty_points: Number(c.loyalty_points || c.points || 0),
        credit_limit: Number(c.credit_limit || 0),
      }));

      this.seedProducts(formattedProducts);
      this.seedCustomers(formattedCustomers);
      this.lastSyncedAt = new Date().toISOString();

      return this.getCatalogStats();
    } catch (err) {
      console.warn("[ProPosCatalog] Background catalog sync error:", err);
      return this.getCatalogStats();
    }
  }

  /**
   * Returns metadata and volume statistics for cached entities.
   */
  public static getCatalogStats(): CatalogCacheStats {
    return {
      product_count: this.productMap.size,
      barcode_index_count: this.barcodeIndex.size,
      customer_count: this.customerMap.size,
      last_synced_at: this.lastSyncedAt,
    };
  }
}
