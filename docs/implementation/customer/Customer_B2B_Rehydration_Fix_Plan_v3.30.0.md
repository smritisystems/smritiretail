<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Customer B2B Re-hydration Fix v3.30.0

**Status:** Completed
**Commit:** 6aac3be8
**Date:** 2026-09-02

---

## 1. Objective

Fix P0 UAT regression: B2B Corporate environment reverts to Retail after PostgreSQL backend save + re-hydration. Fix three concurrent P1 blockers identified in the same session.

## 2. Business Motivation

B2B Corporate customers incorrectly appear in the Retail catalogue after record save. This directly impacts price group application, invoice generation classification, and customer-facing service tier. The regression was silently introduced when the environment field was removed from the schema.

## 3. Scope

- CustMasterWs.tsx: mapBackendCustomerToRecord() derivation fix
- CustMasterWs.tsx: DEFAULT_MAILING_ADDRESS.mobilePhone hardcode removal
- CustMasterWs.tsx: HREP duplicate mobile error translation
- CustMasterWs.tsx: localStorage cache synchronisation
- CustFormTab.tsx: Bidirectional Price Group <-> Customer Type cascade
- inventory.py: Empty-path route decorators, page_size limit raised
- main.py: /api/v1/variants route mount
- customerRehydration.test.ts: Unit test suite

## 4. Current State

Before fix: mapBackendCustomerToRecord() used environment: bCust.environment || "Retail".
PostgreSQL never returns an environment field. All customers were being classified as Retail on re-hydration regardless of their stored customer_group_id or tags.

## 5. Gap Analysis

| Gap | Impact |
|-----|--------|
| No environment derivation from customer_group_id | P0 - Corporate customers revert to Retail |
| Hardcoded dummy mobile | P1 - New records fail with 400 duplicate mobile |
| FastAPI single-path decorator on / | P1 - 307 redirect to internal Docker hostname |
| No /variants route | P1 - 404 on Gate-11E F2 browse |

## 6. Architecture Impact

- No database schema changes.
- Frontend classification derivation made deterministic and stateless.
- Backend gains additional route aliases - no breaking changes.

## 7. Proposed Design

Derive environment from customer_group_id (primary) and tags (secondary) in mapBackendCustomerToRecord(). Explicit backend customer_type/environment/price_group fields (if present) take precedence via short-circuit evaluation.

## 8. Files Created

- src/tests/customerRehydration.test.ts

## 9. Files Modified

- src/components/customer/CustMasterWs.tsx
- src/components/customer/CustFormTab.tsx
- backend/app/api/v1/inventory.py
- backend/app/main.py

## 10. Dependencies

- Playwright (Python) for headless UAT verification
- Vitest for unit test suite
- Docker Compose for integration stack

## 11. Risks

- LOW: Re-mounting inventory.router at /variants means any future change to inventory.py affects both /products and /variants endpoints.

## 12. Rollback Strategy

git revert 6aac3be8 - reverts all 5 files atomically. No database migration required.

## 13. Verification Plan

- Headless Playwright UAT: 8 assertion steps covering Retail baseline, B2B before-save, B2B after re-hydration, classification switching.
- Vitest unit tests: 5 scenarios (TEST A-E).
- Production build verification.
- Docker health check.

## 14. Test Plan

| Test | Type | Result |
|------|------|--------|
| TEST A: Corporate CG-Corporate + tags | Unit | Pass |
| TEST B: Explicit backend fields preserved | Unit | Pass |
| TEST C: Retail standard customer | Unit | Pass |
| TEST D: VIP CG-LargeRetail | Unit | Pass |
| TEST E: Empty/partial payload fallback | Unit | Pass |
| Headless UAT 8 steps | Integration | Pass |
| Full Vitest suite 617 tests | Integration | Pass |

## 15. Documentation Impact

- Walkthrough: docs/walkthrough/customer/Customer_B2B_Rehydration_Fix_v3.30.0.md
- CHANGELOG: Updated
- Implementation Index: Updated

## 16. Deployment Plan

1. git push from smritiNX branch
2. git pull on F:\Smriti9 test environment
3. docker compose up -d --build on test environment
4. Manual smoke test on http://localhost:3000

## 17. Status

Completed - 2026-09-02. Commit: 6aac3be8. All verification gates passed.

## 18. Related ADRs

- ADR-001: FastAPI + PostgreSQL sole backend
- ADR-009: Frontend-derived presentation fields

## 19. Related Walkthroughs

- docs/walkthrough/customer/Customer_B2B_Rehydration_Fix_v3.30.0.md
