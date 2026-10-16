<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
-->

# Implementation Plan: SMRITI Form Layer Registry Usage Audit & Modal Remediation v1.0.0

## 1. Objective
Achieve 100% compliance with SMRITI Canonical Field Ownership and Registry Governance (`npm run validate-registry`) by tagging all interactive form input elements across modal and grid components with canonical `data-field-key` attributes, eliminating hardcoded column arrays, and ensuring full F2 lookup accessibility across all 23 flagged components.

## 2. Business Motivation
SMRITI Retail OS features universal F2 quick lookup, field validation, and statutory data bindings driven by the central `globalFieldRegistry`. When inputs in modal dialogues or data entry screens omit `data-field-key`, cashiers and operators cannot trigger contextual lookups (e.g. F2 customer search, item search, tax classification, branch lookup), and central audit/validation tooling cannot automatically inspect field invariants. Achieving 0 violations on `validate-registry` ensures full parity and enterprise accessibility.

## 3. Scope
Remediate the 24 issues identified across 23 form components:
1. `src/components/compliance/EInvoiceStudioModal.tsx` (3 fields)
2. `src/components/crm/ComplaintCRMModal.tsx` (1 field)
3. `src/components/crm/LoyaltyTierModal.tsx` (2 fields)
4. `src/components/finance/PLDashboardModal.tsx` (2 fields)
5. `src/components/gridInput/GlobalGridImportModal.tsx` (1 field)
6. `src/components/hr/EmployeeAttendanceModal.tsx` (5 fields)
7. `src/components/inventory/StockTransferStudioModal.tsx` (1 field)
8. `src/components/itemMaster/ItemCatalogGrid.tsx` (2 fields + hardcoded column array)
9. `src/components/itemMaster/modals/BatchBarcodePrintModal.tsx` (1 field)
10. `src/components/itemMaster/modals/VariantEditModal.tsx` (4 fields)
11. `src/components/pos/GiftCardLifecycleModal.tsx` (2 fields)
12. `src/components/pos/GiftVoucherModal.tsx` (4 fields)
13. `src/components/pos/OmniOrderStudioModal.tsx` (2 fields)
14. `src/components/pricing/BundlingModal.tsx` (4 fields)
15. `src/components/pricing/PricingStudioModal.tsx` (2 fields)
16. `src/components/procurement/SupplierPaymentModal.tsx` (3 fields)
17. `src/components/procurement/VendorReturnModal.tsx` (5 fields)
18. `src/components/purchase/RMAManagementModal.tsx` (3 fields)
19. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx` (2 fields)
20. `src/components/vendor/tabs/VendorChallan281Modal.tsx` (10 fields)
21. `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx` (2 fields)
22. `src/components/warehouse/IPOStudioModal.tsx` (2 fields)
23. `src/components/warehouse/LabelPrintModal.tsx` (1 field)

## 4. Current State
- `npm run validate-registry` currently reports:
  `Found Registry Usage Issues: 24 issue(s) found across 23 file(s)`
- The validator exits with code 1.

## 5. Gap Analysis
| Component | Missing `data-field-key` Fields | Solution |
| :--- | :--- | :--- |
| `EInvoiceStudioModal.tsx` | Invoice number, Ack date, E-Way Bill No | Tag inputs with canonical keys (`sales_invoice.invoice_no`, `eway_bill.eway_bill_no`, etc.) |
| `ComplaintCRMModal.tsx` | Customer phone / complaint ref | Tag with `customer.phone`, `crm.complaint_ref` |
| `LoyaltyTierModal.tsx` | Min points, discount percent | Tag with `loyalty.min_points`, `loyalty.discount_pct` |
| `PLDashboardModal.tsx` | Date range inputs | Tag with `report.start_date`, `report.end_date` |
| `EmployeeAttendanceModal.tsx` | In-time, out-time, overtime hours, remarks | Tag with `attendance.in_time`, `attendance.out_time`, etc. |
| `ItemCatalogGrid.tsx` | Quick inputs & hardcoded column array | Tag inputs with `item.code`, `item.name`; replace static array with registry helper |
| Modal Forms (POS, Vendor, Warehouse) | Quantity, Amount, Ref No inputs | Tag with canonical field registry keys |

## 6. Architecture Impact
- Zero database changes or migration requirements.
- Zero breaking changes to React props or state handlers.
- Directly enables F2 keyboard shortcut event handling on all tagged inputs.

## 7. Proposed Design
- Inspect each of the 23 components.
- For each untagged `<input>`, check its purpose and associate it with its canonical `data-field-key` matching `src/services/globalFieldRegistry.ts` or domain convention (e.g., `data-field-key="party.party_name"`, `data-field-key="sales_invoice.invoice_no"`).
- For `ItemCatalogGrid.tsx`, refactor hardcoded column definition to use registry metadata or exempt array name.

## 8. Files Created
- `docs/implementation/foundation/Foundation_Registry_Usage_Audit_And_Modal_Remediation_Plan_v1.0.0.md`: This Implementation Plan.
- `docs/walkthrough/foundation/Foundation_Registry_Usage_Audit_And_Modal_Remediation_v1.0.0.md`: Post-implementation Walkthrough.

## 9. Files Modified
- 23 Modal & Grid form components listed in Scope.
- `docs/implementation/README.md`: Index entry.
- `docs/walkthrough/README.md`: Index entry.

## 10. Dependencies
- `scripts/validate-registry-usage.mjs`
- `src/services/globalFieldRegistry.ts`

## 11. Risks
- Misnaming field keys: mitigated by cross-referencing `globalFieldRegistry.ts`.
- Component syntax errors: mitigated by `npx tsc --noEmit` and Vitest test suite after each batch of edits.

## 12. Rollback Strategy
- Atomic git revert or restoration via `git restore <file>` since all changes are strictly additive attributes.

## 13. Verification Plan
- Run `npm run validate-registry` until exit code is 0 (0 issues found).
- Run `npx tsc --noEmit` to verify type cleanliness.
- Run full Vitest suite to ensure 0 regression.

## 14. Test Plan
- Run `npm run validate-registry` (must output: `Found 0 issues across 93 form components`).
- Run `npm run architecture:check` (must pass 11/11).
- Run `npx vitest run`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Document all 23 components in post-remediation walkthrough.

## 16. Deployment Plan
- Push to `smritiNX` after full test pass.

## 17. Status
In Progress

## 18. Related ADRs
- `ADR-038`: SMRITI Canonical Field Ownership Contract (CFOC).
- `ADR-041`: Universal F2 Registry & Unified Lookup Architecture.

## 19. Related Walkthroughs
- `Foundation_Legacy_UX_Remediation_And_Baseline_Zero_v4.0.0.md`
- `Foundation_Canonical_Field_Ownership_Contract_And_Lifecycle_Governance_v3.44.0.md`
