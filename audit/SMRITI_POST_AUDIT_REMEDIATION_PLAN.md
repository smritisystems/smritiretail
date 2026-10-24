<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.16
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Master Remediation & Architecture Plan
-->

# SMRITI Retail OS — Post-Audit Remediation Plan (Phase 1)
## Security Hardening, Billing Reconciliation & Verification Roadmap

**Document ID:** SMRITI-REMED-PLAN-20261023  
**Status:** PROPOSED FOR APPROVAL (Audit Phase 1 Complete)  
**Effective Date:** 2026-10-23  
**Target Repository:** `F:\SMRITRretailNX`  

---

## 1. Executive Summary & Baseline Preservation

This remediation plan synthesizes the findings of the 5 audit deliverables (`SMRITI_DUPLICATION_AND_GAPS.md`, `SMRITI_EXISTING_MODULE_AUDIT.md`, `SMRITI_MODULE_AUDIT.json`, `SMRITI_MODULE_TEMPLATE_MATRIX.csv`, `SMRITI_TEMPLATE_READINESS.md`) and direct static/runtime investigations conducted on the repository and isolated runtime test suites.

### Baseline State Recorded:
- **Git Branch:** `smritiNX` (up to date with `origin/smritiNX`)
- **Git HEAD Commit:** `a2d9bcff2ff24dd3e7345889af6fa85f26cb8f9c` (`fix(db): add zero-dependency PostgreSQL TEMPLATE clone snapshot fallback for container environments`)
- **Working Tree State:** Clean code state. Only non-code telemetry (`backend/app/logs/canonical_resolution_telemetry.jsonl`) and audit documents were uncommitted.
- **Migration Head Status:** Both live control plane (`smritisys`) and tenant database (`smriti001`) are at migration revision `v1543` (`v1543_add_show_child_customers_in_billing.py`), which matches the newest migration file in `backend/alembic/versions`. The prior modified migration `v1541_triage_quarantine_items.py` was committed in `c8bb8fd3` with safe duplicate SKU guards.
- **Guardrails Observed:** No application source code, database records, schema, migrations, or deployment configuration files were modified during this investigation.

---

## 2. Investigation of the Conditional P0 Deployment-Secret Risk

### Evidence & Findings

1. **Predictable Fallback Literals in Compose Files:**
   In `docker-compose.yml`, environment variable substitution uses default fallback syntax `${VAR:-<literal>}`:
   - `JWT_SECRET_KEY`: defaults to literal `smriti-jwt-secret-standalone-runtime-default-1981`
   - `INTERNAL_SERVICE_KEY`: defaults to literal `smriti-internal-key-standalone-runtime-default-1981`
   - `SGIP_VAULT_MASTER_KEY`: defaults to literal `smriti-vault-key-standalone-runtime-default-1981`
   - `POSTGRES_PASSWORD`: defaults to literal `postgres`
   - `MSSQL_SA_PASSWORD`: defaults to literal `netmanthan@123`
   In `docker-compose.dev.yml`:
   - `JWT_SECRET_KEY`: defaults to `dev-secret-key-smriti-retail-os-testing-only-1981`
   - `INTERNAL_SERVICE_KEY`: defaults to `dev-internal-service-key-testing-only-1981`
   - `SGIP_VAULT_MASTER_KEY`: defaults to `dev-vault-master-key-testing-only-1981`

2. **Environment Configuration Gap & Validation Bypass:**
   - In `backend/app/core/config.py:273-289`, strict cryptographic validation exists: if `ENVIRONMENT in {"production", "prod"}`, it rejects any `JWT_SECRET_KEY` or `INTERNAL_SERVICE_KEY` that is under 32 characters or contains markers like `"default"`, `"dev-test"`, or `"example"`. It also forbids `POSTGRES_PASSWORD == "postgres"`.
   - **The Vulnerability:** `docker-compose.yml` does NOT specify `ENVIRONMENT: production`. Consequently, `Settings.ENVIRONMENT` defaults to `"development"`. Under `"development"`, the fail-closed validation guard is completely bypassed, allowing the container to boot and run in production-facing network ports with known default keys.

3. **Service Exposure & Network Reachability:**
   Inspection of active Docker containers (`docker ps`) revealed all services bound to `0.0.0.0` (all host interfaces):
   - `smriti-api`: port `0.0.0.0:1981->8000/tcp`
   - `smriti-web`: port `0.0.0.0:8101->3000/tcp`
   - `smriti-db`: port `0.0.0.0:2781->5432/tcp`
   - `smriti-mssql`: port `0.0.0.0:1433->1433/tcp`

