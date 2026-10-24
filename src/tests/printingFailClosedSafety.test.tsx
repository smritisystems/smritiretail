/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Printing Fail-Closed Statutory Safety Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { StandardInvoiceA4, InvoiceData } from "../print_engine/templates/StandardInvoiceA4";
import { PurchaseOrderPrintA4, PurchaseOrderPrintData } from "../print_engine/templates/PurchaseOrderPrintA4";
import { FootwearPurchaseOrderA4, FootwearPurchaseOrderData } from "../print_engine/templates/FootwearPurchaseOrderA4";
import { SizePivotMatrixA4, SizePivotMatrixData } from "../print_engine/templates/SizePivotMatrixA4";
import { ThermalReceipt80mm, ThermalReceipt80mmData } from "../print_engine/templates/ThermalReceipt80mm";
import { TaxInvoiceA4 } from "../components/templates/TaxInvoiceA4";

describe("Frontend Print Engine Fail-Closed Statutory Verification", () => {
  it("1. StandardInvoiceA4 blocks rendering completely if company name or GSTIN is missing", () => {
    const unconfiguredInvoice: InvoiceData = {
      invoiceNo: "INV-9999",
      date: "2026-10-18",
      companyName: "",
      companyGst: "",
      customerName: "Target Buyer",
      items: [
        {
          code: "SKU-SECRET-01",
          name: "Confidential Garments",
          price: 9999,
          quantity: 10,
          lineTotal: 99990,
        },
      ],
      grandTotal: 99990,
    };

    const html = renderToStaticMarkup(<StandardInvoiceA4 data={unconfiguredInvoice} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("SKU-SECRET-01");
    expect(html).not.toContain("Confidential Garments");
    expect(html).not.toContain("99990");
    expect(html).not.toContain("<table");
  });

  it("2. PurchaseOrderPrintA4 blocks rendering completely if company name is missing", () => {
    const unconfiguredPO: PurchaseOrderPrintData = {
      poNumber: "PO-SECRET-001",
      orderDate: "18 Oct 2026",
      companyName: "",
      supplierName: "Confidential Mills",
      sizewiseItems: [
        {
          sNo: 1,
          articleNo: "ART-TOP-SECRET",
          color: "RED",
          sizeQuantities: { "40": 50 },
          totalQty: 50,
          rate: 1500,
          amount: 75000,
        },
      ],
      grandTotal: 75000,
    };

    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={unconfiguredPO} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("ART-TOP-SECRET");
    expect(html).not.toContain("75000");
    expect(html).not.toContain("Confidential Mills");
    expect(html).not.toContain("<table");
  });

  it("3. FootwearPurchaseOrderA4 blocks rendering completely if company name is missing", () => {
    const unconfiguredFootwearPO: FootwearPurchaseOrderData = {
      poNumber: "FW-PO-001",
      poDate: "2026-10-18",
      companyName: "",
      vendorName: "Private Supplier Ltd",
      items: [
        {
          articleNo: "SECRET-FOOTWEAR-99",
          color: "TAN",
          totalPairs: 100,
          rate: 800,
          amount: 80000,
        },
      ],
      netOrderValue: 80000,
    };

    const html = renderToStaticMarkup(<FootwearPurchaseOrderA4 data={unconfiguredFootwearPO} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("SECRET-FOOTWEAR-99");
    expect(html).not.toContain("80000");
    expect(html).not.toContain("Private Supplier Ltd");
  });

  it("4. SizePivotMatrixA4 blocks rendering completely if company name is missing", () => {
    const unconfiguredMatrix: SizePivotMatrixData = {
      poNumber: "PIVOT-001",
      poDate: "2026-10-18",
      companyName: "",
      supplierName: "Secret Factory",
      lines: [
        {
          articleNo: "PIVOT-SECRET-ARTICLE",
          color: "NAVY",
          quantities: { "7": 20 },
          totalPairs: 20,
          rate: 650,
          totalAmount: 13000,
        },
      ],
      grandTotal: 13000,
    };

    const html = renderToStaticMarkup(<SizePivotMatrixA4 data={unconfiguredMatrix} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("PIVOT-SECRET-ARTICLE");
    expect(html).not.toContain("13000");
    expect(html).not.toContain("Secret Factory");
  });

  it("5. ThermalReceipt80mm blocks rendering completely if store / company name is missing", () => {
    const unconfiguredReceipt: ThermalReceipt80mmData = {
      receiptNo: "REC-9999",
      date: "2026-10-18",
      time: "14:30:00",
      companyName: "",
      items: [
        {
          name: "POS Private Item",
          qty: 2,
          rate: 450,
          amount: 900,
        },
      ],
      grandTotal: 900,
    };

    const html = renderToStaticMarkup(<ThermalReceipt80mm data={unconfiguredReceipt} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("STORE IDENTITY NOT CONFIGURED");
    expect(html).toContain("PRINTING BLOCKED");
    expect(html).not.toContain("POS Private Item");
    expect(html).not.toContain("900");
  });

  it("6. TaxInvoiceA4 blocks rendering completely if seller legal name or GSTIN is missing", () => {
    const unconfiguredTaxInvoice = {
      invoiceNo: "TAX-INV-001",
      date: "2026-10-18",
      companyName: "",
      companyGst: "",
      customerName: "Buyer Customer",
      items: [
        {
          name: "Taxable Item Luxury SKU",
          quantity: 1,
          price: 5000,
          taxable_value: 5000,
          gst_rate: 18,
          cgst_amount: 450,
          sgst_amount: 450,
          line_total: 5900,
        },
      ],
    };

    const html = renderToStaticMarkup(<TaxInvoiceA4 data={unconfiguredTaxInvoice} />);
    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).not.toContain("Taxable Item Luxury SKU");
    expect(html).not.toContain("5900");
    expect(html).not.toContain("<table");
  });
});
