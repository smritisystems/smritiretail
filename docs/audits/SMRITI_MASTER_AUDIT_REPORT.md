<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS - Production Readiness Master Audit

**Date:** 2026-07-10
**Role:** CTO & Senior ERP Solution Architect
**Objective:** Evaluate SMRITI Retail OS for production readiness, focusing on simplicity, automation, and reliable business workflows without over-complicating accounting.

---

## 1. Module: Sales & POS (Checkout Workflow)
* **Current Behaviour:** The POS checkout deducts stock from the item master and records a bill, but does not explicitly integrate with a robust Customer Ledger for credit sales or handle multi-tender payments effectively.
* **Problem:** Walk-in sales are fine, but credit sales (Udhaar) lack a direct automated link to a Customer Outstanding Ledger.
* **Business Impact:** High risk of untracked credit, delayed collections, and manual reconciliation errors.
* **Severity:** High
* **Recommended Solution:** Introduce a `PaymentVoucher` and `CustomerLedgerEntry`. If the checkout is marked as 'Credit', auto-post a Debit to the Customer Ledger.
* **Development Effort:** Medium (Add Ledger tables and POS payment split UI).
* **Dependencies:** CRM Customer Master.
* **Acceptance Criteria:** A credit sale immediately increases the customer's outstanding balance, visible in the CRM.
* **Test Scenarios:** Process a split payment (50% Cash, 50% Credit) -> Verify Cash Book increases by 50% -> Verify Customer Ledger debited by 50%.

## 2. Module: Purchase & Inventory (GRN Workflow)
* **Current Behaviour:** Receiving a Purchase Order increments stock and updates the Stock Ledger. However, there is no automated posting to the Vendor Ledger (Accounts Payable).
* **Problem:** Stock is received, but the financial liability to the supplier is not recorded until manually tracked.
* **Business Impact:** Missing vendor liabilities leading to payment delays or duplicate payments.
* **Severity:** Critical
* **Recommended Solution:** Upon GRN approval, auto-generate a `VendorBill` and post a Credit to the `VendorLedger`.
* **Development Effort:** Medium.
* **Dependencies:** Supplier Master, Chart of Accounts (simplified).
* **Acceptance Criteria:** GRN completion automatically reflects in the Supplier's outstanding payable balance.
* **Test Scenarios:** Receive partial GRN -> Check Vendor Ledger reflects liability only for received quantity.

## 3. Module: Third-Party Inventory (Franchise & Consignment)
* **Current Behaviour:** Handled via a static `PsvTab` (Party Stock Visibility) showing aggregate metrics.
* **Problem:** No actual dispatch workflow. Stock sits in a generic "Stock" field, not segregated by location or ownership (Company vs. Franchise).
* **Business Impact:** Shrinkage at franchise locations cannot be audited. Settlement is completely manual.
* **Severity:** High
* **Recommended Solution:** Implement a `Location` dimension to the `StockLedger`. Build a `Dispatch Challan` workflow that moves stock from "Main WH" to "Franchise A" while retaining ownership.
* **Development Effort:** High (Core inventory refactoring).
* **Dependencies:** Stock Ledger, Item Master.
* **Acceptance Criteria:** Dispatching 10 units reduces Main WH stock by 10 and increases Franchise A stock by 10 without recognizing revenue yet.
* **Test Scenarios:** Dispatch stock -> Verify inventory location changes -> Franchise registers sale -> Auto-generate settlement invoice.

## 4. Module: Master Data & Audit Trails
* **Current Behaviour:** Basic audit logs exist, but do not capture every state change across all modules (e.g., changes to Approval Matrices or Document Series).
* **Problem:** Lack of complete traceability for system configuration changes.
* **Business Impact:** Security risks and inability to track malicious or accidental misconfigurations.
* **Severity:** Medium
* **Recommended Solution:** Implement a global middleware/interceptor that logs every `POST`, `PUT`, `DELETE` action across the API to the `AuditLog` table.
* **Development Effort:** Low (Centralized API middleware).
* **Dependencies:** Audit Logs module.
* **Acceptance Criteria:** Changing a tax rate in the Item Master creates an immutable log with `OldValue` and `NewValue`.
* **Test Scenarios:** Update product price -> Check Audit Logs -> Verify old and new prices are accurate.

## 5. Module: Staff & HR
* **Current Behaviour:** Basic profiles exist, but attendance and payroll are not linked to the accounting system.
* **Problem:** Commissions are calculated but payouts are manual and not expensed automatically.
* **Business Impact:** High manual overhead for HR and Accounts at month-end.
* **Severity:** Medium
* **Recommended Solution:** Build an automated month-end `Payroll Run` that aggregates attendance and commissions, then auto-posts a `PaymentVoucher` to the Cash/Bank book and `ExpenseLedger`.
* **Development Effort:** Medium.
* **Dependencies:** Staff Master, Finance Ledger.
* **Acceptance Criteria:** Approving the monthly payroll automatically reduces the bank balance and logs salary expenses.
* **Test Scenarios:** Process payroll -> Verify Bank Book is credited -> Verify Salary Expense Ledger is debited.

---
**Conclusion:** SMRITI Retail OS has a solid architectural foundation. To achieve true production readiness for enterprise retail, the immediate focus must be on linking the isolated operational modules (POS, GRN, Dispatch) into the centralized, simplified Accounting Ledgers (Customer, Vendor, Cash, Stock). 
