<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Breadcrumb Engine v1.0 — Architecture & Controlled Policy Migration

## 1. Purpose

Establish the canonical, enterprise-grade SMRITI Breadcrumb Engine v1.0 architecture across SMRITI Retail OS. Replace legacy, ad-hoc pseudo-breadcrumbs (specifically the unlinked 2-segment store/module text in `GlobalHeader.tsx`) with a deterministic, navigation-registry-driven, permission-aware, mobile-responsive, and WCAG-accessible breadcrumb system rooted in the Fiori Launchpad.

---

## 2. Scope

- **Frontend Core Shell:** `src/components/shell/AppShell.tsx`, `src/components/shell/GlobalHeader.tsx`, `src/components/shell/navigationResolver.ts`.
- **Navigation Engine:** `src/navigation/breadcrumb/` subsystem (Types, Registry, Resolver, Context, UI Components, Utilities, Barrel Export).
- **Architecture Governance:** `docs/architecture/SMRITI_BREADCRUMB_POLICY_V1.md`, `docs/architecture/SMRITI_BREADCRUMB_POLICY_INVENTORY.md`.
- **Testing & Quality Assurance:** `src/tests/breadcrumb.test.ts` (20 validation scenarios).
- **Automated Guarding:** `scripts/smriti_breadcrumb_guard.py` (CI enforcement scanning 594 source files).

---

## 3. Files Created

