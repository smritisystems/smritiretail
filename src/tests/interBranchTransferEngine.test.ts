/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.118.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import InterBranchTransferEngine from "../utils/interBranchTransferEngine";

describe("InterBranchTransferEngine — Inter-Branch Stock Transfer Engine", () => {

  const BASE_LINES = [
    { sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m", requestedQty: 50, unitCost: 180 },
    { sku: "FAB-LINEN-WHT", productName: "Linen White 1m", requestedQty: 30, unitCost: 200 },
  ];

  // ─── Test 1: Create transfer — fields and totals ──────────────────────────
  it("createTransfer sets DRAFT status with correct totals and audit entry", () => {
    const order = InterBranchTransferEngine.createTransfer({
      fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01",
      createdBy: "MGR-001", lines: BASE_LINES,
    });

    expect(order.status).toBe("DRAFT");
    expect(order.fromBranch).toBe("BR-MUM-01");
    expect(order.toBranch).toBe("BR-PUN-01");
    expect(order.lines).toHaveLength(2);
    expect(order.totalLines).toBe(2);
    expect(order.totalRequestedQty).toBe(80);   // 50 + 30
    expect(order.totalDispatchedQty).toBe(0);
    expect(order.totalReceivedQty).toBe(0);
    expect(order.hasVariance).toBe(false);
    expect(order.auditTrail[0].action).toBe("TRANSFER_CREATED");
    expect(order.transferNo).toMatch(/^STO-BR-MUM-01-/);
  });

  // ─── Test 2: APPROVED → IN_TRANSIT with dispatched qty ───────────────────
  it("approve then dispatch sets IN_TRANSIT; dispatched qty recorded per line", () => {
    let order = InterBranchTransferEngine.createTransfer({
      fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01",
      createdBy: "MGR-001", lines: BASE_LINES,
    });

    order = InterBranchTransferEngine.approve(order, "PURCHASE-MGR-001");
    expect(order.status).toBe("APPROVED");

    // Dispatch line 1 as-requested (50), line 2 short (25 of 30)
    const lineQtys = {
      [order.lines[0].lineId]: 50,
      [order.lines[1].lineId]: 25,
    };
    order = InterBranchTransferEngine.dispatch(order, "DISPATCH-001", lineQtys);
    expect(order.status).toBe("IN_TRANSIT");
    expect(order.totalDispatchedQty).toBe(75);    // 50 + 25
    expect(order.lines[1].dispatchedQty).toBe(25);
    expect(order.dispatchedAt).toBeDefined();
    expect(order.auditTrail).toHaveLength(3);     // CREATE + APPROVE + DISPATCH

    // Cannot dispatch again
    expect(() => InterBranchTransferEngine.dispatch(order, "OP", {})).toThrow("Cannot dispatch");
  });

  // ─── Test 3: Full lifecycle — RECEIVE with variance → COMPLETE ────────────
  it("full lifecycle: receive with variance detected; complete settles", () => {
    let order = InterBranchTransferEngine.createTransfer({
      fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01",
      createdBy: "MGR-001",
      lines: [{ sku: "ACC-BELT-BRN", productName: "Leather Belt", requestedQty: 20, unitCost: 300 }],
    });
    order = InterBranchTransferEngine.approve(order, "MGR-001");
    order = InterBranchTransferEngine.dispatch(order, "DISPATCH-001", { [order.lines[0].lineId]: 20 });

    // Receive only 18 — variance of 2
    order = InterBranchTransferEngine.receive(order, "RECV-001", { [order.lines[0].lineId]: 18 });
    expect(order.status).toBe("RECEIVED");
    expect(order.totalReceivedQty).toBe(18);
    expect(order.totalVarianceQty).toBe(2);
    expect(order.hasVariance).toBe(true);
    expect(order.lines[0].variance).toBe(2);      // dispatched(20) - received(18)
    expect(order.receivedAt).toBeDefined();

    order = InterBranchTransferEngine.complete(order, "MGR-001");
    expect(order.status).toBe("COMPLETED");
    expect(order.completedAt).toBeDefined();
    expect(order.auditTrail).toHaveLength(5);     // CREATE + APPROVE + DISPATCH + RECEIVE + COMPLETE
    expect(order.auditTrail.at(-1)!.note).toContain("variance 2 units");
  });

  // ─── Test 4: Cancel + guard errors + transferSummary ─────────────────────
  it("cancel from DRAFT; IN_TRANSIT cancel throws; transferSummary correct", () => {
    const o1 = InterBranchTransferEngine.createTransfer({
      fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01", createdBy: "MGR-001",
      lines: [{ sku: "FAB-X", productName: "X", requestedQty: 10, unitCost: 100 }],
    });
    let cancelled = InterBranchTransferEngine.cancel(o1, "MGR-001", "Demand cancelled");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Demand cancelled");

    // Cannot cancel once IN_TRANSIT
    let o2 = InterBranchTransferEngine.createTransfer({
      fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01", createdBy: "MGR-001",
      lines: [{ sku: "FAB-Y", productName: "Y", requestedQty: 5, unitCost: 200 }],
    });
    o2 = InterBranchTransferEngine.approve(o2, "MGR-001");
    o2 = InterBranchTransferEngine.dispatch(o2, "DP-001", { [o2.lines[0].lineId]: 5 });
    expect(() => InterBranchTransferEngine.cancel(o2, "MGR-001", "Late cancel")).toThrow("Cannot cancel");

    const summary = InterBranchTransferEngine.transferSummary([cancelled, o2]);
    expect(summary.byStatus["CANCELLED"]).toBe(1);
    expect(summary.byStatus["IN_TRANSIT"]).toBe(1);
    expect(summary.totalInTransit).toBe(5);
    // o2 is IN_TRANSIT with dispatchedQty=5, receivedQty=0 → variance=5 → withVariance=1
    expect(summary.withVariance).toBe(1);
  });
});
