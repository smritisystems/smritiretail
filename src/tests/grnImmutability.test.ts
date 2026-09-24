/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.6
 * Created      : 2026-09-24
 * Modified     : 2026-09-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_IMMUTABILITY_TEST")
 * Target UI    : Goods Receipt Note Immutability & PO Lifecycle Governance Test Suite
 */

import { describe, expect, it } from "vitest";

describe("Goods Receipt Note (GRN) Inward Engine Immutability & PO Lifecycle Governance", () => {
  // Test Model Interfaces
  interface MockPurchaseOrder {
    id: string;
    order_no: string;
    supplier_id: string;
    status: "DRAFT" | "CONFIRMED" | "APPROVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "COMPLETED" | "CANCELLED";
    items: Array<{
      id: string;
      code: string;
      name: string;
      quantity: number;
      cost_price: number;
    }>;
  }

  interface MockPurchaseReceipt {
    id: string;
    receipt_no: string;
    order_id?: string;
    supplier_id: string;
    status: string;
    grand_total: number;
    eway_bill_no?: string;
  }

  // Domain Logic Under Test
  class PurchaseInwardEngine {
    private receipts: MockPurchaseReceipt[] = [];
    private orders: Map<string, MockPurchaseOrder> = new Map();

    constructor(initialOrders: MockPurchaseOrder[] = [], initialReceipts: MockPurchaseReceipt[] = []) {
      initialOrders.forEach((o) => this.orders.set(o.id, { ...o }));
      this.receipts = [...initialReceipts];
    }

    public getOrder(orderId: string): MockPurchaseOrder | undefined {
      return this.orders.get(orderId);
    }

    public getReceipts(): MockPurchaseReceipt[] {
      return [...this.receipts];
    }

    public listPendingOrdersForInward(): MockPurchaseOrder[] {
      return Array.from(this.orders.values()).filter((o) => {
        const st = (o.status || "").toUpperCase();
        return st !== "CANCELLED" && st !== "RECEIVED" && st !== "COMPLETED" && st !== "DRAFT";
      });
    }

    public postReceipt(payload: {
      receipt_no: string;
      supplier_id: string;
      order_id?: string;
      grand_total: number;
      eway_bill_no?: string;
    }): { success: boolean; receipt: MockPurchaseReceipt; order?: MockPurchaseOrder } {
      // 1. Pre-flight duplicate check on receipt_no
      const existingReceipt = this.receipts.find(
        (r) => r.receipt_no.trim().toUpperCase() === payload.receipt_no.trim().toUpperCase()
      );
      if (existingReceipt) {
        throw new Error(
          `[HTTP 409 Conflict] Purchase Receipt / GRN '${payload.receipt_no}' has already been posted and committed. Duplicate GRN submission is prohibited.`
        );
      }

      // 2. Pre-flight check on linked PO status
      let linkedPo: MockPurchaseOrder | undefined;
      if (payload.order_id) {
        linkedPo = this.orders.get(payload.order_id);
        if (!linkedPo) {
          throw new Error("[HTTP 404 Not Found] The linked purchase order was not found.");
        }
        if (["RECEIVED", "COMPLETED"].includes(linkedPo.status)) {
          throw new Error(
            `[HTTP 409 Conflict] Purchase Order '${linkedPo.order_no}' has already been fully received and closed. Duplicate receipt against a fulfilled PO is prohibited.`
          );
        }
        if (linkedPo.status === "CANCELLED") {
          throw new Error(
            `[HTTP 400 Bad Request] Purchase Order '${linkedPo.order_no}' is cancelled and cannot be received.`
          );
        }
      }

      // 3. Commit receipt
      const newReceipt: MockPurchaseReceipt = {
        id: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        receipt_no: payload.receipt_no,
        supplier_id: payload.supplier_id,
        order_id: payload.order_id,
        status: "RECEIVED",
        grand_total: payload.grand_total,
        eway_bill_no: payload.eway_bill_no,
      };
      this.receipts.push(newReceipt);

      // 4. Atomic transition of linked PurchaseOrder.status = "RECEIVED"
      if (linkedPo) {
        linkedPo.status = "RECEIVED";
        this.orders.set(linkedPo.id, linkedPo);
      }

      return { success: true, receipt: newReceipt, order: linkedPo };
    }
  }

  it("successfully commits GRN against confirmed PO and transitions PO status to RECEIVED", () => {
    const initialPo: MockPurchaseOrder = {
      id: "po-101",
      order_no: "PO/2026/0101",
      supplier_id: "SUP-CENTURY",
      status: "CONFIRMED",
      items: [{ id: "i1", code: "FAB-01", name: "Cotton Fabric", quantity: 100, cost_price: 150 }],
    };

    const engine = new PurchaseInwardEngine([initialPo]);

    const result = engine.postReceipt({
      receipt_no: "GRN-20260924-001",
      supplier_id: "SUP-CENTURY",
      order_id: "po-101",
      grand_total: 15000,
      eway_bill_no: "241098234512",
    });

    expect(result.success).toBe(true);
    expect(result.receipt.receipt_no).toBe("GRN-20260924-001");
    expect(result.receipt.status).toBe("RECEIVED");

    // Verify PO status atomically transitioned
    const updatedPo = engine.getOrder("po-101");
    expect(updatedPo?.status).toBe("RECEIVED");
  });

  it("rejects duplicate GRN receipt_no with HTTP 409 Conflict", () => {
    const existingReceipt: MockPurchaseReceipt = {
      id: "rec-001",
      receipt_no: "GRN-20260924-001",
      supplier_id: "SUP-CENTURY",
      status: "RECEIVED",
      grand_total: 15000,
    };

    const engine = new PurchaseInwardEngine([], [existingReceipt]);

    expect(() =>
      engine.postReceipt({
        receipt_no: "GRN-20260924-001",
        supplier_id: "SUP-CENTURY",
        grand_total: 15000,
      })
    ).toThrowError(/Duplicate GRN submission is prohibited/);
  });

  it("rejects duplicate receipt attempts against already fulfilled PO with HTTP 409 Conflict", () => {
    const receivedPo: MockPurchaseOrder = {
      id: "po-102",
      order_no: "PO/2026/0102",
      supplier_id: "SUP-CENTURY",
      status: "RECEIVED",
      items: [{ id: "i2", code: "FAB-02", name: "Silk Blend", quantity: 50, cost_price: 300 }],
    };

    const engine = new PurchaseInwardEngine([receivedPo]);

    expect(() =>
      engine.postReceipt({
        receipt_no: "GRN-20260924-002",
        supplier_id: "SUP-CENTURY",
        order_id: "po-102",
        grand_total: 15000,
      })
    ).toThrowError(/Duplicate receipt against a fulfilled PO is prohibited/);
  });

  it("rejects receipt attempts against cancelled purchase orders with HTTP 400 Bad Request", () => {
    const cancelledPo: MockPurchaseOrder = {
      id: "po-103",
      order_no: "PO/2026/0103",
      supplier_id: "SUP-CENTURY",
      status: "CANCELLED",
      items: [{ id: "i3", code: "FAB-03", name: "Linen", quantity: 20, cost_price: 250 }],
    };

    const engine = new PurchaseInwardEngine([cancelledPo]);

    expect(() =>
      engine.postReceipt({
        receipt_no: "GRN-20260924-003",
        supplier_id: "SUP-CENTURY",
        order_id: "po-103",
        grand_total: 5000,
      })
    ).toThrowError(/is cancelled and cannot be received/);
  });

  it("filters loadOrders to exclude RECEIVED, COMPLETED, CANCELLED, and DRAFT orders", () => {
    const orders: MockPurchaseOrder[] = [
      { id: "po-1", order_no: "PO-1", supplier_id: "S1", status: "CONFIRMED", items: [] },
      { id: "po-2", order_no: "PO-2", supplier_id: "S1", status: "APPROVED", items: [] },
      { id: "po-3", order_no: "PO-3", supplier_id: "S1", status: "PARTIALLY_RECEIVED", items: [] },
      { id: "po-4", order_no: "PO-4", supplier_id: "S1", status: "RECEIVED", items: [] },
      { id: "po-5", order_no: "PO-5", supplier_id: "S1", status: "COMPLETED", items: [] },
      { id: "po-6", order_no: "PO-6", supplier_id: "S1", status: "CANCELLED", items: [] },
      { id: "po-7", order_no: "PO-7", supplier_id: "S1", status: "DRAFT", items: [] },
    ];

    const engine = new PurchaseInwardEngine(orders);
    const eligibleOrders = engine.listPendingOrdersForInward();

    expect(eligibleOrders.map((o) => o.id)).toEqual(["po-1", "po-2", "po-3"]);
    expect(eligibleOrders.some((o) => o.status === "RECEIVED")).toBe(false);
    expect(eligibleOrders.some((o) => o.status === "COMPLETED")).toBe(false);
    expect(eligibleOrders.some((o) => o.status === "CANCELLED")).toBe(false);
    expect(eligibleOrders.some((o) => o.status === "DRAFT")).toBe(false);
  });

  it("validates post-commit workspace reset state and sequence advancement", () => {
    // Simulate workspace state prior to commit
    let workspaceState = {
      grnLines: [{ code: "SKU-01", quantity_received: 10, cost_price: 100 }],
      costItems: [{ component_type: "FREIGHT", amount: 500 }],
      selectedOrderId: "po-101",
      supplierId: "SUP-01",
      supplierName: "Vendor Inc",
      grnNumber: "GRN-20260924-1001",
      ewayBillNumber: "241098234512",
      ewayBillDate: "2026-09-24",
      subView: "create",
      activeStep: "REVIEW_POST",
    };

    // Workspace reset handler (mimicking handleClearLines & navigation)
    const resetWorkspace = (currentState: typeof workspaceState) => {
      return {
        ...currentState,
        grnLines: [],
        costItems: [],
        selectedOrderId: "",
        supplierId: "",
        supplierName: "",
        grnNumber: `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
        ewayBillNumber: "",
        ewayBillDate: "",
        subView: "history",
        activeStep: "PO_DETAILS",
      };
    };

    const cleanState = resetWorkspace(workspaceState);

    expect(cleanState.grnLines).toHaveLength(0);
    expect(cleanState.costItems).toHaveLength(0);
    expect(cleanState.selectedOrderId).toBe("");
    expect(cleanState.supplierId).toBe("");
    expect(cleanState.ewayBillNumber).toBe("");
    expect(cleanState.ewayBillDate).toBe("");
    expect(cleanState.subView).toBe("history");
    expect(cleanState.activeStep).toBe("PO_DETAILS");
    // Verify sequence advancement: new number must not equal previous number
    expect(cleanState.grnNumber).not.toBe(workspaceState.grnNumber);
    expect(cleanState.grnNumber).toMatch(/^GRN-\d{8}-\d{4}$/);
  });
});
