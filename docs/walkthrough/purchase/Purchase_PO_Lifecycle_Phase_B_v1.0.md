# Purchase_PO_Lifecycle_Phase_B_v1.0.md
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

## 1. Purpose

Implement Phase B of the SMRITI Purchase Order lifecycle: a **status-aware PO
Workspace** that lets users view, filter, and act on existing POs by their lifecycle
status (DRAFT, SUBMITTED, CONFIRMED, RECEIVED, CANCELLED), with role-gated action
buttons for Submit, Confirm, and Cancel operations.

---

## 2. Scope

| In Scope | Out of Scope |
|----------|-------------|
| `GET /purchase/orders/?status=` filter (backend) | Deep-link to edit a specific DRAFT PO in the generation panel |
| `POWorkspaceTab.tsx` — status-tabbed list workspace | Phase C: Full cancellation UI with policy picker |
| `PurchaseStudioTab.tsx` v4.0.0 — Generate/Workspace switcher | Phase D: Amendment/revision PO chain |
| 5 Phase B tests (T21–T25) | Phase E: Configurable per-tenant RBAC matrix |
| CHANGELOG v6.46.0 | |

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `src/components/purchase/POWorkspaceTab.tsx` | Status-aware PO workspace component (655 lines) |
| `docs/walkthrough/purchase/Purchase_PO_Lifecycle_Phase_B_v1.0.md` | This document |
| `docs/implementation/purchase/PO_Lifecycle_Phase_B_v1.0.md` | IPGP implementation plan |

---

## 4. Files Modified

| File | Change Summary |
|------|---------------|
| `backend/app/services/purchase.py` | `list_purchase_orders()` adds `status: Optional[str]` with comma-split + uppercase normalisation |
| `backend/app/api/v1/purchase.py` | `GET /orders/?status=` query param exposed; service call updated |
| `backend/app/tests/test_purchase.py` | T21–T25 Phase B status filter tests appended (54 total) |
| `src/components/PurchaseStudioTab.tsx` | v3.33.0 → v4.0.0: top-level Generate/Workspace tab switcher |
| `CHANGELOG.md` | v6.46.0 entry |

---

## 5. Architecture Decisions

### AD-B1: Status Filter in Service Layer, Not API Layer
**Decision:** Normalisation (uppercase, comma-split) performed inside `list_purchase_orders()` service method.
**Rationale:** Keeps the API parameter dumb (raw string). Future callers (CLI scripts, batch jobs) can invoke the service directly with the same normalisation logic.

### AD-B2: Comma-Separated Multi-Status Over Multiple `?status=` Params
**Decision:** `?status=DRAFT,SUBMITTED` rather than `?status=DRAFT&status=SUBMITTED`.
**Rationale:** Simpler URL construction in the frontend (`URLSearchParams` with a single key). Backend uses `str.split(",")` before passing to `PurchaseOrder.status.in_()`.

### AD-B3: Frontend-Only Workspace (No New API Route)
**Decision:** `POWorkspaceTab` reuses the existing `GET /purchase/orders/` contract URL with the new `?status=` param.
**Rationale:** No new API route needed; the existing route is the canonical contract URL and is already tested (T21–T25).

### AD-B4: Generate/Workspace as Top-Level Toggle, Not Separate Route
**Decision:** Integrate `POWorkspaceTab` as a sibling view inside `PurchaseStudioTab` via a pill switcher rather than a separate navigation route.
**Rationale:** Preserves the current module architecture (single tab per module registration); avoids changes to `TabRenderer.tsx` and the navigation registry. Phase E can promote Workspace to its own route if needed.

### AD-B5: Tab-Count Populated Per-Switch, Not Upfront
**Decision:** Tab counts are fetched lazily when a user clicks a tab.
**Rationale:** Avoids 6 parallel API calls on initial load. A single "All" fetch on mount provides the initial context; per-tab counts update as users navigate.

---

## 6. Design Rationale

