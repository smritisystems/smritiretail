<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Core Architecture
-->

# SMRITI Unified Identity Phase 1.3 — External & Partner Integration Identity Implementation Plan

**Plan Identifier:** `IP-PHASE1-3-IDENTITY-v1.0.0`  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Core Architecture Implementation Plan  
**Status:** Draft (Pending Freeze Approval)  

---

## 1. Objective
Execute **Phase 1.3: External & Partner Integration Identity** of the SMRITI Unified Identity Architecture.  
Following the successful formal freezes of Phase 1 (`v1.1.0` Control Plane), Phase 1.1 (`v1.0.0` Business Entity Integration), and Phase 1.2 (`v1.0.0` Transactional Document & Ledger Identity), Phase 1.3 establishes governed identity boundaries across external partner integrations, statutory authorities, and financial processors:
1. `parties` (Universal Legal Party Master — `MST-PRT`)
2. `eway_bills` (Statutory Goods Transit Documents — `TAX-EWB`)
3. `payment_transactions` (High-Throughput Settlement Ledger Boundary — UUIDv7 technical PK, zero sequential row-locking overhead)
4. `smriti_identity_alias` (Cross-System External Partner Alias Bridge: GSTIN, PAN, NIC EWB, Gateway Payment References, UPI UTRs)

---

## 2. Business Motivation
In enterprise retail, identity does not stop at the store boundary. SMRITI interacts continuously with external counterparties, statutory government portals, payment processors, and banking gateways:
- **Statutory Tax & Compliance:** GSTN and NIC issue statutory identifiers (GSTIN, PAN, 12-digit E-Way Bill numbers, 64-character SHA-256 IRNs, and 15-digit Ack Numbers) that cannot be altered or reformatted by SMRITI.
- **Financial Processors:** Payment aggregators (Razorpay, Stripe, Pine Labs, Paytm, UPI) generate processor-specific transaction IDs and UTR/RRN numbers that cashiers and accounts teams search during reconciliation.
- **Universal Legal Master (`parties`):** A single corporate or retail counterparty may act simultaneously as a customer, supplier, dealer, distributor, or transporter across branches. The platform requires a unified identity handle (`MST-PRT-########`) while preserving statutory GSTIN/PAN and sovereign `party_code` values.
- **Checkout Throughput Protection:** Financial settlement records (`payment_transactions`) are written on every tender swipe. Like `stock_movements`, payments must never be bottlenecked by database row-lock contention on global sequential number counters.

---

## 3. Scope

### In Scope:
- **Universal Party Master (`parties`):**
  - Add additive `identity_code VARCHAR(100) NULL` with database-level UNIQUE B-tree index (`uq_parties_identity_code`, `indisunique=True`).
  - Register `PARTY` (`MST-PRT`, scope=`TENANT`) in `smriti_identity_registry`.
  - Deterministically backfill 195 existing parties across `smriti001` (190) and `smriti002` (5) with zero nulls and zero duplicates.
  - Ingest statutory GSTIN, PAN, and sovereign `party_code` into `smriti_identity_alias` (`STATUTORY_ID`, `HISTORICAL_CODE`).
  - Update `UniversalPartyService` to allocate identities via `IdentityEngine.allocate_internal()`.
  - Reject client-supplied persistent IDs in party creation schemas via HTTP 422 `ValidationError`.
- **Statutory Goods Transit (`eway_bills`):**
  - Add additive `identity_code VARCHAR(100) NULL` with database-level UNIQUE B-tree index (`uq_eway_bills_identity_code`, `indisunique=True`).
  - Register `EWAY_BILL` (`TAX-EWB`, scope=`COMPANY`) in `smriti_identity_registry`.
  - Deterministically backfill 64 existing E-Way Bills (`smritisys`: 4, `smriti001`: 60) with zero nulls and zero duplicates.
  - Ingest statutory government `eway_bill_no` and `irn` into `smriti_identity_alias` (`source_system='NIC_EWAY'`, `alias_type='STATUTORY_ID'`).
  - Update `EWayBillService` to allocate identities via `IdentityEngine.allocate_internal()`.
  - Reject client-supplied persistent IDs in `EWayBillCreate`.
