/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
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
  code: string;
  barcode: string;
  name: string;
  description: string;
  sellingPrice: number;
  mrp: number;
  costPrice: number;
  gstPercentage: number;
  hsnCode: string;
  category: string;
  brand?: string;
  size?: string;
  color?: string;
  uom: string;
  stockQty?: number;
}

export interface AutoPopulateHsnResult {
  code: string;
  description: string;
  gstRate: number;
}

// In-memory debounce timers and cache
const searchCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15000;

/**
 * Searches customers from backend in real-time as user types in any customer-related field.
 */
export async function searchBackendCustomers(query: string): Promise<AutoPopulateCustomerResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    const local = getCustomers();
    return enrichCustomersWithPriceGroups(local.slice(0, 10));
  }

  const cacheKey = `cust:${cleanQ.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await apiFetchV1(`/customers/search?q=${encodeURIComponent(cleanQ)}&limit=15`);
    if (Array.isArray(res) && res.length > 0) {
      const enriched = enrichCustomersWithPriceGroups(res);
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
 * Searches products/items from backend or local catalog as user types stock no, barcode, or name.
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
    const res = await apiFetchV1(`/inventory/products?q=${encodeURIComponent(cleanQ)}&limit=15`);
    if (Array.isArray(res) && res.length > 0) {
      const results = res.map(mapToProductResult);
      searchCache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    }
  } catch {
    // Backend offline
  }

  return [];
}

function mapToProductResult(p: any): AutoPopulateProductResult {
  return {
    id: p.id || p.code,
    code: p.code || p.sku || "",
    barcode: p.barcode || p.code || "",
    name: p.name || p.itemDescription || "Product Item",
    description: p.description || p.name || "",
    sellingPrice: Number(p.sellingPrice || p.price || p.rate || p.mrp || 0),
    mrp: Number(p.mrp || p.sellingPrice || 0),
    costPrice: Number(p.costPrice || p.purchasePrice || 0),
    gstPercentage: Number(p.gstPercentage || p.gstRate || 18),
    hsnCode: p.hsnCode || p.hsn || "6203",
    category: p.category || "Apparel",
    brand: p.brand,
    size: p.size,
    color: p.color,
    uom: p.uom || "Pcs",
    stockQty: Number(p.stockQty || p.stock || 0)
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
