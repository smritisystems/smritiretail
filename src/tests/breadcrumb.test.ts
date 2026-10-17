/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: SMRITI Breadcrumb Engine v1.0 Automated Test Suite
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BreadcrumbRegistry,
  BreadcrumbResolver,
  fromLegacyStringArray,
  getBreadcrumbAriaLabel,
  getMobileTrail,
  getTerminalNode,
  isHomePage,
  isOverDepth,
  BREADCRUMB_HOME_NODE,
  BREADCRUMB_MAX_DEPTH,
  type BreadcrumbNode,
  type BreadcrumbResolutionContext,
} from "../navigation/breadcrumb/index.ts";
import type { WorkspaceConfig } from "../layout_engine/layout_store.tsx";

// ---------------------------------------------------------------------------
// Mock Workspaces Fixture
// ---------------------------------------------------------------------------

const MOCK_WORKSPACES: WorkspaceConfig[] = [
  { id: "launchpad", label: "Home", icon: "home", category: "root" },
  { id: "sales", label: "Sales & Billing", icon: "point_of_sale", category: "Operations" },
  { id: "billing-workspace", label: "Quick Billing", icon: "receipt", category: "Operations" },
  { id: "purchase", label: "Purchase & Procurement", icon: "shopping_cart", category: "Operations" },
  { id: "purchase-studio", label: "Purchase Studio", icon: "store", category: "Operations" },
  { id: "grn", label: "Goods Receipt Note", icon: "local_shipping", category: "Operations" },
  { id: "inventory", label: "Inventory & Stock", icon: "warehouse", category: "Inventory & Stock" },
  { id: "stock-ledger", label: "Stock Ledger", icon: "warehouse", category: "Inventory & Stock" },
  { id: "item-master", label: "Item Master Catalog", icon: "inventory_2", category: "Inventory & Stock" },
  { id: "masters", label: "Master Data", icon: "inventory_2", category: "Master Data" },
  { id: "crm", label: "CRM & Loyalty", icon: "badge", category: "CRM" },
  { id: "customer-master", label: "Customer Master", icon: "person_search", category: "CRM" },
  { id: "customer-master-create", label: "Add Customer", icon: "person_add", category: "CRM" },
  { id: "reports", label: "Reports & Analytics", icon: "analytics", category: "Finance" },
  { id: "report-designer", label: "BI Report Designer", icon: "analytics", category: "Finance" },
  { id: "system", label: "System Governance", icon: "admin_panel_settings", category: "System & Governance" },
];

