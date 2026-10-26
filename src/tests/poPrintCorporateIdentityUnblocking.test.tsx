/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.2
 * Created      : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Purchase Order Printing Corporate Identity Resolution Verification Suite
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
  removeItem: (k: string) => { storageMap.delete(k); },
  clear: () => { storageMap.clear(); },
};

if (typeof (globalThis as any).localStorage === "undefined") {
  (globalThis as any).localStorage = localStorageMock;
}
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: localStorageMock,
  };
}
if (typeof (globalThis as any).document === "undefined") {
  (globalThis as any).document = {
    body: {},
  };
}

import { PurchaseOrderPrintA4, PurchaseOrderPrintData } from "../print_engine/templates/PurchaseOrderPrintA4";
import { FootwearPurchaseOrderA4, FootwearPurchaseOrderData } from "../print_engine/templates/FootwearPurchaseOrderA4";
import { SizePivotMatrixA4, SizePivotMatrixData } from "../print_engine/templates/SizePivotMatrixA4";
import { persistTenantContext } from "../lib/apiFetchV1";
import POPrintPreviewModal from "../components/purchase/POPrintPreviewModal";
import type { PurchaseOrderHeader, PurchaseOrderLineItem, PurchaseOrderSizePivotRow } from "../components/purchase/types";

