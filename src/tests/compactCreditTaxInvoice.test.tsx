/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-24
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactCreditTaxInvoiceEditor } from "../components/sales/CompactCreditTaxInvoiceEditor.tsx";

describe("CompactCreditTaxInvoiceEditor — Reference Screenshot Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Renders complete window header, metadata grid, and document identity matching screenshot", () => {
    const html = renderToStaticMarkup(
      <CompactCreditTaxInvoiceEditor
        storeName="Downtown Store"
        cityName="Bengaluru"
      />
    );

    // Title & Brand
    expect(html).toContain("SMRITI Retail OS");
    expect(html).toContain("Credit Tax Invoice");
    expect(html).toContain("(Against Original Invoice)");

    // Store & User Info
    expect(html).toContain("Downtown Store | Bengaluru");

    // Document Metadata Form Fields
    expect(html).toContain("Bill Type");
    expect(html).toContain("Credit Tax Invoice");
    expect(html).toContain("Series");
    expect(html).toContain("CRN");
    expect(html).toContain("2025/000123");
    expect(html).toContain("Original Invoice No.");
    expect(html).toContain("INV/2025/001456");

    // Top action buttons
    expect(html).toContain("Load Items");
    expect(html).toContain("Import");
    expect(html).toContain("Recall");

    // Customer & Statutory Details
    expect(html).toContain("Customer Code");
    expect(html).toContain("CUST-001");
    expect(html).toContain("Customer Name");
    expect(html).toContain("Walk-in Customer");
    expect(html).toContain("GSTIN :");
    expect(html).toContain("Unregistered");
    expect(html).toContain("Karnataka (29)");
    expect(html).toContain("Sales Staff");
    expect(html).toContain("Ramesh");
    expect(html).toContain("Returned Items");
  });

  it("2. Renders all 5 initial table items, columns, and initial Net Amount matching screenshot", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);

    // Columns
    expect(html).toContain("Barcode / Stock No.");
    expect(html).toContain("Item Description");
    expect(html).toContain("Rate (₹)");
    expect(html).toContain("Qty");
    expect(html).toContain("Value (₹)");
    expect(html).toContain("Disc Code");
    expect(html).toContain("Disc Qty");
    expect(html).toContain("Disc %");
    expect(html).toContain("Disc Amt (₹)");
    expect(html).toContain("Total (₹)");

    // Table items from reference screenshot
    expect(html).toContain("Running Shoes (Blue - Size 42)");
    expect(html).toContain("T-Shirt (Medium)");
    expect(html).toContain("Jeans (Size 32)");
    expect(html).toContain("Handbag (Brown)");
    expect(html).toContain("Watch (Analog)");

    // Item barcodes
    expect(html).toContain("8901234567890");
    expect(html).toContain("8909876543210");
    expect(html).toContain("8901122334455");
    expect(html).toContain("8905566778899");
    expect(html).toContain("8909988776655");

    // Item rates and quantities
    expect(html).toContain("2,999.00");
    expect(html).toContain("699.00");
    expect(html).toContain("1,499.00");
    expect(html).toContain("1,999.00");
    expect(html).toContain("4,999.00");

    // KPI status bar metrics matching reference screenshot
    expect(html).toContain("Total Items");
    expect(html).toContain("5");
    expect(html).toContain("Total Qty.");
    expect(html).toContain("6.00");
    expect(html).toContain("Sales Value (₹)");
    expect(html).toContain("11,894.00");
    expect(html).toContain("Item Level Disc (₹)");
    expect(html).toContain("239.75");
    expect(html).toContain("Total Tax (₹)");
    expect(html).toContain("975.75");
    expect(html).toContain("Net Amount (₹)");
    expect(html).toContain("11,793.00");
  });

  it("3. Displays the 'Edit Selected Item' middle drawer with synced inputs", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);

    expect(html).toContain("Edit Selected Item");
    expect(html).toContain("Update (F4)");
    expect(html).toContain("Cancel");
    expect(html).toContain("Disc Code");
    expect(html).toContain("Disc Qty");
    expect(html).toContain("Disc %");
    expect(html).toContain("Disc Amt (₹)");
  });

  it("4. Renders the action bar with F2 barcode scan and F3 add item triggers", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);

    expect(html).toContain("Barcode Scan (F2)");
    expect(html).toContain("Bulk Import");
    expect(html).toContain("Copy &amp; Paste");
    expect(html).toContain("Add Item (F3)");
    expect(html).toContain("Remove (Del)");
    expect(html).toContain("Clear All");
    expect(html).toContain("Scan barcode or enter item code / name...");
  });

  it("5. Renders financial breakdown and optional notes section", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);

    expect(html).toContain("Notes");
    expect(html).toContain("Optional");
    expect(html).toContain("Add notes for this credit invoice...");
    expect(html).toContain("Sales");
    expect(html).toContain("Discounts");
    expect(html).toContain("Sales Tax (GST)");
    expect(html).toContain("Add-on Gen.:");
    expect(html).toContain("Deduct Gen.:");
  });

  it("6. Renders bottom command bar with shortcuts and F5 post / F7 print actions", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);

    expect(html).toContain("More Options");
    expect(html).toContain("Shortcuts: F2 Scan | F3 Add Item | F4 Update | F5 Post | F7 Print | Del Remove");
    expect(html).toContain("Save Draft");
    expect(html).toContain("Post Credit Invoice (F5)");
    expect(html).toContain("Print (F7)");
    expect(html).toContain("Cancel");
  });
});
