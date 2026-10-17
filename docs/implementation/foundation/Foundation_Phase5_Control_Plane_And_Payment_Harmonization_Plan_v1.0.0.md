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
  Classification: Canonical Implementation Plan (IPGP)
-->

# Implementation Plan: SMRITI Retail OS — Phase 5 Control Plane Navigation & Payment Mode Harmonization

**Plan ID:** `IPGP-FOUNDATION-P5-v1.0.0`  
**Area:** Foundation, UI Navigation Control Plane, Fiori Launchpad & Payment Mode Governance  
**Status:** Completed  

---

## 1. Objective
Achieve complete closure of the Master Forensic Audit by addressing the remaining architectural findings: harmonizing divergent Payment Mode representations (`FND-052`), integrating Fiori Launchpad tile resolution with backend navigation menus (`FND-060`), and finalizing governance classification for invariant ORM model defaults and hardware standards (`FND-011`, `FND-012`, `FND-028`, `FND-054`, `FND-058`, `FND-059`, `FND-062`, `FND-063`, `FND-064`, `FND-065`, `FND-068`).

---

## 2. Business Motivation
In multi-tender retail POS transactions and billing settlements, inconsistencies between client casing (e.g. "Cash", "Credit Card") and backend database tender codes (e.g. "CASH", "CARD") risk settlement mismatches and require redundant ad-hoc uppercase conversions. Furthermore, enterprise control plane menus should allow dynamic navigation injection from the database (`smriti_menus`) while ensuring offline POS terminals always load standard operational tiles seamlessly.

---

## 3. Scope
- **Cluster A: Payment Mode Enum & Tender Harmonization (`FND-052`)**:
  - Define `CANONICAL_PAYMENT_MODES` and `CanonicalPaymentMode` contract in `src/components/billing/types.ts`.
  - Implement bidirectional normalization helper `toCanonicalPaymentMode()`.
  - Expand `PaymentMode` union to support both canonical uppercase codes and display strings.
- **Cluster B: Fiori Launchpad & Dynamic Menu Integration (`FND-060`)**:
  - Connect `FioriLaunchpad.tsx` to asynchronous menu resolution (`/api/v1/menus/resolved`) with resilient fallback to `LAUNCHPAD_CATALOG`.
- **Cluster C: Comprehensive Forensic Audit Governance Finalization**:
  - Formally certify and classify all remaining 68 audit findings across Phase 0, 1, 2, 3, 4, and 5.

---

## 4. Current State
- `src/components/billing/types.ts` defines `PaymentMode` exclusively with mixed-case display strings (`"Cash" | "Credit Card" | ...`).
- `src/components/launchpad/FioriLaunchpad.tsx` relies statically on `LAUNCHPAD_CATALOG` in `launchpadCatalog.ts` without backend menu synchronization.
- Forensic audit findings `FND-058` to `FND-068` require formal status registration.

---

## 5. Gap Analysis
- **Tender Mode Casing Drift**: Frontend tender selections must be manually mapped or risked silent rejection by backend validators expecting `"CARD"` or `"UPI"`.
- **Launchpad Static Inflexibility**: New modules added to `smriti_menus` in the database are not visible in the launchpad until a frontend code deployment occurs.

---

## 6. Architecture Impact
- Standardizes all payment modes to authoritative uppercase enum codes (`CASH`, `CARD`, `UPI`, `CHEQUE`, `CREDIT_NOTE`, `SPLIT`, `CREDIT`, `ON_ACCOUNT`, `BANK_TRANSFER`).
- Bridges the Fiori Launchpad with the Control Plane Menu Registry (`smriti_menus`).

---

## 7. Proposed Design
1. **Canonical Payment Mode Contract**:
   - In `types.ts`, define `CANONICAL_PAYMENT_MODES` array and `CanonicalPaymentMode` type.
   - Implement `toCanonicalPaymentMode(mode: string | PaymentMode): CanonicalPaymentMode`.
2. **Asynchronous Launchpad Tile Sync**:
   - In `FioriLaunchpad.tsx`, asynchronously fetch `/api/v1/menus/resolved` on mount when connected. Merge remote menus with local catalog tiles, ensuring quick-actions and icons remain functional offline.

---

## 8. Files Created
1. `docs/implementation/foundation/Foundation_Phase5_Control_Plane_And_Payment_Harmonization_Plan_v1.0.0.md`
2. `src/tests/paymentModeHarmonization.test.ts`

---

## 9. Files Modified
1. `src/components/billing/types.ts`
2. `src/components/launchpad/FioriLaunchpad.tsx`
3. `docs/implementation/README.md`
4. `docs/walkthrough/README.md`
5. `CHANGELOG.md`

---

## 10. Dependencies
- Control Plane Menu Resolver in `backend/app/api/v1/menus.py` (`/api/v1/menus/resolved`)
- `apiFetchV1` helper in `src/lib/apiFetchV1.ts`

---

## 11. Risks
- Risk: Network failure during launchpad load when attempting to fetch menus.
  - Mitigation: Silent fallback to local static `LAUNCHPAD_CATALOG` preserves full offline functionality.

---

## 12. Rollback Strategy
Revertible via Git rollback without database schema migration impacts.

---

## 13. Verification Plan
- Unit tests verifying `toCanonicalPaymentMode` maps all standard and legacy strings to canonical uppercase codes.
- Vitest execution for payment harmonization and launchpad rendering.
- `npx tsc --noEmit` clean compile.

---

## 14. Test Plan
- Run `npx vitest run src/tests/paymentModeHarmonization.test.ts`.
- Run full Vitest regression.
- Run `npx tsc --noEmit`.

---

## 15. Documentation Impact
- Create `docs/walkthrough/foundation/Foundation_Phase5_Control_Plane_And_Payment_Harmonization_v1.0.0.md`.
- Update master indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Included in next regular SMRITI Retail OS release.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-051`: Multi-Tenant Seller Identity Strictness.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Phase5_Control_Plane_And_Payment_Harmonization_v1.0.0.md`
