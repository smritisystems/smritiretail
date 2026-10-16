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

    // Background document watermark
    expect(html).toContain("rotate-[-28deg]");
    expect(html).toContain("PURCHASE ORDER");
    expect(html).toContain("TATTLY THREADS");

    // GoldenRatioImagePlaceholder official graphic
    const placeholderHtml = renderToStaticMarkup(<GoldenRatioImagePlaceholder articleNo="CH-25-G" />);
    expect(placeholderHtml).toContain("image_not_available_placeholder.png");
    expect(placeholderHtml).toContain("Image Not Available");
    expect(placeholderHtml).toContain("CH-25-G");
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
});
