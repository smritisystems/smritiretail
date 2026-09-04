/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.7.0
 * Created      : 2026-09-04
 * Modified     : 2026-09-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Customer Master State Synchronization & Active Customer Identity Tests
 */

import { describe, it, expect } from "vitest";
import { mapBackendCustomerToRecord } from "../components/customer/CustMasterWs.tsx";
import { RetailCustomerRecord } from "../components/customer/types.ts";

// Helper simulating the exact Customer Master identity-based state machine
class CustomerMasterStateManager {
  customers: RetailCustomerRecord[];
  currentIndex: number;
  currentCustomer: RetailCustomerRecord;
  activeCustomerId: string;
  isDirty: boolean;

  constructor(initialCustomers: RetailCustomerRecord[]) {
    this.customers = [...initialCustomers];
    this.currentIndex = 0;
    this.currentCustomer = this.customers[0] ? JSON.parse(JSON.stringify(this.customers[0])) : this.createDraft(1);
    this.activeCustomerId = this.currentCustomer.id;
    this.isDirty = false;
  }

  createDraft(codeNum: number): RetailCustomerRecord {
    return {
      id: `cust-draft-${Date.now()}`,
      code: `CUST-${String(codeNum).padStart(3, "0")}`,
      name: "",
      priceGroup: "TI#Tech Infotech Ltd",
      phone: "",
      email: "",
      customerGroupId: "CG-Retail",
      customer_group_id: "CG-Retail",
      religion: "Muslim",
      ethnicity: "Asian",
      ageGroup: ">=20 - <35",
      profession: "",
      customerType: "Retail",
      profileNotes: "",
      companyCode: "001",
      environment: "Retail",
      flatFileFormat: "GUI with Delimiter Format",
      isTaxInclusive: true,
      delimiter: ";",
      buyingFactor: 1.00,
      sellingFactor: 1.00,
      mailingAddresses: [],
      isDependant: false,
      primaryAccountCode: "",
      primaryAccountName: "",
      applyParentMailingInfo: false,
      dependants: [],
      gender: "Female",
      dateOfBirth: "",
      isMarried: false,
      weddingAnniversary: "",
      loyaltyPgmId: "024",
      loyaltyPgmCode: "DSC",
      loyaltyTier: "Standard",
      loyaltyPointsBalance: 0,
      paymentCategory: "CASH",
      paymentTerm: "Policy Not Configured",
      creditLimit: 0,
      creditDays: 0,
      creditUsed: 0,
      transportMode: "By-Road",
      transportCode: "VRL",
      transitDays: 2,
      bankCode: "",
      bankLocation: "",
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
      gstin: "",
      panNumber: "",
      isPreSaleFormApplicable: false,
      preSaleFormName: "",
      isPostSaleFormApplicable: false,
      postSaleFormName: "",
      status: "Active",
      createdAt: "2026-09-04",
      updatedAt: "2026-09-04"
    };
  }

  handleNew() {
    const draft = this.createDraft(this.customers.length + 1);
    this.activeCustomerId = draft.id;
    this.currentCustomer = draft;
    this.isDirty = true;
  }

  handleFieldChange(field: keyof RetailCustomerRecord, value: any) {
    this.currentCustomer = {
      ...this.currentCustomer,
      [field]: value
    };
    this.isDirty = true;
  }

