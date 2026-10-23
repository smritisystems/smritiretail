/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.31.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-09-02
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { apiFetchV1 } from "../lib/apiFetchV1";
import { Customer, CustomerGroup, CustomerPriceGroup, SalesInvoice, SalesReturn } from "../types";
export type { CustomerGroup };

export const initialCustomerPriceGroups: CustomerPriceGroup[] = [
  {
    id: "CPP",
    code: "CPP",
    description: "Platinum Privilege",
    paymentTerms: "PT",
    creditDays: 60,
    destTaxType: "Local",
    creditLimit: 500000,
    itemClassificationPriceFactorApplicable: true,
    allowCreditInvoice: true,
    allowCashInvoice: true,
    taxExclusiveInvoice: false,
    allowMiscIssue: false,
    status: "Active",
    createdAt: "2026-07-10",
    modifiedAt: "2026-08-22"
  },
  {
    id: "TI",
    code: "TI",
    description: "Tech Infotech Ltd",
    paymentTerms: "Net 30",
    creditDays: 30,
    destTaxType: "Local",
    creditLimit: 250000,
    itemClassificationPriceFactorApplicable: false,
    allowCreditInvoice: true,
    allowCashInvoice: true,
    taxExclusiveInvoice: false,
    allowMiscIssue: false,
    status: "Active",
    createdAt: "2026-07-10",
    modifiedAt: "2026-08-22"
  },
  {
    id: "VIP",
    code: "VIP",
    description: "Platinum Retail",
    paymentTerms: "Immediate",
    creditDays: 0,
    destTaxType: "Local",
    creditLimit: 50000,
    itemClassificationPriceFactorApplicable: false,
    allowCreditInvoice: true,
    allowCashInvoice: true,
    taxExclusiveInvoice: false,
    allowMiscIssue: false,
    status: "Active",
    createdAt: "2026-07-10",
    modifiedAt: "2026-08-22"
  },
  {
    id: "CORP",
    code: "CORP",
    description: "Standard Corporate",
    paymentTerms: "Net 45",
    creditDays: 45,
    destTaxType: "Interstate",
    creditLimit: 1000000,
    itemClassificationPriceFactorApplicable: true,
    allowCreditInvoice: true,
    allowCashInvoice: true,
    taxExclusiveInvoice: true,
    allowMiscIssue: true,
    status: "Active",
    createdAt: "2026-07-10",
    modifiedAt: "2026-08-22"
  },
  {
    id: "RETAIL",
    code: "RETAIL",
    description: "Walk-In Standard",
    paymentTerms: "Immediate",
    creditDays: 0,
    destTaxType: "Local",
    creditLimit: 0,
    itemClassificationPriceFactorApplicable: false,
    allowCreditInvoice: false,
    allowCashInvoice: true,
    taxExclusiveInvoice: false,
    allowMiscIssue: false,
    status: "Active",
    createdAt: "2026-07-10",
    modifiedAt: "2026-08-22"
  }
];

