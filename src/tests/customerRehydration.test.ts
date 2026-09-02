/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-09-02
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { mapBackendCustomerToRecord } from "../components/customer/CustMasterWs.tsx";

describe("Customer Master B2B Environment & Classification Re-hydration", () => {
  // TEST A — Corporate backend re-hydration
  it("TEST A: should derive Corporate classification and environment from customer_group_id and tags", () => {
    const backendCust = {
      id: "cust-b2b-001",
      code: "CUST-B2B",
      name: "Final UAT B2B Customer",
      mobile: "9845599999",
      email: "b2b@enterprise.com",
      gst_number: "29AABCR1718E1ZL",
      customer_group_id: "CG-Corporate",
      tags: ["Corporate", "B2B"],
      status: "Active"
    };

    const record = mapBackendCustomerToRecord(backendCust);

    expect(record.customerType).toBe("Corporate");
    expect(record.environment).toBe("Corporate");
    expect(record.priceGroup).toBe("CORP#Standard Corporate");
    expect(record.gstin).toBe("29AABCR1718E1ZL");
  });

  // TEST B — Explicit backend environment/type
  it("TEST B: should preserve explicit backend environment and customer type if provided", () => {
    const backendCust = {
      id: "cust-custom-002",
      code: "CUST-SPEC",
      name: "Special Wholesale Account",
      customer_type: "Wholesale",
      environment: "Corporate",
      price_group: "TI#Tech Infotech Ltd",
      customer_group_id: "CG-Wholesale",
      tags: ["Wholesale"]
    };

    const record = mapBackendCustomerToRecord(backendCust);

    expect(record.customerType).toBe("Wholesale");
    expect(record.environment).toBe("Corporate");
    expect(record.priceGroup).toBe("TI#Tech Infotech Ltd");
  });

  // TEST C — Existing Retail behavior
  it("TEST C: should maintain Retail classification and environment for standard retail customers", () => {
    const backendCust = {
      id: "cust-retail-003",
      code: "CUST-RET-01",
      name: "Standard Retail Shopper",
      customer_group_id: "CG-Retail",
      tags: ["Retail"],
      mobile: "9845511111"
    };

    const record = mapBackendCustomerToRecord(backendCust);

    expect(record.customerType).toBe("Retail");
    expect(record.environment).toBe("Retail");
    expect(record.priceGroup).toBe("TI#Tech Infotech Ltd");
  });

  // TEST D — VIP classification
  it("TEST D: should map VIP customer group to VIP type and Retail environment", () => {
    const backendCust = {
      id: "cust-vip-004",
      code: "CUST-VIP-01",
      name: "Platinum VIP Customer",
      customer_group_id: "CG-LargeRetail",
      tags: ["VIP"]
    };

    const record = mapBackendCustomerToRecord(backendCust);

    expect(record.customerType).toBe("VIP");
    expect(record.environment).toBe("Retail");
    expect(record.priceGroup).toBe("VIP#Platinum Retail");
  });

  // TEST E — Fallback default behavior
  it("TEST E: should safely handle empty or partial backend customer payload", () => {
    const backendCust = {
      name: "Unclassified Customer"
    };

    const record = mapBackendCustomerToRecord(backendCust);

    expect(record.customerType).toBe("Retail");
    expect(record.environment).toBe("Retail");
    expect(record.name).toBe("Unclassified Customer");
  });
});
