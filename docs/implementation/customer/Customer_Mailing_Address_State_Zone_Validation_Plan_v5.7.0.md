<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.7.0
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Customer Mailing Address Postal Code, State and Commercial Zone Cross-Validation v5.7.0

**Status:** Completed  
**Date:** 2026-10-25  
**Area:** CRM & Customer Master / Reference Architecture  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Objective

Integrate authoritative commercial zone resolution and cross-location validation between Postal Code (PIN), State, and Commercial Zone in both the Customer Mailing Address Sub-form (`CustMailingDlg.tsx`) and the backend Control-Plane reference services (`localization_svc.py`, `localization.py`).

## 2. Business Motivation

1. In retail and enterprise B2B delivery logistics, commercial zones (North, South, East, West, Central, North East) dictate sales routing, freight rate calculations, regional tax office routing, and distribution hub assignment.
2. Previously, entering a postal code (e.g. 400067 in Mumbai, Maharashtra) did not populate or update the commercial zone, leaving the sub-form with contradictory default combinations (e.g., State: "Maharashtra" with Zone: "North").
3. Furthermore, entering unallocated postal codes (e.g., 400000) triggered silent 404 unhandled network errors without offering end-user feedback, and changing state manually failed to synchronize the commercial zone.

## 3. Scope

- `src/constants/indianStates.ts`: Define standard `IndianCommercialZone`, `INDIAN_ZONES` catalog, `INDIAN_STATE_TO_ZONE`, `INDIAN_STATE_CODE_TO_ZONE`, and `resolveZoneFromState` resolution helper.
- `src/components/customer/CustMailingDlg.tsx`: Auto-populate state and zone on postal code resolution; auto-align zone on state selection; cross-validate postal code against selected state; surface inline feedback (verified, mismatch, unallocated).
- `backend/app/schemas/localization.py`: Add `zone: Optional[str] = None` to `PostalCodeResponse`.
- `backend/app/services/localization_svc.py`: Add `INDIAN_STATE_CODE_TO_ZONE`; populate `pin_ref.zone` on lookups; update `validate_postal_location` with cross-state and zone mismatch detection.
- `backend/app/api/v1/localization.py`: Add `zone` parameter to `/postal-codes/{postal_code}/validate` endpoint.
- `src/tests/customerMailingLocationValidation.test.ts`: Frontend test suite for state and zone validation.
- `backend/app/tests/test_postal_code_zone_validation.py`: Backend integration and service test suite.

## 4. Current State

- `CustMailingDlg.tsx` resolved `city`, `state`, and `locality` on PIN entry, but left `zone` untouched.
- `CustMailingDlg.tsx` changed `city` on state change, but did not update `zone`.
- `backend/app/services/localization_svc.py` did not include `zone` in `PostalCodeResponse`.
- `validate_postal_location` searched by `state_code` in the SQL `WHERE` clause, reporting `NOT_FOUND` on state mismatches rather than diagnosing the conflicting state.

## 5. Gap Analysis

| Feature / Behavior | Pre-Fix Behavior | Implemented Behavior |
|---|---|---|
| PIN selection zone resolution | Zone left as empty or stale default | Zone automatically resolves (e.g. 400067 -> West) |
| State selection zone alignment | Zone left untouched | Zone automatically syncs (e.g. UP -> North, MH -> West) |
| PIN vs State cross-validation | No mismatch detection | Displays mismatch alert if PIN state != form state |
| Invalid/Unallocated PIN UX | Silent 404 console error | Inline friendly warning: "PIN not recognized in India Post master" |
| Zone suggestions in UI | Free text without suggestions | Standard `<datalist id="india-zone-list">` with 6 standard zones |
| Backend validation API | Did not accept or validate zone | Validates `postal_code`, `state_code`, `city`, and `zone` |

## 6. Architecture Impact

- **Zero Breaking Schema Changes:** Operates on existing PostgreSQL `postal_codes_ref` and `states_ref` tables.
- **Bi-directional Consistency:** Works synchronously on the frontend with fallback data and asynchronously against canonical PostgreSQL reference data.
- **HREP Compliance:** User-facing validation messages provide actionable guidance without exposing HTTP status codes or database errors.

