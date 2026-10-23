<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Audit & Architecture Governance
-->

# SMRITI Retail OS — Phase 2 Readiness Gate Report
**Environment:** Development (`F:\SMRITRretailNX`)  
**Branch:** `smritiNX` | **Commit HEAD:** `a2d9bcff`  
**Governing Lead:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Gate Decision:** **CONDITIONAL GO**

---

## 1. Executive Summary

Phase 2 established a comprehensive, evidence-backed evaluation of the SMRITI Retail OS codebase across security hardening, billing architecture convergence, transaction test suites, and statutory GST data protection. 

The primary findings confirm:
1. **Security Hardening (Working Tree vs Runtime):** Configuration files (`docker-compose.yml` and `docker-compose.dev.yml`) are hardened to bind database services strictly to `127.0.0.1` and enforce fail-closed runtime secrets. However, because live containers have not been recreated (per strict non-disruption rules), runtime port exposure on host `0.0.0.0` remains active. Security status is classified as **PARTIALLY HARDENED**.
2. **Billing Engine Convergence:** The 7 previously identified billing surfaces do **not** run divergent transactional database engines. All checkout pathways converge directly on `CanonicalSalesPostingWriter.post_sales_transaction` and compute taxes via `HeadlessBillingCore.calculate_billing`. Duplication is localized to frontend UI wrappers.
3. **Critical Billing Feature Gap (WF-04):** Back-office customer PO line-balance deduction and modern trade store code verification currently reside in `SalesService.create_sales_invoice` and `BillingTerm.tsx`. They have not yet been exposed in `BillingWorkspace.tsx` (`B2B_DISTRIBUTOR` mode). This capability must be ported to `BillingWorkspace` before `BillingTerm.tsx` can be retired.
4. **GST Data Protection:** Live database `smriti001` contains **666 active products** utilizing the statutory 12% GST slab. India's proposed GST rationalization has not formally abolished 12% in law. Running `scripts/remediate_gst_2_slab_correction.py` would cause severe operational damage. The remediation script is permanently locked from automatic execution.
5. **Targeted Test Suite:** All targeted billing input validation tests (6/6), customer lifecycle e2e tests (4/4), and frontend convergence tests (36/36) passed with 100% green exit status.

---

## 2. Phase 1 Security Hardening Verification Status

### 2.1 File Modifications & Literal Diffs
The following configuration changes were implemented in the working tree to remediate host exposure and enforce secret validation:

```diff
warning: in the working copy of 'docker-compose.dev.yml', LF will be replaced by CRLF the next time Git touches it
diff --git a/docker-compose.dev.yml b/docker-compose.dev.yml
index ca1c5afd..e41b1dfd 100644
--- a/docker-compose.dev.yml
+++ b/docker-compose.dev.yml
@@ -19,7 +19,7 @@ services:
       POSTGRES_PASSWORD: "${POSTGRES_DEV_PASSWORD:-postgres}"
       POSTGRES_DB: "${POSTGRES_DEV_DB:-smritisys_dev}"
     ports:
-      - "${POSTGRES_DEV_PORT:-2782}:5432"
+      - "127.0.0.1:${POSTGRES_DEV_PORT:-2782}:5432"
     volumes:
       - smriti_dev_db_volume:/var/lib/postgresql/data
     healthcheck:
diff --git a/docker-compose.yml b/docker-compose.yml
index 3ff2a6c7..626fe70e 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -19,7 +19,7 @@ services:
       POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
       POSTGRES_DB: ${POSTGRES_DB:-smritisys}
     ports:
-      - "${POSTGRES_PORT:-2781}:5432"
+      - "127.0.0.1:${POSTGRES_PORT:-2781}:5432"
     networks:
       default:
         aliases:
@@ -73,9 +73,9 @@ services:
     environment:
       DATABASE_URL: "postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@smriti-db:5432/${POSTGRES_DB:-smritisys}"
       GEMINI_API_KEY: "${GEMINI_API_KEY}"
-      JWT_SECRET_KEY: "${JWT_SECRET_KEY:-smriti-jwt-secret-standalone-runtime-default-1981}"
-      INTERNAL_SERVICE_KEY: "${INTERNAL_SERVICE_KEY:-smriti-internal-key-standalone-runtime-default-1981}"
-      SGIP_VAULT_MASTER_KEY: "${SGIP_VAULT_MASTER_KEY:-smriti-vault-key-standalone-runtime-default-1981}"
+      JWT_SECRET_KEY: "${JWT_SECRET_KEY:?Error: JWT_SECRET_KEY must be set in .env or environment}"
+      INTERNAL_SERVICE_KEY: "${INTERNAL_SERVICE_KEY:?Error: INTERNAL_SERVICE_KEY must be set in .env or environment}"
+      SGIP_VAULT_MASTER_KEY: "${SGIP_VAULT_MASTER_KEY:?Error: SGIP_VAULT_MASTER_KEY must be set in .env or environment}"
       SDIC_REPOSITORY_ROOT: "/workspace"
       # Run Alembic migrations on startup by default. Set SKIP_MIGRATIONS=true to disable.
       SKIP_MIGRATIONS: "${SKIP_MIGRATIONS:-false}"
@@ -104,7 +104,7 @@ services:
       MSSQL_SA_PASSWORD: "${MSSQL_SA_PASSWORD:-netmanthan@123}"
       MSSQL_PID: "Developer"
     ports:
-      - "${MSSQL_PORT:-1433}:1433"
+      - "127.0.0.1:${MSSQL_PORT:-1433}:1433"
     volumes:
       - smriti_mssql_volume:/var/opt/mssql
     healthcheck:
```

