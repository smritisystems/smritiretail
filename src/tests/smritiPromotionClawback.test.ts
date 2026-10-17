/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * Pushpa Devi Jawahar Mallah — Founder & Chairperson
 * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
 * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version    : 6.30.0
 * Created    : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 * Classification: Internal
 *
 * Test Suite : SMRITI B2G1 Promotional Return Integrity & Statutory GST Sec. 15 Clawback
 */

import { describe, it, expect } from "vitest";
import {
  SmritiPromotionClawbackService,
  InvoicePromoLineItem,
} from "../services/smritiPromotionClawbackService";

// Standard Retail Scenario:
// Customer bought 2 Shirts @ ₹1,000 each = ₹2,000 paid.
// Received 1 Shirt @ ₹1,000 for FREE under B2G1 promo.
// Total invoice: 3 Shirts, Total paid = ₹2,000 (regular price ₹3,000).
const b2g1InvoiceLines: InvoicePromoLineItem[] = [
  {
    sku: "SHIRT-BLUE-M",
    name: "Cotton Formal Shirt Blue (M)",
    originalQty: 1,
    unitPrice: 1000,
    discountAmt: 0,
    paidAmount: 1000,
    isFreeItem: false,
    promoCode: "B2G1-APPAREL",
  },
  {
    sku: "SHIRT-BLUE-L",
    name: "Cotton Formal Shirt Blue (L)",
    originalQty: 1,
    unitPrice: 1000,
    discountAmt: 0,
    paidAmount: 1000,
    isFreeItem: false,
    promoCode: "B2G1-APPAREL",
  },
  {
    sku: "SHIRT-WHITE-M",
    name: "Cotton Formal Shirt White (M)",
    originalQty: 1,
    unitPrice: 1000,
    discountAmt: 1000,
    paidAmount: 0,
    isFreeItem: true,
    promoCode: "B2G1-APPAREL",
  },
];

describe("SmritiPromotionClawbackService (B2G1 Return Integrity & GST Sec. 15)", () => {
  it("1. Returns full bundle (all 3 shirts): verifies 100% refund of ₹2,000 without clawback", () => {
    const result = SmritiPromotionClawbackService.calculateReturnClawback({
      invoiceLines: b2g1InvoiceLines,
      returnRequests: [
        { sku: "SHIRT-BLUE-M", returnQty: 1 },
        { sku: "SHIRT-BLUE-L", returnQty: 1 },
        { sku: "SHIRT-WHITE-M", returnQty: 1 },
      ],
      bundleQualifyingRatio: { buyQty: 2, freeQty: 1 },
    });

    expect(result.hasPromotionalBundle).toBe(true);
    expect(result.isBundleBroken).toBe(false);
    expect(result.clawbackRequired).toBe(false);
    expect(result.clawbackAmount).toBe(0);
    expect(result.grossRefundAmount).toBe(2000);
    expect(result.netCreditNoteRefund).toBe(2000);
    expect(result.requiresFreeItemReturn).toBe(false);
    expect(result.retainedFreeItems.length).toBe(0);
    expect(result.statutoryGstSection15Compliant).toBe(true);
  });

  it("2. Returns 2 paid shirts but retains the free shirt: enforces ₹1,000 clawback deduction", () => {
    // Customer bought 2 paid + 1 free. Returns both paid shirts, keeps free shirt.
    // Without clawback, customer would get ₹2,000 back and effectively steal the free piece.
    // With clawback: ₹2,000 gross refund - ₹1,000 (clawback for retained free shirt) = ₹1,000 net refund.
    const result = SmritiPromotionClawbackService.calculateReturnClawback({
      invoiceLines: b2g1InvoiceLines,
      returnRequests: [
        { sku: "SHIRT-BLUE-M", returnQty: 1 },
        { sku: "SHIRT-BLUE-L", returnQty: 1 },
      ],
      bundleQualifyingRatio: { buyQty: 2, freeQty: 1 },
    });

    expect(result.hasPromotionalBundle).toBe(true);
    expect(result.isBundleBroken).toBe(true);
    expect(result.clawbackRequired).toBe(true);
    expect(result.clawbackAmount).toBe(1000);
    expect(result.grossRefundAmount).toBe(2000);
    expect(result.netCreditNoteRefund).toBe(1000); // 2000 - 1000
    expect(result.retainedFreeItems.length).toBe(1);
    expect(result.retainedFreeItems[0].sku).toBe("SHIRT-WHITE-M");
    expect(result.statutoryGstSection15Compliant).toBe(true);
    expect(result.complianceNotes).toContain("Statutory GST Sec. 15 Adjustment: ₹1000.00 clawback");
  });

  it("3. Returns 1 paid shirt: customer drops below 2-paid threshold, clawback blocks refund", () => {
    // Remaining paid items: 1. But B2G1 requires 2 paid items to get 1 free.
    // Retained free items: 1 (worth ₹1,000).
    // Gross refund for 1 returned paid shirt: ₹1,000.
    // Clawback: ₹1,000.
    // Net refund: ₹0! Requires return of free item.
    const result = SmritiPromotionClawbackService.calculateReturnClawback({
      invoiceLines: b2g1InvoiceLines,
      returnRequests: [{ sku: "SHIRT-BLUE-M", returnQty: 1 }],
      bundleQualifyingRatio: { buyQty: 2, freeQty: 1 },
    });

    expect(result.isBundleBroken).toBe(true);
    expect(result.clawbackRequired).toBe(true);
    expect(result.clawbackAmount).toBe(1000);
    expect(result.grossRefundAmount).toBe(1000);
    expect(result.netCreditNoteRefund).toBe(0);
    expect(result.requiresFreeItemReturn).toBe(true);
    expect(result.warnings.some((w) => w.includes("Customer must return free promotional piece"))).toBe(true);
  });

  it("4. Returns ONLY the free shirt: verifies ₹0 refund and no clawback penalty", () => {
    // Customer simply returns the defective free shirt. Customer keeps the 2 paid shirts.
    const result = SmritiPromotionClawbackService.calculateReturnClawback({
      invoiceLines: b2g1InvoiceLines,
      returnRequests: [{ sku: "SHIRT-WHITE-M", returnQty: 1 }],
      bundleQualifyingRatio: { buyQty: 2, freeQty: 1 },
    });

    expect(result.isBundleBroken).toBe(false);
    expect(result.clawbackRequired).toBe(false);
    expect(result.clawbackAmount).toBe(0);
    expect(result.grossRefundAmount).toBe(0);
    expect(result.netCreditNoteRefund).toBe(0);
    expect(result.requiresFreeItemReturn).toBe(false);
  });

  it("5. Standard non-promotional return processes without bundle interference", () => {
    const regularInvoiceLines: InvoicePromoLineItem[] = [
      {
        sku: "JEANS-REG-32",
        name: "Slim Fit Jeans",
        originalQty: 2,
        unitPrice: 1999,
        discountAmt: 199.9,
        paidAmount: 3798.1,
        isFreeItem: false,
      },
    ];

    const result = SmritiPromotionClawbackService.calculateReturnClawback({
      invoiceLines: regularInvoiceLines,
      returnRequests: [{ sku: "JEANS-REG-32", returnQty: 1 }],
    });

    expect(result.hasPromotionalBundle).toBe(false);
    expect(result.isBundleBroken).toBe(false);
    expect(result.clawbackRequired).toBe(false);
    expect(result.netCreditNoteRefund).toBe(1899.05); // 3798.1 / 2
  });
});
