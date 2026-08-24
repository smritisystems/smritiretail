/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * FieldContextRegistry
 * ====================
 * Centralised, authoritative configuration for every searchable entity context
 * in SMRITI Retail OS.
 *
 * Adding a NEW context (e.g. Warehouse, Salesperson) requires ONLY adding one
 * entry here — no new modal, no new search logic, no new grid component.
 *
 * Architecture:
 *   ActiveFieldContext.tsx → infers contextType from focused input
 *   FieldContextRegistry   → provides columns, fetcher, insert-key for that type
 *   GlobalSearchService.ts → uses fetcher + debounce to load results
 *   FlexContextGrid.tsx → renders columns + handles keyboard/selection
 */

import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getCustomers } from "../customerStore.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityContextType =
  | "product"
  | "customer"
  | "supplier"
  | "salesperson"
  | "warehouse"
  | "invoice"
  | "hsn"
  | "general";

export interface FlexibleGridColumn {
  /** Unique key within this context */
  id: string;
  /** Display header label */
  label: string;
  /** Width class (Tailwind) */
  width?: string;
  /** How to extract a display value from the row object */
  accessor: (row: any) => string | number | null | undefined;
  /** Optional text alignment */
  align?: "left" | "right" | "center";
  /** Visual emphasis style */
  style?: "mono" | "bold" | "muted" | "price" | "badge-green" | "badge-amber" | "badge-red";
}

export interface FieldContextDescriptor {
  /** Entity type key */
  entityType: EntityContextType;
  /** Human-readable label */
  label: string;
  /** Material Symbols icon name */
  icon: string;
  /** Short description for the search panel subtitle */
  description: string;
  /** Placeholder text for the search input */
  searchPlaceholder: string;
  /**
   * Which field from the result object should be injected into the active
   * input when the user selects a row. Can be an ordered fallback chain.
   */
  insertValueKeys: string[];
  /** Column definitions for the FlexibleContextGrid */
  columns: FlexibleGridColumn[];
  /**
   * Data fetcher — called by GlobalSearchService with the debounced query.
   * Should return an array of plain objects.
   * Should be tolerant of empty query (return top-N records in that case).
   */
  fetcher: (query: string, signal?: AbortSignal) => Promise<any[]>;
  /**
   * Optional client-side quick-filter for instant filtering on already-loaded data.
   * Used by GlobalSearchService to filter the cache before a network call completes.
   */
  localFilter?: (items: any[], query: string) => any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Descriptors
// ─────────────────────────────────────────────────────────────────────────────

const productContext: FieldContextDescriptor = {
  entityType: "product",
  label: "Scan / Product Catalog",
  icon: "barcode_scanner",
  description: "Live product catalog — stock, MRP, cost price, HSN, and dynamic attributes.",
  searchPlaceholder: "Search by Item Name, Barcode, SKU, Brand, Fabric, Color, Style...",
  insertValueKeys: ["barcode", "code", "name"],
  columns: [
    {
      id: "code",
      label: "Stock No",
      width: "w-24",
      accessor: (r) => r.code,
      style: "mono",
    },
    {
      id: "barcode",
      label: "Barcode",
      width: "w-32",
      accessor: (r) => r.barcode,
      style: "mono",
    },
    {
      id: "name",
      label: "Product Name",
      accessor: (r) => r.name,
      style: "bold",
    },
    {
      id: "brand",
      label: "Brand",
      width: "w-24",
      accessor: (r) => r.brand || "—",
    },
    {
      id: "color",
      label: "Shade",
      width: "w-20",
      accessor: (r) => r.color || "—",
    },
    {
      id: "size",
      label: "Size",
      width: "w-14",
      accessor: (r) => r.size || "—",
      align: "center",
    },
    {
      id: "mrp",
      label: "MRP",
      width: "w-22",
      accessor: (r) => (r.mrp || r.price || 0),
      align: "right",
      style: "price",
    },
    {
      id: "price",
      label: "Selling Price",
      width: "w-24",
      accessor: (r) => r.price || 0,
      align: "right",
      style: "price",
    },
    {
      id: "stock",
      label: "Stock",
      width: "w-16",
      accessor: (r) => r.stock ?? 0,
      align: "center",
      style: "mono",
    },
  ],
  fetcher: async (query, signal) => {
    try {
      const data = await apiFetchV1("/products");
      if (!Array.isArray(data)) return [];
      if (!query.trim()) return data.slice(0, 50);
      const q = query.toLowerCase();
      return data.filter(
        (p: any) =>
          p.name?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.color?.toLowerCase().includes(q) ||
          p.size?.toLowerCase().includes(q) ||
          p.styleCode?.toLowerCase().includes(q) ||
          p.hsnCode?.toLowerCase().includes(q)
      );
    } catch {
      return [];
    }
  },
  localFilter: (items, query) => {
    if (!query.trim()) return items.slice(0, 50);
    const q = query.toLowerCase();
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.color?.toLowerCase().includes(q) ||
        p.size?.toLowerCase().includes(q) ||
        p.styleCode?.toLowerCase().includes(q)
    );
  },
};