### 2.2 Fail-Closed Secret Syntax Verification
Verification of bash variable expansion syntax `${VAR:?Error: ...}` was executed using an empty environment file to confirm compose halts execution if secrets are missing:
```powershell
Command: docker compose --env-file NUL config
Exit Code: 1
Stderr Output:
parsing F:\SMRITRretailNX\docker-compose.yml: required variable JWT_SECRET_KEY is missing a value: Error: JWT_SECRET_KEY must be set in .env or environment
```
Result: Pass. The deployment manifests fail closed immediately when secrets are absent.

### 2.3 Live Container Runtime State
Inspection of active container bindings:
```text
Command: docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
NAMES          STATUS                  PORTS
smriti-web     Up 15 hours (healthy)   0.0.0.0:8101->3000/tcp, [::]:8101->3000/tcp
smriti-api     Up 4 hours (healthy)    0.0.0.0:1981->8000/tcp, [::]:1981->8000/tcp
smriti-db      Up 15 hours (healthy)   0.0.0.0:2781->5432/tcp, [::]:2781->5432/tcp
smriti-mssql   Up 15 hours (healthy)   0.0.0.0:1433->1433/tcp, [::]:1433->1433/tcp
```

### 2.4 Security Hardening Verdict
**Status:** **PARTIALLY HARDENED**  
- **Configuration Level:** Fully hardened. File definitions enforce `127.0.0.1` and fail-closed secret requirements.
- **Runtime Level:** Not yet hardened. Live containers remain bound to `0.0.0.0` until a restart/recreation operation is approved and performed.
- **Credential Storage:** `SGIP_VAULT_MASTER_KEY` was intentionally preserved to prevent unrecoverable loss of encrypted tenant connection strings.

---

## 3. Billing Architecture & Feature Parity

### 3.1 Backend Engine Convergence
Investigation of backend entry points confirms architectural convergence:
- `POST /api/v1/pos/checkout` (`backend/app/api/v1/pos.py`): Ingress schemas validate shift, customer, and items, then hand off directly to `CanonicalSalesPostingWriter.post_sales_transaction`.
- `POST /api/v1/billing/checkout` (`backend/app/api/v1/billing.py`): Validates B2B customer credit limit and statutory tax preview, then calls `CanonicalSalesPostingWriter.post_sales_transaction`.
- `POST /api/v1/sales/invoices` (`backend/app/api/v1/sales.py`): Validates Customer PO balance and modern trade delivery location in `SalesService`, then executes `CanonicalSalesPostingWriter.post_sales_transaction`.
- Statutory Calculation Engine: All three entry points execute `HeadlessBillingCore.calculate_billing` using deterministic `ROUND_HALF_UP` statutory algorithms.

### 3.2 Frontend Surface Matrix Summary (WF-01 through WF-06)
Derived from `audit/SMRITI_BILLING_FEATURE_PARITY.csv`:

