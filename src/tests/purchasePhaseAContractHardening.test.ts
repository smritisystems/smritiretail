/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Purchase Phase A — Contract Hardening Tests
 * Standard     : AUD-004 / F-001 / F-002 / F-003 / F-004
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   PUR-A01  PurchaseOrderStatus type — all 6 values valid
 *   PUR-A02  cancelPO: rejects missing reason
 *   PUR-A03  cancelPO: rejects non-existent PO
 *   PUR-A04  cancelPO: rejects already-Received PO (lifecycle guard)
 *   PUR-A05  cancelPO: rejects already-Cancelled PO (idempotency guard)
 *   PUR-A06  cancelPO: successfully cancels Approved PO and emits event
 *   PUR-A07  cancelPO: successfully cancels Draft PO
 *   PUR-A08  getBySupplier: returns only POs for that supplierId
 *   PUR-A09  getBySupplier: returns empty array for unknown supplier
 *   PUR-A10  postGRN: rejects GRN against Cancelled PO
 *   PUR-A11  PurchaseCommandFacade.cancelPO: delegates correctly
 *   PUR-A12  PurchaseCommandFacade.getPOsBySupplier: delegates correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurchaseService } from "../kernel/internal/PurchaseService.js";
import { IPurchaseService, PurchaseOrderRecord, PurchaseOrderStatus } from "../kernel/public/IPurchaseService.js";
import { purchaseCommandFacade, PurchaseCommandFacade, PurchaseActionContext } from "../domains/purchase/PurchaseCommandFacade.js";
import { SPK } from "../kernel/SPK.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_STATUSES: PurchaseOrderStatus[] = ["Draft", "Submitted", "Approved", "Partial", "Received", "Cancelled"];

function makeMockPurchaseService(overrides: Partial<IPurchaseService> = {}): IPurchaseService {
  return {
    getPOById:      vi.fn().mockResolvedValue(null),
    getByPONumber:  vi.fn().mockResolvedValue(null),
    getBySupplier:  vi.fn().mockResolvedValue([]),
    searchPOs:      vi.fn().mockResolvedValue([]),
    getAllPOs:       vi.fn().mockResolvedValue([]),
    savePO:         vi.fn().mockResolvedValue({ id: "po-mock", poNumber: "PO-MOCK", status: "Draft", supplierId: "", supplierName: "", orderDate: "", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] }),
    postGRN:        vi.fn().mockResolvedValue({}),
    cancelPO:       vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const CTX: PurchaseActionContext = {
  userId:      "user-test-01",
  workspaceId: "ws-purchase-test",
};

// ── PUR-A01: PurchaseOrderStatus union type validation ────────────────────────

describe("PUR-A01 — PurchaseOrderStatus strict union type", () => {
  it("contains exactly 6 valid status values", () => {
    expect(VALID_STATUSES).toHaveLength(6);
    expect(VALID_STATUSES).toContain("Draft");
    expect(VALID_STATUSES).toContain("Submitted");
    expect(VALID_STATUSES).toContain("Approved");
    expect(VALID_STATUSES).toContain("Partial");
    expect(VALID_STATUSES).toContain("Received");
    expect(VALID_STATUSES).toContain("Cancelled");
  });
});

// ── PUR-A02 to PUR-A10: PurchaseService.cancelPO and getBySupplier ────────────

describe("PUR-A02 to PUR-A10 — PurchaseService lifecycle guards", () => {
  let svc: PurchaseService;

  beforeEach(() => {
    svc = new PurchaseService();
    SPK.services.register("PURCHASE", svc);
  });

  it("PUR-A02: cancelPO rejects empty reason string", async () => {
    await expect(svc.cancelPO("po-101", "")).rejects.toThrow("Cancellation reason is mandatory");
  });

  it("PUR-A02b: cancelPO rejects reason shorter than 3 chars", async () => {
    await expect(svc.cancelPO("po-101", "AB")).rejects.toThrow("Cancellation reason is mandatory");
  });

  it("PUR-A03: cancelPO rejects non-existent PO id", async () => {
    await expect(svc.cancelPO("po-DOES-NOT-EXIST", "Wrong order")).rejects.toThrow("not found");
  });

  it("PUR-A04: cancelPO rejects Received PO (cannot cancel after GRN completed)", async () => {
    // po-101 in local cache is 'Approved' — update to Received via savePO first
    await svc.savePO({ id: "po-101", status: "Received" });
    await expect(svc.cancelPO("po-101", "Duplicate PO error")).rejects.toThrow(
      /cannot be cancelled|Received/
    );
  });

  it("PUR-A05: cancelPO rejects already-Cancelled PO (idempotency guard)", async () => {
    // Set po-101 to Cancelled
    await svc.savePO({ id: "po-101", status: "Cancelled" });
    await expect(svc.cancelPO("po-101", "Trying to cancel again")).rejects.toThrow(
      /cannot be cancelled|Cancelled/
    );
  });

  it("PUR-A06: cancelPO successfully cancels Approved PO and sets fields", async () => {
    // Reset po-101 to Approved
    await svc.savePO({ id: "po-101", status: "Approved" });
    const result = await svc.cancelPO("po-101", "Supplier declined", "manager-01");
    expect(result.status).toBe("Cancelled");
    expect(result.cancellationReason).toBe("Supplier declined");
    expect(result.cancelledBy).toBe("manager-01");
    expect(result.cancelledAt).toBeDefined();
  });

  it("PUR-A07: cancelPO successfully cancels a Draft PO", async () => {
    // Create a fresh Draft PO
    const draft = await svc.savePO({ id: "po-draft-test", poNumber: "PO-DRAFT-001", status: "Draft", supplierId: "sup-999", supplierName: "Test Supplier", orderDate: "2026-08-05", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] });
    const result = await svc.cancelPO(draft.id, "Wrong supplier");
    expect(result.status).toBe("Cancelled");
  });

  it("PUR-A08: getBySupplier returns only POs for that supplierId", async () => {
    await svc.savePO({ id: "po-s1-a", poNumber: "PO-S1-A", supplierId: "sup-FILTER-TEST", supplierName: "Filtered Supplier", orderDate: "2026-08-05", status: "Draft", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] });
    await svc.savePO({ id: "po-s1-b", poNumber: "PO-S1-B", supplierId: "sup-FILTER-TEST", supplierName: "Filtered Supplier", orderDate: "2026-08-05", status: "Approved", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] });
    await svc.savePO({ id: "po-other", poNumber: "PO-OTHER", supplierId: "sup-OTHER", supplierName: "Other Supplier", orderDate: "2026-08-05", status: "Draft", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] });

    const results = await svc.getBySupplier("sup-FILTER-TEST");
    expect(results.length).toBeGreaterThanOrEqual(2);
    results.forEach((po) => expect(po.supplierId).toBe("sup-FILTER-TEST"));
  });

  it("PUR-A09: getBySupplier returns empty array for unknown supplierId", async () => {
    const results = await svc.getBySupplier("sup-TOTALLY-UNKNOWN-XYZ");
    expect(results).toHaveLength(0);
  });

  it("PUR-A10: postGRN throws if PO is Cancelled", async () => {
    // Create and cancel a PO
    const po = await svc.savePO({ id: "po-grn-block", poNumber: "PO-GRN-BLK", supplierId: "sup-101", supplierName: "Apex", orderDate: "2026-08-05", status: "Approved", totalAmount: 1000, totalTaxAmount: 0, netPayable: 1000, lines: [{ id: "l1", itemId: "item-1", itemCode: "SKU-001", itemName: "Test", orderedQty: 10, receivedQty: 0, unitPrice: 100, taxRate: 18, taxAmount: 180, totalAmount: 1180 }] });
    await svc.cancelPO(po.id, "Order cancelled before delivery");
    await expect(svc.postGRN(po.id, [{ itemId: "item-1", receivedQty: 5 }])).rejects.toThrow(
      /Cannot receive goods against Cancelled PO/
    );
  });
});

