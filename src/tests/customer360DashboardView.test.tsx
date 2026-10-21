/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Corporate Customer 360 Test Suite
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Customer360DashboardView } from "../components/customer/corporate360/Customer360DashboardView.tsx";
import { CorporateCustomerTabs } from "../components/customer/corporate360/CorporateCustomerTabs.tsx";
import { Customer } from "../types.ts";

const sampleCustomer: Customer = {
  id: "cust-rrl-192b561d",
  code: "REL001",
  name: "Reliance Retail Limited",
  legal_name: "Reliance Retail Limited",
  display_name: "Reliance Retail",
  customer_type: "Corporate / Enterprise",
  is_active: true,
  is_deleted: false,
  company_id: "COMP-001",
  created_at: "2018-04-01T00:00:00Z",
  modified_at: "2026-10-20T00:00:00Z",
  territory: "West India",
  gst_number: "27AABCR1234F1Z5",
  pan: "AABCR1234F",
  payment_terms: "30 Days",
  credit_limit: 50000000,
  credit_days: 30,
  outstanding: 21543250,
  childCount: 12,
  storesCount: 85,
  currency: "INR",
  address_line1: "3rd Floor, Corporate Office, MMRDA Building, Bandra-Kurla Complex",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400051",
  metadata_json: {
    iec: "IEC1234567",
    sales_person: "Corporate Sales",
  },
  delivery_locations: [
    { id: "s1", store_code: "REL-MUM-001", location_name: "Phoenix Mall", city: "Mumbai", state: "Maharashtra", location_type: "Store", status: "Active" },
    { id: "s2", store_code: "REL-MUM-002", location_name: "Inorbit Mall", city: "Mumbai", state: "Maharashtra", location_type: "Store", status: "Active" },
    { id: "s3", store_code: "REL-PUN-001", location_name: "Amanora Mall", city: "Pune", state: "Maharashtra", location_type: "Store", status: "Active" },
    { id: "s4", store_code: "REL-AHM-001", location_name: "AlphaOne Mall", city: "Ahmedabad", state: "Gujarat", location_type: "Store", status: "Active" },
    { id: "s5", store_code: "REL-BLR-001", location_name: "Orion Mall", city: "Bangalore", state: "Karnataka", location_type: "Store", status: "Inactive" },
  ],
  dependants: [
    { id: "cc1", code: "REL001-001", name: "Reliance - Phoenix Mall", storeCode: "REL-MUM-001", city: "Mumbai", status: "Active", storesCount: 12 },
    { id: "cc2", code: "REL001-002", name: "Reliance - Inorbit Mall", storeCode: "REL-MUM-002", city: "Mumbai", status: "Active", storesCount: 8 },
    { id: "cc3", code: "REL001-003", name: "Reliance - Amanora Mall", storeCode: "REL-PUN-001", city: "Pune", status: "Active", storesCount: 10 },
    { id: "cc4", code: "REL001-004", name: "Reliance - AlphaOne", storeCode: "REL-AHM-001", city: "Ahmedabad", status: "Active", storesCount: 15 },
    { id: "cc5", code: "REL001-005", name: "Reliance - Orion Mall", storeCode: "REL-BLR-001", city: "Bangalore", status: "Inactive", storesCount: 5 },
  ],
};

