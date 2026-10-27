<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-27
  Modified     : 2026-10-27
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Billing Price Level Resolution & Enforcement v1.0.0

## 1. Purpose
Implement a governed, end-to-end Billing Price Level system. Resolve and enforce which
stored price field (mrp, selling_price, wholesale_price, or price_book_price) is used
as the default unit rate when adding items to an invoice.

## 2. Scope
| Component | Scope |
|---|---|
| billing_profile_service.py | default_price_level + cashier_price_override defaults, validator, resolve_effective_price_level() |
| canonical_sales_writer.py | Section 0C - resolve + enforce MRP ceiling per line |
| BillingProfileConfigModal.tsx | Price Level Policy card in Feature Overrides |
| BillingTerm.tsx | 3-tier scan line rate resolver |

## 3. Files Created
None. All changes are to existing files.

## 4. Files Modified
| File | Lines |
|---|---|
| backend/app/services/billing_profile_service.py | +94 |
| backend/app/services/canonical_sales_writer.py | +64 |
| src/components/billing/modals/BillingProfileConfigModal.tsx | +109 |
| src/components/billing/BillingTerm.tsx | +77 |

## 5. Architecture Decisions
- AD-1: No new DB column. Customer.pricing_basis (MRP|RATE) reused; RATE maps to SELLING_PRICE.
- AD-2: Statutory MRP ceiling is absolute and independent of price level or override policy.
- AD-3: PRICE_BOOK level defers DB resolution to the barcode resolver (price_book_price field).
- AD-4: resolve_effective_price_level() is a pure static method - no async, no DB, instantly testable.
- AD-5: cashier_price_override defaults DISABLED (B2C) and ALLOWED (B2B).

## 6. Design Rationale
3-Tier Precedence Hierarchy:
  Tier 1 - Company Policy: billing_configuration["default_price_level"]
  Tier 2 - Customer Profile: Customer.pricing_basis (RATE->SELLING_PRICE, MRP->MRP)
  Tier 3 - Cashier Override: entryRateNum > 0 AND cashier_price_override != DISABLED

## 7. Implementation Summary
Phase 3A: billing_profile_service.py - defaults, validator entries, resolve_effective_price_level()
Phase 3B: canonical_sales_writer.py - section 0C: resolve + MRP ceiling (SMRITI-PRICE-MRP-001)
Phase 4a: BillingProfileConfigModal.tsx - Price Level Policy card, state, payload
Phase 4b: BillingTerm.tsx - type extension, 3-tier scan resolver, improved MRP ceiling message

## 8. Tests Executed
| Test | Result |
|---|---|
| resolve_effective_price_level unit tests (12 cases) | 12/12 PASS |
| test_billing_profile_lifecycle_and_precedence | 1/1 PASS |
| tsc --noEmit | exit 0, 0 errors |

## 9. Verification Results
Commit: 027f4937 | 4 files changed, 317 insertions(+), 4 deletions(-)
All 12 unit tests pass. Existing integration test passes. TypeScript clean.
Statutory MRP ceiling enforced at both frontend scan entry and backend posting.

## 10. Known Limitations
- L-1: Section 0C does not DB-lookup authoritative price per line (only MRP ceiling enforced).
- L-2: Customer.pricing_basis only supports MRP|RATE in current schema.
- L-3: PRICE_BOOK requires barcode resolver to populate price_book_price on matched item.
- L-4: cashier_price_level_override not yet a typed field in SalesInvoiceCreate.context.

## 11. Future Work
- Add price_level_override column to customers/customer_policies (Alembic migration).
- Add per-line ItemPrice DB lookup in section 0C for strict field-level enforcement.
- Add cashier_price_level_override to SalesInvoiceCreate.context schema.
- Surface resolved price level source as a UI badge on billing line items.

## 12. Related ADRs
- ADR-BILLING-001, ADR-BILLING-002, ADR-PRICING-001

## 13. Related RFCs
- RFC-PRICING-001: Billing Price Level Resolution Design
- RFC-CUSTOMER-002: Customer pricing_basis field extension