const customerContext: FieldContextDescriptor = {
  entityType: "customer",
  label: "Customer / Client Registry",
  icon: "person_search",
  description: "Customer directory — loyalty points, credit limits, outstanding balance, GSTIN.",
  searchPlaceholder: "Search by Name, Mobile (+91), GSTIN, Email, Customer Code...",
  insertValueKeys: ["name", "mobile", "id"],
  columns: [
    {
      id: "code",
      label: "Cust. Code",
      width: "w-24",
      accessor: (r) => r.code || r.id,
      style: "mono",
    },
    {
      id: "name",
      label: "Customer Name",
      accessor: (r) => r.name,
      style: "bold",
    },
    {
      id: "mobile",
      label: "Mobile",
      width: "w-28",
      accessor: (r) => r.mobile || r.phone || "—",
      style: "mono",
    },
    {
      id: "email",
      label: "Email",
      width: "w-36",
      accessor: (r) => r.email || "—",
      style: "muted",
    },
    {
      id: "gstin",
      label: "GSTIN",
      width: "w-36",
      accessor: (r) => r.gstNumber || r.gstin || "—",
      style: "mono",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      width: "w-24",
      accessor: (r) => r.outstanding || 0,
      align: "right",
      style: "price",
    },
    {
      id: "creditLimit",
      label: "Credit Limit",
      width: "w-24",
      accessor: (r) => r.creditLimit || 0,
      align: "right",
      style: "price",
    },
  ],
  fetcher: async (query, _signal) => {
    // 1. Try local store first (instant)
    try {
      const local = getCustomers();
      if (local && local.length > 0) {
        if (!query.trim()) return local.slice(0, 50);
        const q = query.toLowerCase();
        return local.filter(
          (c: any) =>
            c.name?.toLowerCase().includes(q) ||
            c.mobile?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.gstNumber?.toLowerCase().includes(q) ||
            c.gstin?.toLowerCase().includes(q) ||
            c.code?.toLowerCase().includes(q) ||
            c.id?.toLowerCase().includes(q)
        );
      }
    } catch {
      // fall through to API
    }
    // 2. Fallback to API
    try {
      const data = await apiFetchV1("/customers");
      if (!Array.isArray(data)) return [];
      if (!query.trim()) return data.slice(0, 50);
      const q = query.toLowerCase();
      return data.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(q) ||
          c.mobile?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.gstNumber?.toLowerCase().includes(q)
      );
    } catch {
      return [];
    }
  },
  localFilter: (items, query) => {
    if (!query.trim()) return items.slice(0, 50);
    const q = query.toLowerCase();
    return items.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.mobile?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.gstNumber?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q)
    );
  },
};

const supplierContext: FieldContextDescriptor = {
  entityType: "supplier",
  label: "Supplier / Vendor Registry",
  icon: "local_shipping",
  description: "Vendor master — GSTIN, credit terms, pending PO balances, last purchase rates.",
  searchPlaceholder: "Search by Supplier Name, Code, GSTIN, Mobile, City...",
  insertValueKeys: ["name", "code", "id"],
  columns: [
    {
      id: "code",
      label: "Supplier Code",
      width: "w-28",
      accessor: (r) => r.code || r.id,
      style: "mono",
    },
    {
      id: "name",
      label: "Supplier Name",
      accessor: (r) => r.name || r.company_name,
      style: "bold",
    },
    {
      id: "mobile",
      label: "Mobile",
      width: "w-28",
      accessor: (r) => r.mobile || r.phone || r.contact_phone || "—",
      style: "mono",
    },
    {
      id: "gstin",
      label: "GSTIN",
      width: "w-36",
      accessor: (r) => r.gstin || r.gst_number || "—",
      style: "mono",
    },
    {
      id: "city",
      label: "City",
      width: "w-24",
      accessor: (r) => r.city || r.billing_city || "—",
    },
    {
      id: "creditDays",
      label: "Credit Days",
      width: "w-24",
      accessor: (r) => r.credit_days ?? r.creditDays ?? "—",
      align: "center",
    },
  ],
  fetcher: async (query, _signal) => {
    // Try both conventional endpoint paths — backend may expose either
    for (const endpoint of ["/suppliers", "/purchase/suppliers"]) {
      try {
        const data = await apiFetchV1(endpoint);
        if (Array.isArray(data)) {
          if (!query.trim()) return data.slice(0, 50);
          const q = query.toLowerCase();
          return data.filter(
            (s: any) =>
              s.name?.toLowerCase().includes(q) ||
              s.company_name?.toLowerCase().includes(q) ||
              s.code?.toLowerCase().includes(q) ||
              s.gstin?.toLowerCase().includes(q) ||
              s.mobile?.toLowerCase().includes(q) ||
              s.city?.toLowerCase().includes(q)
          );
        }
      } catch {
        continue;
      }
    }
    return [];
  },
};

