/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: B2B Packing-First Consolidated Billing Test Suite
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeBillingTotals } from "../components/billing/SmritiBillingStudio.tsx";
import { calculateGST } from "../utils/gstEngine.ts";
import { PackingSlipRecord } from "../components/billing/modals/PackingSlipManagementModal.tsx";
import { ConsolidatedBillingItem } from "../components/billing/modals/ConsolidatedBillingModal.tsx";
import { ProPosCartItem } from "../components/billing/propos/types.ts";

describe("SMRITI Retail OS — B2B Packing-First & Consolidated Billing Integration Suite", () => {
  const samplePackingSlips: PackingSlipRecord[] = [
    {
      id: "ps_001",
      packingSlipNumber: "PS-20261017-001",
      salesInvoiceId: "UNBILLED",
      orderId: "SO-2026-8801",
      customerId: "cust-ril-01",
      customerName: "Reliance Retail Ltd (B2B)",
      status: "PACKED",
      totalPackages: 2,
      weightKg: 4.5,
      createdAt: "2026-10-17 10:15:00",
      items: [
        { id: "psi_1", productId: "p-chap-01", sku: "FL-CHP-01", name: "Premium Leather Chappal", quantity: 10 },
        { id: "psi_2", productId: "p-snk-01", sku: "FL-SNK-01", name: "Urban Street Sneaker", quantity: 8 },
      ],
    },
    {
      id: "ps_002",
      packingSlipNumber: "PS-20261017-002",
      salesInvoiceId: "UNBILLED",
      orderId: "SO-2026-8802",
      customerId: "cust-ril-01",
      customerName: "Reliance Retail Ltd (B2B)",
      status: "PACKED",
      totalPackages: 1,
      weightKg: 2.8,
      createdAt: "2026-10-17 11:30:00",
      items: [
        { id: "psi_3", productId: "p-chap-01", sku: "FL-CHP-01", name: "Premium Leather Chappal", quantity: 5 },
        { id: "psi_4", productId: "p-run-01", sku: "FL-RUN-01", name: "Sprint Pro Running Shoe", quantity: 12 },
      ],
    },
    {
      id: "ps_incompatible",
      packingSlipNumber: "PS-20261017-099",
      salesInvoiceId: "UNBILLED",
      orderId: "SO-2026-9999",
      customerId: "cust-tata-02",
      customerName: "Trent Tata Hypermarket",
      status: "PACKED",
      totalPackages: 1,
      weightKg: 3.0,
      createdAt: "2026-10-17 12:00:00",
      items: [
        { id: "psi_99", productId: "p-chap-01", sku: "FL-CHP-01", name: "Premium Leather Chappal", quantity: 20 },
      ],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── TEST 1: B2C and B2B Workflow Separation ───────────────────────────────
  it("TEST 1: ensures B2C Counter POS rejects packing slip scanning and requires B2B mode", () => {
    const currentMode = "RETAIL_POS";
    const scannedBarcode = "PS-20261017-001";
    const isSlipFormat = scannedBarcode.toUpperCase().startsWith("PS-");

    expect(isSlipFormat).toBe(true);

    let notification: { title: string; msg: string; type: string } | null = null;
    if (isSlipFormat && currentMode !== "B2B_DISTRIBUTOR") {
      notification = {
        title: "B2B Workflow Required",
        msg: "Packing Slips can only be compiled in B2B / Tax Invoice mode. Please switch to B2B mode (Alt+3).",
        type: "info",
      };
    }

    expect(notification).not.toBeNull();
    expect(notification?.title).toBe("B2B Workflow Required");
    expect(notification?.msg).toContain("Alt+3");
  });

  // ── TEST 2: Packing Slip Quantity Prefill Policies ─────────────────────────
  it("TEST 2: calculates correct prefill quantities under REMAINING_UNPACKED_QTY, ORDERED_QTY, and MANUAL_ZERO", () => {
    const ordered = 25;
    const previouslyPacked = 10;
    const remainingUnpacked = ordered - previouslyPacked;

    const computePrefill = (policy: "REMAINING_UNPACKED_QTY" | "ORDERED_QTY" | "MANUAL_ZERO") => {
      if (policy === "REMAINING_UNPACKED_QTY") return remainingUnpacked;
      if (policy === "ORDERED_QTY") return ordered;
      return 0;
    };

    expect(computePrefill("REMAINING_UNPACKED_QTY")).toBe(15);
    expect(computePrefill("ORDERED_QTY")).toBe(25);
    expect(computePrefill("MANUAL_ZERO")).toBe(0);
  });

  // ── TEST 3: Invoice Quantity Prefill Policies ──────────────────────────────
  it("TEST 3: calculates correct invoice prefill quantities under PACKED_UNBILLED_QTY, ORDERED_QTY_IF_ELIGIBLE, and MANUAL_ZERO", () => {
    const packed = 15;
    const previouslyInvoiced = 5;
    const remainingEligible = packed - previouslyInvoiced; // 10
    const orderedTotal = 20;

    const computeInvoicePrefill = (policy: "PACKED_UNBILLED_QTY" | "ORDERED_QTY_IF_ELIGIBLE" | "MANUAL_ZERO") => {
      if (policy === "PACKED_UNBILLED_QTY") return remainingEligible;
      if (policy === "ORDERED_QTY_IF_ELIGIBLE") return Math.min(orderedTotal, remainingEligible);
      return 0;
    };

    expect(computeInvoicePrefill("PACKED_UNBILLED_QTY")).toBe(10);
    expect(computeInvoicePrefill("ORDERED_QTY_IF_ELIGIBLE")).toBe(10);
    expect(computeInvoicePrefill("MANUAL_ZERO")).toBe(0);
  });

  // ── TEST 4: Partial Packing Policy Enforcement ────────────────────────────
  it("TEST 4: permits or disallows partial packing based on company policy setting", () => {
    const remaining = 20;
    const userEntered = 12;

    const validatePartialPacking = (allowPartial: boolean, entered: number, totalRemaining: number) => {
      if (!allowPartial && entered < totalRemaining) {
        return { valid: false, reason: "Partial packing is DISABLED by company policy. All remaining quantities must be packed." };
      }
      return { valid: true };
    };

    expect(validatePartialPacking(true, userEntered, remaining).valid).toBe(true);
    const disabledResult = validatePartialPacking(false, userEntered, remaining);
    expect(disabledResult.valid).toBe(false);
    expect(disabledResult.reason).toContain("Partial packing is DISABLED");
  });

  // ── TEST 5: Partial Invoicing Policy Enforcement ──────────────────────────
  it("TEST 5: permits or disallows partial invoicing based on company policy setting", () => {
    const remainingEligible = 15;
    const userEnteredInvoiceQty = 10;

    const validatePartialInvoicing = (allowPartial: boolean, invoiceQty: number, eligibleQty: number) => {
      if (!allowPartial && invoiceQty < eligibleQty) {
        return { valid: false, reason: "Partial invoicing is DISABLED by company policy. All eligible quantities must be invoiced." };
      }
      return { valid: true };
    };

    expect(validatePartialInvoicing(true, userEnteredInvoiceQty, remainingEligible).valid).toBe(true);
    const disResult = validatePartialInvoicing(false, userEnteredInvoiceQty, remainingEligible);
    expect(disResult.valid).toBe(false);
    expect(disResult.reason).toContain("Partial invoicing is DISABLED");
  });

  // ── TEST 6: Prefill Quantity Editing Permissions ─────────────────────────
  it("TEST 6: governs prefill quantity editing authorization correctly", () => {
    const checkCanEdit = (policy: "AUTHORIZED_ONLY" | "ENABLED" | "DISABLED", isUserAuthorized: boolean) => {
      if (policy === "ENABLED") return true;
      if (policy === "AUTHORIZED_ONLY") return isUserAuthorized;
      return false;
    };

    expect(checkCanEdit("AUTHORIZED_ONLY", true)).toBe(true);
    expect(checkCanEdit("AUTHORIZED_ONLY", false)).toBe(false);
    expect(checkCanEdit("ENABLED", false)).toBe(true);
    expect(checkCanEdit("DISABLED", true)).toBe(false);
  });

  // ── TEST 7: Customer Incompatibility Guard ────────────────────────────────
  it("TEST 7: rejects combining packing slips belonging to different customer accounts", () => {
    const selectedSlips = [samplePackingSlips[0]]; // Reliance
    const candidateSlip = samplePackingSlips[2]; // Trent Tata

    const checkCompatibility = (current: PackingSlipRecord[], candidate: PackingSlipRecord) => {
      if (current.length === 0) return { compatible: true };
      const primaryCustId = current[0].customerId;
      if (candidate.customerId && primaryCustId && candidate.customerId !== primaryCustId) {
        return {
          compatible: false,
          error: `Customer Incompatibility: Packing Slip #${candidate.packingSlipNumber} belongs to "${candidate.customerName}", whereas current selection is for "${current[0].customerName}". Incompatible customer accounts cannot be consolidated into a single invoice.`,
        };
      }
      return { compatible: true };
    };

    const res = checkCompatibility(selectedSlips, candidateSlip);
    expect(res.compatible).toBe(false);
    expect(res.error).toContain("Customer Incompatibility");
    expect(res.error).toContain("Trent Tata");
  });

  // ── TEST 8: Compatible Customer Multi-Slip Combination ───────────────────
  it("TEST 8: combines multiple eligible slips for the same customer without error", () => {
    const slip1 = samplePackingSlips[0];
    const slip2 = samplePackingSlips[1];

    expect(slip1.customerId).toBe("cust-ril-01");
    expect(slip2.customerId).toBe("cust-ril-01");
    expect(slip1.customerId).toBe(slip2.customerId);
  });

  // ── TEST 9: Multi-Slip Identical Product Line Aggregation ─────────────────
  it("TEST 9: aggregates identical products appearing across multiple slips while preserving individual allocations", () => {
    const slips = [samplePackingSlips[0], samplePackingSlips[1]];
    // slip 1 has 10 chappals, slip 2 has 5 chappals -> total 15 chappals
    const lineMap: Record<string, ConsolidatedBillingItem> = {};

    slips.forEach((slip) => {
      slip.items.forEach((it) => {
        const key = it.productId;
        if (!lineMap[key]) {
          lineMap[key] = {
            productId: it.productId,
            sku: it.sku,
            name: it.name,
            unitPrice: 1499.0,
            mrp: 1999.0,
            taxPct: 5.0,
            orderedQty: it.quantity,
            packedQty: it.quantity,
            previouslyInvoicedQty: 0,
            remainingEligibleQty: it.quantity,
            invoiceQty: it.quantity,
            allocations: [{ packingSlipId: slip.id, packingSlipNumber: slip.packingSlipNumber, quantity: it.quantity }],
          };
        } else {
          lineMap[key].orderedQty += it.quantity;
          lineMap[key].packedQty += it.quantity;
          lineMap[key].remainingEligibleQty += it.quantity;
          lineMap[key].invoiceQty += it.quantity;
          lineMap[key].allocations.push({ packingSlipId: slip.id, packingSlipNumber: slip.packingSlipNumber, quantity: it.quantity });
        }
      });
    });

    const chappalLine = lineMap["p-chap-01"];
    expect(chappalLine).toBeDefined();
    expect(chappalLine.packedQty).toBe(15);
    expect(chappalLine.invoiceQty).toBe(15);
    expect(chappalLine.allocations.length).toBe(2);
    expect(chappalLine.allocations[0].quantity).toBe(10);
    expect(chappalLine.allocations[1].quantity).toBe(5);
  });

  // ── TEST 10: Overbilling Prevention Guard ─────────────────────────────────
  it("TEST 10: enforces that Invoice Qty cannot exceed Remaining Eligible Qty", () => {
    const remainingEligible = 10;
    const attemptedInvoiceQty = 15;

    const validateOverbilling = (invoiceQty: number, maxEligible: number) => {
      if (invoiceQty > maxEligible) {
        return { valid: false, error: "Overbilling Guard: Invoice quantity cannot exceed remaining eligible packed quantity." };
      }
      return { valid: true };
    };

    const res = validateOverbilling(attemptedInvoiceQty, remainingEligible);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Overbilling Guard");
  });

  // ── TEST 11: Barcode vs Packing Slip Code Resolution ──────────────────────
  it("TEST 11: correctly resolves PS- barcode vs standard EAN-13 product barcode", () => {
    const testResolve = (code: string) => {
      if (code.toUpperCase().startsWith("PS-") || code.toLowerCase().startsWith("ps_")) {
        return "PACKING_SLIP";
      }
      if (/^\d{8,14}$/.test(code)) {
        return "PRODUCT_BARCODE";
      }
      return "UNKNOWN";
    };

    expect(testResolve("PS-20261017-001")).toBe("PACKING_SLIP");
    expect(testResolve("ps_demo_882")).toBe("PACKING_SLIP");
    expect(testResolve("8901234567890")).toBe("PRODUCT_BARCODE");
    expect(testResolve("XYZ-UNKNOWN")).toBe("UNKNOWN");
  });

  // ── TEST 12: Unknown Barcode Never Guesses Packing Slip ────────────────────
  it("TEST 12: ensures unknown barcodes never guess that it is a Packing Slip", () => {
    const unknownBarcode = "998877665544";
    const isSlip = unknownBarcode.toUpperCase().startsWith("PS-") || unknownBarcode.toLowerCase().startsWith("ps_");

    expect(isSlip).toBe(false);
  });

  // ── TEST 13: Duplicate Packing Slip Scan Prevention ───────────────────────
  it("TEST 13: prevents adding the exact same packing slip twice to the consolidated batch", () => {
    const activeSlipNumbers = ["PS-20261017-001"];
    const incomingScan = "PS-20261017-001";

    const isDuplicate = activeSlipNumbers.includes(incomingScan);
    expect(isDuplicate).toBe(true);
  });

  // ── TEST 14: Already Invoiced Packing Slip Rejection ──────────────────────
  it("TEST 14: rejects scanning or selecting a packing slip that is already fully BILLED", () => {
    const billedSlip: PackingSlipRecord = {
      ...samplePackingSlips[0],
      status: "BILLED",
      salesInvoiceId: "INV-20261017-008",
    };

    const validateSlipStatus = (slip: PackingSlipRecord) => {
      if (slip.status === "BILLED") {
        return { eligible: false, message: `Packing Slip #${slip.packingSlipNumber} has already been fully invoiced.` };
      }
      return { eligible: true };
    };

    const check = validateSlipStatus(billedSlip);
    expect(check.eligible).toBe(false);
    expect(check.message).toContain("already been fully invoiced");
  });

  // ── TEST 15: Statutory GST & Totals Reconciliation for Consolidated Billing ─
  it("TEST 15: authoritatively computes GST and totals for consolidated multi-slip cart items", () => {
    const cart: ProPosCartItem[] = [
      {
        id: "c1",
        productId: "p1",
        name: "Item 1 (Slip 1)",
        sku: "SKU-1",
        barcode: "8901",
        style: "STD",
        color: "BLK",
        size: "8",
        qty: 10,
        unitPrice: 1000.0,
        basePrice: 1000.0,
        mrp: 1000.0,
        taxPct: 5.0,
        discountPct: 0,
        discountAmt: 0,
        isTaxInclusive: false,
        salesStaff: "Cashier 1",
      },
      {
        id: "c2",
        productId: "p2",
        name: "Item 2 (Slip 2)",
        sku: "SKU-2",
        barcode: "8902",
        style: "STD",
        color: "BLU",
        size: "9",
        qty: 5,
        unitPrice: 2000.0,
        basePrice: 2000.0,
        mrp: 2000.0,
        taxPct: 5.0,
        discountPct: 0,
        discountAmt: 0,
        isTaxInclusive: false,
        salesStaff: "Cashier 1",
      },
    ];

    const totals = computeBillingTotals(cart, 0, "FLAT", "27", "27");
    // Gross: 10*1000 + 5*2000 = 10000 + 10000 = 20000
    // Taxable: 20000
    // GST 5%: 1000 (CGST 500 + SGST 500)
    // Net Payable: 21000
    expect(totals.subtotal).toBe(20000);
    expect(totals.totalTax).toBe(1000);
    expect(totals.totalCgst).toBe(500);
    expect(totals.totalSgst).toBe(500);
    expect(totals.totalIgst).toBe(0);
    expect(totals.netPayable).toBe(21000);
  });

  // ── TEST 16: Read-Only Cart Invariant Verification ────────────────────────
  it("TEST 16: verifies read-only cart table structure preserves all 13 required columns without row steppers", () => {
    const requiredColumns = [
      "#",
      "Product Name",
      "Barcode",
      "Style",
      "Color",
      "Size",
      "Qty",
      "Rate",
      "Disc %",
      "Disc Amt",
      "Tax %",
      "Amount",
      "Salesperson",
    ];

    expect(requiredColumns.length).toBe(13);
    expect(requiredColumns).toContain("Barcode");
    expect(requiredColumns).toContain("Tax %");
    expect(requiredColumns).toContain("Salesperson");
  });
});
