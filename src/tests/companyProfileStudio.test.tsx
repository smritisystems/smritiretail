/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Company Profile Studio Test Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanyProfileStudio } from "../components/setup/CompanyProfileStudio";

// Mock API and local storage
vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn().mockResolvedValue({
    id: "COMP-001",
    name: "Tattly Threads",
    company_code: "COMP-001",
    legal_name: "Tattly Threads Private Limited",
    trade_name: "Tattly Threads Retail",
    business_type: "Private Limited",
    cin: "U74999MH2021PTC123456",
    gst_number: "27AAXFT2508H1ZR",
    gst_scheme: "REGULAR",
    pan: "AAXFT2508H",
    msme_reg_no: "UDYAM-MH-01-0012345",
    reverse_charge_applicable: false,
    address_line1: "Unit 402, Trade World B-Wing",
    address_line2: "Kamala Mills Compound",
    city: "Mumbai",
    state: "Maharashtra",
    state_code: "27",
    pincode: "400013",
    phone: "+91 98200 12345",
    email: "corporate@tattlythreads.com",
    website: "https://www.tattlythreads.com",
    contact_person: "Priya Sharma",
    logo_url: "/tattly_logo_black.png",
    print_logo_url: "/tattly_logo_black.png",
    signature_url: "/signatures/priya_sig.png",
    stamp_url: "/stamps/tattly_seal.png",
    currency_code: "INR",
    timezone: "Asia/Kolkata",
    branches: [
      {
        branch_code: "BR-MAIN-001",
        name: "Flagship Store - Kamala Mills",
        city: "Mumbai",
        state: "Maharashtra",
        is_active: true,
        is_default: true,
      },
    ],
    bank_accounts: [
      {
        bank_name: "STATE BANK OF INDIA",
        account_no: "43976711765",
        ifsc: "SBIN0030425",
        branch: "WARDHMAN NAGAR",
        is_default: true,
        is_active: true,
      },
    ],
  }),
  persistTenantContext: vi.fn(),
  getTenantCompanyContext: vi.fn().mockReturnValue({
    companyId: "COMP-001",
    companyName: "Tattly Threads Private Limited",
    companyGstin: "27AAXFT2508H1ZR",
    companyAddress: "Unit 402, Trade World B-Wing, Mumbai, Maharashtra 400013",
    companyPhone: "+91 98200 12345",
    companyEmail: "corporate@tattlythreads.com",
    companyLogoUrl: "/tattly_logo_black.png",
  }),
}));

describe("CompanyProfileStudio Component Suite", () => {
  it("1. renders studio container with canonical headers and tabs", () => {
    const html = renderToStaticMarkup(<CompanyProfileStudio isOpen={true} />);

    expect(html).toContain("Corporate Profile &amp; Settings");
    expect(html).toContain("Corporate Identity");
    expect(html).toContain("Address &amp; Branches");
    expect(html).toContain("Tax &amp; Statutory (GST)");
    expect(html).toContain("Banking Coordinates");
    expect(html).toContain("Branding &amp; Documents");
    expect(html).toContain("Regional &amp; Localization");
    expect(html).toContain("Change History");
  });

  it("2. does not render DOM elements when isOpen is false", () => {
    const html = renderToStaticMarkup(<CompanyProfileStudio isOpen={false} />);
    expect(html).toBe("");
  });

  it("3. displays statutory GST badges and action controls", () => {
    const html = renderToStaticMarkup(<CompanyProfileStudio isOpen={true} />);
    expect(html).toContain("GST Compliant");
    expect(html).toContain("Save Profile");
    expect(html).toContain("Reset");
  });

  it("4. verifies navigation tab rail and quick context hints", () => {
    const html = renderToStaticMarkup(<CompanyProfileStudio isOpen={true} />);
    expect(html).toContain("Dynamic Resolution");
    expect(html).toContain("Changes here propagate directly to invoices, POS receipts");
  });
});