4. **Privileged Operation Exposure:**
   - `INTERNAL_SERVICE_KEY` authorizes privileged first-party calls:
     - `POST /api/v1/inventory/stock-movements` (arbitrary inventory stock injections and batch stock overrides).
     - E-commerce synchronization webhook triggers (`/api/v1/ecom`).
     - Numbering lock bypasses (`/api/v1/numbering`).
   - `SGIP_VAULT_MASTER_KEY` encrypts/decrypts statutory credentials (GSTN credentials, NIC E-Way Bill authentication tokens, banking credentials) using AES-256-GCM + HKDF-SHA256 (`backend/app/compliance/vault/crypto.py`).
   - `JWT_SECRET_KEY` signs authentication tokens. A known key enables forging `SYSADMIN` tokens granting unrestricted access to all tenant records.
   - `MSSQL_SA_PASSWORD` grants sysadmin privileges over SQL Server.

5. **Current Container Runtime State:**
   Direct probe of running containers confirmed:
   - `smriti-api` was started with random 64-character hex keys generated in `.env` (lengths = 64, default fallbacks not used for JWT/Internal/Vault keys).
   - BUT `smriti-db` and `smriti-api`'s `DATABASE_URL` are running with default credentials `postgres:postgres` (`is_default_fallback=True`).
   - `smriti-mssql` is running with default password `netmanthan@123`.

### Risk Assessment Matrix

| Service | Credential / Secret | Exposure Condition | Severity | Impact |
|---|---|---|---|---|
| `smriti-api` | `JWT_SECRET_KEY` | Bootstrapped without `.env` or missing env var | **Critical (P0)** | Full tenant authentication bypass; rogue JWT token forgery with SYSADMIN role. |
| `smriti-api` | `INTERNAL_SERVICE_KEY` | Bootstrapped without `.env` or missing env var | **Critical (P0)** | Direct stock ledger tampering via `/api/v1/inventory/stock-movements` without audit trail. |
| `smriti-api` | `SGIP_VAULT_MASTER_KEY` | Bootstrapped without `.env` or missing env var | **Critical (P0)** | Decryption of statutory GSTN, E-Way Bill, and tax compliance vault secrets. |
| `smriti-db` | `POSTGRES_PASSWORD` | Deployed with default compose file | **High (P1)** | Direct external SQL access to multi-tenant databases on port 2781. |
| `smriti-mssql` | `MSSQL_SA_PASSWORD` | Deployed with default compose file | **High (P1)** | Full SA administrator takeover on port 1433. |

### Recommended Remediation (Scheduled for Phase 1 Implementation)
1. **Remove literal fallbacks in `docker-compose.yml`**: Change `${JWT_SECRET_KEY:-<default>}` to `${JWT_SECRET_KEY:?Error: JWT_SECRET_KEY must be set in .env}` so Docker Compose refuses to launch if secrets are omitted.
2. **Explicit Production Profile**: Create `docker-compose.prod.yml` that explicitly sets `ENVIRONMENT=production`, activating the Pydantic fail-closed security validators.
3. **Localhost Port Binding**: Change port declarations from `2781:5432` to `127.0.0.1:2781:5432` and `127.0.0.1:1433:1433` so database engines are never directly accessible from external public IP interfaces.
4. **Credential Rotation Script**: Author `scripts/rotate_deployment_secrets.py` to automate CSPRNG 256-bit secret generation, `.env` updating, and vault re-encryption.

---

## 3. Reconciliation of Billing Entry Points

### Architectural Convergence Analysis

The static code audit and route analysis revealed five overlapping billing UI surfaces and three distinct backend transaction handlers. A deep inspection of the source code reveals that **all three backend transaction endpoints already converge onto a single transactional writer**:

```
[ Frontend Entry Points ]
  ├── SmritiBillingStudio (RETAIL_POS) ───► POST /api/v1/pos/checkout ──────┐
  ├── SmritiCreditBillingTerminal ────────► POST /api/v1/billing/checkout ──┤
  ├── SmritiBillingStudio (B2B_DIST) ─────► POST /api/v1/pos/checkout ──────┼──► CanonicalSalesPostingWriter
  ├── BillingTerm.tsx (Traditional) ──────► POST /api/v1/sales/invoices ────┤      │
  └── ProPosBillingTerm.tsx (Legacy POS) ─► POST /api/v1/pos/checkout ──────┘      ├──► HeadlessBillingCore (Pricing & GST)
                                                                                   ├──► NumberingService (Voucher Allocation)
                                                                                   ├──► InventoryWmsService (Batch Movements)
                                                                                   ├──► PaymentsEngine (Payment Ledger)
                                                                                   └──► IntegrationOutbox (Event Stream)
```

### Traceability Summary (Refer to `audit/SMRITI_BILLING_ROUTE_TRACEABILITY.csv`)

