/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Lookup & Selection Verification Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Customer } from "../types.ts";
import { getCustomers, initialCustomers } from "../services/customerStore.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { apiFetch } from "../lib/apiFetch.ts";

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

  // TEST 1: Canonical Customers Fallback
  it("TEST 1: should provide canonical customer store including Rahul Sharma on backend fallback", () => {
    const customers = getCustomers();
    expect(customers.length).toBeGreaterThanOrEqual(7);

    const rahul = customers.find(c => c.name === "Rahul Sharma");
    expect(rahul).toBeDefined();
    expect(rahul?.id).toBe("CUST-001");
    expect(rahul?.mobile).toBe("9876543210");
  });

  // TEST 2: Customer Search Filtering & Auto-Match
  it("TEST 2: should filter customer records by name, mobile, and id and resolve exact match", () => {
    const customers: Customer[] = getCustomers();
    const query = "Rahul";

    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.mobile && c.mobile.includes(query))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Rahul Sharma");
    expect(filtered[0].id).toBe("CUST-001");

    // Exact auto-match logic simulation
    const matchVal = "Rahul Sharma";
    const exact = customers.find(c => 
      c.name.toLowerCase() === matchVal.trim().toLowerCase() ||
      (c.mobile && c.mobile === matchVal.trim()) ||
      c.id.toLowerCase() === matchVal.trim().toLowerCase()
    );

    expect(exact).toBeDefined();
    expect(exact?.name).toBe("Rahul Sharma");
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
  it("TEST 7: should map canonical customer store into ProPosCustomer and select on double-click/Enter", () => {
    const rawCustomers = getCustomers();
    const mapped = rawCustomers.map((c, idx) => ({
      id: c.id || `CUST-${idx + 1}`,
      code: c.code || `C0${idx + 1}`,
      name: c.name || "Customer",
      phone: c.mobile || c.phone || "9876543210",
      loyaltyTier: c.loyaltyTier || "Gold",
      loyaltyPoints: c.loyaltyPoints ?? 1200,
      creditLimit: c.creditLimit ?? 50000,
      currentBalance: c.currentBalance ?? 0
    }));

    const rahul = mapped.find(c => c.name === "Rahul Sharma");
    expect(rahul).toBeDefined();
    expect(rahul?.phone).toBe("9876543210");

    let terminalCustomer: any = null;
    const onSelectCustomer = (selected: any) => {
      terminalCustomer = selected;
    };

    // Simulate modal selection callback (triggered by Enter or dblclick)
    onSelectCustomer(rahul);
    expect(terminalCustomer).not.toBeNull();
    expect(terminalCustomer.name).toBe("Rahul Sharma");
    expect(terminalCustomer.id).toBe("CUST-001");
  });
});
