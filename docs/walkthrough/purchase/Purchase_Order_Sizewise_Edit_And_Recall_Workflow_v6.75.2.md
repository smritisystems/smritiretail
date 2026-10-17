<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.2
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Purchase Order Sizewise Edit & Recall Workflow (v6.75.2)

## 1. Purpose
Enable a complete, end-to-end purchase order editing and recall lifecycle directly inside the **Sizewise Matrix UX Mode** (`PoSizewiseTab.tsx`). Users can recall existing draft or submitted purchase orders, view and modify size distributions across size scales (Footwear EU 36–44, UK 6–11, Apparel Alpha), apply automated ratio recommendations (Gaussian Bell Curve, Core Sizes, Uniform), and commit in-place updates via `PUT /api/v1/purchase/orders/{order_id}` with zero duplication of PO numbers.

## 2. Scope
- **Backend API & Service:**
  - Addition of `update_purchase_order` in `backend/app/services/purchase.py`.
  - Registration of `PUT /api/v1/purchase/orders/{order_id}` and `PUT /api/v1/purchase/orders/{order_id}/` in `backend/app/api/v1/purchase.py`.
  - Validation of line items through `ProductResolutionService.validate_line` and atomic replacement of child items via SQLAlchemy `cascade="all, delete-orphan"`.
- **Frontend UI & State:**
  - `src/components/purchase/PoSizewiseTab.tsx`: Edit Banner for active editing session, Open / Recall Modal (`#sw-open-po-btn`), New PO reset (`#sw-new-po-btn`), Items Grid toolbar "Recommend Ratio" dropdown, and save/update handler targeting `PUT /purchase/orders/{id}`.
  - `src/components/PurchaseStudioTab.tsx`: Deep-linking and prop passing (`orderToEdit`, `onClearOrderToEdit`).
- **Headless E2E Verification:**
  - Comprehensive Playwright capture script (`scripts/capture_po_sizewise_edit_headless.py`) running strictly headless (zero browser popups) verifying modal recall, matrix loading, cell editing, assortment recommendation, and draft update commitment.

## 3. Files Created
- `scripts/capture_po_sizewise_edit_headless.py`: Headless Playwright script executing and capturing all stages of the Sizewise PO editing workflow.
- `docs/walkthrough/purchase/evidence/06_po_sizewise_open_recall_modal.png`: Screenshot of the Recall Purchase Order dialog.
- `docs/walkthrough/purchase/evidence/01_po_sizewise_editing_mode_loaded.png`: Screenshot showing PO recalled into Sizewise Matrix with active Edit Banner.
- `docs/walkthrough/purchase/evidence/02_po_sizewise_cell_editing.png`: Screenshot of direct cell editing across EU footwear sizes.
- `docs/walkthrough/purchase/evidence/03_po_sizewise_recommend_ratio_dialog.png`: Screenshot of the Recommend Ratio assortment options menu.
- `docs/walkthrough/purchase/evidence/04_po_sizewise_recommend_ratio_applied.png`: Screenshot showing the Bell Curve distribution applied across 9 sizes.
- `docs/walkthrough/purchase/evidence/05_po_sizewise_update_draft_committed.png`: Screenshot showing the "Purchase Order Saved" confirmation dialog and success toasts.
- `docs/walkthrough/purchase/Purchase_Order_Sizewise_Edit_And_Recall_Workflow_v6.75.2.md`: This walkthrough document.

## 4. Files Modified
- `backend/app/api/v1/purchase.py`: Added PUT contract endpoints for `/orders/{order_id}` and `/orders/{order_id}/`.
- `backend/app/services/purchase.py`: Implemented `update_purchase_order` with `ProductResolutionService.validate_line`, variant resolution, and relationship cascade management.
- `src/components/PurchaseStudioTab.tsx`: Added `orderToEdit` state management and routing from Workspace.
- `src/components/purchase/PoSizewiseTab.tsx`: Implemented Edit Banner, Open / Recall modal, Recommend Ratio toolbar dropdown, and `handleSavePO` update logic.
- `docs/walkthrough/README.md`: Appended master walkthrough index entry.

## 5. Architecture Decisions
1. **In-Place Modification for Draft / Submitted Orders:**
   - Existing orders in `DRAFT` or `SUBMITTED` status can be edited in place without incrementing `amend_revision` or generating duplicate order numbers. Confirmed orders continue to use the strict Statutory Amendment workflow (`POST /orders/{order_id}/amend`).
