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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { apiFetchV1 } from "../lib/apiFetchV1";
import { Customer, CustomerGroup, SalesInvoice, SalesReturn } from "../types";

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
    creditDays: 30,
    graceDays: 7,
    creditHold: false,
    autoBlockSales: true,
    warningThresholdPercent: 85,
    allowOverride: true,
    taxInclusive: false,
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

export const initialCustomers: Customer[] = [
  {
    id: "CUST-001",
    customerGroupId: "CG-Retail",
    name: "Rahul Sharma",
    mobile: "9876543210",
    email: "rahul.sharma@gmail.com",
    outstanding: 15000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["VIP", "Retail"],
  },
  {
    id: "CUST-002",
    customerGroupId: "CG-LargeRetail",
    name: "Super Textiles Ltd",
    mobile: "9988776655",
    email: "finance@supertextiles.com",
    gstNumber: "27AAACS1094J1Z3",
    outstanding: 450000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Wholesale", "Corporate"],
  },
  {
    id: "CUST-003",
    customerGroupId: "CG-Branches",
    name: "Branch - South Delhi",
    mobile: "9911223344",
    email: "southdelhi@smriti.com",
    outstanding: 0,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Internal", "Branch"],
  },
  {
    id: "CUST-004",
    customerGroupId: "CG-Franchises",
    name: "Franchise - Mumbai Central",
    mobile: "9922334455",
    email: "mumbaifranchise@smriti.com",
    outstanding: 120000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Franchise", "Premium"],
  },
  {
    id: "CUST-005",
    customerGroupId: "CG-LargeRetail",
    name: "Reliance Retail",
    mobile: "9822334455",
    email: "operations@relianceretail.com",
    gstNumber: "27AAACR1234F1Z1",
    outstanding: 180000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Wholesale", "Key-Account"],
  },
  {
    id: "CUST-006",
    customerGroupId: "CG-LargeRetail",
    name: "Shoppers Stop",
    mobile: "9833445566",
    email: "billing@shoppersstop.com",
    gstNumber: "27AAACS4321E1Z2",
    outstanding: 250000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Key-Account"],
  },
  {
    id: "CUST-007",
    customerGroupId: "CG-LargeRetail",
    name: "Lifestyle Stores",
    mobile: "9844556677",
    email: "accounts@lifestylestores.com",
    gstNumber: "27AAACL5678A1Z3",
    outstanding: 320000,
    status: "Active",
    createdDate: "2026-07-10",
    tags: ["Wholesale"],
  },
];

export const initialSalesInvoices: SalesInvoice[] = [
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

export const initialSalesReturns: SalesReturn[] = [
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

export function getSalesInvoices(): SalesInvoice[] {
  const saved = localStorage.getItem("smriti_sales_invoices");
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem("smriti_sales_invoices", JSON.stringify(initialSalesInvoices));
  return initialSalesInvoices;
}

export function saveSalesInvoices(invoices: SalesInvoice[]) {
  localStorage.setItem("smriti_sales_invoices", JSON.stringify(invoices));
}

export function getSalesReturns(): SalesReturn[] {
  const saved = localStorage.getItem("smriti_sales_returns");
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem("smriti_sales_returns", JSON.stringify(initialSalesReturns));
  return initialSalesReturns;
}

export function saveSalesReturns(returns: SalesReturn[]) {
  localStorage.setItem("smriti_sales_returns", JSON.stringify(returns));
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
  const saved = localStorage.getItem("smriti_customer_groups");
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem("smriti_customer_groups", JSON.stringify(initialCustomerGroups));
  return initialCustomerGroups;
}

export function getCustomers(): Customer[] {
  const saved = localStorage.getItem("smriti_customers");
  let customersList: Customer[] = [];
  if (saved) {
    customersList = JSON.parse(saved);
  } else {
    localStorage.setItem("smriti_customers", JSON.stringify(initialCustomers));
    customersList = initialCustomers;
  }

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
  localStorage.setItem("smriti_customers", JSON.stringify(customers));
  try {
    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
  } catch (e) {
    console.error("Failed to dispatch smriti_customer_updated event:", e);
  }
  // Persist to server asynchronously
  customers.forEach(cust => persistCustomerChange(cust));
}

export function saveCustomerGroups(groups: CustomerGroup[]) {
  localStorage.setItem("smriti_customer_groups", JSON.stringify(groups));
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

// ==========================================
// BACKEND SYNC AND OFFLINE CACHE ENGINES
// ==========================================
export async function persistCustomerChange(customer: Customer) {
  try {
    const res = await apiFetchV1(`/customers/${customer.id}`, {
      method: "PUT",
      body: JSON.stringify(customer)
    });
    if (!res) {
      await apiFetchV1("/customers", {
        method: "POST",
        body: JSON.stringify(customer)
      });
    }
  } catch (e) {
    console.warn("[CRM Sync] Server offline. Saving customer change to local pending queue.");
    try {
      const pending = JSON.parse(localStorage.getItem("smriti_pending_customers") || "[]");
      if (!pending.some((c: any) => c.id === customer.id)) {
        pending.push(customer);
        localStorage.setItem("smriti_pending_customers", JSON.stringify(pending));
      }
    } catch (err) {
      console.error("[CRM Sync] Failed to update pending queue:", err);
    }
  }
}

export async function syncPendingCustomers() {
  let pending: Customer[] = [];
  try {
    pending = JSON.parse(localStorage.getItem("smriti_pending_customers") || "[]");
  } catch (e) {
    return;
  }
  if (pending.length === 0) return;

  const remaining: Customer[] = [];
  for (const cust of pending) {
    try {
      await apiFetchV1(`/customers/${cust.id}`, {
        method: "PUT",
        body: JSON.stringify(cust)
      });
    } catch (e) {
      try {
        await apiFetchV1("/customers", {
          method: "POST",
          body: JSON.stringify(cust)
        });
      } catch (inner) {
        remaining.push(cust);
      }
    }
  }
  localStorage.setItem("smriti_pending_customers", JSON.stringify(remaining));
}

export async function syncCustomersWithBackend() {
  // Sync any pending edits first
  await syncPendingCustomers();

  try {
    const serverCustomers = await apiFetchV1("/customers");
    if (Array.isArray(serverCustomers) && serverCustomers.length > 0) {
      localStorage.setItem("smriti_customers", JSON.stringify(serverCustomers));
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    }
  } catch (e) {
    console.warn("[CRM Sync] Failed to sync customers from backend, using local cache:", e);
  }

  try {
    const serverGroups = await apiFetchV1("/customer-groups");
    if (Array.isArray(serverGroups) && serverGroups.length > 0) {
      localStorage.setItem("smriti_customer_groups", JSON.stringify(serverGroups));
    }
  } catch (e) {
    console.warn("[CRM Sync] Failed to sync customer groups from backend:", e);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncPendingCustomers();
  });
}

