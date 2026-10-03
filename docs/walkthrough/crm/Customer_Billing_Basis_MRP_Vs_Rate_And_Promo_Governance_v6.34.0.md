<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders
  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  Version    : 6.34.0
  Created    : 2026-09-17
  Modified   : 2026-09-17
  Copyright  : © SMRITIBooks.com. All Rights Reserved.
  License    : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Billing Basis (MRP vs RATE) & Promotion Margin Protection Governance v6.34.0

## 1. Purpose
In modern omnichannel retail and enterprise commerce, retailers serve two fundamentally distinct customer profiles:
1. **Retail Shoppers (B2C):** Purchase goods at Maximum Retail Price (**MRP**), which is statutory and inclusive of GST by default under the Legal Metrology (Packaged Commodities) Rules, 2011. Promotions (BOGO, item discounts, bill discounts, clearance) apply against the MRP.
2. **Wholesale & Corporate Partners (B2B / Institutions):** Purchase goods at Trade / Wholesale Rate (**RATE**), representing pre-agreed net selling prices or dealer discount factors (e.g. 30% to 50% off MRP), which are tax-exclusive (Base Rate + GST on top).

Previously, customer accounts lacked an explicit billing basis specification. If an item was billed to a wholesale customer, retail promotional discount schemes (e.g., 20% End-of-Season Sale, Buy-2-Get-1) could inadvertently stack on top of the already heavily discounted trade rates, leading to severe double-discounting margin destruction where items were sold below cost price.

This implementation establishes:
- An authoritative, persistent `pricing_basis` (`"MRP"` | `"RATE"`) and `allow_promotions_on_rate` (Boolean) on the Customer Master and Customer Groups.
- Promotion Margin Protection Governance in `SmritiSalesPromotionService`, automatically suppressing retail promotional discounts when billing on `RATE`, while allowing contractual partner schemes (like Reliance 43.76%) and optional authorized stacking.
- Real-time dynamic POS re-rating during checkout, item lookup, and mid-bill customer switching (Alt+M).
- Statutory Legal Metrology ceiling enforcement: `(Rate + GST) <= MRP`.

---

## 2. Scope
1. **Database Persistence & Migrations:**
   - Alembic migration `v1463_customer_pricing_basis_and_promotions_on_rate.py` adding `pricing_basis` (VARCHAR(20) NOT NULL DEFAULT 'MRP') and `allow_promotions_on_rate` (BOOLEAN NOT NULL DEFAULT false) with an index on `pricing_basis`.
   - Executed and verified on PostgreSQL databases `smriti001` and `smritisys`.
2. **Backend ORM & API Schemas:**
   - SQLAlchemy model `Customer` (`backend/app/models/crm.py`).
   - Pydantic v2 schemas `CustomerBase`, `CustomerUpdate`, `CustomerResponse`, `CustomerGroupBase`, and `CustomerGroupUpdate` (`backend/app/schemas/crm.py`).
3. **Policy Engine & Store:**
   - `src/types.ts`: Extended `Customer`, `CustomerGroup`, `ResolvedCustomerPolicy`, and `ProPosCustomer`.
   - `src/services/custPolicyEngine.ts`: Added policy inheritance from `CustomerGroup` to `Customer`.
   - `src/services/customerStore.ts`: Updated local customer store and memory caches.
4. **UI Components:**
   - `CustFormTab.tsx`: Added `Billing Basis (Bill On)*` select dropdown and `Allow Retail Promotions on Trade Rate` margin disclaimer toggle.
   - `CustAddlDetTab.tsx`: Added `Bill On Price` select in Price & Tax Factors card.
   - `CustBrowseDlg.tsx`: Added `Bill On` badge column (`MRP` emerald vs `RATE` amber) and `Bill On Price` dropdown in quick-add customer panel.
   - `ProPosBillingTerm.tsx`: Updated direct item lookup and mid-bill customer switch (`handleCustomerSelection`) to evaluate `customer.pricingBasis`, and added header badge `[BILL ON: RATE (Wholesale)]` / `[BILL ON: MRP (Retail)]`.
5. **Promotion Engine:**
   - `SmritiSalesPromotionService.resolveBestItemPromo`: Implemented trade rate suppression returning `"RATE (NET)"` badge when `pricingBasis === "RATE" && !allowPromotionsOnRate`.

---

