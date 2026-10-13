<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Plan
-->

# SMRITI Retail OS — MRP & Selling Price Revision Architecture Plan

**Document ID:** IP-PRICING-REV-001  
**Area:** Pricing, Catalog & POS Billing (`pricing`)  
**Status:** In Progress  
**Version:** 1.0.0  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Objective
Establish an authoritative, temporal, and auditable MRP, Selling Price, and Cost Price revision system in SMRITI Retail OS. Guarantee that past price points can be reconstructed accurately as of any historical timestamp, future-dated revisions activate strictly at their scheduled effective time without premature leakage into live Point of Sale (POS) billing, and all price adjustments enforce configurable approval gates, statutory ceiling validation, and immutable audit trails.

---

## 2. Business Motivation
In multi-store retail, footwear, apparel, and FMCG operations:
1. **Statutory Compliance:** Under the Legal Metrology (Packaged Commodities) Rules, selling price must never exceed the Maximum Retail Price (MRP).
2. **Promotional & Seasonal Scheduling:** Retailers prepare festival (e.g. Diwali, EOSS) price updates days in advance. Premature activation before the scheduled time causes immediate revenue leakage and customer confusion.
3. **Loss Prevention & Margin Protection:** Uncontrolled master price edits by store-level operators erode margins. Price changes exceeding configured percentage thresholds must require authorized manager sign-off.
4. **Historical Margin & Tax Audits:** Statutory tax audits and inventory revaluations require knowing the exact price and MRP active on any past transaction date. Overwriting prices in place destroys this historical record.

---

## 3. Scope
- **Included:**
  - Dedicated temporal data model (`item_price_revisions`) tracking previous and revised MRP, Selling Price, and Cost Price.
  - Effective date and time handling (including future-scheduled and end-dated revisions).
  - Role-based and threshold-based approval workflow (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED` → `SCHEDULED` / `ACTIVE` → `SUPERSEDED` / `EXPIRED`).
  - Unified central revision service consumed by single-item UI, REST APIs, and bulk Universal Imports.
  - Re-resolution and deviation guards in POS Headless Billing.
  - Price Revision Studio UI with comparison preview, scheduling, and approval queue.
  - Automated test suite covering temporal replay, boundary conditions, and invoice immutability.
- **Excluded:**
  - Separate external pricing engines (all logic extends standard SMRITI / ERPNext-aligned models).
  - Destruction or purging of existing transaction invoices or order records.

---

## 4. Current State
- Existing prices reside across `items`, `item_variants`, `price_book_entries`, and `products`.
- Master edits update `selling_price` and `mrp` in place without preserving previous values.
- `item_prices` has a 1:1 primary key on `item_variant_id`, preventing multiple historical price records.
- In-flight catalog saves with differing MRPs generated 744 orphaned `PriceBook` records with `is_default=False`.
- Headless billing accepts client-submitted `unit_price` without comparing against backend active rates.
- `audit_logs` and `approval_requests` currently have 0 rows for catalog price changes.

---

## 5. Gap Analysis
| Requirement | Current State | Target State |
|---|---|---|
| Price History | Overwritten in place | Immutable revision log with previous and revised MRP, SP, and CP |
| Effective Dates | Header valid_from only in PriceBook; ignored in variant sync | Timestamptz effective_from and effective_to evaluated at transaction time |
| Approvals | No approval flow for master prices | Configurable threshold and role-based approval state machine |
| POS Resolution | Client submits price; backend only checks rate <= MRP | Backend re-resolves effective price as of txn_date; requires supervisor token if divergent |
| Ingress Parity | CSV import and UI update different tables | Unified `PriceRevisionService` handles UI, API, and bulk imports atomically |

---

## 6. Architecture Impact
- **Database:** New table `item_price_revisions` in tenant databases (`smritiXXX`) and control plane template.
- **Backend Services:** `PriceRevisionService` integrated into `PricingEngine.calculate_effective_price` and `HeadlessBillingCore`.
- **API Endpoints:** New `/api/v1/pricing/revisions` endpoints under `backend/app/api/v1/pricing.py`.
- **Frontend:** New `PriceRevisionStudioModal.tsx` following SMRITI design tokens.

---

## 7. Proposed Design
Detailed in Section 4 of the audit report:
- Entity: `ItemPriceRevision` with tenant scoping, monetary numeric(15,2) precision, revision authors, justification, approval metadata, and audit references.
- Lifecycle: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SCHEDULED` / `ACTIVE` → `SUPERSEDED`.
- Active Price Resolution:
  $$\text{Price}(V, T) = \text{Revision}(V, \text{APPROVED}, \text{effective\_from} \le T < \text{effective\_to})$$

---

## 8. Files Created
1. `backend/alembic/versions/v1530_item_price_revisions.py`
2. `backend/app/services/price_revision_service.py`
3. `backend/tests/test_price_revisions.py`
4. `src/components/pricing/PriceRevisionStudioModal.tsx`
5. `docs/implementation/pricing/MRP_And_Selling_Price_Revision_Architecture_Plan_v1.0.0.md`
6. `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Architecture_Walkthrough_v1.0.0.md`

---

## 9. Files Modified
1. `backend/app/models/pricing.py`
2. `backend/app/schemas/pricing.py`
3. `backend/app/services/pricing_engine.py`
4. `backend/app/services/headless_billing.py`
5. `backend/app/api/v1/pricing.py`
6. `backend/app/api/v1/universal_import.py`
7. `docs/implementation/README.md`
8. `CHANGELOG.md`

---

## 10. Dependencies
- PostgreSQL 14+ (`timestamptz`, `numeric`, `btree` / `gist` indexing).
- FastAPI, SQLAlchemy AsyncSession, Alembic.
- Existing SMRITI security matrix (`UserRole.MANAGER`, `UserRole.SYSADMIN`, `UserRole.CASHIER`).

---

## 11. Risks
- **Risk 1:** Future-dated revisions activating while a terminal is offline without synchronization.  
  *Mitigation:* Terminal edge cache stores future effective schedules and evaluates current device time.
- **Risk 2:** High volume of price changes in seasonal sales creating database lock contention.  
  *Mitigation:* Batch chunking in `bulk_create_revisions` with explicit short row locks.

---

## 12. Rollback Strategy
- Alembic downgrade: `alembic downgrade -1` drops `item_price_revisions` cleanly without altering `items` or `item_variants`.
- Existing baseline price columns (`item_variants.selling_price`, `items.mrp`) remain populated for backwards compatibility.

---

## 13. Verification Plan
- Automated unit and integration test suite executing 10 target scenarios via pytest.
- Terminal output logs verified and pasted.

---

## 14. Test Plan
- Test historical reconstruction ($T_{-30\text{ days}}$).
- Test future scheduling ($T_{+5\text{ days}}$).
- Test approval threshold gating ($> 10\%$ deviation requires manager).
- Test POS checkout rate tampering rejection.
- Test tenant isolation and historical invoice immutability.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create Walkthrough under `docs/walkthrough/pricing/`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Apply Alembic migration `v1530` across active tenant DBs and control plane.
2. Deploy backend service and API updates.
3. Deploy frontend Price Revision Studio.
4. Run live verification script.

---

## 17. Status
**In Progress**

---

## 18. Related ADRs
- ADR-0021: Variant Dimension Authority
- ADR-0034: Headless Billing Core & Universal Statutory Engine

---

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Architecture_Walkthrough_v1.0.0.md` (to be created upon completion)
