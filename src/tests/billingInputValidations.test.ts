/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  validateDirectEntryItem,
  validateQuickCustomer,
  validateSettlementTenders,
} from "../utils/billingValidators";

describe("Billing Input Validations - Direct Entry Line Items", () => {
  it("rejects entry without item code, barcode, or description", () => {
    const res = validateDirectEntryItem({
      qty: 1,
      rate: 100,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Please enter an item code");
  });

  it("rejects zero or negative quantity", () => {
    const zeroRes = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 0,
      rate: 100,
    });
    expect(zeroRes.valid).toBe(false);
    expect(zeroRes.error).toContain("Quantity must be a positive number");

    const negRes = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: -5,
      rate: 100,
    });
    expect(negRes.valid).toBe(false);
    expect(negRes.error).toContain("Quantity must be a positive number");
  });

  it("rejects out-of-bounds quantity (> 99,999)", () => {
    const res = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 100000,
      rate: 100,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Quantity exceeds maximum limit");
  });

  it("rejects negative selling rate", () => {
    const res = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 1,
      rate: -50,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Selling rate cannot be negative");
  });

  it("enforces statutory price ceiling: rate cannot exceed declared MRP", () => {
    const res = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 1,
      rate: 120,
      effectiveMrp: 100,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("cannot exceed statutory MRP");
  });

  it("allows selling rate equal to or below MRP", () => {
    const equalRes = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 2,
      rate: 100,
      effectiveMrp: 100,
    });
    expect(equalRes.valid).toBe(true);

    const lowerRes = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 2,
      rate: 80,
      effectiveMrp: 100,
    });
    expect(lowerRes.valid).toBe(true);
  });

  it("validates discount percentage and amount bounds", () => {
    const invalidPct = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 1,
      rate: 100,
      discPct: 105,
    });
    expect(invalidPct.valid).toBe(false);
    expect(invalidPct.error).toContain("Discount percentage must be between 0% and 100%");

    const invalidAmt = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 1,
      rate: 100,
      discAmt: 150,
    });
    expect(invalidAmt.valid).toBe(false);
    expect(invalidAmt.error).toContain("cannot exceed line item gross value");
  });
});

describe("Billing Input Validations - Quick Customer Entry", () => {
  it("rejects customer name shorter than 2 characters", () => {
    const res = validateQuickCustomer({ name: "A" });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("at least 2 characters");
  });

  it("rejects invalid Indian mobile numbers", () => {
    const shortRes = validateQuickCustomer({ name: "Rahul", mobile: "98765" });
    expect(shortRes.valid).toBe(false);
    expect(shortRes.error).toContain("valid 10-digit mobile number");

    const lettersRes = validateQuickCustomer({ name: "Rahul", mobile: "98765abcde" });
    expect(lettersRes.valid).toBe(false);

    const invalidPrefix = validateQuickCustomer({ name: "Rahul", mobile: "1234567890" });
    expect(invalidPrefix.valid).toBe(false);
  });

  it("accepts valid Indian mobile numbers", () => {
    const res = validateQuickCustomer({ name: "Rahul Sharma", mobile: "9876543210" });
    expect(res.valid).toBe(true);
  });

  it("validates statutory 15-character GSTIN format", () => {
    const malformed = validateQuickCustomer({
      name: "Acme Retail Ltd",
      mobile: "9876543210",
      gstin: "INVALIDGSTIN",
    });
    expect(malformed.valid).toBe(false);
    expect(malformed.error).toContain("Invalid GSTIN format");

    const validGstin = validateQuickCustomer({
      name: "Acme Retail Ltd",
      mobile: "9876543210",
      gstin: "27AAAAA0000A1Z5",
    });
    expect(validGstin.valid).toBe(true);
  });
});