describe("Customer 360° Dashboard View & Navigation Tests", () => {
  it("renders page title and action buttons (< Back, Save, Save & New, Duplicate, Deactivate, More)", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    expect(html).toContain("Customer 360° Dashboard");
    expect(html).toContain("REL001");
    expect(html).toContain("Back");
    expect(html).toContain("Save");
    expect(html).toContain("Save &amp; New");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Deactivate");
    expect(html).toContain("More");
  });

  it("renders all 11 horizontal navigation tabs in the tab strip", () => {
    const onTabChange = vi.fn();
    const html = renderToStaticMarkup(
      <CorporateCustomerTabs activeTab="overview" onTabChange={onTabChange} />
    );

    expect(html).toContain("Overview");
    expect(html).toContain("Basic Details");
    expect(html).toContain("Corporate &amp; Tax");
    expect(html).toContain("Addresses");
    expect(html).toContain("Parent – Child");
    expect(html).toContain("Stores / Outlets");
    expect(html).toContain("Commercial Terms");
    expect(html).toContain("PSV Stock");
    expect(html).toContain("Sales &amp; Invoices");
    expect(html).toContain("Contacts &amp; Documents");
    expect(html).toContain("Activity &amp; Audit");
  });

  it("renders the persistent Hero Banner with customer name, 3 pills, and 5 KPI cards", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    // Customer Name & Code
    expect(html).toContain("Reliance Retail Limited");
    expect(html).toContain("REL001");

    // 3 Badges / Pills
    expect(html).toContain("Corporate / Enterprise");
    expect(html).toContain("Parent");
    expect(html).toContain("Key Account");

    // 5 KPI cards
    expect(html).toContain("12");
    expect(html).toContain("Child Customers");
    expect(html).toContain("85");
    expect(html).toContain("Stores / Outlets");
    expect(html).toContain("5,00,00,000");
    expect(html).toContain("Credit Limit");
    expect(html).toContain("2,15,43,250");
    expect(html).toContain("Outstanding");
  });

  it("renders Cards 1, 2, 3 with form inputs and [Edit] buttons", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    // Card 1
    expect(html).toContain("Basic Details");
    expect(html).toContain("Customer Code");
    expect(html).toContain("Customer Name");
    expect(html).toContain("Display Name");
    expect(html).toContain("Type of Customer");
    expect(html).toContain("Relationship Type");
    expect(html).toContain("Business Category");

    // Card 2
    expect(html).toContain("Corporate Identity &amp; Tax");
    expect(html).toContain("Legal Name");
    expect(html).toContain("27AABCR1234F1Z5");
    expect(html).toContain("AABCR1234F");
    expect(html).toContain("IEC1234567");
    expect(html).toContain("Registered Address");

    // Card 3
    expect(html).toContain("Commercial Terms");
    expect(html).toContain("Default Price List");
    expect(html).toContain("Payment Terms");
  });

  it("renders Card 4 Addresses with pills (Billing, Delivery, Registered) and table", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    expect(html).toContain("Addresses");
    expect(html).toContain("Billing (2)");
    expect(html).toContain("Delivery (5)");
    expect(html).toContain("Registered Office (1)");
    expect(html).toContain("Head Office");
    expect(html).toContain("Regional Office");
  });

  it("renders Card 5 Store / Outlet Network and Card 6 Contacts", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    // Card 5 Stores
    expect(html).toContain("Store / Outlet Network");
    expect(html).toContain("REL-MUM-001");
    expect(html).toContain("Phoenix Mall");
    expect(html).toContain("Inorbit Mall");

    // Card 6 Contacts
    expect(html).toContain("Contacts");
    expect(html).toContain("Amit Sharma");
    expect(html).toContain("Purchase Head");
    expect(html).toContain("Neha Verma");
    expect(html).toContain("Rajiv Mehta");
  });

  it("renders Card 7 Child Customers, Card 8 Documents, and Card 9 Invoices", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    // Card 7
    expect(html).toContain("Child Customers (5)");
    expect(html).toContain("REL001-001");
    expect(html).toContain("Reliance - Phoenix Mall");

    // Card 8
    expect(html).toContain("Documents &amp; Notes");
    expect(html).toContain("GST Registration.pdf");
    expect(html).toContain("MSA_Reliance.pdf");

    // Card 9
    expect(html).toContain("Sales &amp; Invoices");
    expect(html).toContain("TT2026-2027/18");
    expect(html).toContain("5,990.00");
  });

  it("renders the 4 Right Sidebar cards: Summary, Hierarchy Tree, PSV Summary, Recent Activity", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    // Summary Card
    expect(html).toContain("Default Price List:");
    expect(html).toContain("Total Stores / Outlets:");
    expect(html).toContain("Relationship Since:");

    // Hierarchy Tree Card
    expect(html).toContain("Parent – Child Hierarchy");
    expect(html).toContain("Reliance Retail Limited (Parent)");
    expect(html).toContain("Phoenix Mall");
    expect(html).toContain("Inorbit Mall");
    expect(html).toContain("Amanora Mall");

    // PSV Summary (6 colorful metric tiles)
    expect(html).toContain("PSV Stock Visibility (Summary)");
    expect(html).toContain("5,420");
    expect(html).toContain("Document Qty");
    expect(html).toContain("5,180");
    expect(html).toContain("Received Qty");
    expect(html).toContain("4,980");
    expect(html).toContain("Approved Qty");
    expect(html).toContain("240");
    expect(html).toContain("Pending Approval");
    expect(html).toContain("120");
    expect(html).toContain("Shortage");
    expect(html).toContain("80");
    expect(html).toContain("Excess");

    // Recent Activity Card
    expect(html).toContain("Recent Activity");
    expect(html).toContain("Store Linked");
    expect(html).toContain("Address Updated");
    expect(html).toContain("Credit Limit Changed");
    expect(html).toContain("Document Uploaded");
  });

  it("renders Card 10 PSV Stock Visibility (Detailed) with 10 filter controls and 16-column table", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} />
    );

    expect(html).toContain("PSV Stock Visibility (Detailed)");
    expect(html).toContain("Party");
    expect(html).toContain("Child Customer");
    expect(html).toContain("Store / Outlet");
    expect(html).toContain("Article / Style");
    expect(html).toContain("Color");
    expect(html).toContain("Size");
    expect(html).toContain("Status");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).toContain("Search");
    expect(html).toContain("Reset");

    // Detailed Table Columns & Rows
    expect(html).toContain("Doc No.");
    expect(html).toContain("Barcode");
    expect(html).toContain("PO-2026-001");
    expect(html).toContain("PO-2026-002");
    expect(html).toContain("PO-2026-003");
    expect(html).toContain("PO-2026-004");
    expect(html).toContain("PO-2026-005");
    expect(html).toContain("8901234567890");
    expect(html).toContain("8901234567891");

    // Pagination
    expect(html).toContain("Showing 1-5 of 125 records");
    expect(html).toContain("Rows per page");
  });

  it("renders dedicated Basic Details tab when initialTab='basic'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="basic" />
    );

    expect(html).toContain("Basic Details — Master Account Profile");
    expect(html).toContain("Customer Code");
    expect(html).toContain("System Record ID");
    expect(html).toContain("cust-rrl-192b561d");
  });

  it("renders dedicated Corporate & Tax tab when initialTab='corporate_tax'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="corporate_tax" />
    );

    expect(html).toContain("Corporate Identity &amp; Statutory Tax Compliance");
    expect(html).toContain("Multi-State GST Registrations (3 States Linked)");
    expect(html).toContain("Add GSTIN Registration");
    expect(html).toContain("27AABCR1234F1Z5");
    expect(html).toContain("24AABCR1234F1Z3");
    expect(html).toContain("29AABCR1234F1Z1");
  });

  it("renders dedicated Addresses tab when initialTab='addresses'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="addresses" />
    );

    expect(html).toContain("Multi-Location Address Directory (8 Configured Addresses)");
    expect(html).toContain("Billing (2)");
    expect(html).toContain("Delivery (5)");
    expect(html).toContain("Registered (1)");
    expect(html).toContain("Head Office");
  });

  it("renders dedicated Parent – Child tab when initialTab='parent_child'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="parent_child" />
    );

    expect(html).toContain("Parent – Child Corporate Account Network");
    expect(html).toContain("Reliance Retail Limited (Parent)");
    expect(html).toContain("Child Accounts Roster (5 Active Branches)");
    expect(html).toContain("REL001-001");
    expect(html).toContain("Link Child Customer");
  });

  it("renders dedicated Stores / Outlets tab when initialTab='stores'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="stores" />
    );

    expect(html).toContain("Modern Trade Stores &amp; Outlets Network");
    expect(html).toContain("Search store code or city...");
    expect(html).toContain("REL-MUM-001");
    expect(html).toContain("Phoenix Mall");
  });

  it("renders dedicated Commercial Terms tab when initialTab='commercial'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="commercial" />
    );

    expect(html).toContain("Commercial Terms, Pricing &amp; Credit Exposure");
    expect(html).toContain("Total Credit Limit");
    expect(html).toContain("5,00,00,000");
    expect(html).toContain("2,15,43,250");
    expect(html).toContain("Save Terms");
  });

  it("renders dedicated PSV Stock tab when initialTab='psv'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="psv" />
    );

    expect(html).toContain("SMRITI PSV (Party Stock Visibility) — Live Reconciliation Stream");
    expect(html).toContain("5,420");
    expect(html).toContain("Shortage");
    expect(html).toContain("Excess");
    expect(html).toContain("Document Qty");
    expect(html).toContain("PO-2026-001");
  });

  it("renders dedicated Sales & Invoices tab when initialTab='sales_invoices'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="sales_invoices" />
    );

    expect(html).toContain("Sales Tax Invoices &amp; Transaction History (4 Invoices)");
    expect(html).toContain("Export Ledger");
    expect(html).toContain("TT2026-2027/18");
    expect(html).toContain("TT2026-2027/17");
    expect(html).toContain("5,990.00");
  });

  it("renders dedicated Contacts & Documents tab when initialTab='contacts_docs'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="contacts_docs" />
    );

    expect(html).toContain("Key Contacts Directory");
    expect(html).toContain("Document Vault &amp; KYC");
    expect(html).toContain("Amit Sharma");
    expect(html).toContain("GST Registration.pdf");
    expect(html).toContain("Upload");
  });

  it("renders dedicated Activity & Audit tab when initialTab='activity_audit'", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={sampleCustomer} initialTab="activity_audit" />
    );

    expect(html).toContain("Tamper-Evident Activity &amp; Audit History");
    expect(html).toContain("SHA-256 Chain Verified");
    expect(html).toContain("Store Linked");
    expect(html).toContain("Address Updated");
    expect(html).toContain("Audit Hash:");
  });
});