| Surface ID | Component | Navigation Mode | Target Endpoint | Architectural Role | Action |
|---|---|---|---|---|---|
| `BILL-001` | `SmritiBillingStudio.tsx` | `RETAIL_POS` (in `BillingWorkspace`) | `POST /pos/checkout` | **Canonical Retail POS** | Retain as sole counter billing terminal. |
| `BILL-002` | `SmritiCreditBillingTerminal.tsx` | `CREDIT_BILLING` (in `BillingWorkspace`) | `POST /billing/checkout` | **Canonical Credit Billing** | Retain as sole B2B / customer account billing terminal. |
| `BILL-003` | `SmritiBillingStudio.tsx` | `B2B_DISTRIBUTOR` (in `BillingWorkspace`) | `POST /pos/checkout` | **Canonical Distributor Studio** | Retain for packing slip consolidation & B2B invoicing. |
| `BILL-004` | `ProPosBillingTerm.tsx` | `ProPosWs.tsx` (marked `@deprecated`) | `POST /pos/checkout` | **Superseded Legacy POS** | Deprecate and route all legacy navigation to `BillingWorkspace`. |
| `BILL-005` | `BillingTerm.tsx` | `ProPosWs.tsx` (marked `@deprecated`) | `POST /sales/invoices` | **Superseded Traditional Terminal** | Deprecate and retire; migrate any unique customer PO guards. |
| `BILL-006` | `StandaloneWindowView.tsx` | `standalone-window` | `POST /sales/orders` | **Auxiliary Order Tool** | Retain for quick order drafting; block direct invoice issuance. |
| `BILL-007` | `DistTaxInvoice.tsx` | `sales-studio` | `POST /sales/invoices` | **Compatibility Sales Form** | Retain for back-office wholesale invoicing. |

### Canonical Decision Rationale
1. **Mathematical Authority:** `HeadlessBillingCore.calculate_billing` is the single source of truth for commercial discount allocation, 5-tier tax-inclusivity hierarchy, and ROUND_HALF_UP arithmetic.
2. **Persistence & Ledger Authority:** `CanonicalSalesPostingWriter.post_sales_transaction` is the single source of truth for atomic persistence across `sales_invoices`, `stock_movements`, `payment_transactions`, `customer_credit_ledger_entries`, and `integration_outbox_events`.
3. **UI Container Authority:** `BillingWorkspace.tsx` already successfully unifies `RETAIL_POS`, `CREDIT_BILLING`, and `B2B_DISTRIBUTOR` into a cohesive workspace with hotkeys (Alt+1, F1-F12), active shift awareness, and Z-report closeout.

---

## 4. Shared Transaction Core Verification Results

During Phase 1, non-destructive tests were executed across available test infrastructure to assess the transaction core:

### Literal Test Evidence Summary

1. **Frontend Vitest Suites (In-Memory Isolation):**
   - `src/tests/canonicalBillingConsolidation.test.ts`: **5/5 passed**
   - `src/tests/billingWorkspaceConvergence.test.ts`: **5/5 passed**
   - `src/tests/ttInvoiceBillingCalculation.test.ts`: **10/10 passed**
   - `src/tests/billingInputValidations.test.ts`: **25/25 passed**
   - `src/tests/childCustomerBillingVisibility.test.tsx`: **5/5 passed**
   - `src/tests/b2bPackingConsolidatedBilling.test.ts`: **16/16 passed**
   - *Total:* **66/66 frontend tests passed (0 failures).**

2. **Backend Pytest Suites (Isolated & Live Probes):**
   - `backend/app/tests/test_gst_engine.py`: **9/9 passed** (49.23s) — verified GSTIN checks, state codes, intra/interstate math, GSTR-1 classification.
   - `backend/tests/test_customer_lifecycle_e2e.py`: **4/4 passed** (10.03s in `smriti_test_phase2c`) — verified customer creation, concurrency, parent-child visibility, sales invoice creation and retrieval.
   - `backend/tests/test_billing_input_validations.py`: **4 passed, 2 failed** (21.73s).
     - *Root Cause:* The 2 failures (`test_canonical_sales_writer_rejects_negative_tender` and `test_canonical_sales_writer_rejects_cash_over_2_lakh`) were caused by an incomplete `AsyncMock` fixture in the test file that did not mock `res_comp.scalars().first()` for the newly introduced company/seller validation step `0A`.
   - `backend/tests/test_gst_2_slab_validation.py`: **3 passed, 3 failed** (1.53s).
     - *Root Cause:* The live control plane database (`smritisys`) has active 12% and 28% GST slabs (abolished under GST 2.0 rules), and 468 items in `smriti001` are assigned the 12% slab without the mandatory `REQUIRES_REVIEW` flag.

---

## 5. Prioritized Remediation Roadmap

