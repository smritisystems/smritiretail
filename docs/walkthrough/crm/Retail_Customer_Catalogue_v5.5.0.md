<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Retail Customer Catalogue & Advanced Search Workspace (v5.5.0)

## 1. Purpose
This walkthrough documents the complete implementation of the **Customer Catalogue (Retail)** workspace, providing a central administrative interface split into 3 tabs (**Form**, **Retail Details**, **Additional Details**) with an associated **Mailing Address Sub-Form** and **Advanced Customer Search Utility**.

## 2. Scope
* `src/components/customer/SmritiCustomerMasterWorkspace.tsx`
* `src/components/customer/SmritiCustomerFormTab.tsx`
* `src/components/customer/SmritiCustomerRetailDetailsTab.tsx`
* `src/components/customer/SmritiCustomerAdditionalDetailsTab.tsx`
* `src/components/customer/SmritiCustomerMailingModal.tsx`
* `src/components/customer/SmritiAdvancedCustomerSearchModal.tsx`
* `src/components/CustomerMasterTab.tsx`

## 3. Files Created
* `src/components/customer/types.ts`
* `src/components/customer/SmritiCustomerFormTab.tsx`
* `src/components/customer/SmritiCustomerRetailDetailsTab.tsx`
* `src/components/customer/SmritiCustomerAdditionalDetailsTab.tsx`
* `src/components/customer/SmritiCustomerMailingModal.tsx`
* `src/components/customer/SmritiAdvancedCustomerSearchModal.tsx`
* `src/components/customer/SmritiCustomerMasterWorkspace.tsx`
* `docs/implementation/crm/Implementation_Plan_Retail_Customer_Catalogue_v5.5.0.md`
* `docs/walkthrough/crm/Retail_Customer_Catalogue_v5.5.0.md`

## 4. Files Modified
* `src/components/CustomerMasterTab.tsx`
* `CHANGELOG.md`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Three-Tab Partitioning**:
   * **The "Form" Tab**: General administrative fields, price groups, classification dropdowns (Religion, Ethnicity, Age Group, Profession, Type), profile notes, and store environment integration factors.
   * **The "Retail Details" Tab**: Dependants management, gender, DOB, marital status & anniversary date picker, loyalty program ID/Code/Tier/Points.
   * **The "Additional Details" Tab**: Financial credit policies, utilization progress, transport/logistics, price & tax multipliers, transaction permissions checkboxes, LST/CST/GSTIN tax identifiers, and pre/post-sale forms.
2. **Dedicated Sub-Modals**:
   * **Mailing Address Sub-Form Dialog**: Supports 5 address lines, postal code, locality, city, state, country, multiple phone/fax numbers, and multiple email addresses.
   * **Advanced Customer Search Dialog**: Multivariate filter panel with instant results grid, supporting double-click and Enter key record loading.

## 6. Design Rationale
Implements high-density enterprise typography and palette (`#00355f` primary, `#f2f4f6` container surfaces) with full keyboard accessibility (<kbd>Alt+N</kbd>, <kbd>F2</kbd>/<kbd>Alt+S</kbd>, <kbd>Ctrl+S</kbd>, <kbd>Alt+D</kbd>, <kbd>Alt+1..3</kbd>).

## 7. Implementation Summary
* Created canonical data types in `src/components/customer/types.ts`.
* Constructed tab components with reactive state synchronization and dirty state indicators.
* Mounted master workspace into `CustomerMasterTab.tsx`.
* Verified production build and Docker runtime deployment.

## 8. Tests Executed
* Executed `npm run build` — Passed (0 errors).
* Executed `docker compose up -d --build` — Containers healthy.

## 9. Verification Results
```
dist/assets/index-CAKz5Efm.js  957.93 kB │ gzip: 215.81 kB
✓ built in 20.55s
Container smriti-web Started
Container smriti-api Healthy
Container smriti-db Healthy
```

## 10. Known Limitations
None.

## 11. Future Work
* Integrate automatic GSTIN lookup / validation via backend compliance gateways.

## 12. Related ADRs
* `ADR-0014`: Platform Abstraction Layer UI Standard.

## 13. Related RFCs
* `RFC-0089`: Retail Customer Management Standard.
