<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vertical Slice 4 — Pricing, GST, Payments, and Document Engine Unification

## 1. Purpose
Unify Price Book resolution, volume break pricing tiers, statutory document sequence numbering, and multi-tender payment settlement ledgers inside the SMRITI tenant data plane (`smritiXXX`). This guarantees deterministic 4-level price evaluation, gapless document numbering sequences with full audit logs, and idempotent split-tender payment processing across POS and B2B sales channels.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Only**: All price books, price book entries, payment transactions, allocations, document series, and audit logs reside strictly in tenant databases.
- **Hierarchical Pricing Resolution**: 4-level evaluation hierarchy (Explicit Price Book -> Customer Tier -> Default Price Book -> Master Item/Product baseline) with volume break (`min_quantity`) matching.
- **Atomic Locked Sequence Generator**: `document_series` with `SELECT ... FOR UPDATE` row locks, formatters, and immutable `numbering_audit_logs`.
- **Idempotent Multi-Tender Payment Ledger**: `payment_transactions` and `payment_allocations` enforcing `idempotency_key` unique constraints to eliminate double-charging risks on network retries.

---

## 3. Files Created
1. `backend/app/models/pricing.py`: Canonical `PriceBook`, `PriceBookEntry`, and `CustomerPriceTier` models.
2. `backend/app/models/payment_ledger.py`: Canonical `PaymentTransaction` and `PaymentAllocation` models.
3. `backend/app/services/unified_pricing_payment_service.py`: Domain service handling hierarchical price resolution, atomic sequence number allocation, and idempotent payment settlements.
4. `backend/tests/test_unified_pricing_payment_engine.py`: Automated verification suite certifying pricing tiers, volume breaks, gapless numbering sequences, payment idempotency, and tenant isolation.
5. `docs/implementation/foundation/Platform_Refactor_Slice4_Pricing_GST_Payments_Plan_v1.0.md`: Master 19-section implementation plan for Slice 4.

---

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported Pricing, Payment Ledger, and Document Series models.
2. `docs/implementation/README.md`: Appended Slice 4 implementation plan to master index.
3. `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Updated platform tracker with verified Slice 4 status.
4. `docs/walkthrough/README.md`: Appended Slice 4 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-007: Hierarchical Pricing Resolution**: Pricing is resolved dynamically using a deterministic 4-level hierarchy rather than hardcoded UI formulas, supporting wholesale vs retail tier price books and volume breaks.
- **ADR-008: Idempotent Payment Settlement**: Payment transactions require a non-nullable unique `idempotency_key`. Network retries or duplicate client submissions return the existing transaction record without creating duplicate ledger debits.
- **ADR-009: Row-Locked Document Sequencing**: Document numbers are allocated using `SELECT ... FOR UPDATE` on `document_series` to eliminate sequence collision and gap vulnerabilities under high concurrency.

---

## 6. Design Rationale
Separating pricing, numbering, and payment ledgers from application presentation layers ensures uniform business rule execution across POS terminals, B2B wholesale portals, and automated billing queues.

---

## 7. Implementation Summary
- **Pricing Resolution**:
  - Checks explicit price book override if passed.
  - Checks customer-specific tier price book if customer ID is present.
  - Checks active default price book.
  - Falls back to `Item` or `Product` catalog pricing.
  - Evaluates highest applicable volume break (`min_quantity <= requested_quantity`).
- **Document Numbering**:
  - Row-locks `document_series` for the requested document type and financial year.
  - Increments `current_number` atomically.
  - Formats number with zero-padding (e.g. `INV/2026-27/0001`).
  - Writes audit record to `numbering_audit_logs`.
- **Payment Settlements**:
  - Evaluates `idempotency_key` (including prefix matches for split tenders).
  - Inserts `payment_transactions` for each tender (CASH, CARD, UPI, CREDIT_MEMO, etc.).
  - Inserts `payment_allocations` linking tender amounts to the invoice ID.

---

## 8. Tests Executed
1. `backend/tests/test_unified_pricing_payment_engine.py`:
   - `test_pricing_hierarchy_price_book_and_volume_breaks` (Passed)
   - `test_document_numbering_gapless_sequence_allocation` (Passed)
   - `test_idempotent_multi_tender_payment_settlement` (Passed)
   - `test_pricing_and_payment_tenant_isolation` (Passed)
2. Full Multi-Module Regression Suite:
   - 77/77 automated tests passed in 29.09s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, Slice 2 Universal Party/Item Masters, Slice 3 Sales/POS & Stock Ledger, and Slice 4 Pricing/Payments/Document Numbering.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 77 items

backend\tests\test_unified_pricing_payment_engine.py ....                [  5%]
backend\tests\test_unified_sales_ledger.py ....                          [ 10%]
backend\tests\test_universal_party_master.py ...                         [ 14%]
backend\tests\test_universal_item_master.py ...                          [ 18%]
backend\tests\test_routing_boundary_canonical.py .............           [ 35%]
backend\tests\test_company_db_runtime_routing.py .......                 [ 44%]
backend\tests\test_company_db_naming_convention.py ......                [ 51%]
backend\tests\test_get_company_db_wiring.py .....                        [ 58%]
backend\tests\test_multi_company_database_architecture.py ......         [ 66%]
backend\tests\test_company_db_provisioning.py .....                      [ 72%]
backend\tests\test_menu_governance.py .                                  [ 74%]
backend\tests\test_security_menu_access.py ..                            [ 76%]
backend\tests\test_wms_phase1.py ....                                    [ 81%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 85%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 92%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================= 77 passed, 1 warning in 29.09s ========================
```

---

## 10. Known Limitations
- External hardware card POS swipe terminal webhook callbacks and direct Razorpay/PineLabs payment gateway webhooks operate in the compliance gateway layer.

---

## 11. Future Work
- **Slice 5**: Approval, Workflow, and Communicator Engines.
- **Slice 6**: Capability, Template, and Workspace Resolution.
- **Slice 7**: Outbox and Analytics Plane.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-007`: Hierarchical Pricing, Document Sequence Locking, and Idempotent Payments.

---

## 13. Related RFCs
- `RFC-011`: Unified Pricing, Payment Settlement, and Gapless Sequence Governance.
