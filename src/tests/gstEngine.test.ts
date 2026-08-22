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
 */

import { describe, it, expect } from "vitest";
import { calculateGST, parseAndValidateGSTIN, GST_STATE_MAP } from "../utils/gstEngine.ts";

describe("GST Engine Frontend Utilities", () => {
  it("should validate and parse GSTIN correctly", () => {
    const mh = parseAndValidateGSTIN("27AAACS1234A1Z1");
    expect(mh.isValid).toBe(true);
    expect(mh.stateCode).toBe("27");
    expect(mh.stateName).toBe("Maharashtra");
    expect(mh.pan).toBe("AAACS1234A");

    const dl = parseAndValidateGSTIN("07AAAAA0000A1Z5");
    expect(dl.isValid).toBe(true);
    expect(dl.stateCode).toBe("07");
    expect(dl.stateName).toBe("Delhi");

    const invalid = parseAndValidateGSTIN("INVALID123");
    expect(invalid.isValid).toBe(false);
    expect(invalid.stateCode).toBe(null);
  });

  it("should calculate tax-inclusive MRP for B2C Intra-State correctly", () => {
    const res = calculateGST({
      unitPrice: 118,
      quantity: 1,
      discountAmount: 0,
      gstRate: 18,
      isTaxInclusive: true,
      isInterstate: false,
    });

    expect(res.totalAmount).toBe(118);
    expect(res.taxableValue).toBe(100);
    expect(res.taxAmount).toBe(18);
    expect(res.cgstAmount).toBe(9);
    expect(res.sgstAmount).toBe(9);
    expect(res.igstAmount).toBe(0);
  });

  it("should calculate tax-inclusive MRP for B2C Inter-State correctly", () => {
    const res = calculateGST({
      unitPrice: 118,
      quantity: 1,
      discountAmount: 0,
      gstRate: 18,
      isTaxInclusive: true,
      isInterstate: true,
    });

    expect(res.totalAmount).toBe(118);
    expect(res.taxableValue).toBe(100);
    expect(res.taxAmount).toBe(18);
    expect(res.cgstAmount).toBe(0);
    expect(res.sgstAmount).toBe(0);
    expect(res.igstAmount).toBe(18);
  });

  it("should calculate tax-exclusive rate for B2B Intra-State correctly", () => {
    const res = calculateGST({
      unitPrice: 1000,
      quantity: 2,
      discountAmount: 100,
      gstRate: 18,
      isTaxInclusive: false,
      isInterstate: false,
    });

    expect(res.taxableValue).toBe(1900);
    expect(res.taxAmount).toBe(342);
    expect(res.cgstAmount).toBe(171);
    expect(res.sgstAmount).toBe(171);
    expect(res.igstAmount).toBe(0);
    expect(res.totalAmount).toBe(2242);
  });

  it("should calculate tax-exclusive rate for B2B Inter-State correctly", () => {
    const res = calculateGST({
      unitPrice: 1000,
      quantity: 2,
      discountAmount: 100,
      gstRate: 18,
      isTaxInclusive: false,
      isInterstate: true,
    });

    expect(res.taxableValue).toBe(1900);
    expect(res.taxAmount).toBe(342);
    expect(res.cgstAmount).toBe(0);
    expect(res.sgstAmount).toBe(0);
    expect(res.igstAmount).toBe(342);
    expect(res.totalAmount).toBe(2242);
  });
});