export const initialCustomerGroups: CustomerGroup[] = [
  {
    id: "CG-Retail",
    name: "Retail Customers",
    creditLimit: 20000,
    unlimitedCredit: false,
    creditDays: 0,
    graceDays: 2,
    creditHold: false,
    autoBlockSales: true,
    warningThresholdPercent: 80,
    allowOverride: false,
    taxInclusive: true,
    defaultPricingBasis: "MRP",
    defaultAllowPromotionsOnRate: false,
    maxDiscountPercent: 10,
    minMarginPercent: 15,
    roundingRule: "Nearest1",
    allowedPaymentMethods: ["Cash", "UPI", "Card"],
    preferredPaymentMethod: "UPI",
    allowBackOrders: false,
    allowNegativeStockSales: false,
    requirePoNumber: false,
    invoiceLanguage: "en",
    canViewPrice: true,
    canViewMargin: false,
    canPurchaseOnCredit: false,
    canReceiveDiscount: true,
  },
  {
    id: "CG-Corporate",
    name: "Corporate Clients",
    creditLimit: 500000,
    unlimitedCredit: false,
    creditDays: 60,
    graceDays: 7,
    creditHold: false,
    autoBlockSales: true,
    warningThresholdPercent: 85,
    allowOverride: true,
    taxInclusive: false,
    defaultPricingBasis: "RATE",
    defaultAllowPromotionsOnRate: false,
    maxDiscountPercent: 20,
    minMarginPercent: 10,
    roundingRule: "None",
    allowedPaymentMethods: ["Cash", "UPI", "Card", "BankTransfer"],
    preferredPaymentMethod: "BankTransfer",
    allowBackOrders: true,
    allowNegativeStockSales: false,
    requirePoNumber: true,
    invoiceLanguage: "en",
    canViewPrice: true,
    canViewMargin: true,
    canPurchaseOnCredit: true,
    canReceiveDiscount: true,
  },
  {
    id: "CG-LargeRetail",
    name: "Large-Format Retail",
    creditLimit: 1000000,
    unlimitedCredit: false,
    creditDays: 60,
    graceDays: 15,
    creditHold: false,
    autoBlockSales: true,
    warningThresholdPercent: 90,
    allowOverride: true,
    taxInclusive: false,
    defaultPricingBasis: "MRP",
    defaultAllowPromotionsOnRate: false,
    maxDiscountPercent: 25,
    minMarginPercent: 8,
    roundingRule: "None",
    allowedPaymentMethods: ["BankTransfer", "Cheque"],
    preferredPaymentMethod: "BankTransfer",
    allowBackOrders: true,
    allowNegativeStockSales: true,
    requirePoNumber: true,
    invoiceLanguage: "en",
    canViewPrice: true,
    canViewMargin: true,
    canPurchaseOnCredit: true,
    canReceiveDiscount: true,
  },
  {
    id: "CG-Branches",
    name: "Internal Branches",
    creditLimit: 0,
    unlimitedCredit: true,
    creditDays: 90,
    graceDays: 30,
    creditHold: false,
    autoBlockSales: false,
    warningThresholdPercent: 95,
    allowOverride: true,
    taxInclusive: true,
    maxDiscountPercent: 0,
    minMarginPercent: 0,
    roundingRule: "Nearest1",
    allowedPaymentMethods: ["Cash", "UPI", "BankTransfer"],
    preferredPaymentMethod: "BankTransfer",
    allowBackOrders: true,
    allowNegativeStockSales: true,
    requirePoNumber: false,
    invoiceLanguage: "en",
    canViewPrice: true,
    canViewMargin: true,
    canPurchaseOnCredit: true,
    canReceiveDiscount: false,
  },
  {
    id: "CG-Franchises",
    name: "Franchise Partners",
    creditLimit: 300000,
    unlimitedCredit: false,
    creditDays: 45,
    graceDays: 10,
    creditHold: false,
    autoBlockSales: true,
    warningThresholdPercent: 80,
    allowOverride: true,
    taxInclusive: true,
    maxDiscountPercent: 15,
    minMarginPercent: 12,
    roundingRule: "Nearest1",
    allowedPaymentMethods: ["Cash", "UPI", "BankTransfer"],
    preferredPaymentMethod: "BankTransfer",
    allowBackOrders: true,
    allowNegativeStockSales: false,
    requirePoNumber: false,
    invoiceLanguage: "en",
    canViewPrice: true,
    canViewMargin: false,
    canPurchaseOnCredit: true,
    canReceiveDiscount: true,
  }
];

/**
 * initialCustomers — intentionally empty.
 *
 * PostgreSQL (via GET /api/v1/customers) is the single source of truth.
 * Boot-time hydration is performed by refreshCustomerCache() called from App.tsx.
 * PostgreSQL is the source of truth; customer fallback data is cached only
 * in the current browser tab and expires after 15 minutes.
 *
 * DO NOT add hardcoded records here — they will conflict with live DB data.
 */
export const initialCustomers: Customer[] = [];

export const initialSalesInvoices: SalesInvoice[] = [];

const CUSTOMER_SESSION_CACHE_KEY = "smriti_customer_session_cache";
const CUSTOMER_PENDING_SESSION_KEY = "smriti_pending_customer_session";
const CUSTOMER_SESSION_CACHE_TTL_MS = 15 * 60 * 1000;

function readCustomerSessionCache(): Customer[] {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return [];
  try {
    localStorage.removeItem("smriti_customers");
    localStorage.removeItem("smriti_retail_customers");
    const raw = sessionStorage.getItem(CUSTOMER_SESSION_CACHE_KEY);
    if (!raw) return [];
    const cache = JSON.parse(raw) as { expiresAt?: number; customers?: Customer[] };
    if (!cache.expiresAt || cache.expiresAt <= Date.now() || !Array.isArray(cache.customers)) {
      sessionStorage.removeItem(CUSTOMER_SESSION_CACHE_KEY);
      return [];
    }
    return cache.customers;
  } catch {
    try { sessionStorage.removeItem(CUSTOMER_SESSION_CACHE_KEY); } catch {}
    return [];
  }
}