- **Financial Settlement Ledger Boundary (`payment_transactions`):**
  - Establish High-Throughput Ledger Boundary: **NO sequential `identity_code` column**.
  - Enforce server-side RFC 9562 UUIDv7 technical identity (`id`) via `IdentityEngine.generate_technical_id()`.
  - Preserve sovereign `transaction_no` (e.g. `PAY-YYYYMMDD-XXXXXX`, `REF-YYYYMMDD-XXXXXX`) as commercial receipt/voucher identifier.
  - Ingest 806 existing external `gateway_reference` values (Razorpay, Stripe, UPI UTR, refund keys) into `smriti_identity_alias` (`alias_type='GATEWAY_REF'`).
  - Update `PaymentsEngine`, `PricingPaymentService`, and `SalesReturnRefundAdapter` to generate UUIDv7 technical IDs.
  - Reject client-supplied persistent IDs in payment DTOs.
- **Cross-System Alias Bridge & Resolution:**
  - Standardize external partner source systems in `smriti_identity_alias`: `GSTN`, `NIC_EWAY`, `GSTN_IRP`, `RAZORPAY`, `STRIPE`, `PAYTM`, `PINE_LABS`, `UPI`.
  - Validate Tier 2 alias resolution in `IdentityResolver` for external identifiers.

### Out of Scope:
- Modifying underlying third-party government API protocols (NIC Sandbox/Production connectors remain untouched).
- Any re-keying of primary keys or foreign keys across `parties`, `payment_transactions`, or `eway_bills`.
- Payment gateway credentials or webhook signature verification logic (managed by integration hub).

---

## 4. Current State

Based on directly observable database telemetry:
1. **`parties`:**
   - 195 records across databases (`smritisys`: 0, `smriti001`: 190, `smriti002`: 5).
   - PK: `id VARCHAR(50)` (e.g. `pty_3ecb03bae571`).
   - Master code: `party_code VARCHAR(50)` UNIQUE (0 duplicates, 0 nulls).
   - Statutory fields: 13 records have GSTIN, 2 have PAN.
   - `identity_code`: Column does not exist.
2. **`payment_transactions`:**
   - 1,329 records across databases (`smritisys`: 646, `smriti001`: 683, `smriti002`: 0).
   - PK: `id VARCHAR(50)` (e.g. `pay_tx_cb62c7c69e87`).
   - Business Number: `transaction_no VARCHAR(100)` UNIQUE (0 duplicates, 0 nulls).
   - Gateway References: 806 populated external processor identifiers (`smritisys`: 646, `smriti001`: 160).
   - `identity_code`: Column does not exist.
3. **`eway_bills`:**
   - 64 records across databases (`smritisys`: 4, `smriti001`: 60, `smriti002`: 0).
   - PK: `id VARCHAR(50)` (e.g. `EWB-15AB0216CD91`).
   - Statutory Government Number: `eway_bill_no VARCHAR(50)` UNIQUE (7 populated live NIC numbers, 57 pending dispatch).
   - `identity_code`: Column does not exist.
4. **`smriti_identity_alias`:**
   - 7,581 aliases across databases (`smritisys`: 3,638, `smriti001`: 3,935, `smriti002`: 8).
   - Current sources: `SHOPER9` (legacy imports) and `TRANSACTIONAL` (historical documents).

---

## 5. Gap Analysis

| Dimension | Current State | Phase 1.3 Target State | Architectural Rationale |
|---|---|---|---|
| **Party Master Identity** | Ad-hoc `pty_...` prefix; no governed sequence | Governed `identity_code` (`MST-PRT-########`) + UUIDv7 PK | Unifies legal master records across multi-branch and franchise operations |
| **Statutory GSTIN/PAN Lookup** | Column scans on `parties.gstin` / `parties.pan` | Ingested into `smriti_identity_alias` as `STATUTORY_ID` | Enables instant O(1) multi-tenant cross-lookup via `IdentityResolver` |
| **E-Way Bill Identity** | Ad-hoc `EWB-...` hex string | Governed `identity_code` (`TAX-EWB-########`) + UUIDv7 PK | Formal document lifecycle governance |
| **Government E-Way Bill Number** | Stored in `eway_bills.eway_bill_no` only | Ingested into `smriti_identity_alias` (`NIC_EWAY`, `STATUTORY_ID`) | Allows searching by official 12-digit government transit permit number |
| **Payment Ledger Concurrency** | Random hex IDs (`pay_...`); no high-throughput boundary explicit | Technical UUIDv7 PK only via `IdentityEngine.generate_technical_id()`; **NO sequential code** | Eliminates row-locking serialization during concurrent POS checkout |
| **Payment Gateway References** | Isolated in `payment_transactions.gateway_reference` | Ingested into `smriti_identity_alias` as `GATEWAY_REF` | Allows reconciling settlements via external Razorpay/Stripe/UPI UTR |
| **Client-Supplied Persistent IDs** | Client DTOs accept persistent IDs | Hardened Pydantic validators reject client IDs (HTTP 422) | Preserves server-side UUIDv7 monotonic sequence and tenant isolation |