// ── PUR-A11 / PUR-A12: PurchaseCommandFacade delegation ──────────────────────

describe("PUR-A11 / PUR-A12 — PurchaseCommandFacade delegation", () => {
  it("PUR-A11: facade.cancelPO delegates to purchaseService.cancelPO and returns success", async () => {
    const mockSvc = makeMockPurchaseService({
      cancelPO: vi.fn().mockResolvedValue({ id: "po-f01", poNumber: "PO-F01", status: "Cancelled", supplierId: "sup-1", supplierName: "S", orderDate: "2026-08-05", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] }),
    });
    SPK.services.register("PURCHASE", mockSvc);

    const facade = new PurchaseCommandFacade();
    const result = await facade.cancelPO("po-f01", "Wrong vendor", CTX);
    expect(result.success).toBe(true);
    expect((mockSvc.cancelPO as any)).toHaveBeenCalledWith("po-f01", "Wrong vendor", CTX.userId);
  });

  it("PUR-A12: facade.getPOsBySupplier delegates to purchaseService.getBySupplier", async () => {
    const mockSvc = makeMockPurchaseService({
      getBySupplier: vi.fn().mockResolvedValue([
        { id: "po-sup-01", poNumber: "PO-SUP-01", status: "Approved", supplierId: "sup-X", supplierName: "X Corp", orderDate: "2026-08-05", totalAmount: 0, totalTaxAmount: 0, netPayable: 0, lines: [] }
      ])
    });
    SPK.services.register("PURCHASE", mockSvc);

    const facade = new PurchaseCommandFacade();
    const result = await facade.getPOsBySupplier("sup-X");
    expect(result.success).toBe(true);
    expect((mockSvc.getBySupplier as any)).toHaveBeenCalledWith("sup-X");
    const data = (result as any).data as PurchaseOrderRecord[];
    expect(data).toHaveLength(1);
    expect(data[0].supplierId).toBe("sup-X");
  });
});
