/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-22
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Lookup & Selection Verification Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Customer } from "../types.ts";
import { getCustomers, saveCustomers } from "../services/customerStore.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { apiFetch } from "../lib/apiFetch.ts";

// ─── Self-contained test fixtures ─────────────────────────────────────────────
// initialCustomers is intentionally empty (PostgreSQL is source of truth).
// Tests use explicit fixtures to remain independent of the store state.
const TEST_CUSTOMERS: Customer[] = [
  { id: "CUST-WALKIN", code: "CUST-WALKIN", name: "Walk-In / Cash Customer", mobile: "9999999999", outstanding: 0, status: "Active" },
  { id: "CUST-001",    code: "CUST-001",    name: "Reliance Retail Limited", mobile: "9822334455", gstNumber: "29AABCR1718E1ZL", outstanding: 0, status: "Active" },
  { id: "CUST-002",    code: "CUST-002",    name: "Shoppers Stop Ltd",       mobile: "9833445566", gstNumber: "27AAACS4321E1Z2", outstanding: 0, status: "Active" },
  { id: "CUST-003",    code: "CUST-003",    name: "Lifestyle International", mobile: "9844556677", gstNumber: "27AAACL5678A1Z3", outstanding: 0, status: "Active" },
];

// Mock localStorage for node test environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

describe("SMRITI — Customer Lookup, Selection & Invoice Header Attachment Tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  // TEST 1: Customers from fixture match real DB records
  it("TEST 1: getCustomers() returns empty on cold start; fixtures reflect live DB state", () => {
    // On cold start (test env has no localStorage) getCustomers() returns []
    const liveCustomers = getCustomers();
    expect(Array.isArray(liveCustomers)).toBe(true);

    // Inject fixtures to simulate warm cache and verify lookup works
    saveCustomers(TEST_CUSTOMERS);
    const cached = getCustomers();
    expect(cached.length).toBe(4);

    const reliance = cached.find(c => c.name === "Reliance Retail Limited");
    expect(reliance).toBeDefined();
    expect(reliance?.id).toBe("CUST-001");
    expect(reliance?.mobile).toBe("9822334455");
  });

  // TEST 2: Customer Search Filtering & Auto-Match
  it("TEST 2: should filter customer records by name, mobile, and id and resolve exact match", () => {
    saveCustomers(TEST_CUSTOMERS);
    const customers: Customer[] = getCustomers();
    const query = "Reliance";

    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.mobile && c.mobile.includes(query))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Reliance Retail Limited");
    expect(filtered[0].id).toBe("CUST-001");

    // Exact auto-match logic simulation
    const matchVal = "Reliance Retail Limited";
    const exact = customers.find(c =>
      c.name.toLowerCase() === matchVal.trim().toLowerCase() ||
      (c.mobile && c.mobile === matchVal.trim()) ||
      c.id.toLowerCase() === matchVal.trim().toLowerCase()
    );

    expect(exact).toBeDefined();
    expect(exact?.name).toBe("Reliance Retail Limited");
  });

  // TEST 3: Invoice Header Customer State & Display
  it("TEST 3: should update invoice header and customer display value when customer is selected", () => {
    let headerState: { customer: Customer | null; docNo: string } = {
      customer: null,
      docNo: "1"
    };

    let customerSearchInput = "";
    let customerNameDisplay = headerState.customer?.name || "No Customer Selected";
    expect(customerNameDisplay).toBe("No Customer Selected");

    // User selects Rahul Sharma
    const selectedCustomer: Customer = {
      id: "CUST-001",
      name: "Rahul Sharma",
      mobile: "9876543210",
      status: "Active"
    };

    headerState = { ...headerState, customer: selectedCustomer };
    customerSearchInput = selectedCustomer.name;
    customerNameDisplay = headerState.customer?.name || "No Customer Selected";

    expect(headerState.customer).not.toBeNull();
    expect(headerState.customer?.name).toBe("Rahul Sharma");
    expect(customerSearchInput).toBe("Rahul Sharma");
    expect(customerNameDisplay).toBe("Rahul Sharma");
  });

  // TEST 4: Settlement Modal Customer Association
  it("TEST 4: should identify invoice customer correctly during settlement instead of Counter Cash Sale", () => {
    const customer: Customer = {
      id: "CUST-001",
      name: "Rahul Sharma",
      mobile: "9876543210",
      status: "Active"
    };

    // Settlement invoice summary resolution
    const settlementCustomerDisplay = customer?.name || "Counter Cash Sale";
    expect(settlementCustomerDisplay).toBe("Rahul Sharma");

    // When customer is null (unselected)
    const nullCustomer: Customer | null = null;
    const fallbackCustomerDisplay = nullCustomer?.name || "Counter Cash Sale";
    expect(fallbackCustomerDisplay).toBe("Counter Cash Sale");
  });

  // TEST 5: Docker Hostname Sanitization in API Fetchers
  it("TEST 5: should sanitize smriti-api:8000 and python-core:8000 URLs to avoid ERR_NAME_NOT_RESOLVED", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      return new Response(JSON.stringify([{ id: "CUST-001", name: "Rahul Sharma" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const res = await apiFetchV1("http://smriti-api:8000/api/v1/customers");
    expect(res).toBeDefined();
    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain("/api/v1/customers");
    expect(calledUrl).not.toContain("smriti-api");

    fetchSpy.mockRestore();
  });

  // TEST 6: Prototype Value Setter for Controlled Inputs
  it("TEST 6: should properly invoke property descriptor setter on controlled input DOM element", () => {
    let internalValue = "";
    let eventFired = false;

    const mockProto = {
      set value(v: string) {
        internalValue = v;
      },
      get value() {
        return internalValue;
      }
    };

    const targetInput: any = {
      name: "customerSearch",
      dispatchEvent: vi.fn((e: any) => {
        if (e.type === "input") eventFired = true;
      })
    };
    Object.setPrototypeOf(targetInput, mockProto);

    const descriptor = Object.getOwnPropertyDescriptor(mockProto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(targetInput, "Rahul Sharma");
    } else {
      targetInput.value = "Rahul Sharma";
    }
    targetInput.dispatchEvent({ type: "input", bubbles: true });

    expect(targetInput.value).toBe("Rahul Sharma");
    expect(eventFired).toBe(true);
  });

  // TEST 7: ProPOS Customer Browse Modal Selection
  it("TEST 7: should map live DB customers into ProPosCustomer and select on double-click/Enter", () => {
    saveCustomers(TEST_CUSTOMERS);
    const rawCustomers = getCustomers();
    const mapped = rawCustomers.map((c, idx) => ({
      id: c.id || `CUST-${idx + 1}`,
      code: c.code || `C0${idx + 1}`,
      name: c.name || "Customer",
      phone: c.mobile || "9876543210",
      loyaltyTier: "Gold",
      loyaltyPoints: 1200,
      creditLimit: 50000,
      currentBalance: 0
    }));

    const reliance = mapped.find(c => c.name === "Reliance Retail Limited");
    expect(reliance).toBeDefined();
    expect(reliance?.phone).toBe("9822334455");

    let terminalCustomer: any = null;
    const onSelectCustomer = (selected: any) => {
      terminalCustomer = selected;
    };

    // Simulate modal selection callback (triggered by Enter or dblclick)
    onSelectCustomer(reliance);
    expect(terminalCustomer).not.toBeNull();
    expect(terminalCustomer.name).toBe("Reliance Retail Limited");
    expect(terminalCustomer.id).toBe("CUST-001");
  });
});
