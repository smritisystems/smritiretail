/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.30.0
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Sales Return & Statutory GST Section 15 Bundle Clawback Engine
 */

export interface InvoicePromoLineItem {
  sku: string;
  name: string;
  originalQty: number;
  unitPrice: number;
  discountAmt: number;
  paidAmount: number;
  isFreeItem: boolean;
  promoCode?: string;
  promoBundleId?: string;
}

export interface ReturnItemRequest {
  sku: string;
  returnQty: number;
}

export interface ClawbackEvaluationResult {
  hasPromotionalBundle: boolean;
  isBundleBroken: boolean;
  clawbackRequired: boolean;
  clawbackAmount: number;
  grossRefundAmount: number;
  netCreditNoteRefund: number;
  requiresFreeItemReturn: boolean;
  retainedFreeItems: Array<{
    sku: string;
    name: string;
    retainedQty: number;
    unitPrice: number;
    clawbackValue: number;
  }>;
  complianceNotes: string;
  statutoryGstSection15Compliant: boolean;
  warnings: string[];
}

export class SmritiPromotionClawbackService {
  /**
   * Evaluates return items against original invoice bundle redemptions.
   * Enforces B2G1 (Buy 2 Get 1) and Buy X Get Y return integrity.
   * Ensures Credit Note taxable value strictly conforms to CGST Section 15.
   */
  public static calculateReturnClawback(params: {
    invoiceLines: InvoicePromoLineItem[];
    returnRequests: ReturnItemRequest[];
    bundleQualifyingRatio?: { buyQty: number; freeQty: number }; // default 2 buy -> 1 free (B2G1)
  }): ClawbackEvaluationResult {
    const { invoiceLines, returnRequests } = params;
    const ratio = params.bundleQualifyingRatio || { buyQty: 2, freeQty: 1 };

    // 1. Identify bundle lines: paid qualifying items and free items
    const freeLines = invoiceLines.filter((l) => l.isFreeItem || l.paidAmount === 0 || l.discountAmt >= l.unitPrice);
    const paidLines = invoiceLines.filter((l) => !l.isFreeItem && l.paidAmount > 0 && l.discountAmt < l.unitPrice);

    const hasPromotionalBundle = freeLines.length > 0 && paidLines.length > 0;

    // Calculate gross refund requested
    let grossRefundAmount = 0;
    for (const req of returnRequests) {
      const line = invoiceLines.find((l) => l.sku === req.sku);
      if (line) {
        const lineNetPerUnit = line.originalQty > 0 ? line.paidAmount / line.originalQty : 0;
        grossRefundAmount += req.returnQty * lineNetPerUnit;
      }
    }

    if (!hasPromotionalBundle) {
      return {
        hasPromotionalBundle: false,
        isBundleBroken: false,
        clawbackRequired: false,
        clawbackAmount: 0,
        grossRefundAmount,
        netCreditNoteRefund: grossRefundAmount,
        requiresFreeItemReturn: false,
        retainedFreeItems: [],
        complianceNotes: "Standard return with no promotional bundle clawback.",
        statutoryGstSection15Compliant: true,
        warnings: [],
      };
    }

    // 2. Track returned quantities for paid vs free lines
    const returnMap = new Map<string, number>();
    for (const r of returnRequests) {
      returnMap.set(r.sku, (returnMap.get(r.sku) || 0) + r.returnQty);
    }

    let totalOriginalPaidQty = 0;
    let totalReturnedPaidQty = 0;
    for (const p of paidLines) {
      totalOriginalPaidQty += p.originalQty;
      totalReturnedPaidQty += Math.min(p.originalQty, returnMap.get(p.sku) || 0);
    }
    const remainingPaidQty = totalOriginalPaidQty - totalReturnedPaidQty;

    let totalOriginalFreeQty = 0;
    let totalReturnedFreeQty = 0;
    const retainedFreeItems: Array<{
      sku: string;
      name: string;
      retainedQty: number;
      unitPrice: number;
      clawbackValue: number;
    }> = [];

    for (const f of freeLines) {
      totalOriginalFreeQty += f.originalQty;
      const returnedFree = Math.min(f.originalQty, returnMap.get(f.sku) || 0);
      totalReturnedFreeQty += returnedFree;
      const retainedQty = f.originalQty - returnedFree;
      if (retainedQty > 0) {
        retainedFreeItems.push({
          sku: f.sku,
          name: f.name,
          retainedQty,
          unitPrice: f.unitPrice,
          clawbackValue: retainedQty * f.unitPrice,
        });
      }
    }

    // 3. Compute allowable free units based on remaining paid units
    // For B2G1 (buyQty=2, freeQty=1), every 2 paid units earns 1 free unit
    const allowableFreeQty = Math.floor(remainingPaidQty / ratio.buyQty) * ratio.freeQty;
    const currentRetainedFreeQty = totalOriginalFreeQty - totalReturnedFreeQty;

    const excessFreeQty = Math.max(0, currentRetainedFreeQty - allowableFreeQty);
    const isBundleBroken = totalReturnedPaidQty > 0 && excessFreeQty > 0;

    let clawbackAmount = 0;
    let requiresFreeItemReturn = false;
    const warnings: string[] = [];

    if (isBundleBroken) {
      // Calculate clawback amount for excess free pieces retained
      let qtyToClaw = excessFreeQty;
      for (const item of retainedFreeItems) {
        const clawUnits = Math.min(qtyToClaw, item.retainedQty);
        clawbackAmount += clawUnits * item.unitPrice;
        qtyToClaw -= clawUnits;
        if (qtyToClaw <= 0) break;
      }

      if (remainingPaidQty < ratio.buyQty) {
        warnings.push(
          `Customer return reduces eligible purchase below qualifying threshold (${ratio.buyQty} paid required for ${ratio.freeQty} free).`
        );
      }

      if (clawbackAmount >= grossRefundAmount) {
        requiresFreeItemReturn = true;
        warnings.push(
          "Clawback exceeds or equals return refund. Customer must return free promotional piece to receive credit note."
        );
      }
    }

    const netCreditNoteRefund = Math.max(0, grossRefundAmount - clawbackAmount);

    const complianceNotes = isBundleBroken
      ? `Statutory GST Sec. 15 Adjustment: ₹${clawbackAmount.toFixed(2)} clawback deducted for ${excessFreeQty} retained promotional item(s).`
      : "Full bundle integrity preserved under CGST Sec. 15.";

    return {
      hasPromotionalBundle: true,
      isBundleBroken,
      clawbackRequired: isBundleBroken && clawbackAmount > 0,
      clawbackAmount,
      grossRefundAmount,
      netCreditNoteRefund,
      requiresFreeItemReturn,
      retainedFreeItems,
      complianceNotes,
      statutoryGstSection15Compliant: true,
      warnings,
    };
  }
}