  handleSave(savedBackendCust: any) {
    const rawSavedGstin = savedBackendCust?.gstNumber ?? savedBackendCust?.gst_number ?? savedBackendCust?.gstin ?? this.currentCustomer.gstin;
    const rawSavedLimit = savedBackendCust?.creditLimit ?? savedBackendCust?.credit_limit ?? this.currentCustomer.creditLimit;
    const rawSavedDays = savedBackendCust?.creditDays ?? savedBackendCust?.credit_days ?? this.currentCustomer.creditDays;
    const rawSavedTerm = savedBackendCust?.paymentTerm ?? savedBackendCust?.payment_term ?? this.currentCustomer.paymentTerm;
    const rawSavedGroupId = savedBackendCust?.customerGroupId ?? savedBackendCust?.customer_group_id ?? this.currentCustomer.customerGroupId;

    const recordToSave: RetailCustomerRecord = {
      ...this.currentCustomer,
      id: savedBackendCust?.id || this.currentCustomer.id,
      code: savedBackendCust?.code || this.currentCustomer.code,
      name: savedBackendCust?.name || this.currentCustomer.name,
      phone: savedBackendCust?.mobile || this.currentCustomer.phone,
      gstin: rawSavedGstin !== undefined && rawSavedGstin !== null ? String(rawSavedGstin).trim() : "",
      customerGroupId: rawSavedGroupId,
      customer_group_id: rawSavedGroupId,
      creditLimit: rawSavedLimit !== undefined && rawSavedLimit !== null ? Number(rawSavedLimit) : 0,
      creditDays: rawSavedDays !== undefined && rawSavedDays !== null ? Number(rawSavedDays) : 0,
      paymentTerm: rawSavedTerm !== undefined && rawSavedTerm !== null && String(rawSavedTerm).trim() !== ""
        ? String(rawSavedTerm).trim()
        : (rawSavedDays && Number(rawSavedDays) > 0 ? `Net ${rawSavedDays}` : "Policy Not Configured"),
      updatedAt: "2026-09-04"
    };

    const savedId = recordToSave.id;
    const savedCode = recordToSave.code;

    const updated = [...this.customers];
    const existingIndex = updated.findIndex(c => c.id === this.currentCustomer.id || c.code === this.currentCustomer.code || c.id === savedId || c.code === savedCode);

    let savedIndex: number;
    if (existingIndex >= 0) {
      updated[existingIndex] = recordToSave;
      savedIndex = existingIndex;
    } else {
      updated.push(recordToSave);
      savedIndex = updated.length - 1;
    }

    // Identity-anchored state synchronization
    this.setActiveCustomerIdentity(savedId, savedIndex, recordToSave);
    this.customers = updated;
    this.isDirty = false;
  }

  setActiveCustomerIdentity(id: string, index: number, record: RetailCustomerRecord) {
    this.activeCustomerId = id;
    this.currentIndex = index;
    this.currentCustomer = JSON.parse(JSON.stringify(record));
    this.isDirty = false;
  }

  handlePrev() {
    if (this.currentIndex > 0) {
      const newIdx = this.currentIndex - 1;
      const target = this.customers[newIdx];
      if (target) {
        this.setActiveCustomerIdentity(target.id, newIdx, target);
      }
    }
  }

  handleNext() {
    if (this.currentIndex < this.customers.length - 1) {
      const newIdx = this.currentIndex + 1;
      const target = this.customers[newIdx];
      if (target) {
        this.setActiveCustomerIdentity(target.id, newIdx, target);
      }
    }
  }

  selectRow(index: number) {
    const target = this.customers[index];
    if (target) {
      this.setActiveCustomerIdentity(target.id, index, target);
    }
  }

  // Identity-based reconciliation simulating loadCustomersFromBackend
  onBackendRefresh(refreshedRawList: any[]) {
    const mappedList = refreshedRawList.map(mapBackendCustomerToRecord);
    this.customers = mappedList;

    // Unsaved draft protection: Never let an async background refresh overwrite a newly initialized draft
    if (this.activeCustomerId.startsWith("cust-draft-") || this.currentCustomer.id.startsWith("cust-draft-")) {
      return;
    }

    // Reconcile by stable ID first, then code — NEVER by array index
    const matchIndex = mappedList.findIndex(
      c => (this.activeCustomerId && c.id === this.activeCustomerId) ||
           (this.currentCustomer?.id && c.id === this.currentCustomer.id) ||
           (this.currentCustomer?.code && c.code === this.currentCustomer.code)
    );

    if (matchIndex >= 0) {
      const matched = mappedList[matchIndex];
      this.currentIndex = matchIndex;
      this.activeCustomerId = matched.id;
      if (!this.isDirty) {
        this.currentCustomer = JSON.parse(JSON.stringify(matched));
      }
    }
  }
}