## 3. Files Created
1. `backend/alembic/versions/v1463_customer_pricing_basis_and_promotions_on_rate.py` — Alembic database migration adding `pricing_basis` and `allow_promotions_on_rate` to `customers` and `customer_groups`.
2. `src/tests/customerPricingBasisAndPromo.test.ts` — Comprehensive Vitest unit test suite covering policy resolution, margin protection, statutory ceiling checks, and dynamic cart re-rating.
3. `scripts/test_headless_customer_pricing_basis.py` — Playwright automated headless runner verifying end-to-end browser flows and capturing high-resolution evidence screenshots.
4. `docs/walkthrough/crm/Customer_Billing_Basis_MRP_Vs_Rate_And_Promo_Governance_v6.34.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/crm.py` — Added columns `pricing_basis` and `allow_promotions_on_rate` to SQLAlchemy `Customer` and `CustomerGroup` models.
2. `backend/app/schemas/crm.py` — Added fields to Pydantic v2 schemas `CustomerBase`, `CustomerUpdate`, `CustomerResponse`, `CustomerGroupBase`, and `CustomerGroupUpdate`.
3. `src/types.ts` — Added `pricingBasis?: "MRP" | "RATE"` and `allowPromotionsOnRate?: boolean` across customer interfaces.
4. `src/services/custPolicyEngine.ts` — Implemented policy resolution fallback from Customer to CustomerGroup.
5. `src/services/customerStore.ts` — Synchronized customer store getters, mappers, and seed records.
6. `src/components/customer/types.ts` — Added `pricingBasis` and `allowPromotionsOnRate` to `RetailCustomerRecord`.
7. `src/components/customer/CustFormTab.tsx` — Rendered `Billing Basis (Bill On)*` select dropdown and promotion margin toggle.
8. `src/components/customer/CustAddlDetTab.tsx` — Integrated `Bill On Price` dropdown into Additional Details tab.
9. `src/components/billing/propos/types.ts` — Extended `ProPosCustomer` with `pricingBasis` and `allowPromotionsOnRate`.
10. `src/components/billing/propos/CustBrowseDlg.tsx` — Added `Bill On` badge column and quick-add customer selector.
11. `src/services/smritiSalesPromotionService.ts` — Added wholesale trade rate margin protection governance to `resolveBestItemPromo`.
12. `src/components/billing/propos/ProPosBillingTerm.tsx` — Implemented dynamic pricing basis resolution on barcode lookup, customer header badge, and mid-bill customer switch.
13. `docs/walkthrough/README.md` — Appended chronological master index entry.

---

## 5. Architecture Decisions
- **ADR-CRM-001: Explicit Single Source of Truth for Pricing Basis:** Rather than guessing whether a customer is wholesale based on heuristics (like customer name or GSTIN presence), `pricing_basis` is modeled as an explicit database column defaulting to `'MRP'`. This guarantees deterministic billing behavior.
- **ADR-PROMO-002: Default-Deny Retail Promotions on Trade Rate:** Wholesale selling rates already incorporate significant margin cuts (30-50% off MRP). Stacking retail promotions onto trade rates by default is financially hazardous. `allow_promotions_on_rate` defaults to `false`. Management must explicitly toggle this flag per customer or customer group to authorize promotional stacking.
- **ADR-TAX-003: Tax Mode Harmonization:** Retail MRP is statutory tax-inclusive (GST included in sticker price). Trade Rate is statutory tax-exclusive (Base Rate + GST charged on invoice). Selecting `pricingBasis = "RATE"` automatically synchronizes `taxInclusive = false` in the UI and checkout request.

---

## 6. Design Rationale
- **Legal Metrology Ceiling Protection:** Under Indian law (Legal Metrology Act, 2009 and Packaged Commodities Rules), goods cannot be sold at a price exceeding the Maximum Retail Price stamped on the packaging. When billing on `RATE`, `(Rate * (1 + GST/100))` must never exceed MRP. The POS terminal and validation pipeline strictly audit this ceiling.
- **Explainability & Frictionless Cashier Feedback:** Cashiers should never be surprised why a promotion did or did not apply. When billing a wholesale customer on RATE, the discount column displays `0.00%`, and the promo badge displays `RATE (NET)` with an explainability reason: `"Retail promotions suppressed: Customer billed on Wholesale Trade Rate"`.

---

## 7. Implementation Summary
```text
┌────────────────────────────────────────────────────────┐
│               Customer Master / Group                  │
│       pricing_basis: "MRP" | "RATE"                    │
│       allow_promotions_on_rate: boolean                │
└─────────────────────────┬──────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
    [Bill On: MRP]                  [Bill On: RATE]
          │                               │
  Base Unit Price = MRP           Base Unit Price = Selling Price
  Tax Mode = Inclusive            Tax Mode = Exclusive (Base + GST)
  Retail Promotions = Active      Retail Promotions = SUPPRESSED
  (e.g., EOSS 20%, B2G1)          (Returns badge: "RATE (NET)")
```

