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

# Customer Mailing Address: Postal Code, State and Commercial Zone Validation — Walkthrough v5.7.0

**Date:** 2026-10-25  
**Area:** CRM & Customer Master / Reference Architecture  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose

Provide cross-location validation and automated synchronization between Postal Code (PIN), State/Province, and Commercial Zone in the Customer Mailing Address Sub-form (`CustMailingDlg.tsx`) and the FastAPI control-plane localization reference service (`localization_svc.py`, `localization.py`).

## 2. Scope

| Component | Responsibility | Change Summary |
|---|---|---|
| `CustMailingDlg.tsx` | Customer Mailing Address Sub-form | Auto-populates `state` and commercial `zone` on PIN entry/selection; auto-updates `zone` on state change; validates PIN against selected state; displays inline status badges |
| `indianStates.ts` | Location Reference Utilities | Exports `IndianCommercialZone`, `INDIAN_ZONES` (6 zones), `INDIAN_STATE_TO_ZONE`, `INDIAN_STATE_CODE_TO_ZONE`, and `resolveZoneFromState` |
| `localization.py` (schemas) | API Contract | Adds `zone: Optional[str] = None` to `PostalCodeResponse` |
| `localization_svc.py` | Reference Master Service | Populates `zone` on postal lookups; enhances `validate_postal_location` with cross-location mismatch reporting |
| `localization.py` (api) | API Endpoint | Adds `zone` Query parameter to `/postal-codes/{postal_code}/validate` |
| `customerMailingLocationValidation.test.ts` | Frontend Unit Tests | 11 unit tests verifying zone mapping and address alignment scenarios |
| `test_postal_code_zone_validation.py` | Backend Integration Tests | 3 integration tests verifying zone population and validation response status |

## 3. Files Created

- `src/tests/customerMailingLocationValidation.test.ts`
- `backend/app/tests/test_postal_code_zone_validation.py`
- `docs/implementation/customer/Customer_Mailing_Address_State_Zone_Validation_Plan_v5.7.0.md`
- `docs/walkthrough/customer/Customer_Mailing_Address_State_Zone_Validation_Walkthrough_v5.7.0.md`

## 4. Files Modified

- `src/constants/indianStates.ts`
- `src/components/customer/CustMailingDlg.tsx`
- `backend/app/schemas/localization.py`
- `backend/app/services/localization_svc.py`
- `backend/app/api/v1/localization.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions

1. **Canonical 6 Commercial Zones:**
   India is mapped into 6 standard commercial zones:
   - **North:** Delhi, Uttar Pradesh, Punjab, Haryana, Rajasthan, Uttarakhand, Himachal Pradesh, Jammu & Kashmir, Ladakh, Chandigarh.
   - **West:** Maharashtra, Gujarat, Goa, Dadra & Nagar Haveli, Daman & Diu.
   - **South:** Tamil Nadu, Karnataka, Kerala, Andhra Pradesh, Telangana, Puducherry, Lakshadweep.
   - **East:** West Bengal, Bihar, Jharkhand, Odisha, Andaman & Nicobar Islands.
   - **Central:** Madhya Pradesh, Chhattisgarh.
   - **North East:** Assam, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Arunachal Pradesh, Sikkim.

2. **Non-Destructive Feedback:**
   Entering an unallocated PIN (e.g. 400000) does not destroy existing state or city fields; instead it surfaces an inline warning so the user can verify digits or continue manually.

3. **Multi-Source Zone Resolution:**
   Backend database lookups return `zone` directly, while local offline fallbacks resolve through `resolveZoneFromState` ensuring continuous usability even if the control-plane connection is intermittently offline.

## 6. Design Rationale

Previously, `DEFAULT_MAILING_ADDRESS` set `state: "Uttar Pradesh"` and `zone: "North"`. When a user entered a Mumbai PIN (e.g. 400067), the code updated `state` to "Maharashtra" but left `zone` as "North", causing geographic and dispatch routing corruption. By coupling state and zone synchronization bidirectionally, data consistency is strictly preserved.

## 7. Implementation Summary

1. **Zone Resolution Engine (`indianStates.ts`):**
   Implemented dictionary lookup covering all 36 Indian states/UTs, 2-letter state codes, and 2-digit GST state codes.
2. **Sub-form UI Machine (`CustMailingDlg.tsx`):**
   - Added `PincodeFeedback` reactive machine with states: `idle`, `validating`, `valid`, `not_found`, and `mismatch`.
   - Wired `resolvePincodeSelection` to auto-populate `state` and `zone`.
   - Wired `handleFieldChange("state")` to auto-align `zone` and cross-validate with any active PIN code.
   - Added native `<datalist id="india-zone-list">` for Zone input with helpful discrepancy hints.
3. **Backend Service Enhancements (`localization_svc.py`, `localization.py`):**
   - Populated `pin_ref.zone` across `get_postal_code` and `search_postal_codes`.
   - Enhanced `validate_postal_location` to search by PIN first, accurately detecting whether `state_code` or `zone` mismatch the actual location.

## 8. Tests Executed

### Frontend Suite:
- `npx vitest run src/tests/customerMailingLocationValidation.test.ts` (11 tests passed)
- `npx vitest run src/tests/customerStateSync.test.ts` (4 tests passed)
- `npx vitest run src/tests/customerMasterLifecycle.test.tsx` (26 tests passed)

### Backend Suite:
- `python backend/app/tests/test_postal_code_zone_validation.py` (3 tests passed)

### Compiler & Bundler Gates:
- `npx tsc --noEmit` (0 errors)
- `npm run build` (built in 1m 6s, 3741 modules transformed)

## 9. Verification Results

- Direct lookup for `400067`: returns `state_name: "Maharashtra"`, `zone: "West"`.
- Cross-validation for `400067` with `MH` + `West`: returns `status: "VALID"`.
- Cross-validation for `400067` with `UP` + `North`: returns `status: "MISMATCH"`, `expected_state: "Maharashtra"`, `expected_zone: "West"`.
- Lookup for `400000`: returns `status: "NOT_FOUND"`, surfaces clean inline warning without crashing.

## 10. Known Limitations

- International postal formats outside India (e.g. US 5-digit ZIP or UK alphanumeric postcodes) fallback to open text input without statutory zone derivation.

## 11. Future Work

- Implement similar zone synchronization on Vendor Master delivery addresses.
- Auto-calculate estimated transit times based on origin warehouse zone vs destination customer mailing zone.

## 12. Related ADRs

- ADR-001: FastAPI + PostgreSQL Sole Backend
- ADR-009: Frontend-Derived Presentation & Validation Helpers

## 13. Related RFCs

- RFC-2026-REF-004: Standard Commercial Zone Derivation and Localization Master
