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
 * Target Test  : Unit & Integration Tests for Enterprise Customer Master Reference Layout
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { EnterpriseCustomerMasterView } from "../components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx";
import { CustomerHierarchyTree } from "../components/customer/corporateWorkspace/CustomerHierarchyTree.tsx";
import { CustomerSummaryCard } from "../components/customer/corporateWorkspace/CustomerSummaryCard.tsx";
import { CustomerTaxInvoicePreview } from "../components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx";
import { CustomerMasterSideNav } from "../components/customer/corporateWorkspace/CustomerMasterSideNav.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

const MOCK_CUSTOMER: RetailCustomerRecord = {
  id: "cust-rel-001",
  code: "REL001",
  name: "Reliance Retail Limited",
  shortName: "Reliance Retail",
  priceGroup: "Reliance Corporate",
  customerGroupId: "Corporate Accounts",
  customer_group_id: "Corporate Accounts",
  phone: "9876543210",
  email: "corporate@reliance.com",
  religion: "Other",
  ethnicity: "Asian",
  ageGroup: ">=35 - <45",
  profession: "Enterprise",
  customerType: "Corporate / Enterprise",
  profileNotes: "Enterprise key account profile",
  companyCode: "COMP-001",
  environment: "Corporate",
  flatFileFormat: "JSON Format",
  isTaxInclusive: true,
  delimiter: ",",
  buyingFactor: 1.0,
  sellingFactor: 1.0,
  mailingAddresses: [
    {
      code: "001",
      contactPerson: "Head Office",
      address1: "3rd Floor, MMRDA Building, BKC",
      locality: "Bandra-Kurla Complex",
      city: "Mumbai",
      postalCode: "400051",
      state: "Maharashtra",
      zone: "West India",
      country: "India",
      officePhone: "",
      homePhone: "",
      mobilePhone: "9876543210",
      faxNumber: "",
      email1: "corporate@reliance.com",
      email2: "",
      email3: "",
      isDefault: true,
      addressType: "mailing"
    }
  ],
  isDependant: false,
  primaryAccountCode: "",
  primaryAccountName: "",
  applyParentMailingInfo: false,
  dependants: [],
  gender: "Other",
  dateOfBirth: "1990-01-01",
  isMarried: false,
  weddingAnniversary: "",
  loyaltyPgmId: "L-001",
  loyaltyPgmCode: "CORP-LOYALTY",
  loyaltyTier: "Platinum",
  loyaltyPointsBalance: 50000,
  paymentCategory: "CREDIT",
  paymentTerm: "30 Days",
  creditLimit: 5000000,
  creditDays: 30,
  creditUsed: 1200000,
  transportMode: "By-Road",
  transportCode: "TR-01",
  transitDays: 2,
  bankCode: "HDFC0001",
  bankLocation: "Mumbai",
  retailFactor: 1.0,
  dealerFactor: 1.0,
  destinationTaxType: "GST",
  allowCashBill: true,
  allowDcGen: true,
  allowCreditInvoice: true,
  allowMiscIssue: true,
  allowMiscReceipts: true,
  lstNumber: "",
  lstDate: "",
  cstNumber: "",
  cstDate: "",
  gstin: "27AABCR1234F1Z5",
  panNumber: "AABCR1234F",
  iecNumber: "IEC1234567",
  businessNature: "Key Account",
  accountManager: "Corporate Sales",
  isPreSaleFormApplicable: false,
  preSaleFormName: "",
  isPostSaleFormApplicable: false,
  postSaleFormName: "",
  status: "Active",
  createdAt: "2026-04-05",
  updatedAt: "2026-10-15"
};

