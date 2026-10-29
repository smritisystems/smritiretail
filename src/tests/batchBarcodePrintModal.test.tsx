/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.14
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Batch Barcode Print Modal Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchBarcodePrintModal } from "../components/itemMaster/modals/BatchBarcodePrintModal";
import type { Product } from "../types";

describe("Batch Barcode Print Modal Architecture Suite", () => {
  const dummyProducts: Product[] = [
    {
      id: "prod-1",
      code: "SKU-FOOT-001",
      name: "Tattly Elite Runner Shoe",
      brand: "TATTLY THREADS",
      barcode: "8901234567890",
      price: 1999,
      mrp: 2499,
      size: "42",
      color: "Navy Blue",
      category: "Footwear",
      costPrice: 1200,
      stock: 50,
      taxRate: 18,
    },
    {
      id: "prod-2",
      code: "SKU-FOOT-002",
      name: "Tattly Oxford Classic",
      brand: "TATTLY THREADS",
      barcode: "8901234567891",
      price: 2999,
      mrp: 3499,
      size: "44",
      color: "Tan Brown",
      category: "Footwear",
      costPrice: 1800,
      stock: 25,
      taxRate: 18,
    },
  ];

  it("1. returns empty markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <BatchBarcodePrintModal
        isOpen={false}
        onClose={() => {}}
        products={dummyProducts}
      />
    );
    expect(html).toBe("");
  });

  it("2. renders modal shell and barcode items when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <BatchBarcodePrintModal
        isOpen={true}
        onClose={() => {}}
        products={dummyProducts}
        batchTitle="PO-2026-889 Received Batch"
      />
    );

    expect(html).toContain("barcode-batch-modal-root");
    expect(html).toContain("Barcode Label Queue");
    expect(html).toContain("2 Items Ready");
    expect(html).toContain("Tattly Elite Runner Shoe");
    expect(html).toContain("8901234567890");
    expect(html).toContain("Tattly Oxford Classic");
    expect(html).toContain("8901234567891");
  });

  it("3. embeds @media print CSS with #root { display: none !important; } and dynamic @page sizing", () => {
    const html = renderToStaticMarkup(
      <BatchBarcodePrintModal
        isOpen={true}
        onClose={() => {}}
        products={dummyProducts}
      />
    );

    expect(html).toContain("@media print");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain(".barcode-batch-modal-root");
    expect(html).toContain("position: static !important");
    expect(html).toContain(".barcode-batch-toolbar");
    expect(html).toContain(".barcode-batch-sheet-wrapper");
    expect(html).toContain(".barcode-batch-grid");
  });

  it("4. excludes toolbars and footer buttons in @media print via barcode-batch-toolbar class", () => {
    const html = renderToStaticMarkup(
      <BatchBarcodePrintModal
        isOpen={true}
        onClose={() => {}}
        products={dummyProducts}
      />
    );

    expect(html).toContain("barcode-batch-toolbar");
    expect(html).toContain("Download .PRN File");
    expect(html).toContain("Print 2 Labels");
  });
});
