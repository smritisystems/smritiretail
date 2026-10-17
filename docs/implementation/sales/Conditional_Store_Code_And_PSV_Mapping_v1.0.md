<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Implementation Plan: Conditional Store Code & Automatic PSV Account Mapping (Phase 2)

## 1. Objective
Implement conditional Store Code visibility and idempotent automatic Party Stock Visibility (PSV) account resolution/creation for Modern Trade in SMRITI Retail OS. The system reuses the existing canonical Store Master (`customer_delivery_locations`), backend multi-tenant architecture, inventory ledger, and SMRITI UI Configuration Engine without duplicate sources of truth or premature ledger mutations.

## 2. Business Motivation
In Modern Trade and Large Format Retail (LFR) commerce (e.g. Reliance Retail, Shoppers Stop, Lifestyle, Trent), suppliers ship goods directly to specific store locations, each identified by a unique Store Code (e.g. `1888`, `T97D`, `TYAC`). Tracking inventory sell-through, consignment stocks, and out-of-stock risk at each store requires:
1. Ensuring operators select a valid, active store location whenever billing through Modern Trade channels.
2. Automatically and idempotently mapping that store to a corresponding Party Stock Visibility (PSV) account without manual account creation or double-entry mistakes.
3. Preventing Store Code clutter for General Trade and Counter Cash billing where individual store-level tracking is unnecessary.

## 3. Scope
- **Channel Capability Configuration**: Define authoritative Sales Channel capability layer (`requires_store_location`) supporting `MODERN_TRADE` (true) and extensible to other channels (`GENERAL_TRADE`, `B2B_WHOLESALE`, `POS_RETAIL`, `ECOMMERCE`) with override support via SMRITI System Parameter Governance (`smritiSystemParameterService`).
- **Database Hardening**: Add partial unique indexes on `psv_parties` for `(company_id, delivery_location_id)` and `(company_id, host_customer_id, store_code)` via Alembic migration `v1535`.
- **Backend Service & API**: Implement `resolve_or_create_store_psv_party` in `PSVProjectionService` with strict tenancy, active status, customer ownership validation, concurrency safety, and zero stock movement side-effects. Expose `POST /api/v1/psv/resolve-store-party`.
- **Frontend Billing Terminal Integration**: Update `BillingTerm.tsx` and `types.ts` to conditionally display and mandate Delivery Location / Store Code when the active sales channel requires store-level tracking, while preserving historical associations and persisting `psv_party_id`.
- **Automated Verification**: Complete Pytest and Vitest test suites verifying channel rules, account creation/reuse, race condition resilience, error rejections, and zero stock movements.

## 4. Current State
- `customer_delivery_locations` acts as the canonical store master with unique constraint on `(customer_id, store_code)` for active locations.
- `psv_parties` exists but has only a non-unique index `ix_psv_parties_company_store`, creating duplicate account risks during concurrent operations.
- `PSVProjectionService.project_posted_invoice` only created a `PSVParty` lazily upon invoice posting if one was missing.
- In `BillingTerm.tsx`, Delivery Location and Store Code badge rendered unconditionally in the B2B corporate strip without checking sales channel requirements.
- Transaction channel was conflated with `billingSource` (order ingress like `CUSTOMER_PO` vs `DIRECT`) rather than operational sales channel (`MODERN_TRADE`, `B2B_WHOLESALE`, etc.).

## 5. Gap Analysis
1. **Missing Schema Uniqueness**: No database-level unique constraint on `psv_parties` for `(company_id, delivery_location_id)` or `(company_id, host_customer_id, store_code)`.
2. **Missing Pre-Invoice Resolution API**: No authorized endpoint exists to resolve or provision a PSV account at the moment an operator selects a store during invoice drafting.
3. **Missing Channel Governance**: No explicit sales channel capability registry defining `requires_store_location` or integrating with `smritiSystemParameterService`.
4. **Static UI Presentation**: Store Code rendered statically without validation preventing invoice checkout when Modern Trade is selected without a store.

## 6. Architecture Impact
- **Database**: Additive schema migration adding 2 partial unique indexes on `psv_parties`. Zero data loss, zero destructive changes.
- **Backend**: New endpoint `POST /api/v1/psv/resolve-store-party` and new service method in `PSVProjectionService`.
- **Domain Independence**: PSV remains strictly a shadow projection and visibility layer. Resolving or creating an account produces zero entries in `stock_movements`, `psv_stock_events`, or financial ledgers.
- **Frontend**: Responsive UI adaptation based on channel capabilities, reusing SMRITI design tokens (`surface-container-low`, `border-outline-variant`, `primary`, `error`).

