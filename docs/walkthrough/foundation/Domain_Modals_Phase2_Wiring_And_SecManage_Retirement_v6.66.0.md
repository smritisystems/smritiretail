<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.66.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Domain Modals Phase 2 Wiring & SecManage Retirement v6.66.0

## 1. Purpose
This walkthrough details Phase 2 of pending UX remediation: mounting five high-value domain calculation modals into their respective parent workspaces (`CrmStudioTab`, `BillingWorkspace`, `SmritiSalesPromotionsStudio`), formally deprecating the legacy security dialog (`SecManageDlg`), and synchronizing the application version SSOT to `v6.66.0`.

## 2. Scope
- **CRM Studio Workspace (`CrmStudioTab.tsx`):**
  - Integrated `ComplaintCRMModal.tsx` for service ticket logging, SLA tracking, and resolution with header button `#crm-studio-complaints-btn`.
  - Integrated `LoyaltyLedgerModal.tsx` for customer loyalty points transaction audit trails with header button `#crm-studio-loyalty-ledger-btn`.
- **POS Billing Workspace (`BillingWorkspace.tsx`):**
  - Integrated `GiftCardLifecycleModal.tsx` for gift card issuance, balance inquiry, and top-ups with header button `#pos-gift-cards-btn`.
  - Integrated `GiftVoucherModal.tsx` for promo voucher lookup and checkout redemptions with header button `#pos-gift-vouchers-btn`.
- **Sales Promotions & Schemes Studio (`SmritiSalesPromotionsStudio.tsx`):**
  - Integrated `PricingStudioModal.tsx` for interactive dynamic pricing simulation, tier-based rate checks, and stackable coupon tests with header button `#promotions-pricing-studio-btn`.
- **Legacy Security Dialog (`SecManageDlg.tsx`):**
  - Annotated with `@deprecated` in JSDoc referencing canonical full-page `SecurityAccessShell.tsx`.
  - Added visual in-dialog amber alert banner signaling deprecation status.
- **Audit Script Hardening (`scripts/audit_pending_ux.py`):**
  - Upgraded component detection to use regex AST matching exported identifiers (`export (default)? (const|function|class) <Name>`) instead of assuming component name matches filename.
  - Excluded test files (`src/tests/`) from the reference graph to prevent test-only imports from masquerading as UI mountings.
- **Version SSOT Synchronization:**
  - Synchronized `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, and `CHANGELOG.md` to `6.66.0`.

## 3. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_Plan_v6.66.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_v6.66.0.md`

## 4. Files Modified
- `src/components/CrmStudioTab.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/promotions/SmritiSalesPromotionsStudio.tsx`
- `src/components/security/SecManageDlg.tsx`
- `scripts/audit_pending_ux.py`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Header Action Palette Integration:** Rather than nesting secondary tools inside dropdown menus, modals are surfaced directly on the action bars of their respective domain studios (`CrmStudioTab`, `BillingWorkspace`, `SmritiSalesPromotionsStudio`).
2. **Non-Destructive Deprecation Pattern:** `SecManageDlg.tsx` is retained in the source tree to preserve backward compatibility for legacy tests, but is clearly tagged with `@deprecated` and an in-app notice directing operators and developers to `SecurityAccessShell.tsx`.
3. **AST-Driven Export Extraction in Audits:** `scripts/audit_pending_ux.py` parses actual TypeScript export identifiers, preventing false positives where components were imported under alias or where the export name differed from the file stem.

## 6. Design Rationale
- Cashiers at POS billing counters frequently need to issue, top up, or redeem store gift cards and promo vouchers without navigating away from active billing tickets.
- CRM personnel managing customer loyalty accounts need immediate access to customer complaint records and granular ledger point audits.
- Merchandisers creating promotion schemes require an interactive dynamic pricing sandbox to simulate rule outcomes across customer tiers and coupons before publishing schemes live.

