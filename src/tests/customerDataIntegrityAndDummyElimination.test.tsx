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
 * Classification: Internal
 * Target Test  : Customer Data Integrity & Dummy Elimination Verification Suite
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CustomerTaxInvoicePreview } from "../components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx";
import { CustomerHierarchyTree } from "../components/customer/corporateWorkspace/CustomerHierarchyTree.tsx";
import { CustomerSummaryCard } from "../components/customer/corporateWorkspace/CustomerSummaryCard.tsx";
import { CorporateNetworkPanel } from "../components/customer/corporateWorkspace/CorporateNetworkPanel.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

describe("Customer Data Integrity & Dummy Elimination Audit", () => {
  const baseCustomer: RetailCustomerRecord = {
    id: "cust-test-001",
    code: "CUST-REAL-001",
    name: "Acme Enterprises Ltd.",
    shortName: "Acme",
    customerType: "Corporate / Enterprise",
    priceGroup: "Standard Retail",
    paymentTerm: "Immediate",
    creditLimit: 0,
    creditDays: 0,
    customerGroupId: "CG-001",
    customer_group_id: "CG-001",
    phone: "9820011223",
    email: "contact@acme.example.com",
    religion: "Other",
    ethnicity: "Asian",
    ageGroup: ">=35 - <45",
    profession: "Corporate",
    profileNotes: "Authoritative customer profile",
    companyCode: "COMP-001",
    environment: "Standard",
    flatFileFormat: "JSON",
    isTaxInclusive: true,
    delimiter: ",",
    buyingFactor: 1.0,
    sellingFactor: 1.0,
    mailingAddresses: [],
    dependants: [],
  };

  it("CustomerSummaryCard renders truthful zero metrics and does not inject fake defaults (12 child, 85 stores, 50L credit)", () => {
    const html = renderToString(
      <CustomerSummaryCard
        customer={baseCustomer}
        childCustomerCount={0}
        totalStoreCount={0}
      />
    );

    // Assert that hardcoded dummy defaults are eliminated
    expect(html).not.toContain("27AABCR1234F1Z5");
    expect(html).not.toContain("AABCR1234F");

    // Assert that truthful zeros and not-registered status are rendered
    expect(html).toContain("0");
    expect(html).toContain("Not Registered");
    expect(html).toContain("Acme Enterprises Ltd.");
    expect(html).toContain("CUST-REAL-001");
  });

  it("CustomerTaxInvoicePreview renders an honest empty state when no invoices exist for customer", () => {
    const html = renderToString(<CustomerTaxInvoicePreview customer={baseCustomer} />);

    // Assert that hardcoded dummy invoice 'TT2026-2027/18' and fake items are completely eliminated
    expect(html).not.toContain("TT2026-2027/18");
    expect(html).not.toContain("15/06/2026");
    expect(html).not.toContain("ART001");
    expect(html).not.toContain("Premium Polo T-Shirt");
    expect(html).not.toContain("Slim Fit Chinos");

    // Assert truthful empty state
    expect(html).toContain("No Posted Tax Invoices");
    expect(html).toContain("CUST-REAL-001");
  });

  it("CustomerTaxInvoicePreview calculates subtotal, GST total, and grand total strictly from real numeric invoice items", () => {
    const realInvoice = {
      invoice_no: "REAL-INV-2026-99",
      date: "2026-10-20",
      customer_name: "Acme Enterprises Ltd.",
      billing_address: "Plot 10, Sector 4, Turbhe, Navi Mumbai - 400705",
      delivery_address: "Store 101, Main Street, Pune - 411001",
      gstin: "27ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      state: "Maharashtra",
      state_code: "27",
      payment_terms: "Immediate",
      grand_total: 2360.00,
      tax_amount: 360.00,
      items: [
        {
          id: "item-1",
          barcode: "8909876543210",
          code: "REAL-SKU-01",
          name: "Industrial Workwear Overall",
          size: "XL",
          quantity: 2,
          price: 1000.00,
          tax_amount: 360.00,
          total_amount: 2360.00,
        },
      ],
    };

    const html = renderToString(
      <CustomerTaxInvoicePreview customer={baseCustomer} invoice={realInvoice} />
    );

    expect(html).toContain("REAL-INV-2026-99");
    expect(html).toContain("REAL-SKU-01");
    expect(html).toContain("Industrial Workwear Overall");
    expect(html).toContain("8909876543210");
    expect(html).toContain("2,360.00");
  });

  it("CustomerHierarchyTree renders honest empty state when customer has no linked child accounts", () => {
    const html = renderToString(
      <CustomerHierarchyTree customer={baseCustomer} childrenNodes={[]} />
    );

    // Hardcoded demo stores must NOT be present
    expect(html).not.toContain("Phoenix Mall");
    expect(html).not.toContain("Inorbit Mall");
    expect(html).not.toContain("Amanora Mall");

    // Honest empty banner must be displayed
    expect(html).toContain("No Child Accounts Linked");
    expect(html).toContain("Parent – Child Hierarchy");
  });

  it("CorporateNetworkPanel returns empty list and does not synthesize fake stores RRL-001..RRL-005", () => {
    const html = renderToString(
      <CorporateNetworkPanel
        customer={baseCustomer}
        onSelectCustomer={() => {}}
      />
    );

    // Hardcoded mock branches must not exist
    expect(html).not.toContain("RRL-001");
    expect(html).not.toContain("RRL-002");
    expect(html).not.toContain("RRL-005");
    expect(html).not.toContain("Phoenix Mall");
    expect(html).not.toContain("DLF Mall");
    expect(html).not.toContain("Orion Mall");
  });

  it("Customer record switching preserves strict identity and never leaks previous customer details", () => {
    const customerA: RetailCustomerRecord = {
      ...baseCustomer,
      id: "cust-a",
      code: "CUST-A",
      name: "Alpha Retailers",
      gstin: "27AAAAA1111A1Z1",
      creditLimit: 150000,
    };

    const customerB: RetailCustomerRecord = {
      ...baseCustomer,
      id: "cust-b",
      code: "CUST-B",
      name: "Beta Traders",
      gstin: "29BBBBB2222B1Z2",
      creditLimit: 450000,
    };

    const htmlA = renderToString(<CustomerSummaryCard customer={customerA} childCustomerCount={1} totalStoreCount={2} />);
    const htmlB = renderToString(<CustomerSummaryCard customer={customerB} childCustomerCount={0} totalStoreCount={0} />);

    expect(htmlA).toContain("Alpha Retailers");
    expect(htmlA).toContain("CUST-A");
    expect(htmlA).toContain("27AAAAA1111A1Z1");
    expect(htmlA).not.toContain("Beta Traders");
    expect(htmlA).not.toContain("29BBBBB2222B1Z2");

    expect(htmlB).toContain("Beta Traders");
    expect(htmlB).toContain("CUST-B");
    expect(htmlB).toContain("29BBBBB2222B1Z2");
    expect(htmlB).not.toContain("Alpha Retailers");
    expect(htmlB).not.toContain("27AAAAA1111A1Z1");
  });
});
