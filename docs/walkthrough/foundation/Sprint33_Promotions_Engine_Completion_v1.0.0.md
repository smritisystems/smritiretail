<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sprint 33 — Section 7 Shared Business Engines: Promotions Engine Completion

**Document ID:** `WGP-FOUNDATION-SPRINT33-V1.0.0`  
**Version:** `1.0.0`  
**Date:** `2026-08-25`  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Status:** `Completed / Verified`

---

## 1. Purpose
This walkthrough documents the design, architecture, implementation, and verification of **Sprint 33: Section 7 Shared Business Engines: Promotions Engine Completion**. It establishes an authoritative, transactional Promotions and Offers Engine within the FastAPI + PostgreSQL system of record, supporting multi-tier promotional discounts, Buy-X-Get-Y (BXGY) bundling, coupon code validation with strict rate/usage limit enforcement, and sophisticated conflict resolution and stacking policies.

---

## 2. Scope
- **Domain Modeling & Schemas**: Pydantic schemas for Campaigns, Promotion Rules, Coupons, Cart Evaluation, Conflict/Stacking Strategies, and Redemptions.
- **Rule Mechanics**: Evaluating Percentage discounts, Flat fixed discounts, Buy-X-Get-Y (BOGO/BXGY), and Special bundle pricing.
- **Eligibility & Gating**: Date validity, store filtering, channel filtering (POS, eCommerce, B2B), minimum order amounts, and product/category restrictions.
- **Stacking & Conflict Resolution**: Exclusive overrides (`EXCLUSIVE_OVERRIDE`), Best-Benefit calculation (`BEST_BENEFIT`), and multi-campaign stacking bounded by `max_stacked_discount_percent` safety caps.
- **Coupon Lifecycle**: Code generation, single-use and multi-use limits, usage counters, and automated expiration.
- **Redemption Ledger**: Authoritative, immutable `PromotionRedemption` ledger records for historical auditing.
- **REST Endpoints**: Comprehensive endpoints mounted under `/api/v1/promotions/*`.
- **Automated Verification**: End-to-end integration test suite (`backend/tests/t_promotions.py`) and full 81-test platform regression.

---

## 3. Files Created
1. [`backend/app/schemas/promotions.py`](file:///F:/SMRITRretailNX/backend/app/schemas/promotions.py) — Pydantic schemas for campaigns, rules, coupons, evaluation requests/responses, and redemptions.
2. [`backend/app/services/promotions_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/promotions_engine.py) — Core promotions calculation, BXGY bundling, conflict/stacking resolution, and redemption service.
3. [`backend/app/api/v1/promotions.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/promotions.py) — REST API router mounted at `/api/v1/promotions`.
4. [`backend/tests/t_promotions.py`](file:///F:/SMRITRretailNX/backend/tests/t_promotions.py) — 6 integration test cases verifying discount mechanics, BXGY, coupon limits, stacking safety caps, and REST endpoints.
5. [`docs/walkthrough/foundation/Sprint33_Promotions_Engine_Completion_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint33_Promotions_Engine_Completion_v1.0.0.md) — This walkthrough document.

---

## 4. Files Modified
1. [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `promotions.router` at `/api/v1/promotions`.
2. [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Certified Section 7 Promotions Engine as `Done / Verified` per Rule 11.
3. [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 33 to Master Walkthrough Index.
4. [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Logged `v3.49.0` release notes.

---

## 5. Architecture Decisions
1. **Separation of Promotion Rules vs Pricing Engine**: While the Pricing Engine resolves base catalogue, volume, and customer tier prices, the Promotions Engine executes high-order promotional campaigns, coupons, and cart-level rules.
2. **Explicit Stacking and Exclusion Policies**:
   - `is_exclusive=True` campaigns take absolute precedence, suppressing all standard discounts (`EXCLUSIVE_OVERRIDE`).
   - Multiple stackable campaigns are combined up to the campaign's `max_stacked_discount_percent` ceiling to protect merchant margins.
   - Non-stackable campaigns compete under `BEST_BENEFIT`, automatically awarding the single highest discount to the shopper.
3. **Immutable Redemption Audit Ledger**: Every promotion redemption is recorded in `promotion_redemptions` with campaign snapshot IDs, coupon IDs, and invoice references.

---

## 6. Design Rationale
- **Deterministic Discount Calculations**: Calculations use Python `Decimal` arithmetic rounded to 2 decimal places with `ROUND_HALF_UP`, avoiding floating-point rounding errors.
- **Fail-Closed Coupon Security**: If a coupon reaches its configured `usage_limit` or has expired, it is immediately rejected with 0 promotional discount and clear narration.
- **Channel & Store Scoping**: Campaigns can be restricted to specific sales channels (POS, ECOMMERCE, MOBILE_APP, B2B) and store locations.

---

## 7. Implementation Summary
- **Pydantic Models**: Modeled campaign headers, rules, coupon inventory, cart items, evaluation requests, and redemption structures.
- **PromotionsEngine Service**:
  - `create_campaign`, `add_promotion_rule`, `create_coupon`.
  - `evaluate_promotions`: Evaluates active campaigns, BXGY bundles, applies stacking policies, and computes net cart totals.
  - `record_redemption`: Atomically writes `PromotionRedemption` and increments coupon usage counters.
- **FastAPI Endpoints**:
  - `POST /api/v1/promotions/campaigns`
  - `GET /api/v1/promotions/campaigns`
  - `POST /api/v1/promotions/campaigns/{id}/rules`
  - `POST /api/v1/promotions/coupons`
  - `POST /api/v1/promotions/evaluate`
  - `POST /api/v1/promotions/redeem`

---

## 8. Tests Executed
```powershell
# Promotions Engine Integration Suite (6 tests)
python -m pytest tests/t_promotions.py -v

# Full Platform Regression Suite (81 tests)
python -m pytest tests/t_promotions.py tests/t_pricing_engine.py tests/t_stock_acct.py tests/t_item_master.py tests/t_party_master.py tests/t_tx_reproduce.py tests/t_gov_logic.py tests/t_workspace_ui.py tests/t_cap_registry.py tests/t_ctrl_ref.py tests/t_reports_parity.py -v
```

---

## 9. Verification Results
```text
============================== 81 passed in 49.79s ==============================
- Percentage & Fixed Discount Evaluation: PASSED
- Buy-X-Get-Y (BOGO) Offer Mechanics: PASSED
- Coupon Validation & Usage Limit Enforcement: PASSED
- Exclusive Promotion Override Strategy: PASSED
- Multi-Campaign Stacking & Safety Cap: PASSED
- REST API Promotion Endpoints: PASSED
- Full Platform Regression: 81/81 PASSED (100% Green)
```

---

## 10. Known Limitations
- Tiered cart value thresholds (e.g. Spend ₹1000 get 10%, Spend ₹2000 get 20%) are currently modeled via separate campaign rules; dynamic ladder evaluation can be enhanced in future iterations.

---

## 11. Future Work
- **Sprint 34**: Section 7 Payments Engine Completion (payment methods, transactions, receipts, refunds, allocations, provider adapters, idempotency).
- **Sprint 35**: Section 7 Documents Engine Completion.
- **Sprint 36**: Section 7 Fulfillment Engine Completion.

---

## 12. Related ADRs
- `ADR-0021`: Authoritative System of Record in FastAPI + PostgreSQL.
- `ADR-0028`: Commercial Growth Engine and Promotion Engine Architecture.

---

## 13. Related RFCs
- `RFC-2026-07`: Multi-tier Promotion Stacking and Margin Safety Controls.
