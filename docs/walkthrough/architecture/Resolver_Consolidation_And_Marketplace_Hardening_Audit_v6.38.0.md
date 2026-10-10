<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.38.0
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough — Product Quality Hardening, Resolver Audit & Modal Consolidation
-->

# Walkthrough: Product Quality Hardening, Resolver Audit, Modal Consolidation & Marketplace Verification (v6.38.0)

## 1. Purpose
This implementation closes closeable product-quality gaps identified during comprehensive platform auditing across four critical dimensions:
1. **Resolver Architecture:** Diagnoses resolver fragmentation between `CanonicalItemResolver` and `PartnerIdentifierResolver`, establishing a formal decision document for Ganita.
2. **Modal Architecture Consolidation:** Resolves duplicate components identified in the ProPOS modal audit, safely retiring true duplicates (`PRTVModal`, `SalesReturnModal`, `CashDrawerModal`, `PriceOverrideModal`) while preserving complementary domain components.
3. **E-Commerce & PSV Integration Hardening:** Audits `CustomerArticleMapping` and `EcomSkuMapping` resolution tiers, fixes a silent attribute bug in `partner_resolver.py`, and proves end-to-end `PENDING_CATALOG_MAPPING` behavior via automated tests.
4. **POS & Billing Completeness Audit:** Walks the end-to-end ProPOS terminal flow (sale → payment → return → shift close) and documents exact schema and test coverage gaps for sign-off.

---

## 2. Scope
- Diagnosis and decision document for item resolver fragmentation.
- Component consolidation and deletion of 4 verified duplicate modals without broken imports.
- Bug fix in `PartnerIdentifierResolver` for `EcomSkuMapping` (`channel_code` vs `channel_name` and `is_active` filter).
- Automated test coverage for PSV feed unmapped SKU ingestion and customer article mapping.
- End-to-end POS workflow audit covering Sale, Split Tender, Sales Return, and Shift Close.

---

## 3. Files Created
- `docs/architecture/RESOLVER_FRAGMENTATION_DECISION_DOC.md`: Comprehensive feature comparison and architectural decision options for Ganita.
- `backend/tests/test_psv_feed_mapping_hardening.py`: Automated test suite verifying PSV feed unmapped partner SKU ingestion, CustomerArticleMapping fallback, and EcomSkuMapping resolution.
- `docs/walkthrough/architecture/Resolver_Consolidation_And_Marketplace_Hardening_Audit_v6.38.0.md`: This walkthrough document.

---

## 4. Files Modified
- `backend/app/services/partner_resolver.py`: Fixed `channel_code` column reference and added `is_active == True` filter on `EcomSkuMapping` query.
- `src/components/procurement/PRTVModal.tsx`: Deleted (retired duplicate adapter).
- `src/components/pos/SalesReturnModal.tsx`: Deleted (retired duplicate).
- `src/components/pos/CashDrawerModal.tsx`: Deleted (retired duplicate).
- `src/components/pos/PriceOverrideModal.tsx`: Deleted (retired duplicate).

---

## 5. Architecture Decisions
1. **Formal Separation of Resolvers:** `CanonicalItemResolver` remains dedicated to internal point-of-sale operational hot-paths (raw SQL, cohort rollout, shadow comparison, price book entries), while `PartnerIdentifierResolver` remains dedicated to external feed ingestion (PSV, EDI, e-commerce mapping). They are not merged prematurely.
2. **Safe Modal Retirement:** Only pure duplicates (`TRUE_DUPLICATE`) with zero active callers were deleted. Multi-faceted components (`DynamicPricingStudioModal` vs `PricingStudioModal`, CRM Customer 360 drawers) were kept distinct as `COMPLEMENTARY_COMPONENTS`.
3. **Fail-Closed Partner Resolution:** Unmapped or inactive partner SKUs fail closed to `found=False` and project into `psv_stock_balances` with `reconciliation_status="PENDING_CATALOG_MAPPING"`.

---

## 6. Design Rationale
- POS checkout operates under strict sub-50ms latency constraints and cannot afford the overhead of traversing multi-tier e-commerce and buyer EDI tables on every barcode scan.
- Deleting obsolete modal components prevents future developers from wiring redundant state machines into parent workspaces.
- Fixing the `channel_code` attribute mismatch in `partner_resolver.py` unblocks marketplace integration from silently bypassing Tier 2 resolution.

---

## 7. Implementation Summary
- Analyzed and documented 15 core architectural capabilities across `CanonicalItemResolver` and `PartnerIdentifierResolver`.
- Retired 4 obsolete modal components (`PRTVModal`, `SalesReturnModal`, `CashDrawerModal`, `PriceOverrideModal`).
- Verified zero broken imports via `tsc --noEmit` (clean build).
- Verified all 153 frontend test suites (1,057 tests) pass without regression.
- Implemented and verified 3 automated backend integration tests in `test_psv_feed_mapping_hardening.py`.
- Audited POS billing terminal flow and documented findings on payment split tenders and shift close schema contracts.

---

## 8. Tests Executed
1. `npm run lint` (`tsc --noEmit`): Clean, zero errors.
2. `npx vitest run src/tests/vendorReturnEngine.test.ts src/tests/prtvEngine.test.ts src/tests/rtvEngine.test.ts`: 3/3 suites passed, 10/10 tests passed.
3. `npx vitest run src/tests/salesReturnEngine.test.ts src/tests/salesReturnService.test.ts`: 2/2 suites passed, 7/7 tests passed.
4. `npx vitest run src/tests/cashDrawerEngine.test.ts`: 1/1 suite passed, 4/4 tests passed.
5. `npx vitest run src/tests/priceOverrideEngine.test.ts src/tests/proposSupervisorAuth.test.ts`: 2/2 suites passed, 8/8 tests passed.
6. `npm run test` (Full Frontend Suite): 153/153 test files passed, 1,057/1,057 tests passed.
7. `pytest backend/tests/test_product_identity_refactor.py -k test_04`: Passed (100%).
8. `pytest backend/tests/test_psv_feed_mapping_hardening.py`: 3/3 tests passed.

---

## 9. Verification Results
All tests executed green. No regressions were introduced across frontend UI or backend resolver/feed projection services.

---

## 10. Known Limitations
- POS checkout backend schema `POSCheckoutRequest` currently accepts a single `payment_mode: str` and does not accept a list of split tenders (`tenders: List[...]`).
- Frontend `ProPosShiftCloseDl.tsx` uses non-matching field names (`actual_cash`, `notes`, `coins`) compared to backend `ShiftClose` schema (`closing_balance`, `closing_notes`, `coins_total`).
- `CustomerArticleMapping` does not filter by `party_id` when resolving partner SKUs.

---

## 11. Future Work
- Add `tenders: Optional[List[POSTenderItem]]` to `POSCheckoutRequest` for full multi-tender split persistence.
- Align `ProPosShiftCloseDl.tsx` payload schema with backend `ShiftClose`.
- Scope `CustomerArticleMapping` resolution by customer/party ID to prevent cross-buyer SKU collisions.

---

## 12. Related ADRs
- `ADR-0046`: Product Identity & Barcode Resolution Architecture
- `ADR-0052`: Partner Stock Visibility (PSV) Event-Driven Ingestion

---

## 13. Related RFCs
- `RFC-2026-08`: Universal Master Data & Operational Dual-Read Gate 8
- `RFC-2026-09`: PSV Multi-Channel Inventory Feed Integration
