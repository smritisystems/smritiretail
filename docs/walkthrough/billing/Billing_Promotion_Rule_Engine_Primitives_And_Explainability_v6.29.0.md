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

  * Version    : 6.29.0
  * Created    : 2026-09-17
  * Modified   : 2026-09-17
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Enterprise Promotion Engine — Canonical PostgreSQL Schema & 5-Primitive Rule Engine (v6.29.0)

## 1. Purpose
This release transforms SMRITI's sales promotions infrastructure from legacy ad-hoc scheme definitions into a canonical, tenant-isolated, versioned, and immutable **Enterprise Promotion Engine**. Extracting the proven retail strengths of Tally Shoper 9 (B2G1 progression, cross-item differential rewards, progressive quantity slabs, supervisor discount overrides, and bulk SKU list merchandising) while discarding its single-tenant architecture and mutable database anti-patterns, this implementation establishes a complete PostgreSQL 15+ database foundation, SQLAlchemy 2.0 ORM models, Alembic migration lineage (`v1457`), and client-side rule evaluation with promotion explainability and non-blocking decline workflows.

---

## 2. Scope
- **Database Schema & DDL:** 11 custom PostgreSQL ENUM types, 18 canonical tables across 4 phases, composite tenant indexes, high-speed POS barcode lookup indexes, automatic modified timestamp triggers, and database-level version immutability guard triggers.
- **ORM & Data Layer:** Full SQLAlchemy 2.0 declarative models in `backend/app/models/promotions.py` inheriting from SMRITI's multi-tenant `BaseEntity`.
- **Alembic Migration:** Linear, idempotent migration `v1457_canonical_smriti_promotions_engine.py` branching directly from `v1456_tax_inclusive_barcode_group_customer_snapshot`.
- **Service Layer (5 Core Primitives):** Refactored `smritiSalesPromotionService.ts` to model promotions via 5 decoupled primitives: `Eligibility`, `Trigger`, `Reward`, `Limits`, and `Governance`.
- **Promotion Explainability:** Structured audit verification checklists answering *"Why this discount?"* (`PromotionExplanation`), detailing matched rules, observed vs required values, and arbitration proof.
- **Non-Blocking Free Item & Decline Analytics:** `UnclaimedFreeItemOffer` qualification flow with explicit decline recording (`recordPromotionDecline`) capturing the critical retail metric *"Qualified but not redeemed"*.
- **Single Primary Basket Upsell Milestone Gauge:** Context-aware single-milestone progress calculation (`getBasketUpsellMilestone`) rendering a 16-block ASCII gauge (`[██████████████░░]`) without POS UI clutter.
- **Statutory GST Section 15 Compliance:** Explicit tax treatment indicator (`tax_treatment = 'PRE_TAX_TRADE_DISCOUNT'`) assuring alignment with SMRITI's GSTR-1 and E-Invoice engines.
- **Automated Verification:** Comprehensive Vitest test suite (`smritiAutoSelectPromotion.test.ts` 14/14 green, `smritiSalesPromotionEngine.test.ts` 15/15 green) and zero TypeScript compilation errors.

---

## 3. Files Created
1. `backend/alembic/versions/v1457_canonical_smriti_promotions_engine.py` — Alembic migration creating 11 enums, 18 tables, triggers, and indexes.
2. `docs/walkthrough/billing/Billing_Promotion_Rule_Engine_Primitives_And_Explainability_v6.29.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/promotions.py` — Added canonical SQLAlchemy 2.0 models while maintaining backward-compatible campaign and redemption aliases.
2. `src/services/smritiSalesPromotionService.ts` — Added 5-primitive interfaces, explainability, decline flow, and basket upsell milestone engine.
3. `src/tests/smritiAutoSelectPromotion.test.ts` — Added Tests 11 through 14 covering explainability, basket milestones, non-blocking declines, and tax treatment.
4. `docs/walkthrough/README.md` — Updated master walkthrough registry with v6.29.0 entry.
5. `CHANGELOG.md` — Updated release history for v6.29.0.

---

