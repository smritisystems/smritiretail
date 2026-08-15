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

# SMRITI Retail OS - Existing System Audit Report

**Date:** 2026-07-10
**Role:** CTO & Senior ERP Solution Architect
**Objective:** Audit the existing implementation of SMRITI Retail OS against production-readiness standards, strictly enforcing the Inventory-First and Tally-for-Accounting policies.

---

## 1. Module: Core Architecture (Operations Event Engine)

### Current Implementation
An `operationsBus` (EventEmitter) was recently introduced in `server.ts`. It currently listens for `INVENTORY_UPDATED` and `SALE_COMPLETED` events and pushes basic payloads to the `tallyExportQueue`.

### Observation
While the foundation for Event Sourcing exists, it is vastly underutilized. Most operational modules (GRN, Adjustments, Transfers, Customer Payments) are still directly mutating tables instead of emitting events. 

### Keep / Improve / Remove / Merge / Add
**Improve**

### Business Reason
Ensures every single action in the system is traceable, creating a single source of truth for operations without relying on accounting ledgers.

### Technical Reason
Decouples modules. Instead of the POS module needing to know how to update the Tally Queue, Stock Ledger, and CRM, it simply emits `SALE_COMPLETED` and the respective subscribers handle the rest.

### Priority
Critical

### Estimated Effort
Medium (Refactoring existing endpoints to emit events).

### Risk
Low. Existing data structures remain unchanged; only the trigger mechanism shifts.

### Acceptance Criteria
Every POST/PUT/DELETE request in the system emits a standardized event to `operationsBus` before returning a response.

### Test Cases
1. Process a GRN -> Verify `GOODS_RECEIVED` event fired -> Verify Stock Ledger and Tally Queue updated via event listener.

---

## 2. Module: Business Ledger & CRM

### Current Implementation
The `BusinessLedgerTab` exists and correctly defines the scope (Outstanding, Credit Limits, Settlement Pending) but is currently populated with static mock data (`C1`, `V1`, `S1`, `T1`). POS checkouts and GRN approvals do not dynamically update these balances.

### Observation
The system has the UI for operational balances but lacks the wiring to make it functional. There is no automated workflow to increase a customer's outstanding balance on a credit sale.

### Keep / Improve / Remove / Merge / Add
**Improve**

### Business Reason
Retailers need real-time visibility into who owes them money and whom they owe, without waiting for end-of-day Tally synchronization.

### Technical Reason
Requires bridging the `bills` and `goodsReceipts` tables with a new `business_ledger_entries` table, subscribed via the Operations Event Engine.

### Priority
High

### Estimated Effort
Medium.

### Risk
Low.

### Acceptance Criteria
When a POS transaction is marked as "Credit" or "Udhaar", the `Customer` record in the Business Ledger automatically reflects the increased outstanding amount.

### Test Cases
1. Complete a split payment POS sale (Partial Cash, Partial Credit) -> Check Business Ledger -> Verify Outstanding matches the Credit amount.

---

## 3. Module: Accounting Sync (TallyPrime)

### Current Implementation
The UI (`AccountingSyncTab`) allows viewing a `syncQueue` and generating mock XML. `tallyExportQueue` captures events in `server.ts`.

### Observation
The queue lacks critical production safeguards: no duplicate export prevention mechanism (e.g., locking exported voucher IDs), no retry limits for failed syncs, and no mapping validation (checking if the SMRITI ledger name exists in Tally).

### Keep / Improve / Remove / Merge / Add
**Improve**

### Business Reason
Prevents double-entry of sales or purchases in TallyPrime, which would lead to catastrophic tax reporting errors.

### Technical Reason
Requires adding `syncStatus`, `retryCount`, `lastSyncError`, and `tallyVoucherId` fields to the `tallyExportQueue`.

### Priority
Critical

### Estimated Effort
Medium.

### Risk
High (If sync logic is flawed, accounting is compromised).

### Acceptance Criteria
An invoice already marked as `Synced` cannot be re-exported unless explicitly unlocked by an Admin.

### Test Cases
1. Export Sales Invoices for today -> Re-run Export for today -> Verify 0 new vouchers exported.

---

## 4. Module: UI/UX & Navigation

### Current Implementation
The `layout_store.tsx` defines over 20 top-level navigation items. 

### Observation
The sidebar is becoming cluttered and intimidating for store-level staff. Modules like "Document Series", "Approval Matrix", and "Print Studio" sit alongside daily operational tabs like "POS" and "GRN".

### Keep / Improve / Remove / Merge / Add
**Merge**

### Business Reason
Retail POS systems must be hyper-focused and simple to use for cashiers and store managers. Configuration shouldn't mix with operations.

### Technical Reason
Creating nested categories or a dedicated "Settings/Admin" workspace cleans up the state and component tree.

### Priority
Medium

### Estimated Effort
Low.

### Risk
None.

### Acceptance Criteria
Administrative and configuration tabs (Document Series, Print Studio, Formulas) are moved under a single "Settings & Configuration" nested menu.

### Test Cases
1. Login as Cashier -> Verify only POS, CRM, and Stock visible. 
2. Login as Admin -> Verify Settings menu expands to show configuration modules.

---

## 5. Module: Inventory Adjustments & Physical Verification

### Current Implementation
Stock adjustments are technically supported by the `StockLedgerEntry` type (`movementType: "ADJUSTMENT"`), but there is no dedicated UI or workflow to perform a Physical Stock Count and auto-post the discrepancy.

### Observation
Inventory systems require a robust way to handle shrinkage, damage, and manual counts. Relying purely on GRNs and POS sales will eventually lead to stock drift.

### Keep / Improve / Remove / Merge / Add
**Add**

### Business Reason
Identifies shrinkage, theft, and damages. Essential for end-of-month stock audits.

### Technical Reason
Needs a `PhysicalCount` table that compares `System_Stock` vs `Actual_Stock` and fires a `STOCK_ADJUSTMENT` event to the `operationsBus`.

### Priority
High

### Estimated Effort
Medium.

### Risk
Medium (Requires strict permissions to prevent unauthorized stock tampering).

### Acceptance Criteria
A manager can freeze stock for a specific warehouse, enter physical counts, and the system auto-generates an Adjustment Event for the delta.

### Test Cases
1. System shows 10 units -> Manager enters actual count of 8 -> System generates an `OUT` adjustment for 2 units with reason "Physical Count Variance".

