<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.5.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 SMRITI Migration Parity -- Sprint 20 v1.5.0

> Supersedes: `Legacy_Shoper9_SMRITI_Migration_v1.4.0.md` (Sprint 19 + TSC fix)
> This document covers Sprint 20: PHY-008 barcode scan-to-count + CRM Loyalty Adjustment UI.

---

## 1. Purpose

**Sprint 20** delivers two UX acceleration features:

**PHY-008 Barcode Scan-to-Count** — Adds a persistent barcode input bar inside the Physical Stock Count session detail panel. Staff can scan item barcodes continuously during a physical count; each scan auto-increments `counted_qty` via PHY-006 and provides immediate flash feedback. This replaces the manual click-to-edit workflow for high-volume counting scenarios, directly matching Shoper9's SR323400 barcode scanning mode.

**CRM Loyalty Adjustment UI** — Adds a `Loyalty Adjustments` sub-tab to `CrmStudioTab` with a full form panel (`LoyaltyAdjPanel`) for MANAGER-gated BONUS point grants and EXPIRY deductions. Previously only accessible via raw API (LYL-ADJ-001/002); now surfaced through a structured UI with role validation, flash feedback, and reference tracking.

---

## 2. Scope

| Item | Type | Component |
|---|---|---|
| `ScanBar` React component | Frontend feature | `PhysicalStockTab.tsx` |
| Barcode → PHY-006 PATCH auto-submit | Frontend → Backend | `PhysicalStockTab.tsx` |
| `ScanLine` icon import | Frontend | `PhysicalStockTab.tsx` |
| File header v1.1.0 → v1.2.0 | Metadata | `PhysicalStockTab.tsx` |
| `LoyaltyAdjPanel` React component | Frontend feature | `CrmStudioTab.tsx` |
| `loyalty` sub-tab in CRM nav bar | Frontend | `CrmStudioTab.tsx` |
| `apiFetchV1` import + Gift/Minus/Star/Loader2 icons | Frontend | `CrmStudioTab.tsx` |
| File header v3.28.0 → v3.29.0 | Metadata | `CrmStudioTab.tsx` |

---

## 3. Files Created

None — Sprint 20 is entirely modifications.

---

## 4. Files Modified

| File | Change Summary |
|---|---|
| `src/components/PhysicalStockTab.tsx` | +94 lines: `ScanBar` component + render + icon import + header v1.2.0 |
| `src/components/CrmStudioTab.tsx` | +206 lines: `LoyaltyAdjPanel` + loyalty tab + icons + `apiFetchV1` import |
| `CHANGELOG.md` | v3.35.0 entry |

---

## 5. Architecture Decisions

### A. ScanBar Uses PHY-006 (Not a Dedicated Scan Endpoint)
Rather than adding PHY-008 as a backend endpoint, scan-to-count is implemented as a client-side lookup against the already-loaded `count_lines`, followed by a PHY-006 PATCH. This avoids a server round-trip for the lookup and keeps the backend API surface minimal. The tradeoff is that ScanBar only works when the session detail is already loaded.

### B. ScanBar Increments by +1 Per Scan
Each scan increments `counted_qty` by exactly 1 (or starts from 0 if not yet counted). This matches physical scanner behavior where each barcode beep represents one physical item passing the scanner beam. Batch entry (e.g., scan ×10) remains available via the manual `CountCell` click-to-edit.

### C. onSaved Signature Alignment
`ScanBar.onSaved` uses the same `(lineId: string, countedQty: number, varianceQty: number)` signature as `handleSaved` in the parent `SessionDetail` component. This avoids introducing a second update pathway and keeps the optimistic UI state update logic in a single place.

### D. LoyaltyAdjPanel Is Inline (Not a Separate File)
`LoyaltyAdjPanel` is defined at the bottom of `CrmStudioTab.tsx` as a file-local component, consistent with how `CompleteBtn` and `ScanBar` are defined in `PhysicalStockTab.tsx`. It will be extracted to `src/components/crm/LoyaltyAdjPanel.tsx` when the CRM module grows further.

### E. Role Guard at UI Layer Only
The MANAGER role check in `LoyaltyAdjPanel` is a UX guard (shows a warning banner). The real authorization enforcement is on the backend (PHY: `get_current_user` role check in the LYL-ADJ-001/002 endpoints). The UI guard provides early feedback without a network round-trip.

---

## 6. Design Rationale

- **`ScanBar` always visible during editable sessions** — Staff should not need to toggle a "scan mode". The bar is always present at the top of the count table when the session is OPEN or IN_PROGRESS, so it's always ready without any extra clicks.
- **Flash duration 2 seconds** — Long enough to read, short enough not to interrupt scanning rhythm. Hardware barcode scanners typically emit one scan every 0.3–1.0 seconds.
- **`autoFocus` on scan input** — The input auto-focuses on render. This means the scan bar is immediately active when the session detail opens, matching the UX expectation of a dedicated scanning workstation.
- **Loyalty tab Star icon** — Distinguishes the Loyalty tab from text-only CRM tabs at a glance.
- **BONUS/EXPIRY toggle** — Two distinct colored buttons (emerald/red) rather than a dropdown, to make the destructive `expire` action visually distinct from the additive `bonus` action.

