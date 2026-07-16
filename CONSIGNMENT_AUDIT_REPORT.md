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

# Third-Party Inventory & Consignment Module - Enterprise Audit Report

**Date:** 2026-07-10
**Role:** Senior ERP Consultant, Supply Chain Architect, Retail ERP Expert
**Scope:** Third-Party Inventory / Consignment Stock Module (Currently implemented as Channel Visibility / PSV)

---

## 1. Business Process Validation

* **Current Behavior:** The module currently tracks `PSVParty` which holds static/aggregate data (`stockCount`, `sellThrough`, `weeksOfCover`, `capitalLocked`).
* **Unsupported Scenarios:**
  * **Consignment / Sale-or-Return (SOR):** No dedicated workflow to distinguish outright sales to franchisees vs. stock held on consignment (inventory still technically owned by the parent company but residing at a third-party location).
  * **Store-to-Store Transfers:** Cannot transfer stock between two third-party stores without recalling it to the main warehouse first.
  * **Marketplace Fulfillment:** Lacks real-time sync capabilities for FBA or Flipkart Assured holding centers.
* **Severity:** High
* **Recommended Solution:** Implement a robust `ConsignmentLocation` master that extends regular warehouses. Differentiate ownership status (Parent Owned vs. Franchisee Owned).

---

## 2. Workflow Audit

* **Current Behavior:** Stock visibility is a static aggregate feed. There is no explicit event-driven workflow (Dispatch -> Transport -> Store Receipt -> Settlement).
* **Missing Capability:** End-to-end dispatch and receiving workflow.
* **Severity:** Critical
* **Recommended Solution:**
  1. Create a `DeliveryChallan` (DC) document for dispatch.
  2. The DC deducts from `Main Warehouse` and marks stock as `In-Transit`.
  3. Franchisee acknowledges receipt, moving stock from `In-Transit` to `Franchise Warehouse` (but retaining Parent ownership if SOR).
  4. Franchisee generates a `Sales Feed`, which triggers a `Consignment Invoice` for settlement.
* **Dependencies:** `DeliveryChallan` document creation, `StockLedger` support for "In-Transit" status.

---

## 3. Inventory Validation

* **Current Behavior:** Current `PSVParty` model only stores an integer `stockCount`.
* **Missing Capability:** Granular tracking of available, allocated, in-transit, sold, and damaged stock. Lacks serial number and batch-wise ageing.
* **Severity:** Critical
* **Recommended Solution:** Expand `StockLedgerEntry` to include `ownershipId` and `locationId`. This allows physical location to be "Franchise A" while ownership remains "Company". Add `status` field (Available, In-Transit, Damaged, Expired).
* **Business Impact:** Without granular status tracking, shrinkage cannot be accurately calculated and physical audits are impossible to reconcile.

---

## 4. Financial Validation

* **Current Behavior:** Lacks automated accounting entries for consignment settlements.
* **Missing Capability:** Automated ledger posting for consignment sales, trade discounts, and commission. 
* **Severity:** Critical
* **Recommended Solution:**
  * **Dispatch (SOR):** No accounting entry, only stock movement.
  * **Sale by Franchisee:** Triggers a `SalesInvoice` to the end-consumer (if franchisee uses SMRITI POS) OR triggers a `B2B Invoice` from Parent to Franchisee for the items sold.
  * Debit `Accounts Receivable (Franchisee)`, Credit `Consignment Sales Revenue`.

---

## 5. Settlement Engine

* **Current Behavior:** No Settlement Engine exists.
* **Missing Capability:** Ability to match franchisee sales feeds against outstanding consignment inventory and generate claims, commission deductions, and payment requests.
* **Severity:** High
* **Recommended Solution:** Build a `ConsignmentSettlement` document. It ingests weekly/monthly sales data, calculates agreed margin/commission, accounts for reported damages/returns, and generates a final net payable invoice.
* **Estimated Effort:** 3-4 Weeks
* **Acceptance Criteria:** System can ingest a CSV of sales, validate it against stock at location, and output a settlement invoice automatically.

---

## 6. Integration Audit

* **Current Behavior:** The `PsvTab` is isolated and only displays hardcoded/fetched party statistics. It does not integrate with the actual `Item Master` or `Stock Ledger` for real-time deduction.
* **Missing Integrations:**
  * **Inventory:** Dispatch doesn't actually deduct from central stock.
  * **Finance:** Missing Accounts Receivable mapping for franchisees.
  * **Notifications:** No low-stock alerts sent to franchisees.
* **Severity:** Critical
* **Recommended Solution:** Tie the `DeliveryChallan` creation directly to the `recordStockMovement` function.

---

## 7. Reporting & Dashboard Audit

* **Current Behavior:** Contains basic KPIs: Sell-through %, Weeks of Cover, Capital Locked, and a historic sales line chart.
* **Missing Capabilities:**
  * Missing Slow/Fast Moving stock reports per location.
  * Missing Ageing Report (critical for fashion to recall stock before markdown).
  * Missing Reconciliation Report (System Stock vs Physical Count).
* **Severity:** Medium
* **Recommended Solution:** Extend the `Report Designer` to include standard templates for "Consignment Ageing" and "Location Profitability".

---

## 8. Exception Handling

* **Current Behavior:** No exception handling for logistics.
* **Missing Capability:** Handling partial receipts (e.g., dispatched 100, received 98, 2 damaged in transit).
* **Severity:** High
* **Recommended Solution:** The `Store Receipt` workflow must allow quantity adjustments with reason codes (e.g., Short Delivery, Damaged in Transit). Damaged goods trigger a `Debit Note` to the transporter.

---

## 9. Missing Enterprise Features (Gap Analysis vs SAP/NetSuite)

1. **Vendor Managed Inventory (VMI):** Allowing the parent company's system to automatically trigger replenishments to the franchise based on real-time POS data without requiring a purchase order from the franchise.
2. **Multi-tier Commission Structures:** Tiered slabs where the franchisee's commission increases if they surpass monthly targets.
3. **Consignment Audits (Cycle Counts):** A mobile app interface for the parent company auditor to visit the franchisee, scan barcodes, and instantly log variances against the system ledger.

---

## Implementation Roadmap (Next Steps)

1. **Phase 1:** Core Data Model (Add `ConsignmentLocation`, extend `StockLedgerEntry` with `ownershipId` and `transitState`).
2. **Phase 2:** Logistics Workflow (Build `DeliveryChallan` and `GoodsReceipt` UI for franchisees).
3. **Phase 3:** Settlement Engine (Automated invoicing based on franchisee sales feed).
4. **Phase 4:** Advanced Reporting & Exception Handling.