1. **Alembic Migration (`v1463`):** Added columns to both tenant databases (`smriti001`, `smritisys`).
2. **Customer Master & Quick Browse:** Cashiers can set or view the billing basis in the Customer Master form, in additional details, and directly in the customer browse window via visual badges.
3. **POS Terminal Integration:** The terminal detects customer basis on selection, displays `[BILL ON: RATE (Wholesale)]` or `[BILL ON: MRP (Retail)]`, populates items at Selling Price or MRP accordingly, and recalculates existing cart lines upon mid-bill customer switch.

---

## 8. Tests Executed
1. **Unit Testing (`src/tests/customerPricingBasisAndPromo.test.ts`):**
   - Policy resolution for retail customer (MRP, no promos on rate, tax-inclusive).
   - Policy resolution for wholesale group inheritance (RATE, tax-exclusive).
   - Customer-level override of group defaults.
   - Retail customer on MRP receives 20% EOSS promotion.
   - Wholesale customer on RATE suppresses retail promotion, returns 0% discount and `RATE (NET)` badge.
   - Authorized stacking when `allowPromotionsOnRate = true`.
   - Reliance contractual trade discount (43.76%) honored across all bases.
   - Statutory Legal Metrology Act `(Rate + GST) <= MRP` ceiling verification.
   - Dynamic cart re-rating simulation on customer switch from Retail to Wholesale.
2. **Related Regression Tests:**
   - `src/tests/smritiRelianceDiscountExclusivity.test.ts` (4/4 passed).
   - `src/tests/smritiPromotionClawback.test.ts` (5/5 passed).
3. **Compiler & Linter Execution:**
   - Python byte-compilation: `python -m py_compile backend/app/models/crm.py backend/app/schemas/crm.py backend/alembic/versions/v1463_customer_pricing_basis_and_promotions_on_rate.py` (0 errors).
   - TypeScript compile check: `npx tsc --noEmit` (0 errors).
   - Production bundle build: `npm run build` (3,550 modules in 31.70s, 0 errors).
4. **End-to-End Headless Browser Testing (`scripts/test_headless_customer_pricing_basis.py`):**
   - Headless Chromium automated verification capturing 4 high-resolution screenshots.

---

## 9. Verification Results

### Vitest Unit Tests:
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/customerPricingBasisAndPromo.test.ts (10 tests) 26ms
 ✓ src/tests/smritiPromotionClawback.test.ts (5 tests) 7ms
 ✓ src/tests/smritiRelianceDiscountExclusivity.test.ts (4 tests) 23ms

 Test Files  3 passed (3)
      Tests  19 passed (19)
```

### Headless Verification Screenshots:
1. `01_customer_form_billing_basis_rate.png` — Customer Master form displaying `Billing Basis (Bill On)*` with `RATE (Wholesale / Trade Price)` and `Allow Retail Promotions on Trade Rate` warning disclaimer.
2. `02_customer_browse_dlg_bill_on_column.png` — Customer Search & Browse Window displaying the `Bill On` badge column (`MRP` emerald vs `RATE` amber) and Quick Add customer panel.
3. `03_billing_terminal_customer_bill_on_badge.png` — POS Billing Terminal customer header showing `[BILL ON: RATE (Wholesale)]` and `Tax: Exclusive (Base+GST) [Default]`.
4. `04_billing_cart_line_pricing_basis.png` — Accepted line item in POS cart showing wholesale selling price rate (`₹500.00` vs MRP `₹600.00`), `0.00%` discount, and margin-protected net totals.

---

## 10. Known Limitations
- When dynamic price lists (e.g. seasonal wholesale tier 1 vs tier 2) are active, `p.selling_price` is currently taken as the base wholesale rate unless a customer price list ID is specified. Future enhancements will wire price list tier lookup into this resolver.

---

## 11. Future Work
- Add item-category-specific margin floors (e.g., minimum 18% margin on Electronics, minimum 35% on Apparel) checked in real time during wholesale cart checkout.

---

## 12. Related ADRs
- `ADR-CRM-001`: Explicit Customer Pricing Basis Specification
- `ADR-PROMO-002`: Default-Deny Wholesale Promotional Stacking
- `ADR-TAX-003`: Wholesale Tax-Exclusive Synchronization

---

## 13. Related RFCs
- `RFC-POS-2026-08`: Shoper 9 Parity & Enterprise B2B/B2C Dynamic Pricing Engine
