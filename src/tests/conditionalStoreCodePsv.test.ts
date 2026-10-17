/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.82.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Conditional Store Code & PSV Account Resolution Frontend Tests
 */

import { describe, it, expect } from "vitest";
import { SALES_CHANNELS, channelRequiresStoreLocation, BillingHeaderState } from "../components/billing/types.ts";

describe("Conditional Store Code & Sales Channel Resolution", () => {
  it("defines the canonical sales channels with correct display labels", () => {
    const channelValues = SALES_CHANNELS.map(ch => ch.value);
    expect(channelValues).toContain("MODERN_TRADE");
    expect(channelValues).toContain("GENERAL_TRADE");
    expect(channelValues).toContain("B2B_WHOLESALE");
    expect(channelValues).toContain("POS_RETAIL");
    expect(channelValues).toContain("ECOMMERCE");
    expect(SALES_CHANNELS.length).toBe(5);

    const mt = SALES_CHANNELS.find(ch => ch.value === "MODERN_TRADE");
    expect(mt?.label).toBe("Modern Trade (LFR / SIS)");
  });

  it("identifies MODERN_TRADE as requiring store location tracking by default", () => {
    expect(channelRequiresStoreLocation("MODERN_TRADE")).toBe(true);
  });

  it("identifies non-modern-trade channels as not requiring store location tracking by default", () => {
    expect(channelRequiresStoreLocation("GENERAL_TRADE")).toBe(false);
    expect(channelRequiresStoreLocation("B2B_WHOLESALE")).toBe(false);
    expect(channelRequiresStoreLocation("POS_RETAIL")).toBe(false);
    expect(channelRequiresStoreLocation("ECOMMERCE")).toBe(false);
    expect(channelRequiresStoreLocation(undefined)).toBe(false);
    expect(channelRequiresStoreLocation("UNKNOWN_CHANNEL")).toBe(false);
  });

  it("enforces validation rule: MODERN_TRADE requires a delivery location before settlement", () => {
    const headerState: BillingHeaderState = {
      billType: "Product",
      transaction: "Credit",
      docPrefix: "INV",
      docNo: "INV-001",
      billingSource: "DIRECT",
      salesChannel: "MODERN_TRADE",
      deliveryLocationId: null,
      deliveryStoreCode: null,
      psvPartyId: null,
    };

    const isStoreLocationRequired = channelRequiresStoreLocation(headerState.salesChannel);
    expect(isStoreLocationRequired).toBe(true);

    // Simulated pre-save guard logic from BillingTerm.tsx
    let validationError: string | null = null;
    if (isStoreLocationRequired && !headerState.deliveryLocationId) {
      validationError = "Please select a Delivery Location / Store Code for this Modern Trade transaction before completing settlement.";
    }

    expect(validationError).not.toBeNull();
    expect(validationError).toContain("Please select a Delivery Location");
  });

  it("passes validation when MODERN_TRADE has a valid delivery location and store code", () => {
    const headerState: BillingHeaderState = {
      billType: "Product",
      transaction: "Credit",
      docPrefix: "INV",
      docNo: "INV-002",
      billingSource: "DIRECT",
      salesChannel: "MODERN_TRADE",
      deliveryLocationId: "cdl-test-loc-001",
      deliveryStoreCode: "STR-MUM-01",
      psvPartyId: "psv-part-001",
    };

    const isStoreLocationRequired = channelRequiresStoreLocation(headerState.salesChannel);
    let validationError: string | null = null;
    if (isStoreLocationRequired && !headerState.deliveryLocationId) {
      validationError = "Please select a Delivery Location / Store Code for this Modern Trade transaction before completing settlement.";
    }

    expect(validationError).toBeNull();
    expect(headerState.psvPartyId).toBe("psv-part-001");
  });

  it("preserves delivery location and store code non-destructively when switching channels", () => {
    let headerState: BillingHeaderState = {
      billType: "Product",
      transaction: "Credit",
      docPrefix: "INV",
      docNo: "INV-003",
      billingSource: "DIRECT",
      salesChannel: "MODERN_TRADE",
      deliveryLocationId: "cdl-test-loc-001",
      deliveryStoreCode: "STR-MUM-01",
      psvPartyId: "psv-part-001",
    };

    expect(channelRequiresStoreLocation(headerState.salesChannel)).toBe(true);

    // Operator switches channel to B2B_WHOLESALE (field is hidden in UI)
    headerState = {
      ...headerState,
      salesChannel: "B2B_WHOLESALE",
    };

    expect(channelRequiresStoreLocation(headerState.salesChannel)).toBe(false);
    // Values in state must NOT be erased or destroyed
    expect(headerState.deliveryLocationId).toBe("cdl-test-loc-001");
    expect(headerState.deliveryStoreCode).toBe("STR-MUM-01");
    expect(headerState.psvPartyId).toBe("psv-part-001");

    // Operator switches back to MODERN_TRADE
    headerState = {
      ...headerState,
      salesChannel: "MODERN_TRADE",
    };
    expect(channelRequiresStoreLocation(headerState.salesChannel)).toBe(true);
    expect(headerState.deliveryLocationId).toBe("cdl-test-loc-001");
    expect(headerState.deliveryStoreCode).toBe("STR-MUM-01");
  });
});
