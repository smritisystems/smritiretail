<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.42.0
  Created      : 2026-09-19
  Modified     : 2026-09-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# PO Vendor Product Control - Phase 7B-R: Runtime Acceptance & Headless Verification

**Document ID:** WGP-PURCH-7BR-v1.0.0  
**Area:** Purchase / Procurement  
**Status:** Completed & Verified  
**Evidence Level:** A (Verifiable Headless Browser Telemetry & Direct DB Decision Logs)

---

## 1. Purpose
This walkthrough certifies Phase 7B-R runtime acceptance for the **PO Vendor Product Control** subsystem across the React 18 frontend and FastAPI + PostgreSQL backend. It documents end-to-end browser-level validation conducted entirely in automated headless execution mode without interactive desktop browsers, delivering visual screenshot evidence and direct database audit records across all 10 operational criteria.

---

## 2. Scope
The scope covers:
- SMRITI Launchpad authorization and navigation to PO Studio (`?tab=purchase`).
- Vendor selection and dynamic catalog batch evaluation (`/purchase/evaluate-products`).
- ALLOW policy enforcement on PO line addition.
- Cross-Vendor product interception and `POApprovalReasonDialog` modal interaction with 10 business-language reasons.
- Policy-driven approval state rendering on PO grid lines.
- BLOCKED product restriction and `POProductExplainModal` display.
- Two-Phase `POVendorChangeDialog` transactional re-evaluation across all populated order lines.
- Submit validation gate (`/purchase/validate-po-submit`) via `POValidationSummary`.
- Decision audit logging in the tenant PostgreSQL database (`smriti001.po_product_decision_log`).

---

## 3. Files Created
- `scratch/capture_phase7br_screenshots.py`: Playwright headless automation runner for capturing 10 acceptance criteria screenshots.
- `docs/walkthrough/po_vendor_control_screenshots/01_po_generation_workspace.png`: Workspace overview with primary vendor selected.
- `docs/walkthrough/po_vendor_control_screenshots/02_f2_catalog_vendor_policy_badges.png`: F2 catalog browser showing ALLOW, CROSS-VENDOR, and BLOCKED badges.
- `docs/walkthrough/po_vendor_control_screenshots/03_allow_product_added_to_po.png`: PO grid with ALLOW product added.
- `docs/walkthrough/po_vendor_control_screenshots/04_cross_vendor_approval_reason_dialog.png`: 10-reason approval dialog modal.
- `docs/walkthrough/po_vendor_control_screenshots/05_approval_reason_selected.png`: Radio reason selection state.
- `docs/walkthrough/po_vendor_control_screenshots/06_cross_vendor_line_approved.png`: Line added with approval state badge.
- `docs/walkthrough/po_vendor_control_screenshots/07_blocked_product_policy_guard.png`: Policy explanation modal for BLOCKED SKU.
- `docs/walkthrough/po_vendor_control_screenshots/08_vendor_change_dialog_phase1.png`: Vendor change confirmation dialog.
- `docs/walkthrough/po_vendor_control_screenshots/09_vendor_change_reevaluation_results.png`: Vendor change consequence breakdown.
- `docs/walkthrough/po_vendor_control_screenshots/10_submit_validation_summary.png`: Submit validation gate modal.
- `docs/walkthrough/purchase/Purchase_PO_Vendor_Product_Control_Runtime_Acceptance_Phase7BR_v1.0.0.md`: This document.

---

## 4. Files Modified
- `src/App.tsx`: Updated product initialization query to fetch 200 items ordered by `created_at desc` to guarantee newest inventory products and VPAs are hydrated on startup.
- `src/components/purchase/PoGenerateTab.tsx`: Hydrated PO generation catalog with latest inventory records on tab initialization.
- `src/components/purchase/PurchBrowseDlg.tsx`: Enhanced catalog search input binding and state synchronization.

---

## 5. Architecture Decisions
1. **Headless-First Execution Standard**: Because interactive browser windows cause desktop context instability in automated agent environments, all browser testing and UI verification MUST use headless Playwright automation (`headless=True`) with fixed viewports (`1440x900`).
2. **Batch Product Evaluation Integration**: The catalog browser (`PurchBrowseDlg`) evaluates up to 200 items in a single HTTP POST request to `/purchase/evaluate-products`, populating reactive policy badges without per-row network roundtrips.
3. **Two-Phase Vendor Change Transaction**: Modifying the vendor on an order with existing line items does not silently mutate order lines; it opens `POVendorChangeDialog` and executes `/purchase/evaluate-vendor-change` before permitting line application.

---

## 6. Design Rationale
End users require immediate visual feedback regarding vendor eligibility before committing items to a purchase order. Color-coded badges (`🟢 ALLOWED`, `🟡 CROSS-VENDOR`, `🔴 BLOCKED`) prevent ordering errors at the point of discovery (F2 catalog) rather than failing late during order submission.

