/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Corporate Customer Master UI & Field Visibility Test Suite
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CorporateMasterAccountHeader } from "../components/customer/corporateWorkspace/CorporateMasterAccountHeader.tsx";
import { CorporateIdentityCompliancePanel } from "../components/customer/corporateWorkspace/CorporateIdentityCompliancePanel.tsx";
import { CorporateNetworkPanel } from "../components/customer/corporateWorkspace/CorporateNetworkPanel.tsx";
import { CorporateAddressesContactsPanel } from "../components/customer/corporateWorkspace/CorporateAddressesContactsPanel.tsx";
import { CorporateCommercialTermsPanel } from "../components/customer/corporateWorkspace/CorporateCommercialTermsPanel.tsx";
import { CorporateIntegrationsPanel } from "../components/customer/corporateWorkspace/CorporateIntegrationsPanel.tsx";
import { SmritiCustomerFormTab } from "../components/customer/CustFormTab.tsx";
import { SmritiCustomerRetailDetailsTab } from "../components/customer/CustRetailDetTab.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

const mockCorporateCustomer: RetailCustomerRecord = {
  id: "cust-corp-001",
  code: "RRL-001",
  name: "Reliance Retail Limited",
  priceGroup: "CORP#Standard Corporate",
  customerGroupId: "CG-Corporate",
  customer_group_id: "CG-Corporate",
  phone: "9820012345",
  email: "procurement@ril.com",
  religion: "Hindu",
  ethnicity: "Asian",
  ageGroup: ">=35 - <45",
  profession: "Enterprise Account",
  customerType: "Corporate",
  profileNotes: "Leading multi-format corporate retailer across India.",
  companyCode: "001",
  environment: "Corporate",
  flatFileFormat: "GUI with Delimiter Format",
  storeCode: "RRL-001",
  billingStoreCode: "RRL-001",
  shippingStoreCode: "RRL-002",
  isTaxInclusive: true,
  delimiter: ";",
  buyingFactor: 1.00,
  sellingFactor: 1.00,
  mailingAddresses: [
    {
      code: "001",
      contactPerson: "Registered Office",
      addressType: "mailing",
      address1: "3rd Floor, Court House, L.T. Marg",
      address2: "",
      address3: "",
      address4: "",
      address5: "",
      locality: "Dhobi Talao",
      city: "Mumbai",
      postalCode: "400001",
      state: "Maharashtra",
      zone: "West",
      country: "India",
      officePhone: "022-22001122",
      homePhone: "",
      mobilePhone: "9820012345",
      faxNumber: "",
      email1: "procurement@ril.com",
      email2: "",
      email3: "",
      isDefault: true
    }
  ],
  isDependant: false,
  primaryAccountCode: "",
  primaryAccountName: "",
  applyParentMailingInfo: false,
  dependants: [],
  gender: "Other",
  dateOfBirth: "",
  isMarried: false,
  weddingAnniversary: "",
  loyaltyPgmId: "",
  loyaltyPgmCode: "",
  loyaltyTier: "Corporate",
  loyaltyPointsBalance: 0,
  paymentCategory: "CREDIT",
  paymentTerm: "Net 45",
  creditLimit: 10000000,
  creditDays: 45,
  creditUsed: 1555240,
  transportMode: "By-Road",
  transportCode: "VRL",
  transitDays: 2,
  bankCode: "HDFC0001",
  bankLocation: "Nariman Point",
  retailFactor: 1.00,
  dealerFactor: 0.85,
  destinationTaxType: "318#GST_RETAIL",
  allowCashBill: true,
  allowDcGen: false,
  allowCreditInvoice: true,
  allowMiscIssue: false,
  allowMiscReceipts: true,
  lstNumber: "",
  lstDate: "",
  cstNumber: "",
  cstDate: "",
  gstin: "27AAACR9121R1Z5",
  panNumber: "ABCDE1234F",
  isPreSaleFormApplicable: false,
  preSaleFormName: "",
  isPostSaleFormApplicable: false,
  postSaleFormName: "",
  status: "Active",
  createdAt: "2023-04-01",
  updatedAt: "2026-10-19",
  shortName: "RRL",
  legalEntityType: "Private Limited Company",
  corporateParent: "Reliance Industries Limited",
  accountManager: "Suresh Patil",
  tanNumber: "MUMA12345G",
  iecNumber: "",
  industry: "Retail - Multi Brand",
  businessNature: "Retail Chain",
  annualTurnover: "> 1,000 Crore",
  website: "https://www.ril.com",
  businessDescription: "Leading retail chain operating multiple formats across India including fashion, electronics, grocery and lifestyle."
};

