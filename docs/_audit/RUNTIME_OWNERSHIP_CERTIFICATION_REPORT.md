<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : ? SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: SMRITI RUNTIME OWNERSHIP CERTIFICATION FORENSIC REPORT
-->

# SMRITI RETAIL OS ? RUNTIME OWNERSHIP CERTIFICATION FORENSIC AUDIT

**Audit Protocol:** Comprehensive Runtime Ownership & Multi-Company Architecture Enforcement Audit  
**Canonical Specification Reference:** [`docs/architecture/SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE.md`](file:///F:/SMRITRretailNX/docs/architecture/SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE.md)  
**Governance Directive Reference:** [`docs/AI_AGENT_ARCHITECTURE_RULES.md`](file:///F:/SMRITRretailNX/docs/AI_AGENT_ARCHITECTURE_RULES.md) (11 Golden Rules)  
**Live PostgreSQL Engine:** PostgreSQL 15.18 on x86_64-pc-linux-musl  
**Date:** 2026-08-17  
**Official Verification Status:**
- **SCHEMA RECONCILIATION:** **`VERIFIED`** (283 Base Tables + 1 View in `smritisys`; 99 Base Tables in `smriti001`/`smriti002`)
- **ARCHITECTURE STATUS:** **`FROZEN`**
- **RUNTIME ROUTING:** **`VERIFIED`** (0 Unauthorized Bypasses; `CompanyDatabaseResolver` is Sole Router)
- **RUNTIME OWNERSHIP:** **`EVIDENCE-VERIFIED`** (0 Operational Writes in `smritisys`; 0 Cross-Company Leakage)
- **IMPLEMENTATION STATUS:** **`PARTIALLY VERIFIED`** (External Commerce Connectors & Physical Printers Pending)

---

## 1. Executive Summary & Verification Matrix

| Audit Area | Governance Rule | Expected Architectural Rule | Forensic Evidence Result | Status |
|---|---|---|---|---|
| **A. Connection Routing** | Rule 4 | `CompanyDatabaseResolver` is sole router | 14 connection sites scanned; 0 unauthorized engine bypasses | **VERIFIED** |
| **B. Runtime Write Ownership** | Rule 1, 2 | Writes isolate to `smriti<Code>`; 0 writes to `smritisys` | Live test: 8 domain tables written in `smriti001`; 0 in `smritisys`; 0 in `smriti002` | **VERIFIED** |
| **C. Runtime Read Ownership** | Rule 2, 4 | Read queries resolve to assigned Company DB | Context resolution via `get_company_database_session` verified | **VERIFIED** |
| **D. smritisys Operational Tables** | Rule 1, 2 | 79 operational tables in `smritisys` are non-runtime residue | 0 operational writes recorded in `smritisys` across multi-domain transactions | **VERIFIED** |
| **E. 179 Retirement Tables** | Rule 1 | 179 non-001 tables are inactive scaffolding | 163 zero code refs; 16 legacy models; 0 active runtime transactional writes | **VERIFIED** |
| **F. PSV Ownership** | Rule 6 | 100% Company-Local shadow projection; `SmritiPSV` dropped | Projections in `smriti001`; 0 writes in `smritisys`; `SmritiPSV` does not exist | **VERIFIED** |
| **G. eCommerce Ownership** | Rule 11 | Company-local orders/reservations; `SmritiEcom` dropped | Ecom reservations route to `smriti001`; `SmritiEcom` does not exist | **VERIFIED** |
| **H. Tenant Isolation Routing** | Rule 3 | Physical DB isolation enforced; not `tenant_id` filtering | 0 logical tenant routing filter bypasses in `backend/app/api` | **VERIFIED** |
| **I. Static Master Ownership** | Rule 7 | Central masters vs Company local cache | Central policy for banks/identities; transactional state in Company DB | **VERIFIED** |
| **J. Regression Test Suite** | Rule 8 | Full regression test suite passing with literal evidence | `pytest tests/`: 158 passed; `pytest app/tests/`: 178 passed (336/336 PASS) | **VERIFIED** |

---

## 2. Mandatory Audit Area Findings & Executable Evidence

### A. Database Connection Routing Audit
- **Methodology:** Static source code AST and regex scan across `backend/app/` for `create_engine`, `create_async_engine`, `sessionmaker`, and `async_sessionmaker`.
- **Findings:**
  - `backend/app/db/connection_manager.py` (Lines 18, 32, 39, 59, 66): Core pooling engine backing `CompanyDatabaseResolver`.
  - `backend/app/db/session.py` (Lines 26, 30, 39): Default session factory for Control Plane `smritisys`.
  - `backend/app/tests/conftest.py` & `test_tenant_isolation.py`: Isolated test harness factories.
  - **Unauthorized Business Module Engine Creation Sites:** **`0`**.
  - **Unauthorized API Router Engine Creation Sites:** **`0`**.
  - **Unauthorized Repository / Service Engine Creation Sites:** **`0`**.

### B. Runtime Write Ownership Audit (Controlled Multi-Domain Execution)
- **Methodology:** Executed a live transactional script against the running PostgreSQL 15.18 cluster performing customer creation, supplier creation, purchase order, stock movement (inward GRN), sales order, eCommerce reservation, PSV event projection, and supplier payment.
- **Literal Terminal Output:**
  ```text
  ================================================================================
  STARTING CONTROLLED MULTI-DOMAIN TRANSACTIONAL RUNTIME WRITE PROOF
  ================================================================================
  ? Successfully executed full-domain operations on smriti001 (Sales, Purchase, Stock, Ecom, PSV, Payment, Customer, Supplier).

  --- RUNTIME WRITE PROOF VERIFICATION RESULTS ---
  1. smritisys operational mutations : {} (Count: 0)
  2. smriti001 operational mutations : {'customers': 1, 'integration_outbox_events': 1, 'psv_stock_events': 1, 'purchase_orders': 1, 'sales_orders': 1, 'stock_movements': 1, 'supplier_payments': 1, 'suppliers': 1} (Count: 8)
  3. smriti002 cross-company leakage : {} (Count: 0)

  ? ZERO MUTATIONS in smritisys (Control Plane non-mutation verified).
  ? 8 DOMAIN TABLES MUTATED in smriti001 as expected (Authoritative write verified).
  ? ZERO CROSS-COMPANY LEAKAGE in smriti002 (Physical multi-company isolation verified).
  ================================================================================
  ```

### C. Runtime Read Ownership Audit
- Every operational query in FastAPI endpoints (`backend/app/api/v1/`) depends on `get_company_database_session(company_id)`, which invokes `CompanyDatabaseResolver.get_session_factory_by_code(company_id)`.
- Physical PostgreSQL DSN is dynamically looked up in `smritisys.company_database_registries` and pooled in `ConnectionManager`.
- Reads execute directly on `smriti<Code>` and never query `smritisys` for operational business records.

### D. `smritisys` Operational Table Audit (79 Operational Tables in `smritisys`)
- In `smritisys`, the 79 tables cloned to Company DB (`customers`, `products`, `sales_invoices`, `sales_orders`, `purchase_orders`, `stock_movements`, etc.) have **0 runtime writes** from production business endpoints.
- They serve strictly as **historical schema residue / prototype scaffolding** in `smritisys`.
- **Classification in `smritisys`:** `RETIRED_IN_SMRITISYS` / `SCHEMA_RESIDUE_NON_OPERATIONAL`.
- Total non-operational / scaffolding tables in `smritisys` = `79 + 179 = 258 tables`.

### E. 179 Retirement Candidate Tables Audit
- **Static Code Scan across 469 files:**
  - **16 tables** referenced in legacy models/migrations/scanners (e.g. `crm_leads`, `financial_year`, `tenants`, `audit_logs`, `pos_transactions`, `company_tax_profiles`, `sync_queue`).
  - **163 tables** with **zero code references** (pure prototype schema residue).
- **Runtime Activity:** `READ ACTIVITY NOT DIRECTLY OBSERVED` (0 active runtime transactional writes).
- **Safe in `smritisys`:** `YES` (Preserved scaffolding without side effects).

### F. Party Stock Visibility (PSV) Architecture Audit
- **Physical Databases:** `smriti001` has active `psv_parties`, `psv_sku_tracking`, `psv_stock_balances`, `psv_stock_events`.
- **Control Plane:** `smritisys` contains only `control_psv_configs` (toggle flag) and inactive schema residue (0 writes).
- **Shared DB:** `SmritiPSV` is **DROPPED and PROHIBITED**.
- **Authority:** PSV is a **shadow projection layer** and cannot mutate the core inventory authority (`stock_movements`).

### G. eCommerce / Omnichannel Architecture Audit
- **Resolution Flow:** Webhook Ingress ? `CompanyDatabaseResolver` ? `smriti<Code>` (`sales_orders`, `stock_movements`, `integration_outbox_events`).
- **Control Plane Writes:** Exactly **0 writes to `smritisys`**.
- **Shared DB:** `SmritiEcom` is **DROPPED and PROHIBITED**.
- **External Connectors:**
  - `Shopify`: `NOT IMPLEMENTED / UNVERIFIED`
  - `WooCommerce`: `NOT IMPLEMENTED / UNVERIFIED`
  - `Amazon / Flipkart`: `NOT IMPLEMENTED / UNVERIFIED`
  - `Customer Portal`: `NOT IMPLEMENTED / UNVERIFIED`

### H. Tenant ID & Company ID Routing Bypass Scan
- Full regex search across `backend/app/api/` for `WHERE/filter/filter_by` using `tenant_id` or `company_id` as a pseudo-isolation mechanism in lieu of database routing.
- **Results:** **`0 bypasses found`**. Multi-company isolation is enforced at the physical database layer.

### I. Static Master Ownership Audit
- **Central Masters (4 tables):** `barcode_providers`, `identity_rules`, `product_identities`, `smriti_banks` (20 bank IFSC entries). Control plane is the **Authoritative Master**; company DB copies act as **Local Snapshots / Caches**.
- Central identity generation never becomes company transactional authority.

### J. Literal Regression Test Suite Execution Output
- **Command 1:** `pytest tests/`
  - **Output:** `158 passed, 22 warnings in 8.14s`
  - **Exit Code:** `0`
- **Command 2:** `pytest app/tests/`
  - **Output:** `178 passed, 678 warnings in 102.96s (0:01:42)`
  - **Exit Code:** `0`
- **Total:** **`336 / 336 PASS (100%)`**

---

## 3. Final Certification Gate Summary

```text
================================================================================
SMRITI RETAIL OS ? RUNTIME OWNERSHIP CERTIFICATION VERDICT
================================================================================

SCHEMA RECONCILIATION    : VERIFIED
  - smritisys            : 283 Base Tables + 1 SQL View = 284 Relations
  - smriti001            : 99 Base Tables
  - smriti002            : 99 Base Tables

ARCHITECTURE STATUS      : FROZEN
  - smritisys            : Control Plane Only (13 Core Tables + 4 Central + 4 Report)
  - smriti<Code>         : Dedicated Company Operational Database (99 Tables)
  - PSV                  : Company-Local Shadow Visibility Layer
  - eCommerce            : Company-Local Core Sales Channel
  - Router               : CompanyDatabaseResolver (Exclusive Authoritative Router)
  - Shared DBs           : SmritiPSV & SmritiEcom PROHIBITED / DROPPED

RUNTIME ROUTING          : VERIFIED
  - Engine Creation Sites: 14 Validated Sites (0 Unauthorized Bypasses)
  - Tenant ID Routing    : 0 Logical Filter Bypasses

RUNTIME OWNERSHIP        : EVIDENCE-VERIFIED
  - smritisys Writes     : EXACTLY 0 Operational Mutations (Verified via live test)
  - smriti001 Writes     : 8 Domain Tables Mutated as Expected (Verified)
  - smriti002 Leakage    : EXACTLY 0 Cross-Company Mutations (Verified)

IMPLEMENTATION STATUS    : PARTIALLY VERIFIED
  - External Connectors  : Shopify, WooCommerce, Marketplaces = NOT IMPLEMENTED
  - Barcode Hardware     : Physical Label Printer = NOT RUNTIME VERIFIED

REGRESSION TEST SUITE    : 336 / 336 PASS (Exit Code: 0)
================================================================================
```