describe("Customer Master Save/Rehydration State Synchronization Tests", () => {
  const seedCustomerA = mapBackendCustomerToRecord({
    id: "cust-001",
    code: "CUST-001",
    name: "Reliance Retail Limited",
    customer_group_id: "CG-LargeRetail",
    credit_limit: 1000000,
    credit_days: 60,
    gst_number: "29AABCR1718E1ZL",
    status: "Active"
  });

  const seedCustomerB = mapBackendCustomerToRecord({
    id: "cust-002",
    code: "CUST-002",
    name: "Shoppers Stop Ltd",
    customer_group_id: "CG-LargeRetail",
    credit_limit: 1000000,
    credit_days: 60,
    gst_number: "27AAACS4321E1Z2",
    status: "Active"
  });

  // TEST 1 — New Customer Save + Async Refresh
  it("Test 1: must maintain newly saved Corporate customer after background list refresh", () => {
    const sm = new CustomerMasterStateManager([seedCustomerA, seedCustomerB]);
    expect(sm.currentIndex).toBe(0);
    expect(sm.currentCustomer.code).toBe("CUST-001");

    // 1. Operator clicks New Customer
    sm.handleNew();
    expect(sm.activeCustomerId.startsWith("cust-draft-")).toBe(true);

    // 2. Operator fills in Corporate details on Tab 1 & Tab 3
    sm.handleFieldChange("name", "Apex Logistics India Ltd - Human UAT");
    sm.handleFieldChange("customerType", "Corporate");
    sm.handleFieldChange("customerGroupId", "CG-Corporate");
    sm.handleFieldChange("gstin", "27AABCA1234F1Z5");

    // 3. Operator clicks Save -> FastAPI response received with camelCase DTO aliases
    const fastapiResponse = {
      id: "cust-ea839db6",
      code: "CUST-066",
      name: "Apex Logistics India Ltd - Human UAT",
      customerGroupId: "CG-Corporate",
      gstNumber: "27AABCA1234F1Z5",
      creditLimit: 500000.0,
      creditDays: 60,
      paymentTerm: "Net 60",
      status: "Active",
      tags: ["Corporate", "B2B"]
    };

    sm.handleSave(fastapiResponse);

    // Immediately after save:
    expect(sm.currentCustomer.id).toBe("cust-ea839db6");
    expect(sm.currentCustomer.code).toBe("CUST-066");
    expect(sm.currentCustomer.gstin).toBe("27AABCA1234F1Z5");
    expect(sm.currentCustomer.customerGroupId).toBe("CG-Corporate");
    expect(sm.currentCustomer.creditLimit).toBe(500000);
    expect(sm.currentCustomer.creditDays).toBe(60);

    // 4. Background refresh triggers from smriti_customer_updated event
    const backendRefreshedList = [
      { id: "cust-001", code: "CUST-001", name: "Reliance Retail Limited", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "29AABCR1718E1ZL" },
      { id: "cust-002", code: "CUST-002", name: "Shoppers Stop Ltd", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "27AAACS4321E1Z2" },
      { id: "cust-ea839db6", code: "CUST-066", name: "Apex Logistics India Ltd - Human UAT", customer_group_id: "CG-Corporate", credit_limit: 500000, credit_days: 60, gst_number: "27AABCA1234F1Z5" }
    ];

    sm.onBackendRefresh(backendRefreshedList);

    // ASSERT: currentCustomer still represents newly saved customer, NOT overwritten!
    expect(sm.currentCustomer.id).toBe("cust-ea839db6");
    expect(sm.currentCustomer.code).toBe("CUST-066");
    expect(sm.currentCustomer.gstin).toBe("27AABCA1234F1Z5");
    expect(sm.currentCustomer.customerGroupId).toBe("CG-Corporate");
    expect(sm.currentCustomer.creditLimit).toBe(500000);
    expect(sm.currentCustomer.creditDays).toBe(60);

    // MUST NOT revert to empty placeholder or legacy fallbacks:
    expect(sm.currentCustomer.gstin).not.toBe("");
    expect(sm.currentCustomer.creditLimit).not.toBe(25000);
    expect(sm.currentCustomer.creditDays).not.toBe(0);
  });

  // TEST 2 — Array Reordering Safety
  it("Test 2: must reconcile active customer by stable ID even when array ordering changes", () => {
    const sm = new CustomerMasterStateManager([seedCustomerA, seedCustomerB]);

    // Operator clicks New Customer
    sm.handleNew();

    // Save a new customer at end of array (index 2)
    const savedCust = {
      id: "cust-066",
      code: "CUST-066",
      name: "Apex Corporate",
      customerGroupId: "CG-Corporate",
      gstNumber: "27AABCA1234F1Z5",
      creditLimit: 500000.0,
      creditDays: 60,
      status: "Active"
    };
    sm.handleSave(savedCust);
    expect(sm.currentIndex).toBe(2);
    expect(sm.activeCustomerId).toBe("cust-066");

    // Backend returns list where CUST-066 is at INDEX 0 (e.g. sorted differently by heap or filter)
    const reorderedList = [
      { id: "cust-066", code: "CUST-066", name: "Apex Corporate", customer_group_id: "CG-Corporate", credit_limit: 500000, credit_days: 60, gst_number: "27AABCA1234F1Z5" },
      { id: "cust-001", code: "CUST-001", name: "Reliance Retail Limited", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "29AABCR1718E1ZL" },
      { id: "cust-002", code: "CUST-002", name: "Shoppers Stop Ltd", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "27AAACS4321E1Z2" }
    ];

    sm.onBackendRefresh(reorderedList);

    // ASSERT: Active customer remains CUST-066 by ID, and currentIndex is updated to 0
    expect(sm.activeCustomerId).toBe("cust-066");
    expect(sm.currentCustomer.id).toBe("cust-066");
    expect(sm.currentCustomer.gstin).toBe("27AABCA1234F1Z5");
    expect(sm.currentIndex).toBe(0);
  });

  // TEST 3 — Existing Customer Navigation
  it("Test 3: must update currentCustomer and activeCustomerId synchronously upon user navigation", () => {
    const sm = new CustomerMasterStateManager([seedCustomerA, seedCustomerB]);
    expect(sm.activeCustomerId).toBe("cust-001");
    expect(sm.currentCustomer.code).toBe("CUST-001");

    // Navigate to next customer
    sm.handleNext();
    expect(sm.currentIndex).toBe(1);
    expect(sm.activeCustomerId).toBe("cust-002");
    expect(sm.currentCustomer.code).toBe("CUST-002");

    // Navigate back to previous customer
    sm.handlePrev();
    expect(sm.currentIndex).toBe(0);
    expect(sm.activeCustomerId).toBe("cust-001");
    expect(sm.currentCustomer.code).toBe("CUST-001");

    // Select row from directory
    sm.selectRow(1);
    expect(sm.currentIndex).toBe(1);
    expect(sm.activeCustomerId).toBe("cust-002");
    expect(sm.currentCustomer.code).toBe("CUST-002");
  });

  // TEST 4 — New Customer Draft Protection
  it("Test 4: must protect newly created drafts from being overwritten by async background refresh", () => {
    const sm = new CustomerMasterStateManager([seedCustomerA, seedCustomerB]);
    expect(sm.currentIndex).toBe(0);

    // Operator clicks New Customer
    sm.handleNew();
    expect(sm.activeCustomerId.startsWith("cust-draft-")).toBe(true);

    // Operator enters form details
    sm.handleFieldChange("name", "Unsaved Draft Corp");
    sm.handleFieldChange("gstin", "27AABCA9999F1Z0");
    sm.handleFieldChange("creditLimit", 750000);

    // Background refresh occurs before Save is clicked
    const backendList = [
      { id: "cust-001", code: "CUST-001", name: "Reliance Retail Limited", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "29AABCR1718E1ZL" },
      { id: "cust-002", code: "CUST-002", name: "Shoppers Stop Ltd", customer_group_id: "CG-LargeRetail", credit_limit: 1000000, credit_days: 60, gst_number: "27AAACS4321E1Z2" }
    ];
    sm.onBackendRefresh(backendList);

    // ASSERT: Draft was NOT overwritten by customers[0] or any existing customer
    expect(sm.activeCustomerId.startsWith("cust-draft-")).toBe(true);
    expect(sm.currentCustomer.name).toBe("Unsaved Draft Corp");
    expect(sm.currentCustomer.gstin).toBe("27AABCA9999F1Z0");
    expect(sm.currentCustomer.creditLimit).toBe(750000);
    expect(sm.currentCustomer.code).not.toBe("CUST-001");
  });
});
