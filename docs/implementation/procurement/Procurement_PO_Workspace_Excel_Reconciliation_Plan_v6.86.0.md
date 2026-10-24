<!--
  Project      : SMRITI Retail OS
  Module       : Procurement & PO Workspace Data Reconciliation & Theme Remediation Plan
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.86.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Purchase Order Workspace vs Excel Data Reconciliation & Theme Remediation

## 1. Objective
Reconcile all visible records in the SMRITI Retail OS Purchase Order Workspace table at `https://tattlythreads.smritisys.com/` against client vendor purchase workbook `ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`, correct display discrepancies (Supplier name, PO Date, Amount, Delivery Date, Line Items), and normalize hardcoded dark classes across Purchase Studio components for full light theme compliance.

## 2. Business Motivation
Operators reviewing Purchase Orders in the PO Workspace encountered missing vendor names (falling back to raw IDs like `sup-j`), dashes (`—`) instead of PO Dates and Total Amounts, and dark-navy surfaces even when operating in Light theme mode. Correcting these display contracts restores operational efficiency, visual clarity, and auditability.

## 3. Scope
- Audit 28 statutory purchase orders from client master workbook against live server database.
- Enrich backend FastAPI response models with `supplier_name`, `total_amount`, `order_date`, and `delivery_date`.
- Add client-side supplier resolution cache in `POWorkspaceTab.tsx`.
- Refactor styling across 5 Purchase Studio components to support both Light and Dark themes.

## 4. Current State
- `PurchaseOrderResponse` schema lacked explicit `supplier_name` and `total_amount` attributes, returning `grand_total`.
- The frontend attempted to read `po.total_amount`, causing it to render `—`.
- Frontend attempted to read `po.order_date || po.created_at`, which were omitted in the response payload.
- Several dialogs and panels in Purchase Studio had hardcoded `bg-slate-900`, `bg-slate-950` classes.

## 5. Gap Analysis
| Feature / Field | Before | After |
|---|---|---|
| Supplier Name | Rendered raw `po.supplier_id` (e.g. `sup-j`) | Rendered resolved vendor trading name (e.g. `ALIYA FOOTWEAR`) |
| PO Date | Rendered `—` | Rendered authoritative `created_at` timestamp |
| Delivery Date | Rendered `—` | Remains `—` unless scheduled delivery date exists |
| PO Amount | Rendered `—` | Rendered authoritative transaction grand total (including GST) |
| Theme Mode | Hardcoded dark navy | Responsive light mode (`bg-white`) and dark mode (`dark:bg-slate-900`) |

## 6. Architecture Impact
None to database schema. Non-breaking additions to Pydantic schema `PurchaseOrderResponse` and FastAPI route handler `list_purchase_orders_contract`.

## 7. Proposed Design
- Default `total_amount` to `grand_total` in Pydantic `@model_validator(mode="after")`.
- Default `order_date` to `created_at`.
- Query `Supplier.name` in batch during `list_purchase_orders_contract` to minimize SQL roundtrips.
- In `POWorkspaceTab.tsx`, query `/api/v1/purchase/suppliers/` once to maintain an in-memory name lookup table.
- Replace Tailwind slate dark classes with semantic `bg-white dark:bg-slate-900` pairs.

## 8. Files Created
None (non-destructive refactoring).

## 9. Files Modified
- `backend/app/schemas/purchase.py`
- `backend/app/api/v1/purchase.py`
- `src/components/purchase/POWorkspaceTab.tsx`
- `src/components/PurchaseStudioTab.tsx`
- `src/components/purchase/POCancelReasonDialog.tsx`
- `src/components/purchase/POAmendDialog.tsx`
- `src/components/purchase/ProcurementReportsModal.tsx`

## 10. Dependencies
FastAPI, Pydantic V2, React 18, Tailwind CSS, Lucide React.

## 11. Risks
Low. All changes are backward compatible with existing API consumers.

## 12. Rollback Strategy
Git revert of modified frontend components and backend schema/router changes.

## 13. Verification Plan
- Cross-tabulate all 28 statutory bills from Excel with live server POs.
- Confirm exact subtotal, tax total, and grand total parity.
- Execute unit and integration tests with Vitest and Pytest.
- Run `tsc --noEmit` to verify type safety.

## 14. Test Plan
- Run Vitest suite: `poPrintBrandingAndTerms.test.tsx`, `poLifecycle.test.ts`, `poModeConversion.test.ts`, `poGenerate.test.ts`.
- Run type check: `npx tsc --noEmit`.
- Verify schema validation with Python `.venv`.

## 15. Documentation Impact
- Update `docs/walkthrough/README.md` master index.
- Update `docs/implementation/README.md` master index.
- Create walkthrough `Procurement_PO_Workspace_Excel_Reconciliation_And_Light_Theme_v6.86.0.md`.

## 16. Deployment Plan
Commit to `smritiNX` branch and push to origin. Deploy to live staging / production.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-017`: Unified Ledger & Purchasing Architecture.

## 19. Related Walkthroughs
- `Procurement_PO_Workspace_Excel_Reconciliation_And_Light_Theme_v6.86.0.md`.