2. **Cascade Delete-Orphan via SQLAlchemy Collection:**
   - Rather than executing raw deletes against `purchase_order_items`, calling `order.items.clear()` followed by `order.items.append(poi)` relies on the ORM's `cascade="all, delete-orphan"` mapping, eliminating detached instance and unique constraint conflicts.
3. **Canonical Line Item Validation:**
   - Item rows pass through `ProductResolutionService.validate_line` using `TransactionLineItemInput`, guaranteeing strict checking of active status, HSN classification, and multi-variant ambiguity (Rule R-01 / ADR-001).

## 6. Design Rationale
In retail fashion and footwear merchandising, buyers frequently need to adjust assortment curves based on stock replenishment forecasts before finalizing a PO. The Sizewise Matrix tab previously only supported net-new generation. Adding direct PO recall, in-grid editing, and statistical ratio recommendation brings high velocity and eliminates tedious manual re-entry.

## 7. Implementation Summary
- **Backend PUT Endpoint:**
  - Added `@router.put("/orders/{order_id}")` with role-based dependencies (`MANAGER`, `SYSADMIN`, `PURCHASE_EXECUTIVE`).
  - Implemented `PurchaseService.update_purchase_order(order_id, order_in)` verifying tenant company isolation, updating header attributes (supplier, notes, delivery date), clearing old lines, validating and appending new items, and recalculating subtotal, taxes, and grand total.
- **Frontend Sizewise Tab Enhancements:**
  - Added an Edit Banner displaying: `Editing Purchase Order: PO-XXXXXX · Status: SUBMITTED` with an exit button to return to fresh generation.
  - Added `[Open]` button in header bar opening the `Recall Purchase Order for Editing` modal with quick search and recent order selection.
  - Added `[Recommend Ratio]` dropdown to the Items Grid toolbar allowing one-click application of Bell Curve, Core Sizes (60/40), and Uniform ratios.
  - Bound the `[Update Draft]` / `[Update & Confirm]` footer buttons to `PUT /purchase/orders/${editingOrderId}`.

## 8. Tests Executed
1. **Python Syntax Compilation:**
   ```powershell
   python -m py_compile backend/app/services/purchase.py
   # Exit code: 0
   ```
2. **Frontend Production Build:**
   ```powershell
   npm run build
   # Exit code: 0, 3715 modules transformed in 47.39s
   ```
3. **Headless Playwright End-to-End Verification:**
   ```powershell
   python scripts/capture_po_sizewise_edit_headless.py
   # Exit code: 0, 6 evidence screenshots captured and synced
   ```
4. **Database State Verification:**
   ```sql
   SELECT id, order_no, status, subtotal, tax_total, grand_total, modified_at 
   FROM purchase_orders WHERE order_no = 'PO-978758';
   -- Result: PO-978758 | SUBMITTED | subtotal: 83820.00 | tax_total: 4191.00 | grand_total: 88011.00
   ```

## 9. Verification Results
| Step | Action | Expected Output | Status |
|---|---|---|---|
| Step 1 | Click `[Open]` in Sizewise Mode | Recall Modal displays recent POs | **Done** |
| Step 2 | Enter `PO-978758` and recall | Matrix populates with items and Edit Banner appears | **Done** |
| Step 3 | Direct cell edit (sizes 36: 24, 37: 36, 38: 48) | In-grid totals and summary cards recalculate | **Done** |
| Step 4 | Click `[Recommend Ratio]` -> Bell Curve | Bell curve distributed across sizes (36–44) totaling 127 pairs | **Done** |
| Step 5 | Click `[Update Draft]` | `PUT /purchase/orders/01a...` returns 200 OK, success dialog shown | **Done** |

## 10. Known Limitations
- Editing is restricted to `DRAFT` and `SUBMITTED` orders. Orders in `CONFIRMED`, `PARTIAL_RECEIVED`, or `RECEIVED` status must use the formal PO Amendment workflow.

## 11. Future Work
- Support multi-article batch recall in Sizewise mode where multiple styles share a single purchase order.
- Add preset import for historical size assortment curves from POS sales velocity.

## 12. Related ADRs
- `ADR-001`: Variant Disambiguation and Explicit Variant ID Enforcement.
- `ADR-042`: Dual-Key Transitional Architecture and Canonical Identity Verification.

## 13. Related RFCs
- `RFC-019`: Sizewise Matrix UX for Apparel and Footwear Procurement.
- `RFC-024`: Canonical Product Resolution Service.
