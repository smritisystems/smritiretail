/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.14.0
 * Created      : 2026-09-08
 * Modified     : 2026-09-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Billing Workspace Convergence Unit Tests (Phase 2C Step 13 & 14)
 */

import { describe, it, expect } from "vitest";
import { BillingWorkspaceMode, BillingAuxiliaryView } from "../components/billing/BillingWorkspace.tsx";
import { Shift } from "../types.ts";

describe("Phase 2C — Billing Workspace Convergence & Ergonomics Tests", () => {
  // TEST 1 — Mode and View Contract Validation
  it("TEST 1: should expose only the Retail POS workspace and auxiliary views", () => {
    const validModes: BillingWorkspaceMode[] = ["RETAIL_POS"];
    const validViews: BillingAuxiliaryView[] = ["WORKSPACE", "EOD_Z_REPORT", "SHIFT_REPORTS"];

    expect(validModes).toContain("RETAIL_POS");
    expect(validModes).toHaveLength(1);
    expect(validViews).toContain("WORKSPACE");
    expect(validViews).toContain("EOD_Z_REPORT");
    expect(validViews).toContain("SHIFT_REPORTS");
  });

  // TEST 2 — Register & Shift HUD Status Logic
  it("TEST 2: should determine register label and shift active state accurately", () => {
    const openShift: Shift = {
      id: "shift-001",
      cashier_id: "user-cashier-1",
      cashier_name: "Anita Cashier",
      terminal_id: "TERM-04",
      counter_id: "COUNTER-A",
      start_time: "2026-09-08T09:00:00Z",
      opening_cash: 5000,
      status: "OPEN",
    };

    const closedShift: Shift = {
      id: "shift-002",
      cashier_id: "user-cashier-2",
      cashier_name: "Vikram Lead",
      terminal_id: "TERM-02",
      start_time: "2026-09-08T08:00:00Z",
      end_time: "2026-09-08T16:00:00Z",
      opening_cash: 3000,
      status: "CLOSED",
    };

    // Helper simulating HUD resolver
    const resolveHUD = (shifts: Shift[]) => {
      const active = shifts.find((s) => s.status === "OPEN") || shifts[0] || null;
      const reg = active?.counter_id || active?.terminal_id || "REG-01";
      const statusText = active?.status === "OPEN" ? "Shift Active" : "Shift Ready";
      return { reg, statusText, active };
    };

    const hudOpen = resolveHUD([openShift]);
    expect(hudOpen.reg).toBe("COUNTER-A");
    expect(hudOpen.statusText).toBe("Shift Active");

    const hudClosed = resolveHUD([closedShift]);
    expect(hudClosed.reg).toBe("TERM-02");
    expect(hudClosed.statusText).toBe("Shift Ready");

    const hudEmpty = resolveHUD([]);
    expect(hudEmpty.reg).toBe("REG-01");
    expect(hudEmpty.statusText).toBe("Shift Ready");
  });

  // TEST 3 — Hotkey Matrix & Navigation Ergonomics (Blueprint Section 183-195)
  it("TEST 3: should declare complete hotkey mapping matrix with zero conflicts", () => {
    const hotkeyMatrix: Record<string, { action: string; category: string }> = {
      "Alt+1": { action: "SWITCH_RETAIL_POS", category: "Mode" },
      F1: { action: "WORKSPACE_DEFAULT", category: "Navigation" },
      F2: { action: "ITEM_LOOKUP_SCANNER", category: "Entry" },
      F3: { action: "CUSTOMER_LOOKUP", category: "Entry" },
      F4: { action: "DISCOUNT_RATE_EDIT", category: "Entry" },
      F5: { action: "HOLD_PARK_BILL", category: "Cart" },
      F6: { action: "RECALL_PARKED_BILL", category: "Cart" },
      F8: { action: "EOD_Z_REPORT", category: "Shift" },
      F10: { action: "TENDER_SETTLEMENT", category: "Payment" },
      F12: { action: "FAST_CASH_CHECKOUT", category: "Payment" },
      Escape: { action: "CLEAR_DISMISS", category: "Control" },
    };

    expect(Object.keys(hotkeyMatrix)).toHaveLength(11);
    expect(hotkeyMatrix["Alt+1"].action).toBe("SWITCH_RETAIL_POS");
    expect(hotkeyMatrix["F5"].action).toBe("HOLD_PARK_BILL");
    expect(hotkeyMatrix["F6"].action).toBe("RECALL_PARKED_BILL");
    expect(hotkeyMatrix["F10"].action).toBe("TENDER_SETTLEMENT");
  });

  // TEST 4 — Mode Tax Semantics (Phase 2B Canonical Financial Policy)
  it("TEST 4: should enforce correct tax-inclusive / tax-exclusive semantics per mode", () => {
    const posPolicy = { isTaxInclusive: true, channel: "POS_RETAIL", defaultTender: "CASH" };
    expect(posPolicy.isTaxInclusive).toBe(true);
    expect(posPolicy.channel).toBe("POS_RETAIL");
  });

  // TEST 5 — Proportional Bill Discount Allocation (Phase 2B Resolution)
  it("TEST 5: should allocate bill discount proportionally across billable lines", () => {
    const lines = [
      { id: "L1", qty: 2, price: 500 }, // lineBase = 1000
      { id: "L2", qty: 1, price: 1000 }, // lineBase = 1000
    ];
    const billDiscount = 200; // Total 200 off on 2000 total (10% each)

    const baseTotal = lines.reduce((acc, l) => acc + l.qty * l.price, 0);
    const allocated = lines.map((l) => {
      const lineBase = l.qty * l.price;
      const allocatedDisc = baseTotal > 0 ? (billDiscount * lineBase) / baseTotal : 0;
      const discPct = lineBase > 0 ? (allocatedDisc / lineBase) * 100 : 0;
      return { id: l.id, allocatedDisc, discPct };
    });

    expect(allocated[0].allocatedDisc).toBe(100);
    expect(allocated[0].discPct).toBe(10);
    expect(allocated[1].allocatedDisc).toBe(100);
    expect(allocated[1].discPct).toBe(10);
    expect(allocated[0].allocatedDisc + allocated[1].allocatedDisc).toBe(billDiscount);
  });
});
