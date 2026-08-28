/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.97.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import StockTransferEngine, { StockTransferOrder } from "../utils/stockTransferEngine";

describe("StockTransferEngine — Multi-Branch Stock Transfer & Inter-Branch Requisition", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeOrder(): StockTransferOrder {
    return StockTransferEngine.createRequisition({
      transferType: "INTER_BRANCH",
      fromBranch: "BR-MUM-01",
      toBranch: "BR-DEL-01",
      lines: [
        { sku: "APP-POLO-NAVY-M",   productName: "Polo Shirt Navy M",    requestedQty: 50, unitCost: 600 },
        { sku: "DNM-SLIM-BLK-32",   productName: "Slim Denim Black 32",  requestedQty: 30, unitCost: 950 },
      ],
      requestedBy: "STORE-MGR-DEL",
    });
  }

  // ─── Test 1: Requisition creation ─────────────────────────────────────────
  it("creates a requisition with correct line totals, overall transfer value, and SUBMITTED status", () => {
    const order = makeOrder();

    expect(order.transferId).toMatch(/^STO-\d+$/);
    expect(order.status).toBe("SUBMITTED");
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0].transferValue).toBe(30000);     // 50 × 600
    expect(order.lines[1].transferValue).toBe(28500);     // 30 × 950
    expect(order.totalTransferValue).toBe(58500);         // 30000 + 28500
    expect(order.auditTrail).toHaveLength(1);
    expect(order.auditTrail[0].toStatus).toBe("SUBMITTED");
  });

  // ─── Test 2: Approve with partial qty override ────────────────────────────
  it("approves with per-line approved qty, recalculates transfer value, and appends audit entry", () => {
    const order = makeOrder();
    const approved = StockTransferEngine.approve(
      order,
      [
        { lineId: "LINE-1", approvedQty: 40 },   // Partial: 40 of 50 requested
        { lineId: "LINE-2", approvedQty: 30 },   // Full
      ],
      "MGR-MUM-01"
    );

    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe("MGR-MUM-01");

    const line1 = approved.lines.find((l) => l.lineId === "LINE-1")!;
    expect(line1.approvedQty).toBe(40);
    expect(line1.transferValue).toBe(24000);               // 40 × 600

    // Transfer value recalculated
    expect(approved.totalTransferValue).toBe(52500);       // 24000 + 28500
    expect(approved.auditTrail).toHaveLength(2);
    expect(approved.auditTrail[1].toStatus).toBe("APPROVED");
  });

  // ─── Test 3: Dispatch and full receive ────────────────────────────────────
  it("dispatches with logistics reference and marks fully RECEIVED when no short qty", () => {
    let order = makeOrder();
    order = StockTransferEngine.approve(order, [], "MGR-MUM-01");

    order = StockTransferEngine.dispatch(order, {
      logisticsRef: "BLUEDART-9988",
      dispatchedBy: "WH-OPR-01",
      expectedArrival: "2026-08-30",
      dispatchedLines: [
        { lineId: "LINE-1", dispatchedQty: 50 },
        { lineId: "LINE-2", dispatchedQty: 30 },
      ],
    });

    expect(order.status).toBe("DISPATCHED");
    expect(order.logisticsRef).toBe("BLUEDART-9988");
    expect(order.expectedArrival).toBe("2026-08-30");

    const received = StockTransferEngine.receive(order, {
      receivedBy: "STORE-OPR-DEL",
      receivingNotes: "All items received in good condition",
      receivedLines: [
        { lineId: "LINE-1", receivedQty: 50 },
        { lineId: "LINE-2", receivedQty: 30 },
      ],
    });

    expect(received.status).toBe("RECEIVED");    // No short qty → full RECEIVED
    expect(received.lines[0].receivedQty).toBe(50);
    expect(received.lines[0].shortQty).toBe(0);
  });

  // ─── Test 4: Short receipt and metrics computation ────────────────────────
  it("classifies as PARTIALLY_RECEIVED on short qty and computes metrics correctly", () => {
    let order = makeOrder();
    order = StockTransferEngine.approve(order, [], "MGR-MUM-01");
    order = StockTransferEngine.dispatch(order, {
      logisticsRef: "DELHIVERY-1234", dispatchedBy: "WH-OPR-01", expectedArrival: "2026-08-30",
      dispatchedLines: [{ lineId: "LINE-1", dispatchedQty: 50 }, { lineId: "LINE-2", dispatchedQty: 30 }],
    });

    const partial = StockTransferEngine.receive(order, {
      receivedBy: "STORE-OPR-DEL",
      receivedLines: [
        { lineId: "LINE-1", receivedQty: 45 },   // 5 short
        { lineId: "LINE-2", receivedQty: 30 },   // Full
      ],
    });

    expect(partial.status).toBe("PARTIALLY_RECEIVED");
    expect(partial.lines[0].shortQty).toBe(5);
    expect(partial.lines[1].shortQty).toBe(0);

    // Metrics
    const order2 = makeOrder();  // In SUBMITTED = pendingApproval
    const metrics = StockTransferEngine.computeMetrics([partial, order2]);

    expect(metrics.totalTransfers).toBe(2);
    expect(metrics.pendingApproval).toBe(1);           // SUBMITTED
    expect(metrics.received).toBe(1);                  // PARTIALLY_RECEIVED counts as received
    expect(metrics.shortReceiptRate).toBe(100);        // 1/1 partial = 100%
    expect(metrics.inTransit).toBe(0);
  });
});
