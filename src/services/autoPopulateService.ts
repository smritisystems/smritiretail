/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.10.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Universal Backend Auto-Populate & Typeahead Service
 */

import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { Customer, Product, CustomerPriceGroup } from "../types.ts";
import { getCustomers, getCustomerPriceGroups } from "./customerStore.ts";

export interface AutoPopulateCustomerResult {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  customerGroupId: string;
  outstanding: number;
  status: string;
  tags?: string[];
  priceGroupCode?: string;
  priceGroupDescription?: string;
  paymentTerms?: string;
  creditDays?: number;
  creditLimit?: number;
  destTaxType?: string;
  allowCreditInvoice?: boolean;
  allowCashInvoice?: boolean;
  allowMiscIssue?: boolean;
}

export interface AutoPopulateProductResult {
  id: string;
  // Key Identifiers
  barcode: string;
  stockNo: string;
  code: string;
  sku: string;
  name: string;
  description: string;

  // Initial 5–7 Important Related Details
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  stockQty: number;
  size?: string;
  color?: string;
  gstPercentage: number;

  // Additional 5–7 Relevant Item Details
  brand?: string;
  category: string;
  hsnCode: string;
  pricingMode?: string;
  trackingMode?: string;
  weightGrams?: number;
  primaryImageUrl?: string;
  secondaryBarcodes?: string[];
  uom: string;
}

export interface AutoPopulateHsnResult {
  code: string;
  description: string;
  gstRate: number;
}

// In-memory debounce timers and cache
const searchCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15000;

export function clearCustomerSearchCache(): void {
  searchCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("smriti_customer_updated", () => {
    clearCustomerSearchCache();
  });
}

/**
 * Searches customers from backend in real-time as user types in any customer-related field.
 */
export async function searchBackendCustomers(
  query: string,
  invoiceScope?: { series: string; from: number; to: number }
): Promise<AutoPopulateCustomerResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    const local = getCustomers();
    return enrichCustomersWithPriceGroups(local.slice(0, 10));
  }

  const scopeKey = invoiceScope ? `:${invoiceScope.series}:${invoiceScope.from}-${invoiceScope.to}` : "";
  const cacheKey = `cust:${cleanQ.toLowerCase()}${scopeKey}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({ q: cleanQ, limit: "15" });
    if (invoiceScope) {
      params.set("invoice_series", invoiceScope.series);
      params.set("invoice_from", String(invoiceScope.from));
      params.set("invoice_to", String(invoiceScope.to));
    }
    const res = await apiFetchV1(`/crm/customers/search?${params.toString()}`);
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    if (rawList.length > 0) {
      const enriched = enrichCustomersWithPriceGroups(rawList);
      searchCache.set(cacheKey, { timestamp: Date.now(), data: enriched });
      return enriched;
    }
  } catch {
    // Network fallback
  }

  // Fallback to local store filtering
  const localList = getCustomers();
  const lowerQ = cleanQ.toLowerCase();
  const matched = localList.filter(c =>
    c.name?.toLowerCase().includes(lowerQ) ||
    c.mobile?.includes(cleanQ) ||
    c.id?.toLowerCase().includes(lowerQ) ||
    c.code?.toLowerCase().includes(lowerQ) ||
    c.gstNumber?.toLowerCase().includes(lowerQ) ||
    c.email?.toLowerCase().includes(lowerQ)
  );

  const enriched = enrichCustomersWithPriceGroups(matched);
  searchCache.set(cacheKey, { timestamp: Date.now(), data: enriched });
  return enriched;
}

/**
 * Enriches customer records with linked Customer Price Group details.
 */
function enrichCustomersWithPriceGroups(customers: any[]): AutoPopulateCustomerResult[] {
  const priceGroups = getCustomerPriceGroups();
  return customers.map(c => {
    // Find matching price group
    const matchedPg = priceGroups.find(pg => 
      (c.priceGroup && c.priceGroup.startsWith(pg.code)) || 
      (c.customerGroupId === "CG-Retail" && pg.code === "RETAIL") ||
      (c.customerGroupId === "CG-LargeRetail" && pg.code === "CORP") ||
      pg.code === "CPP"
    ) || priceGroups[0];

    return {
      id: c.id,
      code: c.code || c.id,
      name: c.name,
      mobile: c.mobile || c.phone || "",
      email: c.email,
      gstNumber: c.gstNumber || c.gst_number,
      customerGroupId: c.customerGroupId || c.customer_group_id || "CG-Retail",
      outstanding: Number(c.outstanding || 0),
      status: c.status || "Active",
      tags: c.tags || [],
      priceGroupCode: matchedPg?.code,
      priceGroupDescription: matchedPg?.description,
      paymentTerms: matchedPg?.paymentTerms || "PT",
      creditDays: matchedPg?.creditDays ?? 30,
      creditLimit: matchedPg?.creditLimit ?? 100000,
      destTaxType: matchedPg?.destTaxType || "Local",
      allowCreditInvoice: matchedPg?.allowCreditInvoice ?? true,
      allowCashInvoice: matchedPg?.allowCashInvoice ?? true,
      allowMiscIssue: matchedPg?.allowMiscIssue ?? false
    };
  });
}

/**
 * Searches products/items from backend or local catalog as user types stock no, barcode, code, or sku.
 */
export async function searchBackendProducts(query: string, localProducts: Product[] = []): Promise<AutoPopulateProductResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const cacheKey = `prod:${cleanQ.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try local list match first for instant sub-millisecond responsiveness
  const lowerQ = cleanQ.toLowerCase();
  const localMatched = localProducts.filter(p =>
    p.code?.toLowerCase().includes(lowerQ) ||
    p.barcode?.toLowerCase().includes(lowerQ) ||
    p.sku?.toLowerCase().includes(lowerQ) ||
    (p as any).style_code?.toLowerCase().includes(lowerQ) ||
    (p as any).styleCode?.toLowerCase().includes(lowerQ) ||
    p.name?.toLowerCase().includes(lowerQ) ||
    p.category?.toLowerCase().includes(lowerQ) ||
    p.brand?.toLowerCase().includes(lowerQ)
  );

  if (localMatched.length > 0) {
    const results = localMatched.map(mapToProductResult);
    searchCache.set(cacheKey, { timestamp: Date.now(), data: results });
    return results;
  }

  // 2. Query backend inventory products endpoint
  try {
    const res = await apiFetchV1(`/products/search?q=${encodeURIComponent(cleanQ)}&limit=15`);
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    if (rawList.length > 0) {
      const results = rawList.map(mapToProductResult);
      searchCache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    }
  } catch {
    try {
      const res2 = await apiFetchV1(`/products?q=${encodeURIComponent(cleanQ)}&page_size=15`);
      const rawList2 = Array.isArray(res2) ? res2 : (res2?.items || []);
      if (rawList2.length > 0) {
        const results2 = rawList2.map(mapToProductResult);
        searchCache.set(cacheKey, { timestamp: Date.now(), data: results2 });
        return results2;
      }
    } catch {
      // Backend offline fallback
    }
  }

  return [];
}

