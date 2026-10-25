<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.7.1
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Customer Mailing Address: Untouched Placeholder Exemption & Store Code Save Validation — Walkthrough v5.7.1

**Date:** 2026-10-25  
**Area:** CRM & Customer Master / Address Sub-Form  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose

Resolve the customer address save validation bug where saving a valid Mailing address in the Customer Master Mailing Address sub-form failed with "Billing Store Code is required" due to blanket validation across unedited default placeholder entries synthesized during customer normalization.

## 2. Scope

| Component | Responsibility | Change Summary |
|---|---|---|
| `src/components/customer/types.ts` | Data Models & Address Helpers | Added `isAddressEntryPlaceholder` and `findMissingStoreCodeAddress` functions. |
| `src/components/customer/CustMailingDlg.tsx` | Customer Mailing Modal | Added `initialAddressesRef` snapshot and wired `findMissingStoreCodeAddress` into `handleSaveAndClose`. |
| `src/tests/customerAddressSaveValidation.test.ts` | Regression & Validation Test Suite | 18 unit tests verifying placeholder exemption, new billing/shipping rejection, and persisted record safety. |

## 3. Files Created

- `src/tests/customerAddressSaveValidation.test.ts`
- `docs/implementation/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Plan_v5.7.1.md`
- `docs/walkthrough/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Walkthrough_v5.7.1.md`

## 4. Files Modified

- `src/components/customer/types.ts`
- `src/components/customer/CustMailingDlg.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions

1. **Selective Store Code Enforcement:** Store codes remain mandatory for actual new or edited Billing and Shipping addresses, but untouched default placeholders synthesized by `CustMasterWs.tsx` normalization (`createDefaultAddressSet` / `normalizeMailingAddresses`) are exempted from triggering validation rejections.
2. **Substantive Address Detection:** An entry is determined to be an untouched placeholder only if it has no persisted database ID (`!address.id`) and is completely devoid of user-entered address lines, postal code, locality, GSTIN, location name, store codes, custom contacts, or custom city/state entries. Any user modification immediately subjects the entry to strict validation.
3. **Session Address Snapshot:** `CustMailingDlg.tsx` captures an immutable reference snapshot (`initialAddressesRef.current`) upon modal opening, allowing deterministic detection of initial placeholders versus newly added addresses in that modal session.

## 6. Design Rationale

Silently discarding placeholder addresses during modal save could cause subtle state loss if downstream components expected normalized tuples. Blanket exemption would weaken data integrity for multi-store retail logistics. Capturing initial placeholders and validating substantive edits provides precision: valid Mailing addresses save cleanly while actual Billing and Shipping entries are strictly held to store-code requirements.

## 7. Implementation Summary

1. **`src/components/customer/types.ts`:**
   - Implemented `isAddressEntryPlaceholder`: evaluates whether an entry contains user-provided substantive address lines or custom values beyond baseline system defaults.
   - Implemented `findMissingStoreCodeAddress`: iterates over `addressList` and identifies any actual new or edited billing/shipping address missing a store code while skipping untouched initial placeholders.
2. **`src/components/customer/CustMailingDlg.tsx`:**
   - Initialized `initialAddressesRef` on modal open.
   - Replaced `addressList.find` in `handleSaveAndClose` with `findMissingStoreCodeAddress(addressList, initialAddressesRef.current, customerName)`.

## 8. Tests Executed

- Focused Suite: `npx vitest run src/tests/customerAddressSaveValidation.test.ts` -> **18/18 passed in 8ms**.
- Customer Master Regression: `npx vitest run src/tests/customerAddressSaveValidation.test.ts src/tests/customerMailingLocationValidation.test.ts src/tests/customerStateSync.test.ts src/tests/customerMasterLifecycle.test.tsx` -> **59/59 passed in 135ms**.
- TypeScript Check: `npx tsc --noEmit` -> **0 errors (Exit code 0)**.
- Production Build: `npm run build` -> **Built in 1m 10s, 3741 modules transformed, 0 errors**.

## 9. Verification Results

All 18 targeted test scenarios passed, confirming:
- Valid Mailing addresses save without demanding billing or shipping store codes.
- New Billing addresses without `billingStoreCode` are rejected with `"Billing Store Code is required before saving this address."`.
- New Shipping addresses without `shippingStoreCode` are rejected with `"Shipping Store Code is required before saving this address."`.
- Existing persisted database records with an ID are preserved without rejection.

## 10. Known Limitations

None.

## 11. Future Work

Automate selection of the active address sub-tab (Billing vs Delivery) when launching `SmritiCustomerMailingModal` directly from the Enterprise Workspace address cards.

## 12. Related ADRs

- ADR-0027: Customer Master Multi-Location and Address Architecture.

## 13. Related RFCs

- RFC-0089: Customer 360 Address Synchronization and Normalization Contract.
