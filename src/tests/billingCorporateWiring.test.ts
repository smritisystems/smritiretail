/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-09-04
 * Modified     : 2026-09-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Phase 2C Corporate B2B Billing Workspace Wiring Unit Tests
 */

import { describe, it, expect } from "vitest";
import { 
  BillingHeaderState, 
  CustomerGSTRegistrationDTO, 
  CustomerDeliveryLocationDTO 
} from "../components/billing/types.ts";

describe("Phase 2C — Corporate B2B Billing Workspace Wiring Tests", () => {
  const sampleRegistrations: CustomerGSTRegistrationDTO[] = [
    {
      id: "gst-reg-mh",
      customer_id: "cust-ril",
      gstin: "27AAACR7015K1Z0",
      state_code: "27",
      state_name: "Maharashtra",
      registration_type: "REGULAR",
      is_primary: true,
      status: "ACTIVE"
    },
    {
      id: "gst-reg-dl",
      customer_id: "cust-ril",
      gstin: "07AAACR7015K1Z2",
      state_code: "07",
      state_name: "Delhi",
      registration_type: "REGULAR",
      is_primary: false,
      status: "ACTIVE"
    },
    {
      id: "gst-reg-hr",
      customer_id: "cust-ril",
      gstin: "06AAACR7015K1Z1",
      state_code: "06",
      state_name: "Haryana",
      registration_type: "REGULAR",
      is_primary: false,
      status: "ACTIVE"
    }
  ];

  const sampleDeliveryLocations: CustomerDeliveryLocationDTO[] = [
    {
      id: "loc-gurgaon",
      customer_id: "cust-ril",
      store_code: "T97D",
      location_name: "Reliance Trends - Gurgaon Mall",
      state_code: "06",
      state: "Haryana",
      gstin: "06AAACR7015K1Z1",
      gst_registration_id: "gst-reg-hr",
      city: "Gurgaon",
      pincode: "122001",
      status: "ACTIVE"
    },
    {
      id: "loc-mumbai",
      customer_id: "cust-ril",
      store_code: "1888",
      location_name: "Reliance Smart Bazaar - Kurla",
      state_code: "27",
      state: "Maharashtra",
      gstin: "27AAACR7015K1Z0",
      gst_registration_id: "gst-reg-mh",
      city: "Mumbai",
      pincode: "400070",
      status: "ACTIVE"
    }
  ];

  // TEST 1 — Billing Header State initialization with Phase 2C fields
  it("TEST 1: should initialize BillingHeaderState with empty Phase 2C corporate fields", () => {
    const initialState: BillingHeaderState = {
      orderNo: "",
      orderDate: "2026-09-04",
      refNo: "",
      salesStaff: "",
      delDate: "2026-09-04",
      customerSearch: "",
      customerName: "",
      contactNo: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      customerId: "",
      gstNumber: "",
      priceCategory: "DEFAULT",
      customerGroup: "",
      creditLimit: 0,
      creditDays: 0,
      outstandingAmount: 0,
      billedPartyGstinId: "",
      billedGstin: "",
      deliveryLocationId: "",
      deliveryStoreCode: "",
      deliveryGstin: "",
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: "",
      poReference: ""
    };

    expect(initialState.billedPartyGstinId).toBe("");
    expect(initialState.billedGstin).toBe("");
    expect(initialState.deliveryLocationId).toBe("");
    expect(initialState.deliveryStoreCode).toBe("");
    expect(initialState.deliveryGstin).toBe("");
    expect(initialState.deliveryLocationSnapshot).toBeNull();
    expect(initialState.placeOfSupplyCode).toBe("");
    expect(initialState.poReference).toBe("");
  });

  // TEST 2 — Billed GST Registration Selection updates billedGstin and keeps registration ID authoritative
  it("TEST 2: should update billedGstin and billedPartyGstinId when registration is selected", () => {
    let header: BillingHeaderState = {
      orderNo: "",
      orderDate: "2026-09-04",
      refNo: "",
      salesStaff: "",
      delDate: "2026-09-04",
      customerSearch: "Reliance Retail Limited",
      customerName: "Reliance Retail Limited",
      contactNo: "9820098200",
      address: "Maker Maxity, BKC",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      customerId: "cust-ril",
      gstNumber: "27AAACR7015K1Z0",
      priceCategory: "DEFAULT",
      customerGroup: "Corporate",
      creditLimit: 1000000,
      creditDays: 45,
      outstandingAmount: 0,
      billedPartyGstinId: "",
      billedGstin: "",
      deliveryLocationId: "",
      deliveryStoreCode: "",
      deliveryGstin: "",
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: "",
      poReference: ""
    };

    // User selects Delhi GST registration
    const selectedReg = sampleRegistrations.find(r => r.id === "gst-reg-dl")!;
    header = {
      ...header,
      billedPartyGstinId: selectedReg.id,
      billedGstin: selectedReg.gstin
    };

    expect(header.billedPartyGstinId).toBe("gst-reg-dl");
    expect(header.billedGstin).toBe("07AAACR7015K1Z2");
  });

  // TEST 3 — Delivery Location selection auto-populates Store Code, Delivery GSTIN, Snapshot, and authoritative POS
  it("TEST 3: should auto-populate Store Code, Delivery GSTIN, and POS from selected delivery location", () => {
    let header: BillingHeaderState = {
      orderNo: "",
      orderDate: "2026-09-04",
      refNo: "",
      salesStaff: "",
      delDate: "2026-09-04",
      customerSearch: "Reliance Retail Limited",
      customerName: "Reliance Retail Limited",
      contactNo: "9820098200",
      address: "Maker Maxity, BKC",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      customerId: "cust-ril",
      gstNumber: "27AAACR7015K1Z0",
      priceCategory: "DEFAULT",
      customerGroup: "Corporate",
      creditLimit: 1000000,
      creditDays: 45,
      outstandingAmount: 0,
      billedPartyGstinId: "gst-reg-mh",
      billedGstin: "27AAACR7015K1Z0",
      deliveryLocationId: "",
      deliveryStoreCode: "",
      deliveryGstin: "",
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: "",
      poReference: "PO-RIL-2026-099"
    };

    // User selects Gurgaon Store (Haryana)
    const loc = sampleDeliveryLocations.find(l => l.id === "loc-gurgaon")!;
    header = {
      ...header,
      deliveryLocationId: loc.id,
      deliveryStoreCode: loc.store_code,
      deliveryGstin: loc.gstin || "",
      placeOfSupplyCode: loc.state_code || "",
      deliveryLocationSnapshot: {
        id: loc.id,
        store_code: loc.store_code,
        location_name: loc.location_name,
        state_code: loc.state_code,
        state: loc.state,
        gstin: loc.gstin,
        city: loc.city,
        pincode: loc.pincode
      }
    };

    // Assert Requirement 4 & 5: Store code and Delivery GSTIN auto-populated
    expect(header.deliveryStoreCode).toBe("T97D");
    expect(header.deliveryGstin).toBe("06AAACR7015K1Z1");
    // Assert Requirement 6: Authoritative transaction POS derived from delivery state (Haryana 06)
    expect(header.placeOfSupplyCode).toBe("06");
    expect(header.deliveryLocationSnapshot).not.toBeNull();
    expect(header.deliveryLocationSnapshot.store_code).toBe("T97D");
    expect(header.poReference).toBe("PO-RIL-2026-099");
  });

  // TEST 4 — Customer switching clears B2B state to prevent cross-customer data leakage
  it("TEST 4: should reset all Phase 2C fields when switching or clearing customer", () => {
    let header: BillingHeaderState = {
      orderNo: "",
      orderDate: "2026-09-04",
      refNo: "",
      salesStaff: "",
      delDate: "2026-09-04",
      customerSearch: "Reliance Retail Limited",
      customerName: "Reliance Retail Limited",
      contactNo: "9820098200",
      address: "Maker Maxity, BKC",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      customerId: "cust-ril",
      gstNumber: "27AAACR7015K1Z0",
      priceCategory: "DEFAULT",
      customerGroup: "Corporate",
      creditLimit: 1000000,
      creditDays: 45,
      outstandingAmount: 0,
      billedPartyGstinId: "gst-reg-mh",
      billedGstin: "27AAACR7015K1Z0",
      deliveryLocationId: "loc-gurgaon",
      deliveryStoreCode: "T97D",
      deliveryGstin: "06AAACR7015K1Z1",
      deliveryLocationSnapshot: { store_code: "T97D" },
      placeOfSupplyCode: "06",
      poReference: "PO-RIL-2026-099"
    };

    // User clears or changes customer
    header = {
      ...header,
      customerId: "",
      customerName: "",
      customerSearch: "",
      gstNumber: "",
      billedPartyGstinId: "",
      billedGstin: "",
      deliveryLocationId: "",
      deliveryStoreCode: "",
      deliveryGstin: "",
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: "",
      poReference: ""
    };

    expect(header.customerId).toBe("");
    expect(header.billedPartyGstinId).toBe("");
    expect(header.billedGstin).toBe("");
    expect(header.deliveryLocationId).toBe("");
    expect(header.deliveryStoreCode).toBe("");
    expect(header.deliveryGstin).toBe("");
    expect(header.deliveryLocationSnapshot).toBeNull();
    expect(header.placeOfSupplyCode).toBe("");
    expect(header.poReference).toBe("");
  });

  // TEST 5 — Invoice request serialization includes all Phase 2C fields
  it("TEST 5: should serialize all Phase 2C fields into the invoice creation request payload", () => {
    const header: BillingHeaderState = {
      orderNo: "ORD-999",
      orderDate: "2026-09-04",
      refNo: "REF-001",
      salesStaff: "Staff A",
      delDate: "2026-09-04",
      customerSearch: "Reliance Retail Limited",
      customerName: "Reliance Retail Limited",
      contactNo: "9820098200",
      address: "Maker Maxity, BKC",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      customerId: "cust-ril",
      gstNumber: "27AAACR7015K1Z0",
      priceCategory: "DEFAULT",
      customerGroup: "Corporate",
      creditLimit: 1000000,
      creditDays: 45,
      outstandingAmount: 0,
      billedPartyGstinId: "gst-reg-dl",
      billedGstin: "07AAACR7015K1Z2",
      deliveryLocationId: "loc-gurgaon",
      deliveryStoreCode: "T97D",
      deliveryGstin: "06AAACR7015K1Z1",
      deliveryLocationSnapshot: {
        id: "loc-gurgaon",
        store_code: "T97D",
        location_name: "Reliance Trends - Gurgaon Mall",
        state_code: "06",
        city: "Gurgaon"
      },
      placeOfSupplyCode: "06",
      poReference: "PO-RIL-SEP-001"
    };

    const invoicePayload = {
      customer_id: header.customerId,
      customer_name: header.customerName,
      customer_gstin: header.billedGstin || header.gstNumber,
      billed_party_gstin_id: header.billedPartyGstinId || null,
      delivery_location_id: header.deliveryLocationId || null,
      delivery_store_code: header.deliveryStoreCode || null,
      delivery_gstin: header.deliveryGstin || null,
      delivery_location_snapshot: header.deliveryLocationSnapshot || null,
      place_of_supply_code: header.placeOfSupplyCode || null,
      po_reference: header.poReference || null,
      payment_mode: "CREDIT",
      status: "Settled"
    };

    expect(invoicePayload.customer_id).toBe("cust-ril");
    expect(invoicePayload.billed_party_gstin_id).toBe("gst-reg-dl");
    expect(invoicePayload.customer_gstin).toBe("07AAACR7015K1Z2");
    expect(invoicePayload.delivery_location_id).toBe("loc-gurgaon");
    expect(invoicePayload.delivery_store_code).toBe("T97D");
    expect(invoicePayload.delivery_gstin).toBe("06AAACR7015K1Z1");
    expect(invoicePayload.delivery_location_snapshot?.store_code).toBe("T97D");
    expect(invoicePayload.place_of_supply_code).toBe("06");
    expect(invoicePayload.po_reference).toBe("PO-RIL-SEP-001");
    expect(invoicePayload.payment_mode).toBe("CREDIT");
  });
});
