<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-29
  Modified     : 2026-09-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Vendor & National Postal Code Lookup Wiring v1.0

## 1. Purpose
Wire the database's 164,811 authoritative Indian postal code records (`postal_codes_ref` and `states_ref`) into Vendor address management and creation flows, enabling instant automatic population of City, State, State Code, Locality, and statutory GST jurisdiction upon entering a 6-digit postal PIN code. Also adds full address field attributes (Address Line 2, Location GSTIN) and in-place address editing.

## 2. Scope
- `backend/app/schemas/localization.py` — `PostalCodeResponse` schema enrichment
- `backend/app/services/localization_svc.py` — `get_postal_code()` and `search_postal_codes()` outer join with `StateRef`
- `backend/tests/t_ctrl_ref.py` — automated regression test for postal code + state + GST resolution
- `src/components/vendor/tabs/VendorAddressTab.tsx` — live PIN code resolution, complete address form, in-place edit support
- `src/components/vendor/VendorMasterWs.tsx` — postal PIN code auto-fill in Quick Create Vendor modal
- `src/components/vendor/tabs/VendorScorecardTab.tsx` — type resolution for `qualityVerdict`

## 3. Files Created
- `docs/walkthrough/vendor/Vendor_Postal_Code_Lookup_Wiring_v1.0.md`

## 4. Files Modified
| File | Change |
|------|--------|
| `backend/app/schemas/localization.py` | Added `state_name` and `gst_state_code` fields to `PostalCodeResponse` |
| `backend/app/services/localization_svc.py` | Joined `StateRef` in `get_postal_code` & `search_postal_codes` to supply state metadata |
| `backend/tests/t_ctrl_ref.py` | Added test `test_postal_code_lookup_with_state_and_gst()` |
| `src/components/vendor/tabs/VendorAddressTab.tsx` | Added 6-digit PIN resolver, visual status badges, Address Line 2, GSTIN, and location editing |
| `src/components/vendor/VendorMasterWs.tsx` | Added Postal PIN with live resolution in Quick Create Vendor modal; wired to creation payload |
| `src/components/vendor/tabs/VendorScorecardTab.tsx` | Fixed `qualityVerdict` type alignment with `GRNQualityVerdict` |

## 5. Architecture Decisions
- **AD-1: Server-Side State Join**: Joined `StateRef` on `state_code` + `country_code` in `GlobalReferenceService`, returning canonical state name and 2-digit GST statutory code in a single round-trip without requiring client-side dictionaries.
- **AD-2: Non-Blocking Debounced Lookup**: In UI components, postal lookup fires upon full 6-digit validation or paste with fallback resilience; users retain ability to manually adjust city/state.
- **AD-3: Atomic Universal Party Compatibility**: Pincode and state coordinates persist seamlessly through `party_addresses` and `parties` tables.

## 6. Design Rationale
Leveraged the pre-existing 164,811 India Post directory (`postal_codes_ref`) and 37 statutory states (`states_ref`) already seeded in `smritisys` database. Enriching `PostalCodeResponse` maintains 100% backward compatibility for existing consumers (such as `CustMailingDlg.tsx`) while giving all future forms instant access to state names and GST jurisdiction.

## 7. Implementation Summary
- `PostalCodeResponse`: Added `state_name: Optional[str] = None` and `gst_state_code: Optional[str] = None`.
- `GlobalReferenceService`: Updated `select(PostalCodeRef, StateRef.name.label("state_name"), StateRef.gst_state_code).outerjoin(...)`.
- `VendorAddressTab`: Created `handlePincodeChange`, `handleOpenEdit`, `handleSaveAddress`, and added inputs for `pincode`, `addressLine2`, `gstin`, and primary toggle.
- `VendorMasterWs`: Added `pincode` to `newForm`, added `handleNewVendorPincodeChange` with resolver feedback, and included `pincode` in `POST /purchase/vendors/`.

## 8. Tests Executed
- `pytest backend/tests/t_ctrl_ref.py`: 11/11 tests passed (100% green) in 20.31s.
- `npx tsc --noEmit`: 0 errors across entire workspace.

## 9. Verification Results
- **Evidence Level**: A (Direct terminal logs, typecheck validation, and diff verification)
- **Status**: `Done`

## 10. Known Limitations
- International postal codes (outside `IN`) currently resolve state name if present in `states_ref`, but postal code directories for other countries (e.g. US, AE) are not pre-seeded.

## 11. Future Work
- Extend postal code auto-fill to Customer Master, Store Warehouse coordinates, and POS checkout shipping address prompts.

## 12. Related ADRs
- `ADR-VEND-01`: Universal Party Master & Sub-Entity Architecture
- `ADR-CTRL-REF-01`: Control Plane Reference Data Registry

## 13. Related RFCs
- `RFC-LOC-01`: Global Reference Data & Localization Engine