The remediation work is structured in sequential phases according to risk priority:

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Security Hardening & Secret Gating (P0)      │
├────────────────────────────────────────────────────────┤
│ Phase 2: Database Integrity & GST Slab Alignment (P1)  │
├────────────────────────────────────────────────────────┤
│ Phase 3: Billing Route Consolidation & Convergence (P2)│
├────────────────────────────────────────────────────────┤
│ Phase 4: Shared Transaction Core E2E Verification (P2) │
├────────────────────────────────────────────────────────┤
│ Phase 5: Template Manifest Provisioning               │
│          (Distributor, Retail, Hybrid)                │
└────────────────────────────────────────────────────────┘
```

### Phase 1: Security Hardening & Secret Gating (P0)
- **Scope:** `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `backend/app/core/config.py`.
- **Actions:**
  1. Replace default literal values in Compose files with required variable syntax `${VAR:?error}`.
  2. Bind database and internal API ports to `127.0.0.1` by default.
  3. Ensure `ENVIRONMENT=production` is strictly declared in production Compose files.
  4. Author `scripts/rotate_secrets.py` for cryptographically secure 256-bit secret rotation.
- **Acceptance Criteria:** `docker compose -f docker-compose.yml config` fails cleanly if `.env` keys are absent. Production startup rejects weak or default secrets.

### Phase 2: Database Integrity & GST Slab Alignment (P1)
- **Scope:** Control plane `smritisys` and tenant database `smriti001`.
- **Actions:**
  1. Execute safe data remediation (`scripts/remediate_gst_2_slab_correction.py`) under explicit backup to soft-retire 12% and 28% slabs and mark 468 items as `REQUIRES_REVIEW`.
  2. Fix `AsyncMock` test fixture in `backend/tests/test_billing_input_validations.py` to correctly mock company execution.
- **Acceptance Criteria:** `test_gst_2_slab_validation.py` passes 6/6 tests green; `test_billing_input_validations.py` passes 6/6 tests green.

### Phase 3: Billing Route Consolidation & UI Convergence (P2)
- **Scope:** `src/components/billing/BillingWorkspace.tsx`, `TabRenderer.tsx`, `src/navigation/menuRegistry.ts`.
- **Actions:**
  1. Deprecate `ProPosWs.tsx` and `BillingTerm.tsx`; route all legacy menu entries to `BillingWorkspace`.
  2. Harmonize customer PO line invoicing into `BillingWorkspace` (mode: `B2B_DISTRIBUTOR`).
  3. Prohibit direct invoice settlement from `StandaloneWindowView.tsx` (lock to Sales Orders only).
- **Acceptance Criteria:** `npm run test` executes all billing consolidation tests with zero routing to deprecated components.

### Phase 4: Shared Transaction Core E2E Verification (P2)
- **Scope:** Non-destructive transaction execution on disposable PostgreSQL clone `smriti_test_e2e_runner`.
- **Actions:**
  1. Execute all 10 areas of `audit/SMRITI_TRANSACTION_TEST_PLAN.md`.
  2. Verify sales return reversal, multi-tender payment ledger consistency, and negative stock blocking.
- **Acceptance Criteria:** 10/10 areas verified with literal terminal logs; zero financial drift.

### Phase 5: Template Manifest Provisioning (Distributor, Retail, Hybrid)
- **Scope:** Authoritative template registry manifests.
- **Actions:**
  1. Author `src/templates/distributorTemplate.ts`, `src/templates/retailTemplate.ts`, `src/templates/hybridTemplate.ts`.
  2. Map module manifests to verified canonical routes only.
- **Acceptance Criteria:** Templates activate specific sub-modes of `BillingWorkspace` without enabling overlapping or unverified routes.

---

## 6. Guardrail Compliance & Request for Approval

### Guardrail Verification Checklist
- [x] Baseline branch, commit HEAD, and status recorded.
- [x] No templates implemented yet.
- [x] No broad refactoring attempted.
- [x] No application source, database records, schema, migrations, or deployment configs modified.
- [x] Git branch and uncommitted work preserved intact.
- [x] Live database revision and test outputs backed by literal terminal logs.
- [x] All three audit deliverables produced (`SMRITI_POST_AUDIT_REMEDIATION_PLAN.md`, `SMRITI_BILLING_ROUTE_TRACEABILITY.csv`, `SMRITI_TRANSACTION_TEST_PLAN.md`).

### Exact Next Implementation Step
The next step is **Phase 1 Implementation: Security Hardening & Secret Gating (P0)**, which requires modifying `docker-compose.yml` to remove predictable default secret fallbacks and establishing mandatory `.env` variable gating.

> **STOP & APPROVAL GATE:** Per AGENTS.md governance and session guardrails, explicit user approval is required before modifying deployment configuration (`docker-compose.yml`), changing credentials, updating persistent database records, or proceeding to Phase 1 code implementation.