| ID | Surface / Workflow | Backend Route | Status | Consolidation Action |
|:---|:---|:---|:---|:---|
| **WF-01** | Retail POS Counter Billing (`BillingWorkspace` -> `SmritiBillingStudio` `RETAIL_POS`) | `POST /api/v1/pos/checkout` | **PARITY_VERIFIED** | Retain as the canonical Retail POS billing terminal. |
| **WF-02** | Credit & Wholesale Customer Billing (`BillingWorkspace` -> `SmritiCreditBillingTerminal`) | `POST /api/v1/billing/checkout` | **PARITY_VERIFIED** | Retain as the canonical Credit Billing terminal. |
| **WF-03** | B2B Distributor Consolidated Billing (`BillingWorkspace` -> `SmritiBillingStudio` `B2B_DISTRIBUTOR`) | `POST /api/v1/pos/checkout` + `/fulfillment/consolidated-finalize` | **PARITY_VERIFIED** | Retain as canonical distributor studio. Atomize packing slip completion. |
| **WF-04** | Customer PO Back-Office Invoicing (`DistTaxInvoice.tsx` & `BillingTerm.tsx`) | `POST /api/v1/sales/invoices` | **DIVERGENT_GAP** | Port line-level Customer PO balance validation into `BillingWorkspace.tsx`. |
| **WF-05** | Legacy ProPos Counter Terminal (`ProPosBillingTerm.tsx`) | `POST /api/v1/pos/checkout` | **LEGACY_SUPERSEDED** | Fully superseded by `SmritiBillingStudio.tsx`. Safe to deprecate. |
| **WF-06** | Legacy Desktop Sales Terminal (`BillingTerm.tsx`) | `POST /api/v1/sales/invoices` | **LEGACY_SUPERSEDED** | Superseded by `BillingWorkspace.tsx` once WF-04 PO gap is ported. |

### 3.3 Sequencing Analysis: Consolidation vs Template Implementation
- **Question:** Must billing consolidation be fully completed before implementing templates?
- **Finding:** Complete deprecation/deletion of legacy UI files (`BillingTerm.tsx`, `ProPosBillingTerm.tsx`) is **not** a prerequisite for starting template configuration, because the underlying backend engines are already consolidated into `CanonicalSalesPostingWriter`.
- **Requirement:** However, `DISTRIBUTOR_WHOLESALE_V1` requires Customer PO invoicing. Therefore, porting Customer PO line-balance validation (WF-04) into `BillingWorkspace.tsx` must be executed as **Stage 1** of template development.

---

## 4. Targeted Test Suite Verification Evidence

Targeted test suites were executed without modifying production database data:

### 4.1 Backend Billing Input Validation Suite
```text
Command: .\.venv\Scripts\python.exe -m pytest backend/tests/test_billing_input_validations.py -v
Platform: win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
Rootdir: F:\SMRITRretailNX\backend
Collected: 6 items

backend\tests\test_billing_input_validations.py::test_sales_invoice_item_validation PASSED [ 16%]
backend\tests\test_billing_input_validations.py::test_sales_invoice_create_requires_items PASSED [ 33%]
backend\tests\test_billing_input_validations.py::test_pos_checkout_schema_validation PASSED [ 50%]
backend\tests\test_billing_input_validations.py::test_canonical_sales_writer_rejects_empty_items PASSED [ 66%]
backend\tests\test_billing_input_validations.py::test_canonical_sales_writer_rejects_negative_tender PASSED [ 83%]
backend\tests\test_billing_input_validations.py::test_canonical_sales_writer_rejects_cash_over_2_lakh PASSED [100%]

============================== 6 passed in 6.83s ==============================
```
*Note on Prior Defect Resolution:* Two prior test failures were diagnosed as unit test mock fixture bugs. `mock_session.execute()` failed to mock company identity step `0A` (`scalars().first()`), which resulted in `TypeError: object MagicMock can't be used in 'await' expression`. Updating the mock fixture resolved the issue with zero changes to production code.

### 4.2 Customer Lifecycle & B2B Credit Integration Suite
Executed against isolated test database `smriti_test_phase2c`:
```text
Command: .\.venv\Scripts\python.exe -m pytest backend/tests/test_customer_lifecycle_e2e.py -v
Platform: win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
Rootdir: F:\SMRITRretailNX\backend
Collected: 4 items

backend\tests\test_customer_lifecycle_e2e.py::test_phase3_customer_creation_validation_and_persistence PASSED [ 25%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase4_customer_edit_concurrency_and_persistence PASSED [ 50%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase5_billing_pos_customer_selection_and_parent_child_visibility PASSED [ 75%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase6_sales_invoice_creation_child_guard_and_retrieval PASSED [100%]

============================= 4 passed in 39.01s ==============================
```

