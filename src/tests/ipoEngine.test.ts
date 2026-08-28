/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.105.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import IPOEngine from "../utils/ipoEngine";

describe("IPOEngine — Inter-Store Purchase Order Engine", () => {
  function makeIPO() {
    return IPOEngine.createIPO({
      requestingBranch: "BR-DEL-01",
      fulfillingBranch: "BR-MUM-01",
      requestedBy: "MGR-DEL-01",
      lines: [
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m",  requestedQty: 100, unitCost: 120 },
        { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",    requestedQty: 50,  unitCost: 250 },
        { sku: "ACC-BELT-BRN",   productName: "Leather Belt Brown", requestedQty: 30, unitCost: 350 },
      ],
    });
  }

  // ─── Test 1: Creation & totals ────────────────────────────────────────────
  it("creates IPO with correct totalRequestedQty and DRAFT status", () => {
    const ipo = makeIPO();
    expect(ipo.status).toBe("DRAFT");
    expect(ipo.lines).toHaveLength(3);
    expect(ipo.totalRequestedQty).toBe(180);  // 100+50+30
    expect(ipo.totalDispatchedQty).toBe(0);
    expect(ipo.totalValue).toBe(0);
    expect(ipo.lines.every((l) => l.lineStatus === "PENDING")).toBe(true);
    expect(ipo.auditTrail).toHaveLength(1);
  });

  // ─── Test 2: Approval with qty overrides ─────────────────────────────────
  it("approves with partial approvedQty — does not exceed requestedQty", () => {
    let ipo = makeIPO();
    ipo = IPOEngine.submit(ipo, "MGR-DEL-01");
    ipo = IPOEngine.approve(ipo, "WH-MGR-MUM",  [
      { lineId: "IPOL-1", approvedQty: 80  },   // Partial — only 80 of 100
      { lineId: "IPOL-2", approvedQty: 50  },   // Full
      { lineId: "IPOL-3", approvedQty: 999 },   // Exceeds → clamped to 30
    ]);
    expect(ipo.status).toBe("APPROVED");
    expect(ipo.approvedBy).toBe("WH-MGR-MUM");
    expect(ipo.lines[0].approvedQty).toBe(80);
    expect(ipo.lines[2].approvedQty).toBe(30);  // Clamped to requestedQty
    expect(ipo.auditTrail).toHaveLength(3);      // create + submit + approve
  });

  // ─── Test 3: Dispatch → line values and fulfillment rate ─────────────────
  it("dispatches with picks, computes lineValues and fulfillmentRate correctly", () => {
    let ipo = makeIPO();
    ipo = IPOEngine.submit(ipo, "MGR-DEL-01");
    ipo = IPOEngine.approve(ipo, "WH-MGR-MUM", [
      { lineId: "IPOL-1", approvedQty: 100 },
      { lineId: "IPOL-2", approvedQty: 50  },
      { lineId: "IPOL-3", approvedQty: 30  },
    ]);
    ipo = IPOEngine.startPicking(ipo, "PICKER-01");
    ipo = IPOEngine.dispatch(ipo, "DELHIVERY-8812", [
      { lineId: "IPOL-1", pickedQty: 100 },
      { lineId: "IPOL-2", pickedQty: 40  },   // Short — 10 short
      { lineId: "IPOL-3", pickedQty: 30  },
    ], "PICKER-01");

    expect(ipo.status).toBe("DISPATCHED");
    expect(ipo.dispatchRef).toBe("DELHIVERY-8812");
    // Line values: 100×120=12000, 40×250=10000, 30×350=10500
    expect(ipo.lines[0].lineValue).toBe(12000);
    expect(ipo.lines[1].lineValue).toBe(10000);
    expect(ipo.lines[2].lineValue).toBe(10500);
    expect(ipo.totalValue).toBe(32500);
    // Dispatched = 100+40+30 = 170 of 180 requested → 94.44%
    expect(ipo.totalDispatchedQty).toBe(170);
    expect(ipo.fulfillmentRate).toBeCloseTo(94.44, 1);
    expect(ipo.lines[1].lineStatus).toBe("PARTIAL");
  });

  // ─── Test 4: Auto-GRN — full receipt (no variance) → CLOSED ─────────────
  it("generates auto-GRN with full receipt — no variance — status AUTO_GRN, closeable", () => {
    let ipo = makeIPO();
    ipo = IPOEngine.submit(ipo, "MGR-DEL-01");
    ipo = IPOEngine.approve(ipo, "WH-MGR-MUM", [
      { lineId: "IPOL-1", approvedQty: 100 },
      { lineId: "IPOL-2", approvedQty: 50  },
      { lineId: "IPOL-3", approvedQty: 30  },
    ]);
    ipo = IPOEngine.startPicking(ipo, "PICKER-01");
    ipo = IPOEngine.dispatch(ipo, "BLUEDART-5511", [
      { lineId: "IPOL-1", pickedQty: 100 },
      { lineId: "IPOL-2", pickedQty: 50  },
      { lineId: "IPOL-3", pickedQty: 30  },
    ], "PICKER-01");

    // Full receipt — received = dispatched
    ipo = IPOEngine.generateAutoGRN(ipo, [
      { lineId: "IPOL-1", receivedQty: 100 },
      { lineId: "IPOL-2", receivedQty: 50  },
      { lineId: "IPOL-3", receivedQty: 30  },
    ], "RECV-DEL-01");

    expect(ipo.status).toBe("AUTO_GRN");
    expect(ipo.autoGRN).toBeDefined();
    expect(ipo.autoGRN!.hasVariance).toBe(false);
    expect(ipo.autoGRN!.totalReceived).toBe(180);
    expect(ipo.autoGRN!.totalDispatched).toBe(180);
    expect(ipo.autoGRN!.lines.every((l) => l.shortQty === 0)).toBe(true);

    // Close it
    const closed = IPOEngine.close(ipo, "MGR-DEL-01");
    expect(closed.status).toBe("CLOSED");
  });
});
