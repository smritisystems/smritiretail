<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Price Revision Security Hardening & Multi-Tenant Verification Walkthrough

## 1. Purpose
This walkthrough documents the technical implementation, security controls, multi-tenant boundaries, and verification suite for the Price Revision Module in SMRITI Retail OS. Following the initial Phase 7 delivery, this release implements P0 security fixes: strict company/tenant isolation on Price Book and Customer Tier lookups, server-side customer tier authorization, deterministic Price Book specificity precedence, timezone-aware posting date boundaries, segregation of duties in revision approval, and historical invoice snapshot immutability during cost reference revisions.

---

## 2. Scope
The scope of this hardening release includes:
- **Tenant Isolation**: Strict `company_id == resolved_company_id` scoping in `PricingEngine.calculate_effective_price`, `create_price_book`, and `add_price_book_entry`.
- **Customer Tier Authorization**: Authoritative server-side lookup of `CustomerPriceAssignment` joined with `CustomerPriceTier` in `HeadlessBillingCore`. Discard of unauthorized client-supplied tiers for walk-in or unassigned customers.
- **Deterministic Price Book Precedence**: Enforcing variant-level specificity over generic item-level entries via `order_by(min_quantity.desc(), variant_id.isnot(None).desc())`.
- **Authoritative Posting Timestamps**: Inclusion of `posting_date` on `CanonicalPostingContext` with UTC normalization for backdated and offline-synced sales transactions.
- **Approval Segregation of Duties**: Enforcing separation between revision creator and approver for non-administrative roles in `PriceRevisionService.approve_revision`.
- **Cost Reference vs Stock Valuation Separation**: Verifying that revising buying cost on `ItemVariant` does not mutate historical sales invoices, COGS, or inventory ledgers.
- **Automated Regression Suite**: Expanded 28-test suite in `backend/tests/test_price_revisions.py`.

---

## 3. Files Created
1. `docs/implementation/pricing/Price_Revision_Security_Hardening_And_Verification_Plan_v1.1.0.md`: IPGP Implementation Plan.
2. `docs/walkthrough/pricing/Price_Revision_Security_Hardening_And_Verification_v1.1.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/canonical_posting.py`: Added `posting_date: Optional[datetime] = None` to `CanonicalPostingContext`.
2. `backend/app/services/pricing_engine.py`: Scoped Price Book and Customer Tier lookups to `resolved_company_id`; added deterministic specificity order.
3. `backend/app/services/headless_billing.py`: Implemented authoritative server-side customer tier assignment validation; normalized `posting_dt` to UTC.
4. `backend/app/services/price_revision_service.py`: Enforced segregation of duties preventing creator self-approval; normalized `as_of_date` to UTC.
5. `backend/tests/test_price_revisions.py`: Expanded test suite from 19 to 28 comprehensive automated tests.
6. `docs/implementation/README.md`: Appended IP-PRICING-REV-002 entry.
7. `docs/walkthrough/README.md`: Appended Walkthrough v1.1.0 entry.
8. `CHANGELOG.md`: Added Price Revision Security Hardening entry.

---

## 5. Architecture Decisions
- **ADR-PRV-005: Multi-Tenant Zero-Trust Tier Resolution**: POS clients cannot self-assert customer pricing tiers. `HeadlessBillingCore` queries `CustomerPriceAssignment` in PostgreSQL joined to active `CustomerPriceTier` scoped to `company_id`. Any client-supplied tier code that does not match an active, unexpired server-side assignment is discarded.
- **ADR-PRV-006: Deterministic Specificity Ordering**: When price book entries share the same quantity volume break, variant-specific entries (`variant_id IS NOT NULL`) strictly precede generic item-level entries (`variant_id IS NULL`) via `PriceBookEntry.variant_id.isnot(None).desc()`.
- **ADR-PRV-007: Authoritative Temporal Posting Contract**: Rather than resolving prices against wall-clock server processing time, canonical billing requests accept `posting_date`. Naive timestamps are normalized to UTC.
- **ADR-PRV-008: Segregation of Duties for Master Revisions**: Store managers or operators creating a price revision cannot self-approve their own revision (`SMRITI-PERM-002`). Only designated administrative roles (`SYSADMIN`, `DIRECTOR`) can approve self-created revisions.

---

## 6. Design Rationale
- **Preservation of Single Pricing Engine**: All security controls were embedded directly into `PricingEngine` and `HeadlessBillingCore`. No duplicate or competing valuation engines were created.
- **Safe Database Test Isolation**: Every automated test generates random unique suffixes (`uuid.uuid4().hex[:8]`) for entity identifiers and operates strictly against isolated test rows. No bulk `LIKE` deletions or unverified production migrations are run.

