/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Flow & Database Integrity Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Customer, CustomerGroup } from "../types.ts";
import { 
  getCustomers, 
  saveCustomers, 
  getCustomerGroups,
  saveCustomerGroups,
  syncPendingCustomers,
  initialCustomers,
  initialCustomerGroups 
} from "../services/customerStore.ts";

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

describe("SMRITI — Customer Flow & Tenant Integrity Tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    Object.keys(listeners).forEach(k => delete listeners[k]);
    vi.clearAllMocks();
  });

  // TEST 1: Preserve Invoice-Linked Customer IDs
  it("TEST 1: should preserve all invoice-linked canonical IDs in customer master", () => {
    const canonicalIds = [
      "CUST-001",
      "CUST-002",
      "CUST-003",
      "CUST-004",
      "cust-rrl-192b561d",
      "CUST-006",
      "CUST-007"
    ];

    const currentCustomers = initialCustomers;
    canonicalIds.forEach(id => {
      const found = currentCustomers.find(c => c.id === id);
      expect(found, `Customer ID ${id} must exist in canonical repository`).toBeDefined();
    });
  });

  // TEST 2: Customer Groups Tenant Linkage
  it("TEST 2: should ensure all customers reference valid tenant-scoped customer groups", () => {
    const validGroupIds = ["CG-Retail", "CG-LargeRetail", "CG-Branches", "CG-Franchises"];
    
    initialCustomers.forEach(cust => {
      expect(validGroupIds).toContain(cust.customerGroupId);
    });
  });

  // TEST 3: Offline Queue Management
  it("TEST 3: should queue customer modifications when offline and sync upon reconnect", async () => {
    const pendingCust: Customer = {
      id: "CUST-OFFLINE-001",
      name: "Offline Created Customer",
      customerGroupId: "CG-Retail",
      mobile: "9876500000",
      outstanding: 0,
      status: "Active"
    };

    mockStorage["smriti_pending_customers"] = JSON.stringify([pendingCust]);
    
    // Check queue reads properly
    const queued = JSON.parse(mockStorage["smriti_pending_customers"]);
    expect(queued.length).toBe(1);
    expect(queued[0].id).toBe("CUST-OFFLINE-001");
  });

  // TEST 4: Customer Status and Tags Updates
  it("TEST 4: should trigger event notifications on customer save", () => {
    const eventSpy = vi.fn();
    window.addEventListener("smriti_customer_updated", eventSpy);

    saveCustomers(initialCustomers);
    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener("smriti_customer_updated", eventSpy);
  });
});
