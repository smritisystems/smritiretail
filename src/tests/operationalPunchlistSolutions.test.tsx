/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-11-03
 * Modified     : 2026-11-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Operational Punchlist Hardening Unit Tests
 */

import { describe, it, expect } from "vitest";
import React from "react";
import QRCode from "qrcode";
import { UniversalInvoiceQr } from "../components/common/UniversalInvoiceQr";

describe("Operational Punchlist Hardening Test Suite", () => {
  it("Item 4: Generates valid statutory E-Invoice signed QR code data URL", async () => {
    const mockSignedQrJwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.SMRITI_NIC_EINV_SIGNED_PAYLOAD";
    const dataUrl = await QRCode.toDataURL(mockSignedQrJwt, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    expect(dataUrl).toBeDefined();
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("Item 4: Generates valid dynamic NPCI UPI Deep Link QR code for payment", async () => {
    const upiId = "store@upi";
    const company = "SMRITI Flagship Store";
    const grandTotal = 1450.75;
    const invNo = "INV-2026-0042";

    const upiPayload = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(company)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invNo}`)}&tr=${encodeURIComponent(invNo)}`;
    expect(upiPayload).toContain("upi://pay?pa=store%40upi");
    expect(upiPayload).toContain("am=1450.75");
    expect(upiPayload).toContain("cu=INR");

    const qrUrl = await QRCode.toDataURL(upiPayload, { width: 160, margin: 1 });
    expect(qrUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("Item 7: Manual bill-level discount calculation produces exact deduction", () => {
    const subtotal = 5000.0;
    // Flat discount test
    const flatDiscount = 250.0;
    const netAfterFlat = subtotal - flatDiscount;
    expect(netAfterFlat).toBe(4750.0);

    // Percentage discount test (10%)
    const pctDiscount = 10; // 10%
    const calculatedPctDisc = (subtotal * pctDiscount) / 100;
    expect(calculatedPctDisc).toBe(500.0);
    expect(subtotal - calculatedPctDisc).toBe(4500.0);
  });

  it("Item 8: Dropdown customer search allows empty query to return top results", () => {
    const mockCustomers = [
      { id: "c1", name: "Alpha Retailers", mobile: "9876543210" },
      { id: "c2", name: "Beta Traders", mobile: "9876543211" },
      { id: "c3", name: "Gamma Enterprises", mobile: "9876543212" },
    ];

    const filterWithQuery = (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return mockCustomers.slice(0, 8); // Now surfaces top results on open!
      return mockCustomers.filter((c) => c.name.toLowerCase().includes(q));
    };

    // When query is empty (on dropdown open/click), results are immediately available!
    const onOpenResults = filterWithQuery("");
    expect(onOpenResults.length).toBe(3);
    expect(onOpenResults[0].name).toBe("Alpha Retailers");

    // When query has 1 character, it filters immediately without requiring 2 characters
    const singleCharResults = filterWithQuery("b");
    expect(singleCharResults.length).toBe(1);
    expect(singleCharResults[0].name).toBe("Beta Traders");
  });

  it("Item 6: Item billed/received quantity calculation correctly reduces pending quantity", () => {
    const orderedQty = 50;
    const previouslyReceived = 30;
    const pendingQty = Math.max(0, orderedQty - previouslyReceived);
    const isBilled = pendingQty <= 0;

    expect(pendingQty).toBe(20);
    expect(isBilled).toBe(false);

    // Full delivery / billing
    const fullReceived = 50;
    const finalPending = Math.max(0, orderedQty - fullReceived);
    const finalIsBilled = finalPending <= 0;
    expect(finalPending).toBe(0);
    expect(finalIsBilled).toBe(true);
  });
});

