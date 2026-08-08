/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Purchase Phase B — Smart Purchase Intelligence Tests
 * Standard     : AUD-004 / F-006 / F-007
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   PUR-B01  Supplier Catalogue rate auto-fill: exact supplier match (P1)
 *   PUR-B02  Supplier Catalogue rate auto-fill: current supplier at P2
 *   PUR-B03  Supplier Catalogue rate auto-fill: fallback to P1 preferred when no exact match
 *   PUR-B04  Supplier Catalogue rate auto-fill: fallback to item purchase_price when no catalogue
 *   PUR-B05  Supplier Catalogue rate auto-fill: fallback to item price when no catalogue, no purchase_price
 *   PUR-B06  Purchase analytics: buildAnalytics — correct pendingApproval count
 *   PUR-B07  Purchase analytics: buildAnalytics — correct pendingGRN count
 *   PUR-B08  Purchase analytics: buildAnalytics — correct overdueDeliveries count
 *   PUR-B09  Purchase analytics: buildAnalytics — correct topSuppliers by spend (sorted desc)
 *   PUR-B10  Purchase analytics: totalNetPayable aggregation
 */

import { describe, it, expect } from "vitest";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../kernel/public/IPurchaseService.js";

// ── Inline the analytics builder (pure function extracted for testing) ─────────

interface SupplierSpend {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  poCount: number;
  avgOrderValue: number;
}

interface PurchaseAnalyticsData {
  totalPOs: number;
  pendingApproval: number;
  pendingGRN: number;
  overdueDeliveries: number;
  cancelled: number;
  received: number;
  totalNetPayable: number;
  topSuppliers: SupplierSpend[];
}

function isOverdue(po: PurchaseOrderRecord): boolean {
  if (!po.expectedDeliveryDate) return false;
  if (po.status === "Received" || po.status === "Cancelled") return false;
  return new Date(po.expectedDeliveryDate) < new Date();
}

function buildAnalytics(pos: PurchaseOrderRecord[]): PurchaseAnalyticsData {
  const supplierMap = new Map<string, SupplierSpend>();
  let pendingApproval = 0, pendingGRN = 0, overdueDeliveries = 0, cancelled = 0, received = 0, totalNetPayable = 0;

  pos.forEach((po) => {
    totalNetPayable += po.netPayable || 0;
    if (po.status === "Draft" || po.status === "Submitted") pendingApproval++;
    if (po.status === "Approved" || po.status === "Partial") pendingGRN++;
    if (isOverdue(po)) overdueDeliveries++;
    if (po.status === "Cancelled") cancelled++;
    if (po.status === "Received") received++;

    const existing = supplierMap.get(po.supplierId);
    if (existing) {
      existing.totalSpend += po.netPayable || 0;
      existing.poCount++;
      existing.avgOrderValue = existing.totalSpend / existing.poCount;
    } else {
      supplierMap.set(po.supplierId, { supplierId: po.supplierId, supplierName: po.supplierName, totalSpend: po.netPayable || 0, poCount: 1, avgOrderValue: po.netPayable || 0 });
    }
  });

  const topSuppliers = Array.from(supplierMap.values()).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);
  return { totalPOs: pos.length, pendingApproval, pendingGRN, overdueDeliveries, cancelled, received, totalNetPayable, topSuppliers };
}

// ── Supplier Catalogue Rate Resolution (pure function extracted for testing) ───

interface CatalogueEntry { supplierId: string; priority: 1 | 2 | 3; currentRate?: number; }
interface MockProduct { price?: number; purchase_price?: number; supplierCatalogue?: CatalogueEntry[]; }

function resolveSmartPurchaseRate(product: MockProduct, activeSupplierId: string): { rate: number; sourceLabel: string } {
  const catalogue = product.supplierCatalogue;
  if (catalogue && catalogue.length > 0) {
    const exactMatch = catalogue.filter((e) => e.supplierId === activeSupplierId).sort((a, b) => a.priority - b.priority)[0];
    if (exactMatch?.currentRate) return { rate: exactMatch.currentRate, sourceLabel: `Supplier Catalogue (P${exactMatch.priority} — Current Vendor)` };
    const p1 = catalogue.find((e) => e.priority === 1);
    if (p1?.currentRate) return { rate: p1.currentRate, sourceLabel: "Supplier Catalogue (P1 Preferred)" };
    const lowest = [...catalogue].sort((a, b) => a.priority - b.priority)[0];
    if (lowest?.currentRate) return { rate: lowest.currentRate, sourceLabel: `Supplier Catalogue (P${lowest.priority})` };
  }
  const fallback = product.purchase_price || product.price || 500;
  return { rate: fallback, sourceLabel: "Item Master Purchase Price" };
}

// ── PO Fixture Builder ────────────────────────────────────────────────────────

function makePO(overrides: Partial<PurchaseOrderRecord>): PurchaseOrderRecord {
  return {
    id: `po-${Math.random().toString(36).slice(2, 7)}`,
    poNumber: "PO-TEST",
    supplierId: "sup-default",
    supplierName: "Default Supplier",
    orderDate: "2026-07-01",
    status: "Approved" as PurchaseOrderStatus,
    totalAmount: 1000,
    totalTaxAmount: 180,
    netPayable: 1180,
    lines: [],
    ...overrides,
  };
}

// ── PUR-B01 to PUR-B05: Supplier Catalogue Rate Auto-Fill ─────────────────────

