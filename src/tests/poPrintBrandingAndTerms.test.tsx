/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.86.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Purchase Order Print Branding, Watermark & Payment Terms Verification
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PurchaseOrderPrintA4,
  PurchaseOrderPrintData,
  GoldenRatioImagePlaceholder,
} from "../print_engine/templates/PurchaseOrderPrintA4";

describe("Purchase Order Print Branding, Watermark & Payment Terms Verification", () => {
  const sampleFootwearPOData: PurchaseOrderPrintData = {
    poNumber: "PO-G-AS_26-27_0023",
    orderDate: "11 Aug 2026",
    expectedDelivery: "23 Aug 2026",
    warehouse: "Main Store (MAIN)",
    status: "RECEIVED",

    supplierName: "A. S. Shoes",
    supplierCode: "G",
    supplierAddress: "Hirji Govandji compound, Building No.2, Shop No.13, Grd floor, Sir J.J. Road, Mumbai - 400008, Maharashtra",
    supplierGstin: "27ABEPA1910C1ZK",
    supplierContact: "9867230839",
    supplierEmail: "a.s.shoe@hotmail.com",
    supplierReference: "AS/26-27/0023",

    paymentTerms: "120 Days",
    freightTerms: "Paid by Supplier",
    currency: "INR (₹)",
    deliveryTerms: "Ex-Factory",
    specialInstructions: "Please ensure all items are packed with size stickers and barcode labels.",

    companyName: "TATTLY THREADS",
    companyAddress: "Office Number 81, Ibrahim Rehmatulla Road, Near HP Petrol Pump, Beside Jio Store, Mumbai, Maharashtra 400003",
    companyGstin: "27AAXFT2508H1ZR",
    companyPan: "AAXFT2508H",
    companyWebsite: "www.tattlythreads.com",
    companyEmail: "accounts@tattlythreads.com",
    logoUrl: "/tattly_logo_black.png",

    totalItems: 24,
    totalQuantity: 1088,
    subtotal: 571200,
    gstAmount: 28560,
    grandTotal: 599760,
    commonTaxPercent: 5,

    sizeChartName: "Size Chart: EU (36 - 44)",
    sizeColumns: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
    sizewiseItems: [
      {
        sNo: 1,
        articleNo: "CH-25-G",
        color: "GOLD",
        sizeQuantities: { "36": 34 },
        totalQty: 34,
        rate: 525,
        taxPercent: 5,
        taxAmount: 892.50,
        amount: 17850,
      },
    ],
    itemReferences: [
      {
        articleNo: "CH-25-G",
        color: "GOLD",
      },
      {
        articleNo: "SND-07-G",
        color: "BLACK",
      },
    ],
  };

  it("1. renders Real Company Logo and TATTLY THREADS corporate coordinates instead of SMRITI Retail OS", () => {
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);

    // Brand Name: TATTLY THREADS
    expect(html).toContain("TATTLY THREADS");
    // Not SMRITI generic retail company
    expect(html).not.toContain("SMRITI Retail Private Limited");
    expect(html).not.toContain("123 Retail Park, MG Road, Bengaluru");
    expect(html).not.toContain("29AABCS1234F1Z5");

    // Real address, GSTIN, PAN, and contacts
    expect(html).toContain("Office Number 81, Ibrahim Rehmatulla Road");
    expect(html).toContain("27AAXFT2508H1ZR");
    expect(html).toContain("AAXFT2508H");
    expect(html).toContain("www.tattlythreads.com");
    expect(html).toContain("accounts@tattlythreads.com");

    // Brand logo image present
    expect(html).toContain("<img");
    expect(html).toContain("alt=\"TATTLY THREADS\"");
  });

  it("2. renders background document watermark and official Image Not Available placeholder graphic", () => {
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);

    // Background document watermark with Tattly Threads logo
    expect(html).toContain("rotate-[-28deg]");
    expect(html).toContain("PURCHASE ORDER");
    expect(html).toContain("TATTLY THREADS");
    expect(html).toContain("tattly_logo_black.png");

    // GoldenRatioImagePlaceholder official graphic
    const placeholderHtml = renderToStaticMarkup(<GoldenRatioImagePlaceholder articleNo="CH-25-G" />);
    expect(placeholderHtml).toMatch(/smriti-image-placeholder\.png|image_not_available_placeholder\.png/);
    expect(placeholderHtml).toContain("Image Not Available");
    // Verifies no border or badge decorations around placeholder
    expect(placeholderHtml).not.toContain("border");
    expect(placeholderHtml).not.toContain("absolute bottom-1");
    expect(placeholderHtml).not.toContain("SMRITI Retail Private Limited");
  });

  it("3. displays Payment Terms of 120 Days from vendor profile (and defaults to 120 Days if missing)", () => {
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);
    expect(html).toContain("Payment Terms");
    expect(html).toContain("120 Days");
    expect(html).not.toContain("30 Days");

    // Fallback test when paymentTerms is undefined
    const missingTermsData: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      paymentTerms: undefined,
    };
    const htmlMissing = renderToStaticMarkup(<PurchaseOrderPrintA4 data={missingTermsData} />);
    expect(htmlMissing).toContain("120 Days");
  });

  it("4. dynamically calculates statutory 5% GST label and prevents false GST (18%) display", () => {
    // ₹28,560 tax on ₹5,71,200 subtotal is 5%
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);
    expect(html).toContain("GST (5%)");
    expect(html).not.toContain("GST (18%)");
  });

  it("5. renders authentic supplier address, contact, and reference without dummy mock fallbacks", () => {
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);

    expect(html).toContain("A. S. Shoes");
    expect(html).toContain("Hirji Govandji compound");
    expect(html).toContain("27ABEPA1910C1ZK");
    expect(html).toContain("9867230839");
    expect(html).toContain("a.s.shoe@hotmail.com");
    expect(html).toContain("AS/26-27/0023");

    // Prohibit dummy mock strings
    expect(html).not.toContain("ABC Footwear Pvt Ltd");
    expect(html).not.toContain("A-12, Industrial Area, Andheri (East)");
    expect(html).not.toContain("27AAECA1234F1Z5");
    expect(html).not.toContain("sales@abcfootwear.in");
    expect(html).not.toContain("ABC/PO/2026/451");
  });

  it("6. verifies product image handling: original image when URL exists, branded placeholder when missing or invalid", () => {
    const poWithMixedImages: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      itemReferences: [
        {
          articleNo: "ART-REAL-01",
          color: "BLACK",
          imageUrl: "https://example.com/products/art-real-01.jpg",
        },
        {
          articleNo: "ART-MISSING-02",
          color: "TAN",
          imageUrl: "", // empty
        },
        {
          articleNo: "ART-NULL-03",
          color: "BROWN",
          imageUrl: undefined, // undefined
        },
      ],
    };

    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={poWithMixedImages} />);

    // Real image URL is rendered directly
    expect(html).toContain("https://example.com/products/art-real-01.jpg");
    expect(html).toContain("alt=\"ART-REAL-01\"");

    // Missing images render the official SMRITI placeholder graphic
    expect(html).toContain("alt=\"Image Not Available\"");
    expect(html).toMatch(/smriti-image-placeholder\.png/);
  });

  it("7. verifies 5:3 container layout, 2 images per row in Item Reference section, without border or decoration around placeholder", () => {
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={sampleFootwearPOData} />);

    // Item Reference section header
    expect(html).toContain("ITEM REFERENCE (IMAGES)");
    expect(html).toContain("2 images per row");

    // 5:3 aspect ratio container
    expect(html).toContain("5 / 3");
    expect(html).toContain("object-contain");

    // Both missing item references render the placeholder
    const matches = html.match(/alt="Image Not Available"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it("allows item-reference attributes to be selected independently", () => {
    const colorHiddenHtml = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...sampleFootwearPOData,
          itemReferenceFields: {
            color: false,
            heels: true,
            upperMaterial: true,
            outsole: true,
          },
        }}
      />
    );
    const colorHiddenSection = colorHiddenHtml
      .split("ITEM REFERENCE (IMAGES)")[1]
      ?.split("COMMERCIAL TERMS")[0] ?? "";

    expect(colorHiddenSection).not.toContain(">Color</span>");
    expect(colorHiddenSection).toContain(">Heels:</span>");
    expect(colorHiddenSection).toContain(">Upper Material:</span>");
    expect(colorHiddenSection).toContain(">Outsole:</span>");

    const colorVisibleHtml = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...sampleFootwearPOData,
          itemReferenceFields: {
            color: true,
            heels: false,
            upperMaterial: false,
            outsole: false,
          },
        }}
      />
    );
    const colorVisibleSection = colorVisibleHtml
      .split("ITEM REFERENCE (IMAGES)")[1]
      ?.split("COMMERCIAL TERMS")[0] ?? "";

    expect(colorVisibleSection).toContain(">Color:</span>");
    expect(colorVisibleSection).not.toContain(">Heels:</span>");
    expect(colorVisibleSection).not.toContain(">Upper Material:</span>");
    expect(colorVisibleSection).not.toContain(">Outsole:</span>");
  });

  it("wraps long item-reference attributes instead of clipping them", () => {
    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...sampleFootwearPOData,
          itemReferences: [
            {
              articleNo: "ARTICLE-WITH-A-LONG-REFERENCE",
              color: "DARK BLUE WITH CONTRAST STITCHING",
              heels: "HIGH PLATFORM WITH REINFORCED SUPPORT",
              upperMaterial: "GENUINE LEATHER WITH BREATHABLE MESH LINING",
              outsole: "NON-MARKING RUBBER WITH HIGH GRIP PATTERN",
            },
          ],
        }}
      />
    );
    const referenceSection = html.split("ITEM REFERENCE (IMAGES)")[1]?.split("COMMERCIAL TERMS")[0] ?? "";

    expect(referenceSection).toContain("DARK BLUE WITH CONTRAST STITCHING");
    expect(referenceSection).toContain("HIGH PLATFORM WITH REINFORCED SUPPORT");
    expect(referenceSection).toContain("GENUINE LEATHER WITH BREATHABLE MESH LINING");
    expect(referenceSection).toContain("NON-MARKING RUBBER WITH HIGH GRIP PATTERN");
    expect(referenceSection).toContain("break-words");
    expect(referenceSection).not.toContain("truncate");
  });

  it("8. auto-derives item references from sizewise or standard items when itemReferences is empty so placeholders are never missing", () => {
    const poWithoutExplicitReferences: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      itemReferences: [], // empty array
    };

    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={poWithoutExplicitReferences} />);

    // Item Reference section header still renders
    expect(html).toContain("ITEM REFERENCE (IMAGES)");
    // Auto-derived card for CH-25-G renders with official Image Not Available placeholder
    expect(html).toContain("CH-25-G");
    expect(html).toContain("alt=\"Image Not Available\"");
    expect(html).toMatch(/smriti-image-placeholder\.png/);
  });

  it("9. renders CORPORATE IDENTITY NOT CONFIGURED banner and omits watermark when companyName is missing", () => {
    const unconfiguredPOData: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      companyName: undefined,
      companyAddress: undefined,
      companyGstin: undefined,
      logoUrl: undefined,
    };
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={unconfiguredPOData} />);
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("rotate-[-28deg]");
  });

  it("10. renders explicit deliveryTerms when provided (e.g. Door Delivery)", () => {
    const dataWithDoorDelivery: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      freightTerms: "Paid by Supplier",
      deliveryTerms: "Door Delivery",
    };
    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={dataWithDoorDelivery} />);
    expect(html).toContain("Delivery Terms");
    expect(html).toContain("Door Delivery");
  });

  it("11. smart-derives Door Delivery when freight is Paid by Supplier, and Ex-Factory when freight is Paid by Buyer", () => {
    const dataPaidBySupplier: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      freightTerms: "Paid by Supplier",
      deliveryTerms: undefined,
    };
    const htmlSupplier = renderToStaticMarkup(<PurchaseOrderPrintA4 data={dataPaidBySupplier} />);
    expect(htmlSupplier).toContain("Door Delivery");

    const dataPaidByBuyer: PurchaseOrderPrintData = {
      ...sampleFootwearPOData,
      freightTerms: "Paid by Buyer (To Pay)",
      deliveryTerms: undefined,
    };
    const htmlBuyer = renderToStaticMarkup(<PurchaseOrderPrintA4 data={dataPaidByBuyer} />);
    expect(htmlBuyer).toContain("Ex-Factory");
  });

  it("12. supports dynamic image columns: 2 per row (large 118px) and 4 per row (compact 78px)", () => {
    const html2Cols = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...sampleFootwearPOData,
          imageColumns: 2,
        }}
      />
    );
    expect(html2Cols).toContain("2 images per row • Large preview");
    expect(html2Cols).toContain("grid-cols-2");
    expect(html2Cols).toContain("118px");

    const html4Cols = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...sampleFootwearPOData,
          imageColumns: 4,
        }}
      />
    );
    expect(html4Cols).toContain("4 images per row • Compact preview");
    expect(html4Cols).toContain("grid-cols-4");
    expect(html4Cols).toContain("78px");
  });
});
