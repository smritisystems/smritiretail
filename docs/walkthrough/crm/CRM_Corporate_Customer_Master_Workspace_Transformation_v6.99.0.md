# SMRITI Walkthrough: Corporate Customer Master Workspace Transformation

<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Policy ID    : WGP-v1.0 / UADHP-v1.0
-->

## 1. Purpose
Transform the existing Corporate Customer Master screen (`CustMasterWs.tsx`) into a high-density, enterprise ERP customer workspace matching the canonical SMRITI Corporate Customer reference design. This transformation equips corporate procurement managers, account executives, and commercial auditors with unified visibility into statutory compliance, store mapping networks, multi-state GST registrations, address portfolios, commercial terms, and immutable audit logs without altering the underlying database schema.

## 2. Scope
- **Persistent Corporate Account Header:** Displays Customer Code, Name, Account Status, Customer Type (`Corporate / B2B`), Customer Group, Primary Price List, PAN, Primary GSTIN, Credit Limit (INR), Current Outstanding (INR) with blue accenting, Payment Terms, and Relationship Start Date.
- **Corporate Workspace Navigation (6 Section Tabs):**
  1. Identity & Compliance
  2. Corporate Network
  3. Addresses & Contacts
  4. Commercial Terms
  5. Integrations
  6. Activity & Audit
- **Dual Workspace View Modes:** Provides both single-tab focus mode (bound to `Alt+1` through `Alt+6`) and full multi-row overview mode matching the reference screenshot.
- **Form Field Visibility Corrections:** Suppresses consumer demographic fields (religion, ethnicity, age group, profession, gender, DOB, marital anniversary, retail loyalty program points) for Corporate/B2B accounts while fully preserving them for retail consumer profiles.
- **Sub-Modals:** Modular implementations for GST registration creation/editing (`AddEditGstModal.tsx`), key contact management (`AddEditContactModal.tsx`), and EDI integration file exchange logs (`IntegrationLogsModal.tsx`).
- **Operational Preservation:** Maintains record navigation, create (`Alt+N`), edit (`Alt+E`), save (`Ctrl+S`), delete (`Alt+D`), search (`F2`/`Alt+S`), corporate 360 jump, and universal CSV/Excel data export.

## 3. Files Created
1. `src/components/customer/corporateWorkspace/CorporateMasterAccountHeader.tsx`
2. `src/components/customer/corporateWorkspace/CorporateIdentityCompliancePanel.tsx`
3. `src/components/customer/corporateWorkspace/CorporateNetworkPanel.tsx`
4. `src/components/customer/corporateWorkspace/CorporateAddressesContactsPanel.tsx`
5. `src/components/customer/corporateWorkspace/CorporateCommercialTermsPanel.tsx`
6. `src/components/customer/corporateWorkspace/CorporateIntegrationsPanel.tsx`
7. `src/components/customer/corporateWorkspace/CorporateActivityAuditPanel.tsx`
8. `src/components/customer/corporateWorkspace/AddEditGstModal.tsx`
9. `src/components/customer/corporateWorkspace/AddEditContactModal.tsx`
10. `src/components/customer/corporateWorkspace/IntegrationLogsModal.tsx`
11. `src/tests/corporateCustomerWorkspace.test.tsx`
12. `docs/walkthrough/crm/CRM_Corporate_Customer_Master_Workspace_Transformation_v6.99.0.md`

## 4. Files Modified
1. `src/components/customer/CustMasterWs.tsx`
2. `src/components/customer/CustFormTab.tsx`
3. `src/components/customer/CustRetailDetTab.tsx`
4. `src/components/customer/types.ts`
5. `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Zero Schema Alteration:** Leveraged existing PostgreSQL `Customer` model fields (`company_code`, `environment`, `flat_file_format`, `delimiter`, `buying_factor`, `selling_factor`, `pan_number`, `profile_notes`, `payment_category`, `payment_term`, `transit_days`, `bank_code`, `bank_location`, `retail_factor`, `dealer_factor`, `destination_tax_type`).
- **Dual Presentation Topology:** Implemented `corporateWorkspaceMode` toggle (`tabbed` vs `overview`). Overview mode renders the complete multi-row dashboard depicted in the reference screenshot, while Tabbed mode allows focused, full-height editing of individual sections.
- **Deterministic Identity Model:** Retained stable ID and code-first reconciliation in `CustMasterWs.tsx` to prevent background polling or state transitions from clobbering unsaved local drafts.
- **Authoritative REST Service Integration:** Wired GST registrations to `/api/v1/crm/customers/{customer_id}/gst-registrations` and Activity & Audit trail directly to `/api/v1/system/audit-logs?entity_name=Customer&entity_id={customer_id}`.

## 6. Design Rationale
- **Visual Parity:** Emulated the precise typography, spacing, surface colors, subtle borders (`border-slate-200 dark:border-slate-800`), and dark blue accents (`#00355f`) of the reference specification.
- **Conditional Field Governance:** Corporate enterprise accounts should never be asked for personal consumer attributes like religion or wedding anniversaries. Bounding these behind `isCorporate` checks cleans the user experience while retaining them for individual retail shoppers.
- **Accessibility & Productivity:** Integrated keyboard navigation shortcuts (`Alt+1` through `Alt+6` for corporate tabs, `Alt+N` for new record, `Alt+E` for edit, `Ctrl+S` for save, `F2`/`Alt+S` for search).

## 7. Implementation Summary
- Structured all 6 corporate tabs as self-contained, typed React components accepting `customer` and `onChange` props.
- Implemented `CorporateMasterAccountHeader` as a persistent summary banner atop the workspace.
- Built `AddEditGstModal` with canonical state detection from GSTIN prefix using `constants/indianStates.ts`.
- Integrated `StoreCodeLookupModal` into `CorporateNetworkPanel` for interactive branch store assignment.
- Connected `CustPriceGroupDlg` into `CorporateIdentityCompliancePanel` for customer price group configuration.

## 8. Tests Executed
- `npm test -- customer` (Vitest customer test suite): 9 test files, 59/59 tests green.
- `npm run lint` (`tsc --noEmit`): TypeScript compilation passed with 0 errors.
- `npm run build` (`vite build`): Production bundle compilation succeeded with exit code 0.

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (59/59 Vitest assertions green)
✓ TypeScript Typecheck Passed (0 errors)
✓ Production Build Passed (vite build exit 0)
✓ Documentation Updated
✓ Walkthrough Created

Evidence Level: A (Direct observable build, test, and typecheck output)
```

## 10. Known Limitations
- Flat-file file transfers and EDI polling history endpoints require active enterprise middleware gateways; fallback presentation states are provided when mock endpoints are offline.
- Store mapping counts in offline development fallback to address-derived store codes.

## 11. Future Work
- Real-time WebSocket subscriptions for EDI transmission status and file receipt notifications.
- Integrated GSTIN tax compliance validation against the official GSTN portal API.

## 12. Related ADRs
- `ADR-0042`: FastAPI Sole System-of-Record Backend Migration.
- `ADR-0056`: Multi-State GST Registration and Branch Network Schema.
- `ADR-0089`: ActiveField Heuristic Safety and F2 Universal Lookup Integration.

## 13. Related RFCs
- `RFC-CRM-2026-08`: Enterprise Corporate Customer 360 and Catalogue Harmonization.
- `RFC-GOV-2026-09`: Human-Readable Error Policy and UX Field Governance.
