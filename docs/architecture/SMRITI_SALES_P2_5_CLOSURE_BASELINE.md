<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Phase P2.5 Complete Closure Baseline Report

**Execution Target:** P2.5 Complete Closure & Data Integrity Remediation
**Auditor / Architect:** SMRITI Forensic Code & Architecture Engine
**Governance Standard:** SMRITI UI & Agent Verification Governance Rules (`AGENTS.md`)
**Target Operational Database:** `localhost:2781/smriti001` (Active Multi-Tenant Database for `COMP-001`)
**Control Plane Database:** `localhost:2781/smritisys`
**Date:** 2026-10-02
**Phase:** Phase 0 — Read-Only Baseline

---

## 1. Git & Environment Baseline

| Attribute | Baseline Value |
|---|---|
| **Git Branch** | `smritiNX` |
| **Git Commit (HEAD)** | `1bb1db55` (*feat: implement P2.5 payments engine for credit notes, wallet redemptions, and advance refunds with tests and COA provisioning*) |
| **Working Tree Status** | Clean (nothing to commit) |
| **Alembic Head (smritisys)** | `v1515_sales_schema_tenant_hardening` |
| **Alembic Head (smriti001)** | `v1515_sales_schema_tenant_hardening` |

---

## 2. Database Routing Confirmation

### 2.1 Control Plane Authoritative Registration
Query on `localhost:2781/smritisys`:
```sql
SELECT company_id, database_name, status, provisioning_status, migration_status
FROM company_database_registries
WHERE company_id = 'COMP-001';
```
Result:
- **`company_id`:** `COMP-001`
- **`database_name`:** `smriti001`
- **`status`:** `READY`
- **`provisioning_status`:** `COMPLETED`
- **`migration_status`:** `UP_TO_DATE`

### 2.2 Production Routing Chain
```text
HTTP Request → get_company_db() → resolve_company_database_name("COMP-001") → smriti001
```
Control-plane guard in `backend/app/api/deps.py:348-352` prevents storing any business transaction in `smritisys`.

---

## 3. Operational Tenant Database Snapshot (`smriti001`)

Snapshot captured via read-only SQL queries on `localhost:2781/smriti001`:

| Table Name | Total Rows | Active Rows (`is_deleted=false`) | Deleted Rows (`is_deleted=true`) | ID MD5 Checksum |
|---|---|---|---|---|
| `payment_transactions` | **868** | 868 | 0 | `9ad0b71a64ac121e2d665ce566d4c265` |
| `payment_allocations` | **744** | 744 | 0 | `e794f886d98d2aedf1d04070e34d1fd3` |
| `sales_invoices` | **2,776** | 2,626 | 150 | `d3816d6cd5354d1f7f999f7da1362250` |
| `journal_vouchers` | **1,382** | 1,382 | 0 | `dc145a6c81add29bf3f566b19586e4a2` |
| `general_ledger_entries` | **3,587** | 3,587 | 0 | `fe3cc93a708a10de3852d86b034dd0f6` |
| `customer_credit_ledger_entries` | **242** | 242 | 0 | `26a82967ea18fdd38dcfeea56261631f` |
| `accounts` | **683** | 683 | 0 | `4574d61745df71bfce3bad659e24f4d8` |

---

## 4. Key Chart of Accounts Baseline (`smriti001 / COMP-001`)

| Account Code | Account Name | Account Type | Root Type | Parent Account ID | Active | Deleted |
|---|---|---|---|---|---|---|
| `1010` | Cash in Hand | ASSET | ASSET | `acc_1000_COMP-001` | True | False |
| `1020` | Bank Accounts | ASSET | ASSET | `acc_1000_COMP-001` | True | False |
| `1030` | Accounts Receivable (Debtors) | ASSET | ASSET | `acc_1000_COMP-001` | True | False |
| `1040` | Inventory Asset | ASSET | ASSET | `acc_1000_COMP-001` | True | False |
| `2000` | Liabilities | LIABILITY | LIABILITY | `null` (Root) | True | False |
| `2050` | Customer Advance Liability | LIABILITY | LIABILITY | `acc_2000_COMP-001` | True | False |
| `2060` | Customer Credit Note & Wallet Liability | LIABILITY | LIABILITY | `acc_2000_COMP-001` | True | False |

---

## 5. Phase 0 Verification State
- **Status:** `Done`
- **Integrity Rule:** Zero persistent data rows were modified, inserted, or deleted during Phase 0.