## 7. Implementation Summary
- **CRM Complaints:** Mounted `<ComplaintCRMModal isOpen={showComplaintsModal} onClose={() => setShowComplaintsModal(false)} />` inside `CrmStudioTab.tsx`.
- **CRM Points Ledger:** Mounted `<LoyaltyLedgerModal isOpen={showLoyaltyLedgerModal} onClose={() => setShowLoyaltyLedgerModal(false)} />` inside `CrmStudioTab.tsx`.
- **POS Gift Cards:** Mounted `<GiftCardLifecycleModal isOpen={showGiftCardsModal} onClose={() => setShowGiftCardsModal(false)} onNotification={...} />` inside `BillingWorkspace.tsx`.
- **POS Vouchers:** Mounted `<GiftVoucherModal isOpen={showVouchersModal} onClose={() => setShowVouchersModal(false)} onNotification={...} />` inside `BillingWorkspace.tsx`.
- **Promotions Pricing Studio:** Mounted `<PricingStudioModal isOpen={showPricingStudioModal} onClose={() => setShowPricingStudioModal(false)} onNotification={onNotification} />` inside `SmritiSalesPromotionsStudio.tsx`.
- **SecManage Dialog:** Added top-edge amber alert banner and updated header JSDoc.

## 8. Tests Executed
1. **TypeScript Typecheck:**
   - Command: `npx tsc --noEmit`
   - Output: Exited with code 0 (0 errors).
2. **Vitest Unit Test Suites:**
   - Command: `npx vitest run src/tests/proposSupervisorAuth.test.ts src/tests/complaintCRMEngine.test.ts src/tests/dynamicPricingEngine.test.ts`
   - Output: 3 test files passed, 12/12 tests green (498ms).
3. **Pending UX Audit:**
   - Command: `.venv\Scripts\python.exe scripts/audit_pending_ux.py`
   - Output: All 5 modals transitioned from `Import-Only` to `Rendered`.
4. **Version SSOT Validator:**
   - Command: `.venv\Scripts\python.exe scripts/validate_version_ssot.py`
   - Output: Exited with code 0 (all 4 files synchronized to `6.66.0`).

## 9. Verification Results
| Verification Item | Command | Status | Result |
|---|---|---|---|
| TypeScript Compilation | `npx tsc --noEmit` | Done | 0 errors |
| POS & Auth Vitest Suite | `npx vitest run src/tests/proposSupervisorAuth.test.ts` | Done | 4/4 passed |
| CRM Engine Vitest Suite | `npx vitest run src/tests/complaintCRMEngine.test.ts` | Done | 4/4 passed |
| Dynamic Pricing Vitest Suite | `npx vitest run src/tests/dynamicPricingEngine.test.ts` | Done | 4/4 passed |
| UX Audit Registry | `.venv\Scripts\python.exe scripts/audit_pending_ux.py` | Done | 5 modals rendered |
| Version SSOT Parity | `.venv\Scripts\python.exe scripts/validate_version_ssot.py` | Done | 100% matched at 6.66.0 |

## 10. Known Limitations
- The rendered modals use rich client-side calculation engines and mock data fixtures. Phase 3 of UX remediation will wire them to authoritative Postgres endpoints where applicable.
- `SecManageDlg.tsx` remains on disk and will be candidates for eventual deletion once all test references are transitioned to `SecurityAccessShell.tsx`.

## 11. Future Work
- Connect `ComplaintCRMModal` to a dedicated `crm_complaints` PostgreSQL table and FastAPI CRUD router.
- Connect `GiftCardLifecycleModal` and `GiftVoucherModal` to central voucher ledger endpoints in `backend/app/api/v1/pos.py`.
- Connect `PricingStudioModal` to the backend promotional pricing engine.

## 12. Related ADRs
- `ADR-PROMO-01`: SMRITI Sales Promotion & Pricing Scheme Visual Rule Builder Architecture
- `ADR-RBAC-01`: SMRITI Security & Access Control Shell

## 13. Related RFCs
- `RFC-2026-UX-01`: Systematic Frontend Pending Interfaces Audit & Remediation