## 7. Proposed Design

1. **State-to-Zone Mapping:** Standard 6 commercial zones in India (North, South, East, West, Central, North East) mapped from official 2-letter state codes and full state names.
2. **Sub-form Feedback Machine:** Reactive `PincodeFeedback` state tracking `{ status: "idle" | "validating" | "valid" | "not_found" | "mismatch", message, expectedState, expectedZone }`.
3. **Zone Datalist & Hint:** Native `<datalist>` offering standard zones, with non-blocking advisory note if user manually selects an atypical zone for a state.

## 8. Files Created

- `src/tests/customerMailingLocationValidation.test.ts`
- `backend/app/tests/test_postal_code_zone_validation.py`
- `docs/implementation/customer/Customer_Mailing_Address_State_Zone_Validation_Plan_v5.7.0.md`
- `docs/walkthrough/customer/Customer_Mailing_Address_State_Zone_Validation_Walkthrough_v5.7.0.md`

## 9. Files Modified

- `src/constants/indianStates.ts`
- `src/components/customer/CustMailingDlg.tsx`
- `backend/app/schemas/localization.py`
- `backend/app/services/localization_svc.py`
- `backend/app/api/v1/localization.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies

- FastAPI backend running on port 1981 / 8000
- PostgreSQL with 164,811 records in `postal_codes_ref`
- React 18, Vite 5, TailwindCSS, lucide-react

## 11. Risks

- **LOW:** Users entering non-standard overseas addresses. Handled by fallback: if country is not India, standard validation relaxes to manual text entry without blocking save.

## 12. Rollback Strategy

Atomic git revert:
```bash
git checkout HEAD -- src/constants/indianStates.ts src/components/customer/CustMailingDlg.tsx backend/app/schemas/localization.py backend/app/services/localization_svc.py backend/app/api/v1/localization.py
```
No database migration rollback needed.

## 13. Verification Plan

1. Vitest test suite testing zone resolution and state-PIN consistency scenarios.
2. Python backend tests testing direct resolution and validation endpoint.
3. Live HTTP verification with curl / httpx for valid, mismatched, and unallocated PINs.
4. TypeScript compilation (`npx tsc --noEmit`).
5. Vite production build (`npm run build`).

## 14. Test Plan

| Test Target | Type | Expected Result | Result |
|---|---|---|---|
| `resolveZoneFromState` (6 zones, 36+ states) | Unit | Accurate zone returned for all states | Pass (11/11) |
| PIN auto-resolution (400067 -> MH -> West) | Integration | State=Maharashtra, Zone=West | Pass |
| PIN mismatch (400067 with UP and North) | Integration | Status=MISMATCH, expected=MH/West | Pass |
| Unallocated PIN (400000) | Integration | Status=NOT_FOUND, clean warning | Pass |
| Customer Master lifecycle | Regression | Existing address persistence works | Pass (26/26) |
| Customer state synchronization | Regression | State machine intact | Pass (4/4) |
| Production bundle | Build | Clean build without warnings/errors | Pass (1m 6s) |

## 15. Documentation Impact

- Walkthrough: `docs/walkthrough/customer/Customer_Mailing_Address_State_Zone_Validation_Walkthrough_v5.7.0.md`
- Master Implementation Index: `docs/implementation/README.md`
- Master Walkthrough Index: `docs/walkthrough/README.md`

## 16. Deployment Plan

1. Commit changes to `smritiNX` branch.
2. Restart `smriti-api` Docker container to reload backend worker processes.
3. Pull into `F:\Smriti9` test environment via `git pull`.

## 17. Status

**Completed** — 2026-10-25. All verification gates passed.

## 18. Related ADRs

- ADR-001: FastAPI + PostgreSQL Sole Backend
- ADR-009: Frontend-Derived Presentation & Validation Helpers

## 19. Related Walkthroughs

- `docs/walkthrough/customer/Customer_Mailing_Address_State_Zone_Validation_Walkthrough_v5.7.0.md`
