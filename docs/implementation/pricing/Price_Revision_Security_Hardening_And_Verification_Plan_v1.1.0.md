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
  Classification: Internal Architecture Plan
-->

# SMRITI Retail OS — Price Revision Security Hardening & Multi-Tenant Verification Plan

**Document ID:** IP-PRICING-REV-002  
**Area:** Pricing, Catalog & POS Billing (`pricing`)  
**Status:** Completed  
**Version:** 1.1.0  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Objective
Complete, secure, test, and document the SMRITI Retail OS Price Revision Module. Eliminate cross-company pricing vulnerability, enforce server-side customer tier authorization, guarantee deterministic price book specificity tie-breaking, establish timezone-aware canonical posting date resolution, enforce segregation of duties in revision approval workflows, and preserve historical transaction snapshots and buying cost references without mutating posted invoice records or stock ledgers.

---

## 2. Business Motivation
In multi-tenant, enterprise retail environments:
1. **Cross-Tenant Data Leakage:** Lookup of Price Books and Customer Price Tiers must be strictly isolated to the authenticated tenant/company. Foreign-company IDs supplied by a client or POS terminal must never alter price calculations.
2. **Client-Side Tier Tampering Prevention:** Clients must not be trusted to self-assign discount tiers (`customer_tier_code`). Walk-in customers and unauthorized customers must never claim unassigned customer price tiers.
3. **Statutory & Contractual Determinism:** When quantity breaks, item-level entries, and variant-level entries overlap, the selection mechanism must be fully deterministic (`variant_id IS NOT NULL DESC`).
4. **Temporal Posting Accuracy:** Backdated sales, offline sync transactions, and future-scheduled sales must resolve prices using the authoritative transaction timestamp (`posting_date`), not ephemeral server processing time.
5. **Auditing & Segregation of Duties:** Non-administrative creators must not approve their own revisions. Revisions must not become effective prior to explicit approval.
6. **Stock Valuation & Financial Integrity:** Cost price revisions must update the variant's buying reference without retroactively mutating posted sales invoices or historical inventory valuation ledgers.

---

## 3. Scope
- **Included:**
  - Multi-tenant company isolation across `PricingEngine.calculate_effective_price`, `create_price_book`, and `add_price_book_entry`.
  - Authoritative server-side verification of `CustomerPriceAssignment` joined with `CustomerPriceTier` in `HeadlessBillingCore`.
  - Rejection/discard of unauthorized tier claims for walk-in and unassigned customers.
  - Deterministic tie-breaking prioritizing variant-specific Price Book entries over generic item entries (`variant_id IS NOT NULL DESC`).
  - Authoritative `posting_date` support on `CanonicalPostingContext` with ISO UTC normalization.
  - Segregation of duties in `PriceRevisionService.approve_revision` preventing self-approval by non-SYSADMIN/DIRECTOR roles.
  - 28 comprehensive automated tests in `test_price_revisions.py`.
- **Excluded:**
  - Modification of live production databases or running unverified migrations against production.
  - Secondary or competing pricing engines outside canonical `PricingEngine` and `HeadlessBillingCore`.

---

## 4. Current State
- Prior to this hardening, `PricingEngine` queried `PriceBook` and `CustomerPriceTier` by primary key without checking `company_id`.
- `HeadlessBillingCore` trusted client-supplied `req.customer_tier_code` if present.
- `stmt_pbe` in `PricingEngine` ordered primarily by `min_quantity.desc()`, which left specificity ties between item-level and variant-level entries non-deterministic.
- `CanonicalPostingContext` lacked an explicit `posting_date`, relying on current server time.

---

## 5. Gap Analysis
1. **Tenant Isolation Gap:** Cross-company Price Book or Tier IDs could be resolved if submitted in payloads.
2. **Authorization Gap:** Walk-in customers could receive VIP discounts by passing client-injected tier codes.
3. **Precedence Gap:** Specific variant entries did not deterministically override generic item price book entries on quantity ties.
4. **Temporal Gap:** Backdated/offline transactions did not resolve prices at their historical transaction boundary.
5. **Workflow Gap:** Revisions could be approved by the same user who drafted them.

---

## 6. Architecture Impact
- Reuses canonical `PricingEngine` and `HeadlessBillingCore` without duplicate pricing engines.
- Schema contract expanded backwards-compatibly: `posting_date: Optional[datetime] = None` on `CanonicalPostingContext`.
- No database migrations required for this phase; existing schema v1530/v1531 fully supports the tenant scoping and revision entity relations.

---

