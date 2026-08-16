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

# SMRITI Master UI/UX Refactor & Application Shell Specification v3.17.0

## 1. Objective
Establish the definitive, unified UI/UX application shell and visual system for SMRITI Retail OS v3.17.0 by combining:
1. **Stitch "SMRITI Launchpad Rebrand" Visual System** (`projects/5290707397196745553`)
2. **SAP Fiori-Inspired Interaction Architecture** (Tile Launchpad, Domain Grouping, Live Metric Counters)
3. **Unified Business Workspace** (Master-Detail, Hideable Navigation Rail, Focus Mode, Transaction Lifecycle)
4. **Standalone PWA Application Mode** (Self-contained app shell navigation: Home, Back, Omni-Search, Launcher, Notifications, User Menu)

---

## 2. Business Motivation
SMRITI Retail OS serves high-volume retail operations, cashier billing points, and inventory controllers. Prior interfaces risked visual fragmentation across modules. By codifying the **"Smriti Cognitive System"** design tokens alongside Fiori's structured interaction architecture, the application reduces operator decision fatigue, accelerates transaction throughput, and provides a desktop/mobile experience across touchpoints.

---

## 3. Scope
* **In-Scope:**
  * Design token integration in `src/index.css` (Inter typography, Deep Indigo `#24389c`, Sage Green `#286b33`, Slate `#3d425f`, Light Surface `#f8f9ff`).
  * `AppShell` container component (`src/components/shell/AppShell.tsx`).
  * Hideable Navigation Rail (`src/components/shell/NavRail.tsx`).
  * Global Header with Omni-Search, Context Breadcrumbs, Notifications Drawer, User Menu (`src/components/shell/GlobalHeader.tsx`).
  * Fiori-inspired Launchpad (`src/components/launchpad/FioriLaunchpad.tsx`).
  * Transaction lifecycle state stepper (`Draft → Verification → Completion`).
  * Standalone PWA manifest update (`public/manifest.json`).
* **Out-of-Scope:**
  * Modifying underlying Postgres transactional schemas or FastAPI API contracts (these remain unchanged per Backend System-of-Record policy).

---

## 4. Current State
The existing codebase features individual module tabs (Item Master, Sales, PO, GRN) operating within separate layout wrappers. Styling uses basic CSS variables that do not yet enforce the full 16-screen Stitch "Smriti Cognitive System" design system or Fiori Launchpad layout structure.

---

## 5. Gap Analysis
| Aspect | Current State | Target State (v3.17.0) |
|---|---|---|
| **Visual Design** | Partial CSS variables | Full Stitch "Smriti Cognitive System" design tokens |
| **Typography** | Mixed system fonts | `Inter` font family strictly formatted |
| **Home Screen** | Module tab bar | Fiori-inspired domain tile Launchpad |
| **Navigation** | Static tab bar | Hideable 3-state Nav Rail (Expanded, Compact, Hidden) |
| **Header** | Basic navbar | Global Header (Omni-Search, Notifications, User Menu, Context) |
| **Focus Mode** | Not available | One-click Focus Mode for distraction-free billing/entry |
| **Transaction State** | Unstructured headers | Unified Stepper (`Draft → Verification → Completion`) |
| **App Presentation** | Standard web tab | Standalone PWA app shell with internal navigation |

---

## 6. Architecture Impact

```text
SMRITI Cognitive System (Stitch Visual Baseline & Design Tokens)
        ↓
SMRITI Fiori-Inspired Launchpad (Domain Tiles & Live Badges)
        ↓
Unified Application Shell (Global Header & Hideable Rail)
        ↓
Workspace Layouts (Master-Detail, Grid, Focus Mode)
        ↓
Transaction Stepper (Draft → Verification → Completion)
        ↓
PAL (Platform Abstraction Layer: apiFetch / apiFetchV1)
        ↓
FastAPI + Postgres (System of Record Backend)
```

---

## 7. Proposed Design

