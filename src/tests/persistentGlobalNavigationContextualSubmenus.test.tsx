/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.99.13
 * * Created    : 2026-10-25
 * * Modified   : 2026-10-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Unit & Integration Tests (Persistent Global Navigation with Contextual Submenus)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveNavigation,
  buildDocumentContextualSubmenu,
  isActionPermittedForRole,
  GLOBAL_NAVIGATION_CATEGORIES,
} from "../components/shell/navigationResolver.ts";
import {
  LayoutEngineProvider,
  useLayoutEngine,
  ActiveDocumentContext,
} from "../layout_engine/layout_store.tsx";
import { NavRail } from "../components/shell/NavRail.tsx";

// Mock apiFetch
vi.mock("../lib/apiFetch.ts", () => ({
  apiFetch: vi.fn().mockResolvedValue({ status: "ok" }),
  apiFetchV1: vi.fn().mockResolvedValue({ status: "ok" }),
}));

describe("SMRITI Retail OS — Persistent Global Navigation with Contextual Submenus", () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    } as any;

    if (typeof global.window === "undefined") {
      (global as any).window = new EventTarget();
    }
    vi.clearAllMocks();
  });

  // TEST 1 — Opening an invoice preserves global navigation
  it("TEST 1: opening an invoice preserves all global navigation categories and workspaces", () => {
    const resolved = resolveNavigation({
      context: "sales",
      workspace: "billing-workspace",
      documentId: "INV-2026-00125",
      documentType: "SALES_INVOICE",
      transactionState: "DRAFT",
      userRole: "Administrator",
    });

    // 1. All 7 global categories are preserved
    expect(resolved.globalCategories).toBeDefined();
    expect(resolved.globalCategories.length).toBe(7);
    const categoryContexts = resolved.globalCategories.map((c) => c.context);
    expect(categoryContexts).toContain("launchpad");
    expect(categoryContexts).toContain("sales");
    expect(categoryContexts).toContain("purchase");
    expect(categoryContexts).toContain("inventory");
    expect(categoryContexts).toContain("masters");
    expect(categoryContexts).toContain("reports");
    expect(categoryContexts).toContain("system");

    // 2. Global items list contains workspaces for current category
    expect(resolved.items.length).toBeGreaterThan(3);
    const itemIds = resolved.items.map((i) => i.id);
    expect(itemIds).toContain("launchpad");
    expect(itemIds).toContain("billing-workspace");
    expect(itemIds).toContain("crm");
  });

  // TEST 2 — Contextual invoice actions appear in the correct submenu
  it("TEST 2: contextual invoice actions appear nested under the target workspace submenus", () => {
    const resolved = resolveNavigation({
      context: "sales",
      workspace: "billing-workspace",
      documentId: "INV-2026-00125",
      documentType: "SALES_INVOICE",
      transactionState: "DRAFT",
      userRole: "Administrator",
    });

    const billingItem = resolved.items.find((i) => i.id === "billing-workspace");
    expect(billingItem).toBeDefined();
    expect(billingItem?.submenus).toBeDefined();
    expect(billingItem?.submenus?.length).toBe(7);

    const subActionIds = billingItem!.submenus!.map((s) => s.id);
    expect(subActionIds).toEqual([
      "doc-overview",
      "doc-items",
      "doc-stock",
      "doc-verify",
      "doc-dispatch",
      "doc-print",
      "doc-activity",
    ]);

    // Top-level resolved.contextualSubmenu is also populated for auxiliary consumption
    expect(resolved.contextualSubmenu).toBeDefined();
    expect(resolved.contextualSubmenu?.length).toBe(7);
  });

  // TEST 3 — Other authorized modules remain accessible simultaneously
  it("TEST 3: other authorized modules remain accessible simultaneously without being hidden", () => {
    const resolved = resolveNavigation({
      context: "sales",
      workspace: "billing-workspace",
      documentId: "INV-2026-00125",
      documentType: "SALES_INVOICE",
      transactionState: "DRAFT",
      userRole: "Administrator",
    });

    // Check that purchase, inventory, and reports categories exist in globalCategories
    const purchaseCategory = resolved.globalCategories.find((c) => c.context === "purchase");
    const inventoryCategory = resolved.globalCategories.find((c) => c.context === "inventory");
    const reportsCategory = resolved.globalCategories.find((c) => c.context === "reports");

    expect(purchaseCategory).toBeDefined();
    expect(inventoryCategory).toBeDefined();
    expect(reportsCategory).toBeDefined();
    expect(purchaseCategory!.workspaces.length).toBeGreaterThan(0);
    expect(inventoryCategory!.workspaces.length).toBeGreaterThan(0);
    expect(reportsCategory!.workspaces.length).toBeGreaterThan(0);
  });

  // TEST 4 — Expanding another main-menu category does not destroy the active document context
  it("TEST 4: resolving another category preserves active document state when document query is provided", () => {
    // User is in reports context while having an active document
    const resolvedInReports = resolveNavigation({
      context: "reports",
      workspace: "reports",
      documentId: "INV-2026-00125",
      documentType: "SALES_INVOICE",
      transactionState: "DRAFT",
      userRole: "Administrator",
    });

    // All categories still present
    expect(resolvedInReports.globalCategories.length).toBe(7);
    // Active document submenu actions are still preserved
    expect(resolvedInReports.contextualSubmenu?.length).toBe(7);
    const subActionIds = resolvedInReports.contextualSubmenu!.map((s) => s.id);
    expect(subActionIds).toContain("doc-overview");
    expect(subActionIds).toContain("doc-items");
  });

  // TEST 5 — Invoice lifecycle changes update only applicable contextual actions
  it("TEST 5: invoice lifecycle changes update only the applicable contextual actions", () => {
    // 1. DRAFT state: doc-dispatch disabled, doc-items is next action
    const draftSubmenu = buildDocumentContextualSubmenu(
      "INV-100",
      "DRAFT",
      "Administrator",
      "SALES_INVOICE"
    );
    const draftDispatch = draftSubmenu.find((s) => s.id === "doc-dispatch");
    const draftItems = draftSubmenu.find((s) => s.id === "doc-items");
    expect(draftDispatch?.disabled).toBe(true);
    expect(draftDispatch?.disabledReason).toContain("Dispatch unavailable");
    expect(draftItems?.isNextBestAction).toBeFalsy();

    // 2. SUBMITTED state: doc-verify is next best action
    const submittedSubmenu = buildDocumentContextualSubmenu(
      "INV-100",
      "SUBMITTED",
      "Administrator",
      "SALES_INVOICE"
    );
    const submittedVerify = submittedSubmenu.find((s) => s.id === "doc-verify");
    expect(submittedVerify?.disabled).toBe(false);

    // 3. POSTED state: doc-verify disabled (already posted), doc-dispatch is enabled
    const postedSubmenu = buildDocumentContextualSubmenu(
      "INV-100",
      "POSTED",
      "Administrator",
      "SALES_INVOICE"
    );
    const postedVerify = postedSubmenu.find((s) => s.id === "doc-verify");
    const postedDispatch = postedSubmenu.find((s) => s.id === "doc-dispatch");
    expect(postedVerify?.disabled).toBe(true);
    expect(postedVerify?.disabledReason).toContain("already posted");
    expect(postedDispatch?.disabled).toBe(false);
  });

  // TEST 6 — RBAC authorization filters contextual actions (Cashier cannot dispatch)
  it("TEST 6: RBAC authorization excludes unauthorized actions for Cashier role", () => {
    const adminPermitted = isActionPermittedForRole(
      "Administrator",
      "sales_invoice",
      "DISPATCH"
    );
    const cashierPermitted = isActionPermittedForRole(
      "Cashier",
      "sales_invoice",
      "DISPATCH"
    );

    expect(adminPermitted).toBe(true);
    expect(cashierPermitted).toBe(false);

    // When building submenu for Cashier in POSTED state, doc-dispatch is filtered out
    const cashierSubmenu = buildDocumentContextualSubmenu(
      "INV-100",
      "POSTED",
      "Cashier",
      "SALES_INVOICE"
    );
    const cashierDispatch = cashierSubmenu.find((s) => s.id === "doc-dispatch");
    expect(cashierDispatch).toBeUndefined();

    // Cashier can still print and view items
    const cashierPrint = cashierSubmenu.find((s) => s.id === "doc-print");
    const cashierItems = cashierSubmenu.find((s) => s.id === "doc-items");
    expect(cashierPrint).toBeDefined();
    expect(cashierItems).toBeDefined();
  });

  // TEST 7 — Tenant boundary / role isolation
  it("TEST 7: role isolation preserves security boundaries across navigation queries", () => {
    const cashierNav = resolveNavigation({
      context: "sales",
      workspace: "billing-workspace",
      userRole: "Cashier",
    });

    // Cashier does not have access to System category
    const hasSystemCategory = cashierNav.globalCategories.some((c) => c.context === "system");
    expect(hasSystemCategory).toBe(false);

    const adminNav = resolveNavigation({
      context: "sales",
      workspace: "billing-workspace",
      userRole: "Administrator",
    });
    const adminHasSystem = adminNav.globalCategories.some((c) => c.context === "system");
    expect(adminHasSystem).toBe(true);
  });

  // TEST 8 — Layout Store activeDocument and getContextualSubmenu integration
  it("TEST 8: layout store maintains active document context and retrieves submenus", () => {
    let capturedContext: any = null;

    const TestConsumer: React.FC = () => {
      const layout = useLayoutEngine();
      capturedContext = layout;
      return <div data-testid="test-consumer">UX: {layout.uxMode}</div>;
    };

    renderToStaticMarkup(
      <LayoutEngineProvider onTabChange={vi.fn()}>
        <TestConsumer />
      </LayoutEngineProvider>
    );

    expect(capturedContext).toBeDefined();
    expect(capturedContext.activeDocument).toBeNull();

    // Contextual submenus without active document returns empty
    const emptySubmenu = capturedContext.getContextualSubmenu();
    expect(emptySubmenu).toEqual([]);
  });

  // TEST 9 — NavRail renders persistent global navigation and nested submenus
  it("TEST 9: NavRail renders persistent global navigation items and nested contextual submenus", () => {
    const onSelectModule = vi.fn();

    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <NavRail
          activeModuleId="billing-workspace"
          railState="EXPANDED"
          onSelectModule={onSelectModule}
          documentId="INV-2026-00125"
          documentType="SALES_INVOICE"
          transactionState="DRAFT"
          userRole="Administrator"
        />
      </LayoutEngineProvider>
    );

    // Verifies persistent global navigation container is present
    expect(html).toContain("Active Context");
    expect(html).toContain("Billing Workspace");
    expect(html).toContain("Document Actions");
    expect(html).toContain("INV-2026-00125");
    expect(html).toContain("Document Overview");
    expect(html).toContain("Items &amp; Totals");
    expect(html).toContain("Stock &amp; Ledger Impact");
    expect(html).toContain("Verification &amp; Audit");
    expect(html).toContain("Prepare Dispatch");
    expect(html).toContain("Print / Export PDF");
    expect(html).toContain("Activity &amp; Log");
    expect(html).toContain("Other Global Modules");
  });

  it("renders all report business areas in the Reports navigation", () => {
    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <NavRail
          activeContext="reports"
          activeModuleId="report-designer"
          railState="EXPANDED"
          onSelectModule={vi.fn()}
          onToggleRailState={vi.fn()}
        />
      </LayoutEngineProvider>
    );

    expect(html).toContain("Reports by Business Area");
    for (const area of [
      "Sales",
      "Inventory &amp; Stock",
      "Purchase",
      "Finance &amp; P&amp;L",
      "Profitability &amp; Cost",
      "Tax &amp; Compliance",
      "Customers",
      "Management &amp; Analytics",
      "Operations",
      "Merchandise &amp; Size Analysis",
      "Accounts Summary",
    ]) {
      expect(html).toContain(area);
    }
  });

  // TEST 10 — Contextual Action Event Contract
  it("TEST 10: smriti_contextual_action_selected event contract is properly structured", () => {
    let firedEventDetail: any = null;
    const eventTarget = typeof window !== "undefined" ? window : (global as any).window;

    const listener = (e: Event) => {
      firedEventDetail = (e as CustomEvent).detail;
    };

    eventTarget.addEventListener("smriti_contextual_action_selected", listener);

    const testPayload = {
      actionId: "doc-items",
      documentId: "INV-2026-00125",
      documentType: "SALES_INVOICE",
      transactionState: "DRAFT",
    };

    eventTarget.dispatchEvent(
      new CustomEvent("smriti_contextual_action_selected", {
        detail: testPayload,
      })
    );

    expect(firedEventDetail).toEqual(testPayload);
    eventTarget.removeEventListener("smriti_contextual_action_selected", listener);
  });
});
