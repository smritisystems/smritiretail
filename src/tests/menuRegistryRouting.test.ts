/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.72.9
 * Created      : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Menu Registry & Routing Parity Unit Tests
 */

import { describe, it, expect } from "vitest";
import { mapModuleId } from "../components/shell/TabRenderer";

describe("SMRITI — Menu Registry & Routing Parity Tests", () => {
  const CANONICAL_39_MENU_IDS = [
    "menu-dashboard",
    "menu-user-profile",
    "menu-wiki",
    "menu-sales-promotions",
    "menu-about-smriti",
    "menu-dev-tracker",
    "menu-pos",
    "menu-desktop-billing",
    "menu-sales",
    "menu-customer-master",
    "menu-crm",
    "menu-loyalty",
    "menu-profiles",
    "menu-inventory",
    "menu-item-master",
    "menu-price-revision",
    "menu-barcode",
    "menu-stock-ledger",
    "menu-purchase",
    "menu-grn",
    "menu-supplier-mgmt",
    "menu-business-ledger",
    "menu-accounting-sync",
    "menu-reports",
    "menu-report-designer",
    "menu-masters",
    "menu-ufe",
    "menu-formulas",
    "menu-psv",
    "menu-document-series",
    "menu-print-studio",
    "menu-print-history",
    "menu-terms-engine",
    "menu-data-exchange",
    "menu-staff-management",
    "menu-approval-matrix",
    "menu-company-setup",
    "menu-audit-logs",
    "menu-manager",
    "menu-security",
  ];

  it("should map all 39 canonical smriti_menus IDs without falling back to raw unhandled IDs", () => {
    for (const menuId of CANONICAL_39_MENU_IDS) {
      const resolved = mapModuleId(menuId);
      expect(resolved).toBeDefined();
      expect(resolved).not.toBe("");
      // Verify resolved ID does not retain the unhandled "menu-" prefix (unless intentionally named like menu-manager)
      if (menuId !== "menu-manager") {
        expect(resolved.startsWith("menu-")).toBe(false);
      } else {
        expect(resolved).toBe("menu-manager");
      }
    }
  });

  it("should specifically resolve formerly disconnected menus to valid workspace tabs", () => {
    expect(mapModuleId("menu-wiki")).toBe("wiki");
    expect(mapModuleId("menu-about-smriti")).toBe("about-smriti");
    expect(mapModuleId("menu-dev-tracker")).toBe("dev-tracker");
    expect(mapModuleId("menu-profiles")).toBe("profiles");
    expect(mapModuleId("menu-security")).toBe("security-management");
    expect(mapModuleId("menu-grn")).toBe("grn-studio");
    expect(mapModuleId("menu-price-revision")).toBe("price-revision");
    expect(mapModuleId("price-revision")).toBe("price-revision");
  });

  it("should map modern warehouse and operational modules", () => {
    expect(mapModuleId("menu-wms")).toBe("wms");
    expect(mapModuleId("menu-attendance")).toBe("attendance-workspace");
    expect(mapModuleId("menu-attendance-workspace")).toBe("attendance-workspace");
    expect(mapModuleId("menu-dispatch-studio")).toBe("dispatch-studio");
    expect(mapModuleId("menu-communicator")).toBe("communicator");
    expect(mapModuleId("menu-propos")).toBe("propos-workspace");
    expect(mapModuleId("menu-doc-studio")).toBe("document-studio");
  });
});