## 7. Proposed Design
```text
Sales Channel Selection (e.g. MODERN_TRADE)
    ↓
Channel Capability Check: requires_store_location = true
    ↓
Show & Mandate Delivery Location / Store Code in B2B Strip
    ↓
Operator Selects Delivery Location
    ↓
POST /api/v1/psv/resolve-store-party
    ↓
PSVProjectionService.resolve_or_create_store_psv_party()
    ├─ Validate Location (active, not deleted, company_id match, customer_id match)
    ├─ Check Existing PSVParty by (company_id, delivery_location_id)
    ├─ Check Existing PSVParty by (company_id, host_customer_id, store_code)
    ├─ Concurrency Guard (Advisory lock / Savepoint fallback)
    └─ Create PSVParty (if not found; 0 stock movements)
    ↓
Returns { psv_party_id, store_code, delivery_location_id, is_newly_created }
    ↓
Binds psvPartyId & deliveryStoreCode into BillingHeaderState
```

## 8. Files Created
- `backend/alembic/versions/v1535_psv_parties_store_uniqueness.py`
- `backend/alembic/versions/v1536_sales_invoice_sales_channel.py`
- `backend/app/core/sales_channels.py`
- `backend/app/tests/test_psv_store_mapping.py`
- `src/tests/conditionalStoreCodePsv.test.ts`
- `docs/implementation/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`
- `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`

## 9. Files Modified
- `backend/app/models/psv.py`
- `backend/app/models/sales.py`
- `backend/app/schemas/canonical_posting.py`
- `backend/app/schemas/psv.py`
- `backend/app/schemas/sales.py`
- `backend/app/services/canonical_sales_writer.py`
- `backend/app/services/psv_projection.py`
- `backend/app/services/sales.py`
- `backend/app/tests/conftest.py`
- `src/components/billing/types.ts`
- `src/components/billing/BillingTerm.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- PostgreSQL 14+ with support for partial unique indexes (`CREATE UNIQUE INDEX ... WHERE ...`).
- SMRITI System Parameter Service (`smritiSystemParameterService.ts`) for tenant overrides.
- Existing `customer_delivery_locations` and `customers` master data.

## 11. Risks
- **Race Condition on Concurrent Store Account Creation**: Addressed via database unique constraint and atomic advisory locking / savepoint retry.
- **Historical Invoices Mutation**: Addressed by ensuring conditional visibility does not clear or mutate persisted invoice records.
- **Premature Ledger Entries**: Addressed by strictly prohibiting stock movement writes during account resolution.

## 12. Rollback Strategy
- Alembic downgrade script drops the partial unique indexes.
- Code changes in API and UI are non-destructive and backward compatible with optional fallback defaults.

## 13. Verification Plan
- Column and index verification using live PostgreSQL catalog queries.
- Pytest suite covering all resolution branches, error cases, and concurrency.
- Vitest suite covering UI state transitions and validation rules.
- TypeScript compilation verification (`npx tsc --noEmit`).

## 14. Test Plan
- `backend/app/tests/test_psv_store_mapping.py` (15 Integration Tests):
  1. `test_sales_channel_capabilities_logic`
  2. `test_get_channel_capabilities_api_endpoint`
  3. `test_resolve_or_create_store_psv_party_creates_new_with_zero_stock_ledger`
  4. `test_resolve_or_create_store_psv_party_idempotent_reuse`
  5. `test_resolve_or_create_store_psv_party_links_legacy_unlinked_party`
  6. `test_resolve_or_create_store_psv_party_rejects_inactive_or_deleted_location`
  7. `test_resolve_or_create_store_psv_party_rejects_customer_mismatch`
  8. `test_resolve_or_create_store_psv_party_rejects_cross_tenant_access`
  9. `test_api_resolve_store_party_endpoint`
  10. `test_api_resolve_store_party_handles_validation_error`
  11. `test_psv_party_db_partial_unique_index_enforcement`
  12. `test_api_resolve_store_party_rejects_header_tampering`
  13. `test_resolve_store_party_guarantees_zero_stock_mutations`
  14. `test_canonical_sales_posting_persists_sales_channel`
  15. `test_canonical_sales_posting_defaults_sales_channel_to_b2b_wholesale`
- `src/tests/conditionalStoreCodePsv.test.ts` (6 Unit & Contract Tests):
  1. Defines canonical sales channels with correct display labels.
  2. Identifies `MODERN_TRADE` as requiring store location tracking by default.
  3. Identifies non-modern-trade channels as not requiring store location tracking.
  4. Enforces validation rule: `MODERN_TRADE` requires a delivery location before settlement.
  5. Validates non-modern-trade channels allow settlement without store location.
  6. Preserves store selection in state when channel toggles without destroying values.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`.
- Update `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Apply Alembic migration `v1535`.
- Deploy backend service and API updates.
- Deploy frontend build.

## 17. Status
Completed

## 18. Related ADRs
- ADR-042: SMRITI Canonical Parameter Namespace and Dual-Key Governance.
- ADR-028: PSV Shadow Projection & Non-Authoritative Visibility Engine.

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`