- **Role guard at UI layer:** Non-Manager users see all POs in read-only mode; action buttons are hidden and an info banner explains the requirement. The backend RBAC guards (Phase A) remain the authoritative enforcement layer.
- **Cancel with reason dialog:** Matches Phase A backend `cancel_purchase_order` which requires a `reason` field; prevents silent cancellations.
- **Status badge reuse:** `POStatusBadge` in the workspace mirrors the colour/icon system from `poLifecycle.ts`; single source of truth for status display.
- **`onOpenPO` callback:** Switches to Generate view with an informational notification. Full deep-link editing is Phase C scope.

---

## 7. Implementation Summary

1. `list_purchase_orders()` service: added `status: Optional[str]` parameter; splits by comma, uppercases each token, passes to `PurchaseOrder.status.in_(statuses)`.
2. API endpoint `GET /orders/?status=`: added `status` `Query` parameter; forwarded to service.
3. `POWorkspaceTab.tsx` (new, 655 lines):
   - 6 `StatusTabDef` objects drive tab rendering (icon, colour, badge style).
   - `fetchOrders(tab)` fires `apiFetchV1("/purchase/orders/?status=<tab>")` on tab switch.
   - Inline `CancelDialog` component collects cancellation reason before calling `POST /orders/{id}/cancel`.
   - `handleSubmit`, `handleConfirm`, `handleCancelConfirmed` post to Phase A endpoints.
   - Per-PO `actionLoading[id]` state prevents double-clicks.
4. `PurchaseStudioTab.tsx` v4.0.0: `topView` state switches between `"generate"` and `"workspace"`. Sub-mode switcher (`sizewise`/`standard`) only renders in generate view.
5. Five Phase B tests (T21–T25) verify single-status, no-status, exclusion, and multi-status filter behaviour.

---

## 8. Tests Executed

**Command:**
```
pytest backend/app/tests/test_purchase.py -v --tb=short -k "phaseB"
5 passed, 49 deselected, 14 warnings in 79.47s

pytest backend/app/tests/test_purchase.py -v --tb=short
54 passed, 14 warnings in 73.80s
```

| Test | Scenario | Result |
|------|----------|--------|
| T21 | `?status=DRAFT` returns only DRAFT POs | PASSED |
| T22 | `?status=SUBMITTED` returns only SUBMITTED | PASSED |
| T23 | No `status=` returns all statuses | PASSED |
| T24 | `?status=CONFIRMED` excludes DRAFT and SUBMITTED | PASSED |
| T25 | `?status=DRAFT,SUBMITTED` multi-value filter | PASSED |

---

## 9. Verification Results

| Check | Evidence | Status |
|-------|----------|--------|
| TypeScript type check | `npx tsc --noEmit` exit 0 | Done |
| Phase A regression | 49/49 original tests PASSED | Done |
| Phase B tests | 5/5 PASSED | Done |
| Full suite | 54/54 PASSED | Done |
| Commit pushed | `178f8c99` on `smritiNX` | Done |

---

## 10. Known Limitations

- Tab counts are fetched per-tab-click, not shown on initial load for all tabs simultaneously.
- `onOpenPO` shows an informational toast rather than deep-linking into a specific PO's edit form (Phase C).
- `supplier_name` is only available if the backend `PurchaseOrderResponse` schema returns it; falls back to `supplier_id` if null.
- The `RECEIVED` / `COMPLETED` tabs are display-only — no action buttons for those statuses (correct: GRN workflow owns RECEIVED).

---

## 11. Future Work

| Phase | Description |
|-------|------------|
| Phase C | Cancellation policy picker: role-specific cancellation reasons dropdown |
| Phase D | Amendment/revision chain: `parent_order_id` linkage, diff view |
| Phase E | Configurable RBAC: per-tenant approval role matrix |
| Phase F | Deep-link edit: `onOpenPO(orderNo)` switches to generate panel and pre-loads the PO |
| Phase G | Pagination: server-side `page` / `page_size` for large PO volumes |

---

## 12. Related ADRs

- ADR-PUR-001: PO Two-Stage Approval Lifecycle (Phase A)
- ADR-PUR-002: Status-Aware Workspace via Contract URL Filter (to be filed)

---

## 13. Related RFCs

- RFC-PUR-2026-001: DRAFT→SUBMITTED→CONFIRMED (Phase A)
- RFC-PUR-2026-002: Status-Aware PO Workspace (to be filed)
