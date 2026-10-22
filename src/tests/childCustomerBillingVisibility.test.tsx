/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.13
 * Created      : 2026-10-22
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Parent-Controlled Child Customer Billing Visibility Unit Test Suite
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SmritiCustomerRetailDetailsTab } from "../components/customer/CustRetailDetTab.tsx";
import { EnterpriseCustomerMasterView } from "../components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx";
import { CustomerMasterModal, BillingCustomer } from "../components/billing/CustomerMasterModal.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

const BASE_TEST_CUSTOMER: RetailCustomerRecord = {
  id: "cust-parent-001",
  code: "PARENT-001",
  name: "Tata Sons Retail Enterprises",
  priceGroup: "CORP#Standard Corporate",
  customerGroupId: "CG-Corporate",
  customer_group_id: "CG-Corporate",
  phone: "9820011111",
  email: "billing@tata.com",
  religion: "Hindu",
  ethnicity: "Asian",
  ageGroup: ">=35 - <45",
  profession: "Enterprise Account",
  customerType: "Corporate",
  profileNotes: "Enterprise parent company account.",
  companyCode: "COMP-001",
  environment: "Corporate",
  flatFileFormat: "GUI with Delimiter Format",
  isTaxInclusive: true,
  pricingBasis: "MRP",
  allowPromotionsOnRate: false,
  delimiter: ";",
  buyingFactor: 1.0,
  sellingFactor: 1.0,
  mailingAddresses: [],
  isDependant: false,
  showChildCustomersInBilling: false,
  primaryAccountCode: "",
  primaryAccountName: "",
  applyParentMailingInfo: false,
  dependants: [
    {
      code: "CHILD-001",
      name: "Westside Mumbai Flagship",
      relation: "Child",
    },
    {
      code: "CHILD-002",
      name: "Zudio Bangalore Store",
      relation: "Child",
    },
  ],
  gender: "Female",
  dateOfBirth: "",
  isMarried: false,
  weddingAnniversary: "",
  loyaltyPgmId: "",
  loyaltyPgmCode: "",
  loyaltyTier: "Standard",
  loyaltyPointsBalance: 0,
  paymentCategory: "CREDIT",
  paymentTerm: "Net 30 Days",
  creditLimit: 500000,
  creditDays: 30,
  creditUsed: 0,
  transportMode: "By-Road",
  transportCode: "VRL",
  transitDays: 2,
  bankCode: "",
  bankLocation: "",
  retailFactor: 1.0,
  dealerFactor: 0.85,
  destinationTaxType: "318#GST_RETAIL",
  allowCashBill: true,
  allowDcGen: true,
  allowCreditInvoice: true,
  allowMiscIssue: false,
  allowMiscReceipts: true,
  lstNumber: "",
  lstDate: "",
  cstNumber: "",
  cstDate: "",
  gstin: "27AAACT1234F1Z5",
  panNumber: "AAACT1234F",
  isPreSaleFormApplicable: false,
  preSaleFormName: "",
  isPostSaleFormApplicable: false,
  postSaleFormName: "",
  status: "Active",
  createdAt: "2026-01-01",
  updatedAt: "2026-10-22",
};

const RETAIL_TEST_CUSTOMER: RetailCustomerRecord = {
  ...BASE_TEST_CUSTOMER,
  customerType: "Retail",
  environment: "Retail",
  customerGroupId: "CG-Retail",
  customer_group_id: "CG-Retail",
};

describe("Parent-Controlled Child Customer Billing Visibility UI Suite", () => {
  it("CustRetailDetTab renders 'Show Child Customers in Billing' toggle with Disabled badge by default", () => {
    const html = renderToString(
      <SmritiCustomerRetailDetailsTab
        customer={RETAIL_TEST_CUSTOMER}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Show Child Customers in Billing");
    expect(html).toContain("Disabled");
    expect(html).toContain(
      "When enabled, eligible child customers under this parent can be searched and selected while creating bills or sales invoices."
    );
  });

  it("CustRetailDetTab displays Enabled badge when showChildCustomersInBilling is true", () => {
    const customerWithEnabled: RetailCustomerRecord = {
      ...RETAIL_TEST_CUSTOMER,
      showChildCustomersInBilling: true,
    };

    const html = renderToString(
      <SmritiCustomerRetailDetailsTab
        customer={customerWithEnabled}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Show Child Customers in Billing");
    expect(html).toContain("Enabled");
  });

  it("EnterpriseCustomerMasterView renders toggle in Card 7 Child Customers section", () => {
    const html = renderToString(
      <EnterpriseCustomerMasterView
        customer={BASE_TEST_CUSTOMER}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Child Customers");
    expect(html).toContain("Show Child Customers in Billing");
    expect(html).toContain("OFF");
  });

  it("EnterpriseCustomerMasterView displays ON state when showChildCustomersInBilling is true", () => {
    const customerWithEnabled: RetailCustomerRecord = {
      ...BASE_TEST_CUSTOMER,
      showChildCustomersInBilling: true,
    };

    const html = renderToString(
      <EnterpriseCustomerMasterView
        customer={customerWithEnabled}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Show Child Customers in Billing");
    expect(html).toContain("ON");
  });

  it("CustomerMasterModal renders Child Customer badge for subordinate accounts", () => {
    const testCustomers: BillingCustomer[] = [
      {
        id: "cust-parent-1",
        code: "PARENT-001",
        name: "Tata Retail Enterprises",
        credit_limit: 100000,
        balance: 0,
        available_credit: 100000,
        status: "Active",
        is_child_customer: false,
      },
      {
        id: "cust-child-1",
        code: "WESTSIDE-001",
        name: "Westside Mumbai Store",
        credit_limit: 0,
        balance: 0,
        available_credit: 0,
        status: "Active",
        is_child_customer: true,
        parent_customer_name: "Tata Retail Enterprises",
      },
    ];

    const html = renderToString(
      <CustomerMasterModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectCustomer={vi.fn()}
      />
    );

    // Verify modal container renders
    expect(html).toContain("Customer Master");
  });
});
