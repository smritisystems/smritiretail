/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.13
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Staff Print Center Verification Suite
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
import StaffPrintModal from "../components/staff/StaffPrintModal";
import type { User } from "../types";

describe("Staff Print Center Architecture Suite", () => {
  const dummyStaff: User = {
    id: "usr-101",
    userId: "usr-101",
    employeeId: "EMP-2026-088",
    employeeCode: "SMR-EMP-088",
    username: "rohit.verma",
    passwordHash: "hash",
    role: "Store Manager",
    status: "Active",
    photo: "",
    fullName: "Rohit Verma",
    displayName: "Rohit",
    gender: "Male",
    dateOfBirth: "1992-05-14",
    mobile: "+91-9876543210",
    email: "rohit.verma@smritibooks.com",
    emergencyContact: "+91-9876543211",
    address: "Flat 402, Sunshine Heights, Linking Road",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pinCode: "400050",
    department: "Retail Operations",
    designation: "Senior Store Manager",
    branch: "Mumbai Flagship Store",
    dateOfJoining: "2024-01-15",
    reportingManager: "Vikram Malhotra",
    employmentType: "Permanent",
    allowedBranches: ["Mumbai Flagship Store"],
    payment: {
      accountHolderName: "Rohit Verma",
      bankName: "State Bank of India",
      accountNumber: "320011223344",
      ifscCode: "SBIN0001234",
      panNumber: "ABCDE1234F",
      providentFundUan: "100987654321",
      esicNumber: "3100998877",
    },
  };

  beforeEach(() => {
    storageMap.clear();
    localStorage.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    storageMap.clear();
    localStorage.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("1. returns null when modal is not open (isOpen=false)", () => {
    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={false}
        onClose={() => {}}
        staff={dummyStaff}
      />
    );
    expect(html).toBe("");
  });

  it("2. strictly blocks printing when statutory company identity is not configured", () => {
    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={true}
        onClose={() => {}}
        staff={dummyStaff}
        customCompanyName=""
      />
    );

    expect(html).toContain('data-testid="print-blocked-container"');
    expect(html).toContain("Print Blocked: Statutory Identity Missing");
    expect(html).not.toContain("EMPLOYEE REGISTRATION &amp; REMITTANCE MANDATE");
  });

  it("3. unblocks printing and renders staff form when statutory company identity is present", () => {
    persistTenantContext({
      companyId: "COMP-001",
      companyName: "Tattly Threads Private Limited",
      companyAddress: "Ibrahim Rehmatulla Road, Mumbai",
      companyGstin: "27AAXFT2508H1ZR",
    });

    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={true}
        onClose={() => {}}
        staff={dummyStaff}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    expect(html).not.toContain('data-testid="print-blocked-container"');
    expect(html).toContain("Tattly Threads Private Limited");
    expect(html).toContain("Rohit Verma");
    expect(html).toContain("EMP-2026-088");
    expect(html).toContain("Senior Store Manager");
  });

  it("4. embeds @media print CSS with #root { display: none !important; } and modal positioning", () => {
    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={true}
        onClose={() => {}}
        staff={dummyStaff}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    // Verify architectural print rules that prevent blank print preview
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain(".staff-print-modal-root");
    expect(html).toContain("position: static !important");
    expect(html).toContain(".staff-print-toolbar");
    expect(html).toContain(".staff-print-canvas-wrapper");
  });

  it("5. renders filled staff registration details in With Data mode", () => {
    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={true}
        onClose={() => {}}
        staff={dummyStaff}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    expect(html).toContain("Rohit Verma");
    expect(html).toContain("SMR-EMP-088");
    expect(html).toContain("Retail Operations");
    expect(html).toContain("Senior Store Manager");
    expect(html).toContain("State Bank of India");
    expect(html).toContain("320011223344");
    expect(html).toContain("SBIN0001234");
  });

  it("6. renders print button with correct test identifiers and state", () => {
    const html = renderToStaticMarkup(
      <StaffPrintModal
        isOpen={true}
        onClose={() => {}}
        staff={dummyStaff}
        customCompanyName="Tattly Threads Private Limited"
      />
    );

    expect(html).toContain('id="btn-trigger-print"');
    expect(html).toContain("Print");
  });
});
