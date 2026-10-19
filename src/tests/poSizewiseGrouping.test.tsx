/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.84.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PurchaseOrderPrintA4,
  PurchaseOrderPrintData,
} from "../print_engine/templates/PurchaseOrderPrintA4";
import { SizePivotMatrixA4 } from "../print_engine/templates/SizePivotMatrixA4";
import { FootwearPurchaseOrderA4 } from "../print_engine/templates/FootwearPurchaseOrderA4";
import type { PurchaseOrderSizePivotRow, SizewisePOLine } from "../components/purchase/types";
import { buildGroupedSizewiseLines } from "../components/purchase/PoSizewiseTab";
import { resolveFootwearAttributes } from "../components/purchase/POPrintPreviewModal";
import { DEFAULT_BUSINESS_TERMS } from "../components/purchase/CommercialDeliveryDrawer";
import { parseFootwearSku } from "../components/vendor/tabs/VendorProcurementTab";

describe("Purchase Order Sizewise Grouping (Article No. + Color) Verification", () => {
  const basePOData: PurchaseOrderPrintData = {
    poNumber: "PO-2026-00451",
    companyName: "TATTLY THREADS",
    supplierName: "A. S. Shoes",
    paymentTerms: "120 Days",
    commonTaxPercent: 5,
    sizeColumns: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  };

  it("1. groups multiple single-size rows of the same Article + Color into a single consolidated row", () => {
    // 6 single-size rows for CH-25-G GOLD (simulating Excel / raw SKU import)
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "37": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 3, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "38": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 4, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "39": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 5, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "40": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 6, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "41": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    // Verify CH-25-G and GOLD appear in table
    expect(html).toContain("CH-25-G");
    expect(html).toContain("GOLD");

    // All sizes 34 and 68 should appear in size columns
    expect(html).toContain(">34<");
    expect(html).toContain(">68<");

    // The total quantity for CH-25-G GOLD should sum to 340 (34+34+68+68+68+68)
    expect(html).toContain(">340<");

    // Total consolidated taxable amount: 1,78,500.00 (340 * 525)
    expect(html).toContain("1,78,500.00");

    // Total consolidated tax amount: 8,925.00
    expect(html).toContain("8,925.00");
  });

  it("2. keeps different colors of the same article on strictly separate rows", () => {
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "37": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 3, articleNo: "CH-25-G", color: "BLACK", sizeQuantities: { "36": 20 }, totalQty: 20, rate: 525, taxPercent: 5, taxAmount: 525.0, amount: 10500 },
      { sNo: 4, articleNo: "CH-25-G", color: "BLACK", sizeQuantities: { "38": 40 }, totalQty: 40, rate: 525, taxPercent: 5, taxAmount: 1050.0, amount: 21000 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    // Both colors must be present as distinct rows
    expect(html).toContain("GOLD");
    expect(html).toContain("BLACK");

    // GOLD total is 68 (34+34)
    expect(html).toContain(">68<");

    // BLACK total is 60 (20+40)
    expect(html).toContain(">60<");
  });

  it("3. keeps different articles on strictly separate rows", () => {
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "SND-07-G", color: "GOLD", sizeQuantities: { "36": 50 }, totalQty: 50, rate: 650, taxPercent: 5, taxAmount: 1625.0, amount: 32500 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    expect(html).toContain("CH-25-G");
    expect(html).toContain("SND-07-G");
    expect(html).toContain(">34<");
    expect(html).toContain(">50<");
  });

  it("4. groups rows correctly inside SizePivotMatrixA4 template", () => {
    const pivotRows: PurchaseOrderSizePivotRow[] = [
      { id: "1", sNo: 1, articleNo: "CH-25-G", product: "Shoe", color: "GOLD", sizeQuantities: { "36": 12 }, totalQty: 12, rate: 500, totalValue: 6000 },
      { id: "2", sNo: 2, articleNo: "CH-25-G", product: "Shoe", color: "GOLD", sizeQuantities: { "37": 18 }, totalQty: 18, rate: 500, totalValue: 9000 },
      { id: "3", sNo: 3, articleNo: "CH-25-G", product: "Shoe", color: "BLACK", sizeQuantities: { "36": 10 }, totalQty: 10, rate: 500, totalValue: 5000 },
    ];

    const html = renderToStaticMarkup(
      <SizePivotMatrixA4
        data={{
          header: { orderNumber: "101", prefix: "PO" },
          rows: pivotRows,
        }}
      />
    );

    // GOLD consolidated qty = 30 (12 + 18)
    // BLACK consolidated qty = 10
    expect(html).toContain("GOLD");
    expect(html).toContain("BLACK");
    expect(html).toContain(">30<");
    expect(html).toContain(">10<");
    expect(html).toContain("15000.00"); // GOLD value: 6000 + 9000
    expect(html).toContain("5000.00");  // BLACK value: 5000
  });

  it("5. buildGroupedSizewiseLines groups live Purchase Studio variants into single Article + Color row", () => {
    const sizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
    // Simulate user screenshot: CH-08-J in CREAM having separate variant rows for each size
    const rawLines: SizewisePOLine[] = [
      {
        id: "line-1",
        itemCode: "CH-08-J-CREAM-36",
        articleNo: "CH-08-J",
        shade: "CREAM",
        product: "Comfort Heel",
        sizeQuantities: { "36": 12 },
        rate: 550,
        totalQty: 12,
        netValue: 6600,
      },
      {
        id: "line-2",
        itemCode: "CH-08-J-CREAM-37",
        articleNo: "CH-08-J",
        shade: "CREAM",
        product: "Comfort Heel",
        sizeQuantities: { "37": 24 },
        rate: 550,
        totalQty: 24,
        netValue: 13200,
      },
      {
        id: "line-3",
        itemCode: "CH-08-J-CREAM-38",
        articleNo: "CH-08-J",
        shade: "CREAM",
        product: "Comfort Heel",
        sizeQuantities: { "38": 36 },
        rate: 550,
        totalQty: 36,
        netValue: 19800,
      },
      {
        id: "line-4",
        itemCode: "CH-08-J-CREAM-39",
        articleNo: "CH-08-J",
        shade: "CREAM",
        product: "Comfort Heel",
        sizeQuantities: { "39": 48 },
        rate: 550,
        totalQty: 48,
        netValue: 26400,
      },
      {
        id: "line-5",
        itemCode: "CH-08-J-CREAM-40",
        articleNo: "CH-08-J",
        shade: "CREAM",
        product: "Comfort Heel",
        sizeQuantities: { "40": 24 },
        rate: 550,
        totalQty: 24,
        netValue: 13200,
      },
      // Second color of same article: BLACK
      {
        id: "line-6",
        itemCode: "CH-08-J-BLACK-36",
        articleNo: "CH-08-J",
        shade: "BLACK",
        product: "Comfort Heel",
        sizeQuantities: { "36": 10 },
        rate: 550,
        totalQty: 10,
        netValue: 5500,
      },
      // Third distinct article: CH-09-K in TAN
      {
        id: "line-7",
        itemCode: "CH-09-K-TAN-38",
        articleNo: "CH-09-K",
        shade: "TAN",
        product: "Wedge Sandal",
        sizeQuantities: { "38": 15 },
        rate: 600,
        totalQty: 15,
        netValue: 9000,
      },
      // Blank unpopulated row
      {
        id: "line-8",
        itemCode: "",
        articleNo: "",
        shade: "",
        product: "",
        sizeQuantities: {},
        rate: 0,
        totalQty: 0,
        netValue: 0,
      },
    ];

    const grouped = buildGroupedSizewiseLines(rawLines, sizes, 5);

    // Exactly 4 grouped rows:
    // 1. CH-08-J CREAM
    // 2. CH-08-J BLACK
    // 3. CH-09-K TAN
    // 4. Blank row
    expect(grouped.length).toBe(4);

    const creamGroup = grouped.find(g => g.articleNo === "CH-08-J" && g.shade === "CREAM");
    expect(creamGroup).toBeDefined();
    expect(creamGroup?.sizeQuantities["36"]).toBe(12);
    expect(creamGroup?.sizeQuantities["37"]).toBe(24);
    expect(creamGroup?.sizeQuantities["38"]).toBe(36);
    expect(creamGroup?.sizeQuantities["39"]).toBe(48);
    expect(creamGroup?.sizeQuantities["40"]).toBe(24);
    expect(creamGroup?.sizeQuantities["41"]).toBe(0);
    expect(creamGroup?.totalQty).toBe(144); // 12 + 24 + 36 + 48 + 24
    expect(creamGroup?.netValue).toBe(144 * 550); // 79,200

    // Check sizeToLineIndex maps back accurately to original line indices
    expect(creamGroup?.sizeToLineIndex["36"]).toBe(0);
    expect(creamGroup?.sizeToLineIndex["37"]).toBe(1);
    expect(creamGroup?.sizeToLineIndex["38"]).toBe(2);
    expect(creamGroup?.sizeToLineIndex["39"]).toBe(3);
    expect(creamGroup?.sizeToLineIndex["40"]).toBe(4);

    // Check BLACK group is separate
    const blackGroup = grouped.find(g => g.articleNo === "CH-08-J" && g.shade === "BLACK");
    expect(blackGroup).toBeDefined();
    expect(blackGroup?.totalQty).toBe(10);

    // Check CH-09-K group is separate
    const tanGroup = grouped.find(g => g.articleNo === "CH-09-K" && g.shade === "TAN");
    expect(tanGroup).toBeDefined();
    expect(tanGroup?.totalQty).toBe(15);

    // Check blank row preserved individually
    const blankGroup = grouped.find(g => g.groupKey.startsWith("__blank_"));
    expect(blankGroup).toBeDefined();
    expect(blankGroup?.totalQty).toBe(0);
  });

  it("6. prints Business Terms & Statutory Conditions on all 3 PO print templates", () => {
    // 6.1 PurchaseOrderPrintA4
    const htmlA4 = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          businessTerms: DEFAULT_BUSINESS_TERMS,
        }}
      />
    );
    expect(htmlA4).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
    expect(htmlA4).toContain("Strictly 120 Days credit settlement");
    expect(htmlA4).toContain("Mumbai, Maharashtra");

    // 6.2 FootwearPurchaseOrderA4
    const htmlFootwear = renderToStaticMarkup(
      <FootwearPurchaseOrderA4
        data={{
          poNumber: "FWPO-2026-084",
          businessTerms: DEFAULT_BUSINESS_TERMS,
          paymentTerms: "120 Days",
        }}
      />
    );
    expect(htmlFootwear).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
    expect(htmlFootwear).toContain("Strictly 120 Days credit settlement");
    expect(htmlFootwear).toContain("Mumbai, Maharashtra");
    expect(htmlFootwear).toContain("120 DAYS STATUTORY COMMERCIAL CONTRACT");

    // 6.3 SizePivotMatrixA4
    const htmlPivot = renderToStaticMarkup(
      <SizePivotMatrixA4
        data={{
          header: {
            orderNumber: "PO-2026-00451",
            prefix: "PO",
            businessTerms: DEFAULT_BUSINESS_TERMS,
            paymentTerms: "120 Days",
          },
          rows: [],
        }}
      />
    );
    expect(htmlPivot).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
    expect(htmlPivot).toContain("Strictly 120 Days credit settlement");
    expect(htmlPivot).toContain("Mumbai, Maharashtra");
    expect(htmlPivot).toContain("120 Days");
  });

  it("7. resolveFootwearAttributes extracts Heels, Upper Material, and Outsole from diverse key aliases and casing structures", () => {
    // 7.1 snake_case in attributes
    const itemSnake = {
      attributes: {
        heel_type: "BLOCK",
        upper_material: "SYNTHETIC LEATHER",
        outsole_material: "AIRMIX",
      },
    };
    expect(resolveFootwearAttributes(itemSnake)).toEqual({
      heels: "BLOCK",
      upperMaterial: "SYNTHETIC LEATHER",
      outsole: "AIRMIX",
    });

    // 7.2 Uppercase with spaces (Excel imports)
    const itemUpper = {
      attributes: {
        "HEEL TYPE": "FLAT",
        "UPPER MATERIAL": "CANVAS",
        "OUTSOLE": "TPR",
      },
    };
    expect(resolveFootwearAttributes(itemUpper)).toEqual({
      heels: "FLAT",
      upperMaterial: "CANVAS",
      outsole: "TPR",
    });

    // 7.3 Direct camelCase and snake_case properties
    const itemDirect = {
      heelType: "WEDGE",
      upperMaterial: "MESH",
      outsoleMaterial: "EVA SHEET",
    };
    expect(resolveFootwearAttributes(itemDirect)).toEqual({
      heels: "WEDGE",
      upperMaterial: "MESH",
      outsole: "EVA SHEET",
    });

    // 7.4 Nested inside originalProduct
    const itemNested = {
      originalProduct: {
        attributes: {
          "Heel Type": "KITTEN",
          "Upper": "PATENT LEATHER",
          "Sole": "RUBBER",
        },
      },
    };
    expect(resolveFootwearAttributes(itemNested)).toEqual({
      heels: "KITTEN",
      upperMaterial: "PATENT LEATHER",
      outsole: "RUBBER",
    });

    // 7.5 Missing returns em dash fallback
    expect(resolveFootwearAttributes({})).toEqual({
      heels: "—",
      upperMaterial: "—",
      outsole: "—",
    });
  });

  it("8. buildGroupedSizewiseLines preserves and sets heelType, upperMaterial, and outsoleMaterial on GroupedSizewiseDisplayRow", () => {
    const lines: any[] = [
      {
        id: "line-1",
        itemCode: "CH-25-G-36",
        articleNo: "CH-25-G",
        shade: "GOLD",
        sizeQuantities: { "36": 12 },
        heelType: "BLOCK HEEL",
        upperMaterial: "PU FOAM",
        outsoleMaterial: "NEOLITE",
      },
      {
        id: "line-2",
        itemCode: "CH-25-G-37",
        articleNo: "CH-25-G",
        shade: "GOLD",
        sizeQuantities: { "37": 24 },
      },
    ];

    const grouped = buildGroupedSizewiseLines(lines, ["36", "37"], 5);
    expect(grouped.length).toBe(1);
    expect(grouped[0].articleNo).toBe("CH-25-G");
    expect(grouped[0].shade).toBe("GOLD");
    expect(grouped[0].totalQty).toBe(36);
    expect(grouped[0].heelType).toBe("BLOCK HEEL");
    expect(grouped[0].upperMaterial).toBe("PU FOAM");
    expect(grouped[0].outsoleMaterial).toBe("NEOLITE");
  });

  it("9. parseFootwearSku accurately decomposes standard footwear barcodes into style, color, size, and brand", () => {
    const item1 = { code: "CH-25-G-GOLD-36" };
    expect(parseFootwearSku(item1)).toEqual({
      style: "CH-25-G",
      color: "GOLD",
      size: "36",
      brand: "Tattly Threads",
    });

    const item2 = { code: "SND-07-G-BLACK-40", brand: "SMRITI Footwear" };
    expect(parseFootwearSku(item2)).toEqual({
      style: "SND-07-G",
      color: "BLACK",
      size: "40",
      brand: "SMRITI Footwear",
    });

    const item3 = { code: "FLT-12-BRN-38", style: "FLT-12", color: "BROWN", size: "38" };
    expect(parseFootwearSku(item3)).toEqual({
      style: "FLT-12",
      color: "BROWN",
      size: "38",
      brand: "Tattly Threads",
    });
  });

  it("10. Vendor Directory PO reprint renders consolidated sizewise matrix with correct status and non-blank sizes", () => {
    // Simulating PO-G-AS_26-27_0023 single variant lines from Vendor Directory
    const vendorPOLines = [
      { articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, amount: 17850, taxPercent: 5, taxAmount: 892.5 },
      { articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "37": 34 }, totalQty: 34, rate: 525, amount: 17850, taxPercent: 5, taxAmount: 892.5 },
      { articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "38": 68 }, totalQty: 68, rate: 525, amount: 35700, taxPercent: 5, taxAmount: 1785.0 },
      { articleNo: "CH-25-G", color: "BROWN", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, amount: 17850, taxPercent: 5, taxAmount: 892.5 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          poNumber: "PO-G-AS_26-27_0023",
          status: "RECEIVED",
          orderDate: "24 Jul 2026",
          expectedDelivery: "23 Aug 2026",
          supplierName: "A. S. Shoes",
          supplierCode: "G",
          sizewiseItems: vendorPOLines,
        }}
      />
    );

    // Verify PO Number, Supplier with code G, and status RECEIVED
    expect(html).toContain("PO-G-AS_26-27_0023");
    expect(html).toContain("RECEIVED");
    expect(html).toContain("A. S. Shoes");
    expect(html).toContain("(G)");
    expect(html).not.toContain("pty_6b43521cfc03");

    // Order date and delivery date
    expect(html).toContain("24 Jul 2026");
    expect(html).toContain("23 Aug 2026");

    // Verify consolidated rows: CH-25-G GOLD should have total 136 (34+34+68)
    expect(html).toContain("CH-25-G");
    expect(html).toContain("GOLD");
    expect(html).toContain("BROWN");
    expect(html).toContain(">136<");
  });
});

