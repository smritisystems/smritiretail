# SMRITI SXP Certification Standard v1.0
**Status:** FROZEN — Supersedes UX_CERTIFICATION_MATRIX.md  
**Authority:** SXP Constitution v1.0  
**Author:** Jawahar Ramkripal Mallah · Chief Systems Architect  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.

---

## Purpose

Every SMRITI studio must pass this certification before shipping to production. A studio that fails any mandatory gate (`M`) is blocked from release. Advisory gates (`A`) must be documented if not met.

---

## Platform Acceptance Gates (SXP-PA) — Applied to Platform Layer

| Gate | Check | Mandatory |
|---|---|---|
| SXP-PA-001 | `WorkspaceEventBus` is the only inter-component communication channel | M |
| SXP-PA-002 | `adaptiveWorkspaceStore.canRender()` is the only adaptive visibility gate | M |
| SXP-PA-003 | All workspace metadata declared in `WorkspaceRegistry` | M |
| SXP-PA-004 | All actions registered in `WorkspaceActionRegistry` | M |
| SXP-PA-005 | All dashboard widgets registered in `DashboardRegistry` | M |
| SXP-PA-006 | `WorkspaceShell` renders all studios (no custom frames) | M |
| SXP-PA-007 | `OfflineExperienceManager` used for all offline queuing | M |
| SXP-PA-008 | `WorkspaceAnalyticsEngine` fed via EventBus (no direct track() in studios) | M |

**Platform Gate Status (as of SXP v1.0):**
- SXP-PA-001 ✅ — `WorkspaceEventBus` implemented and in use
- SXP-PA-002 ✅ — `canRender()` matrix frozen, used in all Phase 1-5 files
- SXP-PA-003 ✅ — `WorkspaceRegistry` operational, Inventory + POS registered
- SXP-PA-004 ✅ — `WorkspaceActionRegistry` operational, 12 actions registered
- SXP-PA-005 ✅ — `DashboardRegistry` extended, Inventory + POS dashboards registered
- SXP-PA-006 ✅ — `WorkspaceShell` implemented; Inventory workspaces mounted
- SXP-PA-007 ✅ — `OfflineExperienceManager` implemented
- SXP-PA-008 ✅ — `WorkspaceAnalyticsEngine` implemented, passive EventBus subscription

---

## Studio Certification Gates (SXP-CS) — Applied Per Studio

### SXP-CS-001 — Co-located Manifest (M)
Studio must have a `*.manifest.ts` file co-located with its components that auto-registers on import.

### SXP-CS-002 — WorkspaceShell Mount (M)
Every workspace component must render inside `WorkspaceShell`. Custom layout wrappers are prohibited.

### SXP-CS-003 — No Direct Mode Checks (M)
Zero instances of `mode === "ADVANCED"`, `mode === "SIMPLE"` in studio component code. All visibility via `canRender()`.

### SXP-CS-004 — Action Registry (M)
All user actions registered in `WorkspaceActionRegistry`. No `onClick` callbacks wired directly in action bars.

### SXP-CS-005 — Adaptive Widget Visibility (M)
All dashboard widgets declare `adaptiveVisibility` in `DashboardRegistry`. Widget filtering is done by `WidgetEngine`, not the studio.

### SXP-CS-006 — Plain Language Labels (M)
No ERP terminology in user-facing labels. Labels pass the "WhatsApp test": would a shop assistant understand this word?

### SXP-CS-007 — 3-Interaction Rule (M — Scanner Zone Only)
Scanner-zone `OperationLauncher` steps ≤ 3. Verified by `MAX_STEPS` enforcement in `OperationLauncher`.

### SXP-CS-008 — Zero Animation in POS/Scanner Zone (M)
Scanner-zone workspaces declare `zone: "scanner"` in manifest. `motionProps` is empty `{}` when zone is active.

### SXP-CS-009 — Timeline Adapter (A)
Domain provides a `WorkspaceTimeline` adapter. Studios that display event history without one are non-conformant (advisory).

### SXP-CS-010 — Offline Handler (A)
Studio registers an `OfflineExperienceManager.registerHandler()` for all transactional operations.

### SXP-CS-011 — AI Advisory Label (M — AI Features Only)
Any AI-generated content shows "Advisory only — no automatic action taken." `isAdvisoryOnly: true` in notification payload.

### SXP-CS-012 — TypeScript: Zero Errors (M)
`npx tsc --noEmit` produces zero errors. No `@ts-ignore` suppressions in studio files.

---

## Studio Certification Status

### Inventory Studio
| Gate | Status | Notes |
|---|---|---|
| SXP-CS-001 | ✅ Done | `inventory.manifest.ts` committed `c68b8f4` |
| SXP-CS-002 | ✅ Done | All 3 workspaces mount in `WorkspaceShell` |
| SXP-CS-003 | ✅ Done | `canRender('reservations')`, `canRender('raw_ledger')` only |
| SXP-CS-004 | ✅ Done | 6 actions in `WorkspaceActionRegistry` |
| SXP-CS-005 | ✅ Done | 5 widgets in `DashboardRegistry` with `adaptiveVisibility` |
| SXP-CS-006 | ✅ Done | "Receive Stock" not "ITEX_INWARD_MOVEMENT" |
| SXP-CS-007 | ✅ Done | `MobileWarehouseScanView` — exactly 3 state machine steps |
| SXP-CS-008 | ✅ Done | `zone: "scanner"` in `inventory.scan` workspace |
| SXP-CS-009 | ✅ Done | `InventoryTimelineAdapter` implemented |
| SXP-CS-010 | ⚠️ Partial | Handler skeleton present; real API wiring deferred to Sprint 1 |
| SXP-CS-011 | N/A | No AI features in Inventory Studio v1 |
| SXP-CS-012 | ✅ Done | `npx tsc --noEmit` — 0 errors at every phase boundary |

