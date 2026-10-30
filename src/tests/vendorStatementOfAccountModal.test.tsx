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
 * Classification: Vendor Statement of Account (SOA) Print & Ledger Verification Suite
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

(globalThis as any).localStorage = localStorageMock;
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: localStorageMock,
  };
} else {
  (globalThis as any).window.localStorage = localStorageMock;
}

import { VendorStatementOfAccountModal } from "../components/vendor/tabs/VendorStatementOfAccountModal";
import type { VendorDetail } from "../types/vendor";

describe("Vendor Statement of Account (SOA) Print Architecture Suite", () => {
  const dummyVendor: VendorDetail = {
    id: "vend-101",
    code: "VEND-101",
    legalName: "Apex Fabrics & Textile Mills Ltd",
    tradeName: "Apex Fabrics",
    partyType: "SUPPLIER",
    gstin: "27AAACA1234A1Z5",
    pan: "AAACA1234A",
    email: "compliance@apexfabrics.com",
    phone: "+91-22-28001122",
    mobile: "+91-9820011223",
    addressLine1: "Bhaweshwari Chawl, Opp. Shiv Mandir, Gandhi Nagar",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400067",
    status: "ACTIVE",
    commercial: {
      creditDays: 30,
      creditLimit: 500000,
      currency: "INR",
      paymentTerms: "Net 30 Days",
      tdsApplicable: true,
      tdsSection: "194C",
      msmeRegistered: false,
    },
    bankAccounts: [
      {
        id: "bank-1",
        accountHolderName: "Apex Fabrics & Textile Mills Ltd",
        accountNumber: "918020011223344",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank",
        branchName: "Kandivali West Branch",
        isPrimary: true,
        accountType: "CURRENT",
      },
    ],
  };

  it("1. returns empty markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <VendorStatementOfAccountModal
        isOpen={false}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );
    expect(html).toBe("");
  });

  it("2. renders modal shell and vendor identity when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <VendorStatementOfAccountModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );

    expect(html).toContain("vendor-soa-modal-root");
    expect(html).toContain("Vendor Statement of Account (SOA)");
    expect(html).toContain("Account 2010 Audit");
    expect(html).toContain("Apex Fabrics");
    expect(html).toContain("VEND-101");
  });

  it("3. embeds @media print CSS with #root { display: none !important; } and unrolled static flow", () => {
    const html = renderToStaticMarkup(
      <VendorStatementOfAccountModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );

    expect(html).toContain("@media print");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain(".vendor-soa-modal-root");
    expect(html).toContain("position: static !important");
    expect(html).toContain(".vendor-soa-toolbar");
    expect(html).toContain(".vendor-soa-canvas-wrapper");
    expect(html).toContain(".vendor-soa-sheet-wrapper");
    expect(html).toContain(".vendor-soa-printable-content");
  });

  it("4. excludes toolbars and filter controls from print via vendor-soa-toolbar class", () => {
    const html = renderToStaticMarkup(
      <VendorStatementOfAccountModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );

    expect(html).toContain("vendor-soa-toolbar");
    expect(html).toContain("Print / PDF");
    expect(html).toContain("Export CSV");
  });

  it("5. renders authoritative double-entry reconciliation audit footer", () => {
    const html = renderToStaticMarkup(
      <VendorStatementOfAccountModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );

    expect(html).toContain("Authoritative Double-Entry Reconciliation Verified");
    expect(html).toContain("Prepared By: Accounts Payable Manager");
    expect(html).toContain("Vendor Acknowledgment &amp; Seal");
  });
});
