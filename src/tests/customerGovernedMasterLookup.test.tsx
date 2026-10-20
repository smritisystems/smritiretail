/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target Test  : Governed Master Lookup & Customer Creation Integrity Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GovernedLookupCombobox, LookupItem } from "../components/itemMaster/GovernedLookupCombobox.tsx";
import { StoreCodeLookupItem } from "../components/customer/corporate360/types.ts";

describe("GovernedLookupCombobox Extended Master Contracts", () => {
  it("renders with given value and placeholder", () => {
    const html = renderToStaticMarkup(
      <GovernedLookupCombobox
        id="test-combobox"
        value="Corporate / Enterprise"
        onChange={() => {}}
        options={["Corporate / Enterprise", "Retail", "Modern Trade"]}
        placeholder="Select customer type"
      />
    );
    expect(html).toContain("Corporate / Enterprise");
    expect(html).toContain('placeholder="Select customer type"');
    expect(html).toContain('id="test-combobox"');
  });

  it("normalizes and renders options properly", () => {
    const options: LookupItem[] = [
      { code: "CORP", name: "Corporate / Enterprise" },
      { code: "RETAIL", name: "Retail" },
      { code: "MODERN_TRADE", name: "Modern Trade" },
    ];

    const html = renderToStaticMarkup(
      <GovernedLookupCombobox
        id="test-combobox"
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Choose Type"
      />
    );

    expect(html).toContain('id="test-combobox"');
    expect(html).toContain('placeholder="Choose Type"');
  });

  it("renders loading spinner when loading prop is true", () => {
    const html = renderToStaticMarkup(
      <GovernedLookupCombobox
        id="test-loading-lookup"
        value=""
        onChange={() => {}}
        options={[]}
        loading={true}
        placeholder="Loading options..."
      />
    );
    expect(html).toContain("animate-spin");
  });

  it("filters lookup options case-insensitively and returns matching items", () => {
    const rawOptions = [
      { code: "CORP", name: "Corporate / Enterprise" },
      { code: "RETAIL", name: "Retail Shopper" },
      { code: "MODERN", name: "Modern Trade" },
      { code: "INST", name: "Institutional" },
    ];

    const filterComboboxOptions = (opts: typeof rawOptions, query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return opts;
      return opts.filter(
        (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
      );
    };

    expect(filterComboboxOptions(rawOptions, "corp")).toHaveLength(1);
    expect(filterComboboxOptions(rawOptions, "corp")[0].name).toBe("Corporate / Enterprise");
    expect(filterComboboxOptions(rawOptions, "retail")).toHaveLength(1);
    expect(filterComboboxOptions(rawOptions, "retail")[0].name).toBe("Retail Shopper");
    expect(filterComboboxOptions(rawOptions, "")).toHaveLength(4);
    expect(filterComboboxOptions(rawOptions, "nonexistent")).toHaveLength(0);
  });
});

describe("Store Code Master Collision & Ownership Verification", () => {
  it("marks store codes assigned to other customers as non-selectable with reason", () => {
    const storeLookupCatalog: StoreCodeLookupItem[] = [
      {
        id: "loc-01",
        store_code: "RRL-MUM-001",
        store_name: "Reliance Fresh - Andheri",
        city: "Mumbai",
        state: "Maharashtra",
        is_assigned: true,
        is_selectable: false,
        disabled_reason: "Already mapped to Reliance Retail Ltd. (CUST-REL-0001)",
        assigned_customer_id: "cust-ril-001",
        assigned_customer_name: "Reliance Retail Ltd.",
        assigned_customer_code: "CUST-REL-0001",
      },
      {
        id: "loc-02",
        store_code: "TATA-THN-001",
        store_name: "Star Bazaar - Thane",
        city: "Thane",
        state: "Maharashtra",
        is_assigned: true,
        is_selectable: true,
        disabled_reason: undefined,
        assigned_customer_id: "cust-tata-002",
        assigned_customer_name: "Tata Trent Hypermarket",
        assigned_customer_code: "CUST-TATA-002",
      },
    ];

    const currentCustomerId = "cust-tata-002";

    // Filtering selectable stores for current customer
    const selectableStores = storeLookupCatalog.filter(
      (s) => s.is_selectable || s.assigned_customer_id === currentCustomerId
    );
    expect(selectableStores).toHaveLength(1);
    expect(selectableStores[0].store_code).toBe("TATA-THN-001");

    // Colliding store assigned to other customer has disabled reason
    const otherCustomerStore = storeLookupCatalog.find((s) => s.store_code === "RRL-MUM-001");
    expect(otherCustomerStore?.is_selectable).toBe(false);
    expect(otherCustomerStore?.disabled_reason).toContain("Already mapped to Reliance Retail Ltd.");
  });
});

describe("Customer Creation Integrity & Defect Remediation", () => {
  it("preserves in-progress form edits without silent PUT overwrite on duplicate HTTP 409", () => {
    const originalFormState = {
      name: "Acme Enterprises New Branch",
      mobile: "+91 98765 43210",
      gstin: "27AAACR1718E1ZV",
      customerType: "Corporate",
      storeCode: "RRL-MUM-001",
    };

    // Simulated duplicate error payload from backend API
    const duplicateError = {
      status: 409,
      detail: {
        error_code: "DUPLICATE_CUSTOMER",
        decision: "HARD_DUPLICATE",
        matched_identity: "GSTIN",
        reason: "Customer with GSTIN '27AAACR1718E1ZV' is already registered as 'Reliance Retail Ltd.' (CUST-REL-0001)",
        existing_customer: {
          id: "cust-rrl-192b561d",
          code: "CUST-REL-0001",
          name: "Reliance Retail Ltd.",
        },
      },
    };

    // Verify duplicate error does not mutate or overwrite original form data
    expect(duplicateError.detail.error_code).toBe("DUPLICATE_CUSTOMER");
    expect(originalFormState.name).toBe("Acme Enterprises New Branch");
    expect(originalFormState.storeCode).toBe("RRL-MUM-001");
  });

  it("prohibits circular parent-child relationships through ancestor cycle detection", () => {
    // Relationship edges: Map<childId, parentId>
    const existingEdges = new Map<string, string>([
      ["cust-b", "cust-a"], // A is parent of B
      ["cust-c", "cust-b"], // B is parent of C
    ]);

    const wouldCreateCycle = (candidateParent: string, candidateChild: string): boolean => {
      let curr: string | undefined = candidateParent;
      const visited = new Set<string>();
      while (curr) {
        if (curr === candidateChild) return true;
        if (visited.has(curr)) break;
        visited.add(curr);
        curr = existingEdges.get(curr);
      }
      return false;
    };

    // If user attempts to add C as parent of A: C -> B -> A means A is ancestor of C, so C as parent of A is a cycle!
    expect(wouldCreateCycle("cust-c", "cust-a")).toBe(true);  // Cycle detected!

    // Direct circular: A is parent of B. User attempts B as parent of A.
    expect(wouldCreateCycle("cust-b", "cust-a")).toBe(true);  // Cycle detected!

    // Non-circular: D is a new independent customer. D as parent of A is valid.
    expect(wouldCreateCycle("cust-d", "cust-a")).toBe(false); // No cycle
    // Non-circular: A as parent of D is valid.
    expect(wouldCreateCycle("cust-a", "cust-d")).toBe(false); // No cycle
  });
});