function writeCustomerSessionCache<T extends { id: string; name: string }>(customers: T[]): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  try {
    localStorage.removeItem("smriti_customers");
    localStorage.removeItem("smriti_retail_customers");
    const safeCustomers = customers.map(customer => {
      const source = customer as unknown as Record<string, any>;
      return {
        id: source.id,
        customerGroupId: source.customerGroupId || source.customer_group_id || "",
        name: source.name,
        mobile: source.mobile || source.phone || "",
        phone: source.phone,
        email: source.email,
        gstNumber: source.gstNumber || source.gstin,
        code: source.code,
        creditLimit: source.creditLimit,
        creditLimitOverride: source.creditLimitOverride,
        creditDays: source.creditDays,
        unlimitedCredit: source.unlimitedCredit,
        creditHold: source.creditHold,
        isTaxInclusive: source.isTaxInclusive ?? source.is_tax_inclusive,
        pricingBasis: source.pricingBasis || source.pricing_basis,
        allowPromotionsOnRate: source.allowPromotionsOnRate ?? source.allow_promotions_on_rate,
        outstanding: source.outstanding ?? source.creditUsed ?? source.creditBalance,
        status: source.status || "Active",
        loyaltyMember: source.loyaltyMember,
        loyaltyTier: source.loyaltyTier,
        loyaltyPointsBalance: source.loyaltyPointsBalance ?? source.loyalty_points_balance,
      };
    });
    sessionStorage.setItem(CUSTOMER_SESSION_CACHE_KEY, JSON.stringify({
      expiresAt: Date.now() + CUSTOMER_SESSION_CACHE_TTL_MS,
      customers: safeCustomers
    }));
  } catch {}
}

export function cacheCustomersSession<T extends { id: string; name: string }>(customers: T[]): void {
  writeCustomerSessionCache(customers);
}

export function clearCustomerSessionCache(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(CUSTOMER_SESSION_CACHE_KEY); } catch {}
  try { sessionStorage.removeItem(CUSTOMER_PENDING_SESSION_KEY); } catch {}
  try { localStorage.removeItem("smriti_customers"); } catch {}
  try { localStorage.removeItem("smriti_retail_customers"); } catch {}
}
/* Legacy demo invoice fixtures removed from the live data path.
export const legacyDemoSalesInvoices: SalesInvoice[] = [
  {
    id: "SINV-001",
    invoiceNo: "SINV-2026-0001",
    date: "2026-07-08",
    customerId: "CUST-001",
    taxTotal: 3050,
    grandTotal: 20000,
    isInterstate: false,
    status: "Approved",
    items: [
      {
        productId: "PROD-001",
        code: "SKU-001",
        name: "Premium Cotton Shirt",
        quantity: 10,
        price: 1695,
        hsnCode: "6205",
        gstRate: 18,
        taxAmount: 3050,
        totalAmount: 20000
      }
    ]
  },
  {
    id: "SINV-002",
    invoiceNo: "SINV-2026-0002",
    date: "2026-07-05",
    customerId: "CUST-002",
    taxTotal: 76270,
    grandTotal: 500000,
    isInterstate: true,
    status: "Approved",
    items: [
      {
        productId: "PROD-002",
        code: "SKU-002",
        name: "Designer Denim Jacket",
        quantity: 100,
        price: 4237,
        hsnCode: "6203",
        gstRate: 18,
        taxAmount: 76270,
        totalAmount: 500000
      }
    ]
  },
  {
    id: "SINV-003",
    invoiceNo: "SINV-2026-0003",
    date: "2026-07-06",
    customerId: "CUST-003",
    taxTotal: 2288,
    grandTotal: 15000,
    isInterstate: false,
    status: "Approved",
    items: [
      {
        productId: "PROD-001",
        code: "SKU-001",
        name: "Premium Cotton Shirt",
        quantity: 10,
        price: 1271,
        hsnCode: "6205",
        gstRate: 18,
        taxAmount: 2288,
        totalAmount: 15000
      }
    ]
  },
  {
    id: "SINV-004",
    invoiceNo: "SINV-2026-0004",
    date: "2026-07-06",
    customerId: "CUST-004",
    taxTotal: 18305,
    grandTotal: 120000,
    isInterstate: false,
    status: "Approved",
    items: [
      {
        productId: "PROD-003",
        code: "SKU-003",
        name: "Casual Summer Dress",
        quantity: 60,
        price: 1695,
        hsnCode: "6204",
        gstRate: 18,
        taxAmount: 18305,
        totalAmount: 120000
      }
    ]
  },
  {
    id: "SINV-005",
    invoiceNo: "SINV-2026-0005",
    date: "2026-07-07",
    customerId: "CUST-005",
    taxTotal: 27458,
    grandTotal: 180000,
    isInterstate: true,
    status: "Approved",
    items: [
      {
        productId: "PROD-002",
        code: "SKU-002",
        name: "Designer Denim Jacket",
        quantity: 40,
        price: 3814,
        hsnCode: "6203",
        gstRate: 18,
        taxAmount: 27458,
        totalAmount: 180000
      }
    ]
  },
  {
    id: "SINV-006",
    invoiceNo: "SINV-2026-0006",
    date: "2026-07-08",
    customerId: "CUST-006",
    taxTotal: 38136,
    grandTotal: 250000,
    isInterstate: true,
    status: "Approved",
    items: [
      {
        productId: "PROD-003",
        code: "SKU-003",
        name: "Casual Summer Dress",
        quantity: 125,
        price: 1695,
        hsnCode: "6204",
        gstRate: 18,
        taxAmount: 38136,
        totalAmount: 250000
      }
    ]
  },
  {
    id: "SINV-007",
    invoiceNo: "SINV-2026-0007",
    date: "2026-07-09",
    customerId: "CUST-007",
    taxTotal: 48814,
    grandTotal: 320000,
    isInterstate: true,
    status: "Approved",
    items: [
      {
        productId: "PROD-001",
        code: "SKU-001",
        name: "Premium Cotton Shirt",
        quantity: 200,
        price: 1356,
        hsnCode: "6205",
        gstRate: 18,
        taxAmount: 48814,
        totalAmount: 320000
      }
    ]
  }
];
*/