describe("Enterprise Customer Master Reference Layout Tests", () => {
  it("renders the page header, breadcrumb, and primary action buttons", () => {
    const html = renderToString(
      <EnterpriseCustomerMasterView
        customer={MOCK_CUSTOMER}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSaveAndNew={vi.fn()}
        onDuplicate={vi.fn()}
        onDeactivate={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("Customer Master");
    expect(html).toContain("REL001");
    expect(html).toContain("Back");
    expect(html).toContain("Save");
    expect(html).toContain("Save &amp; New");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Deactivate");
  });

  it("renders all 9 numbered color-coded sections matching reference structure", () => {
    const html = renderToString(
      <EnterpriseCustomerMasterView
        customer={MOCK_CUSTOMER}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Basic Details");
    expect(html).toContain("Corporate Identity &amp; Tax");
    expect(html).toContain("Commercial Terms");
    expect(html).toContain("Addresses");
    expect(html).toContain("Store / Outlet Network");
    expect(html).toContain("Contacts");
    expect(html).toContain("Child Customers");
    expect(html).toContain("Documents &amp; Notes");
    expect(html).toContain("Activity &amp; Audit");
  });

  it("renders Customer Summary Card with identity, GSTIN, PAN, and metrics", () => {
    const html = renderToString(
      <CustomerSummaryCard customer={MOCK_CUSTOMER} childCustomerCount={12} totalStoreCount={85} />
    );

    expect(html).toContain("Customer Summary");
    expect(html).toContain("Reliance Retail Limited");
    expect(html).toContain("27AABCR1234F1Z5");
    expect(html).toContain("AABCR1234F");
    expect(html).toContain("50,00,000");
    expect(html).toContain("12");
    expect(html).toContain("85");
  });

  it("renders Parent-Child Hierarchy tree with connected root and branch cards", () => {
    const sampleChildren = [
      { id: "c1", code: "REL-MUM-001", name: "Phoenix Mall", storeCode: "1888", location: "Kurla West", status: "Active" },
      { id: "c2", code: "REL-MUM-002", name: "Inorbit Mall", storeCode: "1969", location: "Malad West", status: "Active" },
      { id: "c3", code: "REL-PUN-001", name: "Amanora Mall", storeCode: "TXAJ", location: "Hadapsar", status: "Active" },
    ];
    const html = renderToString(<CustomerHierarchyTree customer={MOCK_CUSTOMER} childrenNodes={sampleChildren} />);

    expect(html).toContain("Parent – Child Hierarchy");
    expect(html).toContain("Parent Customer (Corporate / Key Account)");
    expect(html).toContain("Phoenix Mall");
    expect(html).toContain("Inorbit Mall");
    expect(html).toContain("Amanora Mall");
    expect(html).toContain("All stores do not need to be separate customer records");
  });

  it("renders honest empty state when no child accounts are linked", () => {
    const html = renderToString(<CustomerHierarchyTree customer={MOCK_CUSTOMER} childrenNodes={[]} />);
    expect(html).toContain("No Child Accounts Linked");
  });

  it("renders Tax Invoice preview with Bill To and Deliver To cards and line items", () => {
    const sampleInvoice = {
      invoice_no: "TT2026-2027/18",
      date: "2026-06-15",
      due_date: "2026-07-15",
      customer_name: "Reliance Retail Limited",
      billing_address: "3rd Floor, MMRDA BKC, Mumbai - 400051",
      delivery_address: "Phoenix Mall DC, Kurla West, Mumbai - 400070",
      gstin: "27AABCR1234F1Z5",
      pan: "AABCR1234F",
      state: "Maharashtra",
      state_code: "27",
      payment_terms: "30 Days Net",
      grand_total: 11636.10,
      tax_amount: 1774.65,
      items: [
        { id: "1", barcode: "8901234567890", code: "ART001", name: "Premium Polo T-Shirt", size: "L", quantity: 10, price: 599.0, tax_amount: 599.0, total_amount: 6589.0 },
        { id: "2", barcode: "8901234567891", code: "ART002", name: "Slim Fit Chinos", size: "32", quantity: 5, price: 899.0, tax_amount: 449.5, total_amount: 4944.5 },
        { id: "3", barcode: "8901234567892", code: "ART003", name: "Formal Cotton Shirt", size: "40", quantity: 8, price: 799.0, tax_amount: 639.2, total_amount: 7031.2 },
      ]
    };
    const html = renderToString(<CustomerTaxInvoicePreview customer={MOCK_CUSTOMER} invoice={sampleInvoice} />);

    expect(html).toContain("Tax Invoice");
    expect(html).toContain("Bill To (Corporate)");
    expect(html).toContain("Deliver To (Store)");
    expect(html).toContain("ART001");
    expect(html).toContain("ART002");
    expect(html).toContain("ART003");
    expect(html).toContain("11,636.10");
  });

  it("renders honest empty state when no posted tax invoices exist", () => {
    const html = renderToString(<CustomerTaxInvoicePreview customer={MOCK_CUSTOMER} />);
    expect(html).toContain("No Posted Tax Invoices");
  });

  it("renders left vertical navigation with all 9 navigation targets", () => {
    const html = renderToString(
      <CustomerMasterSideNav
        activeSection="basic"
        onSelectSection={vi.fn()}
      />
    );

    expect(html).toContain("Basic Details");
    expect(html).toContain("Corporate &amp; Tax");
    expect(html).toContain("Addresses");
    expect(html).toContain("Store / Outlet Network");
    expect(html).toContain("Commercial Terms");
    expect(html).toContain("Contacts");
    expect(html).toContain("Parent – Child");
    expect(html).toContain("Documents");
    expect(html).toContain("Activity &amp; Audit");
  });
});
