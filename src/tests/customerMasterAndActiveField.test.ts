/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 3.30.0
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Test Suite   : Customer Master & ActiveField Heuristic Safety Tests
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { inferFieldCategory } from "../context/ActiveFieldContext.tsx";
import { mapBackendCustomerToRecord } from "../components/customer/CustMasterWs.tsx";
import { SmritiCustomerFormTab } from "../components/customer/CustFormTab.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

function createMockElement(opts: {
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  attributes?: Record<string, string>;
}): any {
  const attrs = { ...(opts.attributes || {}) };
  return {
    tagName: "INPUT",
    name: opts.name || "",
    id: opts.id || "",
    placeholder: opts.placeholder || "",
    className: opts.className || "",
    getAttribute: (k: string) => attrs[k] || null,
    setAttribute: (k: string, v: string) => { attrs[k] = v; }
  };
}

describe("ActiveFieldContext Heuristic Safety & Substring Collision Remediation", () => {
  it("must resolve category 'customer' for Customer Name input with Tailwind 'border' class", () => {
    // Simulate Customer Name DOM input in CustFormTab
    const input = createMockElement({
      placeholder: "e.g. Farida Jameel",
      className: "w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-bold text-xs",
      attributes: {
        "data-field-key": "customer_name"
      }
    });

    const result = inferFieldCategory(input);
    expect(result.category).toBe("customer");
    expect(result.category).not.toBe("invoice");
  });

  it("must NEVER classify an ordinary input as 'invoice' merely because its CSS className contains 'border'", () => {
    // Ordinary text input with Tailwind 'border' class
    const input = createMockElement({
      placeholder: "Enter reference notes",
      className: "border border-gray-300 rounded px-2 py-1 order-first"
    });

    const result = inferFieldCategory(input);
    // Must resolve to general, not falsely to invoice
    expect(result.category).toBe("general");
    expect(result.category).not.toBe("invoice");
  });

  it("must legitimately resolve category 'invoice' for genuine invoice fields", () => {
    // Legitimate invoice search input
    const input1 = createMockElement({
      placeholder: "Search Invoices (Invoice / Document Field)...",
      className: "w-full border"
    });

    const result1 = inferFieldCategory(input1);
    expect(result1.category).toBe("invoice");

    // Input with name 'invoice_no'
    const input2 = createMockElement({
      name: "invoice_no",
      className: "border"
    });

    const result2 = inferFieldCategory(input2);
    expect(result2.category).toBe("invoice");
  });

  it("must resolve category 'customer' for Customer Group and Price Group fields", () => {
    const grpInput = createMockElement({
      attributes: { "data-field-key": "customer_group_id" }
    });

    const resultGrp = inferFieldCategory(grpInput);
    expect(resultGrp.category).toBe("customer");

    const priceGrpInput = createMockElement({
      attributes: { "data-field-key": "customer_price_group" }
    });

    const resultPriceGrp = inferFieldCategory(priceGrpInput);
    expect(resultPriceGrp.category).toBe("customer");
  });
});

