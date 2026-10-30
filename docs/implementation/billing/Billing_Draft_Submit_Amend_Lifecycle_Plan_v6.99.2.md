<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.2
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Plan
-->

# Billing Draft, Submit & Statutory Amendment Full Lifecycle Implementation Plan (v6.99.2)

## 1. Objective
Establish an end-to-end, resilient document lifecycle across SMRITI Billing and Sales Invoicing. Specifically:
1. Isolate the Billing Terminal Hold/Park (F12) mechanism by binding it to the non-inventory, non-ledger POS Parked Cart backend (`pos_parked_carts`), preventing premature warehouse batch stock deduction and customer ledger debiting.
2. Implement a formal "Save as Draft" workflow for Sales Invoices (`status = "Draft"`), allowing partial composition, persistence, item updates, and explicit promotion to `POSTED` via `UniversalLifecycleEngine` without double stock movements.
3. Deliver a GST-compliant Statutory Amendment protocol (ADR-005 compliant) allowing users to either issue a pre-linked Credit Note / Sales Return (CGST Sec 34(1)) or perform a supervisor-authorized "Cancel & Re-issue" workflow that restores inventory and re-populates the billing terminal for immediate correction.

## 2. Business Motivation
In retail and distribution billing, cashiers frequently need to park a transaction while a customer fetches another item, or save an incomplete wholesale quotation/order as a draft for accountant verification.
Previously, clicking "Hold / Park (F12)" in `BillingTerm.tsx` dispatched a standard `POST /sales/invoices` call with `status: "Suspended"`. Because `CanonicalSalesPostingWriter` lacked a draft guard, it deducted inventory stock from the warehouse (`OUTWARD_SALE`) and posted customer credit immediately. If the bill was subsequently recalled and settled, stock was deducted a second time.
Furthermore, under Indian GST compliance, issued tax invoices cannot be modified via arbitrary in-place edits or unstructured revision chains. This plan establishes complete lifecycle parity adhering to statutory GST laws and SMRITI architecture.

## 3. Scope
- **In-Scope:**
  - `BillingTerm.tsx`: Re-wire F12 Hold / Recall to `POST /api/v1/pos/parked-carts` and `POST /api/v1/pos/recall-cart`.
  - `BillingTerm.tsx`: Add explicit "Save as Draft" action in More Menu and settlement flow.
  - `CanonicalPostingRequest` & `CanonicalSalesPostingWriter`: Add `is_draft` support so draft invoices persist without mutating WMS batch stock or financial ledgers.
  - `backend/app/api/v1/sales.py`: Add `POST /api/v1/sales/invoices/{id}/submit` endpoint triggering `UniversalLifecycleEngine` transition `DRAFT -> POSTED`.
  - `InvoicingTransactionBrowserModal.tsx` & `BillingTerm.tsx`: Add "Amend / Correct Invoice" interface providing statutory Credit Note issuance and authorized Cancel & Re-issue.
  - Comprehensive Pytest and Vitest test coverage for draft creation, park/recall, draft submission, and statutory amendment.
- **Out-of-Scope:**
  - PO revision chains (`parent_order_id`, `amend_revision` on purchase orders remains unchanged).
  - Express legacy adapters (already decommissioned).

## 4. Current State
- `SalesInvoice` model has `status = Column(String(20), default="Draft")`.
- `SalesInvoiceLifecycleHandler` defines transitions `DRAFT -> SUBMITTED -> POSTED -> PAID -> CANCELLED`.
- However, `POST /sales/invoices` delegates directly to `CanonicalSalesPostingWriter`, which hardcodes `status="Submitted"`, executes `wms_svc.atomic_mutate_batch_stock(movement_type="OUTWARD_SALE")`, and creates payment tenders.
- Holding an invoice in `BillingTerm.tsx` attempts `POST /sales/invoices` with `status: "Suspended"`, causing premature stock deduction or falling back to local React state on error.
- Inspected invoices in `BillingTerm.tsx` are locked in `isReadOnlyView = true` with no direct path to correct errors or generate Credit Notes.

## 5. Gap Analysis
1. **Cart Isolation Gap:** Hold/Park in Billing Terminal was not connected to `pos_parked_carts`.
2. **Draft Posting Guard Gap:** `CanonicalSalesPostingWriter` had no branch to skip stock and payment execution when `is_draft=True`.
3. **Draft Submission Endpoint Gap:** No single-call API existed for submitting and finalizing a draft invoice through the universal lifecycle engine.
4. **Amendment Workflow Gap:** No UI action existed on audited invoices to trigger statutory GST credit notes or authorized cancellation/re-issue.