### A. Design Tokens (`src/index.css`)
```css
:root {
  --color-primary: #24389c;
  --color-primary-container: #3f51b5;
  --color-on-primary: #ffffff;
  --color-secondary: #286b33;
  --color-secondary-container: #abf4ac;
  --color-on-secondary: #ffffff;
  --color-tertiary: #3d425f;
  --color-surface: #f8f9ff;
  --color-surface-container-low: #eff4ff;
  --color-surface-container: #e5eeff;
  --color-surface-container-high: #dce9ff;
  --color-surface-container-highest: #d3e4fe;
  --color-surface-container-lowest: #ffffff;
  --color-on-surface: #0b1c30;
  --color-on-surface-variant: #454652;
  --color-outline: #757684;
  --color-outline-variant: #c5c5d4;
  --font-family-base: 'Inter', system-ui, sans-serif;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-ambient: 0 4px 16px rgba(36, 56, 156, 0.12);
}
```

### B. Shell & Layout Components
* `AppShell`: Wraps workspace routing, holds state for active drawer, nav rail collapse, and focus mode.
* `GlobalHeader`: Contains Omni-search input, back stack controls, organization context, notifications bell with count badge, and user session profile.
* `NavRail`: Left-hand vertical bar supporting 3 display states: `Expanded` (full icons + text labels), `Compact` (icons only with tooltips), and `Hidden` (zero-width rail for focus mode).
* `FioriLaunchpad`: Central dashboard displaying grouped tiles (Sales Billing, Purchase Orders, Goods Receipt Note, Item Master, Inventory Audit, Financial Reports) with live counters.
* `TransactionStepper`: Top bar component showing `Draft → Verification → Completion` lifecycle states.

---

## 8. Files Created
1. `src/components/shell/AppShell.tsx`
2. `src/components/shell/GlobalHeader.tsx`
3. `src/components/shell/NavRail.tsx`
4. `src/components/launchpad/FioriLaunchpad.tsx`
5. `src/components/common/TransactionStepper.tsx`
6. `docs/implementation/foundation/SMRITI_Master_UIUX_Refactor_Plan_v3.17.0.md`

---

## 9. Files Modified
1. `src/index.css`
2. `public/manifest.json`
3. `src/App.tsx`

---

## 10. Dependencies
* `lucide-react` or SVG icons for Fiori tiles and Nav Rail actions.
* Existing PAL modules (`src/lib/apiFetch.ts` and `src/lib/apiFetchV1.ts`).

---

## 11. Risks
* CSS specificity overlap between legacy module styles and new Stitch design tokens.
  * *Mitigation:* Scope theme tokens under `:root` and apply atomic container classes across shell components.

---

## 12. Rollback Strategy
If issues arise, revert `src/App.tsx` and `src/index.css` to their git commit baseline. The modular structure of `AppShell` ensures zero disruption to backend FastAPI/Postgres services.

---

## 13. Verification Plan
* Validate design tokens and font loading in `src/index.css`.
* Test Fiori Launchpad layout, live metric counters, and tile navigation.
* Test Nav Rail toggle states (Expanded, Compact, Hidden) and Focus Mode.
* Verify `Draft → Verification → Completion` transaction stepper rendering in POS, PO, and GRN workspaces.

---

## 14. Test Plan
* Execute linting and TypeScript type checks: `npx tsc --noEmit`
* Execute unit tests: `npx vitest run`

---

## 15. Documentation Impact
* Update `docs/implementation/README.md` master index table.
* Update `CHANGELOG.md` for version v3.17.0.
* Create post-implementation Walkthrough under `docs/walkthrough/foundation/`.

---

## 16. Deployment Plan
* Deploy code changes directly to Development environment (`D:\Smriti_Retail_OS`).
* Sync to Test environment (`F:\Smriti9`) via `git pull` per Environment Rule.

---

## 17. Status
* **In Progress** (Master Implementation Plan Created & Approved in Planning Mode).

---

## 18. Related ADRs
* `docs/architecture/ADR_001_FastAPI_Postgres_System_Of_Record.md`
* `docs/architecture/ADR_002_Platform_Abstraction_Layer.md`

---

## 19. Related Walkthroughs
* `docs/walkthrough/README.md` (To be updated upon completion)