export const initialSalesReturns: SalesReturn[] = [];
/* Legacy demo return fixtures removed from the live data path.
export const legacyDemoSalesReturns: SalesReturn[] = [
  {
    id: "SRET-001",
    returnNo: "SRET-2026-0001",
    originalInvoiceId: "SINV-001",
    creditNoteNumber: "CN-2026-0001",
    date: "2026-07-09",
    reason: "Fitting issues",
    taxTotal: 763,
    grandTotal: 5000,
    isInterstate: false,
    status: "Approved",
    items: [
      {
        productId: "PROD-001",
        quantity: 2,
        price: 2119,
        gstRate: 18,
        taxAmount: 763,
        totalAmount: 5000
      }
    ]
  },
  {
    id: "SRET-002",
    returnNo: "SRET-2026-0002",
    originalInvoiceId: "SINV-002",
    creditNoteNumber: "CN-2026-0002",
    date: "2026-07-07",
    reason: "Fabric defect on 10 jackets",
    taxTotal: 7627,
    grandTotal: 50000,
    isInterstate: true,
    status: "Approved",
    items: [
      {
        productId: "PROD-002",
        quantity: 10,
        price: 4237,
        gstRate: 18,
        taxAmount: 7627,
        totalAmount: 50000
      }
    ]
  },
  {
    id: "SRET-003",
    returnNo: "SRET-2026-0003",
    originalInvoiceId: "SINV-003",
    creditNoteNumber: "CN-2026-0003",
    date: "2026-07-07",
    reason: "Excess stock return",
    taxTotal: 2288,
    grandTotal: 15000,
    isInterstate: false,
    status: "Approved",
    items: [
      {
        productId: "PROD-001",
        quantity: 10,
        price: 1271,
        gstRate: 18,
        taxAmount: 2288,
        totalAmount: 15000
      }
    ]
  }
];
*/

export function getSalesInvoices(): SalesInvoice[] {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("smriti_sales_invoices");
    if (saved) {
      return JSON.parse(saved);
    }
  }
  return [];
}

export function saveSalesInvoices(invoices: SalesInvoice[]) {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.setItem("smriti_sales_invoices", JSON.stringify(invoices));
  }
}