## 7. Proposed Design
1. **Tenant Boundary Guard:** Filter all `PriceBook` and `CustomerPriceTier` queries with `company_id == resolved_company_id`, `is_active == True`, and `is_deleted == False`.
2. **Server-Side Assignment Guard:** In `HeadlessBillingCore`, query `CustomerPriceAssignment` for the authoritative customer ID. Ignore client-provided `customer_tier_code` if no valid, active, non-expired assignment exists.
3. **Precedence Clause:** In `stmt_pbe`, append `PriceBookEntry.variant_id.isnot(None).desc()` to the `order_by` clause.
4. **Authoritative Timestamp:** Pass normalized UTC `posting_dt` to `PricingEngine.calculate_effective_price(as_of_date=posting_dt)`.
5. **Segregation of Duties:** In `PriceRevisionService.approve_revision`, verify `approver_id != rev.created_by` unless role is `SYSADMIN` or `DIRECTOR`.

---

## 8. Files Created
1. `docs/implementation/pricing/Price_Revision_Security_Hardening_And_Verification_Plan_v1.1.0.md`
2. `docs/walkthrough/pricing/Price_Revision_Security_Hardening_And_Verification_v1.1.0.md`

---

## 9. Files Modified
1. `backend/app/schemas/canonical_posting.py`: Added `posting_date` to `CanonicalPostingContext`.
2. `backend/app/services/pricing_engine.py`: Scoped Price Book and Tier lookups to company; added deterministic specificity order.
3. `backend/app/services/headless_billing.py`: Server-side customer tier authorization and posting date normalization.
4. `backend/app/services/price_revision_service.py`: Segregation of duties self-approval guard; timezone normalization.
5. `backend/tests/test_price_revisions.py`: Expanded test suite to 28 comprehensive automated tests.
6. `docs/implementation/README.md`: Master index updated.
7. `docs/walkthrough/README.md`: Master index updated.
8. `CHANGELOG.md`: Updated with security hardening details.

---

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0 (asyncpg), Pydantic v2.
- PostgreSQL database (isolated test fixtures).

---

## 11. Risks
- Risk of slow queries if joins are unindexed: Existing indices on `customer_price_assignments(customer_id, company_id)` and `price_books(company_id)` ensure index scans.
- Risk of backward compatibility break: Fallback to server UTC ensures existing callers omitting `posting_date` function seamlessly.

---

## 12. Rollback Strategy
Revert the git working tree commits on `backend/app/services/` and `backend/app/schemas/`. No destructive schema changes were made.

---

## 13. Verification Plan
- Execute complete pytest suite `backend/tests/test_price_revisions.py`.
- Execute Vitest frontend cache tests `src/tests/proposCatalogCache.test.ts`.
- Run static type-checking `npx tsc --noEmit --skipLibCheck`.
- Run Python compilation `python -m py_compile`.

---

## 14. Test Plan
33 tests executed against isolated test database `smriti_test_price_revisions`:
- Statutory ceiling enforcement ($SP \le MRP$).
- Immediate and scheduled revision activation.
- Replay and historical price reconstruction.
- Conflict prevention and overlapping timestamps.
- Invoice snapshot immutability.
- Tenant isolation (Price Book and Customer Tier).
- Walk-in and unassigned customer tier discard.
- Inactive/deleted tier rejection.
- Specificity precedence (`variant_id IS NOT NULL DESC`).
- Temporal boundary evaluation before and after revision effective date.
- Role-based approval and self-approval block.
- Cost revision reference update without historical invoice mutation.
- Fail-closed tenant isolation regressions:
  - Missing company ID with supplied Price Book (`SMRITI-PRICE-TENANT-REQUIRED`).
  - Missing company ID with supplied customer tier (`SMRITI-PRICE-TENANT-REQUIRED`).
  - Missing company ID with variant-level entry (`SMRITI-PRICE-TENANT-REQUIRED`).
  - Cross-tenant company mismatch rejection (`SMRITI-PRICE-TENANT-MISMATCH`).
  - Normal same-company pricing success.
- Dedicated test database isolation verification (`smriti_test_price_revisions` targeted; `smriti001` with 0 mutations).

---

## 15. Documentation Impact
- Created `Price_Revision_Security_Hardening_And_Verification_Plan_v1.1.0.md`.
- Created `Price_Revision_Security_Hardening_And_Verification_v1.1.0.md` walkthrough.
- Updated master indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Updated `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Code committed and pushed to `smritiNX` development branch.
2. Automated test suite runs green in CI pipeline.
3. Deploy to staging/test environment via `git pull`.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-042`: Master Data Parameter Governance and Dual-Key Architecture.
- `ADR-PRV-001`: Immutable Temporal Price Ledger.
- `ADR-PRV-002`: Statutory Ceiling Database Check Constraints.

---

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Engine_v1.0.0.md`
- `docs/walkthrough/pricing/Price_Revision_Security_Hardening_And_Verification_v1.1.0.md`
