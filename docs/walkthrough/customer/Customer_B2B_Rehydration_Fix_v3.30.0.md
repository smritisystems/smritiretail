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

# Customer B2B Re-hydration Fix -- Walkthrough v3.30.0

**Commit:** `6aac3be8`
**Branch:** `smritiNX`
**Date:** 2026-09-02
**Author:** Jawahar Ramkripal Mallah

---

## 1. Purpose

Fix four confirmed UAT regressions. After a Corporate / B2B customer was saved and reloaded from the backend, the UI reverted to Retail classification. Additionally, a hardcoded dummy mobile number caused 400 Bad Request errors for new records, and two FastAPI routing issues (307 redirect on /products, 404 on /variants) were blocking universal browse flows.

## 2. Scope

| Area | Severity | Fix Applied |
|------|----------|-------------|
| Customer Master B2B re-hydration regression | P0 | mapBackendCustomerToRecord() - deterministic derivation from customer_group_id and tags |
| Customer Master duplicate mobile 400 Bad Request | P1 | DEFAULT_MAILING_ADDRESS.mobilePhone = "" |
| Inventory API 307 ERR_NAME_NOT_RESOLVED on /products | P1 | @router.get("") added alongside "/" variant |
| F2 Universal Browse 404 on /variants | P1 | inventory.router mounted at /api/v1/variants |

## 3. Files Created

- src/tests/customerRehydration.test.ts - Unit test suite (TEST A-E)
- docs/walkthrough/customer/Customer_B2B_Rehydration_Fix_v3.30.0.md - This document
- docs/implementation/customer/Customer_B2B_Rehydration_Fix_Plan_v3.30.0.md - Implementation plan

## 4. Files Modified

- src/components/customer/CustMasterWs.tsx - mapBackendCustomerToRecord() rewrite, mobile fix, HREP error, cache sync
- src/components/customer/CustFormTab.tsx - Bidirectional Price Group <-> Customer Type cascade
- backend/app/api/v1/inventory.py - Empty-path decorators, page_size max 500
- backend/app/main.py - /api/v1/variants mount

## 5. Architecture Decisions

1. No schema mutation: PostgreSQL customers table not modified.
2. Classification hierarchy: customer_group_id is primary signal; tags provides corroboration.
3. Dual-path FastAPI routing: Both @router.get("") and @router.get("/") registered on root endpoints.
4. Single router re-mount: inventory.router reused at /api/v1/variants.

## 6. Design Rationale

Root cause was mapBackendCustomerToRecord() assuming backend returns a raw environment string field. PostgreSQL does not store this field. Classification is now derived from customer_group_id and tags, making it survive every backend round-trip without schema changes.

## 7. Implementation Summary

- Phase 1: Root cause diagnosis - traced to environment: bCust.environment || "Retail"
- Phase 2: Backend fix - empty-path decorators, /variants mount
- Phase 3: Frontend fix - classification derivation rewrite, mobile clear, cascade, HREP
- Phase 4: Testing - Vitest 617/617 green, build 0 errors, Docker rebuild, headless UAT 8/8

## 8. Tests Executed

| Suite | Result |
|-------|--------|
| Vitest (617 tests) | 617/617 green, 0 failures |
| Vite production build | 3526 modules, 0 errors |
| Docker rebuild | 4/4 containers healthy |
| Headless Playwright UAT | 8/8 steps pass, exit code 0 |

## 9. Verification Results

### Headless UAT Terminal Output (exit code 0)

```
RETAIL BASELINE ASSERTIONS (RECORD 2): ALL PASS
  Customer Name: Walk-In / Cash Customer
  Header: CUSTOMER CATALOGUE (RETAIL)
  Environment: Environment: Retail

BEFORE SAVE ASSERTIONS: ALL PASS
  Header: CUSTOMER CATALOGUE (CORPORATE)
  Environment: Environment: Corporate

AFTER SAVE / RE-HYDRATION ASSERTIONS: ALL PASS
  Header: CUSTOMER CATALOGUE (CORPORATE)
  Environment: Environment: Corporate

CLASSIFICATION SWITCHING CHECKS: ALL PASS
  Retail: Walk-In / Cash Customer -> CUSTOMER CATALOGUE (RETAIL)
  Corporate: Jawahar -> CUSTOMER CATALOGUE (CORPORATE)

ALL HEADLESS VALIDATION STEPS PASSED SUCCESSFULLY (100% GREEN)
```

### Status

| Check | Status |
|-------|--------|
| B2B Corporate re-hydration after PostgreSQL round-trip | Done |
| Retail baseline unaffected | Done |
| Classification switching across records | Done |
| Duplicate mobile 400 eliminated | Done |
| /products 307 ERR_NAME_NOT_RESOLVED eliminated | Done |
| /variants 404 eliminated | Done |
| 617/617 Vitest tests green | Done |
| 0 production build errors | Done |
| Docker stack healthy | Done |

## 10. Known Limitations

- DEFAULT_MAILING_ADDRESS.email1 placeholder remains - separate UX ticket.
- Typo gr.code vs grp.code in CustFormTab.tsx line 165 modal path - non-blocking, follow-up ticket.

## 11. Future Work

- Remove remaining placeholder defaults from DEFAULT_MAILING_ADDRESS.
- Fix typo gr.code -> grp.code in CustFormTab.tsx line 165.
- Add Playwright E2E test for duplicate mobile rejection flow.
- Add Playwright E2E test for VIP and Wholesale re-hydration.

## 12. Related ADRs

- ADR-001: FastAPI + PostgreSQL as sole backend system of record.
- ADR-009: Frontend-derived UI presentation fields not stored in the database.

## 13. Related RFCs

- RFC-CRM-001: Customer Classification and Environment Derivation Policy.