export function getSalesReturns(): SalesReturn[] {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("smriti_sales_returns");
    if (saved) {
      return JSON.parse(saved);
    }
  }
  return [];
}

export function saveSalesReturns(returns: SalesReturn[]) {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.setItem("smriti_sales_returns", JSON.stringify(returns));
  }
}

export function addSalesInvoice(inv: SalesInvoice) {
  const list = getSalesInvoices();
  list.push(inv);
  saveSalesInvoices(list);
}

export function addSalesReturn(ret: SalesReturn) {
  const list = getSalesReturns();
  list.push(ret);
  saveSalesReturns(list);
}

export function getCustomerGroups(): CustomerGroup[] {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("smriti_customer_groups");
    if (saved) {
      return JSON.parse(saved);
    }
    localStorage.setItem("smriti_customer_groups", JSON.stringify(initialCustomerGroups));
  }
  return initialCustomerGroups;
}

export function getCustomers(): Customer[] {
  // Same-tab fallback only; backend data remains authoritative.
  const customersList = readCustomerSessionCache();

  // Live-compute outstanding balances based on invoices and returns
  const invoices = getSalesInvoices();
  const returns = getSalesReturns();

  return customersList.map(cust => {
    const custInvoices = invoices.filter(inv => inv.customerId === cust.id && (inv.status === "Approved" || inv.status === "Submitted"));
    const custReturns = returns.filter(ret => {
      const originalInv = invoices.find(inv => inv.id === ret.originalInvoiceId);
      return originalInv?.customerId === cust.id && (ret.status === "Approved" || ret.status === "Submitted");
    });

    const totalInvoiceAmt = custInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalReturnAmt = custReturns.reduce((sum, ret) => sum + ret.grandTotal, 0);
    const liveOutstanding = totalInvoiceAmt - totalReturnAmt;

    return {
      ...cust,
      outstanding: liveOutstanding
    };
  });
}

export function saveCustomers(customers: Customer[]) {
  // Updates a short-lived same-tab fallback only. Does NOT fire backend requests.
  // For backend writes, use CustMasterWs.handleSave() → POST/PUT /api/v1/customers.
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    writeCustomerSessionCache(customers);
    try {
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    } catch (e) {
      console.error("[CRM] Failed to dispatch smriti_customer_updated:", e);
    }
  }
}

export function saveCustomerGroups(groups: CustomerGroup[]) {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.setItem("smriti_customer_groups", JSON.stringify(groups));
  }
}

export function getCustomerPriceGroups(): CustomerPriceGroup[] {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("smriti_customer_price_groups");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    localStorage.setItem("smriti_customer_price_groups", JSON.stringify(initialCustomerPriceGroups));
  }
  return initialCustomerPriceGroups;
}

export function saveCustomerPriceGroups(groups: CustomerPriceGroup[]) {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.setItem("smriti_customer_price_groups", JSON.stringify(groups));
    try {
      window.dispatchEvent(new CustomEvent("smriti_customer_price_groups_updated"));
    } catch (e) {
      console.error("Failed to dispatch smriti_customer_price_groups_updated event:", e);
    }
  }
}


export function addCustomerPriceGroup(group: CustomerPriceGroup): CustomerPriceGroup[] {
  const list = getCustomerPriceGroups();
  const existingIdx = list.findIndex(g => g.code.toUpperCase() === group.code.toUpperCase());
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...group, modifiedAt: new Date().toISOString() };
  } else {
    list.push({ ...group, createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() });
  }
  saveCustomerPriceGroups(list);
  return getCustomerPriceGroups();
}

export function updateCustomerPriceGroup(code: string, updates: Partial<CustomerPriceGroup>): CustomerPriceGroup[] {
  const list = getCustomerPriceGroups();
  const updated = list.map(g => g.code.toUpperCase() === code.toUpperCase() ? { ...g, ...updates, modifiedAt: new Date().toISOString() } : g);
  saveCustomerPriceGroups(updated);
  return getCustomerPriceGroups();
}

export function deleteCustomerPriceGroup(code: string): CustomerPriceGroup[] {
  const list = getCustomerPriceGroups();
  const filtered = list.filter(g => g.code.toUpperCase() !== code.toUpperCase());
  saveCustomerPriceGroups(filtered);
  return getCustomerPriceGroups();
}


