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

# Implementation Plan: Customer Billing Basis (MRP vs RATE) & Promotion Margin Protection Governance v6.34.0

## 1. Objective
Establish an authoritative, persistent pricing basis (`pricing_basis`: `"MRP"` | `"RATE"`) and promotion stacking governance flag (`allow_promotions_on_rate`: Boolean) on the Customer Master and Customer Groups, coupled with Promotion Margin Protection in the sales promotion service to safeguard wholesale margins and enforce Legal Metrology statutory price ceilings.

## 2. Business Motivation
B2B and corporate clients are billed on negotiated trade rates (typically 30% to 50% below MRP). In retail billing terminals, applying retail marketing campaigns (such as Buy-2-Get-1 or 20% End-of-Season Sale) on top of already discounted wholesale rates results in margin collapse (selling below cost price). Conversely, retail customers must be billed on MRP with applicable promotional discounts. Establishing explicit pricing basis eliminates ambiguity, prevents margin erosion, and ensures statutory compliance.

## 3. Scope
- PostgreSQL database migration across tenant databases (`smriti001`, `smritisys`).
- Backend ORM and Pydantic schemas.
- Client policy engine resolution and customer store synchronization.
- Customer Master Form, Additional Details, and Quick-Add UI controls.
- POS terminal customer header indicators, item lookup re-rating, and mid-bill customer switch.
- Promotion margin protection suppression returning `RATE (NET)`.

## 4. Current State
Prior to this implementation, customers had no persistent `pricing_basis` field; billing terminals defaulted to MRP for all shoppers, and retail promotions applied indiscriminately without checking if the customer was an institutional wholesale buyer on discounted rates.

## 5. Gap Analysis
- Missing database columns: `pricing_basis` and `allow_promotions_on_rate` on `customers` and `customer_groups`.
- Missing UI controls in Customer Master and Customer Browse modal.
- No promotion margin protection on wholesale rates in `SmritiSalesPromotionService`.
- No dynamic re-rating or visual badging on POS terminal.

## 6. Architecture Impact
- **Database Layer:** Added persistent indexed column `pricing_basis VARCHAR(20) DEFAULT 'MRP'` and `allow_promotions_on_rate BOOLEAN DEFAULT false`.
- **API & Schemas:** Pydantic `CustomerBase` and `CustomerGroupBase` schemas expose these attributes in all read/write endpoints.
- **Service Layer:** `resolveCustomerPolicy` and `resolveBestItemPromo` coordinate margin-protection suppression.

## 7. Proposed Design
1. Customer inherits `pricingBasis` and `allowPromotionsOnRate` from `CustomerGroup` if not overridden.
2. When `pricingBasis === "RATE"`, item base price resolves to `selling_price`, tax mode defaults to exclusive, and retail promotions are suppressed unless `allowPromotionsOnRate === true`.
3. Contractual trade agreements (such as Reliance 43.76%) apply regardless of basis.

## 8. Files Created
1. `backend/alembic/versions/v1463_customer_pricing_basis_and_promotions_on_rate.py`
2. `src/tests/customerPricingBasisAndPromo.test.ts`
3. `scripts/test_headless_customer_pricing_basis.py`
4. `docs/walkthrough/crm/Customer_Billing_Basis_MRP_Vs_Rate_And_Promo_Governance_v6.34.0.md`
5. `docs/implementation/crm/Customer_Billing_Basis_MRP_Vs_Rate_And_Promo_Governance_Plan_v6.34.0.md`

## 9. Files Modified
1. `backend/app/models/crm.py`
2. `backend/app/schemas/crm.py`
3. `src/types.ts`
4. `src/services/custPolicyEngine.ts`
5. `src/services/customerStore.ts`
6. `src/components/customer/types.ts`
7. `src/components/customer/CustFormTab.tsx`
8. `src/components/customer/CustAddlDetTab.tsx`
9. `src/components/billing/propos/types.ts`
10. `src/components/billing/propos/CustBrowseDlg.tsx`
11. `src/services/smritiSalesPromotionService.ts`
12. `src/components/billing/propos/ProPosBillingTerm.tsx`
13. `docs/walkthrough/README.md`

## 10. Dependencies
- Alembic / SQLAlchemy for asynchronous schema migration and execution.
- Vitest for automated unit testing.
- Playwright Chromium for headless browser verification.

## 11. Risks
- **Double-Discounting:** Mitigated by defaulting `allow_promotions_on_rate` to `false`.
- **Legal Metrology Breach:** Mitigated by enforcing `(Rate + GST) <= MRP`.

## 12. Rollback Strategy
- Alembic downgrade to `v1462` drops columns `pricing_basis` and `allow_promotions_on_rate`.
- Frontend types and UI fall back gracefully to MRP defaults.

## 13. Verification Plan
- Unit tests validating policy resolution, promotion suppression, stacking authorization, and ceiling checks.
- Python compilation and TypeScript compile checks (`tsc --noEmit`).
- Production bundle build check (`vite build`).
- Headless Playwright automated verification with high-res screenshots.

## 14. Test Plan
- `src/tests/customerPricingBasisAndPromo.test.ts` (10 tests)
- `src/tests/smritiRelianceDiscountExclusivity.test.ts` (4 tests)
- `src/tests/smritiPromotionClawback.test.ts` (5 tests)

## 15. Documentation Impact
- Formal walkthrough created: `docs/walkthrough/crm/Customer_Billing_Basis_MRP_Vs_Rate_And_Promo_Governance_v6.34.0.md`.
- Master walkthrough index updated in `docs/walkthrough/README.md`.

## 16. Deployment Plan
1. Run Alembic migration `v1463` on all tenant databases.
2. Build frontend production bundle (`dist/`).
3. Deploy API and Web containers.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-CRM-001`: Explicit Customer Pricing Basis Specification
- `ADR-PROMO-002`: Default-Deny Wholesale Promotional Stacking
- `ADR-TAX-003`: Wholesale Tax-Exclusive Synchronization

## 19. Related Walkthroughs
- `docs/walkthrough/crm/Customer_Billing_Basis_MRP_Vs_Rate_And_Promo_Governance_v6.34.0.md`
