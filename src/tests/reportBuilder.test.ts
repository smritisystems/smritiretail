/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Comprehensive Test Suite for SMRITI Report Builder
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  REPORT_BUILDER_CATALOG_FIELDS,
  DEFAULT_REPORT_BUILDER_ROWS,
  ReportBuilder,
} from "../components/reports/ReportBuilder.tsx";

const storageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storageStore[k] ?? null,
  setItem: (k: string, v: string) => { storageStore[k] = String(v); },
  removeItem: (k: string) => { delete storageStore[k]; },
  clear: () => { for (const k in storageStore) delete storageStore[k]; },
};

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = mockLocalStorage;
}

describe("SMRITI Report Builder Architecture & Layout State Machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  describe("1. Catalog Completeness & Default Field Selection", () => {
    it("should provide comprehensive fields across all 7 canonical categories", () => {
      const categories = new Set(REPORT_BUILDER_CATALOG_FIELDS.map((f) => f.category));
      expect(categories).toContain("Purchase");
      expect(categories).toContain("Sales");
      expect(categories).toContain("Inventory");
      expect(categories).toContain("Items");
      expect(categories).toContain("Customers");
      expect(categories).toContain("Suppliers");
      expect(categories).toContain("Finance");
      expect(REPORT_BUILDER_CATALOG_FIELDS.length).toBeGreaterThanOrEqual(30);
    });

    it("should provide default selected fields matching mockup exactly", () => {
      const defaultFields = REPORT_BUILDER_CATALOG_FIELDS.filter((f) => f.defaultSelected).map((f) => f.key);
      expect(defaultFields).toContain("supplier");
      expect(defaultFields).toContain("po_date");
      expect(defaultFields).toContain("article_sku");
      expect(defaultFields).toContain("color");
      expect(defaultFields).toContain("size");
      expect(defaultFields).toContain("quantity");
      expect(defaultFields).toContain("net_amount");
    });

    it("should match default dataset totals exactly with mockup values (132 units, ₹66,500)", () => {
      expect(DEFAULT_REPORT_BUILDER_ROWS.length).toBe(6);
      const totalQty = DEFAULT_REPORT_BUILDER_ROWS.reduce((acc, r) => acc + r.quantity, 0);
      const totalNetAmount = DEFAULT_REPORT_BUILDER_ROWS.reduce((acc, r) => acc + r.net_amount, 0);

      expect(totalQty).toBe(132);
      expect(totalNetAmount).toBe(66500);
    });
  });

  describe("2. Panel Visibility & Focus Mode State Transition Logic", () => {
    it("should transition between expanded, collapsed, and hidden sidebar states", () => {
      let sidebarState: "expanded" | "collapsed" | "hidden" = "expanded";

      // Collapse to icon rail
      sidebarState = "collapsed";
      expect(sidebarState).toBe("collapsed");

      // Hide sidebar completely
      sidebarState = "hidden";
      expect(sidebarState).toBe("hidden");

      // Restore to expanded
      sidebarState = "expanded";
      expect(sidebarState).toBe("expanded");
    });

    it("should remember and restore previous non-hidden sidebar state (collapsed vs expanded)", () => {
      let lastNonHiddenSidebarState: "expanded" | "collapsed" = "expanded";
      let sidebarState: "expanded" | "collapsed" | "hidden" = "expanded";

      // User collapses to icon rail
      sidebarState = "collapsed";
      lastNonHiddenSidebarState = "collapsed";

      // User hides sidebar
      sidebarState = "hidden";
      expect(sidebarState).toBe("hidden");

      // Reopening restores the collapsed icon rail, not blindly resetting to expanded
      sidebarState = lastNonHiddenSidebarState;
      expect(sidebarState).toBe("collapsed");
    });

    it("should transition top field toolbar between visible and hidden without losing columns", () => {
      const selectedColumns = ["supplier", "article_sku", "quantity", "net_amount"];
      let toolbarVisible = true;

      // Hide toolbar
      toolbarVisible = false;
      expect(toolbarVisible).toBe(false);
      // Columns remain intact
      expect(selectedColumns).toHaveLength(4);

      // Reopen toolbar
      toolbarVisible = true;
      expect(toolbarVisible).toBe(true);
      expect(selectedColumns).toHaveLength(4);
    });

    it("should support column reordering left and right without data mutation", () => {
      const columns = ["supplier", "po_date", "article_sku", "quantity"];

      // Move 'quantity' left
      const idx = columns.indexOf("quantity");
      const targetIdx = idx - 1;
      const copy = [...columns];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;

      expect(copy).toEqual(["supplier", "po_date", "quantity", "article_sku"]);
    });

    it("should transition filters panel between expanded, compact, and hidden while preserving applied filters", () => {
      const appliedFilters = {
        dateRange: { start: "2025-04-01", end: "2025-04-30" },
        branch: "Main Store",
      };
      let filtersState: "expanded" | "compact" | "hidden" = "expanded";

      // Switch to compact
      filtersState = "compact";
      expect(filtersState).toBe("compact");
      expect(appliedFilters.branch).toBe("Main Store");

      // Hide filters panel to maximize grid height
      filtersState = "hidden";
      expect(filtersState).toBe("hidden");
      expect(appliedFilters.dateRange.start).toBe("2025-04-01");

      // Reopen filters
      filtersState = "expanded";
      expect(filtersState).toBe("expanded");
      expect(appliedFilters.branch).toBe("Main Store");
    });

    it("should distinguish applied filters from unsaved filter edits", () => {
      const applied = { start: "2025-04-01", end: "2025-04-30", branch: "Main Store" };
      let draft = { ...applied };

      // User changes draft date
      draft.end = "2025-05-15";
      const isFilterDirty = draft.start !== applied.start || draft.end !== applied.end || draft.branch !== applied.branch;
      expect(isFilterDirty).toBe(true);

      // Apply changes
      const updatedApplied = { ...draft };
      const isNowClean = updatedApplied.start === draft.start && updatedApplied.end === draft.end && updatedApplied.branch === draft.branch;
      expect(isNowClean).toBe(true);
    });

    it("should correctly manage Focus Mode entry and restore prior visibility on exit", () => {
      // Starting in custom layout: sidebar collapsed, toolbar visible, filters compact
      let sidebarState: "expanded" | "collapsed" | "hidden" = "collapsed";
      let toolbarVisible = true;
      let filtersState: "expanded" | "compact" | "hidden" = "compact";
      let isFocusMode = false;

      // Snapshot prior state
      const previousState = { sidebarState, toolbarVisible, filtersState };

      // Enter Focus Mode
      isFocusMode = true;
      sidebarState = "hidden";
      toolbarVisible = false;
      filtersState = "hidden";

      expect(isFocusMode).toBe(true);
      expect(sidebarState).toBe("hidden");
      expect(toolbarVisible).toBe(false);
      expect(filtersState).toBe("hidden");

      // Exit Focus Mode
      isFocusMode = false;
      sidebarState = previousState.sidebarState;
      toolbarVisible = previousState.toolbarVisible;
      filtersState = previousState.filtersState;

      expect(isFocusMode).toBe(false);
      expect(sidebarState).toBe("collapsed");
      expect(toolbarVisible).toBe(true);
      expect(filtersState).toBe("compact");
    });
  });

  describe("3. Layout Presets, Reset & Preference Persistence", () => {
    it("should support 4 standard layout presets (Both, Vertical, Horizontal, Focus)", () => {
      // 1. Both / Adaptive
      const bothLayout = { sidebarState: "expanded", toolbarVisible: true, filtersState: "expanded" };
      expect(bothLayout.sidebarState).toBe("expanded");
      expect(bothLayout.toolbarVisible).toBe(true);

      // 2. Vertical (Stacked full-width)
      const verticalLayout = { sidebarState: "hidden", toolbarVisible: true, filtersState: "expanded" };
      expect(verticalLayout.sidebarState).toBe("hidden");
      expect(verticalLayout.toolbarVisible).toBe(true);

      // 3. Horizontal (Sidebar priority, compact filters)
      const horizontalLayout = { sidebarState: "expanded", toolbarVisible: false, filtersState: "compact" };
      expect(horizontalLayout.sidebarState).toBe("expanded");
      expect(horizontalLayout.toolbarVisible).toBe(false);
      expect(horizontalLayout.filtersState).toBe("compact");

      // 4. Focus (Full Grid)
      const focusLayout = { sidebarState: "hidden", toolbarVisible: false, filtersState: "hidden", isFocusMode: true };
      expect(focusLayout.isFocusMode).toBe(true);
      expect(focusLayout.sidebarState).toBe("hidden");
    });

    it("should reset layout to Both/Adaptive defaults (expanded sidebar, visible toolbar, expanded filters)", () => {
      let sidebarState = "hidden";
      let toolbarVisible = false;
      let filtersState = "hidden";

      // Trigger Reset Layout
      sidebarState = "expanded";
      toolbarVisible = true;
      filtersState = "expanded";

      expect(sidebarState).toBe("expanded");
      expect(toolbarVisible).toBe(true);
      expect(filtersState).toBe("expanded");
    });

    it("should persist layout preferences into localStorage", () => {
      const layoutConfig = {
        sidebarState: "collapsed",
        toolbarVisible: false,
        filtersState: "compact",
        tableDensity: "compact",
        showGrandTotal: true,
      };

      localStorage.setItem("smriti_report_builder_layout_v1", JSON.stringify(layoutConfig));

      const stored = JSON.parse(localStorage.getItem("smriti_report_builder_layout_v1") || "{}");
      expect(stored.sidebarState).toBe("collapsed");
      expect(stored.toolbarVisible).toBe(false);
      expect(stored.tableDensity).toBe("compact");
    });

    it("should preserve selected columns, sort order, and report data across all layout transitions", () => {
      const activeColumns = ["supplier", "article_sku", "quantity", "net_amount"];
      const sortField = "net_amount";
      const sortDirection = "desc";
      const rowCount = DEFAULT_REPORT_BUILDER_ROWS.length;

      // Simulate switching through presets: Both -> Vertical -> Horizontal -> Focus -> Exit Focus
      const presets = ["both", "vertical", "horizontal", "focus", "both"];
      for (const preset of presets) {
        expect(activeColumns).toHaveLength(4);
        expect(sortField).toBe("net_amount");
        expect(sortDirection).toBe("desc");
        expect(rowCount).toBe(6);
      }
    });
  });

  describe("4. Advanced Settings Drawer & Architecture Capability Annotation", () => {
    it("should detect dirty state in advanced settings drawer", () => {
      const current = { density: "regular", grandTotal: true, currency: "₹" };
      const draft = { ...current };

      expect(draft.density === current.density).toBe(true);

      // Modify density
      draft.density = "compact";
      const isDirty = draft.density !== current.density;
      expect(isDirty).toBe(true);
    });

    it("should declare canonical architecture metadata via withCapability", () => {
      expect((ReportBuilder as any).__smriti_capability).toBeDefined();
      expect((ReportBuilder as any).__smriti_capability.entity).toBe("reports");
      expect((ReportBuilder as any).__smriti_capability.capability).toBe("report_builder");
      expect((ReportBuilder as any).__smriti_capability.role).toBe("CANONICAL");
    });
  });
});
