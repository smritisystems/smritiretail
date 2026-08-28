/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.109.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import ConsignmentEngine, { DEFAULT_AGING_CONFIG } from "../utils/consignmentEngine";

describe("ConsignmentEngine — Consignment Stock Engine", () => {
  const START = "2026-07-01";

  function makePlan() {
    return ConsignmentEngine.createPlan({
      vendorId:   "VNDR-001",
      vendorName: "Textile Exports Ltd",
      branchCode: "BR-MUM-01",
      termDays:   60,
      startDate:  START,
      lines: [
        { sku: "FAB-SILK-RED",    productName: "Silk Red 1m",     vendorCost: 600, receivedQty: 50 },
        { sku: "FAB-COTTON-WHT",  productName: "Cotton White 1m", vendorCost: 120, receivedQty: 100 },
        { sku: "ACC-SCARF-BLUE",  productName: "Blue Scarf",      vendorCost: 180, receivedQty: 40  },
      ],
    });
  }

  // ─── Test 1: Plan creation — initial state ────────────────────────────────
  it("creates plan with correct initial totalReceived, RECEIVED movements, and ACTIVE status", () => {
    const plan = makePlan();
    expect(plan.status).toBe("ACTIVE");
    expect(plan.lines).toHaveLength(3);
    expect(plan.totalReceived).toBe(190);   // 50+100+40
    expect(plan.totalSold).toBe(0);
    expect(plan.totalBilledAmt).toBe(0);
    expect(plan.movements).toHaveLength(3); // One RECEIVED per line
    expect(plan.movements.every((m) => m.type === "RECEIVED")).toBe(true);
    expect(plan.endDate).toBe("2026-08-30"); // 2026-07-01 + 60 days
    expect(plan.lines[0].onHandQty).toBe(50);
  });

  // ─── Test 2: Sales recording — billing ───────────────────────────────────
  it("records sales: reduces onHandQty, computes billedAmt correctly", () => {
    let plan = makePlan();
    const asOf = new Date("2026-07-20T00:00:00.000Z");
    plan = ConsignmentEngine.recordSales(plan, [
      { sku: "FAB-SILK-RED",   qty: 30, performedBy: "POS-01" },
      { sku: "FAB-COTTON-WHT", qty: 60, performedBy: "POS-01" },
    ], asOf);

    expect(plan.lines[0].soldQty).toBe(30);
    expect(plan.lines[0].onHandQty).toBe(20);
    expect(plan.lines[0].billedAmt).toBe(30 * 600);   // 18000
    expect(plan.lines[1].soldQty).toBe(60);
    expect(plan.lines[1].billedAmt).toBe(60 * 120);   // 7200
    expect(plan.totalSold).toBe(90);
    expect(plan.totalBilledAmt).toBe(18000 + 7200);   // 25200
    // Movement ledger: 3 RECEIVED + 2 SOLD
    expect(plan.movements.filter((m) => m.type === "SOLD")).toHaveLength(2);
    expect(plan.daysElapsed).toBe(19);                 // Jul 1 → Jul 20
    expect(plan.daysRemaining).toBe(41);               // 60 - 19
  });

  // ─── Test 3: Aging bands ─────────────────────────────────────────────────
  it("computes correct aging bands based on daysOnFloor", () => {
    const plan = makePlan();

    // Day 10 → FRESH (≤ 14)
    const d10 = ConsignmentEngine.getAgingReport(plan, new Date("2026-07-11T00:00:00.000Z"));
    expect(d10.every((i) => i.agingBand === "FRESH")).toBe(true);
    expect(d10.every((i) => i.daysOnFloor === 10)).toBe(true);

    // Day 45 → AGEING (30 < 45 ≤ 60)
    const d45 = ConsignmentEngine.getAgingReport(plan, new Date("2026-08-15T00:00:00.000Z"));
    expect(d45.every((i) => i.agingBand === "AGEING")).toBe(true);

    // Day 61 → CRITICAL (> 60) and returnDue
    const d61 = ConsignmentEngine.getAgingReport(plan, new Date("2026-09-01T00:00:00.000Z"));
    expect(d61.every((i) => i.agingBand === "CRITICAL")).toBe(true);
    expect(d61.every((i) => i.returnDue)).toBe(true);
  });

  // ─── Test 4: Return schedule + settlement ────────────────────────────────
  it("return schedule shows overdue items; settlement closes plan with correct billedAmt", () => {
    let plan = makePlan();
    const saleDate = new Date("2026-07-15T00:00:00.000Z");
    plan = ConsignmentEngine.recordSales(plan, [
      { sku: "FAB-SILK-RED", qty: 20, performedBy: "POS-01" },
    ], saleDate);

    // At day 65 — past term — all on-hand items overdue
    const overdue = new Date("2026-09-04T00:00:00.000Z");
    const schedule = ConsignmentEngine.getReturnSchedule(plan, overdue);
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule.every((i) => i.returnDue)).toBe(true);

    // Settle
    const settled = ConsignmentEngine.settle(plan, "VNDR-MGR-01", overdue);
    expect(settled.status).toBe("SETTLED");
    expect(settled.settlement).toBeDefined();
    expect(settled.settlement!.totalBilledAmt).toBe(20 * 600);  // 12000 (only silk sold)
    expect(settled.settlement!.totalSold).toBe(20);
    expect(settled.settlement!.totalReturnQty).toBeGreaterThan(0);
  });
});