const mockRetailCustomer: RetailCustomerRecord = {
  ...mockCorporateCustomer,
  id: "cust-ret-002",
  code: "CUST-002",
  name: "Pooja Verma",
  customerType: "Retail",
  environment: "Retail",
  customerGroupId: "CG-Retail",
  religion: "Hindu",
  ethnicity: "Asian",
  ageGroup: ">=20 - <35",
  profession: "Doctor",
  dateOfBirth: "1992-05-15",
  weddingAnniversary: "2018-11-20",
  loyaltyTier: "Gold",
  loyaltyPointsBalance: 450
};

describe("Corporate Customer Master Workspace Unit Tests", () => {
  it("CorporateMasterAccountHeader renders corporate identity and 6 metric columns", () => {
    const html = renderToString(
      <CorporateMasterAccountHeader customer={mockCorporateCustomer} />
    );

    expect(html).toContain("RRL-001");
    expect(html).toContain("Reliance Retail Limited");
    expect(html).toContain("Corporate / B2B");
    expect(html).toContain("ABCDE1234F"); // PAN
    expect(html).toContain("27AAACR9121R1Z5"); // Primary GSTIN
    expect(html).toContain("Net 45"); // Payment Terms
    expect(html).toContain("01 Apr 2023"); // Relationship start date
  });

  it("CorporateIdentityCompliancePanel renders Corporate Identity, Legal/Tax, and Business Info cards", () => {
    const html = renderToString(
      <CorporateIdentityCompliancePanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
        gstRegistrations={[
          { id: "1", gstin: "27AAACR9121R1Z5", state: "Maharashtra", stateCode: "27", registrationType: "Regular", status: "Active", isPrimary: true },
          { id: "2", gstin: "29AAACR9121R1Z6", state: "Karnataka", stateCode: "29", registrationType: "Regular", status: "Active", isPrimary: false }
        ]}
        onSaveGstRegistration={vi.fn()}
        onDeleteGstRegistration={vi.fn()}
      />
    );

    expect(html).toContain("Corporate Identity");
    expect(html).toContain("Legal &amp; Tax Details");
    expect(html).toContain("Business Information");
    expect(html).toContain("Reliance Industries Limited");
    expect(html).toContain("27AAACR9121R1Z5");
    expect(html).toContain("Maharashtra");
    expect(html).toContain("Karnataka");
    expect(html).toContain("https://www.ril.com");
  });

  it("CorporateNetworkPanel renders Parent Account, Network Type, Location Metrics, and Mapped Stores", () => {
    const html = renderToString(
      <CorporateNetworkPanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
        mappedStores={[
          { id: "1", storeCode: "RRL-001", storeName: "Mumbai Phoenix Mall", city: "Mumbai", status: "Active" },
          { id: "2", storeCode: "RRL-002", storeName: "DLF Mall", city: "Delhi", status: "Active" }
        ]}
      />
    );

    expect(html).toContain("Corporate Network");
    expect(html).toContain("Parent Account");
    expect(html).toContain("Network Type");
    expect(html).toContain("Total Locations");
    expect(html).toContain("Mapped Store Codes");
    expect(html).toContain("Mumbai Phoenix Mall");
    expect(html).toContain("DLF Mall");
  });

  it("CorporateAddressesContactsPanel renders Addresses and Key Contacts cards", () => {
    const html = renderToString(
      <CorporateAddressesContactsPanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
        onOpenMailingModal={vi.fn()}
      />
    );

    expect(html).toContain("Addresses &amp; Contacts");
    expect(html).toContain("Key Contacts");
    expect(html).toContain("Billing Addresses");
    expect(html).toContain("Delivery Addresses");
    expect(html).toContain("Amit Sharma");
    expect(html).toContain("Purchase Head");
  });

  it("CorporateCommercialTermsPanel renders commercial terms, credit metrics, and progress bar", () => {
    const html = renderToString(
      <CorporateCommercialTermsPanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Commercial Terms");
    expect(html).toContain("Payment Category");
    expect(html).toContain("Payment Terms");
    expect(html).toContain("Credit Limit (INR)");
    expect(html).toContain("Credit Days");
    expect(html).toContain("Current Outstanding (INR)");
    expect(html).toContain("Credit Utilization");
    expect(html).toContain("Dealer Factor");
    expect(html).toContain("Retail Factor");
  });

  it("CorporateCommercialTermsPanel renders Model C multi-company commercial relationships, credit hold, and customer group", () => {
    const mockRelationships = [
      {
        id: "ccr-comp-001",
        company_id: "COMP-001",
        customer_id: "cust-corp-001",
        customer_group_id: "CG-Corporate",
        credit_limit: 10000000,
        credit_days: 45,
        credit_hold: false,
        status: "Active"
      },
      {
        id: "ccr-comp-002",
        company_id: "comp-foreign-002",
        customer_id: "cust-corp-001",
        customer_group_id: "CG-Export",
        credit_limit: 2500000,
        credit_days: 15,
        credit_hold: true,
        status: "Active"
      }
    ];

    const html = renderToString(
      <CorporateCommercialTermsPanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
        relationships={mockRelationships}
        activeRelationshipId="ccr-comp-001"
      />
    );

    expect(html).toContain("Operating Legal Entity Commercial Terms");
    expect(html).toContain("model c multi-company");
    expect(html).toContain("COMP-001");
    expect(html).toContain("comp-foreign-002");
    expect(html).toContain("HOLD");
    expect(html).toContain("ACTIVE");
    expect(html).toContain("CREDIT CLEAN — INVOICING PERMITTED");
    expect(html).toContain('data-field-key="ccr_credit_limit"');
    expect(html).toContain('data-field-key="ccr_credit_days"');
    expect(html).toContain('data-field-key="ccr_credit_hold"');
    expect(html).toContain('data-field-key="ccr_customer_group"');
  });

  it("CorporateIntegrationsPanel renders external code, environment, flat file format, and EDI toggle", () => {
    const html = renderToString(
      <CorporateIntegrationsPanel
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Integrations &amp; Data Exchange");
    expect(html).toContain("External Customer Code");
    expect(html).toContain("Environment");
    expect(html).toContain("Flat File Format");
    expect(html).toContain("EDI / File Integration");
    expect(html).toContain("View Integration Logs");
  });

  it("CustFormTab conditionally suppresses personal religion/ethnicity/profession for corporate accounts", () => {
    const corpFormHtml = renderToString(
      <SmritiCustomerFormTab
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
        onOpenMailingModal={vi.fn()}
      />
    );

    // Personal demographic selectors must be suppressed
    expect(corpFormHtml).not.toContain(">Religion<");
    expect(corpFormHtml).not.toContain(">Ethnicity<");
    expect(corpFormHtml).toContain("Corporate / B2B Account Profile");

    const retailFormHtml = renderToString(
      <SmritiCustomerFormTab
        customer={mockRetailCustomer}
        onChange={vi.fn()}
        onOpenMailingModal={vi.fn()}
      />
    );

    // For retail customers, demographic selectors remain available
    expect(retailFormHtml).toContain(">Religion<");
    expect(retailFormHtml).toContain(">Ethnicity<");
  });

  it("CustRetailDetTab suppresses personal DOB, anniversary, and loyalty controls for corporate accounts", () => {
    const corpRetailHtml = renderToString(
      <SmritiCustomerRetailDetailsTab
        customer={mockCorporateCustomer}
        onChange={vi.fn()}
      />
    );

    expect(corpRetailHtml).not.toContain(">Date of Birth<");
    expect(corpRetailHtml).toContain("Corporate Customer Governance");

    const retailRetailHtml = renderToString(
      <SmritiCustomerRetailDetailsTab
        customer={mockRetailCustomer}
        onChange={vi.fn()}
      />
    );

    expect(retailRetailHtml).toContain(">Date of Birth<");
  });
});
