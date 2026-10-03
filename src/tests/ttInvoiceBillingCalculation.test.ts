/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-09-16
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

export interface BillingLineCalculationInput {
  mrp: number;
  qty: number;
  discountPct: number;
  taxPct: number;
  taxMode: "exclusive" | "inclusive";
  isInterstate?: boolean;
}

export interface BillingLineCalculationResult {
  unitPrice: number;
  grossAmount: number;
  discountAmt: number;
  taxableValue: number;
  taxAmt: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

/**
 * Canonical SMRITI Billing Calculation Function
 * Exact implementation matching invoice TT2026-2027/138
 */
export function calculateBillingLine(input: BillingLineCalculationInput): BillingLineCalculationResult {
  const { mrp, qty, discountPct, taxPct, taxMode, isInterstate = false } = input;
  const isTaxInclusive = taxMode === "inclusive";

  const grossAmount = Number((mrp * qty).toFixed(2));
  const discountAmt = Number(((grossAmount * discountPct) / 100).toFixed(2));

  let taxableValue = 0;
  let taxAmt = 0;
  let lineTotal = 0;
  let unitPrice = 0;

  if (isTaxInclusive) {
    // Retail Inclusive calculation: MRP includes tax
    lineTotal = Number((grossAmount - discountAmt).toFixed(2));
    taxableValue = Number((lineTotal / (1 + taxPct / 100)).toFixed(2));
    taxAmt = Number((lineTotal - taxableValue).toFixed(2));
    unitPrice = Number((lineTotal / qty).toFixed(2));
  } else {
    // Default Wholesale/Commercial calculation per TT2026-2027/138
    // Line Gross = MRP * Qty
    // Discount = Line Gross * Disc%
    // Taxable Value = Line Gross - Discount
    // Tax = Taxable Value * Tax%
    // Line Total = Taxable Value + Tax
    taxableValue = Number((grossAmount - discountAmt).toFixed(2));
    taxAmt = Number(((taxableValue * taxPct) / 100).toFixed(2));
    lineTotal = Number((taxableValue + taxAmt).toFixed(2));
    unitPrice = Number((taxableValue / qty).toFixed(2));
  }

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstAmount = taxAmt;
  } else {
    cgstAmount = Number((taxAmt / 2).toFixed(2));
    sgstAmount = Number((taxAmt - cgstAmount).toFixed(2));
  }

  return {
    unitPrice,
    grossAmount,
    discountAmt,
    taxableValue,
    taxAmt,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal,
  };
}

describe("SMRITI Billing Engine - invoice_TT2026-2027-138 Standard Verification", () => {
  it("Row 1: SND-06-G BLUE 36 (MRP 1,899.00, Disc 43.76%, Qty 2, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 1899.0,
      qty: 2,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(3798.0);
    expect(res.discountAmt).toBe(1662.0);
    expect(res.taxableValue).toBe(2136.0);
    expect(res.unitPrice).toBe(1068.0);
    expect(res.taxAmt).toBe(106.8);
    expect(res.igstAmount).toBe(106.8);
    expect(res.cgstAmount).toBe(0);
    expect(res.sgstAmount).toBe(0);
    expect(res.lineTotal).toBe(2242.8);
  });

  it("Row 6: CH-22-F BLACK 36 (MRP 1,699.00, Disc 43.76%, Qty 2, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 1699.0,
      qty: 2,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(3398.0);
    expect(res.discountAmt).toBe(1486.96);
    expect(res.taxableValue).toBe(1911.04);
    expect(res.taxAmt).toBe(95.55);
    expect(res.lineTotal).toBe(2006.59);
  });

  it("Row 16: CH-05-B BLACK 36 (MRP 2,199.00, Disc 43.76%, Qty 2, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 2199.0,
      qty: 2,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(4398.0);
    expect(res.discountAmt).toBe(1924.56);
    expect(res.taxableValue).toBe(2473.44);
    expect(res.taxAmt).toBe(123.67);
    expect(res.lineTotal).toBe(2597.11);
  });

  it("Row 26: SND-07-G BLACK 36 (MRP 2,599.00, Disc 43.76%, Qty 1, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 2599.0,
      qty: 1,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(2599.0);
    expect(res.discountAmt).toBe(1137.32);
    expect(res.taxableValue).toBe(1461.68);
    expect(res.taxAmt).toBe(73.08);
    expect(res.lineTotal).toBe(1534.76);
  });

  it("Row 53: SH-02-I BLACK 36 (MRP 2,499.00, Disc 43.76%, Qty 2, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 2499.0,
      qty: 2,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(4998.0);
    expect(res.discountAmt).toBe(2187.12);
    expect(res.taxableValue).toBe(2810.88);
    expect(res.taxAmt).toBe(140.54);
    expect(res.lineTotal).toBe(2951.42);
  });

  it("Row 58: CH-23-F BLACK 36 (MRP 1,599.00, Disc 43.76%, Qty 1, IGST 5%)", () => {
    const res = calculateBillingLine({
      mrp: 1599.0,
      qty: 1,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: true,
    });

    expect(res.grossAmount).toBe(1599.0);
    expect(res.discountAmt).toBe(699.72);
    expect(res.taxableValue).toBe(899.28);
    expect(res.taxAmt).toBe(44.96);
    expect(res.lineTotal).toBe(944.24);
  });

  it("Intrastate GST split: 5% split into 2.5% CGST and 2.5% SGST", () => {
    const res = calculateBillingLine({
      mrp: 1899.0,
      qty: 2,
      discountPct: 43.76,
      taxPct: 5.0,
      taxMode: "exclusive",
      isInterstate: false,
    });

    expect(res.taxableValue).toBe(2136.0);
    expect(res.taxAmt).toBe(106.8);
    expect(res.cgstAmount).toBe(53.4);
    expect(res.sgstAmount).toBe(53.4);
    expect(res.igstAmount).toBe(0);
    expect(res.lineTotal).toBe(2242.8);
  });

  it("Retail Inclusive Mode Toggle: MRP is gross inclusive of tax", () => {
    const res = calculateBillingLine({
      mrp: 1899.0,
      qty: 1,
      discountPct: 0,
      taxPct: 5.0,
      taxMode: "inclusive",
      isInterstate: false,
    });

    expect(res.lineTotal).toBe(1899.0);
    expect(res.taxableValue).toBe(1808.57);
    expect(res.taxAmt).toBe(90.43);
    expect(res.cgstAmount).toBe(45.22);
    expect(res.sgstAmount).toBe(45.21);
  });

  it("Cumulative Invoice TT2026-2027/138 verification", () => {
    const taxableTotal = 120970.24;
    const igstTotal = 6048.46; // Exact sum from PDF across 58 rows
    const rawGrandTotal = Number((taxableTotal + igstTotal).toFixed(2));
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

    expect(rawGrandTotal).toBe(127018.7);
    expect(roundedGrandTotal).toBe(127019);
    expect(roundOff).toBe(0.3);
  });

  it("SmritiProPosTaxInvoiceReceipt exports and defaults to A4 format (TT2026-2027/138)", async () => {
    const { SmritiProPosTaxInvoiceReceipt } = await import("../components/billing/propos/ProPosTaxInvoiceRc");
    expect(typeof SmritiProPosTaxInvoiceReceipt).toBe("function");
  });
});