describe("Purchase Order Corporate Identity Resolution & Unblocking Suite", () => {
  const dummyHeader: PurchaseOrderHeader = {
    documentType: "Purchase Order",
    prefix: "PO",
    orderNumber: "1001",
    orderDate: "2026-10-26",
    supplierId: "SUP-001",
    supplierName: "Apex Fabrics Ltd",
    billTo: "MAIN",
    deliveryDate: "2026-11-05",
    leadTimeDays: 10,
    deliveryLocation: "MAIN",
    commonTaxPercent: 5,
    paymentTerms: "120 Days",
    freightCharges: "Paid by Supplier",
    specialInstructions: "Handle with care",
  };

  const dummyLineItems: PurchaseOrderLineItem[] = [
    {
      id: "line-1",
      sNo: 1,
      stockNo: "ART-FW-01",
      barcode: "8901234567890",
      product: "Derby Classic",
      brand: "Smriti Formal",
      style: "Oxford",
      shade: "Black",
      size: "42",
      fibre: "Leather",
      colourBase: "Black",
      styling: "Classic",
      rate: 1500,
      orderQty: 24,
      amount: 36000,
    },
  ];

  const dummyPivotRows: PurchaseOrderSizePivotRow[] = [
    {
      articleNo: "ART-FW-01",
      product: "Derby Classic",
      color: "Black",
      sizeQuantities: { "40": 4, "41": 8, "42": 8, "43": 4 },
      totalQty: 24,
      rate: 1500,
      totalValue: 36000,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("1. PurchaseOrderPrintA4 unblocks and renders corporate watermark when companyName is provided", () => {
    const poData: PurchaseOrderPrintData = {
      poNumber: "PO-1001",
      orderDate: "26 Oct 2026",
      companyName: "Tattly Threads Private Limited",
      companyAddress: "Office Number 81, Ibrahim Rehmatulla Road, Mumbai 400003",
      companyGstin: "27AAXFT2508H1ZR",
      supplierName: "Apex Fabrics Ltd",
      sizewiseItems: [
        {
          sNo: 1,
          articleNo: "ART-FW-01",
          color: "Black",
          sizeQuantities: { "42": 24 },
          totalQty: 24,
          rate: 1500,
          amount: 36000,
        },
      ],
      grandTotal: 37800,
    };

    const html = renderToStaticMarkup(<PurchaseOrderPrintA4 data={poData} />);
    expect(html).not.toContain('data-testid="print-blocked-container"');
    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads Private Limited");
    expect(html).toContain("27AAXFT2508H1ZR");
    expect(html).toContain("Apex Fabrics Ltd");
  });

  it("2. FootwearPurchaseOrderA4 unblocks and renders layout when companyName is provided", () => {
    const fwData: FootwearPurchaseOrderData = {
      poNumber: "FW-PO-1001",
      poDate: "2026-10-26",
      companyName: "Tattly Threads",
      companyAddress: "Mumbai, Maharashtra",
      companyGstin: "27AAXFT2508H1ZR",
      vendorName: "Apex Fabrics Ltd",
      items: [
        {
          articleNo: "ART-FW-01",
          color: "Black",
          totalPairs: 24,
          rate: 1500,
          amount: 36000,
        },
      ],
      netOrderValue: 36000,
    };

    const html = renderToStaticMarkup(<FootwearPurchaseOrderA4 data={fwData} />);
    expect(html).not.toContain('data-testid="print-blocked-container"');
    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads");
    expect(html).toContain("27AAXFT2508H1ZR");
  });

  it("3. SizePivotMatrixA4 unblocks when companyName is provided in data", () => {
    const pivotData: SizePivotMatrixData = {
      poNumber: "PO-1001",
      poDate: "2026-10-26",
      companyName: "Tattly Threads",
      supplierName: "Apex Fabrics Ltd",
      lines: [
        {
          articleNo: "ART-FW-01",
          color: "Black",
          quantities: { "42": 24 },
          rate: 1500,
          totalQty: 24,
          lineTotal: 36000,
        },
      ],
      grandTotal: 36000,
    };

    const html = renderToStaticMarkup(<SizePivotMatrixA4 data={pivotData} />);
    expect(html).not.toContain('data-testid="print-blocked-container"');
    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads");
  });

  it("4. POPrintPreviewModal unblocks printing when customCompanyProfile is passed", () => {
    const html = renderToStaticMarkup(
      <POPrintPreviewModal
        isOpen={true}
        onClose={() => {}}
        header={dummyHeader}
        lineItems={dummyLineItems}
        sizePivotRows={dummyPivotRows}
        activeTab="pivot"
        customCompanyProfile={{
          name: "Tattly Threads Private Limited",
          address: "81 Ibrahim Rehmatulla Road, Mumbai 400003",
          gstin: "27AAXFT2508H1ZR",
        }}
      />
    );

    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads Private Limited");
    expect(html).toContain("27AAXFT2508H1ZR");
  });

  it("5. POPrintPreviewModal unblocks printing when companyName is in localStorage / tenant context", () => {
    persistTenantContext({
      companyId: "COMP-001",
      companyName: "Tattly Threads",
      companyAddress: "Ibrahim Rehmatulla Road, Mumbai",
      companyGstin: "27AAXFT2508H1ZR",
    });

    const html = renderToStaticMarkup(
      <POPrintPreviewModal
        isOpen={true}
        onClose={() => {}}
        header={dummyHeader}
        lineItems={dummyLineItems}
        sizePivotRows={dummyPivotRows}
        activeTab="pivot"
      />
    );

    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads");
  });

  it("6. POPrintPreviewModal unblocks printing when companyName is provided in document payload", () => {
    const headerWithDocCompany: PurchaseOrderHeader = {
      ...dummyHeader,
      billTo: "Tattly Threads Corp",
    };

    const html = renderToStaticMarkup(
      <POPrintPreviewModal
        isOpen={true}
        onClose={() => {}}
        header={headerWithDocCompany}
        lineItems={dummyLineItems}
        sizePivotRows={dummyPivotRows}
        activeTab="pivot"
      />
    );

    expect(html).not.toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Tattly Threads Corp");
  });

  it("7. POPrintPreviewModal maintains strict fail-closed protection when all identities are absent", () => {
    const headerWithoutIdentity: PurchaseOrderHeader = {
      ...dummyHeader,
      billTo: "MAIN",
    };

    const html = renderToStaticMarkup(
      <POPrintPreviewModal
        isOpen={true}
        onClose={() => {}}
        header={headerWithoutIdentity}
        lineItems={dummyLineItems}
        sizePivotRows={dummyPivotRows}
        activeTab="pivot"
      />
    );

    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED");
    expect(html).toContain("Fail-Closed Statutory Protection Active");
  });
});