function mapToProductResult(p: any): AutoPopulateProductResult {
  const stockNo = p.stockNo || p.styleCode || p.style_code || p.code || "";
  const barcode = p.barcode || p.code || "";
  const sku = p.sku || p.code || barcode;
  const code = p.code || sku;
  const name = p.name || p.itemDescription || p.description || "Product Item";
  const desc = p.description || p.name || name;

  return {
    id: p.id || p.code,
    barcode,
    stockNo,
    code,
    sku,
    name,
    description: desc,
    sellingPrice: Number(p.sellingPrice || p.price || p.rate || p.mrp || 0),
    mrp: Number(p.mrp || p.sellingPrice || p.price || 0),
    costPrice: Number(p.costPrice || p.cost_price || p.buying_price || p.purchasePrice || 0),
    stockQty: Number(p.stockQty || p.stock || p.availableStock || 0),
    size: p.size || "Standard",
    color: p.color || "Standard",
    gstPercentage: Number(p.gstPercentage || p.gst_percentage || p.gstRate || 18),
    brand: p.brand || "SMRITI",
    category: p.category || "General",
    hsnCode: p.hsnCode || p.hsn_code || "6203",
    pricingMode: p.pricingMode || p.pricing_mode || "Fixed",
    trackingMode: p.trackingMode || p.tracking_mode || "Standard",
    weightGrams: Number(p.weightGrams || p.weight_grams || 0),
    primaryImageUrl: p.primaryImageUrl || p.primary_image_url || p.imageUrl || undefined,
    secondaryBarcodes: p.secondaryBarcodes || p.secondary_barcodes || [],
    uom: p.uom || "Pcs"
  };
}

/**
 * Searches HSN codes and tax mappings.
 */
export function searchHsnCodes(query: string): AutoPopulateHsnResult[] {
  const cleanQ = query.trim().toLowerCase();
  const canonicalHsn: AutoPopulateHsnResult[] = [
    { code: "6203", description: "Men's Suits, Ensembles, Jackets, Trousers", gstRate: 5 },
    { code: "6204", description: "Women's Suits, Ensembles, Dresses, Skirts", gstRate: 5 },
    { code: "6205", description: "Men's Shirts of Cotton or Synthetic Fibres", gstRate: 5 },
    { code: "6206", description: "Women's Blouses, Shirts, Shirt-Blouses", gstRate: 5 },
    { code: "6109", description: "T-Shirts, Singlets and Other Vests (Knitted)", gstRate: 12 },
    { code: "6110", description: "Jerseys, Pullovers, Cardigans (Knitted)", gstRate: 12 },
    { code: "8471", description: "Automatic Data Processing Machines & POS Hardware", gstRate: 18 },
    { code: "8528", description: "Monitors and Display Screens", gstRate: 18 },
    { code: "4821", description: "Paper or Paperboard Labels of All Kinds", gstRate: 18 },
    { code: "9983", description: "Other Professional, Technical & Business Services", gstRate: 18 }
  ];

  if (!cleanQ) return canonicalHsn;
  return canonicalHsn.filter(h => h.code.includes(cleanQ) || h.description.toLowerCase().includes(cleanQ));
}
