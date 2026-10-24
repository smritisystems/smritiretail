import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactCreditTaxInvoiceEditor } from "../components/sales/CompactCreditTaxInvoiceEditor.tsx";

describe("CompactCreditTaxInvoiceEditor", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders the compact credit invoice workspace without a fabricated invoice reference", () => {
    const html = renderToStaticMarkup(
      <CompactCreditTaxInvoiceEditor storeName="Downtown Store" cityName="Bengaluru" />
    );
    expect(html).toContain("SMRITI Retail OS");
    expect(html).toContain("Credit Tax Invoice");
    expect(html).toContain("(Against Original Invoice)");
    expect(html).toContain("Downtown Store | Bengaluru");
    expect(html).toContain("Original Invoice No.");
    expect(html).not.toContain("INV/2025/001456");
    expect(html).not.toContain("2025/000123");
  });

  it("starts with no sample transactions and zero document totals", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);
    ["Barcode / Stock No.", "Item Description", "Rate (₹)", "Qty", "Disc Code", "Total (₹)"].forEach((label) =>
      expect(html).toContain(label)
    );
    expect(html).not.toContain("Running Shoes (Blue - Size 42)");
    expect(html).not.toContain("8901234567890");
    expect(html).not.toContain("11,793.00");
    expect(html).toContain("Total Items");
    expect(html).toContain("Total Tax (₹)");
  });

  it("keeps the selected item editor and documented action bar available", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);
    ["Edit Selected Item", "Update (F4)", "Barcode Scan (F2)", "Bulk Import", "Copy &amp; Paste", "Add Item (F3)", "Remove (Del)", "Clear All", "Save Draft", "Print (F7)"].forEach((label) =>
      expect(html).toContain(label)
    );
  });

  it("renders direct Tax Invoice metadata and configured payment choices", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor initialBillType="Tax Invoice" />);
    expect(html).toContain("(Direct Sales / B2B &amp; Retail)");
    expect(html).toContain("PO / Order Ref.");
    expect(html).toContain("Post Tax Invoice (F5)");
    expect(html).toContain("CASH");
    expect(html).toContain("UPI");
    expect(html).toContain("CARD");
  });

  it("does not expose an unsupported sales debit-note workflow", () => {
    const html = renderToStaticMarkup(<CompactCreditTaxInvoiceEditor />);
    expect(html).not.toContain("Post Debit Note");
    expect(html).not.toContain("Rate Difference");
  });
});