const salespersonContext: FieldContextDescriptor = {
  entityType: "salesperson",
  label: "Salesperson / Staff",
  icon: "badge",
  description: "Staff directory — roles, targets, assigned counters.",
  searchPlaceholder: "Search by Staff Name, Employee Code, Role...",
  insertValueKeys: ["name", "code", "id"],
  columns: [
    {
      id: "code",
      label: "Employee Code",
      width: "w-28",
      accessor: (r) => r.code || r.employee_code || r.id,
      style: "mono",
    },
    {
      id: "name",
      label: "Name",
      accessor: (r) => r.name || r.full_name,
      style: "bold",
    },
    {
      id: "role",
      label: "Role",
      width: "w-28",
      accessor: (r) => r.role || r.designation || "—",
    },
    {
      id: "mobile",
      label: "Mobile",
      width: "w-28",
      accessor: (r) => r.mobile || r.phone || "—",
      style: "mono",
    },
  ],
  fetcher: async (query, _signal) => {
    for (const endpoint of ["/staff", "/users", "/salespersons"]) {
      try {
        const data = await apiFetchV1(endpoint);
        if (Array.isArray(data)) {
          if (!query.trim()) return data.slice(0, 30);
          const q = query.toLowerCase();
          return data.filter(
            (s: any) =>
              s.name?.toLowerCase().includes(q) ||
              s.full_name?.toLowerCase().includes(q) ||
              s.code?.toLowerCase().includes(q) ||
              s.role?.toLowerCase().includes(q)
          );
        }
      } catch {
        continue;
      }
    }
    return [];
  },
};

const warehouseContext: FieldContextDescriptor = {
  entityType: "warehouse",
  label: "Warehouse / Location",
  icon: "warehouse",
  description: "Warehouse and branch locations — stock levels and bin addresses.",
  searchPlaceholder: "Search by Warehouse Name, Code, City...",
  insertValueKeys: ["name", "code", "id"],
  columns: [
    {
      id: "code",
      label: "WH Code",
      width: "w-24",
      accessor: (r) => r.code || r.id,
      style: "mono",
    },
    {
      id: "name",
      label: "Warehouse Name",
      accessor: (r) => r.name,
      style: "bold",
    },
    {
      id: "city",
      label: "City",
      width: "w-24",
      accessor: (r) => r.city || "—",
    },
    {
      id: "type",
      label: "Type",
      width: "w-20",
      accessor: (r) => r.type || r.warehouse_type || "—",
    },
  ],
  fetcher: async (query, _signal) => {
    try {
      const data = await apiFetchV1("/warehouses");
      if (!Array.isArray(data)) return [];
      if (!query.trim()) return data.slice(0, 30);
      const q = query.toLowerCase();
      return data.filter(
        (w: any) =>
          w.name?.toLowerCase().includes(q) ||
          w.code?.toLowerCase().includes(q) ||
          w.city?.toLowerCase().includes(q)
      );
    } catch {
      return [];
    }
  },
};

const invoiceContext: FieldContextDescriptor = {
  entityType: "invoice",
  label: "Invoice / Document Lookup",
  icon: "receipt_long",
  description: "Historical tax invoices, purchase orders, credit notes — search by number or date.",
  searchPlaceholder: "Search by Invoice No, Customer Name, Date, Amount...",
  insertValueKeys: ["invoice_number", "id"],
  columns: [
    {
      id: "invoice_number",
      label: "Invoice No",
      width: "w-32",
      accessor: (r) => r.invoice_number || r.bill_no || r.id,
      style: "mono",
    },
    {
      id: "customer_name",
      label: "Customer",
      accessor: (r) => r.customer_name || r.party_name || "—",
      style: "bold",
    },
    {
      id: "date",
      label: "Date",
      width: "w-24",
      accessor: (r) => r.invoice_date || r.date || "—",
    },
    {
      id: "total",
      label: "Net Amount",
      width: "w-24",
      accessor: (r) => r.total_amount || r.net_amount || 0,
      align: "right",
      style: "price",
    },
    {
      id: "status",
      label: "Status",
      width: "w-20",
      accessor: (r) => r.status || "—",
    },
  ],
  fetcher: async (query, _signal) => {
    try {
      const endpoint = query.trim()
        ? `/sales/invoices?search=${encodeURIComponent(query)}&limit=30`
        : "/sales/invoices?limit=30";
      const data = await apiFetchV1(endpoint);
      if (Array.isArray(data)) return data;
      if (data?.items && Array.isArray(data.items)) return data.items;
      return [];
    } catch {
      return [];
    }
  },
};