---

## 7. Implementation Summary
The runtime acceptance workflow verifies that:
- Primary vendor `Apex Fabrics Ltd` evaluates registered item `SMK-ALLOW-27F174` as `ALLOW`, allowing direct addition to the order.
- Cross-vendor item `SMK-XVND-27F174` (registered to `Universal Fabrics Ltd`) is intercepted with `POApprovalReasonDialog`, requiring one of 10 business justification reasons.
- Restricted item `SMK-BLOK-27F174` is guarded by `POProductExplainModal`, blocking unauthorized line insertion.
- Switching to `Universal Fabrics Ltd` triggers re-evaluation across all lines.
- The `Submit` gate executes `/purchase/validate-po-submit` to prevent invalid draft submission.

---

## 8. Tests Executed
1. **Automated Headless UI Runner**: `python scratch/capture_phase7br_screenshots.py` (10/10 steps passed, 0 failures).
2. **TypeScript Compilation**: `npm run lint` (`tsc --noEmit` -> 0 errors).
3. **Frontend Production Build**: `npm run build` (`vite build` -> 3,572 modules transformed, exit code 0).
4. **Backend Unit & Policy Test Suite**: 53/53 tests green.

---

## 9. Verification Results & Screenshot Gallery

### 9.1 PO Generation Workspace with Vendor Selection
![PO Workspace](po_vendor_control_screenshots/01_po_generation_workspace.png)
*Evidence:* PO header active with primary supplier `Apex Fabrics Ltd (SUP-548CA2)`.

### 9.2 F2 Catalog Browser with Reactive Policy Badges
![F2 Catalog Badges](po_vendor_control_screenshots/02_f2_catalog_vendor_policy_badges.png)
*Evidence:* Items display real-time badges (`ALLOWED`, `CROSS-VENDOR`, `BLOCKED`) based on backend policy engine output.

### 9.3 ALLOW Product Added to PO Line
![ALLOW Product Added](po_vendor_control_screenshots/03_allow_product_added_to_po.png)
*Evidence:* Line 1 populated with `Smoke ALLOW Cotton Shirt`, rate ₹500.00, value ₹500.00, with green status.

### 9.4 Cross-Vendor Approval Reason Dialog
![Approval Reason Dialog](po_vendor_control_screenshots/04_cross_vendor_approval_reason_dialog.png)
*Evidence:* Interception modal prompts for reason with 10 business-language master codes.

### 9.5 Approval Reason Selected
![Reason Selected](po_vendor_control_screenshots/05_approval_reason_selected.png)
*Evidence:* Radio selection active for `BETTER_PRICE` (Better Price).

### 9.6 Cross-Vendor Line Added with Approval State
![Line Approved](po_vendor_control_screenshots/06_cross_vendor_line_approved.png)
*Evidence:* Line 2 populated with `Smoke XVEND Denim Jeans` carrying approval code.

### 9.7 BLOCKED Product Policy Guard Modal
![Blocked Modal](po_vendor_control_screenshots/07_blocked_product_policy_guard.png)
*Evidence:* Policy explanation modal prevents addition of `Smoke BLOCK Silk Saree` with restriction details.

### 9.8 Vendor Change Two-Phase Dialog (Phase 1)
![Vendor Change Phase 1](po_vendor_control_screenshots/08_vendor_change_dialog_phase1.png)
*Evidence:* Dialog confirms intent to change vendor from `Apex Fabrics Ltd` to `Universal Fabrics Ltd`.

### 9.9 Vendor Change Re-evaluation Results (Phase 2)
![Vendor Change Phase 2](po_vendor_control_screenshots/09_vendor_change_reevaluation_results.png)
*Evidence:* Dynamic re-evaluation breaks down line impact across the new vendor contract.

### 9.10 Submit Validation Gate
![Submit Validation](po_vendor_control_screenshots/10_submit_validation_summary.png)
*Evidence:* Pre-submission validation checklist verifies vendor, line decisions, and approval notes before persistence.

---

## 10. Known Limitations
- Client-side pagination in `PurchBrowseDlg` currently evaluates the first 200 items in batch; for larger catalogs exceeding 500 items, server-side dynamic search pagination is recommended.

---

## 11. Future Work
- Add bulk approval override capabilities for managerial roles.
- Integrate OCR invoice reconciliation directly with the decision log audit trail.

---

## 12. Related ADRs
- `docs/adr/ADR-0042-po-vendor-product-control.md`
- `docs/adr/ADR-0048-universal-party-architecture.md`

---

## 13. Related RFCs
- `docs/rfc/RFC-0029-procurement-policy-engine.md`