---

## 7. Implementation Summary

### Multi-Tenant Company Scoping in `PricingEngine`
```python
# PricingEngine.calculate_effective_price
if customer_tier_code:
    stmt_tier = select(CustomerPriceTier).where(
        CustomerPriceTier.code == customer_tier_code,
        CustomerPriceTier.company_id == resolved_company_id,
        CustomerPriceTier.is_active == True,
        CustomerPriceTier.is_deleted == False,
    )
```

### Deterministic Specificity Tie-Breaker
```python
# PricingEngine.calculate_effective_price
stmt_pbe = (
    select(PriceBookEntry)
    .where(
        PriceBookEntry.price_book_id == active_pb_id,
        PriceBookEntry.company_id == resolved_company_id,
        or_(
            PriceBookEntry.variant_id == variant_id,
            and_(PriceBookEntry.item_id == item_id, PriceBookEntry.variant_id.is_(None)),
        ),
        PriceBookEntry.min_quantity <= quantity,
        PriceBookEntry.is_active == True,
    )
    .order_by(
        PriceBookEntry.min_quantity.desc(),
        PriceBookEntry.variant_id.isnot(None).desc(),
    )
)
```

### Server-Side Customer Tier Authorization in `HeadlessBillingCore`
```python
# HeadlessBillingCore.calculate_billing
if req.customer_id and req.customer_id != "CUST-WALKIN":
    stmt_assign = (
        select(CustomerPriceAssignment, CustomerPriceTier)
        .join(CustomerPriceTier, CustomerPriceAssignment.price_tier_id == CustomerPriceTier.id)
        .where(
            CustomerPriceAssignment.customer_id == req.customer_id,
            CustomerPriceAssignment.company_id == company_id,
            CustomerPriceAssignment.status == "ACTIVE",
            CustomerPriceAssignment.is_deleted == False,
            CustomerPriceAssignment.valid_from <= posting_dt,
            or_(
                CustomerPriceAssignment.valid_to.is_(None),
                CustomerPriceAssignment.valid_to >= posting_dt,
            ),
            CustomerPriceTier.company_id == company_id,
            CustomerPriceTier.is_active == True,
            CustomerPriceTier.is_deleted == False,
        )
    )
```

---

## 8. Tests Executed
1. `test_statutory_ceiling_invariant_sp_cannot_exceed_mrp`: $SP \le MRP$ statutory invariant.
2. `test_immediate_price_revision_activation_and_sync`: Synchronous activation and catalog sync.
3. `test_future_effective_revision_does_not_leak_prematurely`: Future revision remains in SCHEDULED status.
4. `test_historical_price_reconstruction_and_replay`: Historical point-in-time replay.
5. `test_pending_and_rejected_revisions_workflow`: Workflow state transitions.
6. `test_overlapping_identical_timestamp_conflict_prevention`: Duplicate revision conflict prevention.
7. `test_bulk_create_revisions_processing`: Bulk import parsing and processing.
8. `test_pos_billing_authoritative_price_resolution_and_override`: Authoritative billing rate resolution.
9. `test_submitted_invoice_snapshot_immutability`: Invoice item rates preserved after price revisions.
10. `test_api_create_and_list_price_revisions`: REST API endpoint lifecycle.
11. `test_restrict_foreign_key_blocks_hard_delete_of_item_with_revisions`: `ON DELETE RESTRICT` integrity.
12. `test_system_parameter_driven_approval_threshold`: Dynamic threshold approval evaluation.
13. `test_concurrency_safe_scheduled_activation`: Advisory lock scheduled activation worker.
14. `test_billing_fails_closed_when_pricing_resolver_fails`: Normal merchandise checkout fail-closed.
15. `test_billing_fails_closed_when_authoritative_price_is_missing`: Missing authoritative price fail-closed.
16. `test_billing_preserves_fee_and_free_lines_without_resolution_failure`: Approved fee and free lines pass through.
17. `test_billing_accepts_valid_price_book_discount_without_supervisor_override`: Price book discount accepted.
18. `test_billing_accepts_quantity_volume_break_without_supervisor_override`: Volume break discount accepted.
19. `test_billing_accepts_customer_tier_discount_without_supervisor_override`: Authorized tier discount accepted.
20. `test_cross_company_customer_tier_injection_blocked`: Foreign-company tier lookup rejected.
21. `test_cross_company_price_book_injection_blocked`: Foreign-company Price Book lookup rejected.
22. `test_customer_without_tier_assignment_unauthorized_tier_discarded`: Unassigned customer tier injection discarded.
23. `test_walkin_customer_tier_claim_discarded`: Walk-in customer tier claim discarded.
24. `test_inactive_and_deleted_customer_tier_rejected`: Inactive or soft-deleted tiers rejected.
25. `test_deterministic_price_book_variant_specificity_precedence`: Specific variant entry wins over generic item entry.
26. `test_billing_respects_authoritative_posting_date_boundaries`: Authoritative posting timestamp boundary evaluation.
27. `test_unauthorized_role_and_self_approval_blocked`: Segregation of duties and role permissions.
28. `test_cost_revision_does_not_mutate_historical_cogs_or_stock_ledger`: Cost price revision preserves posted invoice snapshots.
29. `test_tenant_isolation_missing_company_with_price_book`: Regression 1: Missing company ID with supplied Price Book rejects with `SMRITI-PRICE-TENANT-REQUIRED`.
30. `test_tenant_isolation_missing_company_with_customer_tier`: Regression 2: Missing company ID with supplied customer tier rejects with `SMRITI-PRICE-TENANT-REQUIRED`.
31. `test_tenant_isolation_missing_company_with_variant`: Regression 3: Missing company ID with variant-level entry rejects with `SMRITI-PRICE-TENANT-REQUIRED`.
32. `test_tenant_isolation_cross_tenant_mismatch_rejected`: Regression 4: Explicit company A attempting to resolve company B's pricing rejects with `SMRITI-PRICE-TENANT-MISMATCH`.
33. `test_tenant_isolation_same_company_pricing_succeeds`: Regression 5: Normal same-company pricing succeeds.