describe("Customer 360° Authoritative Data Integrity & Dynamic Reconciliation Audit", () => {
  const authoritativeRelianceCustomer = {
    id: "cust-rrl-192b561d",
    code: "RRL-001",
    name: "Reliance Retail Limited",
    customer_type: "Corporate B2B",
    gst_number: "27AABCR1718E1ZP",
    pan_number: "AABCR1718E",
    credit_limit: 99999999,
    outstanding: 0,
    credit_days: 90,
    delivery_locations: Array.from({ length: 68 }, (_, i) => ({
      id: `dl-${i + 1}`,
      store_code: `STR-${1000 + i}`,
      location_name: `Reliance Store ${i + 1}`,
      city: "Mumbai",
      status: "Active",
    })),
    dependants: [
      { id: "dep-1", name: "Reliance Smart", code: "RRL-SMT-001", city: "Mumbai", storesCount: 25 },
      { id: "dep-2", name: "Reliance Trends", code: "RRL-TRN-001", city: "Pune", storesCount: 30 },
      { id: "dep-3", name: "Reliance Digital", code: "RRL-DIG-001", city: "Bangalore", storesCount: 13 },
    ],
    metadata_json: {},
    relationship_since: "2018-04-01T00:00:00Z",
  };

  it("resolves authentic PAN matching characters 3-12 of GSTIN and indicates match", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    // PAN must be AABCR1718E (from pan_number), NOT dummy fallback AABCR1234F
    expect(html).toContain('value="AABCR1718E"');
    expect(html).not.toContain('value="AABCR1234F"');
    expect(html).toContain("27AABCR1718E1ZP");
    expect(html).toContain("Matches GSTIN");
  });

  it("reconciles credit limit between summary card and right sidebar with Indian formatting", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    // Both cards must show ₹ 9,99,99,999, eliminating the ₹5,00,00,000 vs ₹99,99,999 discrepancy
    const occurrences = (html.match(/9,99,99,999/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(html).toContain("9,99,99,999");
  });

  it("reconciles outstanding amount across summary card and detail panel", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    // Outstanding must be 0, eliminating fabricated ₹ 2,15,43,250
    expect(html).not.toContain("2,15,43,250");
    expect(html).toContain("₹ 0");
  });

  it("dynamically displays actual stores count (68) and child accounts count (3)", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    // Dynamic store network count = 68, child count = 3
    expect(html).toContain("68");
    expect(html).toContain("3");
    expect(html).toContain("68 Total Outlets");
  });

  it("displays empty IEC without fabricating placeholder string", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    expect(html).not.toContain("IEC1234567");
    expect(html).toContain('placeholder="Not Registered"');
  });

  it("renders dynamic hierarchy cards from actual child accounts", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={authoritativeRelianceCustomer} />
    );

    expect(html).toContain("Reliance Smart");
    expect(html).toContain("Reliance Trends");
    expect(html).toContain("Reliance Digital");
  });
});