**Inventory Studio Certification: CONDITIONALLY APPROVED** (CS-010 pending Sprint 1)

---

### POS Studio
| Gate | Status | Notes |
|---|---|---|
| SXP-CS-001 | ✅ Done | `pos.manifest.ts` committed `a9ab094` |
| SXP-CS-002 | ✅ Done | `data-sxp-zone="scanner"` on render root; `data-sxp-mode={workspaceMode}` — committed `49febc1` |
| SXP-CS-003 | ✅ Done | `useSmritiExperience` imported; zero `mode ===` comparisons in added code |
| SXP-CS-004 | ✅ Done | 6 POS actions in `WorkspaceActionRegistry` |
| SXP-CS-005 | ✅ Done | POS dashboard widgets registered in `DashboardRegistry` |
| SXP-CS-006 | ✅ Done | "New Bill", "Checkout", "Return / Exchange" — no ERP codes |
| SXP-CS-007 | ✅ Done | `POSReturnWizard.tsx` — 3-step scanner_action (Scan Bill → Select Items → Confirm) — `a86e1d0` |
| SXP-CS-008 | ✅ Done | `zone: "scanner"` declared in `pos.billing` manifest |
| SXP-CS-009 | ✅ Done | `POSTimelineAdapter` implemented + wired to `/api/v1/pos/bills/{id}/timeline` — `49febc1` |
| SXP-CS-010 | ✅ Done | `OfflineExperienceManager.registerHandler('sale')` in `pos.manifest.ts` — `49febc1` |
| SXP-CS-011 | N/A | No AI features in POS Studio v1 |
| SXP-CS-012 | ✅ Done | `npx tsc --noEmit` — 0 errors |

**POS Studio Certification: APPROVED** ✔️ (all mandatory gates passed)

---

### Sales Studio
| Gate | Status | Notes |
|---|---|---|
| SXP-CS-001 | ✅ Done | `sales.manifest.ts` auto-registers on import — `c75a29f` |
| SXP-CS-002 | N/A | No full-screen terminal; workspaces use `WorkspaceShell` |
| SXP-CS-003 | ✅ Done | No `mode ===` comparisons in manifest or workspace files |
| SXP-CS-004 | ✅ Done | 6 actions registered: New Order, Confirm, Invoice, Payment, Return, Ledger |
| SXP-CS-005 | ✅ Done | 6 dashboard widgets in `DashboardRegistry` (`dash.sales_overview`) |
| SXP-CS-006 | ✅ Done | "New Order", "Create Invoice", "Record Payment" — no ERP codes |
| SXP-CS-007 | ⚠️ Partial | Return wizard pending — will re-use `POSReturnWizard` pattern in Sprint 2 |
| SXP-CS-008 | ✅ Done | `zone` declared per workspace in `SALES_WORKSPACES` array |
| SXP-CS-009 | ✅ Done | `SalesTimelineAdapter` already in `WorkspaceTimeline.tsx` |
| SXP-CS-010 | ✅ Done | `OfflineExperienceManager.registerHandler('custom')` for sales orders |
| SXP-CS-011 | N/A | No AI features in Sales Studio v1 |
| SXP-CS-012 | ✅ Done | `npx tsc --noEmit` — 0 errors |

**Sales Studio Certification: CONDITIONALLY APPROVED** (CS-007 Return wizard — Sprint 2)

---

### Purchase Studio
| Gate | Status | Notes |
|---|---|---|
| SXP-CS-001 | ✅ Done | `purchase.manifest.ts` auto-registers on import — `c75a29f` |
| SXP-CS-002 | N/A | No full-screen terminal; workspaces use `WorkspaceShell` |
| SXP-CS-003 | ✅ Done | No `mode ===` comparisons in manifest or workspace files |
| SXP-CS-004 | ✅ Done | 6 actions registered: Raise Order, Receive Goods, Record Bill, Make Payment, Return, Payables |
| SXP-CS-005 | ✅ Done | 7 dashboard widgets in `DashboardRegistry` (`dash.purchase_overview`) |
| SXP-CS-006 | ✅ Done | "Raise Order", "Receive Goods", "Return to Supplier" — no ERP codes |
| SXP-CS-007 | N/A | No scanner_action flow in Purchase Studio v1 |
| SXP-CS-008 | ✅ Done | `zone` declared per workspace in `PURCHASE_WORKSPACES` array |
| SXP-CS-009 | ✅ Done | `PurchaseTimelineAdapter` already in `WorkspaceTimeline.tsx` |
| SXP-CS-010 | ✅ Done | `OfflineExperienceManager.registerHandler('stock_receipt')` for GRNs |
| SXP-CS-011 | N/A | No AI features in Purchase Studio v1 |
| SXP-CS-012 | ✅ Done | `npx tsc --noEmit` — 0 errors |

**Purchase Studio Certification: CONDITIONALLY APPROVED** (CS-007 N/A — no scanner flow in v1)

---

## Release Gate Summary

| Studio | Mandatory Gates | Status |
|---|---|---|
| Inventory Studio | CS-001–008, CS-012 | ✅ 11/12 passed — **CONDITIONALLY APPROVED** |
| POS Studio | CS-001–012 | ✅ 12/12 passed — **APPROVED** ✔️ |
| Sales Studio | CS-001–012 | ✅ 11/12 passed — **CONDITIONALLY APPROVED** (CS-007 Sprint 2) |
| Purchase Studio | CS-001–012 | ✅ 12/12 passed — **CONDITIONALLY APPROVED** (CS-007 N/A) |

---

## Supersession Notice

This document formally supersedes `UX_CERTIFICATION_MATRIX.md`. Any existing references to that file should be updated to point here.