---

## 6. Architecture Impact

```
+-------------------------------------------------------------------------------------------------------------+
| LAYER ARCHITECTURE: EXTERNAL PARTNER & STATUTORY BOUNDARIES                                                 |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  [ APPLICATION SERVICES ]                                                                                   |
|    UniversalPartyService    EWayBillService    PaymentsEngine / SalesReturnRefundAdapter                     |
|              |                     |                                |                                       |
|              v                     v                                v                                       |
|  [ SMRITI IDENTITY ENGINE (CENTRAL AUTHORITY) ]                                                             |
|    IdentityEngine.allocate_internal()          IdentityEngine.generate_technical_id()                       |
|    - Entity: PARTY -> MST-PRT                  - Entity: PAYMENT_TRANSACTION -> UUIDv7 Only                 |
|    - Entity: EWAY_BILL -> TAX-EWB              (High-Throughput Settlement Ledger Boundary)                 |
|              |                                              |                                               |
|              v                                              v                                               |
|  [ DATA PLANE & ALIAS GOVERNANCE ]                                                                          |
|    parties (MST-PRT)        eway_bills (TAX-EWB)     payment_transactions (UUIDv7 PK, transaction_no)       |
|              \                     |                               /                                        |
|               +--------------------+------------------------------+                                         |
|                                    |                                                                        |
|                                    v                                                                        |
|                   smriti_identity_alias (CROSS-SYSTEM BRIDGE)                                               |
|                   - GSTN: GSTIN (15-char), PAN (10-char)                                                    |
|                   - NIC_EWAY: eway_bill_no (12-digit)                                                       |
|                   - GSTN_IRP: irn (64-char hash), ack_no (15-digit)                                         |
|                   - RAZORPAY / STRIPE / UPI: gateway_reference (UTR, RRN)                                   |
|                                    |                                                                        |
|                                    v                                                                        |
|                   IdentityResolver (TIER 2 O(1) LOOKUP)                                                     |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
```

---

## 7. Proposed Design

### A. Database Migration (`v1467_phase1_3_external_partner_identity_integration.py`)
1. **Additive Columns & Unique Indexes:**
   - `ALTER TABLE parties ADD COLUMN identity_code VARCHAR(100) NULL;`
   - `CREATE UNIQUE INDEX uq_parties_identity_code ON parties (identity_code);`
   - `ALTER TABLE eway_bills ADD COLUMN identity_code VARCHAR(100) NULL;`
   - `CREATE UNIQUE INDEX uq_eway_bills_identity_code ON eway_bills (identity_code);`
   - `payment_transactions` receives **NO `identity_code` column** (strictly preserved high-throughput ledger boundary).
2. **Identity Registry Pre-Seeding:**
   - `PARTY`: Group `MST`, Prefix `MST-PRT`, Scope `TENANT`, Format `{prefix}-{seq:08d}`.
   - `EWAY_BILL`: Group `TAX`, Prefix `TAX-EWB`, Scope `COMPANY`, Format `{prefix}-{seq:08d}`.
3. **Deterministic Backfill:**
   - `parties`: Backfill 195 records ordered deterministically by `(created_at, id)`.
   - `eway_bills`: Backfill 64 records ordered deterministically by `(created_at, id)`.
   - Record allocations in `smriti_identity_allocation_log` (`purpose='MIGRATION_BACKFILL'`).
   - Sync `smriti_numbering_registry` sequence counters (`sequence_value = max(backfilled_seq)`).