## 6. Architecture Impact
- **Database:** Zero schema migrations required. `pos_parked_carts` and `sales_invoices` already have the necessary columns and JSONB snapshot storage.
- **Ledger & Stock Safety:** Drafts and parked carts are guaranteed to produce zero stock ledger movements and zero GL journal entries.
- **Statutory Compliance:** Enforces ADR-005 Decision 2 (Immutable Historical Facts & Statutory Amendment Protocol).

## 7. Proposed Design
```text
[ Billing Terminal ]
   │
   ├─► F12 "Hold / Park" ─────► POST /api/v1/pos/parked-carts (No Stock / No GL)
   │                             └─► Stored in pos_parked_carts
   │
   ├─► "Recall Held Cart" ────► POST /api/v1/pos/recall-cart
   │                             └─► Restores Cart Snapshot to Terminal
   │
   ├─► "Save as Draft" ───────► POST /api/v1/sales/invoices (is_draft = True)
   │                             └─► SalesInvoice (status="Draft", No Stock / No GL)
   │
   ├─► "Submit & Settle" ─────► POST /api/v1/sales/invoices/{id}/submit
   │                             └─► UniversalLifecycleEngine (DRAFT -> POSTED)
   │                                   ├─► SalesStockAuthority.record_outward_sale
   │                                   └─► UnifiedAccountingLedgerService.post_sales_invoice_to_gl
   │
   └─► "Amend / Correct" ─────► Audit Mode Action Dropdown
                                 ├─► Option A: Issue Credit Note / Sales Return
                                 └─► Option B: Manager Cancel & Re-issue to Cart
```

## 8. Files Created
- `docs/implementation/billing/Billing_Draft_Submit_Amend_Lifecycle_Plan_v6.99.2.md`
- `docs/walkthrough/billing/Billing_Draft_Submit_Amend_Lifecycle_v6.99.2.md`
- `backend/tests/test_billing_draft_submit_lifecycle.py`
- `src/tests/billingDraftSubmitLifecycle.test.ts`

## 9. Files Modified
- `backend/app/schemas/canonical_posting.py`
- `backend/app/schemas/sales.py`
- `backend/app/services/canonical_sales_writer.py`
- `backend/app/services/sales.py`
- `backend/app/api/v1/sales.py`
- `src/components/billing/BillingTerm.tsx`
- `src/components/billing/InvoicingTransactionBrowserModal.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy AsyncSession
- `SalesStockAuthority`
- `UnifiedAccountingLedgerService`
- `UniversalLifecycleEngine`

## 11. Risks
- *Risk:* Existing API callers expecting immediate posting on `POST /sales/invoices`.
  *Mitigation:* Default `is_draft=False` on `SalesInvoiceCreate` so all standard checkout flows continue immediate submission unless explicitly flagged.
- *Risk:* Double stock reversal on cancellation.
  *Mitigation:* Ensure cancellation checks `status in ("POSTED", "SUBMITTED")` before reversing stock; drafts never trigger stock reversal.

## 12. Rollback Strategy
All changes are non-destructive and backward compatible. Rolling back to commit `efd19c1e` returns to previous behavior.

## 13. Verification Plan
1. Run pytest suite testing:
   - Saving draft invoice does NOT create stock movements or ledger vouchers.
   - Updating draft invoice succeeds.
   - Submitting draft invoice deducts stock and creates GL vouchers.
   - Cancelling posted invoice restores stock.
2. Run vitest suite testing:
   - F12 Hold dispatches to `/pos/parked-carts`.
   - Recall restores items.
   - Save as draft dispatches with `is_draft: true`.
   - Amend dropdown renders Credit Note and Cancel & Re-issue actions.
3. Validate code formatting and git diff.

## 14. Test Plan
- Unit test: `backend/tests/test_billing_draft_submit_lifecycle.py`
- Frontend test: `src/tests/billingDraftSubmitLifecycle.test.ts`
- Regression test: `npx vitest run src/tests/billingTerm.test.ts`

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Generate `docs/walkthrough/billing/Billing_Draft_Submit_Amend_Lifecycle_v6.99.2.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md`

## 16. Deployment Plan
Commit and push to branch `smritiNX`. Sync to test environment via `git pull --ff-only origin smritiNX`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `docs/adr/ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_POS_Counter_Resilience_Park_Recall_Clawback_And_Customer_Switch_v6.30.0.md`
- `docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md`
