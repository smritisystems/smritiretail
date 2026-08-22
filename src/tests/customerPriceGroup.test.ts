/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Price Group Master Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CustomerPriceGroup } from "../types.ts";
import { 
  getCustomerPriceGroups, 
  saveCustomerPriceGroups, 
  addCustomerPriceGroup, 
  updateCustomerPriceGroup, 
  deleteCustomerPriceGroup,
  initialCustomerPriceGroups 
} from "../services/customerStore.ts";

// Mock localStorage for test environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

const listeners: Record<string, Function[]> = {};
const mockWindow = {
  addEventListener: vi.fn((event: string, cb: Function) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  }),
  removeEventListener: vi.fn((event: string, cb: Function) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(fn => fn !== cb);
    }
  }),
  dispatchEvent: vi.fn((event: any) => {
    const list = listeners[event.type || event] || [];
    list.forEach(fn => fn(event));
    return true;
  })
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(globalThis, "window", {
  value: mockWindow,
  writable: true
});

class MockCustomEvent {
  type: string;
  detail: any;
  constructor(type: string, opts?: any) {
    this.type = type;
    this.detail = opts?.detail;
  }
}
Object.defineProperty(globalThis, "CustomEvent", {
  value: MockCustomEvent,
  writable: true
});

describe("SMRITI — Customer Price Group Master Specification Tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    Object.keys(listeners).forEach(k => delete listeners[k]);
    vi.clearAllMocks();
  });

  // TEST 1: Initial Seed Customer Price Groups
  it("TEST 1: should initialize default Customer Price Groups including CPP (Platinum Privilege)", () => {
    const groups = getCustomerPriceGroups();
    expect(groups.length).toBeGreaterThanOrEqual(5);

    const cpp = groups.find(g => g.code === "CPP");
    expect(cpp).toBeDefined();
    expect(cpp?.description).toBe("Platinum Privilege");
    expect(cpp?.paymentTerms).toBe("PT");
    expect(cpp?.creditDays).toBe(60);
    expect(cpp?.creditLimit).toBe(500000);
    expect(cpp?.destTaxType).toBe("Local");
    expect(cpp?.itemClassificationPriceFactorApplicable).toBe(true);
    expect(cpp?.allowCreditInvoice).toBe(true);
    expect(cpp?.allowCashInvoice).toBe(true);
    expect(cpp?.taxExclusiveInvoice).toBe(false);
    expect(cpp?.allowMiscIssue).toBe(false);
  });

  // TEST 2: Add New Customer Price Group
  it("TEST 2: should add a new Customer Price Group and persist to local storage", () => {
    const newGroup: CustomerPriceGroup = {
      id: "DIST",
      code: "DIST",
      description: "Super Distributor Tier",
      paymentTerms: "Net 90",
      creditDays: 90,
      destTaxType: "Interstate",
      creditLimit: 2500000,
      itemClassificationPriceFactorApplicable: true,
      allowCreditInvoice: true,
      allowCashInvoice: false,
      taxExclusiveInvoice: true,
      allowMiscIssue: true,
      status: "Active"
    };

    const updated = addCustomerPriceGroup(newGroup);
    expect(updated.some(g => g.code === "DIST")).toBe(true);

    const fetched = getCustomerPriceGroups();
    const dist = fetched.find(g => g.code === "DIST");
    expect(dist).toBeDefined();
    expect(dist?.description).toBe("Super Distributor Tier");
    expect(dist?.creditLimit).toBe(2500000);
    expect(dist?.allowMiscIssue).toBe(true);
  });

  // TEST 3: Update Existing Customer Price Group
  it("TEST 3: should update properties of an existing Customer Price Group", () => {
    const updatedList = updateCustomerPriceGroup("CPP", {
      description: "Platinum Privilege Exclusive",
      creditLimit: 750000,
      creditDays: 75,
      destTaxType: "SEZ (With Tax)"
    });

    const cpp = updatedList.find(g => g.code === "CPP");
    expect(cpp).toBeDefined();
    expect(cpp?.description).toBe("Platinum Privilege Exclusive");
    expect(cpp?.creditLimit).toBe(750000);
    expect(cpp?.creditDays).toBe(75);
    expect(cpp?.destTaxType).toBe("SEZ (With Tax)");
  });

  // TEST 4: Delete Customer Price Group
  it("TEST 4: should delete a Customer Price Group and remove it from store", () => {
    const beforeCount = getCustomerPriceGroups().length;
    const afterList = deleteCustomerPriceGroup("TI");

    expect(afterList.length).toBe(beforeCount - 1);
    expect(afterList.some(g => g.code === "TI")).toBe(false);

    const reloaded = getCustomerPriceGroups();
    expect(reloaded.some(g => g.code === "TI")).toBe(false);
  });

  // TEST 5: Transactions Allowed Permissions Matrix
  it("TEST 5: should correctly enforce transaction permission toggles on price groups", () => {
    const cashOnlyGroup: CustomerPriceGroup = {
      id: "CASH_ONLY",
      code: "CASH_ONLY",
      description: "Counter Cash Only Group",
      paymentTerms: "Immediate",
      creditDays: 0,
      destTaxType: "Local",
      creditLimit: 0,
      itemClassificationPriceFactorApplicable: false,
      allowCreditInvoice: false,
      allowCashInvoice: true,
      taxExclusiveInvoice: false,
      allowMiscIssue: false
    };

    addCustomerPriceGroup(cashOnlyGroup);
    const stored = getCustomerPriceGroups().find(g => g.code === "CASH_ONLY");

    expect(stored?.allowCreditInvoice).toBe(false);
    expect(stored?.allowCashInvoice).toBe(true);
    expect(stored?.allowMiscIssue).toBe(false);
  });

  // TEST 6: Event Notification Dispatching
  it("TEST 6: should dispatch smriti_customer_price_groups_updated event when groups change", () => {
    const eventSpy = vi.fn();
    window.addEventListener("smriti_customer_price_groups_updated", eventSpy);

    saveCustomerPriceGroups(initialCustomerPriceGroups);
    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener("smriti_customer_price_groups_updated", eventSpy);
  });
});
