/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.111.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import CashDrawerEngine, {
  Denomination, STANDARD_DENOMINATIONS,
} from "../utils/cashDrawerEngine";

describe("CashDrawerEngine — Store Cash Drawer & Float Management Engine", () => {

  const BASE = { branchCode: "BR-MUM-01", posTerminal: "POS-01", shiftId: "SHIFT-001", openedBy: "CASHIER-007" };

  const OPENING_DENOMS: Denomination[] = [
    { value: 500, count: 4 },   // 2000
    { value: 100, count: 10 },  // 1000
    { value: 50,  count: 4 },   // 200
    { value: 20,  count: 5 },   // 100
    { value: 10,  count: 10 },  // 100
    { value: 5,   count: 10 },  // 50
    { value: 2,   count: 10 },  // 20
    { value: 1,   count: 30 },  // 30
  ];
  // Total: 2000+1000+200+100+100+50+20+30 = 3500

  // ─── Test 1: Open drawer with denomination count ───────────────────────────
  it("opens drawer with correct opening float computed from denominations", () => {
    const drawer = CashDrawerEngine.openDrawer({ ...BASE, denominations: OPENING_DENOMS });

    expect(drawer.status).toBe("OPEN");
    expect(drawer.openingFloat).toBe(3500);
    expect(drawer.currentBalance).toBe(3500);
    expect(drawer.expectedCash).toBe(3500);
    expect(drawer.movements).toHaveLength(1);
    expect(drawer.movements[0].kind).toBe("OPENING_FLOAT");
    expect(drawer.auditTrail).toHaveLength(1);
    expect(drawer.auditTrail[0].action).toBe("DRAWER_OPENED");
  });

  // ─── Test 2: Cash movements — in/out and balance tracking ─────────────────
  it("records CASH_IN and CASH_OUT and updates currentBalance and expectedCash correctly", () => {
    let drawer = CashDrawerEngine.openDrawer({ ...BASE, denominations: OPENING_DENOMS });

    // Cash In: office petty cash addition ₹500
    drawer = CashDrawerEngine.recordMovement(drawer, "CASH_IN", 500, "CASHIER-007", "Petty cash top-up");
    expect(drawer.currentBalance).toBe(4000);
    expect(drawer.totalCashIn).toBe(500);
    expect(drawer.expectedCash).toBe(4000);

    // Sale ₹1200
    drawer = CashDrawerEngine.recordMovement(drawer, "SALE", 1200, "CASHIER-007", "Invoice INV-0001");
    expect(drawer.netSales).toBe(1200);
    expect(drawer.currentBalance).toBe(5200);
    expect(drawer.expectedCash).toBe(5200);

    // Cash Out: change given back ₹300
    drawer = CashDrawerEngine.recordMovement(drawer, "CASH_OUT", 300, "CASHIER-007", "Change given — INV-0002");
    expect(drawer.totalCashOut).toBe(300);
    expect(drawer.currentBalance).toBe(4900);
    expect(drawer.expectedCash).toBe(4900);

    // 3 movements + opening = 4 total
    expect(drawer.movements).toHaveLength(4);
    expect(drawer.auditTrail).toHaveLength(4);
  });

  // ─── Test 3: EOD reconciliation — BALANCED within threshold ───────────────
  it("reconciles BALANCED when physical count matches expected within ₹5 threshold", () => {
    let drawer = CashDrawerEngine.openDrawer({ ...BASE, denominations: OPENING_DENOMS });
    drawer = CashDrawerEngine.recordMovement(drawer, "SALE",     2000, "CASHIER-007", "Morning sales");
    drawer = CashDrawerEngine.recordMovement(drawer, "CASH_OUT",  200, "CASHIER-007", "Petty expense");
    // Expected: 3500 + 2000 - 200 = 5300

    const physicalCount: Denomination[] = [
      { value: 500, count: 10 },  // 5000
      { value: 100, count: 3 },   // 300
    ];
    // Actual: 5300 → matches expected → BALANCED

    const reconciled = CashDrawerEngine.reconcile(drawer, "SHIFT-MGR-001", physicalCount, 5);
    expect(reconciled.status).toBe("RECONCILED");
    expect(reconciled.reconciliation!.status).toBe("BALANCED");
    expect(reconciled.reconciliation!.expectedCash).toBe(5300);
    expect(reconciled.reconciliation!.actualCash).toBe(5300);
    expect(reconciled.reconciliation!.variance).toBe(0);
    expect(reconciled.auditTrail.at(-1)!.action).toBe("EOD_RECONCILE_BALANCED");
  });

  // ─── Test 4: EOD SHORT and shift summary ──────────────────────────────────
  it("reconciles SHORT on physical shortfall and shift summary aggregates correctly", () => {
    let d1 = CashDrawerEngine.openDrawer({ ...BASE, posTerminal: "POS-01", denominations: OPENING_DENOMS });
    d1 = CashDrawerEngine.recordMovement(d1, "SALE", 1000, "CASHIER-007", "Sales");
    // Expected: 4500 → physical 4480 → SHORT by 20
    const physD1: Denomination[] = [{ value: 500, count: 8 }, { value: 100, count: 4 }, { value: 50, count: 3 }, { value: 10, count: 3 }];
    // 4000 + 400 + 150 + 30 = 4580 → variance = 4580 - 4500 = +80 → OVER
    // Deliberately use a short count
    const shortCount: Denomination[] = [{ value: 500, count: 8 }, { value: 100, count: 4 }];
    // 4000 + 400 = 4400 → variance = 4400 - 4500 = -100 → SHORT
    const r1 = CashDrawerEngine.reconcile(d1, "MGR-001", shortCount, 5);
    expect(r1.reconciliation!.status).toBe("SHORT");
    expect(r1.reconciliation!.variance).toBe(-100);

    // Second drawer — open only, unreconciled
    const d2 = CashDrawerEngine.openDrawer({ ...BASE, posTerminal: "POS-02", denominations: [{ value: 500, count: 2 }] });
    // openingFloat = 1000

    const summary = CashDrawerEngine.shiftSummary([r1, d2]);
    expect(summary.totalOpeningFloat).toBe(3500 + 1000);   // 4500
    expect(summary.totalNetSales).toBe(1000);
    expect(summary.short).toBe(1);
    expect(summary.balanced).toBe(0);
    expect(summary.unreconciled).toBe(1);
  });
});