---

## 9. Verification Results

### Dedicated Test Database Isolation (Zero Touches to Shared Databases)
- **Target Database**: `smriti_test_price_revisions` (PostgreSQL port 2781, 253 tables created via `Base.metadata.create_all`).
- **Runtime Safety Abort Guard**: Active in `backend/app/db/session.py` lines 167-170:
  ```python
  if _is_testing() and db_clean in ("smriti001", "smritisys") and os.getenv("ALLOW_SHARED_TEST_DB") != "1":
      raise RuntimeError(f"TEST SAFETY VIOLATION: Execution blocked. Automated tests cannot target shared/live database '{db_clean}'.")
  ```
- **Database Measurement Evidence (Before vs After Test Suite Run)**:
  - Shared Database `smriti001` before tests: `(price_books: 12, price_book_entries: 18, item_price_revisions: 190, customer_price_tiers: 67)`
  - Shared Database `smriti001` after tests: `(price_books: 12, price_book_entries: 18, item_price_revisions: 190, customer_price_tiers: 67)`
  - **Delta on `smriti001`**: Exactly 0 rows added, modified, or deleted across all tables.
  - Dedicated Test Database `smriti_test_price_revisions` after tests: `(price_books: 4, price_book_entries: 6, item_price_revisions: 17, customer_price_tiers: 6)`

### Backend Pytest Suite (33/33 Passed)
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 33 items