1. [`src/navigation/breadcrumb/BreadcrumbTypes.ts`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbTypes.ts) — Immutable TypeScript types (`BreadcrumbNode`, `BreadcrumbTrail`, `BreadcrumbResolutionContext`, `BreadcrumbRegistryEntry`).
2. [`src/navigation/breadcrumb/BreadcrumbRegistry.ts`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbRegistry.ts) — Structural map of workspace nodes and parent-child hierarchies seeded from `registeredWorkspaces`.
3. [`src/navigation/breadcrumb/BreadcrumbResolver.ts`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbResolver.ts) — Deterministic trail resolver supporting root Home, ancestors, active module, and dynamic record nodes.
4. [`src/navigation/breadcrumb/BreadcrumbContext.tsx`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbContext.tsx) — React Context provider (`BreadcrumbProvider`), `useBreadcrumb()`, and `useOptionalBreadcrumb()` hooks.
5. [`src/navigation/breadcrumb/breadcrumbUtils.ts`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/breadcrumbUtils.ts) — Mobile truncation (`getMobileTrail`), accessibility string generator (`getBreadcrumbAriaLabel`), and depth checks.
6. [`src/navigation/breadcrumb/Breadcrumb.tsx`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/Breadcrumb.tsx) — Main semantic `<nav>` component rendering responsive desktop/mobile trails.
7. [`src/navigation/breadcrumb/BreadcrumbItem.tsx`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbItem.tsx) — Individual node component rendering navigable buttons or terminal `aria-current="page"` spans.
8. [`src/navigation/breadcrumb/BreadcrumbCompat.tsx`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbCompat.tsx) — Temporary deprecated compatibility bridge for legacy string arrays.
9. [`src/navigation/breadcrumb/index.ts`](file:///F:/SMRITRretailNX/src/navigation/breadcrumb/index.ts) — Public barrel export.
10. [`src/tests/breadcrumb.test.ts`](file:///F:/SMRITRretailNX/src/tests/breadcrumb.test.ts) — 20-scenario automated Vitest test suite.
11. [`scripts/smriti_breadcrumb_guard.py`](file:///F:/SMRITRretailNX/scripts/smriti_breadcrumb_guard.py) — CI enforcement script verifying 0 hardcoded trails or unauthorized drilldown imports.
12. [`docs/architecture/SMRITI_BREADCRUMB_POLICY_V1.md`](file:///F:/SMRITRretailNX/docs/architecture/SMRITI_BREADCRUMB_POLICY_V1.md) — Canonical policy and architectural standard.
13. [`docs/architecture/SMRITI_BREADCRUMB_POLICY_INVENTORY.md`](file:///F:/SMRITRretailNX/docs/architecture/SMRITI_BREADCRUMB_POLICY_INVENTORY.md) — Repository-wide existing breadcrumb inventory and migration ledger.

---

## 4. Files Modified

1. [`src/components/shell/AppShell.tsx`](file:///F:/SMRITRretailNX/src/components/shell/AppShell.tsx) — Wrapped application shell with `<BreadcrumbProvider>` to provide live trail state to header and canvas.
2. [`src/components/shell/GlobalHeader.tsx`](file:///F:/SMRITRretailNX/src/components/shell/GlobalHeader.tsx) — Replaced 2-segment label (`storeName / activeModuleTitle`) with `<Breadcrumb onNavigate={onSelectModule} />`.
3. [`src/components/shell/navigationResolver.ts`](file:///F:/SMRITRretailNX/src/components/shell/navigationResolver.ts) — Added `breadcrumbAncestors: BreadcrumbAncestor[]` to `ResolvedNavigation` for contextual alignment.
4. [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended new entry to master index table.

---

## 5. Architecture Decisions

- **AD-01 (Strict SSOT Seeding):** The breadcrumb hierarchy is seeded exclusively from `registeredWorkspaces` (`layout_store.tsx`) and `BreadcrumbRegistry.ts`. Individual pages never declare their own hierarchy.
- **AD-02 (Launchpad as Immutable Anchor):** The root node is always Fiori Launchpad (`launchpad`, "Home", icon: "home"). On Launchpad itself, the trail is a single terminal node.
- **AD-03 (Decoupled Coexistence):** `DrillDownBreadcrumbs` in `UniversalBrowseEngine` operates as a record-drilldown stack and is strictly isolated from the application shell's page navigation breadcrumb.
- **AD-04 (Maximum Depth & Truncation):** Desktop trails are limited to 5 logical nodes. Trails exceeding depth 5 are truncated from left (position 1) while preserving Home and the active terminal node.
- **AD-05 (Responsive Mobile Collapsing):** On mobile viewports (`< sm`), trails collapse all ancestors into a leading `…` ellipsis node, displaying only the last 2 nodes.

---

## 6. Design Rationale

- **Pure TypeScript Engine with React Shell Adapter:** Keeping `BreadcrumbRegistry` and `BreadcrumbResolver` as pure TypeScript classes allows them to be tested, benchmarked, and reused in headless environments without DOM or React lifecycle overhead.
- **`useOptionalBreadcrumb` Hook:** Implementing `useOptionalBreadcrumb()` avoids throwing errors when `<Breadcrumb />` is rendered in standalone contexts or isolated tests, ensuring compliance with React Rules of Hooks.

---

## 7. Implementation Summary

1. Built the `src/navigation/breadcrumb/` modular engine conforming to `SMRITI_BREADCRUMB_POLICY_V1.md`.
2. Seeded registry hierarchy covering Sales, Purchase, Inventory, Masters, CRM, Reports, and System submodules.
3. Integrated `<BreadcrumbProvider>` into `AppShell.tsx` and placed `<Breadcrumb />` into `GlobalHeader.tsx`.
4. Extended `navigationResolver.ts` with `breadcrumbAncestors` for all business contexts and active document states.
5. Authored comprehensive Vitest test suite with 20 test cases covering edge conditions, dynamic records, truncation, ARIA labeling, and duplicate route detection.
6. Implemented and executed `scripts/smriti_breadcrumb_guard.py` across all 594 TypeScript/TSX source files.

---

## 8. Tests Executed

### Automated Test Suite: `src/tests/breadcrumb.test.ts`
```
npx vitest run src/tests/breadcrumb.test.ts
```
**Results:** 20/20 passed (16ms execution time).

### TypeScript Static Typecheck:
```
npx tsc --noEmit
```
**Results:** Exit code 0 (0 compilation errors).

### Governance Guard Scan:
```
python scripts/smriti_breadcrumb_guard.py
```
**Results:** Exit code 0 (594 source files scanned, 0 violations).

---

## 9. Verification Results

| Requirement | Target | Achieved | Status |
|---|---|---|---|
| Launchpad root anchor | Single terminal node on home | Verified | **Done** |
| Top-level module trail | 2 nodes (Home > Module) | Verified | **Done** |
| Submodule hierarchy | 3 nodes (Home > Parent > Sub) | Verified | **Done** |
| Dynamic record node | Terminal document node | Verified | **Done** |
| Mobile truncation | Last 2 nodes + ellipsis | Verified | **Done** |
| Max depth enforcement | Truncation > 5 nodes | Verified | **Done** |
| Drilldown coexistence | Independent states | Verified | **Done** |
| WCAG 2.1 AA ARIA | nav, ol, aria-current | Verified | **Done** |
| CI Governance Guard | 0 violations in 594 files | Verified | **Done** |

---

## 10. Known Limitations

- Sub-tabs within single workspaces (e.g. settings tabs within Purchase Orders) do not generate separate breadcrumb nodes unless promoted to distinct routable workspaces in `WorkspaceConfig`.

---

## 11. Future Work

- Post-migration phase: Retire `BreadcrumbCompat.tsx` once all historical modules have migrated.
- Telemetry integration: Log breadcrumb backtrack frequency to SMRITI UX Telemetry to optimize operator click efficiency.

---

## 12. Related ADRs

- `docs/architecture/decisions/ADR-0081-NAVIGATION-RESOLVER.md`
- `docs/architecture/decisions/ADR-0094-STRANGLER-FIG-MIGRATION.md`

---

## 13. Related RFCs

- `RFC-2026-0918-BREADCRUMB-ENGINE-V1`
- `RFC-2026-0816-SHELL-NAVIGATION-UNIFICATION`
