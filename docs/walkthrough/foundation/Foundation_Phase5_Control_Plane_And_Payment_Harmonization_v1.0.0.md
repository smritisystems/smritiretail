<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough (WGP)
-->

# Walkthrough: SMRITI Retail OS — Phase 5 Control Plane Navigation & Payment Mode Harmonization

**Walkthrough ID:** `WGP-FOUNDATION-P5-v1.0.0`  
**Area:** Foundation, UI Navigation Control Plane & Payment Mode Governance  
**Status:** Completed  

---

## 1. Purpose
This walkthrough details the design, implementation, and test verification for Phase 5 of the SMRITI Forensic Hardening Roadmap. It completes the resolution of the Master Forensic Audit (68 findings) by addressing payment mode contract casing discrepancies (`FND-052`), integrating the Fiori Launchpad with the centralized PostgreSQL control plane menu resolver (`FND-060`), and finalizing the governance certification of invariant ORM table defaults and hardware standards.

---

## 2. Scope
- **Payment Mode Normalization (`FND-052`)**:
  - Defined `CANONICAL_PAYMENT_MODES` (`CASH`, `CARD`, `UPI`, `CHEQUE`, `BANK_TRANSFER`, `CREDIT_NOTE`, `SPLIT`, `CREDIT`, `ON_ACCOUNT`, `STORE_CREDIT`, `WALLET`, `LOYALTY`, `GIFT_VOUCHER`).
  - Added pure bidirectional normalizer `toCanonicalPaymentMode()`.
  - Harmonized `PaymentMode` type union and updated `BillingTerm.tsx` settlement serialization.
- **Fiori Launchpad Dynamic Control Plane Integration (`FND-060`)**:
  - Implemented asynchronous menu query against `/api/v1/menus/resolved` on launchpad mount.
  - Implemented `synthesizeLaunchpadCatalogWithRemoteMenus()` to merge database-driven modules with local tiles while preserving offline POS resilience.
  - Added visual `Control Plane Synced` status indicator in the Hero Operational Banner.
- **Master Forensic Audit Finalization**:
  - Certified all 68 audit findings across Phase 0 through 5.

---

## 3. Files Created
1. `docs/implementation/foundation/Foundation_Phase5_Control_Plane_And_Payment_Harmonization_Plan_v1.0.0.md`
2. `docs/walkthrough/foundation/Foundation_Phase5_Control_Plane_And_Payment_Harmonization_v1.0.0.md`
3. `src/tests/paymentModeHarmonization.test.ts`

---

## 4. Files Modified
1. `src/components/billing/types.ts`
2. `src/components/billing/BillingTerm.tsx`
3. `src/components/launchpad/launchpadCatalog.ts`
4. `src/components/launchpad/FioriLaunchpad.tsx`
5. `docs/implementation/README.md`
6. `docs/walkthrough/README.md`
7. `CHANGELOG.md`

---

## 5. Architecture Decisions
- **Tender Code Canonicalization**: All client settlement pipelines and backend validators converge upon uppercase canonical tender codes (`CASH`, `CARD`, `UPI`, `CHEQUE`, `BANK_TRANSFER`, `CREDIT_NOTE`, `SPLIT`, `CREDIT`, `ON_ACCOUNT`, `STORE_CREDIT`, `WALLET`, `LOYALTY`, `GIFT_VOUCHER`). Legacy human-readable display strings ("Credit Card", "Debit Card", etc.) are mapped predictably to `"CARD"` without runtime failures.
- **Hybrid Launchpad Resilience**: The launchpad resolves dynamic modules from `/api/v1/menus/resolved` (which evaluates User -> TenantContext -> Role -> permissions -> cascade pruning), but gracefully falls back to `LAUNCHPAD_CATALOG` when offline, guaranteeing high-speed billing terminals continue unhindered during network partitions.

---

## 6. Design Rationale
- **Zero Breakage of Existing Views**: By expanding `PaymentMode = LegacyPaymentModeDisplay | CanonicalPaymentMode`, existing React components expecting display labels continue compiling and functioning without regression, while new submissions use `toCanonicalPaymentMode()`.
- **Preservation of Offline POS Terminals**: In industrial retail environments, POS stations frequently operate with intermittent connectivity. Requiring synchronous network calls before rendering the launchpad would violate retail resilience principles; synthesizing remote menus onto the local catalog provides the ideal balance of dynamic control plane power and offline continuity.

---

## 7. Implementation Summary
1. **`src/components/billing/types.ts`**:
   - Exported `CANONICAL_PAYMENT_MODES` and `CanonicalPaymentMode`.
   - Expanded `PaymentMode` to accept both legacy display strings and canonical uppercase tokens.
   - Implemented `toCanonicalPaymentMode()` supporting banking aliases (`NEFT`, `RTGS`, `IMPS`, `CHECK`, `CN`, `DUE`, etc.).
2. **`src/components/billing/BillingTerm.tsx`**:
   - Updated `handleCompleteSettlement` to serialize `payment_mode` via `toCanonicalPaymentMode(payments[0]?.mode)`.
3. **`src/components/launchpad/launchpadCatalog.ts`**:
   - Extended `getVisibleLaunchpadTiles()` and `getQuickActionTiles()` to accept an optional `catalog` argument with default fallback.
   - Added `mapModuleToGroup()` to map backend modules to Fiori Launchpad tile groups.
   - Added `synthesizeLaunchpadCatalogWithRemoteMenus()` to merge remote database menus with local catalog tiles.
4. **`src/components/launchpad/FioriLaunchpad.tsx`**:
   - Added async mount hook querying `/api/v1/menus/resolved` via `apiFetchV1`.
   - Dynamically synthesized active catalog and added `Control Plane Synced` badge.
5. **`src/tests/paymentModeHarmonization.test.ts`**:
   - Created Vitest suite testing tender normalization, alias handling, empty/null fallbacks, remote catalog synthesis, and role-based filtering.

---

## 8. Tests Executed
1. **Payment Mode Normalization & Launchpad Synthesis Suite**:
   - `npx vitest run src/tests/paymentModeHarmonization.test.ts` (9 tests passed).
2. **TypeScript Compilation Check**:
   - `npx tsc --noEmit` (Exited 0 with zero errors).
3. **Pytest Operational Suite**:
   - `pytest backend/app/tests/test_phase4_operational_daemons_and_media.py` (6 tests passed).

---

## 9. Verification Results
- **Vitest**: 9/9 passed in 8ms (paymentModeHarmonization.test.ts).
- **TypeScript**: Clean compilation (`tsc --noEmit` code 0).
- **Pytest**: 6/6 passed in 1.45s (`test_phase4_operational_daemons_and_media.py`).

---

## 10. Known Limitations
- Custom user-created launchpad layouts stored in browser localStorage do not currently override backend-assigned menu sequences.

---

## 11. Future Work
- Integration with user personal bookmarks and pinboards in Fiori Launchpad v6.3.

---

## 12. Related ADRs
- `ADR-008`: FastAPI Sole Backend System-of-Record Architecture.
- `ADR-012`: Canonical Multi-Tender Payment Normalization & Financial Ledger Accounting.

---

## 13. Related RFCs
- `RFC-2026-FND-005`: Control Plane Dynamic Menu Resolution & Unified Fiori Launchpad Catalog.
