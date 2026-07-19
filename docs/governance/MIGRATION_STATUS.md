<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.0
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Migration Status Registry

This ledger tracks the migration of SMRITI components from the legacy Express backend and file-system persistence (`db_store.json`) to the FastAPI backend and PostgreSQL transactional persistence layer.

| Module | Express Enabled | FastAPI Enabled | Frontend Caller | Tests Pass | Migration Status | Cutover Completed |
|---|---|---|---|---|---|---|
| **Company / Branch** | ❌ (Decommissioned) | ✅ | FastAPI (`apiFetchV1`) | ✅ | Done | Yes |
| **Stores / Warehouses** | ❌ (Decommissioned) | ✅ | FastAPI (`apiFetchV1`) | ✅ | Done | Yes |
| **Master Lookup Values** | ❌ (Decommissioned) | ✅ | FastAPI (`apiFetchV1`) | ✅ | Done | Yes |
| **Purchase (PO / GRN)** | ✅ | ✅ | Express (`fetch`) | ✅ (Phase 0) | Ready | No (Feature flag `false`) |
| **POS Counter & Shifts** | ✅ | ✅ | Express (`fetch`) | ✅ (Phase 0) | Ready | No (Feature flag `false`) |
| **Sales (Invoices)** | ✅ | ⚠️ Partial | Express (`fetch`) | ⚠️ Partial | In Progress | No (Feature flag `false`) |
| **Inventory Stock Ledger** | ⚠️ Inline | ⚠️ Models | Express (`fetch`) | ❌ | Pending | No |
| **Accounting vouchers** | ✅ (General Ledger) | ❌ | Express (`fetch`) | ❌ | Deferred | No |

---

## Active Cutover Feature Flags

Every active migration feature flag must be documented below.

### 1. `USE_FASTAPI_SALES`
* **Owner:** Jawahar Ramkripal Mallah
* **Target Removal Version:** v3.19.0
* **Target Removal Date:** 2026-08-15
* **Reason:** Gates frontend redirection of Sales invoices, quotations, orders, and returns to FastAPI.

### 2. `USE_FASTAPI_PURCHASE`
* **Owner:** Jawahar Ramkripal Mallah
* **Target Removal Version:** v3.19.0
* **Target Removal Date:** 2026-08-15
* **Reason:** Gates frontend redirection of Purchase orders, receipts, suppliers, and configs to FastAPI.

### 3. `USE_FASTAPI_POS`
* **Owner:** Jawahar Ramkripal Mallah
* **Target Removal Version:** v3.19.0
* **Target Removal Date:** 2026-08-15
* **Reason:** Gates frontend redirection of POS shift open/close and register logs to FastAPI.
