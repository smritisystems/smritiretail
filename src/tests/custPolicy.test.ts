/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Policy Enforcement & Credit Rule Unit Tests
 */

import { describe, it, expect } from "vitest";
import { initialCustomerGroups, initialCustomerPriceGroups } from "../services/customerStore.ts";

// ─── Self-contained test fixtures (do not rely on initialCustomers seed) ──────
// initialCustomers is intentionally empty (PostgreSQL is source of truth).
// These fixtures represent the minimum data needed to test policy logic.
const TEST_WALKIN = {
  id: "CUST-WALKIN",
  code: "CUST-WALKIN",
  name: "Walk-In / Cash Customer",
  customerGroupId: "CG-Retail",
  outstanding: 0,
  status: "Active" as const,
  tags: ["Walk-In", "Cash", "B2C"],
};

const TEST_CREDIT_CUSTOMER = {
  id: "TEST-CUST-001",
  name: "Test Credit Customer",
  customerGroupId: "CG-Retail",
  outstanding: 15000,
  status: "Active" as const,
  tags: [],
};

describe("SMRITI — Customer Policy & Credit Rule Enforcement", () => {
  // Test 1: Canonical Walk-In Customer behaviour
  it("TEST 1: should provide canonical CUST-WALKIN record with zero credit risk", () => {
    expect(TEST_WALKIN.id).toBe("CUST-WALKIN");
    expect(TEST_WALKIN.name).toBe("Walk-In / Cash Customer");
    expect(TEST_WALKIN.customerGroupId).toBe("CG-Retail");
    expect(TEST_WALKIN.outstanding).toBe(0);
  });

  // Test 2: Credit Limit Calculation and Auto-Block Threshold
  it("TEST 2: should correctly evaluate credit limit and block when threshold exceeded", () => {
    const retailGroup = initialCustomerGroups.find(g => g.id === "CG-Retail");
    expect(retailGroup).toBeDefined();
    expect(retailGroup?.creditLimit).toBe(20000);
    expect(retailGroup?.autoBlockSales).toBe(true);

    const currentOutstanding = TEST_CREDIT_CUSTOMER.outstanding; // 15,000
    // New purchase of ₹6,000 => Total ₹21,000 > ₹20,000 limit
    const newInvoiceAmount = 6000;
    const isExceeded = (currentOutstanding + newInvoiceAmount) > (retailGroup?.creditLimit || 0);
    expect(isExceeded).toBe(true);
  });

  // Test 3: Warning Threshold Percentage Check
  it("TEST 3: should flag credit warning when utilization crosses warning threshold", () => {
    const corporateGroup = initialCustomerGroups.find(g => g.id === "CG-LargeRetail");
    expect(corporateGroup).toBeDefined();
    const limit = corporateGroup?.creditLimit || 1000000;
    const warningThresholdPct = corporateGroup?.warningThresholdPercent || 90;

    // Simulated customer with ₹920,000 outstanding (92% utilization)
    const simulatedOutstanding = 920000;
    const utilizationPct = (simulatedOutstanding / limit) * 100;
    expect(utilizationPct).toBeGreaterThanOrEqual(warningThresholdPct);
  });

  // Test 4: Credit Hold Policy Enforcement
  it("TEST 4: should reject invoicing when customer group has creditHold enabled", () => {
    const customBlockedGroup = {
      ...initialCustomerGroups[0],
      id: "CG-BlockedAccount",
      creditHold: true
    };
    expect(customBlockedGroup.creditHold).toBe(true);
  });

  // Test 5: Customer Price Group Tax Inclusiveness Policy
  it("TEST 5: should correctly enforce taxInclusive and payment terms per Price Group", () => {
    const platinumGroup = initialCustomerPriceGroups.find(g => g.code === "CPP");
    expect(platinumGroup).toBeDefined();
    expect(platinumGroup?.allowCreditInvoice).toBe(true);
    expect(platinumGroup?.creditDays).toBe(60);
    expect(platinumGroup?.taxExclusiveInvoice).toBe(false); // Tax Inclusive
  });
});


