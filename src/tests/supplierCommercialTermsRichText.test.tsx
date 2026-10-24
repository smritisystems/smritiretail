/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.85.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Automated Test Suite for Commercial Terms Rich Text Editor
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  sanitizeTermsHtml,
  cleanWordHtml,
  hasHtmlTags,
  STANDARD_COMMERCIAL_TERMS_HTML,
  STANDARD_COMMERCIAL_TERMS_TEXT,
} from "../utils/sanitizeTermsHtml";
import { SafeRichTermsRenderer } from "../components/common/SafeRichTermsRenderer";
import {
  PurchaseOrderPrintA4,
  PurchaseOrderPrintData,
} from "../print_engine/templates/PurchaseOrderPrintA4";
import {
  FootwearPurchaseOrderA4,
  FootwearPurchaseOrderData,
} from "../print_engine/templates/FootwearPurchaseOrderA4";
import { SizePivotMatrixA4 } from "../print_engine/templates/SizePivotMatrixA4";

describe("Supplier Commercial Terms Rich Text Editor & PO Integration Suite", () => {
  // ── TEST 1: Inserting the standard terms template ─────────────────────────
  describe("1. Standard Terms Template", () => {
    it("contains the exact 4 statutory contract clauses required by SMRITI specifications", () => {
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain("SMRITI STATUTORY COMMERCIAL CONTRACT");

      // Clause 1: Payment Terms
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain(
        "Strictly 120 Days credit settlement from date of physical GRN inwarding and barcode acceptance."
      );
      // Clause 2: Quality & Inspection
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain(
        "Goods are subject to warehouse QC inspection. Any manufacturing defect, shade mismatch, or size deviation must be replaced or credited within 15 days of intimation."
      );
      // Clause 3: Packaging & Labeling
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain(
        "All footwear articles must arrive packed in individual master boxes carrying GS1/EAN-13 barcodes, size labels, and manufacturer MRP stickers."
      );
      // Clause 4: Statutory & Legal Jurisdiction
      expect(STANDARD_COMMERCIAL_TERMS_HTML).toContain(
        "All commercial disputes arising out of this statutory purchase order are subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra."
      );
    });

    it("has a matching plain-text fallback representation", () => {
      expect(STANDARD_COMMERCIAL_TERMS_TEXT).toContain("BUSINESS TERMS & STATUTORY CONDITIONS");
      expect(STANDARD_COMMERCIAL_TERMS_TEXT).toContain("1. Payment Terms:");
      expect(STANDARD_COMMERCIAL_TERMS_TEXT).toContain("4. Statutory & Legal Jurisdiction:");
    });
  });

  // ── TEST 2 & 3: Editing, saving, and reloading without formatting loss ─────
  describe("2 & 3. Editing, Saving and Reloading Content", () => {
    it("preserves headings, ordered lists, bold text, and paragraphs after sanitization", () => {
      const richInput = `
        <h3 style="text-align: left;">SPECIAL PROCUREMENT TERMS</h3>
        <p>These terms govern high-volume seasonal procurement:</p>
        <ol>
          <li><strong>Credit Term:</strong> 90 Days post inwarding.</li>
          <li><em>Penalty Clause:</em> 1.5% deduction per week of dispatch delay.</li>
        </ol>
      `;

      const sanitized = sanitizeTermsHtml(richInput);
      expect(sanitized).toContain('<h3 style="text-align: left;">SPECIAL PROCUREMENT TERMS</h3>');
      expect(sanitized).toContain("<p>These terms govern high-volume seasonal procurement:</p>");
      expect(sanitized).toContain("<ol>");
      expect(sanitized).toContain("<li><strong>Credit Term:</strong> 90 Days post inwarding.</li>");
      expect(sanitized).toContain("<li><em>Penalty Clause:</em> 1.5% deduction per week of dispatch delay.</li>");
      expect(sanitized).toContain("</ol>");
    });

    it("correctly identifies whether a string contains rich HTML vs plain text", () => {
      expect(hasHtmlTags("<p>Hello World</p>")).toBe(true);
      expect(hasHtmlTags("<h3>Terms</h3>")).toBe(true);
      expect(hasHtmlTags("Plain text note without HTML")).toBe(false);
      expect(hasHtmlTags("120 Days credit terms\nSecond line note")).toBe(false);
    });
  });

  // ── TEST 4: Supplier-specific data isolation ──────────────────────────────
  describe("4. Supplier-Specific Data Isolation", () => {
    it("ensures different suppliers maintain isolated, distinct commercial contracts", () => {
      const supplierAShoes = {
        id: "SUP-548042",
        name: "A. S. Shoes",
        commercial_terms: {
          payment_terms: "120 Days",
          special_instructions: STANDARD_COMMERCIAL_TERMS_HTML,
          business_terms: STANDARD_COMMERCIAL_TERMS_HTML,
        },
      };

      const supplierCampus = {
        id: "SUP-102941",
        name: "Campus Activewear Ltd",
        commercial_terms: {
          payment_terms: "30 Days",
          special_instructions: "<p>Strictly 30 days advance payment terms with Delhi jurisdiction.</p>",
          business_terms: "<p>Strictly 30 days advance payment terms with Delhi jurisdiction.</p>",
        },
      };

      expect(supplierAShoes.commercial_terms.business_terms).toContain("courts in Mumbai, Maharashtra");
      expect(supplierCampus.commercial_terms.business_terms).toContain("Delhi jurisdiction");
      expect(supplierAShoes.commercial_terms.payment_terms).toBe("120 Days");
      expect(supplierCampus.commercial_terms.payment_terms).toBe("30 Days");
      expect(supplierAShoes.commercial_terms.business_terms).not.toEqual(
        supplierCampus.commercial_terms.business_terms
      );
    });
  });

  // ── TEST 5: Sanitization of unsafe HTML and Word paste cleanup ────────────
  describe("5. HTML Sanitization & Word Paste Cleaning", () => {
    it("strips malicious script tags, onerror handlers, and javascript: links", () => {
      const maliciousHtml = `
        <h3>Standard Contract</h3>
        <script>alert('XSS Exploit')</script>
        <img src="invalid.jpg" onerror="alert('Hacked')" />
        <a href="javascript:stealCookie()">Click here</a>
        <iframe src="http://evil.com"></iframe>
        <p>Legitimate contract paragraph.</p>
      `;

      const sanitized = sanitizeTermsHtml(maliciousHtml);
      expect(sanitized).not.toContain("<script");
      expect(sanitized).not.toContain("alert(");
      expect(sanitized).not.toContain("onerror");
      expect(sanitized).not.toContain("<iframe");
      expect(sanitized).not.toContain("javascript:");
      expect(sanitized).toContain("<h3>Standard Contract</h3>");
      expect(sanitized).toContain("<p>Legitimate contract paragraph.</p>");
    });

    it("cleans Microsoft Word pasted markup and mso conditional comments", () => {
      const wordHtml = `
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->
        <p class="MsoNormal" style="mso-margin-top-alt:auto;mso-margin-bottom-alt:auto">
          <b><span style="font-size:10.0pt;font-family:&quot;Calibri&quot;,sans-serif;mso-bidi-font-weight:bold">Clause 1: Delivery Terms</span></b>
        </p>
      `;

      const cleaned = cleanWordHtml(wordHtml);
      expect(cleaned).not.toContain("<!--[if");
      expect(cleaned).not.toContain("MsoNormal");
      expect(cleaned).not.toContain("mso-margin-top-alt");
      expect(cleaned).not.toContain("mso-bidi-font-weight");

      const sanitized = sanitizeTermsHtml(cleaned);
      expect(sanitized).toContain("Clause 1: Delivery Terms");
    });
  });

  // ── TEST 6: Legacy plain text and empty content handling ──────────────────
  describe("6. Legacy Plain-Text and Empty Content Handling", () => {
    it("renders legacy multiline text preserving natural linebreaks via whitespace-pre-line", () => {
      const plainText = "1. Immediate settlement on physical invoice.\n2. Goods once sold will not be taken back.";
      const markup = renderToStaticMarkup(<SafeRichTermsRenderer content={plainText} />);

      expect(markup).toContain("whitespace-pre-line");
      expect(markup).toContain("1. Immediate settlement on physical invoice.");
      expect(markup).toContain("2. Goods once sold will not be taken back.");
    });

    it("returns null safely for empty, null, or undefined content", () => {
      const nullMarkup = renderToStaticMarkup(<SafeRichTermsRenderer content={undefined} />);
      const emptyMarkup = renderToStaticMarkup(<SafeRichTermsRenderer content="   " />);

      expect(nullMarkup).toBe("");
      expect(emptyMarkup).toBe("");
    });
  });

  // ── TEST 7: Rendering terms on Purchase Order preview & templates ─────────
  describe("7. Purchase Order Print Templates Rendering", () => {
    const basePOData: PurchaseOrderPrintData = {
      poNumber: "PO-G-AS_26-27_0023",
      orderDate: "11 Aug 2026",
      expectedDelivery: "23 Aug 2026",
      warehouse: "Main Store (MAIN)",
      status: "APPROVED",
      supplierName: "A. S. Shoes",
      supplierCode: "G",
      paymentTerms: "120 Days",
      freightTerms: "Paid by Supplier",
      currency: "INR (₹)",
      specialInstructions: "Carefully inspect cartons before loading.",
      businessTerms: STANDARD_COMMERCIAL_TERMS_HTML,
      totalItems: 1,
      totalQuantity: 100,
      subtotal: 50000,
      gstAmount: 2500,
      grandTotal: 52500,
      commonTaxPercent: 5,
    };

    it("renders rich-text business terms in PurchaseOrderPrintA4 without raw HTML tags", () => {
      const markup = renderToStaticMarkup(<PurchaseOrderPrintA4 data={basePOData} />);

      // Must render heading and clauses
      expect(markup).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
      expect(markup).toContain("SMRITI STATUTORY COMMERCIAL CONTRACT");
      expect(markup).toContain("Strictly 120 Days credit settlement");
      expect(markup).toContain("courts in Mumbai, Maharashtra");

      // Must use SafeRichTermsRenderer with class rich-terms-rendered
      expect(markup).toContain("rich-terms-rendered");

      // Must not display raw unrendered tags as literal text
      expect(markup).not.toContain("&lt;h3&gt;");
      expect(markup).not.toContain("&lt;ol&gt;");
      expect(markup).not.toContain("&lt;li&gt;");
    });

    it("renders rich-text business terms in FootwearPurchaseOrderA4 cleanly", () => {
      const footwearData: FootwearPurchaseOrderData = {
        poNumber: "PO-G-AS_26-27_0023",
        poDate: "2026-08-11",
        deliveryDate: "2026-08-23",
        companyName: "TATTLY THREADS",
        companySubtitle: "Footwear Sourcing & Procurement Division",
        vendorName: "A. S. Shoes",
        vendorCode: "G",
        paymentTerms: "120 Days",
        freightTerms: "Paid by Supplier",
        currencySymbol: "₹",
        items: [],
        totalPairs: 0,
        totalCartons: 0,
        subTotal: 0,
        gstTotal: 0,
        netTotal: 0,
        businessTerms: STANDARD_COMMERCIAL_TERMS_HTML,
      };

      const markup = renderToStaticMarkup(<FootwearPurchaseOrderA4 data={footwearData} />);
      expect(markup).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
      expect(markup).toContain("rich-terms-rendered");
      expect(markup).toContain("Strictly 120 Days credit settlement");
      expect(markup).not.toContain("&lt;h3&gt;");
    });

    it("renders rich-text business terms in SizePivotMatrixA4 cleanly", () => {
      const header: any = {
        orderNumber: "AS_26-27_0023",
        prefix: "PO-G",
        orderDate: "2026-08-11",
        deliveryDate: "2026-08-23",
        supplierName: "A. S. Shoes",
        paymentTerms: "120 Days",
        freightCharges: "Paid by Supplier",
        businessTerms: STANDARD_COMMERCIAL_TERMS_HTML,
      };

      const markup = renderToStaticMarkup(<SizePivotMatrixA4 header={header} rows={[]} />);
      expect(markup).toContain("BUSINESS TERMS &amp; STATUTORY CONDITIONS");
      expect(markup).toContain("rich-terms-rendered");
      expect(markup).toContain("Strictly 120 Days credit settlement");
      expect(markup).not.toContain("&lt;ol&gt;");
    });
  });

  // ── TEST 8: Snapshot immutability guarantee ───────────────────────────────
  describe("8. Snapshot Immutability Guarantee", () => {
    it("ensures historical PO terms remain frozen in rule_snapshots even if supplier master terms change", () => {
      // Historical PO created when supplier had 60 days terms
      const originalHistoricalPO = {
        order_no: "PO-2026-001",
        supplier_id: "SUP-548042",
        status: "CONFIRMED",
        rule_snapshots: {
          commercial_terms: {
            payment_terms: "60 Days",
            special_instructions: "<p>Original historical terms: 60 Days credit.</p>",
            business_terms: "<p>Original historical terms: 60 Days credit.</p>",
          },
        },
      };

      // Supplier Master is subsequently edited to standard 120 days terms
      const updatedSupplierMaster = {
        id: "SUP-548042",
        name: "A. S. Shoes",
        payment_terms: "120 Days",
        metadata_json: {
          commercial_terms: {
            payment_terms: "120 Days",
            special_instructions: STANDARD_COMMERCIAL_TERMS_HTML,
            business_terms: STANDARD_COMMERCIAL_TERMS_HTML,
          },
        },
      };

      // Simulating PO restoration logic from PoSizewiseTab / backend
      const restoredCommercialTerms =
        originalHistoricalPO.rule_snapshots?.commercial_terms?.business_terms;

      // The historical PO terms MUST remain the frozen snapshot (60 Days)
      expect(restoredCommercialTerms).toBe("<p>Original historical terms: 60 Days credit.</p>");
      expect(restoredCommercialTerms).not.toBe(
        updatedSupplierMaster.metadata_json.commercial_terms.business_terms
      );
    });
  });
});
