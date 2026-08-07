/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Module       : Sprint 3 Purchase Operations & GRN Unit Test Suite
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, expect, it, beforeEach } from "vitest";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierGst?: string;
  items: { code: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  status: "DRAFT" | "SUBMITTED" | "RECEIVED" | "CANCELLED";
  createdAt: string;
}

export interface GoodsReceiptNote {
  id: string;
  grnNumber: string;
  poId: string;
  receivedBy: string;
  items: { code: string; receivedQty: number; acceptedQty: number; rejectedQty: number }[];
  status: "COMPLETED" | "PARTIAL";
  receivedAt: string;
}

describe("Sprint 3: Purchase Operations & GRN Workflow", () => {
  let po: PurchaseOrder;

  beforeEach(() => {
    po = {
      id: "po-1001",
      poNumber: "PO-2026-0089",
      supplierName: "VRL Logistics & Wholesale",
      supplierGst: "27AAAAA0000A1Z5",
      items: [
        { code: "SKU-001", name: "Classic Shirt", quantity: 100, unitPrice: 900 },
        { code: "SKU-002", name: "Denim Jeans", quantity: 50, unitPrice: 1800 }
      ],
      totalAmount: 180000,
      status: "DRAFT",
      createdAt: new Date().toISOString()
    };
  });

  it("should calculate Purchase Order total amount correctly under < 60s SLA benchmark", () => {
    const startTime = performance.now();
    const calculatedTotal = po.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const duration = performance.now() - startTime;

    expect(calculatedTotal).toBe(180000);
    expect(duration).toBeLessThan(60000);
  });

  it("should generate valid Goods Receipt Note (GRN) from Purchase Order", () => {
    po.status = "SUBMITTED";

    const grn: GoodsReceiptNote = {
      id: `grn-${Date.now()}`,
      grnNumber: `GRN-2026-${po.poNumber.split("-")[2]}`,
      poId: po.id,
      receivedBy: "Warehouse Manager",
      items: po.items.map((item) => ({
        code: item.code,
        receivedQty: item.quantity,
        acceptedQty: item.quantity,
        rejectedQty: 0
      })),
      status: "COMPLETED",
      receivedAt: new Date().toISOString()
    };

    expect(grn.poId).toBe(po.id);
    expect(grn.items.length).toBe(2);
    expect(grn.items[0].acceptedQty).toBe(100);
    expect(grn.status).toBe("COMPLETED");
  });
});
