/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { LAUNCHPAD_CATALOG } from "../components/launchpad/FioriLaunchpad.tsx";

const REGISTERED_APP_TABS = [
  "dashboard",
  "launchpad",
  "pos",
  "sales",
  "create-tax-invoice",
  "customer-master",
  "crm",
  "loyalty",
  "profiles",
  "purchase",
  "supplier-mgmt",
  "business-ledger",
  "accounting-sync",
  "report-designer",
  "item-master",
  "item-create-grid",
  "barcode",
  "stock-ledger",
  "masters",
  "ufe",
  "formulas",
  "psv",
  "document-series",
  "approval-matrix",
  "staff-management",
  "user-profile",
  "print-studio",
  "print-history",
  "terms-engine",
  "data-exchange",
  "company-setup",
  "about-smriti",
  "dev-tracker",
  "audit-logs",
  "wiki",
  "training-academy"
];

describe("Fiori Launchpad Canonical Routing & Catalog Integrity", () => {
  it("should have all launchpad tile IDs in registered App tabs", () => {
    LAUNCHPAD_CATALOG.forEach((tile) => {
      expect(REGISTERED_APP_TABS).toContain(tile.id);
    });
  });

  it("should not contain deprecated legacy underscore tile IDs", () => {
    const invalidIds = ["item_master", "inventory", "suppliers", "reports", "dev_tracker", "system", "grn", "settings", "about"];
    LAUNCHPAD_CATALOG.forEach((tile) => {
      expect(invalidIds).not.toContain(tile.id);
    });
  });

  it("should group all tiles into valid enterprise operational sections", () => {
    const expectedGroups = [
      "Retail Operations",
      "Master Data & Stock",
      "Finance & Ledgers",
      "Documents & Print",
      "Data & Config",
      "System & Operations"
    ];

    const actualGroups = Array.from(new Set(LAUNCHPAD_CATALOG.map((t) => t.group)));
    expect(actualGroups.sort()).toEqual(expectedGroups.sort());
  });

  it("should have unique IDs for every launchpad tile", () => {
    const ids = LAUNCHPAD_CATALOG.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should have primary quick actions defined for mobile/touch fast-switching", () => {
    const quickActions = LAUNCHPAD_CATALOG.filter((t) => t.isQuickAction);
    expect(quickActions.length).toBeGreaterThanOrEqual(4);
    const qaIds = quickActions.map((t) => t.id);
    expect(qaIds).toContain("pos");
    expect(qaIds).toContain("item-master");
    expect(qaIds).toContain("stock-ledger");
    expect(qaIds).toContain("create-tax-invoice");
  });

  it("should allow cashiers access to core POS, Item Master, and Stock Ledger", () => {
    const cashierTiles = LAUNCHPAD_CATALOG.filter((t) => !t.roles || t.roles.includes("CASHIER"));
    const cashierIds = cashierTiles.map((t) => t.id);
    expect(cashierIds).toContain("pos");
    expect(cashierIds).toContain("item-master");
    expect(cashierIds).toContain("stock-ledger");
    expect(cashierIds).not.toContain("company-setup");
    expect(cashierIds).not.toContain("ufe");
  });
});
