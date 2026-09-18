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

  * Version    : 6.37.0
  * Created    : 2026-09-18
  * Modified   : 2026-09-18
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal Core Architecture
-->

# Walkthrough: SMRITI Unified Identity Phase 1.3 — External & Partner Integration Identity

## 1. Purpose
This document records the complete implementation, database migration, schema hardening, and rigorous multi-database parity verification of **Phase 1.3: External & Partner Integration Identity** in SMRITI Retail OS. Following the successful freeze of Phase 1 (Control Plane v1.1.0), Phase 1.1 (Business Entity Integration v1.0.0), and Phase 1.2 (Transactional Document & Ledger Identity v1.0.0), Phase 1.3 establishes governed technical and external identity bridges across external partner, statutory, and payment ledger entities:
1. `parties` (Universal Legal Party Master: Suppliers, Customers, Vendors)
2. `eway_bills` (Statutory Goods Transit Documents / NIC E-Way Bill)
3. `payment_transactions` (High-Throughput Settlement Ledger Boundary)
4. `smriti_identity_alias` (External System Identifier Bridge: GSTIN, PAN, NIC EWB, Gateway References, UPI UTRs)

---

## 2. Scope
The scope of Phase 1.3 covers:
- **Zero PK/FK Re-keying:** Complete preservation of all existing string primary keys (`*.id`) and foreign key constraints across the legal party and transaction graph.
- **Preservation of Sovereign Identifiers:** Commercial `party_code` (master code), statutory `eway_bill_no` (government 12-digit transit permit), and financial `transaction_no` (receipt/voucher reference) remain sovereign business identifiers and are **never** replaced by `identity_code`.
- **Database-Level Unique Constraints:** Introduction of `identity_code VARCHAR(100)` with database-enforced unique B-tree indexes (`uq_parties_identity_code`, `uq_eway_bills_identity_code`) verified with `indisunique=True`.
- **High-Throughput Settlement Ledger Boundary:** `payment_transactions` is treated as a high-frequency settlement ledger (1,329 rows across databases). It does **NOT** receive a human sequential `identity_code` column, preventing row-locking serialization bottlenecks during concurrent POS cashier checkout. Its technical primary key (`id`) is strictly generated as UUIDv7 via `IdentityEngine.generate_technical_id()`.
- **Severing Client-Supplied IDs:** Frontend/client-supplied persistent technical IDs are prohibited across creation schemas (`PartyCreateRequest`, `ProcessPaymentRequest`) via Pydantic `@field_validator` raising HTTP 422 `ValidationError`.
- **External Partner Service Allocations:** `UnivPartyService`, `PartyMasterService`, `EWayBillService`, `PaymentsEngine`, and `SalesReturnRefundAdapter` allocate identities strictly via `IdentityEngine.allocate_internal()` and `IdentityEngine.generate_technical_id()`.
- **Deterministic Backfill & Audit Logging:** Backfilled 195 parties and 64 e-way bills across all databases ordered deterministically by timestamp; logged 259 entries in `smriti_identity_allocation_log` (`purpose='MIGRATION_BACKFILL'`); ingested 934 external aliases into `smriti_identity_alias` (`GSTIN`, `PAN`, `HISTORICAL_CODE`, `NIC_EWAY`, `GATEWAY_REF`); synchronized sequence counters in `smriti_numbering_registry`.

---

