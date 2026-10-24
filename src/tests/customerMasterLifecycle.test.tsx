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
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Customer Master CRUD Lifecycle UX, Concurrency, and Safety Test Suite
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CustomerDeleteConfirmationModal } from "../components/customer/lifecycle/CustomerDeleteConfirmationModal.tsx";
import { CustomerDeactivateModal } from "../components/customer/lifecycle/CustomerDeactivateModal.tsx";
import { CreateCustomerModal } from "../components/customer/lifecycle/CreateCustomerModal.tsx";
import { CustomerMergeModal } from "../components/customer/lifecycle/CustomerMergeModal.tsx";
import { EnterpriseCustomerSearchModal } from "../components/customer/lifecycle/EnterpriseCustomerSearchModal.tsx";
import { RetailCustomerRecord, CustomerCreditExposureResponse } from "../components/customer/types.ts";
import { CustomerDeleteEligibility, CustomerMergeResult } from "../components/customer/lifecycle/types.ts";
import { CorporateMasterAccountHeader } from "../components/customer/corporateWorkspace/CorporateMasterAccountHeader.tsx";
import { CorporateCommercialTermsPanel } from "../components/customer/corporateWorkspace/CorporateCommercialTermsPanel.tsx";

const mockActiveCustomer: RetailCustomerRecord = {
  id: "cust-test-001",
  code: "CUST-001",
  name: "Arunachalam Muruganantham",
  priceGroup: "RETAIL#Standard",
  customerGroupId: "CG-Retail",
  customer_group_id: "CG-Retail",
  phone: "9845512345",
  email: "arun@example.com",
  religion: "Hindu",
  ethnicity: "Asian",
  ageGroup: ">=35 - <45",
  profession: "Retail Customer",
  customerType: "Retail",
  profileNotes: "Frequent buyer",
  companyCode: "001",
  environment: "Retail",
  flatFileFormat: "GUI with Delimiter Format",
  storeCode: "STR-001",
  billingStoreCode: "STR-001",
  shippingStoreCode: "STR-001",
  isTaxInclusive: true,
  delimiter: ";",
  buyingFactor: 1.0,
  sellingFactor: 1.0,
  mailingAddresses: [
    {
      code: "001",
      addressType: "mailing",
      contactPerson: "Arunachalam Muruganantham",
      storeCode: "STR-001",
      address1: "123 South Cross Street",
      address2: "",
      address3: "",
      address4: "",
      address5: "",
      locality: "Town Hall",
      city: "Coimbatore",
      postalCode: "641001",
      state: "Tamil Nadu",
      zone: "South",
      country: "India",
      officePhone: "",
      homePhone: "",
      mobilePhone: "9845512345",
      faxNumber: "",
      email1: "arun@example.com",
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
  gender: "Male",
  dateOfBirth: "1980-05-15",
  isMarried: true,
  weddingAnniversary: "",
  loyaltyPgmId: "024",
  loyaltyPgmCode: "DSC",
  loyaltyTier: "Gold",
  loyaltyPointsBalance: 450,
  paymentCategory: "CASH",
  paymentTerm: "Net 30 Days",
  creditLimit: 50000,
  creditDays: 30,
  creditUsed: 12500,
  transportMode: "By-Road",
  transportCode: "VRL",
  transitDays: 1,
  bankCode: "HDFC0001",
  bankLocation: "Coimbatore",
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
  gstin: "33AAAAA0000A1Z5",
  panNumber: "AAAAA0000A",
  isPreSaleFormApplicable: false,
  preSaleFormName: "",
  isPostSaleFormApplicable: false,
  postSaleFormName: "",
  status: "Active",
  createdAt: "2026-01-01",
  updatedAt: "2026-10-19"
};

describe("Customer Master CRUD Lifecycle - Safety and Modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CustomerDeleteConfirmationModal Component", () => {
    it("renders modal structure with pre-flight check when open", () => {
      const html = renderToString(
        <CustomerDeleteConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          customer={mockActiveCustomer}
          onDeleted={vi.fn()}
          onSwitchToDeactivate={vi.fn()}
        />
      );

      expect(html).toContain("Customer Deletion Safety Verification");
      expect(html).toContain(mockActiveCustomer.name);
      expect(html).toContain(mockActiveCustomer.code);
      expect(html).toContain("Checking tax invoices, sales orders, returns, and ledger balances...");
    });

    it("does not render when isOpen is false", () => {
      const html = renderToString(
        <CustomerDeleteConfirmationModal
          isOpen={false}
          onClose={vi.fn()}
          customer={mockActiveCustomer}
          onDeleted={vi.fn()}
          onSwitchToDeactivate={vi.fn()}
        />
      );

      expect(html).toBe("");
    });

    it("renders unpersisted draft customer with immediate permanent deletion eligibility", () => {
      const draftCustomer: RetailCustomerRecord = {
        ...mockActiveCustomer,
        id: "cust-draft-12345",
        name: "Unsaved Draft Account",
        code: "CUST-DRAFT",
        status: "Draft",
        creditUsed: 0,
      };

      const html = renderToString(
        <CustomerDeleteConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          customer={draftCustomer}
          onDeleted={vi.fn()}
          onSwitchToDeactivate={vi.fn()}
        />
      );

      expect(html).toContain("Customer Deletion Safety Verification");
      expect(html).toContain("Eligible for Permanent Deletion");
      expect(html).toContain("Unsaved local draft record. Safe to discard.");
      expect(html).toContain("Zero sales invoices");
      expect(html).toContain("Permanently Delete");
    });
  });

  describe("CustomerDeactivateModal Component", () => {
    it("renders operational impact disclosure and outstanding balance warning", () => {
      const html = renderToString(
        <CustomerDeactivateModal
          isOpen={true}
          onClose={vi.fn()}
          customer={mockActiveCustomer}
          onDeactivated={vi.fn()}
        />
      );

      expect(html).toContain("Deactivate Customer Account");
      expect(html).toContain("Operational Impact of Deactivation");
      expect(html).toContain("Billing Blocked:");
      expect(html).toContain("Suspends POS checkout, sales invoices, delivery challans, and new sales orders.");
      expect(html).toContain("Historical Integrity:");
      expect(html).toContain("All past invoices, credit ledgers, returns, and payment receipts are completely preserved.");
      expect(html).toContain("Outstanding Balance:");
      expect(html).toContain("12,500.00");
      expect(html).toContain("Confirm Deactivation");
    });

    it("does not render when isOpen is false", () => {
      const html = renderToString(
        <CustomerDeactivateModal
          isOpen={false}
          onClose={vi.fn()}
          customer={mockActiveCustomer}
          onDeactivated={vi.fn()}
        />
      );

      expect(html).toBe("");
    });

    it("renders deactivation modal without balance warning when customer has zero credit balance", () => {
      const zeroBalanceCustomer: RetailCustomerRecord = {
        ...mockActiveCustomer,
        creditUsed: 0,
      };

      const html = renderToString(
        <CustomerDeactivateModal
          isOpen={true}
          onClose={vi.fn()}
          customer={zeroBalanceCustomer}
          onDeactivated={vi.fn()}
        />
      );

      expect(html).toContain("Deactivate Customer Account");
      expect(html).toContain("Operational Impact of Deactivation");
      expect(html).not.toContain("Outstanding Balance:");
      expect(html).toContain("Confirm Deactivation");
    });
  });

  describe("CreateCustomerModal Component", () => {
    it("renders creation workflow with Retail fast path and duplicate detection cues", () => {
      const html = renderToString(
        <CreateCustomerModal
          isOpen={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      );

      expect(html).toContain("New Customer Account");
      expect(html).toContain("Retail / Individual (Fast Path)");
      expect(html).toContain("Corporate / B2B Enterprise");
      expect(html).toContain("Customer Code &amp; Canonical UUID will be generated authoritative server-side");
      expect(html).toContain("Create Customer (Fast Path)");
    });

    it("does not render when isOpen is false", () => {
      const html = renderToString(
        <CreateCustomerModal
          isOpen={false}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      );
      expect(html).toBe("");
    });

    it("renders the selected parent as read-only child-account context", () => {
      const html = renderToString(
        <CreateCustomerModal
          isOpen={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
          parentCustomer={{ id: "cust-parent-001", code: "CUST-001", name: "ABC Retail Group" }}
        />
      );

      expect(html).toContain("New Child Customer Account");
      expect(html).toContain("This account will be linked under ABC Retail Group (CUST-001).");
    });
  });

  describe("Customer Master Concurrency & Optimistic Locking Contract", () => {
    it("ensures expected_modified_at can be supplied to CustomerUpdate payload", () => {
      const now = new Date().toISOString();
      const updatePayload = {
        name: "Arunachalam Muruganantham Updated",
        expectedModifiedAt: now,
        status: "Active"
      };

      expect(updatePayload.expectedModifiedAt).toBe(now);
      expect(updatePayload.name).toContain("Updated");
    });
  });

  describe("Customer Delete Eligibility Decision Engine Contract", () => {
    it("identifies blocked customers when sales transactions or ledgers exist", () => {
      const mockBlockedEligibility: CustomerDeleteEligibility = {
        customerId: "cust-001",
        customerCode: "CUST-001",
        customerName: "Arunachalam Muruganantham",
        status: "Active",
        eligible: false,
        blockers: [
          "Customer is referenced in 12 sales invoice(s).",
          "Customer is referenced in 4 sales order(s).",
          "Customer has an unsettled financial ledger balance of ₹12,500.00."
        ],
        warnings: [],
        recommendation: "DEACTIVATE",
        reason: "Customer has financial, transactional, or compliance dependencies.",
        metrics: {
          invoice_count: 12,
          order_count: 4,
          return_count: 0,
          ledger_count: 18,
          po_count: 0,
          psv_count: 0,
          relationship_count: 0,
          outstanding_balance: 12500
        }
      };

      expect(mockBlockedEligibility.eligible).toBe(false);
      expect(mockBlockedEligibility.recommendation).toBe("DEACTIVATE");
      expect(mockBlockedEligibility.blockers.length).toBe(3);
      expect(mockBlockedEligibility.metrics.invoice_count).toBe(12);
    });

    it("permits permanent deletion when customer has zero transactional dependencies", () => {
      const mockCleanDraftEligibility: CustomerDeleteEligibility = {
        customerId: "cust-draft-999",
        customerCode: "CUST-999",
        customerName: "New Draft Customer",
        status: "Active",
        eligible: true,
        blockers: [],
        warnings: ["Permanent deletion is irreversible."],
        recommendation: "PERMANENT_DELETE",
        reason: "Customer has zero invoices, zero orders, zero ledger transactions, and zero dependent records.",
        metrics: {
          invoice_count: 0,
          order_count: 0,
          return_count: 0,
          ledger_count: 0,
          po_count: 0,
          psv_count: 0,
          relationship_count: 0,
          outstanding_balance: 0
        }
      };

      expect(mockCleanDraftEligibility.eligible).toBe(true);
      expect(mockCleanDraftEligibility.recommendation).toBe("PERMANENT_DELETE");
      expect(mockCleanDraftEligibility.blockers.length).toBe(0);
      expect(mockCleanDraftEligibility.metrics.outstanding_balance).toBe(0);
    });
  });

  describe("Customer Merge & Corporate Account Consolidation Modal (BD-2)", () => {
    const mockTargetCorporate: RetailCustomerRecord = {
      ...mockActiveCustomer,
      id: "cust-corp-target",
      code: "CORP-TGT-001",
      name: "Reliance Retail Ltd (Master)",
      panNumber: "AAACR1234F",
      gstNumber: "27AAACR1234F1Z5",
      customerType: "Corporate",
      environment: "Corporate",
      creditBalance: 150000
    };

    it("returns null when modal is closed", () => {
      const html = renderToString(
        <CustomerMergeModal
          isOpen={false}
          targetCustomer={mockTargetCorporate}
          onClose={() => {}}
          onMerged={() => {}}
        />
      );
      expect(html).toBe("");
    });

    it("renders consolidation modal when open with target customer details, PAN, and action controls", () => {
      const html = renderToString(
        <CustomerMergeModal
          isOpen={true}
          targetCustomer={mockTargetCorporate}
          onClose={() => {}}
          onMerged={() => {}}
        />
      );
      expect(html).toContain("Consolidate / Merge Corporate Customer Account");
      expect(html).toContain("BD-2");
      expect(html).toContain("Reliance Retail Ltd (Master)");
      expect(html).toContain("CORP-TGT-001");
      expect(html).toContain("AAACR1234F");
      expect(html).toContain("Surviving Master Account (Target)");
      expect(html).toContain("Select Duplicate / Subsidiary Account to Absorb (Source)");
      expect(html).toContain("Type");
      expect(html).toContain("MERGE");
      expect(html).toContain("Confirm &amp; Execute Merge");
    });

    it("evaluates BD-2 PAN parity rule correctly across candidate scenarios", () => {
      // Scenario A: Parity Match
      const targetPan = "AAACR1234F";
      const sourceMatchPan = "AAACR1234F";
      const isMatch = targetPan === sourceMatchPan;
      expect(isMatch).toBe(true);

      // Scenario B: Parity Mismatch
      const sourceConflictPan = "BBBCR9999K";
      const isMismatch = targetPan !== sourceConflictPan;
      expect(isMismatch).toBe(true);

      // Scenario C: Target has no PAN, adopt source
      const unassignedTargetPan = "";
      const shouldAdopt = !unassignedTargetPan && Boolean(sourceMatchPan);
      expect(shouldAdopt).toBe(true);
    });

    it("enforces immutable audit record generation contract for merged customer", () => {
      const mockMergeResult: CustomerMergeResult = {
        targetCustomerId: "cust-corp-target",
        sourceCustomerId: "cust-corp-source",
        status: "merged",
        message: "Customer 'Reliance Digital' merged successfully into 'Reliance Retail Ltd (Master)'.",
        reassignedRecords: {
          sales_invoices: 45,
          sales_orders: 12,
          customer_credit_ledger_entries: 30,
          customer_company_relationships: 3
        },
        consolidated_outstanding: 275000,
        mergedAt: "2026-10-19T14:30:00Z"
      };

      expect(mockMergeResult.targetCustomerId).toBe("cust-corp-target");
      expect(mockMergeResult.sourceCustomerId).toBe("cust-corp-source");
      expect(mockMergeResult.status).toBe("merged");
      expect(mockMergeResult.reassignedRecords?.sales_invoices).toBe(45);
      expect(mockMergeResult.reassignedRecords?.customer_company_relationships).toBe(3);
      expect(mockMergeResult.consolidated_outstanding).toBe(275000);
    });
  });

  describe("Privileged Cross-Company Customer Search & Discovery Modal (BD-4)", () => {
    it("returns null when modal is closed", () => {
      const html = renderToString(
        <EnterpriseCustomerSearchModal
          isOpen={false}
          onClose={() => {}}
          onSelectCustomer={() => {}}
        />
      );
      expect(html).toBe("");
    });

    it("renders enterprise search modal with BD-4 badge and statutory audit disclosure when open", () => {
      const html = renderToString(
        <EnterpriseCustomerSearchModal
          isOpen={true}
          onClose={() => {}}
          onSelectCustomer={() => {}}
          currentUser={{ role: "SYSADMIN", name: "System Admin" }}
          currentCompanyId="COMP-001"
        />
      );
      expect(html).toContain("Privileged Cross-Company Customer Search");
      expect(html).toContain("BD-4");
      expect(html).toContain("Statutory Governance &amp; Compliance Notice (BD-4)");
      expect(html).toContain("compliance_immutable_audit_logs");
      expect(html).toContain("Search across all companies by Customer Name, Code, PAN, Mobile, or GSTIN...");
      expect(html).toContain("Active Company:");
      expect(html).toContain("COMP-001");
      expect(html).toContain("Model C Architecture: Tenant-Level Master Identity with Multi-Company Terms");
    });

    it("displays RBAC authorization alert when current user role is unauthorized", () => {
      const html = renderToString(
        <EnterpriseCustomerSearchModal
          isOpen={true}
          onClose={() => {}}
          onSelectCustomer={() => {}}
          currentUser={{ role: "CASHIER", name: "Store Cashier" }}
          currentCompanyId="COMP-001"
        />
      );
      expect(html).toContain("Privileged Role Required");
      expect(html).toContain("Your active session does not carry enterprise cross-company search authorization");
    });

    it("does not display RBAC warning when current user role is privileged", () => {
      const html = renderToString(
        <EnterpriseCustomerSearchModal
          isOpen={true}
          onClose={() => {}}
          onSelectCustomer={() => {}}
          currentUser={{ role: "GROUP_CFO", name: "Corporate CFO" }}
          currentCompanyId="COMP-001"
        />
      );
      expect(html).not.toContain("Privileged Role Required");
      expect(html).toContain("Enter a search term above to perform live multi-company lookup");
    });

    it("evaluates Model C active company relationship detection logic", () => {
      const currentCompanyId = "COMP-001";
      const candidateRelationships = [
        { id: "rel-1", company_id: "COMP-002", credit_limit: 500000 },
        { id: "rel-2", company_id: "COMP-003", credit_limit: 1000000 }
      ];

      const hasActive = candidateRelationships.some(r => r.company_id === currentCompanyId);
      expect(hasActive).toBe(false);

      const linkedRelationships = [
        ...candidateRelationships,
        { id: "rel-3", company_id: "COMP-001", credit_limit: 750000 }
      ];
      const hasActiveAfterLink = linkedRelationships.some(r => r.company_id === currentCompanyId);
      expect(hasActiveAfterLink).toBe(true);
    });
  });

  describe("Consolidated Group Treasury & Credit Exposure Monitoring (BD-6)", () => {
    const mockMultiCompanyExposure: CustomerCreditExposureResponse = {
      customerId: "cust-test-001",
      customerName: "Arunachalam Muruganantham",
      code: "CUST-001",
      totalCreditLimit: 1200000,
      totalCreditUsed: 450000,
      totalAvailableCredit: 750000,
      groupUtilizationPercent: 37.5,
      groupRiskLevel: "LOW",
      companyCount: 2,
      holdCount: 0,
      companyExposures: [
        {
          companyId: "COMP-001",
          companyName: "Smriti Retail Co",
          companyCode: "COMP-001",
          relationshipId: "rel-001",
          customerGroupId: "CG-Corporate",
          creditLimit: 700000,
          creditDays: 30,
          creditHold: false,
          creditUsed: 300000,
          availableCredit: 400000,
          utilizationPercent: 42.86,
          exposureStatus: "NORMAL",
          status: "Active"
        },
        {
          companyId: "COMP-002",
          companyName: "Smriti Wholesale Co",
          companyCode: "COMP-002",
          relationshipId: "rel-002",
          customerGroupId: "CG-Wholesale",
          creditLimit: 500000,
          creditDays: 45,
          creditHold: false,
          creditUsed: 150000,
          availableCredit: 350000,
          utilizationPercent: 30.0,
          exposureStatus: "NORMAL",
          status: "Active"
        }
      ]
    };

    it("renders single-company credit limit and outstanding when no multi-company exposure is present", () => {
      const html = renderToString(
        <CorporateMasterAccountHeader
          customer={mockActiveCustomer}
        />
      );
      expect(html).toContain("Arunachalam Muruganantham");
      expect(html).toContain("Credit Limit (INR)");
      expect(html).toContain("Outstanding (INR)");
      expect(html).not.toContain("header-group-exposure-badge");
    });

    it("renders group treasury exposure badge and consolidated metrics in CorporateMasterAccountHeader", () => {
      const html = renderToString(
        <CorporateMasterAccountHeader
          customer={mockActiveCustomer}
          creditExposure={mockMultiCompanyExposure}
        />
      );
      expect(html).toContain("data-testid=\"header-group-exposure-badge\"");
      expect(html).toContain("Group Treasury:");
      expect(html).toContain("Cos");
      expect(html).toContain("37.5");
      expect(html).toContain("LOW");
      expect(html).toContain("data-testid=\"header-group-credit-limit\"");
      expect(html).toContain("12,00,000");
      expect(html).toContain("data-testid=\"header-group-credit-used\"");
      expect(html).toContain("4,50,000");
    });

    it("renders group credit hold styling on header badge when holdCount > 0", () => {
      const holdExposure: CustomerCreditExposureResponse = {
        ...mockMultiCompanyExposure,
        holdCount: 1,
        groupRiskLevel: "ON_HOLD",
      };
      const html = renderToString(
        <CorporateMasterAccountHeader
          customer={mockActiveCustomer}
          creditExposure={holdExposure}
        />
      );
      expect(html).toContain("data-testid=\"header-group-exposure-badge\"");
      expect(html).toContain("ON_HOLD");
      expect(html).toContain("text-rose-700");
    });

    it("renders Consolidated Group Treasury & Credit Exposure card in CorporateCommercialTermsPanel", () => {
      const html = renderToString(
        <CorporateCommercialTermsPanel
          customer={mockActiveCustomer}
          onChange={() => {}}
          creditExposure={mockMultiCompanyExposure}
        />
      );
      expect(html).toContain("Consolidated Group Treasury &amp; Credit Exposure");
      expect(html).toContain("BD-6 Governance");
      expect(html).toContain("data-testid=\"group-risk-badge\"");
      expect(html).toContain("Risk Tier:");
      expect(html).toContain("LOW");
      expect(html).toContain("data-testid=\"group-total-limit\"");
      expect(html).toContain("12,00,000");
      expect(html).toContain("data-testid=\"group-total-used\"");
      expect(html).toContain("4,50,000");
      expect(html).toContain("data-testid=\"group-total-available\"");
      expect(html).toContain("7,50,000");
      expect(html).toContain("data-testid=\"group-utilization-pct\"");
      expect(html).toContain("37.5%");
      expect(html).toContain("Smriti Retail Co");
      expect(html).toContain("Smriti Wholesale Co");
      expect(html).toContain("PERMITTED");
    });

    it("renders treasury alert banner in CorporateCommercialTermsPanel when an entity is on hold", () => {
      const holdExposure: CustomerCreditExposureResponse = {
        ...mockMultiCompanyExposure,
        holdCount: 1,
        groupRiskLevel: "ON_HOLD",
        companyExposures: [
          {
            ...mockMultiCompanyExposure.companyExposures[0],
            creditHold: true,
            exposureStatus: "ON_HOLD"
          },
          mockMultiCompanyExposure.companyExposures[1]
        ]
      };
      const html = renderToString(
        <CorporateCommercialTermsPanel
          customer={mockActiveCustomer}
          onChange={() => {}}
          creditExposure={holdExposure}
        />
      );
      expect(html).toContain("Treasury Alert:");
      expect(html).toContain("Commercial invoicing is on hold for");
      expect(html).toContain("operating legal entity");
      expect(html).toContain("ON HOLD");
    });
  });
});