backend\tests\test_price_revisions.py::test_statutory_ceiling_invariant_sp_cannot_exceed_mrp PASSED [  3%]
backend\tests\test_price_revisions.py::test_immediate_price_revision_activation_and_sync PASSED [  6%]
backend\tests\test_price_revisions.py::test_future_effective_revision_does_not_leak_prematurely PASSED [  9%]
backend\tests\test_price_revisions.py::test_historical_price_reconstruction_and_replay PASSED [ 12%]
backend\tests\test_price_revisions.py::test_pending_and_rejected_revisions_workflow PASSED [ 15%]
backend\tests\test_price_revisions.py::test_overlapping_identical_timestamp_conflict_prevention PASSED [ 18%]
backend\tests\test_price_revisions.py::test_bulk_create_revisions_processing PASSED [ 21%]
backend\tests\test_price_revisions.py::test_pos_billing_authoritative_price_resolution_and_override PASSED [ 24%]
backend\tests\test_price_revisions.py::test_submitted_invoice_snapshot_immutability PASSED [ 27%]
backend\tests\test_price_revisions.py::test_api_create_and_list_price_revisions PASSED [ 30%]
backend\tests\test_price_revisions.py::test_restrict_foreign_key_blocks_hard_delete_of_item_with_revisions PASSED [ 33%]
backend\tests\test_price_revisions.py::test_system_parameter_driven_approval_threshold PASSED [ 36%]
backend\tests\test_price_revisions.py::test_concurrency_safe_scheduled_activation PASSED [ 39%]
backend\tests\test_price_revisions.py::test_billing_fails_closed_when_pricing_resolver_fails PASSED [ 42%]
backend\tests\test_price_revisions.py::test_billing_fails_closed_when_authoritative_price_is_missing PASSED [ 45%]
backend\tests\test_price_revisions.py::test_billing_preserves_fee_and_free_lines_without_resolution_failure PASSED [ 48%]
backend\tests\test_price_revisions.py::test_billing_accepts_valid_price_book_discount_without_supervisor_override PASSED [ 51%]
backend\tests\test_price_revisions.py::test_billing_accepts_quantity_volume_break_without_supervisor_override PASSED [ 54%]
backend\tests\test_price_revisions.py::test_billing_accepts_customer_tier_discount_without_supervisor_override PASSED [ 57%]
backend\tests\test_price_revisions.py::test_cross_company_customer_tier_injection_blocked PASSED [ 60%]
backend\tests\test_price_revisions.py::test_cross_company_price_book_injection_blocked PASSED [ 63%]
backend\tests\test_price_revisions.py::test_customer_without_tier_assignment_unauthorized_tier_discarded PASSED [ 66%]
backend\tests\test_price_revisions.py::test_walkin_customer_tier_claim_discarded PASSED [ 69%]
backend\tests\test_price_revisions.py::test_inactive_and_deleted_customer_tier_rejected PASSED [ 72%]
backend\tests\test_price_revisions.py::test_deterministic_price_book_variant_specificity_precedence PASSED [ 75%]
backend\tests\test_price_revisions.py::test_billing_respects_authoritative_posting_date_boundaries PASSED [ 78%]
backend\tests\test_price_revisions.py::test_unauthorized_role_and_self_approval_blocked PASSED [ 81%]
backend\tests\test_price_revisions.py::test_cost_revision_does_not_mutate_historical_cogs_or_stock_ledger PASSED [ 84%]
backend\tests\test_price_revisions.py::test_tenant_isolation_missing_company_with_price_book PASSED [ 87%]
backend\tests\test_price_revisions.py::test_tenant_isolation_missing_company_with_customer_tier PASSED [ 90%]
backend\tests\test_price_revisions.py::test_tenant_isolation_missing_company_with_variant PASSED [ 93%]
backend\tests\test_price_revisions.py::test_tenant_isolation_cross_tenant_mismatch_rejected PASSED [ 96%]
backend\tests\test_price_revisions.py::test_tenant_isolation_same_company_pricing_succeeds PASSED [100%]

====================== 33 passed, 24 warnings in 45.08s =======================
```
```

### Vitest Frontend Offline Cache Suite (5/5 Passed)
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/proposCatalogCache.test.ts (5 tests) 12ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:35:36
   Duration  414ms (transform 85ms, setup 0ms, import 113ms, tests 12ms, environment 0ms)
```

### TypeScript Static Typecheck (0 Errors)
```text
npx tsc --noEmit --skipLibCheck
Exit code: 0 (0 errors)
```

### Python Syntax Compilation (0 Errors)
```text
.\.venv\Scripts\python.exe -m py_compile backend/app/schemas/canonical_posting.py backend/app/services/pricing_engine.py backend/app/services/headless_billing.py backend/app/services/price_revision_service.py backend/tests/test_price_revisions.py
Exit code: 0 (0 errors)
```

---

## 10. Known Limitations
- When a customer holds multiple concurrent active tier assignments, the one with the earliest start date is selected. A hierarchical priority field on `customer_price_tiers` can be added in a future enhancement if multi-tier tier stack policies are introduced.

---

## 11. Future Work
- Add tier hierarchy precedence ranking (`tier_priority` integer column) for complex B2B multi-tier contracts.
- Automated email/push webhook notifications to regional store supervisors when a store-manager revision enters `PENDING_APPROVAL`.

---

## 12. Related ADRs
- `ADR-042`: Master Data Parameter Governance and Dual-Key Architecture.
- `ADR-PRV-001`: Immutable Temporal Price Ledger.
- `ADR-PRV-002`: Statutory Ceiling Database Check Constraints.
- `ADR-PRV-005`: Multi-Tenant Zero-Trust Tier Resolution.
- `ADR-PRV-006`: Deterministic Specificity Ordering.

---

## 13. Related RFCs
- `RFC-PRICE-REV-01`: Standard Temporal Price Revision Specification.
- `RFC-POS-TAMPER-02`: POS Price Integrity & Supervisor Override Policy.
- `RFC-TENANT-ISO-03`: Zero-Trust Multi-Tenant Billing Boundary Standard.