describe("Customer 360° Remediation Regression Suite (Tenant Isolation, Soft-Delete, Financials, Trailing Trend)", () => {
  const corporateWithSoftDeletes = {
    id: "cust-rrl-192b561d",
    code: "RRL-001",
    name: "Reliance Retail Limited",
    customer_type: "Corporate / Enterprise",
    gst_number: "27AABCR1718E1ZP",
    credit_limit: 100000,
    outstanding: 155.24,
    dependants: [], // Direct single-tier account (0 child accounts)
    delivery_locations: [
      // 3 Distribution Centers / Logistics Hubs
      { id: "dl-dc-1", store_code: "S4NN/8319", location_name: "Tumkur DC", city: "Tumkur", state: "Karnataka", location_type: "Distribution Center", status: "Active", is_deleted: false },
      { id: "dl-dc-2", store_code: "TA0A", location_name: "Sankrail DC", city: "Howrah", state: "West Bengal", location_type: "Distribution Center", status: "Active", is_deleted: false },
      { id: "dl-dc-3", store_code: "V051", location_name: "Sultanpur NDC", city: "Gurgaon", state: "Haryana", location_type: "Distribution Center", status: "Active", is_deleted: false },
      // 4 Retail Outlets
      { id: "dl-rt-1", store_code: "T9IM", location_name: "Koramangala Store", city: "Bangalore", state: "Karnataka", location_type: "Store", status: "Active", is_deleted: false },
      { id: "dl-rt-2", store_code: "TEST-BLR-001", location_name: "Bangalore Store", city: "Bangalore", state: "Karnataka", location_type: "Store", status: "Active", is_deleted: false },
      { id: "dl-rt-3", store_code: "TEST-HYD-001", location_name: "Hyderabad Store", city: "Hyderabad", state: "Telangana", location_type: "Store", status: "Active", is_deleted: false },
      { id: "dl-rt-4", store_code: "TEST-MUM-001", location_name: "Mumbai Store", city: "Mumbai", state: "Maharashtra", location_type: "Store", status: "Active", is_deleted: false },
      // Soft-deleted locations (Must NOT be counted or displayed)
      { id: "dl-del-1", store_code: "DEL-OLD-001", location_name: "Deleted Mall Outlet", city: "Pune", state: "Maharashtra", location_type: "Store", status: "Active", is_deleted: true },
      { id: "dl-del-2", store_code: "DEL-OLD-002", location_name: "Closed Hub", city: "Nagpur", state: "Maharashtra", location_type: "Distribution Center", status: "Active", isDeleted: true },
    ],
  };

  it("excludes soft-deleted delivery locations from active and total store counts", () => {
    const htmlOverview = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} />
    );

    // Only 7 active non-deleted stores should be counted in KPI and sidebar (3 DCs + 4 Stores)
    expect(htmlOverview).toContain("Stores / Outlets");
    expect(htmlOverview).toContain("7 Total Outlets");
    expect(htmlOverview).not.toContain("DEL-OLD-001");
    expect(htmlOverview).not.toContain("DEL-OLD-002");
    expect(htmlOverview).not.toContain("Deleted Mall Outlet");
    expect(htmlOverview).not.toContain("Closed Hub");

    const htmlStores = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} initialTab="stores" />
    );
    expect(htmlStores).toContain("Modern Trade Stores &amp; Outlets Network (7 Active)");
    expect(htmlStores).not.toContain("DEL-OLD-001");
  });

  it("renders authentic empty state for direct single-tier corporate accounts with 0 child customers", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} />
    );

    // Hero KPI 1 must display 0 Child Customers
    expect(html).toContain("Child Customers");
    // Card 7 child roster must render authentic single-tier empty state, not mock Phoenix Mall
    expect(html).toContain("Direct Single-Tier Account — 0 Child Accounts");
    // Right sidebar hierarchy tree must display single-tier account node
    expect(html).toContain("Direct Single-Tier Account (0 Child Entities Enrolled)");
  });

  it("binds authoritative credit limit (₹ 1,00,000) without hardcoded prototype fallbacks", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} />
    );

    // Must show ₹ 1,00,000 from customer group / authoritative mapping
    expect(html).toContain("1,00,000");
    // Prototype fallback ₹ 5,00,00,000 must NOT be present
    expect(html).not.toContain("5,00,00,000");
  });

  it("reconciles revolving credit ledger exposure (₹ 155.24) preserving financial semantics", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} />
    );

    // Credit ledger balance must reflect ₹ 155.24
    expect(html).toContain("155.24");
    // Fabricated prototype outstanding ₹ 2,15,43,250 must never appear
    expect(html).not.toContain("2,15,43,250");
  });

  it("renders distinct Distribution Centers and Retail Stores in the dedicated Stores tab", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} initialTab="stores" />
    );

    expect(html).toContain("Modern Trade Stores &amp; Outlets Network (7 Active)");
    expect(html).toContain("Tumkur DC");
    expect(html).toContain("S4NN/8319");
    expect(html).toContain("Sankrail DC");
    expect(html).toContain("TA0A");
    expect(html).toContain("Koramangala Store");
    expect(html).toContain("T9IM");
    // Soft-deleted locations must NOT be in the table
    expect(html).not.toContain("DEL-OLD-001");
  });

  it("displays 'Awaiting Trend' empty state when insufficient purchase history exists", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={corporateWithSoftDeletes} />
    );

    // When no trend data is supplied, the 7 dummy sparkline bars must NOT be fabricated
    expect(html).toContain("Awaiting Trend");
  });
});