## 5. Architecture Decisions
1. **The Golden Immutability Rule:** *Promotion definitions are versioned configuration; promotion qualifications and redemptions are immutable transactional events.* Published versions (`status = 'PUBLISHED'`) or versions linked to historical invoice redemptions are locked at the PostgreSQL trigger level.
2. **Authoritative Master Independence:** Promotion masters reference `items.id`, `item_barcodes.id`, `customers.id`, and `branches.id`. Item names, brand names, and customer names are never denormalized into promotion tables.
3. **Trigger vs Reward Scope Decoupling:** Cross-item promotions (e.g. "Buy a Suit, Get a Tie Free") are modeled by decoupling the trigger scope from an independent `reward_scope_id`.
4. **Non-Blocking Cashier Flow:** Instead of Shoper 9's counter deadlock (`Free Items Mandatory = 1`), SMRITI provides non-blocking qualification prompts with explicit decline tracking to prevent checkout delays.
5. **Single Primary Upsell Milestone:** POS summary displays strictly one primary upsell milestone to keep cashier canvas clean and responsive.

---

## 6. Design Rationale
- **Why Staged Merchandising Imports:** Merchandisers frequently upload 5,000+ SKU lists in Excel. Directly writing to production tables risks partial failures and lock contention. The staged tables (`smriti_promotion_imports` and `smriti_promotion_import_rows`) validate all rows, calculate file SHA-256 digests, and commit atomically.
- **Why Composite Tenant Indexing:** In SaaS retail environments, unindexed queries across multi-store schemas lead to slow scans. Every table has `tenant_id` as the leading index column.

---

## 7. Implementation Summary

### 5 Core Primitives Architecture
```text
PROMOTION MASTER (Identity, Code, Tenant)
       │
       ▼
PROMOTION VERSION (Version No, SHA-256 Digest, Effective Window)
       │
       ├─► PROMOTION RULES (Rule No, Type: BUY_QTY, BASKET_VALUE, SLAB)
       │         │
       │         ├─► PROMOTION CONDITIONS (Field, Operator, Target Value)
       │         │
       │         └─► PROMOTION REWARDS (Type: FREE_ITEM, % DISC, FLAT ₹, REWARD SCOPE)
       │
       └─► PROMOTION SCOPES (SKU, Category, Brand, Store, Customer Group)
                 │
                 └─► SCOPE ITEMS (Indexed Barcodes for < 1.5ms POS Lookup)
```

---

## 8. Tests Executed

### Automated Vitest Suites
```bash
npm test -- src/tests/smritiAutoSelectPromotion.test.ts
npm test -- src/tests/smritiSalesPromotionEngine.test.ts
npx tsc --noEmit
python -m py_compile backend/app/models/promotions.py backend/alembic/versions/v1457_canonical_smriti_promotions_engine.py
```

---

## 9. Verification Results

### Terminal Execution Logs
1. `src/tests/smritiAutoSelectPromotion.test.ts`: **14/14 passed (44ms)**
2. `src/tests/smritiSalesPromotionEngine.test.ts`: **15/15 passed (35ms)**
3. `npx tsc --noEmit`: **Exit code 0 (0 compilation errors)**
4. `python -m py_compile`: **Exit code 0 (0 compilation errors)**

---

## 10. Known Limitations
- Background asynchronous synchronization of offline `localStorage` decline logs to `/api/v1/promotions/declines` will be connected during Phase 2 API endpoint deployment.
- Redis cache invalidation hooks for multi-terminal retail clusters will be wired in Phase 3.

---

## 11. Future Work
- Phase 2 Backend: Expose FastAPI endpoints for `/api/v1/promotions/versions`, `/api/v1/promotions/declines`, and `/api/v1/promotions/simulations`.
- Phase 3 Merchandising: Connect the Excel/CSV file upload wizard in `SmritiSalesPromotionsStudio.tsx` to `smriti_promotion_imports`.
- Phase 4 Analytics: Implement promotion performance dashboard comparing Qualified vs Redeemed vs Declined rates.

---

## 12. Related ADRs
- `ADR-005`: One-Way Projections & Statutory Snapshot Rule
- `ADR-008`: Canonical Commercial Pricing, Tax Exclusivity & Discount Invariance

---

## 13. Related RFCs
- `RFC-2026-09-PRM`: SMRITI Multi-Tenant Enterprise Promotion Rule Engine
- `RFC-2026-09-SHP`: Shoper 9 Parity & Non-Blocking Cashier Governance Standard