---

## 7. Implementation Summary

| Metric | Value |
|---|---|
| New React components | 2 (`ScanBar`, `LoyaltyAdjPanel`) |
| Modified files | 2 |
| Lines inserted | 306 |
| Lines deleted | 10 (version strings + old tab union) |
| New PHY API calls | 0 (reuses PHY-006) |
| New CRM API calls | 0 (reuses LYL-ADJ-001/002) |
| TSC errors | 0 |
| TSC fix iterations | 2 (onSaved signature mismatch caught first run) |

---

## 8. Tests Executed

```
Command: npx tsc --noEmit --strict false  (first run)
Output: src/components/PhysicalStockTab.tsx(611,17): error TS2322
  Type '(lineId, countedQty, varianceQty) => void' not assignable to
  '(updated: CountLine) => void'. Target provides too few args.

Action: aligned ScanBar.onSaved to (lineId: string, countedQty: number,
  varianceQty: number) and updated doScan call site to pass
  (updated.id, updated.counted_qty, updated.variance_qty)

Command: npx tsc --noEmit --strict false  (second run)
Output: (empty stdout) -- exit code 0

Command: python scripts/smriti_naming_guard.py
Output: 0 naming violations found across: src, backend, scripts

Command: git diff --cached --stat
Output: 2 files changed, 306 insertions(+), 10 deletions(-)
```

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| `ScanBar` component defined | Done | `PhysicalStockTab.tsx` line 207 |
| `ScanBar` rendered above count table | Done | Line 611 `<ScanBar sessionId=...>` |
| `id="phy-scan-input"` present | Done | Input id confirmed |
| PHY-006 PATCH on Enter | Done | `doScan` → `apiFetchV1(...PATCH...)` |
| `onSaved` signature aligned | Done | `(lineId, countedQty, varianceQty)` matches `handleSaved` |
| Flash feedback (success + error) | Done | `setFlash` with 2s timeout |
| Guard: hidden when not editable | Done | `if (!editable) return null` |
| `ScanLine` icon imported | Done | `import {..., ScanLine}` |
| `PhysicalStockTab` header v1.2.0 | Done | Line 7 |
| `LoyaltyAdjPanel` component | Done | `CrmStudioTab.tsx` line 254 |
| Loyalty tab in nav bar | Done | `"loyalty"` in tab array |
| BONUS/EXPIRY toggle | Done | `adjType` state + two buttons |
| MANAGER role guard | Done | `canAdjust` check → warning banner |
| `POST /crm/loyalty/.../bonus` | Done | `apiFetchV1(endpoint, {method:"POST"})` |
| `POST /crm/loyalty/.../expire` | Done | Same endpoint with `adjType=expire` |
| Form IDs present | Done | `lyl-adj-bonus-btn`, `lyl-points`, `lyl-adj-submit` |
| Flash feedback | Done | `setFlash` on success/catch |
| `apiFetchV1` imported | Done | `import { apiFetchV1 } from "../lib/apiFetchV1"` |
| TSC exit code 0 | Done | Empty stdout, `exit code 0` |
| NGP 0 violations | Done | `smriti_naming_guard.py` — 0 |
| Push | Done | `501dcd42..f2c9726b smritiNX -> smritiNX` |

---

## 10. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `ScanBar` requires session detail already loaded | If network is slow, scanning before lines load will show "SKU not found" | Lines are fetched on session open; in practice they arrive before scanning starts |
| `ScanBar` increments by exactly +1 per scan | Cannot scan ×N items in one scan event | Manual `CountCell` remains available for bulk entry |
| `LoyaltyAdjPanel` member ID is a free-text field | No autocomplete or member lookup | P2 backlog: add member search by name/mobile |
| `LoyaltyAdjPanel` has no transaction history view | User cannot see past adjustments in the panel | P3 backlog: add `GET /crm/loyalty/members/:id/transactions` call |

---

## 11. Future Work

| Item | Priority |
|---|---|
| Member search/autocomplete in `LoyaltyAdjPanel` | P2 |
| Transaction history view in `LoyaltyAdjPanel` | P3 |
| Extract `LoyaltyAdjPanel` to `src/components/crm/` | P3 (when CRM module grows) |
| Extract `ScanBar` to `src/components/inventory/` | P3 (for reuse in POS) |
| `SalesReturn.customer_id` historical back-fill script | P3 |

---

## 12. Related ADRs

- ADR: PHY-008 scan-to-count via PHY-006 reuse (no new backend endpoint)
- ADR: ScanBar +1 increment per scan
- ADR: `onSaved(lineId, countedQty, varianceQty)` signature alignment
- ADR: `LoyaltyAdjPanel` inline definition (not extracted)
- ADR: UI role guard (not a replacement for backend auth)

---

## 13. Related RFCs

- RFC: PHY-008 `ScanBar` component (`PhysicalStockTab.tsx`)
- RFC: `LoyaltyAdjPanel` CRM sub-tab (`CrmStudioTab.tsx`)
- RFC: LYL-ADJ-001/002 UI exposure (Sprint 19 backend → Sprint 20 UI)