describe("PUR-B01 to PUR-B05 — Supplier Catalogue Rate Auto-Fill", () => {
  it("PUR-B01: exact supplier match at P1 — uses exact supplier current rate", () => {
    const product: MockProduct = {
      price: 500,
      supplierCatalogue: [
        { supplierId: "sup-A", priority: 1, currentRate: 850 },
        { supplierId: "sup-B", priority: 2, currentRate: 920 },
      ],
    };
    const { rate, sourceLabel } = resolveSmartPurchaseRate(product, "sup-A");
    expect(rate).toBe(850);
    expect(sourceLabel).toContain("Current Vendor");
  });

  it("PUR-B02: current supplier matched at P2 — uses P2 rate (not P1)", () => {
    const product: MockProduct = {
      price: 500,
      supplierCatalogue: [
        { supplierId: "sup-preferred", priority: 1, currentRate: 700 },
        { supplierId: "sup-current",   priority: 2, currentRate: 780 },
      ],
    };
    const { rate, sourceLabel } = resolveSmartPurchaseRate(product, "sup-current");
    expect(rate).toBe(780);
    expect(sourceLabel).toContain("Current Vendor");
    expect(sourceLabel).toContain("P2");
  });

  it("PUR-B03: no exact supplier match — falls back to P1 preferred vendor rate", () => {
    const product: MockProduct = {
      price: 500,
      supplierCatalogue: [
        { supplierId: "sup-preferred", priority: 1, currentRate: 720 },
        { supplierId: "sup-B",         priority: 2, currentRate: 800 },
      ],
    };
    const { rate, sourceLabel } = resolveSmartPurchaseRate(product, "sup-UNKNOWN");
    expect(rate).toBe(720);
    expect(sourceLabel).toBe("Supplier Catalogue (P1 Preferred)");
  });

  it("PUR-B04: no catalogue — uses product.purchase_price", () => {
    const product: MockProduct = { price: 500, purchase_price: 430 };
    const { rate, sourceLabel } = resolveSmartPurchaseRate(product, "sup-any");
    expect(rate).toBe(430);
    expect(sourceLabel).toBe("Item Master Purchase Price");
  });

  it("PUR-B05: no catalogue, no purchase_price — falls back to product.price", () => {
    const product: MockProduct = { price: 350 };
    const { rate, sourceLabel } = resolveSmartPurchaseRate(product, "sup-any");
    expect(rate).toBe(350);
    expect(sourceLabel).toBe("Item Master Purchase Price");
  });
});

// ── PUR-B06 to PUR-B10: Purchase Analytics buildAnalytics ─────────────────────

describe("PUR-B06 to PUR-B10 — Purchase Analytics buildAnalytics", () => {
  it("PUR-B06: pendingApproval counts Draft and Submitted POs only", () => {
    const pos = [
      makePO({ status: "Draft" }),
      makePO({ status: "Submitted" }),
      makePO({ status: "Approved" }),
      makePO({ status: "Received" }),
      makePO({ status: "Cancelled" }),
    ];
    const { pendingApproval } = buildAnalytics(pos);
    expect(pendingApproval).toBe(2);
  });

  it("PUR-B07: pendingGRN counts Approved and Partial POs only", () => {
    const pos = [
      makePO({ status: "Approved" }),
      makePO({ status: "Partial" }),
      makePO({ status: "Approved" }),
      makePO({ status: "Draft" }),
      makePO({ status: "Received" }),
    ];
    const { pendingGRN } = buildAnalytics(pos);
    expect(pendingGRN).toBe(3);
  });

  it("PUR-B08: overdueDeliveries counts only open POs past expected delivery date", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const pos = [
      makePO({ status: "Approved",  expectedDeliveryDate: yesterday }), // overdue
      makePO({ status: "Partial",   expectedDeliveryDate: yesterday }), // overdue
      makePO({ status: "Approved",  expectedDeliveryDate: tomorrow  }), // not overdue
      makePO({ status: "Received",  expectedDeliveryDate: yesterday }), // Received — not counted
      makePO({ status: "Cancelled", expectedDeliveryDate: yesterday }), // Cancelled — not counted
    ];
    const { overdueDeliveries } = buildAnalytics(pos);
    expect(overdueDeliveries).toBe(2);
  });

  it("PUR-B09: topSuppliers sorted by totalSpend descending, max 5", () => {
    const pos = [
      makePO({ supplierId: "sup-A", supplierName: "Alpha", netPayable: 50000 }),
      makePO({ supplierId: "sup-A", supplierName: "Alpha", netPayable: 30000 }),
      makePO({ supplierId: "sup-B", supplierName: "Beta",  netPayable: 90000 }),
      makePO({ supplierId: "sup-C", supplierName: "Gamma", netPayable: 20000 }),
    ];
    const { topSuppliers } = buildAnalytics(pos);
    expect(topSuppliers[0].supplierId).toBe("sup-B");
    expect(topSuppliers[0].totalSpend).toBe(90000);
    expect(topSuppliers[1].supplierId).toBe("sup-A");
    expect(topSuppliers[1].totalSpend).toBe(80000);
    expect(topSuppliers[1].poCount).toBe(2);
    expect(topSuppliers[1].avgOrderValue).toBe(40000);
    expect(topSuppliers.length).toBeLessThanOrEqual(5);
  });

  it("PUR-B10: totalNetPayable aggregates all PO netPayable values", () => {
    const pos = [
      makePO({ netPayable: 10000 }),
      makePO({ netPayable: 25000 }),
      makePO({ netPayable: 15000 }),
    ];
    const { totalNetPayable } = buildAnalytics(pos);
    expect(totalNetPayable).toBe(50000);
  });
});