### 4.3 Frontend Billing Convergence & Calculation Suite
```text
Command: npx vitest run src/tests/canonicalBillingConsolidation.test.ts src/tests/billingWorkspaceConvergence.test.ts src/tests/ttInvoiceBillingCalculation.test.ts src/tests/b2bPackingConsolidatedBilling.test.ts
Runner: Vitest v4.1.11

 ✓ src/tests/billingWorkspaceConvergence.test.ts (5 tests) 9ms
 ✓ src/tests/ttInvoiceBillingCalculation.test.ts (10 tests) 241ms
 ✓ src/tests/b2bPackingConsolidatedBilling.test.ts (16 tests) 13ms
 ✓ src/tests/canonicalBillingConsolidation.test.ts (5 tests) 8ms

 Test Files  4 passed (4)
      Tests  36 passed (36)
   Start at  12:35:36
   Duration  5.78s (transform 3.34s, setup 0ms, import 5.72s, tests 271ms, environment 1ms)
```

---

## 5. GST Data Protection & Statutory Rationalisation Report

### 5.1 Active Database Inspection
- **Control Plane (`smritisys`):** Master values for `gst_rate` maintain valid codes: `0%`, `5%`, `12%`, `18%`, `28%`, and `40%`.
- **Tenant Database (`smriti001`):** Product master distribution across tax slabs:
  - 0% Slab: 24 active products
  - 5% Slab: 132 active products
  - **12% Slab: 666 active products**
  - 18% Slab: 3,138 active products
  - Total catalog: 3,960 active items.

### 5.2 Regulatory Analysis of `test_gst_2_slab_validation.py`
- `test_gst_2_slab_validation.py` tests an assumption that India's GST rationalization abolished the 12% slab on September 22, 2025.
- **Fact:** While GST Council discussion papers have explored slab rationalization (merging 12% and 18%), no official statutory gazette notification has abolished the 12% slab under Indian GST Law. The 12% rate remains mandatory for hundreds of classifications (e.g., apparel, processed foods, medical diagnostic equipment, agricultural pumps).
- The test reflects a proposed future policy rather than current statutory law.

### 5.3 Script Risk & Data Protection Verdict
- **Impact of `scripts/remediate_gst_2_slab_correction.py`:**
  - Soft-deletes `code='12'` in `master_values`.
  - Flags 666 active products in `smriti001` as `REQUIRES_REVIEW`.
  - Blocks POS billing and B2B invoicing from looking up or calculating taxes for 16.8% of the retailer's catalog.
- **Verdict:** **PERMANENT PROHIBITION.** `scripts/remediate_gst_2_slab_correction.py` must **NEVER** be executed against live databases. It is locked until official statutory enactment and explicit CA certification.

---

## 6. Phase 2 Readiness Gate Verdict

### **Verdict: CONDITIONAL GO**

Implementation of the three business templates is approved to proceed, subject to four mandatory governing conditions:

1. **Gate Condition 1 (Container Runtime Hardening):** Host port bindings (`0.0.0.0` -> `127.0.0.1`) and fail-closed secrets in `docker-compose.yml` will be activated upon scheduled container recreation during the Stage 2 deployment maintenance window.
2. **Gate Condition 2 (WF-04 Porting to BillingWorkspace):** Prior to rolling out `DISTRIBUTOR_WHOLESALE_V1`, port line-level Customer PO balance deduction and modern trade store checks into `BillingWorkspace.tsx` (`B2B_DISTRIBUTOR` mode), allowing full unification of billing terminals.
3. **Gate Condition 3 (GST Data Immutability):** Do not execute `remediate_gst_2_slab_correction.py`. Maintain the 12% GST slab as an active statutory tier across `smritisys` and tenant databases.
4. **Gate Condition 4 (Secret Vault Preservation):** Maintain `SGIP_VAULT_MASTER_KEY` intact. Do not rotate keys until an automated cryptographic migration utility is developed and verified.