describe("SMRITI Breadcrumb Engine v1.0", () => {
  let registry: BreadcrumbRegistry;
  let resolver: BreadcrumbResolver;

  beforeEach(() => {
    registry = new BreadcrumbRegistry(MOCK_WORKSPACES);
    resolver = new BreadcrumbResolver(registry);
  });

  // -------------------------------------------------------------------------
  // 1. Home / Launchpad Node Tests
  // -------------------------------------------------------------------------
  describe("Home / Launchpad Resolution", () => {
    it("renders single terminal Home node when activeModuleId is launchpad", () => {
      const trail = resolver.resolve({ activeModuleId: "launchpad" });
      expect(trail.nodes).toHaveLength(1);
      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[0].label).toBe("Home");
      expect(trail.nodes[0].isTerminal).toBe(true);
      expect(trail.nodes[0].href).toBeUndefined();
      expect(isHomePage(trail)).toBe(true);
    });

    it("renders single terminal Home node when activeModuleId is empty string", () => {
      const trail = resolver.resolve({ activeModuleId: "" });
      expect(trail.nodes).toHaveLength(1);
      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[0].isTerminal).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Top-Level Module Resolution
  // -------------------------------------------------------------------------
  describe("Top-Level Module Resolution", () => {
    it("renders 2 nodes (Home > Module) for top-level module", () => {
      const trail = resolver.resolve({ activeModuleId: "purchase" });
      expect(trail.nodes).toHaveLength(2);

      // Node 0: Home (navigable)
      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[0].label).toBe("Home");
      expect(trail.nodes[0].isTerminal).toBe(false);
      expect(trail.nodes[0].href).toBe("launchpad");

      // Node 1: Purchase (terminal)
      expect(trail.nodes[1].id).toBe("purchase");
      expect(trail.nodes[1].label).toBe("Purchase & Procurement");
      expect(trail.nodes[1].isTerminal).toBe(true);
      expect(trail.nodes[1].href).toBeUndefined();
    });

    it("correctly identifies non-home page", () => {
      const trail = resolver.resolve({ activeModuleId: "inventory" });
      expect(isHomePage(trail)).toBe(false);
      expect(getTerminalNode(trail)?.id).toBe("inventory");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Sub-Module Hierarchy Resolution
  // -------------------------------------------------------------------------
  describe("Sub-Module Hierarchy Resolution", () => {
    it("renders 3 nodes (Home > Parent > Sub-Module) for registered sub-module", () => {
      const trail = resolver.resolve({ activeModuleId: "purchase-studio" });
      expect(trail.nodes).toHaveLength(3);

      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[0].isTerminal).toBe(false);

      expect(trail.nodes[1].id).toBe("purchase");
      expect(trail.nodes[1].label).toBe("Purchase & Procurement");
      expect(trail.nodes[1].isTerminal).toBe(false);
      expect(trail.nodes[1].href).toBe("purchase");

      expect(trail.nodes[2].id).toBe("purchase-studio");
      expect(trail.nodes[2].label).toBe("Purchase Studio");
      expect(trail.nodes[2].isTerminal).toBe(true);
      expect(trail.nodes[2].href).toBeUndefined();
    });

    it("resolves multi-level hierarchy (Home > CRM > Customer Master > Add Customer)", () => {
      const trail = resolver.resolve({ activeModuleId: "customer-master-create" });
      expect(trail.nodes).toHaveLength(4);

      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[1].id).toBe("crm");
      expect(trail.nodes[2].id).toBe("customer-master");
      expect(trail.nodes[3].id).toBe("customer-master-create");
      expect(trail.nodes[3].isTerminal).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Dynamic Record Nodes
  // -------------------------------------------------------------------------
  describe("Dynamic Record Node Resolution", () => {
    it("appends dynamic terminal record node when documentId is provided", () => {
      const ctx: BreadcrumbResolutionContext = {
        activeModuleId: "purchase",
        documentId: "PUR-ORD-00000001",
        documentLabel: "PO #PUR-ORD-00000001",
      };
      const trail = resolver.resolve(ctx);

      expect(trail.nodes).toHaveLength(3);
      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[1].id).toBe("purchase");
      expect(trail.nodes[1].isTerminal).toBe(false);
      expect(trail.nodes[1].href).toBe("purchase");

      expect(trail.nodes[2].id).toBe("PUR-ORD-00000001");
      expect(trail.nodes[2].label).toBe("PO #PUR-ORD-00000001");
      expect(trail.nodes[2].isDynamic).toBe(true);
      expect(trail.nodes[2].isTerminal).toBe(true);
      expect(trail.nodes[2].href).toBeUndefined();
    });

    it("falls back to documentId when documentLabel is omitted", () => {
      const trail = resolver.resolve({
        activeModuleId: "sales",
        documentId: "INV-2026-081",
      });

      expect(trail.nodes).toHaveLength(3);
      expect(trail.nodes[2].label).toBe("INV-2026-081");
      expect(trail.nodes[2].isDynamic).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Unknown Module Graceful Fallback
  // -------------------------------------------------------------------------
  describe("Unknown Module Handling", () => {
    it("gracefully falls back to humanized label for unregistered module", () => {
      const trail = resolver.resolve({ activeModuleId: "unregistered-test-view" });
      expect(trail.nodes).toHaveLength(2);
      expect(trail.nodes[0].id).toBe("launchpad");
      expect(trail.nodes[1].id).toBe("unknown");
      expect(trail.nodes[1].label).toBe("Unregistered Test View");
      expect(trail.nodes[1].isTerminal).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Max Depth Enforcement
  // -------------------------------------------------------------------------
  describe("Max Depth Enforcement", () => {
    it("truncates trail from left (preserving Home) when exceeding maxDepth", () => {
      const ctx: BreadcrumbResolutionContext = {
        activeModuleId: "customer-master-create",
        documentId: "CUST-9999",
        documentLabel: "Customer #9999",
        maxDepth: 3, // Restrict to 3 nodes
      };

      const trail = resolver.resolve(ctx);
      expect(trail.nodes).toHaveLength(3);
      expect(trail.isTruncated).toBe(true);
      // Home is always preserved at position 0
      expect(trail.nodes[0].id).toBe("launchpad");
      // Terminal node is preserved at the end
      expect(trail.nodes[2].id).toBe("CUST-9999");
    });

    it("reports isOverDepth correctly", () => {
      const trail = resolver.resolve({ activeModuleId: "purchase" });
      expect(isOverDepth(trail)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Mobile View Truncation (getMobileTrail)
  // -------------------------------------------------------------------------
  describe("Mobile Trail Truncation", () => {
    it("collapses deep trail to last 2 nodes with leading ellipsis on mobile", () => {
      const fullTrail = resolver.resolve({
        activeModuleId: "customer-master-create",
        documentId: "CUST-001",
      });
      // fullTrail has 5 nodes: Home > CRM > Customer Master > Add Customer > CUST-001
      expect(fullTrail.nodes.length).toBeGreaterThan(2);

      const mobileTrail = getMobileTrail(fullTrail, 2);
      expect(mobileTrail.nodes).toHaveLength(3); // Ellipsis + 2 visible
      expect(mobileTrail.nodes[0].id).toBe("__ellipsis__");
      expect(mobileTrail.nodes[0].label).toBe("…");
      expect(mobileTrail.isTruncated).toBe(true);
      expect(mobileTrail.nodes[2].id).toBe("CUST-001");
    });

    it("does not truncate if trail length is within mobileVisibleCount", () => {
      const shortTrail = resolver.resolve({ activeModuleId: "purchase" });
      const mobileTrail = getMobileTrail(shortTrail, 2);
      expect(mobileTrail.nodes).toHaveLength(2);
      expect(mobileTrail.isTruncated).toBe(false);
      expect(mobileTrail.nodes[0].id).toBe("launchpad");
    });
  });

  // -------------------------------------------------------------------------
  // 8. Accessibility (ARIA)
  // -------------------------------------------------------------------------
  describe("Accessibility (ARIA)", () => {
    it("generates correct ARIA breadcrumb label", () => {
      const trail = resolver.resolve({
        activeModuleId: "purchase",
        documentId: "PUR-ORD-00000001",
        documentLabel: "PO PUR-ORD-00000001",
      });

      const ariaLabel = getBreadcrumbAriaLabel(trail);
      expect(ariaLabel).toBe(
        "Breadcrumb: Home / Purchase & Procurement / PO PUR-ORD-00000001",
      );
    });

    it("excludes ellipsis node from aria-label calculation", () => {
      const fullTrail = resolver.resolve({
        activeModuleId: "customer-master-create",
      });
      const mobileTrail = getMobileTrail(fullTrail, 2);
      const ariaLabel = getBreadcrumbAriaLabel(mobileTrail);
      expect(ariaLabel).not.toContain("…");
    });
  });

  // -------------------------------------------------------------------------
  // 9. Legacy String Array Compatibility
  // -------------------------------------------------------------------------
  describe("Legacy Compatibility Adapter", () => {
    it("converts legacy string array into valid BreadcrumbNode[]", () => {
      const segments = ["Home", "Inventory", "Item Master"];
      const nodes = fromLegacyStringArray(segments);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].label).toBe("Home");
      expect(nodes[0].isTerminal).toBe(false);
      expect(nodes[0].href).toBe("#");

      expect(nodes[2].label).toBe("Item Master");
      expect(nodes[2].isTerminal).toBe(true);
      expect(nodes[2].href).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 10. Registry Duplicate Route Detection
  // -------------------------------------------------------------------------
  describe("Registry Duplicate Route Detection", () => {
    it("detects duplicate workspace ids in registration list", () => {
      const duplicates = registry.detectDuplicates([
        ...MOCK_WORKSPACES,
        { id: "purchase", label: "Duplicate Purchase", icon: "cart", category: "Operations" },
      ]);
      expect(duplicates).toContain("purchase");
    });

    it("returns empty array when there are no duplicates", () => {
      const duplicates = registry.detectDuplicates(MOCK_WORKSPACES);
      expect(duplicates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 11. Independence from DrillDownBreadcrumbs
  // -------------------------------------------------------------------------
  describe("Isolation from DrillDownBreadcrumbs", () => {
    it("operates with zero coupling to DrillDownContext or drilldown_store", () => {
      // BreadcrumbResolver is a pure TypeScript engine that takes a plain context object
      const trail = resolver.resolve({ activeModuleId: "stock-ledger" });
      expect(trail.nodes.length).toBeGreaterThanOrEqual(2);
      // Nodes adhere to BreadcrumbNode contract and do not require DrillContextData
      expect(trail.nodes[0]).toHaveProperty("id");
      expect(trail.nodes[0]).toHaveProperty("label");
      expect(trail.nodes[0]).toHaveProperty("isTerminal");
      expect(trail.nodes[0]).not.toHaveProperty("entityType");
    });
  });

  // -------------------------------------------------------------------------
  // 12. Query Parameters and Unrouted Tabs Exclusion Policy
  // -------------------------------------------------------------------------
  describe("Query Parameter and Tab Exclusion Policy", () => {
    it("enforces that URL query parameters and non-routable tab state are excluded", () => {
      // Any query params or tab identifiers passed in external state are not mapped
      // to nodes unless explicitly registered as workspaces
      const trail = resolver.resolve({
        activeModuleId: "purchase",
        // The resolution context has no query params field by design
      });
      // Must contain only Home and Purchase & Procurement
      expect(trail.nodes.map((n) => n.id)).toEqual(["launchpad", "purchase"]);
    });
  });
});