const hsnContext: FieldContextDescriptor = {
  entityType: "hsn",
  label: "HSN / SAC Code Lookup",
  icon: "account_balance",
  description: "GST HSN / SAC codes — tax rates and commodity descriptions.",
  searchPlaceholder: "Search by HSN Code, Description, GST Rate...",
  insertValueKeys: ["code", "id"],
  columns: [
    {
      id: "code",
      label: "HSN Code",
      width: "w-28",
      accessor: (r) => r.code || r.hsn_code,
      style: "mono",
    },
    {
      id: "description",
      label: "Description",
      accessor: (r) => r.description || r.commodity_name || "—",
      style: "bold",
    },
    {
      id: "gst_rate",
      label: "GST Rate",
      width: "w-20",
      accessor: (r) => r.gst_rate != null ? `${r.gst_rate}%` : "—",
      align: "center",
    },
    {
      id: "igst_rate",
      label: "IGST",
      width: "w-16",
      accessor: (r) => r.igst_rate != null ? `${r.igst_rate}%` : "—",
      align: "center",
    },
  ],
  fetcher: async (query, _signal) => {
    try {
      const endpoint = query.trim()
        ? `/hsn-codes?search=${encodeURIComponent(query)}&limit=30`
        : "/hsn-codes?limit=30";
      const data = await apiFetchV1(endpoint);
      if (Array.isArray(data)) return data;
      if (data?.items && Array.isArray(data.items)) return data.items;
      return [];
    } catch {
      return [];
    }
  },
};

const generalContext: FieldContextDescriptor = {
  entityType: "general",
  label: "Global Search",
  icon: "travel_explore",
  description: "Search across all entities — products, customers, suppliers, invoices.",
  searchPlaceholder: "Search anything — products, customers, invoices, barcodes...",
  insertValueKeys: ["name", "id"],
  columns: [
    {
      id: "entity",
      label: "Type",
      width: "w-20",
      accessor: (r) => r._entityType || "—",
    },
    {
      id: "name",
      label: "Name / Description",
      accessor: (r) => r.name || r.invoice_number || r.code || "—",
      style: "bold",
    },
    {
      id: "detail",
      label: "Detail",
      accessor: (r) => r.code || r.mobile || r.barcode || "—",
      style: "mono",
    },
  ],
  fetcher: async (query, _signal) => {
    // General context runs a combined search — returns mixed array tagged with _entityType
    if (!query.trim()) return [];
    const results: any[] = [];
    await Promise.allSettled([
      productContext.fetcher(query).then((items) =>
        items.slice(0, 10).forEach((i) => results.push({ ...i, _entityType: "Product" }))
      ),
      customerContext.fetcher(query).then((items) =>
        items.slice(0, 10).forEach((i) => results.push({ ...i, _entityType: "Customer" }))
      ),
    ]);
    return results;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry Map (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

export const FIELD_CONTEXT_REGISTRY: Record<EntityContextType, FieldContextDescriptor> = {
  product: productContext,
  customer: customerContext,
  supplier: supplierContext,
  salesperson: salespersonContext,
  warehouse: warehouseContext,
  invoice: invoiceContext,
  hsn: hsnContext,
  general: generalContext,
};

/**
 * Convenience accessor — returns the descriptor for a given entity type,
 * falling back to the general descriptor if the type is not registered.
 */
export function getContextDescriptor(entityType: EntityContextType): FieldContextDescriptor {
  return FIELD_CONTEXT_REGISTRY[entityType] ?? FIELD_CONTEXT_REGISTRY["general"];
}

/**
 * Returns an ordered list of all named entity tabs (excludes 'general' which
 * is always rendered as the "All" tab).
 */
export function getEntityTabs(): FieldContextDescriptor[] {
  return [
    FIELD_CONTEXT_REGISTRY["product"],
    FIELD_CONTEXT_REGISTRY["customer"],
    FIELD_CONTEXT_REGISTRY["supplier"],
    FIELD_CONTEXT_REGISTRY["salesperson"],
    FIELD_CONTEXT_REGISTRY["warehouse"],
    FIELD_CONTEXT_REGISTRY["invoice"],
    FIELD_CONTEXT_REGISTRY["hsn"],
  ];
}
