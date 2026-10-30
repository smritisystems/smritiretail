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

# Implementation Plan: Customer Mailing Address Untouched Placeholder Exemption and Store Code Save Validation v5.7.1

**Status:** Completed  
**Date:** 2026-10-25  
**Area:** CRM & Customer Master / Address Sub-Form  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Objective

Remediate the Customer Master address save validation bug where adding or editing a valid Mailing address falsely rejected with "Billing Store Code is required" due to indiscriminate validation across untouched default/placeholder billing and shipping entries synthesized during customer profile normalization.

## 2. Business Motivation

In enterprise retail CRM, operators regularly add, update, and review customer mailing addresses. When an operator fills in a valid Mailing address, the system must save without demanding irrelevant store codes from internal default placeholder entries. Mandatory store codes must remain strictly enforced for actual new or user-edited Billing and Shipping addresses without corrupting existing records or bypassing validation broadly.

## 3. Scope

| Area | In Scope | Out of Scope |
|---|---|---|
| `src/components/customer/types.ts` | Definition of `isAddressEntryPlaceholder` and `findMissingStoreCodeAddress` | Backend schema modifications |
| `src/components/customer/CustMailingDlg.tsx` | Snapshotting initial addresses on modal open and validating only actual new/edited billing & shipping entries | Modifying duplicate address fingerprinting or GSTIN validation |
| `src/tests/customerAddressSaveValidation.test.ts` | Comprehensive regression suite covering placeholder exemption, new billing/shipping rejection, and persisted preservation | Modifying unrelated billing workspace tests |

## 4. Current State

1. `CustMasterWs.tsx` normalizes customer address lists via `normalizeMailingAddresses` and `createDefaultAddressSet`, automatically appending blank billing and shipping address entries (`code: "002"`, `addressType: "billing"`, `code: "003"`, `addressType: "shipping"`) with empty address lines and empty store codes.
2. `CustMailingDlg.tsx` executed a blanket check:
   ```typescript
   const missingStoreCode = addressList.find(address =>
     !address.id && (
       (address.addressType === "billing" && !address.billingStoreCode?.trim()) ||
       (address.addressType === "shipping" && !address.shippingStoreCode?.trim())
     )
   );
   ```
3. Whenever an operator opened the Mailing Address modal to add or edit a Mailing address, this loop encountered the untouched blank billing placeholder (index 1) and immediately blocked saving with `"Billing Store Code is required before saving this address."`.

## 5. Gap Analysis

- **Gap:** Inability to distinguish between untouched default normalization placeholders and actual new/edited billing or shipping entries requiring store codes.
- **Resolution:** Introduce `isAddressEntryPlaceholder` to detect whether an entry is an unedited baseline placeholder (devoid of substantive address lines, postal code, gstin, custom contact, custom city/state, or store codes) and `findMissingStoreCodeAddress` to exempt untouched initial placeholders while strictly validating actual new or edited billing/shipping entries.

## 6. Architecture Impact

No breaking API or schema changes. Enhancements remain fully confined to the client-side customer address model and validation machine in `types.ts` and `CustMailingDlg.tsx`.

## 7. Proposed Design

1. Track `initialAddressesRef` in `CustMailingDlg.tsx` when the modal opens to record baseline addresses.
2. Define `isAddressEntryPlaceholder`: returns `true` only if `!address.id` and all address lines (1-5), locality, postal code, gstin, location name, store codes, phone, email, and custom contact/city/state details are empty or at default baseline.
3. Define `findMissingStoreCodeAddress`:
   - Returns `false` for persisted records (`address.id`).
   - Returns `false` for mailing addresses.
   - Returns `false` for entries that were initial placeholders and remain untouched placeholders.
   - Returns `true` (missing store code) if an actual new or edited billing address lacks `billingStoreCode`.
   - Returns `true` (missing store code) if an actual new or edited shipping address lacks `shippingStoreCode`.

## 8. Files Created

- `src/tests/customerAddressSaveValidation.test.ts`: 18 focused regression and validation unit tests.
- `docs/implementation/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Plan_v5.7.1.md`: This implementation plan.
- `docs/walkthrough/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Walkthrough_v5.7.1.md`: Companion walkthrough document.

## 9. Files Modified

- `src/components/customer/types.ts`: Added `isAddressEntryPlaceholder` and `findMissingStoreCodeAddress`.
- `src/components/customer/CustMailingDlg.tsx`: Integrated `initialAddressesRef` and updated `handleSaveAndClose`.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.

## 10. Dependencies

- TypeScript 5.x / Vite 5.x.
- Vitest 4.x testing framework.
- React 18 hooks (`useRef`, `useState`, `useEffect`).

## 11. Risks

- *Risk:* Overly broad placeholder exemption allowing an incomplete billing address to slip through without store code.
- *Mitigation:* Any entry that contains even a single substantive field (such as address1, postal code, locality, gstin, phone, or custom city/contact) immediately disqualifies it from placeholder exemption and enforces the store code.

## 12. Rollback Strategy

Git revert of commit restoring previous `addressList.find` check.

## 13. Verification Plan

1. Vitest execution of `customerAddressSaveValidation.test.ts`.
2. Vitest regression run across all 4 customer test suites (`customerMailingLocationValidation.test.ts`, `customerStateSync.test.ts`, `customerMasterLifecycle.test.tsx`).
3. Static type-check via `npx tsc --noEmit`.
4. Production bundle build via `npm run build`.
5. Docker container deployment via `docker compose up -d smriti-web`.

## 14. Test Plan

- Test 1: Untouched billing and shipping placeholders recognized as placeholders.
- Test 2: Substantive address lines disqualify placeholder status.
- Test 3: Valid Mailing address saves cleanly when addressList contains untouched placeholders.
- Test 4: New Billing address without `billingStoreCode` is rejected.
- Test 5: New Shipping address without `shippingStoreCode` is rejected.
- Test 6: New Billing address with `billingStoreCode` is accepted.
- Test 7: New Shipping address with `shippingStoreCode` is accepted.
- Test 8: Edited placeholder Billing address without `billingStoreCode` is rejected.
- Test 9: Edited placeholder Billing address with `billingStoreCode` is accepted.
- Test 10: Existing persisted database record without store code is preserved.

## 15. Documentation Impact

- Updated implementation index: `docs/implementation/README.md`.
- Updated walkthrough index: `docs/walkthrough/README.md`.
- Walkthrough generated: `docs/walkthrough/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Walkthrough_v5.7.1.md`.

## 16. Deployment Plan

1. Build production assets (`npm run build`).
2. Package container image (`docker compose build smriti-web`).
3. Restart web container (`docker compose up -d smriti-web`).
4. Sync test environment (`git -C F:\Smriti9 pull origin smritiNX`).

## 17. Status

Completed.

## 18. Related ADRs

- ADR-0027: Customer Master Multi-Location and Address Architecture.

## 19. Related Walkthroughs

- `docs/walkthrough/customer/Customer_Mailing_Address_Untouched_Placeholder_Validation_Walkthrough_v5.7.1.md`.
- `docs/walkthrough/customer/Customer_Mailing_Address_State_Zone_Validation_Walkthrough_v5.7.0.md`.
