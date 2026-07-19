<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.3
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Implementation Plan: POS Terminal Deep Review Fixes — v2.1.3

## 1. Objective

Resolve all high- and medium-priority findings from the SMRITI Retail OS deep codebase review conducted on 2026-07-11, improving POS correctness, reliability, performance, and UX without breaking existing functionality.

---

## 2. Business Motivation

- **GST accuracy**: Hardcoded 18% GST inflated tax display for zero-rated or 5%/12% items.
- **Session durability**: Cashiers lost parked bills on browser refresh — causing transaction voids.
- **Performance**: Product search recalculated on every keystroke without memoization.
- **Resilience**: A single module crash unmounted the entire application shell.
- **UX**: Barcode scanners required manual click; customer lookup was free-text only.

---

## 3. Scope

| In Scope | Out of Scope |
| :--- | :--- |
| PosTerminalTab.tsx improvements | server.ts refactoring |
| Error Boundary new component | DB migration to SQLite |
| App.tsx boundary integration | Zustand state management migration |
| PrintPreviewModal conditional mount | zod input validation on APIs |

---

## 4. Current State (Before)

- GST hardcoded at 18% in POS summary panel
- `heldBills` lost on page refresh (local state only)
- `filteredProducts` recomputed on every render without `useMemo`
- `handleHoldBill` was a plain function — stale closure risk in `useEffect`
- No barcode scanner Enter-key auto-add
- Customer field was free-text input only
- `PrintPreviewModal` (112KB) always mounted in DOM
- No Error Boundary — one crash removes all modules

---

## 5. Gap Analysis

| Gap | Risk | Resolution |
|---|---|---|
| Hardcoded GST | Incorrect tax on 5%/12% items | Per-product `gstPercentage` IIFE |
| No held bill persistence | Lost active transactions on refresh | `sessionStorage` restore + save |
| No memoization | Render bottleneck with 100+ products | `useMemo` + 150ms debounce |
| No Error Boundary | Full app crash on module error | `SmritiErrorBoundary` class component |
| No barcode Enter handling | Manual click required after scan | `onKeyDown` → `addToCart` |
| Free-text customer field | No CRM link at POS | `<datalist>` from `getCustomers()` |

---

## 6. Architecture Impact

- New component `SmritiErrorBoundary` (class component, required by React ErrorBoundary API).
- `renderTab()` replaced by `renderTabSafe()` wrapper in `App.tsx`.
- No new context, store, or API endpoint required.
- `getCustomers()` from `customerStore.ts` now called from a UI component — acceptable for current in-memory store; will need async state when migrating to backend.

---

## 7. Proposed Design

See Implementation Summary in walkthrough: `docs/walkthrough/pos/POS_DeepReview_Fixes_Walkthrough_v2.1.3.md`

---

## 8. Files Created

| File | Purpose |
|---|---|
| `src/components/SmritiErrorBoundary.tsx` | React Error Boundary, HREP-compliant user messaging |
| `docs/walkthrough/pos/POS_DeepReview_Fixes_Walkthrough_v2.1.3.md` | This implementation's walkthrough |
| `docs/implementation/pos/POS_DeepReview_Fixes_Plan_v2.1.3.md` | This document |

---

## 9. Files Modified

| File | Changes |
|---|---|
| `src/components/PosTerminalTab.tsx` | 7 improvements (GST, persistence, memoization, callbacks, barcode, autocomplete) |
| `src/App.tsx` | ErrorBoundary wrap, conditional PrintPreviewModal |
| `docs/walkthrough/README.md` | Index updated |
| `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md` | New entry appended |
| `docs/implementation/README.md` | Index updated |
| `docs/implementation/CONSOLIDATED_PLANS.md` | New entry appended |
| `docs/user_guide/USER_GUIDE.md` | POS section updated |
| `docs/developer_guide/DEVELOPER_GUIDE.md` | Architecture section updated |
| `docs/troubleshooting/TROUBLESHOOTING.md` | New GST and held-bill entries |
| `docs/HOME.md` | Version table updated |

---

## 10. Dependencies

- No new npm packages added.
- `getCustomers()` must be exported from `customerStore.ts`.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| `getCustomers()` may not exist as named export | Verified via TypeScript lint (passed) |
| Functional `setCart` in `handleHoldBill` may not capture latest customerName | Tested logic — `customerName` is in `useCallback` deps |
| Duplicate keyboard useEffect after refactor | Removed orphaned block; verified via `grep` |

---

## 12. Rollback Strategy

All changes are in 3 files. Rollback via:
```bash
git checkout src/components/PosTerminalTab.tsx
git checkout src/App.tsx
git rm src/components/SmritiErrorBoundary.tsx
```

---

## 13. Verification Plan

- `tsc --noEmit` must pass with zero errors.
- Load POS tab, open shift, add item — GST display should show per-product rate.
- Hold a bill, refresh browser — bill should reappear under Hold Slots.
- Type fast in search bar — results should lag 150ms (debounce).
- Scan (type) a barcode + press Enter — product auto-adds to cart.
- Type in Loyalty Account — CRM names appear in dropdown.

---

## 14. Test Plan

| Test | Method | Expected |
|---|---|---|
| TypeScript compile | `npm run lint` | Exit code 0 |
| GST display | Manual POS with 5% product | Shows 5% not 18% |
| Held bill refresh | Hold → F5 → check | Bill persists |
| Search debounce | Type fast | 150ms lag, single render |
| Error Boundary | Simulate throw in tab | Module error page, other tabs unaffected |

---

## 15. Documentation Impact

All user-facing docs updated: User Guide, Developer Guide, Troubleshooting, Walkthroughs, Wiki HOME.

---

## 16. Deployment Plan

1. `git add` all modified files
2. `git commit -m "v2.1.3: POS deep review fixes, Error Boundary, conditional PrintPreviewModal"`
3. Push to dev branch
4. Pull on test environment `F:\Smriti9`

---

## 17. Status

**Completed** — 2026-07-11

---

## 18. Related ADRs

- ADR-PAL-001 (Platform Adapter Rules)

---

## 19. Related Walkthroughs

- `docs/walkthrough/pos/POS_DeepReview_Fixes_Walkthrough_v2.1.3.md`
- `docs/walkthrough/sales/Sales_CRM_Audit_And_POS_Upgrades_Walkthrough_v2.1.2.md`
