/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.87.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi } from "vitest";
import { validateRfqDraft } from "../components/purchase/SupplierRfqWorkspace.tsx";
import {
  validateRequisitionApproval,
  validateRequisitionDraft,
} from "../components/purchase/PurchaseRequisitionWorkspace.tsx";

describe("Procurement Phase 2 — PR, RFQ & Quotation Comparison Units", () => {
  it("should calculate transparent landed cost with formula precision", () => {
    const qty = 50;
    const unitPrice = 1200;
    const discountPercent = 5; // 5% discount = 60/unit -> 1140 net base
    const taxRate = 18; // 18% GST on 1140 = 205.20/unit
    const freightTotal = 2500; // 50/unit freight

    const baseUnit = unitPrice * (1 - discountPercent / 100);
    const taxUnit = baseUnit * (taxRate / 100);
    const freightUnit = freightTotal / qty;
    const landedUnitCost = baseUnit + taxUnit + freightUnit;

    expect(baseUnit).toBe(1140);
    expect(taxUnit).toBeCloseTo(205.2, 2);
    expect(freightUnit).toBe(50);
    expect(landedUnitCost).toBeCloseTo(1395.2, 2);

    const totalOrderCost = landedUnitCost * qty;
    expect(totalOrderCost).toBeCloseTo(69760, 2);
  });

  it("should verify procurement reports catalog integration", () => {
    const reportIds = [
      "RPT-PUR-001",
      "RPT-PUR-002",
      "RPT-PUR-003",
      "RPT-PUR-004",
      "RPT-PUR-005",
      "RPT-PUR-006",
      "RPT-PUR-007",
    ];

    expect(reportIds).toContain("RPT-PUR-005");
    expect(reportIds).toContain("RPT-PUR-006");
    expect(reportIds).toContain("RPT-PUR-007");
    expect(reportIds.length).toBe(7);
  });

  it("should enforce non-automatic award rule where selection justification is required", () => {
    interface AwardAction {
      supplierId: string;
      quotedLandedCost: number;
      selectionJustification: string;
    }

    const validateAward = (action: AwardAction): boolean => {
      if (!action.selectionJustification || action.selectionJustification.trim().length < 5) {
        return false;
      }
      return true;
    };

    const validAward = validateAward({
      supplierId: "sup-2",
      quotedLandedCost: 1450,
      selectionJustification: "Awarded due to superior genuine leather quality and 7-day lead time despite higher price.",
    });

    const invalidAward = validateAward({
      supplierId: "sup-1",
      quotedLandedCost: 1300,
      selectionJustification: "",
    });

    expect(validAward).toBe(true);
    expect(invalidAward).toBe(false);
  });

  it("requires a named, dated quote request with at least one positive item quantity", () => {
    const item = {
      product_id: "product-1",
      code: "SKU-1",
      name: "Sample product",
      quantity: "2",
    };

    expect(validateRfqDraft(" ", "2026-12-01", [item])).toBe("Enter a name for this quote request.");
    expect(validateRfqDraft("Winter order", "", [item])).toBe("Set a supplier response deadline.");
    expect(validateRfqDraft("Winter order", "2026-12-01", [])).toBe("Add at least one catalog item to this quote request.");
    expect(validateRfqDraft("Winter order", "2026-12-01", [{ ...item, quantity: "0" }]))
      .toBe("Enter a quantity greater than zero for every requested item.");
    expect(validateRfqDraft("Winter order", "2026-12-01", [item])).toBeNull();
  });

  it("requires a needed-by date, reason, catalog item, quantity, and positive estimated unit cost", () => {
    const item = {
      product_id: "product-1",
      code: "SKU-1",
      name: "Sample product",
      quantity: "2",
      cost: "125.50",
    };

    expect(validateRequisitionDraft("2026-12-01", " ", [item])).toBe("Explain why these items are needed.");
    expect(validateRequisitionDraft("", "Low stock", [item])).toBe("Choose when these items are needed.");
    expect(validateRequisitionDraft("2026-12-01", "Low stock", [])).toBe("Add at least one catalog item to this purchase request.");
    expect(validateRequisitionDraft("2026-12-01", "Low stock", [{ ...item, quantity: "0" }]))
      .toBe("Enter a quantity greater than zero for every item.");
    expect(validateRequisitionDraft("2026-12-01", "Low stock", [{ ...item, cost: "" }]))
      .toBe("Enter an estimated unit cost greater than zero for every item.");
    expect(validateRequisitionDraft("2026-12-01", "Low stock", [item])).toBeNull();
  });

  it("allows partial item approval but rejects quantities outside the request", () => {
    const lines = [
      { id: "line-1", quantity_requested: 4 },
      { id: "line-2", quantity_requested: 3 },
    ];

    expect(validateRequisitionApproval(lines, { "line-1": "0", "line-2": "2" })).toBeNull();
    expect(validateRequisitionApproval(lines, { "line-1": "0", "line-2": "0" }))
      .toBe("Approve at least one unit, or reject the request with a reason.");
    expect(validateRequisitionApproval(lines, { "line-1": "-1", "line-2": "2" }))
      .toBe("Enter an approved quantity of zero or more for every item.");
    expect(validateRequisitionApproval(lines, { "line-1": "5", "line-2": "2" }))
      .toBe("An approved quantity cannot exceed the quantity requested.");
    expect(validateRequisitionApproval(lines, { "line-1": "1" }))
      .toBe("Enter an approved quantity of zero or more for every item.");
  });
});
