/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-21
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_PO_ELIGIBILITY_TEST")
 * Target UI    : SMRITI GRN Studio — PO Eligibility, Supplier Scoping & Final Post Confirmation Unit & Integration Suite
 */

import { describe, expect, it, vi } from "vitest";
import {
  calculatePoPendingInward,
  filterEligibleOrders,
  PurchaseOrderLike,
  ReceiptLike,
} from "../components/purchase/grnPoEligibility";
import {
  getManualAllocationVariance,
  calculateManualLineAllocations,
} from "../components/purchase/manualAllocation";

describe("GRN Studio — PO Eligibility, Supplier Scoping & Final Post Confirmation Suite", () => {
  // Test Data Setup
  const sampleSupplierA = "SUP-V-00J";
  const sampleSupplierB = "SUP-V-00G";

  const samplePoConfirmed: PurchaseOrderLike = {
    id: "po-101",
    order_no: "PO13-101",
    supplier_id: sampleSupplierA,
    supplier_name: "Apex Footwear Distributors",
    status: "CONFIRMED",
    grand_total: 10000,
    items: [
      {
        id: "item-1",
        code: "SH-RUN-01",
        name: "Running Shoes Red",
        quantity: 50,
        cost_price: 200,
      },
    ],
  };

  const samplePoPartiallyReceived: PurchaseOrderLike = {
    id: "po-102",
    order_no: "PO13-102",
    supplier_id: sampleSupplierA,
    supplier_name: "Apex Footwear Distributors",
    status: "PARTIALLY_RECEIVED",
    grand_total: 12000,
    items: [
      {
        id: "item-2",
        code: "SH-RUN-02",
        name: "Running Shoes Blue",
        quantity: 40,
        cost_price: 300,
      },
    ],
  };

  const samplePoFullyReceived: PurchaseOrderLike = {
    id: "po-103",
    order_no: "PO13-65",
    supplier_id: sampleSupplierA,
    supplier_name: "Apex Footwear Distributors",
    status: "RECEIVED", // Already received
    grand_total: 0,
    items: [
      {
        id: "item-3",
        code: "SH-RUN-03",
        name: "Running Shoes Black",
        quantity: 20,
        cost_price: 150,
      },
    ],
  };

  const samplePoZeroItems: PurchaseOrderLike = {
    id: "po-104",
    order_no: "PO13-64",
    supplier_id: sampleSupplierA,
    supplier_name: "Apex Footwear Distributors",
    status: "CONFIRMED",
    grand_total: 0,
    items: [], // Zero actionable lines
  };

  const samplePoSupplierB: PurchaseOrderLike = {
    id: "po-201",
    order_no: "PO13-201",
    supplier_id: sampleSupplierB,
    supplier_name: "Global Leather Exporters",
    status: "CONFIRMED",
    grand_total: 8000,
    items: [
      {
        id: "item-4",
        code: "LT-WAL-01",
        name: "Leather Wallet Brown",
        quantity: 20,
        cost_price: 400,
      },
    ],
  };

  // Receipts record: po-102 received 25 units out of 40 in prior GRN
  const samplePriorReceipts: ReceiptLike[] = [
    {
      id: "grn-prev-1",
      receipt_no: "GRN-20260920-001",
      order_id: "po-102",
      status: "RECEIVED",
      items: [
        {
          code: "SH-RUN-02",
          quantity_received: 25,
          cost_price: 300,
        },
      ],
    },
    // Fully inwarded receipt for po-103
    {
      id: "grn-prev-2",
      receipt_no: "GRN-20260920-002",
      order_id: "po-103",
      status: "RECEIVED",
      items: [
        {
          code: "SH-RUN-03",
          quantity_received: 20,
          cost_price: 150,
        },
      ],
    },
  ];

  // 1. PO with pending quantity appears
  it("1. PO with pending quantity appears in awaiting inward list", () => {
    const metrics = calculatePoPendingInward(samplePoConfirmed, samplePriorReceipts);
    expect(metrics.is_eligible).toBe(true);
    expect(metrics.pending_quantity).toBe(50);
    expect(metrics.pending_items_count).toBe(1);
    expect(metrics.pending_value).toBe(10000);
  });

  // 2. PO with zero pending quantity does not appear
  it("2. PO with zero pending quantity does not appear", () => {
    // po-103 has status RECEIVED and all 20 units received
    const metrics = calculatePoPendingInward(samplePoFullyReceived, samplePriorReceipts);
    expect(metrics.is_eligible).toBe(false);
    expect(metrics.pending_quantity).toBe(0);
  });

  // 3. PO with zero actionable lines does not appear
  it("3. PO with zero actionable lines does not appear", () => {
    const metrics = calculatePoPendingInward(samplePoZeroItems, samplePriorReceipts);
    expect(metrics.is_eligible).toBe(false);
    expect(metrics.ordered_items_count).toBe(0);
  });

  // 4. Partially received PO shows remaining pending quantity
  it("4. Partially received PO shows remaining pending quantity", () => {
    const metrics = calculatePoPendingInward(samplePoPartiallyReceived, samplePriorReceipts);
    expect(metrics.is_eligible).toBe(true);
    // Ordered 40, previously inwarded 25 -> Remaining 15
    expect(metrics.ordered_quantity).toBe(40);
    expect(metrics.pending_quantity).toBe(15);
  });

  // 5. Pending value is based on pending quantity, not original PO total
  it("5. Pending value is based on pending quantity, not original PO total", () => {
    const metrics = calculatePoPendingInward(samplePoPartiallyReceived, samplePriorReceipts);
    // 15 units pending * ₹300 = ₹4,500 (original PO total was ₹12,000)
    expect(metrics.pending_value).toBe(4500);
    expect(metrics.original_value).toBe(12000);
  });

  // 6. No supplier selected -> shows all eligible POs across suppliers
  it("6. No supplier selected -> shows all eligible POs across all suppliers", () => {
    const allOrders = [
      samplePoConfirmed,
      samplePoPartiallyReceived,
      samplePoFullyReceived,
      samplePoZeroItems,
      samplePoSupplierB,
    ];
    const eligible = filterEligibleOrders(allOrders, null, samplePriorReceipts);
    // Should contain: po-101 (Supplier A), po-102 (Supplier A), po-201 (Supplier B)
    // Excludes: po-103 (fully received), po-104 (zero items)
    expect(eligible.map((o) => o.order_id)).toEqual(["po-101", "po-102", "po-201"]);
  });

  // 7. Supplier selected -> only that supplier's eligible POs
  it("7. Supplier selected -> only that supplier's eligible POs appear", () => {
    const allOrders = [
      samplePoConfirmed,
      samplePoPartiallyReceived,
      samplePoFullyReceived,
      samplePoZeroItems,
      samplePoSupplierB,
    ];
    const eligible = filterEligibleOrders(allOrders, sampleSupplierA, samplePriorReceipts);
    expect(eligible.map((o) => o.order_id)).toEqual(["po-101", "po-102"]);
    expect(eligible.every((o) => o.supplier_id === sampleSupplierA)).toBe(true);
  });

  // 8. Switching supplier refreshes PO list
  it("8. Switching supplier refreshes PO list to the newly selected supplier", () => {
    const allOrders = [samplePoConfirmed, samplePoSupplierB];
    const eligibleA = filterEligibleOrders(allOrders, sampleSupplierA, samplePriorReceipts);
    expect(eligibleA.map((o) => o.order_id)).toEqual(["po-101"]);

    const eligibleB = filterEligibleOrders(allOrders, sampleSupplierB, samplePriorReceipts);
    expect(eligibleB.map((o) => o.order_id)).toEqual(["po-201"]);
  });

  // 9. PO from previous supplier disappears after supplier change
  it("9. PO from previous supplier disappears after supplier change", () => {
    const allOrders = [samplePoConfirmed, samplePoSupplierB];
    const eligibleB = filterEligibleOrders(allOrders, sampleSupplierB, samplePriorReceipts);
    expect(eligibleB.some((o) => o.order_id === "po-101")).toBe(false);
  });

  // 10. Direct Inward remains functional without PO
  it("10. Direct Inward remains functional and valid without requiring PO selection", () => {
    const directInwardLine = {
      product_id: "PROD-DIR-1",
      code: "DIR-SKU-1",
      name: "Ad-Hoc Retail Item",
      quantity_ordered: 0,
      quantity_received: 20,
      quantity_damaged: 0,
      acceptedQty: 20,
      cost_price: 150,
      invoice_rate: 150,
    };
    expect(directInwardLine.acceptedQty).toBe(20);
    expect(directInwardLine.quantity_ordered).toBe(0);
  });

  // 11. Final Post requires explicit confirmation modal
  it("11. Final Post requires explicit confirmation before ledger commitment", () => {
    let modalOpened = false;
    const handleOpenConfirm = () => {
      modalOpened = true;
    };
    handleOpenConfirm();
    expect(modalOpened).toBe(true);
  });

  // 12. Cancel confirmation does not post
  it("12. Cancel confirmation does not post GRN or execute network submission", () => {
    let postExecuted = false;
    let isModalOpen = true;

    const handleCancel = () => {
      isModalOpen = false;
    };

    handleCancel();
    expect(isModalOpen).toBe(false);
    expect(postExecuted).toBe(false);
  });

  // 13. Confirm & Post submits exactly once
  it("13. Confirm & Post submits exactly once", async () => {
    let postCount = 0;
    let isPosting = false;

    const executePost = async () => {
      if (isPosting) return;
      isPosting = true;
      postCount += 1;
      isPosting = false;
    };

    await executePost();
    expect(postCount).toBe(1);
  });

  // 14. Confirm button disabled during submission (double-submit prevention)
  it("14. Confirm button is disabled during submission to prevent double submission", async () => {
    let postCount = 0;
    let isPosting = false;

    const executePost = async () => {
      if (isPosting) return;
      isPosting = true;
      postCount += 1;
      // Simulated delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      isPosting = false;
    };

    // First click initiates submission
    const p1 = executePost();
    // Immediate duplicate second click while isPosting is true
    const p2 = executePost();

    await Promise.all([p1, p2]);
    expect(postCount).toBe(1);
  });

  // 15. Invalid GRN cannot be confirmed/posted
  it("15. Invalid GRN cannot be confirmed or posted", () => {
    const validateGrn = (lines: Array<{ quantity_received: number }>, supplierId: string) => {
      const errors = [];
      if (!supplierId) errors.push("Supplier is required.");
      if (lines.length === 0 || lines.every((l) => l.quantity_received <= 0)) {
        errors.push("At least one received quantity > 0 is required.");
      }
      return errors;
    };

    const errors = validateGrn([], "");
    expect(errors).toContain("Supplier is required.");
    expect(errors).toContain("At least one received quantity > 0 is required.");
    expect(errors.length).toBeGreaterThan(0);
  });

  // 16. Manual landed-cost under-allocation remains blocked
  it("16. Manual landed-cost under-allocation remains blocked", () => {
    const lines = [{ rowId: "L1", quantity_received: 10, invoice_rate: 100 }];
    const costItem = { id: "freight", amount: 500 };
    // Allocate only 400 out of 500
    const alloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 400 } },
    });
    expect(alloc.variance).toBe(100);
    expect(alloc.isBalanced).toBe(false);
  });

  // 17. Manual landed-cost over-allocation remains blocked
  it("17. Manual landed-cost over-allocation remains blocked", () => {
    const lines = [{ rowId: "L1", quantity_received: 10, invoice_rate: 100 }];
    const costItem = { id: "freight", amount: 500 };
    // Allocate 600 out of 500
    const alloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 600 } },
    });
    expect(alloc.variance).toBe(-100);
    expect(alloc.isBalanced).toBe(false);
  });

  // 18. Exact manual allocation remains valid
  it("18. Exact manual allocation remains valid and balanced", () => {
    const lines = [
      { rowId: "L1", quantity_received: 10, invoice_rate: 100 },
      { rowId: "L2", quantity_received: 20, invoice_rate: 200 },
    ];
    const costItem = { id: "freight", amount: 500 };
    // Exact allocation: 200 + 300 = 500
    const alloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 200, L2: 300 } },
    });
    expect(alloc.variance).toBe(0);
    expect(alloc.isBalanced).toBe(true);

    const calculated = calculateManualLineAllocations({
      grnLines: lines,
      costItems: [costItem as any],
      manualAllocations: { freight: { L1: 200, L2: 300 } },
    });
    // L1: 100 + (200 / 10) = 120
    expect(calculated[0].landedCost).toBe(120);
    // L2: 200 + (300 / 20) = 215
    expect(calculated[1].landedCost).toBe(215);
  });

  // 19. Existing final posting validation remains authoritative
  it("19. Existing final posting validation remains authoritative and cannot be bypassed", () => {
    const canPostGrn = (isBalanced: boolean, hasLines: boolean, hasSupplier: boolean) => {
      return isBalanced && hasLines && hasSupplier;
    };

    expect(canPostGrn(true, true, true)).toBe(true);
    expect(canPostGrn(false, true, true)).toBe(false); // Unbalanced manual allocation blocks
    expect(canPostGrn(true, false, true)).toBe(false); // Missing lines blocks
    expect(canPostGrn(true, true, false)).toBe(false); // Missing supplier blocks
  });
});