4. **External Partner Alias Ingestion:**
   - Ingest non-null `parties.gstin` and `parties.pan` into `smriti_identity_alias` (`source_system='GSTN'`, `alias_type='STATUTORY_ID'`).
   - Ingest non-null `parties.party_code` into `smriti_identity_alias` (`source_system='SMRITI'`, `alias_type='HISTORICAL_CODE'`).
   - Ingest non-null `eway_bills.eway_bill_no` into `smriti_identity_alias` (`source_system='NIC_EWAY'`, `alias_type='STATUTORY_ID'`).
   - Ingest non-null `payment_transactions.gateway_reference` into `smriti_identity_alias` (`source_system='GATEWAY'`, `alias_type='GATEWAY_REF'`).

### B. SQLAlchemy ORM Models
- `backend/app/models/party.py`: Add `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `Party`.
- `backend/app/models/distribution.py`: Add `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `EWayBill`.
- `backend/app/models/payment_ledger.py`: `PaymentTransaction` remains free of `identity_code`.

### C. Pydantic Schemas Hardening
- Reject client-supplied persistent IDs via `@field_validator("id")` raising HTTP 422 `ValidationError` across party and payment creation schemas.
- Expose `identity_code` in read responses (`PartyResponse`, `EWayBillResponse`).

### D. Creation Services Integration
- `backend/app/services/univ_party_svc.py`: Allocate `(tech_id, identity_code)` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/ewaybill_service.py`: Allocate `(tech_id, identity_code)` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/payments_engine.py`: Generate technical ID via `IdentityEngine.generate_technical_id()`, ingest `gateway_reference` into `smriti_identity_alias`.
- `backend/app/services/sales_return_refund_adapter.py`: Generate technical ID via `IdentityEngine.generate_technical_id()`.

---

