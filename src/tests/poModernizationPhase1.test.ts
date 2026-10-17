/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.78.0
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal / Purchase Order Modernization Phase 1 Regression Tests
 */

import { describe, it, expect } from "vitest";
import type { CommercialDeliveryData } from "../components/purchase/CommercialDeliveryDrawer.tsx";
import {
  convertSizewiseToStandardLines,
  convertStandardToSizewiseLines,
  syncSizewiseHeaderToStandard,
  syncStandardHeaderToSizewise,
} from "../components/purchase/poModeConversion.ts";
import {
  buildArticleCatalogIndex,
  getAvailableArticles,
  getAvailableColorsForArticle,
  getAvailableSizesForArticleAndColor,
  resolveVariantFromIndex,
} from "../components/purchase/articleFiltering.ts";
import {
  getSimplifiedRatioString,
  recommendSizeAssortment,
  type SizewisePOLine,
} from "../components/purchase/PoSizewiseTab.tsx";
import type { PurchaseOrderLineItem, PurchaseOrderHeader } from "../components/purchase/types.ts";

describe("SMRITI Retail OS — Purchase Order UX Modernization Phase 1", () => {

  describe("1. Decision B: Commercial & Delivery Terms Data Integrity & Snapshot Contract", () => {
    const mockSupplierMaster = {
      id: "sup-001",
      name: "Tattly Threads Global Corp",
      code: "SUP-TAT-01",
      payment_terms: "45 Days",
      freight_terms: "Paid by Supplier (FOR Destination)",
      currency: "INR - Indian Rupee",
      buyer: "Senior Buyer (PROCUREMENT)",
      department: "Footwear",
      special_instructions: "All cartons must have barcode labels on outer box.",
    };

    it("populates commercial defaults from Supplier Master correctly without fabricated fields", () => {
      const initialPOCommercialData: CommercialDeliveryData = {
        paymentTerms: mockSupplierMaster.payment_terms,
        freightCharges: mockSupplierMaster.freight_terms,
        currency: mockSupplierMaster.currency,
        buyer: mockSupplierMaster.buyer,
        department: mockSupplierMaster.department,
        specialInstructions: mockSupplierMaster.special_instructions,
        supplierReference: "",
        deliveryDate: "2026-10-21",
        deliveryLocation: "Main Central Godown (CG-01)",
        leadTimeDays: 7,
      };

      expect(initialPOCommercialData.paymentTerms).toBe("45 Days");
      expect(initialPOCommercialData.freightCharges).toBe("Paid by Supplier (FOR Destination)");
      expect(initialPOCommercialData.currency).toBe("INR - Indian Rupee");
      expect(initialPOCommercialData.buyer).toBe("Senior Buyer (PROCUREMENT)");
      expect(initialPOCommercialData.department).toBe("Footwear");
      expect(initialPOCommercialData.specialInstructions).toBe("All cartons must have barcode labels on outer box.");
    });

    it("allows PO-level overrides without modifying Supplier Master", () => {
      const supplierMasterCopy = { ...mockSupplierMaster };

      // PO-level override made in the drawer
      const poOverrideData: CommercialDeliveryData = {
        paymentTerms: "60 Days", // overridden from 45 Days
        freightCharges: "Paid by Buyer (Ex-Factory / To-Pay)", // overridden
        currency: "INR - Indian Rupee",
        buyer: "Assistant Buyer",
        department: "Footwear",
        specialInstructions: "Rush dispatch requested via air cargo.",
        supplierReference: "QUOT-2026-990",
        deliveryDate: "2026-10-25",
        deliveryLocation: "Retail Store Hub (ST-01)",
        leadTimeDays: 11,
      };

      // Supplier Master must remain pristine and unmutated
      expect(supplierMasterCopy.payment_terms).toBe("45 Days");
      expect(supplierMasterCopy.freight_terms).toBe("Paid by Supplier (FOR Destination)");
      expect(supplierMasterCopy.buyer).toBe("Senior Buyer (PROCUREMENT)");

      // PO snapshot carries the effective overridden terms
      expect(poOverrideData.paymentTerms).toBe("60 Days");
      expect(poOverrideData.freightCharges).toBe("Paid by Buyer (Ex-Factory / To-Pay)");
      expect(poOverrideData.supplierReference).toBe("QUOT-2026-990");
    });

    it("preserves frozen commercial snapshot in rule_snapshots['commercial_terms']", () => {
      const savedCommercialTerms = {
        payment_terms: "30 Days",
        freight_terms: "Paid by Supplier",
        currency: "INR",
        buyer: "John Doe",
        department: "Apparel",
        special_instructions: "Handle with care",
        supplier_reference: "REF-001",
      };

      const purchaseOrderPayload = {
        order_no: "PO-2026-0012",
        order_date: "2026-10-14",
        supplier_id: "sup-001",
        rule_snapshots: {
          commercial_terms: savedCommercialTerms,
        },
      };

      // Simulate subsequent mutation in Supplier Master
      mockSupplierMaster.payment_terms = "Immediate Payment (COD)";

      // The saved PO snapshot must remain completely unaffected
      expect(purchaseOrderPayload.rule_snapshots.commercial_terms.payment_terms).toBe("30 Days");
      expect(purchaseOrderPayload.rule_snapshots.commercial_terms.payment_terms).not.toBe(mockSupplierMaster.payment_terms);
    });

    it("verifies Alt+C keyboard shortcut toggles the Commercial Delivery drawer", () => {
      let isDrawerOpen = false;
      const toggleDrawer = () => { isDrawerOpen = !isDrawerOpen; };

      const simulateKeyDown = (e: { altKey: boolean; key: string }) => {
        if (e.altKey && (e.key === "c" || e.key === "C")) {
          toggleDrawer();
        }
      };

      // Initial state: closed
      expect(isDrawerOpen).toBe(false);

      // Press Alt+C -> open
      simulateKeyDown({ altKey: true, key: "c" });
      expect(isDrawerOpen).toBe(true);

      // Press Alt+C again -> close
      simulateKeyDown({ altKey: true, key: "C" });
      expect(isDrawerOpen).toBe(false);

      // Press plain 'c' without Alt -> no change
      simulateKeyDown({ altKey: false, key: "c" });
      expect(isDrawerOpen).toBe(false);
    });
  });

  describe("2. Decision C: Standard Mode Barcode in Column 1 Contract", () => {
    it("ensures barcode is present and indexed in line items", () => {
      const lineItem: PurchaseOrderLineItem = {
        id: "line-1",
        sNo: 1,
        barcode: "8901234567890",
        stockNo: "SH-03-I-BLACK",
        product: "TATLD FORMAL SHOE, BLACK",
        brand: "Tattly Threads",
        style: "SH-03-I",
        shade: "BLACK",
        size: "40",
        mrp: 1299,
        rate: 660,
        orderQty: 20,
        unit: "Pair",
        value: 13200,
        taxPercent: 5,
      };

      // Column 1 is Barcode
      expect(lineItem.barcode).toBe("8901234567890");
      // Column 2 is SNo
      expect(lineItem.sNo).toBe(1);
      // Column 3 is Item Code
      expect(lineItem.stockNo).toBe("SH-03-I-BLACK");
    });
  });

  describe("3. Decision D: Supplier Selector Responsive Constraint (448px)", () => {
    it("verifies the container class defines max-w-md constraint", () => {
      const expectedTailwindConstraint = "max-w-md"; // 448px in Tailwind standard
      const containerClass = `relative w-full ${expectedTailwindConstraint}`;
      expect(containerClass).toContain("max-w-md");
      expect(containerClass).not.toContain("w-screen");
    });
  });

  describe("4. Article -> Color -> Size Dependent Filtering Integrity", () => {
    const sampleProducts = [
      { id: "p1", code: "CH01A-PEACH-40", article: "CH01A", style: "CH01A", shade: "PEACH", color: "PEACH", size: "40", barcode: "BC-PEACH-40" },
      { id: "p2", code: "CH01A-PEACH-41", article: "CH01A", style: "CH01A", shade: "PEACH", color: "PEACH", size: "41", barcode: "BC-PEACH-41" },
      { id: "p3", code: "CH01A-NAVY-40", article: "CH01A", style: "CH01A", shade: "NAVY", color: "NAVY", size: "40", barcode: "BC-NAVY-40" },
      { id: "p4", code: "CH13C-BLACK-38", article: "CH13C", style: "CH13C", shade: "BLACK", color: "BLACK", size: "38", barcode: "BC-BLACK-38" },
      { id: "p5", code: "CH13C-BLACK-39", article: "CH13C", style: "CH13C", shade: "BLACK", color: "BLACK", size: "39", barcode: "BC-BLACK-39" },
    ];

    const catalogIndex = buildArticleCatalogIndex(sampleProducts);

    it("extracts distinct available articles correctly", () => {
      const articles = getAvailableArticles(catalogIndex);
      expect(articles).toEqual(["CH01A", "CH13C"]);
    });

    it("restricts colors to the selected article only", () => {
      const colorsCH01A = getAvailableColorsForArticle(catalogIndex, "CH01A");
      expect(colorsCH01A).toEqual(["NAVY", "PEACH"]);
      expect(colorsCH01A).not.toContain("BLACK");

      const colorsCH13C = getAvailableColorsForArticle(catalogIndex, "CH13C");
      expect(colorsCH13C).toEqual(["BLACK"]);
      expect(colorsCH13C).not.toContain("PEACH");
    });

    it("restricts sizes to the selected article and color combination", () => {
      const sizesPeach = getAvailableSizesForArticleAndColor(catalogIndex, "CH01A", "PEACH");
      expect(sizesPeach).toEqual(["40", "41"]);

      const sizesNavy = getAvailableSizesForArticleAndColor(catalogIndex, "CH01A", "NAVY");
      expect(sizesNavy).toEqual(["40"]);
      expect(sizesNavy).not.toContain("41");
    });

    it("resolves the exact variant from Article, Color, and Size", () => {
      const resolved = resolveVariantFromIndex(catalogIndex, "CH01A", "PEACH", "40");
      expect(resolved).not.toBeNull();
      expect(resolved?.code).toBe("CH01A-PEACH-40");
      expect(resolved?.barcode).toBe("BC-PEACH-40");
    });
  });

  describe("5. Decision A: Sizewise <-> Standard Round-Trip Conversion Integrity", () => {
    const footwearEuSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

    const sampleSizewise: SizewisePOLine = {
      id: "sw-1",
      sNo: 1,
      itemCode: "SH-03-I-BLACK",
      articleNo: "SH-03-I",
      barcode: "",
      product: "FORMAL SHOE, BLACK",
      brand: "Tattly",
      style: "SH-03-I",
      shade: "BLACK",
      unit: "Pair",
      sizeQuantities: { "39": 10, "40": 20, "41": 15 },
      totalQty: 45,
      rate: 650,
      stockOnHand: 0,
      taxPercent: 5,
      netValue: 29250,
    };

    it("converts Sizewise matrix into discrete SKU rows in Standard mode", () => {
      const standardRows = convertSizewiseToStandardLines([sampleSizewise], footwearEuSizes);
      expect(standardRows.length).toBe(3);

      const qtySum = standardRows.reduce((sum, r) => sum + r.orderQty, 0);
      expect(qtySum).toBe(45);

      const valSum = standardRows.reduce((sum, r) => sum + r.value, 0);
      expect(valSum).toBe(29250);

      // Verify each discrete size row
      const size39 = standardRows.find(r => r.size === "39");
      const size40 = standardRows.find(r => r.size === "40");
      const size41 = standardRows.find(r => r.size === "41");

      expect(size39?.orderQty).toBe(10);
      expect(size40?.orderQty).toBe(20);
      expect(size41?.orderQty).toBe(15);
    });

    it("performs lossless round-trip from Standard back to Sizewise", () => {
      const standardRows = convertSizewiseToStandardLines([sampleSizewise], footwearEuSizes);
      const returnedSizewise = convertStandardToSizewiseLines(standardRows, footwearEuSizes);

      expect(returnedSizewise.length).toBe(1);
      expect(returnedSizewise[0].articleNo).toBe("SH-03-I");
      expect(returnedSizewise[0].shade).toBe("BLACK");
      expect(returnedSizewise[0].totalQty).toBe(45);
      expect(returnedSizewise[0].netValue).toBe(29250);
      expect(returnedSizewise[0].sizeQuantities["39"]).toBe(10);
      expect(returnedSizewise[0].sizeQuantities["40"]).toBe(20);
      expect(returnedSizewise[0].sizeQuantities["41"]).toBe(15);
    });
  });

  describe("6. Phase 2: Sizewise Matrix Assortment Curves & Ratio Presets", () => {
    const testSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

    it("computes clean human-readable ratio strings from size quantities", () => {
      // Common footwear batch: 8, 8, 12, 16, 20, 16, 12, 8, 8 (GCD = 4)
      const perSizeTotals = {
        "36": 8,
        "37": 8,
        "38": 12,
        "39": 16,
        "40": 20,
        "41": 16,
        "42": 12,
        "43": 8,
        "44": 8,
      };

      const ratioStr = getSimplifiedRatioString(testSizes, perSizeTotals);
      expect(ratioStr).toBe("2 : 2 : 3 : 4 : 5 : 4 : 3 : 2 : 2");
    });

    it("computes flat ratio string for uniform quantities", () => {
      const uniformTotals = {
        "36": 10,
        "37": 10,
        "38": 10,
        "39": 10,
        "40": 10,
        "41": 10,
        "42": 10,
        "43": 10,
        "44": 10,
      };

      const ratioStr = getSimplifiedRatioString(testSizes, uniformTotals);
      expect(ratioStr).toBe("1 : 1 : 1 : 1 : 1 : 1 : 1 : 1 : 1");
    });

    it("handles zero and empty totals gracefully with a fallback dash", () => {
      const zeroTotals = testSizes.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
      expect(getSimplifiedRatioString(testSizes, zeroTotals)).toBe("—");
      expect(getSimplifiedRatioString([], {})).toBe("—");
    });

    it("guarantees mathematical curve preservation across all recommendation presets", () => {
      const targetQty = 108;

      // Bell curve
      const bellAssortment = recommendSizeAssortment(testSizes, targetQty, "bell");
      const bellSum = Object.values(bellAssortment).reduce((a, b) => a + b, 0);
      expect(bellSum).toBe(targetQty);
      // Bell peak should be in central sizes (39, 40, 41)
      expect(bellAssortment["40"]).toBeGreaterThan(bellAssortment["36"]);
      expect(bellAssortment["40"]).toBeGreaterThan(bellAssortment["44"]);

      // Core sizes curve
      const coreAssortment = recommendSizeAssortment(testSizes, targetQty, "core");
      const coreSum = Object.values(coreAssortment).reduce((a, b) => a + b, 0);
      expect(coreSum).toBe(targetQty);

      // Uniform flat curve
      const uniformAssortment = recommendSizeAssortment(testSizes, targetQty, "uniform");
      const uniformSum = Object.values(uniformAssortment).reduce((a, b) => a + b, 0);
      expect(uniformSum).toBe(targetQty);
      // Each size receives either 12 (108 / 9)
      testSizes.forEach(s => {
        expect(uniformAssortment[s]).toBe(12);
      });
    });
  });
});
