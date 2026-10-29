/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.12
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Vendor Form Print & Export Studio Verification Suite
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

import { persistTenantContext } from "../lib/apiFetchV1";
import { VendorPrintModal } from "../components/vendor/VendorPrintModal";
import type { VendorDetail } from "../types/vendor";

describe("Vendor Form Print & Export Studio Architecture Suite", () => {
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
      supplierType: "MANUFACTURER",
      paymentTermsDays: 45,
      msmeCategory: "SMALL",
      commercialClassification: "APPROVED",
      tdsRate: 0.1,
      taxTreatment: "REGULAR",
      outstandingLiability: 125000,
      deliveryTerms: "Door Delivery",
      freightTerms: "Paid by Supplier",
      paymentTerms: "45 Days",
    },
    compliance: {
      gstin: "27AAACA1234A1Z5",
      pan: "AAACA1234A",
      msmeRegistrationNo: "UDYAM-MH-03-0012345",
      msmeCategory: "SMALL",
      verificationFlags: {
        gstVerified: true,
        panVerified: true,
        bankVerified: true,
        msmeVerified: true,
      },
    },
    bankAccounts: [
      {
        id: "bank-1",
        bankName: "HDFC Bank Ltd",
        accountHolderName: "Apex Fabrics & Textile Mills Ltd",
        accountNumber: "50200012345678",
        ifsc: "HDFC0000123",
        branch: "Kandivali West Branch",
        accountType: "CURRENT",
        isPrimary: true,
        verificationStatus: "VERIFIED",
      },
    ],
    addresses: [
      {
        id: "addr-1",
        addressType: "REGISTERED_OFFICE",
        addressLine1: "Bhaweshwari Chawl, Opp. Shiv Mandir, Gandhi Nagar, Laljipada",
        addressLine2: "New Link Road, Kandivali West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400067",
        country: "India",
        isPrimary: true,
      },
    ],
    contacts: [
      {
        id: "cont-1",
        contactName: "Rajesh Sharma",
        contactCategory: "SALES",
        designation: "VP Institutional Sales",
        department: "Procurement & Dispatch",
        mobile: "+91-9820011223",
        email: "rsharma@apexfabrics.com",
        isPrimary: true,
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    localStorage.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("1. returns null when modal is not open (isOpen=false)", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={false}
        onClose={() => {}}
        vendor={dummyVendor}
      />
    );
    expect(html).toBe("");
  });

  it("2. strictly blocks printing when statutory company identity is not configured", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
        customCompanyName=""
      />
    );

    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("Print Blocked: Statutory Identity Missing");
    expect(html).not.toContain('class="vendor-printable-sheet');
  });

  it("3. unblocks printing and renders document sheet when statutory company identity is present", () => {
    persistTenantContext({
      companyId: "COMP-001",
      companyName: "Tattly Threads Private Limited",
      companyAddress: "Ibrahim Rehmatulla Road, Mumbai",
      companyGstin: "27AAXFT2508H1ZR",
    });

    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
        initialWithData={true}
      />
    );

    expect(html).not.toContain('data-testid="print-blocked-container"');
    expect(html).toContain("vendor-printable-sheet");
    expect(html).toContain("Tattly Threads Private Limited");
    expect(html).toContain("Apex Fabrics &amp; Textile Mills Ltd");
    expect(html).toContain("KYC-VEND-VEND-101");
  });

  it("4. embeds @media print CSS with #root { display: none !important; } and modal positioning", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    // Verify key architectural print rules that prevent blank print preview
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain(".vendor-print-modal-root");
    expect(html).toContain("position: static !important");
    expect(html).toContain(".vendor-print-toolbar");
    expect(html).toContain(".vendor-printable-sheet");
  });

  it("5. renders filled vendor dossier in With Data mode", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
        initialWithData={true}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    // Verify vendor details in filled document
    expect(html).toContain("Apex Fabrics &amp; Textile Mills Ltd");
    expect(html).toContain("27AAACA1234A1Z5");
    expect(html).toContain("AAACA1234A");
    expect(html).toContain("HDFC Bank Ltd");
    expect(html).toContain("50200012345678");
    expect(html).toContain("Rajesh Sharma");
    expect(html).toContain("Bhaweshwari Chawl");
    expect(html).toContain("45 Days (Net)");
    expect(html).toContain("APPROVED");
  });

  it("6. renders blank onboarding application form when without data", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={null}
        initialWithData={false}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    expect(html).toContain("SMRITI-KYC-BLANK-V2");
    expect(html).toContain("Standard Blank Onboarding");
    expect(html).toContain("Vendor Onboarding &amp; Statutory KYC Registration Form");
    expect(html).toContain("Permanent Account Number (PAN)");
    expect(html).toContain("Goods &amp; Services Tax Identification Number (GSTIN)");
  });

  it("7. renders print button with enabled state and correct testid", () => {
    const html = renderToStaticMarkup(
      <VendorPrintModal
        isOpen={true}
        onClose={() => {}}
        vendor={dummyVendor}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    expect(html).toContain('data-testid="vendor-print-btn"');
    expect(html).toContain("Print Document");
  });
});
