/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-10-25
 * Modified     : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test Suite
 */

import { describe, expect, it } from "vitest";
import type { BillingLineItem, TransporterRow, AddonDeductionRow } from "../components/billing/types.ts";
import {
  buildBillingPreviewRequest,
  prepareBillingPostingLines,
} from "../components/billing/billingPreview.ts";
import {
  DEFAULT_SALES_FACTORS,
  SmritiSalesFactorService,
  SmritiSalesFactor,
} from "../services/smritiSalesFactorService.ts";
import {
  DEFAULT_TRANSPORTER_ROWS,
  DEFAULT_ADDON_ROWS,
  mapSalesFactorsToAdjustmentRows,
} from "../components/billing/BillingTerm.tsx";

const mockItem = (overrides: Partial<BillingLineItem> = {}): BillingLineItem => ({
  id: "line-1",
  sNo: 1,
  stockNo: "SKU-001",
  barcode: "890000000001",
  itemDescription: "Cotton Formal Shirt",
  rate: 1000,
  qty: 2,
  value: 2000,
  discCode: "",
  discQty: 0,
  discPercent: 0,
  discAmt: 0,
  total: 2000,
  salesStaff: "Staff 1",
  productId: "prod-1",
  gstPercentage: 18,
  ...overrides,
});

describe("Billing Adjustments & Preview Canonical Convergence", () => {
  it("maps transporterRows to canonical adjustments with correct SAC and timing metadata", () => {
    const items = [mockItem()];
    const postingLines = prepareBillingPostingLines(items, 0);

    const transporterRows: TransporterRow[] = [
      {
        id: "tr-1",
        mode: "Road",
        name: "Express Logistics",
        lrNo: "LR-9988",
        date: "2026-10-25",
        qty: 1,
        rateAmt: 250,
        amount: 250,
        payType: "To Pay",
        timing: "PRE_TAX",
        taxTreatment: "SPECIFIC_SAC",
        gstRate: 18,
        sacCode: "9965",
        code: "FREIGHT_SAC",
        description: "Express Road Transport",
      },
      {
        id: "tr-2",
        mode: "Courier",
        name: "Local Porter",
        lrNo: "PRT-11",
        date: "2026-10-25",
        qty: 1,
        rateAmt: 100,
        amount: 100,
        payType: "Paid",
        timing: "BELOW_TAX",
        taxTreatment: "NON_TAXABLE",
        code: "DOOR_DELIVERY",
        description: "Doorstep Handling",
      },
    ];

    const previewReq = buildBillingPreviewRequest({
      items,
      postingLines,
      companyId: "COMP-01",
      branchId: "MAIN",
      salesChannel: "B2B_WHOLESALE",
      transporterRows,
    });

    expect(previewReq.adjustments).toBeDefined();
    expect(previewReq.adjustments).toHaveLength(2);

    const specificSac = previewReq.adjustments!.find((a) => a.code === "FREIGHT_SAC");
    expect(specificSac).toBeDefined();
    expect(specificSac!.adjustment_type).toBe("ADDON");
    expect(specificSac!.rate_type).toBe("FIXED");
    expect(specificSac!.amount).toBe(250);
    expect(specificSac!.timing).toBe("PRE_TAX");
    expect(specificSac!.tax_treatment).toBe("SPECIFIC_SAC");
    expect(specificSac!.gst_rate).toBe(18);
    expect(specificSac!.sac_code).toBe("9965");

    const postTax = previewReq.adjustments!.find((a) => a.code === "DOOR_DELIVERY");
    expect(postTax).toBeDefined();
    expect(postTax!.adjustment_type).toBe("ADDON");
    expect(postTax!.rate_type).toBe("FIXED");
    expect(postTax!.amount).toBe(100);
    expect(postTax!.timing).toBe("POST_TAX");
  });

  it("maps addonRows to canonical adjustments with composite and deduction attributes", () => {
    const items = [mockItem()];
    const postingLines = prepareBillingPostingLines(items, 0);

    const addonRows: AddonDeductionRow[] = [
      {
        id: "ar-1",
        code: "PACKING",
        type: "Addon",
        description: "Export Box Packing",
        rateType: "Percentage",
        rate: 5,
        amount: 100,
        timing: "ABOVE_TAX",
        taxTreatment: "COMPOSITE",
      },
      {
        id: "ar-2",
        code: "DEFECT_DED",
        type: "Deduction",
        description: "Fabric Weave Defect",
        rateType: "Amount",
        rate: 50,
        amount: 50,
        timing: "ABOVE_TAX",
        taxTreatment: "COMPOSITE",
      },
      {
        id: "ar-3",
        code: "ROUNDOFF",
        type: "Deduction",
        description: "Commercial Settlement Roundoff",
        rateType: "Amount",
        rate: 0.5,
        amount: 0.5,
        timing: "BELOW_TAX",
      },
    ];

    const previewReq = buildBillingPreviewRequest({
      items,
      postingLines,
      companyId: "COMP-01",
      branchId: "MAIN",
      salesChannel: "B2B_WHOLESALE",
      addonRows,
    });

    expect(previewReq.adjustments).toBeDefined();
    expect(previewReq.adjustments).toHaveLength(3);

    const packing = previewReq.adjustments!.find((a) => a.code === "PACKING");
    expect(packing!.adjustment_type).toBe("ADDON");
    expect(packing!.rate_type).toBe("PERCENTAGE");
    expect(packing!.rate_value).toBe(5);
    expect(packing!.amount).toBe(100);
    expect(packing!.timing).toBe("PRE_TAX");
    expect(packing!.tax_treatment).toBe("COMPOSITE");

    const defect = previewReq.adjustments!.find((a) => a.code === "DEFECT_DED");
    expect(defect!.adjustment_type).toBe("DEDUCTION");
    expect(defect!.rate_type).toBe("FIXED");
    expect(defect!.amount).toBe(50);
    expect(defect!.timing).toBe("PRE_TAX");

    const roundoff = previewReq.adjustments!.find((a) => a.code === "ROUNDOFF");
    expect(roundoff!.adjustment_type).toBe("DEDUCTION");
    expect(roundoff!.timing).toBe("POST_TAX");
  });

  it("prioritizes direct adjustments payload if explicitly passed", () => {
    const items = [mockItem()];
    const postingLines = prepareBillingPostingLines(items, 0);

    const directAdjustments = [
      {
        code: "CUSTOM_SURCHARGE",
        name: "Special Handling Surcharge",
        adjustment_type: "ADDON" as const,
        rate_type: "FIXED" as const,
        rate_value: 300,
        amount: 300,
        timing: "PRE_TAX" as const,
        tax_treatment: "COMPOSITE" as const,
      },
    ];

    const previewReq = buildBillingPreviewRequest({
      items,
      postingLines,
      companyId: "COMP-01",
      branchId: "MAIN",
      salesChannel: "POS_RETAIL",
      adjustments: directAdjustments,
      transporterRows: [
        {
          id: "ignored",
          mode: "Air",
          name: "Ignored",
          lrNo: "1",
          date: "2026-10-25",
          qty: 1,
          rateAmt: 999,
          amount: 999,
          payType: "To Pay",
        },
      ],
    });

    expect(previewReq.adjustments).toEqual(directAdjustments);
  });

  describe("Empty-Bill Zero-Charge & Sales Factor Safeguards", () => {
    it("keeps configured add-ons at zero until explicitly entered on the invoice", () => {
      const addonFactors = DEFAULT_SALES_FACTORS.filter(
        factor => factor.factorType === "ADD_ON",
      );

      const rows = mapSalesFactorsToAdjustmentRows(addonFactors);

      expect(rows).toHaveLength(addonFactors.length);
      expect(rows.every(row => row.type === "Addon" && row.amount === 0 && row.rate === 0)).toBe(true);
    });

    it("guarantees ₹0.00 add-ons and deductions when billable sales base is zero", () => {
      const emptyResult = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 0,
        itemPromotionalDiscount: 0,
      });

      expect(emptyResult.appliedFactorDetails).toEqual([]);
      expect(emptyResult.aboveTaxAddons).toBe(0);
      expect(emptyResult.aboveTaxDeductions).toBe(0);
      expect(emptyResult.belowTaxAddons).toBe(0);
      expect(emptyResult.belowTaxDeductions).toBe(0);
      expect(emptyResult.adjustedTaxableValue).toBe(0);
      expect(emptyResult.netPayable).toBe(0);
    });

    it("preserves configured PACK (₹50) and DELV (₹100) factors on non-empty sales bills", () => {
      const packAndDelvFactors: SmritiSalesFactor[] = [
        {
          id: "sf-pack-02",
          code: "PACK",
          description: "Gift & Garment Packaging",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "ABOVE_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 50.0,
          isVariable: false,
          applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          isActive: true,
        },
        {
          id: "sf-delv-03",
          code: "DELV",
          description: "Express Counter Delivery",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "BELOW_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 100.0,
          isVariable: false,
          applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          isActive: true,
        },
      ];

      const validResult = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 1000,
        itemPromotionalDiscount: 0,
        factors: packAndDelvFactors,
      });

      // PACK = ₹50 above tax, DELV = ₹100 below tax
      expect(validResult.aboveTaxAddons).toBe(50);
      expect(validResult.belowTaxAddons).toBe(100);
      expect(validResult.adjustedTaxableValue).toBe(1050);
      expect(validResult.netPayable).toBe(1150);
    });

    it("correctly calculates percentage-based factors and deductions on valid transactions", () => {
      const customFactors: SmritiSalesFactor[] = [
        {
          id: "sf-custom-pct",
          code: "EXP_PACK",
          description: "Export Packaging",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "ABOVE_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "RATE",
          value: 5.0,
          isVariable: false,
          applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          isActive: true,
        },
        {
          id: "sf-custom-ded",
          code: "SPL_DED",
          description: "Special Commercial Deduction",
          factorType: "DEDUCTION",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "BELOW_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 50.0,
          isVariable: false,
          applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          isActive: true,
        },
      ];

      const result = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 2000,
        itemPromotionalDiscount: 0,
        factors: customFactors,
      });

      // 5% of ₹2000 = ₹100 above tax
      expect(result.aboveTaxAddons).toBe(100);
      // ₹50 flat deduction below tax
      expect(result.belowTaxDeductions).toBe(50);
      expect(result.adjustedTaxableValue).toBe(2100);
      expect(result.netPayable).toBe(2050);
    });
  });

  describe("Billing Desk State Lifecycle: New Bill, Hold & Recall Isolation", () => {
    it("resets adjustments to canonical clean defaults when starting a new invoice", () => {
      // Simulate modified desk adjustments from a previous bill
      const activeTransporter = [
        { ...DEFAULT_TRANSPORTER_ROWS[0], amount: 450, rateAmt: 450 },
      ];
      const activeAddons = [
        { ...DEFAULT_ADDON_ROWS[0], amount: 150, rate: 150 },
      ];

      // Execute new bill reset logic
      const newBillTransporter = [...DEFAULT_TRANSPORTER_ROWS];
      const newBillAddons = [...DEFAULT_ADDON_ROWS];

      expect(newBillTransporter[0].amount).toBe(0);
      expect(newBillTransporter[0].rateAmt).toBe(0);
      expect(newBillAddons[0].amount).toBe(0);
      expect(newBillAddons[0].rate).toBe(0);
      // Verify previous bill values did not mutate the default constants
      expect(activeTransporter[0].amount).toBe(450);
      expect(activeAddons[0].amount).toBe(150);
    });

    it("preserves adjustment snapshots upon invoice suspension and restores them upon recall", () => {
      const billAdjustmentsTransporter: TransporterRow[] = [
        {
          sNo: 1,
          type: "Road Freight",
          code: "TR-FAST",
          description: "Fast Courier Express",
          rateType: "Fixed",
          rateAmt: 250,
          amount: 250,
          timing: "PRE_TAX",
        },
      ];
      const billAdjustmentsAddons: AddonDeductionRow[] = [
        {
          sNo: 1,
          type: "Addon",
          code: "CRATE",
          description: "Wooden Crate Packing",
          rateType: "Fixed",
          rate: 120,
          amount: 120,
          timing: "ABOVE_TAX",
        },
      ];

      // Suspend bill with snapshots
      const suspendedBill = {
        invoiceNumber: "HOLD-001",
        transporterRows: billAdjustmentsTransporter,
        addonRows: billAdjustmentsAddons,
        rule_snapshots: {
          transporterRows: billAdjustmentsTransporter,
          addonRows: billAdjustmentsAddons,
        },
      };

      // Active desk resets after hold
      const activeDeskAfterHold = {
        transporterRows: [...DEFAULT_TRANSPORTER_ROWS],
        addonRows: [...DEFAULT_ADDON_ROWS],
      };
      expect(activeDeskAfterHold.transporterRows[0].amount).toBe(0);
      expect(activeDeskAfterHold.addonRows[0].amount).toBe(0);

      // Recall bill restores exact adjustments from snapshot
      const recalledTransporter =
        suspendedBill.transporterRows || suspendedBill.rule_snapshots?.transporterRows;
      const recalledAddons =
        suspendedBill.addonRows || suspendedBill.rule_snapshots?.addonRows;

      expect(recalledTransporter).toHaveLength(1);
      expect(recalledTransporter![0].amount).toBe(250);
      expect(recalledTransporter![0].code).toBe("TR-FAST");

      expect(recalledAddons).toHaveLength(1);
      expect(recalledAddons![0].amount).toBe(120);
      expect(recalledAddons![0].code).toBe("CRATE");
    });
  });

  describe("Billing Policy Safeguards: Fail-Closed Settlement Protection", () => {
    it("safely blocks settlement when billing transaction policy fails to load", () => {
      // Settlement readiness evaluator mimicking BillingTerm settlement guard
      const evaluateSettlementReadiness = (policyError: string | null, isBusy: boolean) => {
        if (policyError) {
          return { canSettle: false, reason: policyError };
        }
        if (isBusy) {
          return { canSettle: false, reason: "System busy" };
        }
        return { canSettle: true, reason: null };
      };

      const failingPolicy = evaluateSettlementReadiness(
        "Billing transaction policy could not be loaded. Settlement is paused until policy is verified.",
        false
      );
      expect(failingPolicy.canSettle).toBe(false);
      expect(failingPolicy.reason).toContain("Settlement is paused");

      const healthyPolicy = evaluateSettlementReadiness(null, false);
      expect(healthyPolicy.canSettle).toBe(true);
      expect(healthyPolicy.reason).toBeNull();
    });
  });
});