describe("Billing Input Validations - Invoice Settlement Tenders", () => {
  it("rejects non-credit settlement with empty tenders", () => {
    const res = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [],
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("At least one payment tender must be specified");
  });

  it("rejects tender with zero or negative amount", () => {
    const res = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "Cash", amount: 0 }],
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("must be greater than 0");
  });

  it("requires reference number for digital tenders (Card, UPI, Cheque)", () => {
    const noRefUpi = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "UPI", amount: 500, refNo: "" }],
    });
    expect(noRefUpi.valid).toBe(false);
    expect(noRefUpi.error).toContain("Reference / Transaction / Auth number is required");

    const validUpi = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "UPI", amount: 500, refNo: "UPI/2026/09/88912" }],
    });
    expect(validUpi.valid).toBe(true);
  });

  it("disallows cash change on digital/card overpayment", () => {
    const res = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "Credit Card", amount: 600, refNo: "AUTH123456" }],
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Non-cash tenders");
    expect(res.error).toContain("cannot exceed the invoice net total");
  });

  it("allows cash overpayment with cash change due", () => {
    const res = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "Cash", amount: 600 }],
    });
    expect(res.valid).toBe(true);
  });

  it("rejects incomplete tender (total tendered < net amount)", () => {
    const res = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 500,
      payments: [{ mode: "Cash", amount: 400 }],
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Payment is incomplete");
  });

  it("validates B2B Credit sales and enforces customer credit limits", () => {
    const noCust = validateSettlementTenders({
      isCredit: true,
      customer: null,
      netAmount: 5000,
      payments: [],
    });
    expect(noCust.valid).toBe(false);
    expect(noCust.error).toContain("A customer account is required for B2B credit sales");

    const limitExceeded = validateSettlementTenders({
      isCredit: true,
      customer: {
        id: "CUST-CORP-1",
        name: "Enterprise Corp",
        creditLimit: 10000,
        outstanding: 8000,
      },
      netAmount: 5000, // 8000 + 5000 = 13000 > 10000
      payments: [],
    });
    expect(limitExceeded.valid).toBe(false);
    expect(limitExceeded.error).toContain("Customer credit limit exceeded");

    const withinLimit = validateSettlementTenders({
      isCredit: true,
      customer: {
        id: "CUST-CORP-1",
        name: "Enterprise Corp",
        creditLimit: 10000,
        outstanding: 4000,
      },
      netAmount: 5000, // 4000 + 5000 = 9000 <= 10000
      payments: [],
    });
    expect(withinLimit.valid).toBe(true);
  });

  it("enforces Section 269ST cash transaction limit (< ₹2,00,000)", () => {
    const cashExceeded = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 200000,
      payments: [{ mode: "Cash", amount: 200000 }],
    });
    expect(cashExceeded.valid).toBe(false);
    expect(cashExceeded.error).toContain("Section 269ST");

    const cashAllowed = validateSettlementTenders({
      isCredit: false,
      customer: null,
      netAmount: 199999,
      payments: [{ mode: "Cash", amount: 199999 }],
    });
    expect(cashAllowed.valid).toBe(true);
  });
});

describe("Billing Input Validations - Discrete UoM Decimals", () => {
  it("rejects fractional quantity for discrete units (PCS, NOS, PAIR)", () => {
    const fractionalPcs = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 1.5,
      rate: 100,
      uom: "PCS",
    });
    expect(fractionalPcs.valid).toBe(false);
    expect(fractionalPcs.error).toContain("Fractional quantity");
    expect(fractionalPcs.error).toContain("PCS");

    const fractionalPair = validateDirectEntryItem({
      stockNo: "SKU-002",
      qty: 2.25,
      rate: 500,
      uom: "PAIR",
    });
    expect(fractionalPair.valid).toBe(false);
    expect(fractionalPair.error).toContain("Fractional quantity");
  });

  it("permits fractional quantity for continuous units (KG, MTR, LTR)", () => {
    const continuousKg = validateDirectEntryItem({
      stockNo: "SKU-WEIGH",
      qty: 1.755,
      rate: 200,
      uom: "KG",
    });
    expect(continuousKg.valid).toBe(true);
  });

  it("permits integer quantity for discrete units", () => {
    const integerPcs = validateDirectEntryItem({
      stockNo: "SKU-001",
      qty: 5,
      rate: 100,
      uom: "PCS",
    });
    expect(integerPcs.valid).toBe(true);
  });
});

describe("Billing Input Validations - GSTIN State Code Range", () => {
  it("rejects invalid state codes in statutory GSTIN format", () => {
    const invalidStateGstin = validateQuickCustomer({
      name: "Enterprise Pvt Ltd",
      mobile: "9876543210",
      gstin: "45AAAAA0000A1Z5", // 45 is not a valid state code
    });
    expect(invalidStateGstin.valid).toBe(false);
    expect(invalidStateGstin.error).toContain("Invalid GSTIN state code '45'");
  });

  it("accepts valid state codes (e.g. 27 for Maharashtra, 07 for Delhi)", () => {
    const mhGstin = validateQuickCustomer({
      name: "Enterprise Pvt Ltd",
      mobile: "9876543210",
      gstin: "27AAAAA0000A1Z5",
    });
    expect(mhGstin.valid).toBe(true);

    const dlGstin = validateQuickCustomer({
      name: "Enterprise Pvt Ltd",
      mobile: "9876543210",
      gstin: "07AAAAA0000A1Z5",
    });
    expect(dlGstin.valid).toBe(true);
  });
});

import { calculateStatutoryRoundOff } from "../utils/billingValidators";

describe("Billing Input Validations - Statutory Round-Off Helper", () => {
  it("correctly calculates round-off to nearest whole rupee", () => {
    const res1 = calculateStatutoryRoundOff(542.40);
    expect(res1.roundedAmount).toBe(542);
    expect(res1.roundOffDelta).toBe(-0.40);

    const res2 = calculateStatutoryRoundOff(542.60);
    expect(res2.roundedAmount).toBe(543);
    expect(res2.roundOffDelta).toBe(0.40);

    const res3 = calculateStatutoryRoundOff(500.00);
    expect(res3.roundedAmount).toBe(500);
    expect(res3.roundOffDelta).toBe(0.00);
  });
});