## 3. Files Created
- `backend/alembic/versions/v1467_phase1_3_external_partner_identity_integration.py`
- `scripts/verify_phase1_3_parity.py`
- `backend/app/tests/test_phase1_3_external_integration.py`
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md`
- `docs/implementation/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_Plan_v1.0.0.md`

---

## 4. Files Modified
- `backend/app/services/identity/engine.py`: Canonical `IdentityEngine.register_alias()` with UUIDv7 ID generation and collision/idempotency protection.
- `backend/app/models/party.py`: Added `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `Party`.
- `backend/app/models/distribution.py`: Added `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `EWayBill`.
- `backend/app/schemas/party_master.py`: Hardened `PartyCreateRequest` to reject client IDs; added `identity_code` to `PartyResponse`.
- `backend/app/compliance/schemas/compliance.py`: Added `id` and `identity_code` to `EWayBillResponse`.
- `backend/app/schemas/payments.py`: Hardened `ProcessPaymentRequest` to reject client IDs.
- `backend/app/services/univ_party_svc.py`: Allocated `party_id` and `identity_code` via `IdentityEngine.allocate_internal()`; registered aliases via `IdentityEngine.register_alias()`.
- `backend/app/services/party_master_svc.py`: Allocated `party_id` and `identity_code` via `IdentityEngine.allocate_internal()`; registered aliases via `IdentityEngine.register_alias()`.
- `backend/app/compliance/services/ewaybill_service.py`: Allocated `ewb_id` and `identity_code` via `IdentityEngine.allocate_internal()`; registered statutory alias via `IdentityEngine.register_alias()`.
- `backend/app/services/payments_engine.py`: Allocated `tx_id` and `alloc_id` via `IdentityEngine.generate_technical_id()`; registered gateway reference alias via `IdentityEngine.register_alias()` with granular `source_system` resolution.
- `backend/app/services/sales_return_refund_adapter.py`: Allocated `tx_id` via `IdentityEngine.generate_technical_id()`.
- `docs/walkthrough/README.md`: Appended Phase 1.3 walkthrough entry.
- `docs/implementation/README.md`: Appended Phase 1.3 implementation plan entry.

---

## 5. Architecture Decisions
1. **Multi-Identifier Bridge via `smriti_identity_alias`:**
   - External partner identifiers (15-character GSTIN, 10-character PAN, 12-digit NIC E-Way Bill Number, Payment Gateway Reference IDs, Bank UTRs) are ingested into `smriti_identity_alias`.
   - This enables O(1) polymorphic lookup across disparate government and banking systems without polluting core entity schemas with ad-hoc external lookup columns.
2. **Canonical Alias Governance via `IdentityEngine.register_alias()`:**
   - All alias records strictly use `IdentityEngine.generate_technical_id()` (RFC 9562 UUIDv7) for `id` and `uuid`. Zero local `uuid.uuid4()` generation.
   - **Idempotency & Deduplication Protection:** Ingesting an existing alias code for the same entity is idempotent (reuses and returns the existing alias without error or duplicates). Ingesting an existing alias code for a different canonical entity raises `ValueError` ("Identity alias collision") to prevent competing external mappings.
3. **External Gateway Source-System Semantics:**
   - Automated granular detection of provider names (`RAZORPAY`, `STRIPE`, `PAYTM`, `PINE_LABS`, `PHONEPE`, `GOOGLE_PAY`, `BHIM`, `CRED`, `BILLDESK`, `CCAVENUE`, `CASHFREE`) and tender rails (`UPI`, `CARD`, `NETBANKING`, `WALLET`, `BANK_TRANSFER`).
   - Falls back to `GATEWAY` as the canonical generic transitional source system.
4. **High-Throughput Settlement Ledger Boundary for Payment Transactions:**
   - Like `stock_movements` in Phase 1.2, `payment_transactions` is an append-only, high-frequency financial ledger written during checkout tender capture.
   - Forcing a sequential human numbering lock on each swipe/UPI payment would create critical database bottlenecks during peak retail hours.
   - Therefore, `payment_transactions` uses technical UUIDv7 `id` directly without a sequential human identity code.
5. **Database-Enforced Uniqueness:**
   - PostgreSQL unique indexes `uq_parties_identity_code` and `uq_eway_bills_identity_code` guarantee duplicate prevention at the relational storage level.

---

## 6. Design Rationale
- **Why bridge statutory identifiers (GSTIN, PAN) through aliases instead of primary lookups?**
  A single legal entity may operate under multiple branches, multiple GSTIN registrations across states, or branch-specific trade names, while sharing a single corporate PAN. `smriti_identity_alias` allows polymorphic mapping from any statutory registration directly to the canonical entity UUID.
- **Why retain commercial `party_code` and `eway_bill_no`?**
  `party_code` is deeply integrated into barcode labels, customer loyalty cards, and supplier catalogues. `eway_bill_no` is a legally mandated 12-digit government transit permit number printed on transport goods delivery notes. They must never be replaced by internal identity codes.

---

## 7. Implementation Summary
Alembic migration `v1467_phase1_3_external_partner_identity_integration.py` was deployed across all three production databases (`smritisys`, `smriti001`, `smriti002`). Schema models, Pydantic DTOs, and domain creation services were integrated with `IdentityEngine`. Canonical alias registration was unified in `IdentityEngine.register_alias()`. The automated parity audit script `scripts/verify_phase1_3_parity.py` confirmed 100% backfill coverage, zero nulls, zero duplicate codes, zero broken foreign keys, and complete ledger boundary preservation.

---

## 8. Tests Executed
1. **Rule 12 Parity Audit:** `python scripts/verify_phase1_3_parity.py` across `smritisys`, `smriti001`, `smriti002`.
2. **Phase 1.3 External Integration Tests:** `pytest backend/app/tests/test_phase1_3_external_integration.py -v` (8/8 tests green).
3. **Combined Regression Test Suite:** `pytest backend/app/tests/test_phase1_3_external_integration.py backend/app/tests/test_phase1_2_transactional_integration.py backend/app/tests/test_phase1_1_entity_integration.py backend/app/tests/test_identity_engine.py -v` (26/26 tests green).
4. **Architecture Duplication Gate:** `python scripts/architecture_duplication_gate.py` (11/11 checks pass).
5. **TypeScript Compilation:** `npx tsc --noEmit` (Exit code 0).
6. **Python Compilation:** `python -m py_compile` across all modified files (Exit code 0).

---

## 9. Verification Results

### Test Output Summary
| Test Suite | Result | Evidence |
|---|---|---|
| Phase 1.3 External Integration Tests | **8/8 PASS** | `test_phase1_3_external_integration.py` |
| Phase 1.2 Transactional Integration Tests | **6/6 PASS** | `test_phase1_2_transactional_integration.py` |
| Phase 1.1 Business Entity Tests | **5/5 PASS** | `test_phase1_1_entity_integration.py` |
| Identity Engine Core Tests | **7/7 PASS** | `test_identity_engine.py` |
| Combined Regression Suite | **26/26 PASS** | Full Pytest Suite Green (138.53s) |
| Architecture Duplication Gate | **11/11 Checks PASS** | 0 P0/P1 Violations |
| TypeScript Compiler | **Exit 0, 0 Errors** | `npx tsc --noEmit` |
| Python Compilation | **Exit 0, 0 Errors** | `python -m py_compile` |

### Database Parity Results
- **Lineage Head:** `v1467_phase1_3_external_partner_identity_integration` on `smritisys`, `smriti001`, `smriti002`.
- **Parties Backfilled:** 195 total (100% coverage, 0 nulls, 0 duplicates).
- **E-Way Bills Backfilled:** 64 total (100% coverage, 0 nulls, 0 duplicates).
- **Allocation Log Audit Entries:** 259 total with `purpose='MIGRATION_BACKFILL'`.
- **External Partner Aliases Ingested:** 934 total (GSTIN, PAN, historical codes, NIC E-Way bills, gateway references).
- **Settlement Ledger Boundary:** `payment_transactions` has `id` (VARCHAR UUIDv7), zero sequential `identity_code` column, zero row-locking overhead.

---

## 10. Known Limitations
- External statutory sync (e.g. real-time GSTIN validation via sandbox APIs) requires active NIC/GSTN credentials in `compliance_credentials`.
- Historical parties without GSTIN or PAN rely exclusively on `party_code` aliases in `smriti_identity_alias`.

---

## 11. Future Work
- **Phase 1.4:** High-Throughput Point of Sale & Terminal Line Items Identity Optimization.
- Real-time GSTN webhook ingestion for automated legal name and status synchronization into `smriti_identity_alias`.

---

## 12. Related ADRs
- `docs/architecture/decisions/ADR_0028_UNIFIED_IDENTITY_ENGINE.md`
- `docs/architecture/decisions/ADR_0029_TRANSACTIONAL_DOCUMENT_IDENTITY.md`
- `docs/architecture/decisions/ADR_0030_EXTERNAL_PARTNER_IDENTITY_INTEGRATION.md`

---

## 13. Related RFCs
- `RFC-0089: Unified Multi-Tenant Identity Architecture`
- `RFC-0091: External Partner & Statutory Document Identity Bridge`
