/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase — Supplier Master Object Page (WNG-003 / WNG-004)
 * Standard     : WNG-003 (Object Page Pattern) | WNG-004 (Context-Aware Navigation)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 Wave 2)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-003):
 *   Master entity pages MUST implement the Object Page Pattern:
 *     Fixed summary header + horizontal workspace tabs.
 *   This file is a PURE TYPESCRIPT domain utility — zero React, zero UI code.
 *   UI rendering is delegated to the generic ObjectPageRenderer via tab metadata.
 *
 * TABS (4 standard tabs per WNG-003):
 *   overview        — Profile, GST, credit terms, contact details
 *   purchase_orders — All POs for this supplier (IPurchaseService.searchPOs)
 *   terms           — Contacts, credit days, payment terms
 *   audit           — Audit log (IAuditService)
 */

import type { SupplierRecord } from "../../kernel/public/ISupplierService.js";

// ── Object Page Tab Metadata ───────────────────────────────────────────────────

export interface SupplierObjectTab {
  id:           string;
  label:        string;
  icon:         string;
  dataSource:   string;    // logical data source key for the generic renderer
  permissionId: string;    // permission required to view this tab
  order:        number;
}

export interface SupplierHeaderSummary {
  id:            string;
  code:          string;
  name:          string;
  status:        string;
  statusBadge:   "success" | "warning" | "danger" | "neutral";
  mobile:        string;
  city:          string;
  state:         string;
  gstNumber:     string;
  outstanding:   number;
  creditDays:    number;
  contactPerson: string;
}

export interface SupplierObjectPageContext {
  supplierId:  string;
  activeTabId: string;
}

// ── Tab Resolver (WNG-003: metadata-driven, not hardcoded switch) ─────────────

const SUPPLIER_TABS: ReadonlyArray<Readonly<SupplierObjectTab>> = Object.freeze([
  Object.freeze({
    id:           "overview",
    label:        "Overview & Profile",
    icon:         "person",
    dataSource:   "ISupplierService.getById",
    permissionId: "purchase.supplier.read",
    order:        1,
  }),
  Object.freeze({
    id:           "purchase_orders",
    label:        "Purchase Orders",
    icon:         "shopping_cart",
    dataSource:   "IPurchaseService.searchPOs",
    permissionId: "purchase.order.read",
    order:        2,
  }),
  Object.freeze({
    id:           "terms",
    label:        "Contacts & Credit Terms",
    icon:         "handshake",
    dataSource:   "ISupplierService.getById",
    permissionId: "purchase.supplier.read",
    order:        3,
  }),
  Object.freeze({
    id:           "audit",
    label:        "Audit Log",
    icon:         "history",
    dataSource:   "IAuditService",
    permissionId: "purchase.supplier.audit",
    order:        4,
  }),
]);

/**
 * Returns the 4 standard Supplier Object Page tabs in display order.
 * Pure metadata resolver — no UI, no React, no hardcoded business logic.
 * Renderer components consume this output generically (WNG-003 compliant).
 */
export function resolveSupplierTabs(): ReadonlyArray<Readonly<SupplierObjectTab>> {
  return SUPPLIER_TABS.slice().sort((a, b) => a.order - b.order);
}

/**
 * Builds the fixed-header summary block from a SupplierRecord.
 * This powers the sticky header shown above the tab content (WNG-003 fixed header).
 */
export function buildSupplierHeaderSummary(
  supplier: SupplierRecord,
): Readonly<SupplierHeaderSummary> {
  const statusBadge = resolveStatusBadge(supplier.status);

  return Object.freeze({
    id:            supplier.id,
    code:          supplier.code,
    name:          supplier.name,
    status:        supplier.status,
    statusBadge,
    mobile:        supplier.mobile,
    city:          supplier.city        ?? "",
    state:         supplier.state       ?? "",
    gstNumber:     supplier.gstNumber   ?? "Not Provided",
    outstanding:   supplier.outstanding ?? 0,
    creditDays:    supplier.creditDays  ?? 0,
    contactPerson: supplier.contactPerson ?? supplier.name,
  });
}

function resolveStatusBadge(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  switch (status?.toLowerCase()) {
    case "active":   return "success";
    case "inactive": return "warning";
    case "blocked":  return "danger";
    default:         return "neutral";
  }
}

/**
 * Returns the default tab ID for the Supplier Object Page.
 * Centralised so rendering logic never hardcodes "overview".
 */
export function getDefaultSupplierTabId(): string {
  return SUPPLIER_TABS[0].id;
}
