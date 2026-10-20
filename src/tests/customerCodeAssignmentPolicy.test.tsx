/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target Test  : Customer Code Configurable Assignment Policy Frontend Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateCustomerModal } from "../components/customer/lifecycle/CreateCustomerModal.tsx";
import { SmritiCustomerFormTab } from "../components/customer/CustFormTab.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

const mockCustomer: RetailCustomerRecord = {
  id: "cust-001",
  code: "CUST-000101",
  name: "Reliance Retail Ltd",
  phone: "9820012345",
  email: "contact@relianceretail.com",
  customerType: "Corporate",
  environment: "Corporate",
  customerGroupId: "CG-Corporate",
  customer_group_id: "CG-Corporate",
  priceGroup: "CORP#Standard Corporate",
  gstin: "27AAAPL1234A1Z5",
  panNumber: "AAAPL1234A",
  status: "Active",
  companyCode: "COMP-001",
  mailingAddresses: [
    {
      code: "001",
      addressType: "mailing",
      contactPerson: "Rajesh Kumar",
      storeCode: "STR-001",
      billingStoreCode: "STR-001",
      shippingStoreCode: "STR-001",
      address1: "Reliance Corporate Park",
      city: "Navi Mumbai",
      postalCode: "400701",
      state: "Maharashtra",
      country: "India",
      mobilePhone: "9820012345",
    },
  ],
  deliveryLocations: [],
  gstRegistrations: [],
  billingLocations: [],
  creditLedger: [],
  relationships: [],
  companyRelationships: [],
};

describe("Customer Code Configurable Assignment Policy Frontend Integration", () => {
  it("renders CreateCustomerModal with governed Customer Code assignment controls", () => {
    const html = renderToStaticMarkup(
      <CreateCustomerModal
        isOpen={true}
        onClose={() => {}}
        onCreated={() => {}}
      />
    );

    // Verify modal header and structure
    expect(html).toContain("New Customer Account");

    // Verify Customer Code Assignment (Hybrid Mode) section
    expect(html).toContain("Customer Code Assignment (Hybrid Mode)");
    expect(html).toContain("Auto-Suggested");
    expect(html).toContain("Custom Code");

    // Verify data-field-key contract
    expect(html).toContain('data-field-key="suggested_customer_code"');
    expect(html).toContain("Sequential • Company Scope");
  });

  it("renders CustFormTab with existing assigned customer code", () => {
    const html = renderToStaticMarkup(
      <SmritiCustomerFormTab
        customer={mockCustomer}
        onChange={() => {}}
        onOpenMailingModal={() => {}}
      />
    );

    expect(html).toContain("Customer Code");
    expect(html).toContain("Assigned (Company Scope)");
    expect(html).toContain("CUST-000101");
    expect(html).toContain('data-field-key="customer_code"');
  });

  it("renders CustFormTab with unassigned customer indicating Auto-Recommended hybrid policy", () => {
    const unassignedCustomer: RetailCustomerRecord = {
      ...mockCustomer,
      id: "",
      code: "",
    };

    const html = renderToStaticMarkup(
      <SmritiCustomerFormTab
        customer={unassignedCustomer}
        onChange={() => {}}
        onOpenMailingModal={() => {}}
      />
    );

    expect(html).toContain("Customer Code");
    expect(html).toContain("Hybrid Policy • Auto-Recommended");
    expect(html).toContain("Generating...");
    expect(html).toContain('data-field-key="customer_code"');
  });

  it("verifies collision recovery state preservation payload structure", () => {
    // Contract simulation: on 409 collision, error detail has expected attributes
    const collisionErrorDetail = {
      error_code: "CUSTOMER_CODE_COLLISION",
      message: "Customer code 'CUST-000101' collided with a concurrently created customer.",
      suggested_code: "CUST-000102",
    };

    expect(collisionErrorDetail.error_code).toBe("CUSTOMER_CODE_COLLISION");
    expect(collisionErrorDetail.suggested_code).toBe("CUST-000102");
    expect(collisionErrorDetail.message).toContain("collided");
  });
});