describe("Customer Master Data Model & Customer Group Relationship", () => {
  it("preserves explicit customerGroupId on RetailCustomerRecord", () => {
    const record: RetailCustomerRecord = {
      id: "cust-test-001",
      code: "CUST-001",
      name: "Apex Logistics India Ltd",
      customerGroupId: "CG-Corporate",
      customer_group_id: "CG-Corporate",
      priceGroup: "CORP#Standard Corporate",
      phone: "9820012345",
      email: "finance@apexlogistics.com",
      religion: "Other",
      ethnicity: "Asian",
      ageGroup: ">=35 - <45",
      profession: "Logistics",
      customerType: "Corporate",
      profileNotes: "",
      companyCode: "001",
      environment: "Corporate",
      flatFileFormat: "JSON Format",
      isTaxInclusive: true,
      delimiter: ";",
      buyingFactor: 1.0,
      sellingFactor: 1.0,
      mailingAddresses: [],
      isDependant: false,
      primaryAccountCode: "",
      primaryAccountName: "",
      applyParentMailingInfo: false,
      dependants: [],
      gender: "Male",
      dateOfBirth: "",
      isMarried: false,
      weddingAnniversary: "",
      loyaltyPgmId: "024",
      loyaltyPgmCode: "DSC",
      loyaltyTier: "Standard",
      loyaltyPointsBalance: 0,
      paymentCategory: "CREDIT",
      paymentTerm: "60 Days Net",
      creditLimit: 500000,
      creditDays: 60,
      creditUsed: 50000,
      transportMode: "By-Road",
      transportCode: "VRL",
      transitDays: 2,
      bankCode: "",
      bankLocation: "",
      retailFactor: 1.0,
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
      gstin: "27AABCA1234F1Z5",
      panNumber: "AABCA1234F",
      isPreSaleFormApplicable: false,
      preSaleFormName: "",
      isPostSaleFormApplicable: false,
      postSaleFormName: "",
      status: "Active",
      createdAt: "2026-09-03",
      updatedAt: "2026-09-03"
    };

    expect(record.customerGroupId).toBe("CG-Corporate");
    expect(record.customer_group_id).toBe("CG-Corporate");
    expect(record.priceGroup).toBe("CORP#Standard Corporate");
    expect(record.customerType).toBe("Corporate");
  });

  it("mapBackendCustomerToRecord correctly maps customer_group_id to customerGroupId", () => {
    const backendCustomer = {
      id: "cust-corp-99",
      code: "CUST-099",
      name: "Reliance Corporate Ltd",
      customer_group_id: "CG-Corporate",
      price_group: "CORP#Standard Corporate",
      mobile: "9820099999",
      email: "tax@ril.com",
      gst_number: "27AABCR1234P1Z8",
      outstanding: 50000.0,
      status: "Active",
      tags: ["Corporate", "B2B"]
    };

    const mapped = mapBackendCustomerToRecord(backendCustomer);
    expect(mapped.customerGroupId).toBe("CG-Corporate");
    expect(mapped.customer_group_id).toBe("CG-Corporate");
    expect(mapped.customerType).toBe("Corporate");
    expect(mapped.environment).toBe("Corporate");
  });

  it("allows Customer Group and Customer Price Group to be semantically independent", () => {
    // A corporate client (CG-Corporate) may receive a VIP Price Group promotion or distinct discount
    const b2bCustomerWithVipPricing = {
      id: "cust-hybrid-01",
      code: "CUST-H01",
      name: "Tata Sons Hospitality",
      customer_group_id: "CG-Corporate", // Corporate credit terms (60 days net, limit)
      price_group: "VIP#Platinum Retail", // VIP retail pricing tier
      mobile: "9820088888",
      tags: ["Corporate"]
    };

    const mapped = mapBackendCustomerToRecord(b2bCustomerWithVipPricing);
    expect(mapped.customerGroupId).toBe("CG-Corporate");
    expect(mapped.priceGroup).toBe("VIP#Platinum Retail");
    // Semantic separation: AR terms belong to customerGroupId, discounts belong to priceGroup
    expect(mapped.customerGroupId).not.toEqual(mapped.priceGroup);
  });
});

describe("SmritiCustomerFormTab Component Real DOM Rendering", () => {
  it("renders distinct Customer Group control with data-field-key='customer_group_id' and Customer Price Group", () => {
    const dummyCustomer: RetailCustomerRecord = {
      id: "cust-live-01",
      code: "CUST-001",
      name: "Acme Industrial Ltd",
      customerGroupId: "CG-Corporate",
      customer_group_id: "CG-Corporate",
      priceGroup: "CORP#Standard Corporate",
      phone: "9820011111",
      email: "finance@acme.com",
      religion: "Other",
      ethnicity: "Asian",
      ageGroup: ">=35 - <45",
      profession: "Corporate",
      customerType: "Corporate",
      profileNotes: "",
      companyCode: "001",
      environment: "Corporate",
      flatFileFormat: "JSON Format",
      isTaxInclusive: true,
      delimiter: ";",
      buyingFactor: 1.0,
      sellingFactor: 1.0,
      mailingAddresses: [],
      isDependant: false,
      primaryAccountCode: "",
      primaryAccountName: "",
      costCenterCode: "",
      costCenterName: "",
      paymentTerm: "Net 45",
      creditDays: 45,
      creditLimit: 500000,
      creditUsed: 0,
      destinationTaxType: "Interstate",
      allowCreditInvoice: true,
      allowCashBill: true,
      allowMiscIssue: false,
      loyaltyTier: "Standard",
      loyaltyPointsBalance: 0,
      status: "Active",
      createdAt: "2026-09-03",
      updatedAt: "2026-09-03"
    };

    const html = renderToString(
      React.createElement(SmritiCustomerFormTab, {
        customer: dummyCustomer,
        onChange: () => {},
        onOpenMailingModal: () => {}
      })
    );

    // 1. Assert Customer Group label, select control, and option are rendered
    expect(html).toContain("Customer Group*");
    expect(html).toContain("data-field-key=\"customer_group_id\"");
    expect(html).toContain("Corporate Clients");
    expect(html).toContain("CG-Corporate");

    // 2. Assert Customer Price Group is rendered as distinct field
    expect(html).toContain("Customer Price Group");
    expect(html).toContain("data-field-key=\"customer_price_group\"");
    expect(html).toContain("CORP");
    expect(html).toContain("Standard Corporate");

    // 3. Assert both controls are distinct in the rendered output
    const custGroupIdx = html.indexOf("data-field-key=\"customer_group_id\"");
    const priceGroupIdx = html.indexOf("data-field-key=\"customer_price_group\"");
    expect(custGroupIdx).toBeGreaterThan(-1);
    expect(priceGroupIdx).toBeGreaterThan(-1);
    expect(custGroupIdx).not.toEqual(priceGroupIdx);
  });
});
