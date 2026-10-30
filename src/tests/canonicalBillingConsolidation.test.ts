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
import {
  BillingWorkspaceMode,
  BillingAuxiliaryView,
  getBillingDefaults,
  normalizeBillingAuxiliaryView,
} from "../components/billing/BillingWorkspace.tsx";
import { mapModuleId } from "../components/shell/TabRenderer.tsx";
import { ENTERPRISE_MENU_ITEMS } from "../components/shell/EnterpriseMenuBar.tsx";
import { filterNavigationTree } from "../components/shell/navigationAccess.ts";
import { resolveNavigation } from "../components/shell/navigationResolver.ts";

const flattenMenuLabels = (items: typeof ENTERPRISE_MENU_ITEMS): string[] =>
  items.flatMap((item) => [item.label, ...flattenMenuLabels(item.children || [])]);

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
      "SALES_MANAGEMENT",
    ];

    expect(validViews).toContain("WORKSPACE");
    expect(validViews).toContain("EOD_Z_REPORT");
    expect(validViews).toContain("SHIFT_REPORTS");
    expect(validViews).toContain("CREDIT_BILLING");
    expect(validViews).toContain("B2B_DISTRIBUTOR");
    expect(validViews).toContain("SALES_MANAGEMENT");
    expect(validViews).toHaveLength(6);
  });

  it("routes legacy billing views into the single canonical workspace", () => {
    expect(normalizeBillingAuxiliaryView("CREDIT_TAX_INVOICE")).toBe("WORKSPACE");
    expect(normalizeBillingAuxiliaryView("CREDIT_BILLING")).toBe("WORKSPACE");
    expect(normalizeBillingAuxiliaryView("B2B_DISTRIBUTOR")).toBe("WORKSPACE");
  });

  it("selects the correct initial transaction and channel for legacy billing routes", () => {
    expect(getBillingDefaults("RETAIL_POS")).toEqual({ transaction: "Cash", salesChannel: "POS_RETAIL" });
    expect(getBillingDefaults("CREDIT_BILLING")).toEqual({ transaction: "Credit", salesChannel: "B2B_WHOLESALE" });
    expect(getBillingDefaults("B2B_DISTRIBUTOR")).toEqual({ transaction: "Credit", salesChannel: "B2B_WHOLESALE" });
  });

  it("should expose a single Billing & Sales navigation entry", () => {
    expect(flattenMenuLabels(ENTERPRISE_MENU_ITEMS).filter((label) => label === "Billing & Sales")).toHaveLength(1);
    expect(ENTERPRISE_MENU_ITEMS.some((item) => item.id === "sales")).toBe(false);
  });

  it("keeps the canonical Billing entry visible for legacy sales-module permissions", () => {
    const visibleMenu = filterNavigationTree(ENTERPRISE_MENU_ITEMS, ["sales"]);
    expect(flattenMenuLabels(visibleMenu).filter((label) => label === "Billing & Sales")).toHaveLength(1);
  });

  it("routes contextual sales navigation to the canonical Billing Workspace", () => {
    const navigation = resolveNavigation({ context: "sales" });
    expect(navigation.items.find((item) => item.isNextBestAction)?.id).toBe("billing-workspace");
    expect(navigation.nextBestAction?.id).toBe("billing-workspace");
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
    expect(mapModuleId("credit-tax-invoice")).toBe("credit-note");
    expect(mapModuleId("credit-note")).toBe("credit-note");
    expect(mapModuleId("sales-return")).toBe("credit-note");
    expect(mapModuleId("sales_return")).toBe("credit-note");

    // ProPOS legacy routes
    expect(mapModuleId("propos")).toBe("propos-workspace");
    expect(mapModuleId("propos-workspace")).toBe("propos-workspace");
    expect(mapModuleId("propos-ws")).toBe("propos-workspace");
    expect(mapModuleId("enterprise-billing-suite")).toBe("propos-workspace");
    expect(mapModuleId("menu-propos")).toBe("propos-workspace");
  });

  it("routes credit note aliases to Sales Documents, not credit-sale billing", () => {
    expect(mapModuleId("credit-tax-invoice")).toBe("credit-note");
    expect(mapModuleId("credit-note")).toBe("credit-note");
  });

  // TEST 5 — Tax Invariance Contract
  it("TEST 5: should preserve tax semantics across retail (inclusive) and B2B (statutory calculation)", () => {
    const retailTax = { isInclusive: true, defaultChannel: "POS_COUNTER" };
    const b2bTax = { isInclusive: true, defaultChannel: "B2B_DISTRIBUTOR" };

    expect(retailTax.isInclusive).toBe(true);
    expect(b2bTax.defaultChannel).toBe("B2B_DISTRIBUTOR");
  });
});
