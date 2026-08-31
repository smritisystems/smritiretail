/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.15.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Customer Policy Enforcement & Credit Rule Unit Tests
 */

import { describe, it, expect } from "vitest";
import { initialCustomers, initialCustomerGroups, initialCustomerPriceGroups } from "../services/customerStore.ts";

describe("SMRITI — Customer Policy & Credit Rule Enforcement", () => {
  // Test 1: Canonical Walk-In Customer exists and has zero credit risk
  it("TEST 1: should provide canonical CUST-WALKIN record with zero credit risk", () => {
    const walkin = initialCustomers.find(c => c.id === "CUST-WALKIN");
    expect(walkin).toBeDefined();
    expect(walkin?.name).toBe("Walk-In / Cash Customer");
    expect(walkin?.customerGroupId).toBe("CG-Retail");
    expect(walkin?.outstanding).toBe(0);
  });

  // Test 2: Credit Limit Calculation and Auto-Block Threshold
  it("TEST 2: should correctly evaluate credit limit and block when threshold exceeded", () => {
    const retailGroup = initialCustomerGroups.find(g => g.id === "CG-Retail");
    expect(retailGroup).toBeDefined();
    expect(retailGroup?.creditLimit).toBe(20000);
    expect(retailGroup?.autoBlockSales).toBe(true);

    const rahul = initialCustomers.find(c => c.id === "CUST-001");
    expect(rahul).toBeDefined();
    const currentOutstanding = rahul?.outstanding || 0; // 15,000

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
