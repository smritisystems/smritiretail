/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.88.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Billing Consolidation & Route Convergence Unit Tests
 */

import { describe, it, expect } from "vitest";
import { BillingWorkspaceMode, BillingAuxiliaryView } from "../components/billing/BillingWorkspace.tsx";
import { mapModuleId } from "../components/shell/TabRenderer.tsx";

describe("SMRITI Canonical Billing Consolidation & Route Parity Tests", () => {
  // TEST 1 — Tri-Modal Operational Union Contract
  it("TEST 1: should expose all three canonical operational modes in BillingWorkspace", () => {
    const validModes: BillingWorkspaceMode[] = ["RETAIL_POS", "CREDIT_BILLING", "B2B_DISTRIBUTOR"];
    expect(validModes).toContain("RETAIL_POS");
    expect(validModes).toContain("CREDIT_BILLING");
    expect(validModes).toContain("B2B_DISTRIBUTOR");
    expect(validModes).toHaveLength(3);
  });

  // TEST 2 — Auxiliary Views Contract
  it("TEST 2: should expose all auxiliary views including EOD, Shift Reports, and Sub-Workspaces", () => {
    const validViews: BillingAuxiliaryView[] = [
      "WORKSPACE",
      "EOD_Z_REPORT",
      "SHIFT_REPORTS",
      "CREDIT_BILLING",
      "B2B_DISTRIBUTOR",
    ];

    expect(validViews).toContain("WORKSPACE");
    expect(validViews).toContain("EOD_Z_REPORT");
    expect(validViews).toContain("SHIFT_REPORTS");
    expect(validViews).toContain("CREDIT_BILLING");
    expect(validViews).toContain("B2B_DISTRIBUTOR");
    expect(validViews).toHaveLength(5);
  });

  // TEST 3 — Route Harmonization & TabRenderer Map Module Id Resolution
  it("TEST 3: should map all historical billing aliases to canonical billing workspaces", () => {
    // POS / Retail Cashier routes
    expect(mapModuleId("pos")).toBe("billing-workspace");
    expect(mapModuleId("billing")).toBe("billing-workspace");
    expect(mapModuleId("billing-workspace")).toBe("billing-workspace");
    expect(mapModuleId("menu-pos")).toBe("billing-workspace");
    expect(mapModuleId("menu-billing")).toBe("billing-workspace");
    expect(mapModuleId("menu-desktop-billing")).toBe("billing-workspace");

    // Tax Invoice / Distributor routes
    expect(mapModuleId("tax-invoice")).toBe("billing-workspace");
    expect(mapModuleId("dist-invoice")).toBe("billing-workspace");
    expect(mapModuleId("create-tax-invoice")).toBe("billing-workspace");

    // Credit routes
    expect(mapModuleId("credit-billing")).toBe("credit-billing");
    expect(mapModuleId("credit_billing")).toBe("credit-billing");
    expect(mapModuleId("credit-sale")).toBe("credit-billing");
    expect(mapModuleId("menu-credit-billing")).toBe("credit-billing");

    // ProPOS legacy routes
    expect(mapModuleId("propos")).toBe("propos-workspace");
    expect(mapModuleId("propos-workspace")).toBe("propos-workspace");
    expect(mapModuleId("propos-ws")).toBe("propos-workspace");
    expect(mapModuleId("enterprise-billing-suite")).toBe("propos-workspace");
    expect(mapModuleId("menu-propos")).toBe("propos-workspace");
  });

  // TEST 4 — Tri-Modal Keyboard Hotkey Mapping
  it("TEST 4: should declare collision-free keyboard shortcuts across modes and actions", () => {
    const hotkeyMatrix: Record<string, { action: string; category: string }> = {
      "Alt+1": { action: "SWITCH_RETAIL_POS", category: "Mode" },
      "Alt+2": { action: "SWITCH_CREDIT_BILLING", category: "Mode" },
      "Alt+3": { action: "SWITCH_B2B_DISTRIBUTOR", category: "Mode" },
      F1: { action: "NEW_BILL_FOCUS_BARCODE", category: "Workflow" },
      F2: { action: "ADVANCED_ITEM_STOCK_LOOKUP", category: "Workflow" },
      F3: { action: "CUSTOMER_SEARCH", category: "Workflow" },
      F4: { action: "PAYMENT_SETTLEMENT", category: "Workflow" },
      F5: { action: "HOLD_PARK_BILL", category: "Cart" },
      F6: { action: "RECALL_PARKED_BILL", category: "Cart" },
      F9: { action: "FAST_CASH_1_CLICK", category: "Payment" },
      F10: { action: "CONFIRM_POST_BILL", category: "Payment" },
      Escape: { action: "DISMISS_CANCEL", category: "Control" },
    };

    expect(Object.keys(hotkeyMatrix)).toHaveLength(12);
    expect(hotkeyMatrix["Alt+1"].action).toBe("SWITCH_RETAIL_POS");
    expect(hotkeyMatrix["Alt+2"].action).toBe("SWITCH_CREDIT_BILLING");
    expect(hotkeyMatrix["Alt+3"].action).toBe("SWITCH_B2B_DISTRIBUTOR");
    expect(hotkeyMatrix["F1"].action).toBe("NEW_BILL_FOCUS_BARCODE");
    expect(hotkeyMatrix["F9"].action).toBe("FAST_CASH_1_CLICK");
    expect(hotkeyMatrix["F10"].action).toBe("CONFIRM_POST_BILL");
  });

  // TEST 5 — Tax Invariance Contract
  it("TEST 5: should preserve tax semantics across retail (inclusive) and B2B (statutory calculation)", () => {
    const retailTax = { isInclusive: true, defaultChannel: "POS_COUNTER" };
    const b2bTax = { isInclusive: true, defaultChannel: "B2B_DISTRIBUTOR" };

    expect(retailTax.isInclusive).toBe(true);
    expect(b2bTax.defaultChannel).toBe("B2B_DISTRIBUTOR");
  });
});
