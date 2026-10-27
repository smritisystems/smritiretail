<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 1.1.0
  Created      : 2026-10-27
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Billing_PriceLevel_Remediation_Sprint_v1.1.0

## 1. Purpose
Execute Recommendations 4-12 of the SMRITI Price-Level Remediation Sprint.

## 2. Scope
Backend schemas, services, database migration, frontend types and UI, Z-report extension.

## 3. Files Created
- backend/alembic/versions/v1547_customers_pricing_basis_check.py (Rec 5)
- backend/app/tests/test_price_level_resolver.py (unit tests)
- docs/walkthrough/billing/Billing_PriceLevel_Remediation_Sprint_v1.1.0.md (this doc)

## 4. Files Modified
- backend/app/schemas/canonical_posting.py: Added cashier_price_level_override Literal field (Rec 6)
- backend/app/schemas/product_resolution.py: Added wholesale_price, price_book_price (Rec 8)
- backend/app/services/canonical_sales_writer.py: Section 0C authoritative enforcement + rule_snapshots audit (Rec 4, 6, 10)
- backend/app/services/product_resolution_service.py: All 4 SQL blocks — item_prices JOIN + wholesale_price/price_book_price (Rec 8)
- backend/app/services/pos.py: Z-report price_level_breakdown via rule_snapshots JSONB query (Rec 10)
- src/components/billing/types.ts: priceLevel, priceLevelSource on BillingLineItem (Rec 7)
- src/components/billing/BillingTerm.tsx: Badge stamping + cart row badge render (Rec 7)

## 5. Architecture Decisions
- item_prices is authoritative. pbe.selling_price is returned separately as price_book_price.
- Per-line PRICE_BOOK ceiling enforcement deferred (AD-2).
- rule_snapshots JSONB used for Z-report audit trail (no new column).

## 6. Design Rationale
Each recommendation closes a specific documented gap without creating a parallel pricing engine.

## 7. Implementation Summary
| Rec | Status |
|-----|--------|
| 4  | Done |
| 5  | Done |
| 6  | Done |
| 7  | Done |
| 8  | Done |
| 9  | Done - 0 duplicates, constraint verified |
| 10 | Done |
| 11 | Done - AGENTS_ADDENDUM absent, no action |
| 12 | Done |

## 8. Tests Executed
- test_billing_profile_lifecycle_and_precedence: 1 passed / 110.38s
- npx tsc --noEmit: exit 0, no errors
- py_compile 6 backend files: SYNTAX OK
- Migration v1547 py_compile: SYNTAX OK

## 9. Verification Results
Evidence 1 - git diff --stat: 9 files changed, 229 insertions, 48 deletions
Evidence 2 - customers.pricing_basis baseline: 1011 rows all MRP, no existing constraint
Evidence 3 - Duplicate invoice audit: 0 groups, uq_sales_invoices_company_invoice_no present
Evidence 4 - TypeScript: exit 0, stdout empty

## 10. Known Limitations
- PRICE_BOOK per-line ceiling not enforced server-side in 0C (frontend only).
- Z-report price_level_breakdown shows UNKNOWN for pre-sprint invoices.
- wholesale_price 0.00 means not configured, not free.

## 11. Future Work
- Add per-line PRICE_BOOK server-side validation.
- Expose wholesale_price in barcode scan API response.
- Backfill historical invoices rule_snapshots.
- Persist priceLevel badge in suspended bill recall.

## 12. Related ADRs
- ADR-BILLING-001, ADR-PRICING-001

## 13. Related RFCs
- RFC-SMRITI-PRICE-REMEDIATION-SPRINT