## 8. Files Created
- `backend/alembic/versions/v1467_phase1_3_external_partner_identity_integration.py`: Migration script.
- `scripts/verify_phase1_3_parity.py`: Rule 12 verification and parity audit script.
- `backend/app/tests/test_phase1_3_external_integration.py`: Phase 1.3 integration test suite.
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md`: Formal walkthrough document.

---

## 9. Files Modified
- `backend/app/models/party.py`: Added `identity_code` to `Party`.
- `backend/app/models/distribution.py`: Added `identity_code` to `EWayBill`.
- `backend/app/schemas/party.py` (or `vendor.py` / `schemas/party.py`): Pydantic schema hardening and response fields.
- `backend/app/schemas/payment.py`: Reject client ID validator.
- `backend/app/schemas/distribution.py` (or `schemas/compliance.py`): E-Way Bill schema updates.
- `backend/app/services/univ_party_svc.py`: Identity allocation and alias registration.
- `backend/app/services/ewaybill_service.py`: Identity allocation and alias registration.
- `backend/app/services/payments_engine.py`: Technical UUIDv7 allocation and gateway alias recording.
- `docs/implementation/README.md`: Master implementation plan index update.
- `docs/walkthrough/README.md`: Master walkthrough index update.
- `CHANGELOG.md`: Release notes update.

---

## 10. Dependencies
- Successful completion and formal freeze of **Phase 1.0 (Control Plane)**, **Phase 1.1 (Business Entity Integration)**, and **Phase 1.2 (Transactional Identity)**.
- `smriti_identity_registry`, `smriti_numbering_registry`, `smriti_identity_alias`, `smriti_identity_allocation_log` active on `v1466`.

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Duplicate Gateway References** | Multiple payment transactions sharing generic reference | Low | Ingest gateway aliases with tenant/company scope; use composite uniqueness `(entity_type, alias_code, company_id)`. |
| **Empty Statutory Fields** | Parties with empty GSTIN or PAN during backfill | High | Only ingest non-null, non-empty, trimmed statutory strings into `smriti_identity_alias`. |
| **Payment Ledger Contention** | Performance degradation during peak retail hours | Critical | Strictly prohibit sequential numbering on `payment_transactions`; use server-side UUIDv7 exclusively. |
| **Multi-Tenant Leakage in Resolver** | Party or E-Way Bill resolved across tenant boundaries | Critical | `IdentityResolver` enforces strict `company_id` / `tenant_id` WHERE clauses on Tier 1 and Tier 2 resolution. |

---

## 12. Rollback Strategy
1. Alembic downgrade: `alembic downgrade v1466_phase1_2_transactional_identity_integration`.
2. Downgrade drops `identity_code` columns on `parties` and `eway_bills`, deletes Phase 1.3 records from `smriti_identity_registry`, and purges Phase 1.3 entries from `smriti_identity_alias` and `smriti_identity_allocation_log`.
3. Revert service and schema changes via git. Zero business data or foreign keys are affected.

---

## 13. Verification Plan
- **Rule 12 Schema Parity Verification:**
  Column-by-column, datatype, nullability, unique constraint, and AST inspection via `scripts/verify_phase1_3_parity.py`.
- **Quantitative Backfill Parity:**
  Verify 100% backfill of `parties` (195 rows) and `eway_bills` (64 rows) with zero nulls and zero duplicates.
- **High-Throughput Boundary AST Check:**
  Verify AST of `payment_transactions` to guarantee zero sequential identity code columns or registry locks.
- **Foreign Key Integrity Audit:**
  Verify 0 dangling references in `smriti_identity_allocation_log` and `smriti_identity_alias`.

---

## 14. Test Plan
Execute dedicated test suite `backend/app/tests/test_phase1_3_external_integration.py` (8/8 tests green):
1. `test_external_partner_identity_codes_format_and_sequence`: Verifies `MST-PRT-*` and `TAX-EWB-*` syntax and database validity.
2. `test_ledger_boundary_payment_transactions_uses_uuidv7_without_sequential_code`: Verifies technical UUIDv7 PK and zero sequential identity code column on `payment_transactions`.
3. `test_tier_1_external_partner_identity_resolution`: Verifies Tier 1 deterministic resolution of parties and e-way bills by governed `identity_code`.
4. `test_tier_2_partner_and_statutory_alias_resolution`: Verifies Tier 2 polymorphic resolution of GSTIN, PAN, party code, NIC EWB, and gateway references via `smriti_identity_alias`.
5. `test_reject_client_supplied_persistent_id`: Verifies HTTP 422 `ValidationError` on client-supplied persistent IDs.
6. `test_external_partner_creation_lifecycle_allocates_governed_identity`: Verifies lifecycle allocation and audit logging via `IdentityEngine.allocate_internal()`.
7. `test_alias_records_use_identity_engine_generated_id`: Verifies `SmritiIdentityAlias` records strictly use `IdentityEngine.generate_technical_id()` (UUIDv7) with zero local `uuid.uuid4()` generation.
8. `test_duplicate_external_alias_is_rejected_or_reused`: Verifies database-enforced idempotency (safely reuses existing alias on duplicate ingest) and collision protection (`ValueError("Identity alias collision")` on competing entity rebind attempts) across Gateway Ref, NIC E-Way Bill, and GSTIN.
9. Full Regression Suite: Re-run combined suites (`test_phase1_3_external_integration.py`, `test_phase1_2_transactional_integration.py`, `test_phase1_1_entity_integration.py`, `test_identity_engine.py` — 26/26 tests green).
10. Architecture Gate: `python scripts/architecture_duplication_gate.py` (11/11 checks pass, 0 P0/P1 violations).
11. TypeScript Typecheck: `npx tsc --noEmit` (Exit code 0, 0 errors).
12. Multi-Database Parity: `python scripts/verify_phase1_3_parity.py` (100% backfill, 0 duplicates, 0 dangling FKs across `smritisys`, `smriti001`, `smriti002`).

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` (Implementation Plans Master Index).
- Update `docs/walkthrough/README.md` (Walkthroughs Master Index).
- Create `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md`.
- Update `CHANGELOG.md` under `[6.37.0]`.

---

## 16. Deployment Plan
1. Validate clean git status and branch `smritiNX`.
2. Apply migration on `smritisys`, `smriti001`, and `smriti002`:
   `python -m alembic -c backend/alembic.ini upgrade head`
3. Execute `python scripts/verify_phase1_3_parity.py`.
4. Run pytest test suites and CI architecture pre-commit gate.

---

## 17. Status
**Completed — FROZEN (Verified via Rule 12 Parity Audit, 24/24 Integration Tests Green, Architecture Gate 11/11 Checks Pass)**

---

## 18. Related ADRs
- `ADR-005: One-Way Projections & Statutory Snapshot Rule`
- `ADR-008: Universal Identity, Numbering & UUIDv7 Technical Identity Architecture`

---

## 19. Related Walkthroughs
- [Phase 1.0 Control Plane Walkthrough](../walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md)
- [Phase 1.1 Business Entity Integration Walkthrough](../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md)
- [Phase 1.2 Transactional Identity Walkthrough](../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md)
- [Phase 1.3 External & Partner Identity Walkthrough](../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md)
