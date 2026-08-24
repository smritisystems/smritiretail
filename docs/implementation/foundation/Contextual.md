<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Contextual Navigation & Unified Shell Specification v3.17.0

## 1. Objective
Eliminate duplicate navigation sidebars and dual headers in SMRITI Retail OS v3.17.0 by establishing **AppShell (`AppShell.tsx`)** as the sole authoritative application container with **ONE physical navigation rail (`NavRail.tsx`)**, zero page-level horizontal overflow, and a true Fiori-inspired business capability Launchpad.

---

## 2. Problem Statement & Root Cause Analysis
1. **Duplicate Sidebar & Headers:** `App.tsx` wrapped `<LayoutManager>` inside `<AppShell>`. Both components rendered headers and navigation sidebars (`GlobalHeader` + `LayoutManager header` and `NavRail` + `NavigationRenderer`), resulting in two sidebars and dual headers in the DOM.
2. **Horizontal Page Overflow & Clipping:** Fixed pixel offsets in nested layout wrappers caused page width to exceed viewport bounds (`>100vw`), cropping header controls and workspace action bars on standard desktop displays (1366x768, 1440x900).

---

## 3. Structural Layout & Width Model

```text
┌─────────────────────────────────────────────────────────────┐
│ GLOBAL HEADER — width: 100%; max-width: 100vw; height: 52px  │
├───────────────┬─────────────────────────────────────────────┤
│ ONE SIDEBAR   │ MAIN WORKSPACE                              │
│ NavRail.tsx   │ flex: 1; min-width: 0; width: auto;         │
│ 224px / 56px  │ max-width: calc(100vw - sidebar width);     │
│               │ overflow-y: auto; overflow-x: hidden;       │
└───────────────┴─────────────────────────────────────────────┘
```

* Outer Container: `width: 100%`, `max-width: 100vw`, `height: 100vh`, `overflow: hidden`.
* Main Workspace Container: `flex: 1`, `min-width: 0`, `max-width: 100%`.
* Wide Data Grids: Scroll *inside* their own element (`overflow-x: auto`), leaving shell width clean at 100% viewport width without horizontal page scrollbars.

---

## 4. Fiori Launchpad Architecture
```text
SMRITI APPLICATION SHELL
        ↓
SMRITI FIORI LAUNCHPAD (Business Capability Entry Point)
        ↓
BUSINESS SPACES (Sales, Purchase, Inventory, Masters, Analytics)
        ↓
CONTEXTUAL WORKSPACE (Loads contextual menu into ONE NavRail)
        ↓
TRANSACTION & DOCUMENT LIFECYCLE
```

---

## 5. Audit of Navigation Components

| Component | File | Responsibility | Action |
|---|---|---|---|
| `AppShell` | `src/components/shell/AppShell.tsx` | Master shell container | **KEEP — Sole Authoritative Shell** |
| `GlobalHeader` | `src/components/shell/GlobalHeader.tsx` | Global Header | **KEEP — Sole Authoritative Header** |
| `NavRail` | `src/components/shell/NavRail.tsx` | Contextual sidebar | **KEEP — Sole Authoritative Sidebar** |
| `FioriLaunchpad` | `src/components/launchpad/FioriLaunchpad.tsx` | Capability entry point | **KEEP — Refactored Capability Launcher** |
| `LayoutManager` | `src/layout_engine/layout_manager.tsx` | Legacy layout engine | **REMOVE FROM APP.TSX DOM TREE** |
| `DockManager` | `src/layout_engine/dock_manager.tsx` | Legacy dock manager | **REMOVE FROM APP.TSX DOM TREE** |
| `NavigationRenderer` | `src/layout_engine/NavRenderer.tsx` | Legacy sidebar renderer | **REMOVE FROM APP.TSX DOM TREE** |

---

## 6. Verification Plan
* `npx tsc --noEmit`: 0 static type errors.
* `npx vitest run`: 64/64 tests passed.
* `npm run build`: 3,414 modules transformed into `dist/`.
* `python scripts/verify_comp001.py`: 0 leaks in `dist/`, Score 98/100 (`READY_FOR_PRODUCTION_REFERENCE`).
