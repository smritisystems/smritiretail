/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Customer Hierarchy Directory & Modal Unit Test Suite
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CustomerHierarchyModal } from "../components/customer/CustomerHierarchyModal.tsx";
import { CustomerHierarchyTree } from "../components/customer/corporateWorkspace/CustomerHierarchyTree.tsx";
import { CustomerDirectoryRelationshipCell } from "../components/customer/CustomerDirectoryRelationshipCell.tsx";
import { CustomerDirectoryItem, RetailCustomerRecord } from "../components/customer/types.ts";

describe("Customer Hierarchy Directory & Modal Verification Suite", () => {
  const PARENT_ITEM: CustomerDirectoryItem = {
    id: "cust-parent-001",
    code: "PAR-001",
    name: "Apex Holdings Pvt Ltd",
    mobile: "9820011111",
    customer_group_id: "CG-CORP",
    customer_group_name: "Corporate Enterprise",
    status: "Active",
    is_active: true,
    is_dependant: false,
    primary_account_name: null,
    primary_account_code: null,
    child_count: 3,
    relationship_type: "parent"
  };

  const CHILD_ACTIVE_PARENT_ITEM: CustomerDirectoryItem = {
    id: "cust-child-001",
    code: "CHD-001",
    name: "Apex Retail Bandra Flagship",
    mobile: "9820022222",
    customer_group_id: "CG-RETAIL",
    customer_group_name: "Retail Corporate",
    status: "Active",
    is_active: true,
    is_dependant: true,
    parent_customer_code: "PAR-001",
    parent_customer_name: "Apex Holdings Pvt Ltd",
    primary_account_name: "Apex Holdings Pvt Ltd",
    primary_account_code: "PAR-001",
    primary_account_status: "Active",
    primary_account_is_active: true,
    child_count: 0,
    relationship_type: "child"
  };

  const CHILD_INACTIVE_PARENT_ITEM: CustomerDirectoryItem = {
    id: "cust-child-002",
    code: "CHD-002",
    name: "Apex Retail Andheri Hub",
    mobile: "9820033333",
    customer_group_id: "CG-RETAIL",
    customer_group_name: "Retail Corporate",
    status: "Active",
    is_active: true,
    is_dependant: true,
    parent_customer_code: "PAR-001",
    parent_customer_name: "Apex Holdings Pvt Ltd",
    primary_account_name: "Apex Holdings Pvt Ltd",
    primary_account_code: "PAR-001",
    primary_account_status: "Inactive",
    primary_account_is_active: false,
    child_count: 0,
    relationship_type: "child"
  };

  const CHILD_MISSING_PARENT_ITEM: CustomerDirectoryItem = {
    id: "cust-child-003",
    code: "CHD-003",
    name: "Orphaned Retail Subsidiary",
    mobile: "9820044444",
    customer_group_id: "CG-RETAIL",
    customer_group_name: "Retail Corporate",
    status: "Active",
    is_active: true,
    is_dependant: true,
    parent_customer_code: null,
    parent_customer_name: null,
    primary_account_name: null,
    primary_account_code: null,
    primary_account_status: null,
    primary_account_is_active: null,
    child_count: 0,
    relationship_type: "child"
  };

  const STANDALONE_ITEM: CustomerDirectoryItem = {
    id: "cust-standalone-001",
    code: "STA-001",
    name: "Independent High Street Mart",
    mobile: "9820055555",
    customer_group_id: "CG-GENERAL",
    customer_group_name: "General Retail",
    status: "Active",
    is_active: true,
    is_dependant: false,
    primary_account_name: null,
    primary_account_code: null,
    child_count: 0,
    relationship_type: "standalone"
  };

  it("renders CustomerHierarchyModal for a Parent account with child count and filter triggers", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={PARENT_ITEM}
        onSelectCustomer={vi.fn()}
        onFilterDirectoryByParent={vi.fn()}
      />
    );

    expect(html).toContain("Customer Parent–Child Hierarchy");
    expect(html).toContain("Apex Holdings Pvt Ltd");
    expect(html).toContain("PAR-001");
    expect(html).toContain("Parent Account");
    expect(html).toContain("Corporate Parent Account:");
    expect(html).toContain("Filter Directory to Children");
    expect(html).toContain("Hierarchy Account Roster");
  });

  it("renders CustomerHierarchyModal for a Child account with linked subordinate badge and parent info", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={CHILD_ACTIVE_PARENT_ITEM}
        onSelectCustomer={vi.fn()}
        onFilterDirectoryByParent={vi.fn()}
      />
    );

    expect(html).toContain("Customer Parent–Child Hierarchy");
    expect(html).toContain("Apex Retail Bandra Flagship");
    expect(html).toContain("CHD-001");
    expect(html).toContain("Child Account");
    expect(html).toContain("Linked Subordinate Child:");
    expect(html).toContain("Apex Holdings Pvt Ltd");
    expect(html).toContain("PAR-001");
  });

  it("renders CustomerHierarchyModal for a Standalone account with clean standalone badge and no hierarchy tree", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={STANDALONE_ITEM}
        onSelectCustomer={vi.fn()}
        onFilterDirectoryByParent={vi.fn()}
      />
    );

    expect(html).toContain("Customer Parent–Child Hierarchy");
    expect(html).toContain("Independent High Street Mart");
    expect(html).toContain("STA-001");
    expect(html).toContain("Standalone Account:");
    expect(html).toContain("Operates as an independent retail or commercial entity. No corporate parent or linked child accounts.");
  });

  it("renders CustomerHierarchyModal for a Child account with missing parent gracefully without crashing", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={true}
        onClose={vi.fn()}
        customerItem={CHILD_MISSING_PARENT_ITEM}
        onSelectCustomer={vi.fn()}
        onFilterDirectoryByParent={vi.fn()}
      />
    );

    expect(html).toContain("Customer Parent–Child Hierarchy");
    expect(html).toContain("Orphaned Retail Subsidiary");
    expect(html).toContain("CHD-003");
    expect(html).toContain("Child Account");
  });

  it("does not render when isOpen is false", () => {
    const html = renderToString(
      <CustomerHierarchyModal
        isOpen={false}
        onClose={vi.fn()}
        customerItem={PARENT_ITEM}
        onSelectCustomer={vi.fn()}
      />
    );

    expect(html).toBe("");
  });

  describe("CustomerDirectoryRelationshipCell UI Component Tests", () => {
    it("renders Parent account with Parent Account indicator, child count, and filter button", () => {
      const html = renderToString(
        <CustomerDirectoryRelationshipCell
          customer={PARENT_ITEM}
          onOpenHierarchy={vi.fn()}
          onFilterByParent={vi.fn()}
        />
      );

      expect(html).toContain("Parent Account");
      expect(html).toContain("3 child accounts");
      expect(html).toContain("Filter directory to children");
      expect(html).toContain('data-testid="relationship-badge-parent"');
      expect(html).toContain('data-testid="parent-child-count-btn-PAR-001"');
      expect(html).toContain('data-testid="filter-children-btn-PAR-001"');
      expect(html).toContain('aria-label="View hierarchy: 3 child accounts for Apex Holdings Pvt Ltd"');
    });

    it("renders Child account with Child Account indicator, parent name, and parent code", () => {
      const html = renderToString(
        <CustomerDirectoryRelationshipCell
          customer={CHILD_ACTIVE_PARENT_ITEM}
          onOpenHierarchy={vi.fn()}
        />
      );

      expect(html).toContain("Child Account");
      expect(html).toContain("Parent:");
      expect(html).toContain("Apex Holdings Pvt Ltd");
      expect(html).toContain("(PAR-001)");
      expect(html).toContain('data-testid="relationship-badge-child"');
      expect(html).toContain('data-testid="child-parent-link-CHD-001"');
      expect(html).not.toContain("Parent Inactive");
      expect(html).not.toContain("Unlinked Parent Account");
    });

    it("renders Child account with deactivated/inactive parent showing Parent Inactive alert badge", () => {
      const html = renderToString(
        <CustomerDirectoryRelationshipCell
          customer={CHILD_INACTIVE_PARENT_ITEM}
          onOpenHierarchy={vi.fn()}
        />
      );

      expect(html).toContain("Child Account");
      expect(html).toContain("Parent:");
      expect(html).toContain("Apex Holdings Pvt Ltd");
      expect(html).toContain("(PAR-001)");
      expect(html).toContain("Parent Inactive");
      expect(html).toContain('data-testid="inactive-parent-badge"');
    });

    it("renders Child account with missing/unlinked parent showing Unlinked Parent Account warning", () => {
      const html = renderToString(
        <CustomerDirectoryRelationshipCell
          customer={CHILD_MISSING_PARENT_ITEM}
          onOpenHierarchy={vi.fn()}
        />
      );

      expect(html).toContain("Child Account");
      expect(html).toContain("Unlinked Parent Account");
      expect(html).toContain('data-testid="unlinked-parent-alert"');
      expect(html).not.toContain("Parent:");
    });

    it("renders Standalone account with Standalone indicator and Independent account label", () => {
      const html = renderToString(
        <CustomerDirectoryRelationshipCell
          customer={STANDALONE_ITEM}
        />
      );

      expect(html).toContain("Standalone");
      expect(html).toContain("Independent account");
      expect(html).toContain('data-testid="relationship-badge-standalone"');
      expect(html).not.toContain("Parent Account");
      expect(html).not.toContain("Child Account");
    });
  });

  describe("Directory Item Canonical Relationship Logic", () => {
    it("determines parent status correctly when child_count > 0", () => {
      const c = PARENT_ITEM;
      const isParent = ((c.child_count ?? 0) > 0) || c.relationship_type === "parent";
      const isChild = Boolean(c.is_dependant || c.parent_customer_code || c.primary_account_code || c.relationship_type === "child");
      expect(isParent).toBe(true);
      expect(isChild).toBe(false);
    });

    it("determines child status with active parent correctly", () => {
      const c = CHILD_ACTIVE_PARENT_ITEM;
      const isParent = ((c.child_count ?? 0) > 0) || c.relationship_type === "parent";
      const isChild = Boolean(c.is_dependant || c.parent_customer_code || c.primary_account_code || c.relationship_type === "child");
      const parentName = c.parent_customer_name || c.primary_account_name;
      const parentCode = c.parent_customer_code || c.primary_account_code;
      const parentActive = c.primary_account_is_active ?? (c.primary_account_status ? c.primary_account_status.toLowerCase() === "active" : true);
      const isParentMissing = isChild && !parentName && !parentCode;

      expect(isParent).toBe(false);
      expect(isChild).toBe(true);
      expect(parentName).toBe("Apex Holdings Pvt Ltd");
      expect(parentCode).toBe("PAR-001");
      expect(parentActive).toBe(true);
      expect(isParentMissing).toBe(false);
    });

    it("detects deactivated parent correctly", () => {
      const c = CHILD_INACTIVE_PARENT_ITEM;
      const parentActive = c.primary_account_is_active ?? (c.primary_account_status ? c.primary_account_status.toLowerCase() === "active" : true);
      expect(parentActive).toBe(false);
    });

    it("detects missing / unlinked parent correctly", () => {
      const c = CHILD_MISSING_PARENT_ITEM;
      const isChild = Boolean(c.is_dependant || c.parent_customer_code || c.primary_account_code || c.relationship_type === "child");
      const parentName = c.parent_customer_name || c.primary_account_name;
      const parentCode = c.parent_customer_code || c.primary_account_code;
      const isParentMissing = isChild && !parentName && !parentCode;

      expect(isChild).toBe(true);
      expect(isParentMissing).toBe(true);
    });

    it("detects standalone customer correctly", () => {
      const c = STANDALONE_ITEM;
      const isParent = ((c.child_count ?? 0) > 0) || c.relationship_type === "parent";
      const isChild = Boolean(c.is_dependant || c.parent_customer_code || c.primary_account_code || c.relationship_type === "child");
      expect(isParent).toBe(false);
      expect(isChild).toBe(false);
    });
  });

  describe("CustomerHierarchyTree Live Consistency Tests", () => {
    it("renders actual child code, name, and status badge instead of placeholders", () => {
      const parentRecord: RetailCustomerRecord = {
        id: "01a17307-6fb6-7000-a97d-da721ae573f5",
        code: "CUST-68351893",
        name: "ShopperStop",
        phone: "9820012345",
        email: "contact@shopperstop.com",
        gstin: "27AAACS1234F1Z5",
        status: "Active",
      };

      const childrenNodes = [
        {
          id: "01a173ba-a6e5-7000-b172-0812ecf669e7",
          code: "CUST-68351894",
          name: "ShopperStop Demo Branch",
          status: "Active",
          isActive: true,
          storeCode: "ST-01",
          location: "Mumbai",
        },
      ];

      const html = renderToString(
        <CustomerHierarchyTree
          customer={parentRecord}
          childrenNodes={childrenNodes}
        />
      );

      // Verify parent details
      expect(html).toContain("Parent Customer (Corporate / Key Account)");
      expect(html).toContain("ShopperStop");
      expect(html).toContain("CUST-68351893");

      // Verify actual child details (never placeholders)
      expect(html).toContain("CUST-68351894");
      expect(html).toContain("ShopperStop Demo Branch");
      expect(html).toContain("Active");
      expect(html).toContain("Store: <strong>ST-01</strong>");
      expect(html).toContain("City: <strong>Mumbai</strong>");
      expect(html).not.toContain("No Child Accounts Linked");
    });
  });
});
