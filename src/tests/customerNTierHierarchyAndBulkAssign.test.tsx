/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : N-Tier Hierarchy Tree & Bulk Assignment Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CustomerHierarchyTree } from "../components/customer/CustomerHierarchyTree.tsx";
import { BulkAssignCustomerModal } from "../components/customer/BulkAssignCustomerModal.tsx";
import { CustomerHierarchyModal } from "../components/customer/CustomerHierarchyModal.tsx";
import type {
  CustomerHierarchyTreeResponse,
  CustomerDirectoryItem,
  AssignableChildCandidate,
} from "../components/customer/types.ts";

describe("N-Tier Customer Hierarchy Tree & Bulk Assignment Suite", () => {
  const MOCK_TREE_RESPONSE: CustomerHierarchyTreeResponse = {
    target_customer_id: "cust-store-001",
    total_nodes: 4,
    max_depth: 2,
    is_multi_tier: true,
    root: {
      id: "cust-apex-corp",
      code: "PAR-APEX",
      name: "Apex Holding Corp",
      status: "Active",
      is_active: true,
      relationship_type: "root",
      depth: 0,
      path: ["PAR-APEX"],
      child_count: 1,
      parent_customer_id: null,
      parent_customer_code: null,
      parent_customer_name: null,
      children: [
        {
          id: "cust-north-hub",
          code: "HUB-NORTH",
          name: "North Zone Regional Hub",
          status: "Active",
          is_active: true,
          relationship_type: "parent",
          depth: 1,
          path: ["PAR-APEX", "HUB-NORTH"],
          child_count: 2,
          parent_customer_id: "cust-apex-corp",
          parent_customer_code: "PAR-APEX",
          parent_customer_name: "Apex Holding Corp",
          children: [
            {
              id: "cust-store-001",
              code: "STR-DELHI",
              name: "Delhi Central Outlet",
              status: "Active",
              is_active: true,
              relationship_type: "child",
              depth: 2,
              path: ["PAR-APEX", "HUB-NORTH", "STR-DELHI"],
              child_count: 0,
              parent_customer_id: "cust-north-hub",
              parent_customer_code: "HUB-NORTH",
              parent_customer_name: "North Zone Regional Hub",
              children: [],
            },
            {
              id: "cust-store-002",
              code: "STR-NOIDA",
              name: "Noida Sector 18 Store",
              status: "Active",
              is_active: true,
              relationship_type: "child",
              depth: 2,
              path: ["PAR-APEX", "HUB-NORTH", "STR-NOIDA"],
              child_count: 0,
              parent_customer_id: "cust-north-hub",
              parent_customer_code: "HUB-NORTH",
              parent_customer_name: "North Zone Regional Hub",
              children: [],
            },
          ],
        },
      ],
    },
  };

  const PARENT_ITEM: CustomerDirectoryItem = {
    id: "cust-apex-corp",
    code: "PAR-APEX",
    name: "Apex Holding Corp",
    mobile: "9820011111",
    customer_group_id: "CG-CORP",
    customer_group_name: "Corporate Enterprise",
    status: "Active",
    is_active: true,
    is_dependant: false,
    primary_account_name: null,
    primary_account_code: null,
    child_count: 3,
    relationship_type: "parent",
  };

  const STANDALONE_ITEM: CustomerDirectoryItem = {
    id: "cust-standalone-001",
    code: "STA-001",
    name: "Standalone Supermarket",
    mobile: "9820033333",
    customer_group_id: "CG-RETAIL",
    customer_group_name: "Retail General",
    status: "Active",
    is_active: true,
    is_dependant: false,
    primary_account_name: null,
    primary_account_code: null,
    child_count: 0,
    relationship_type: "standalone",
  };

  it("renders 3-tier recursive hierarchy tree with root holding, zonal hub, and store outlets", () => {
    const html = renderToString(
      <CustomerHierarchyTree
        tree={MOCK_TREE_RESPONSE}
        targetCustomerId="cust-store-001"
      />
    );

    expect(html).toContain("Ancestry Trail:");
    expect(html).toContain("Apex Holding Corp");
    expect(html).toContain("North Zone Regional Hub");
    expect(html).toContain("Delhi Central Outlet");
    expect(html).toContain("Noida Sector 18 Store");

    // Tier depth badges
    expect(html).toContain("Root Holding");
    expect(html).toContain("Zonal / Hub");
    expect(html).toContain("Tier 2 Outlet");

    // Multi-tier badge & counts
    expect(html).toContain("Multi-Tier Corporate Structure");
    expect(html).toContain("Total Nodes:");
    expect(html).toContain(">4</strong>");
    expect(html).toContain("Max Tier Depth:");
    expect(html).toContain(">2</strong>");

    // Current focus indicator
    expect(html).toContain("Current Focus");
  });

  it("renders bulk assign button on tree nodes when onOpenBulkAssign prop is provided", () => {
    const onBulkAssign = vi.fn();
    const html = renderToString(
      <CustomerHierarchyTree
        tree={MOCK_TREE_RESPONSE}
        targetCustomerId="cust-apex-corp"
        onOpenBulkAssign={onBulkAssign}
      />
    );

    expect(html).toContain("Assign");
    expect(html).toContain("data-testid=\"bulk-assign-btn-PAR-APEX\"");
    expect(html).toContain("data-testid=\"bulk-assign-btn-HUB-NORTH\"");
  });

  it("renders breadcrumb trail linking from root holding to leaf store", () => {
    const html = renderToString(
      <CustomerHierarchyTree
        tree={MOCK_TREE_RESPONSE}
        targetCustomerId="cust-store-001"
      />
    );

    expect(html).toContain("data-testid=\"breadcrumb-crumb-PAR-APEX\"");
    expect(html).toContain("data-testid=\"breadcrumb-crumb-HUB-NORTH\"");
    expect(html).toContain("data-testid=\"breadcrumb-crumb-STR-DELHI\"");
  });

  it("renders BulkAssignCustomerModal with parent customer code and name", () => {
    const html = renderToString(
      <BulkAssignCustomerModal
        isOpen={true}
        onClose={vi.fn()}
        parentCustomer={{
          id: "cust-apex-corp",
          code: "PAR-APEX",
          name: "Apex Holding Corp",
        }}
      />
    );

    expect(html).toContain("Bulk Assign Subordinate Accounts");
    expect(html).toContain("Apex Holding Corp");
    expect(html).toContain("PAR-APEX");
    expect(html).toContain("Search candidate accounts by name, code, or phone...");
    expect(html).toContain("Standalone Accounts Only");
    expect(html).toContain("Relationship Designation:");
    expect(html).toContain("Child Outlet");
    expect(html).toContain("Store Branch");
    expect(html).toContain("Regional Hub");
    expect(html).toContain("Division / Zonal Unit");
    expect(html).toContain("Franchise Partner");
    expect(html).toContain("Inherit Parent Billing Address");
    expect(html).toContain("Re-link from Prior Parent");
  });

  it("returns null when BulkAssignCustomerModal is closed", () => {
    const html = renderToString(
      <BulkAssignCustomerModal
        isOpen={false}
        onClose={vi.fn()}
        parentCustomer={{
          id: "cust-apex-corp",
          code: "PAR-APEX",
          name: "Apex Holding Corp",
        }}
      />
    );

    expect(html).toBe("");
  });

  it("renders bulk assign subordinate trigger button for parent account in CustomerHierarchyModal", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={PARENT_ITEM}
        onSelectCustomer={vi.fn()}
      />
    );

    expect(html).toContain("Bulk Assign Subordinates");
    expect(html).toContain("data-testid=\"open-bulk-assign-btn\"");
  });

  it("renders bulk assign trigger button for standalone account in CustomerHierarchyModal", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={STANDALONE_ITEM}
        onSelectCustomer={vi.fn()}
      />
    );

    expect(html).toContain("Standalone Account:");
    expect(html).toContain("Assign Subordinates");
    expect(html).toContain("data-testid=\"open-bulk-assign-standalone-btn\"");
  });
});