export function updateCustomerStatus(
  customerId: string,
  status: "Active" | "Inactive" | "Blocked"
): Customer[] {
  const list = getCustomers();
  const updated = list.map((c) => (c.id === customerId ? { ...c, status } : c));
  saveCustomers(updated);
  return getCustomers(); // Return refreshed with live values
}

export function updateCustomerOutstanding(
  customerId: string,
  newOutstanding: number
): Customer[] {
  const list = getCustomers();
  const updated = list.map((c) => (c.id === customerId ? { ...c, outstanding: newOutstanding } : c));
  saveCustomers(updated);
  return getCustomers(); // Return refreshed with live values
}

export function updateCustomerTags(
  customerId: string,
  tags: string[]
): Customer[] {
  const list = getCustomers();
  const updated = list.map((c) => (c.id === customerId ? { ...c, tags } : c));
  saveCustomers(updated);
  return getCustomers(); // Return refreshed with live values
}

function formatCustomerForApi(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    mobile: c.mobile || undefined,
    email: c.email || undefined,
    gst_number: c.gstNumber || undefined,
    customer_group_id: c.customerGroupId || undefined,
    code: c.code || undefined,
    outstanding: c.outstanding || 0,
    status: c.status || "Active",
    tags: Array.isArray(c.tags) ? c.tags : [],
  };
}

// ==========================================
// BACKEND SYNC AND OFFLINE CACHE ENGINES
// ==========================================
export async function persistCustomerChange(customer: Customer) {
  try {
    const payload = formatCustomerForApi(customer);
    await apiFetchV1(`/crm/customers/${customer.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  } catch (e) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CUSTOMER_PENDING_SESSION_KEY) || "{}");
      const pending = cached.expiresAt > Date.now() && Array.isArray(cached.customers) ? cached.customers : [];
      if (!pending.some((c: any) => c.id === customer.id)) {
        pending.push(customer);
      }
      sessionStorage.setItem(CUSTOMER_PENDING_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + CUSTOMER_SESSION_CACHE_TTL_MS, customers: pending }));
    } catch (err) {
      console.error("[CRM Sync] Failed to update pending queue:", err);
    }
  }
}

export async function syncPendingCustomers() {
  let pending: Customer[] = [];
  try {
    const cached = JSON.parse(sessionStorage.getItem(CUSTOMER_PENDING_SESSION_KEY) || "{}");
    pending = cached.expiresAt > Date.now() && Array.isArray(cached.customers) ? cached.customers : [];
  } catch (e) {
    return;
  }
  if (pending.length === 0) return;

  const remaining: Customer[] = [];
  for (const cust of pending) {
    try {
      const payload = formatCustomerForApi(cust);
      await apiFetchV1(`/crm/customers/${cust.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } catch (e) {
      remaining.push(cust);
    }
  }
  if (remaining.length) sessionStorage.setItem(CUSTOMER_PENDING_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + CUSTOMER_SESSION_CACHE_TTL_MS, customers: remaining }));
  else sessionStorage.removeItem(CUSTOMER_PENDING_SESSION_KEY);
}

/**
 * refreshCustomerCache — canonical boot-time hydration function.
 *
 * Call this once after authentication is confirmed (App.tsx).
 * Fetches customers into a same-tab fallback cache that expires after
 * 15 minutes and is removed when the authenticated session is cleared.
 *
 * Also flushes any pending offline edits before fetching.
 */
export async function refreshCustomerCache(): Promise<void> {
  // 1. Flush pending offline edits first
  await syncPendingCustomers();

  // 2. Hydrate customer list from backend
  try {
    const serverCustomers = await apiFetchV1("/crm/customers");
    if (Array.isArray(serverCustomers)) {
      writeCustomerSessionCache(serverCustomers);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
      }
    }
  } catch (e) {
    console.warn("[CRM] refreshCustomerCache: backend unreachable, serving cached data.", e);
  }

  // 3. Hydrate customer groups from backend
  try {
    const serverGroups = await apiFetchV1("/crm/customer-groups");
    if (Array.isArray(serverGroups) && serverGroups.length > 0) {
      localStorage.setItem("smriti_customer_groups", JSON.stringify(serverGroups));
    }
  } catch (e) {
    console.warn("[CRM] refreshCustomerCache: customer-groups fetch failed.", e);
  }
}

/** @deprecated Use refreshCustomerCache() instead. Kept for backward compatibility. */
export async function syncCustomersWithBackend() {
  return refreshCustomerCache();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncPendingCustomers();
  });
}

