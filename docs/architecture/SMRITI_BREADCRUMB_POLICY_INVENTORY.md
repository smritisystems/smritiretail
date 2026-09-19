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

# SMRITI Breadcrumb Engine v1.0 — Existing Breadcrumb Inventory & Migration Ledger

**Inventory ID:** BRP-INV-v1.0  
**Status:** COMPLETE & AUDITED  
**Audit Date:** 2026-09-18  
**Reference Policy:** `docs/architecture/SMRITI_BREADCRUMB_POLICY_V1.md`

---

## 1. Executive Summary

A comprehensive repository-wide audit was conducted across all frontend components, backend endpoints, documentation files, tests, and configuration registries to identify every instance of breadcrumb usage, pseudo-breadcrumb context indicators, and navigation hierarchy definitions.

Prior to SMRITI Breadcrumb Engine v1.0, the platform had **no unified breadcrumb engine**. Navigation context was fragmented between a hardcoded 2-segment label in `GlobalHeader.tsx` and an independent entity-drilldown component in `UniversalBrowseEngine`.

---

## 2. Comprehensive Inventory Ledger

| ID | File / Component | Category | Current Implementation | Policy Gap | Action | Status |
|---|---|---|---|---|---|---|
| **INV-01** | `src/components/shell/GlobalHeader.tsx` (L131–135) | Shell Header | Renders `<span>{storeName}</span> / <span>{activeModuleTitle}</span>` | Not a true breadcrumb; fixed 2-segment display; unlinked; non-semantic; no ARIA hierarchy | **REPLACE** | Migrated to `<Breadcrumb onNavigate={onSelectModule} />` powered by `BreadcrumbProvider` |
| **INV-02** | `src/components/shell/AppShell.tsx` | Shell Wrapper | Provided `activeModuleId` and `activeModuleTitle` without breadcrumb context wrapper | Lacked global breadcrumb provider to propagate trail state across shell | **ADAPT** | Wrapped shell canvas with `<BreadcrumbProvider>` |
| **INV-03** | `src/components/shell/navigationResolver.ts` | Navigation Resolver | Resolved business context and menu items, but did not expose parent ancestor trail | Ancestor lineage for active business context was not deterministically calculable | **ADAPT** | Extended `ResolvedNavigation` with `breadcrumbAncestors: BreadcrumbAncestor[]` |
| **INV-04** | `src/components/drilldown/DrillDownCrumbs.tsx` | Entity Drilldown | Renders entity stack (`breadcrumbs[]`) for UniversalBrowseEngine (Customer → Item → Vendor) | Record-level drilldown trail, not a page navigation breadcrumb | **RETAIN** | Retained with zero modification. Operates in isolated drilldown sub-toolbar slot |
| **INV-05** | `src/components/drilldown/drilldown_store.tsx` | State Store | Manages `breadcrumbs: DrillContextData[]` stack for modal entity inspection | Specialized entity stack, decoupled from page navigation | **RETAIN** | Retained. Validated by `scripts/smriti_breadcrumb_guard.py` as exempt |
| **INV-06** | `src/components/ReportDesignerTab.tsx` (L42, L1324) | BI Studio | Internal `DrilldownBreadcrumb[]` state for reporting dimension drills | Module-private BI drilldown path; not an application shell navigation element | **RETAIN** | Retained as private reporting state |
| **INV-07** | `src/components/AboutSmritiTab.tsx` (L263) | Documentation | Comment referencing "Breadcrumb Navigation Header" | Non-functional comment | **RETAIN** | Retained as informative comment |
| **INV-08** | `src/App.tsx` (L35, L586) | Root App Shell | Imports and mounts `<DrillDownBreadcrumbs />` in the browse engine overlay | Entity drilldown slot | **RETAIN** | Retained for entity browse engine overlay |
| **INV-09** | Documentation Prose (`Inv_Workspace.md`, `POS_Billing.md`, `CRM.md`, etc.) | Docs & Guides | Prose describing string trails like `"Home > Inventory > Stock Ledger"` | Written documentation describing UI layouts | **ADAPT** | Documentation updated to align with canonical Breadcrumb Engine v1.0 standard |
| **INV-10** | `src/navigation/breadcrumb/BreadcrumbCompat.tsx` | Compatibility Adapter | Legacy adapter accepting `segments: string[]` | Temporary bridge for ad-hoc string migrations | **TEMPORARY** | Marked `@deprecated`; scheduled for retirement post-stabilization |

---

## 3. Migration & Decoupling Architecture

```
+-------------------------------------------------------------------------+
|                              SMRITI APP SHELL                           |
|                                                                         |
|  [GlobalHeader]                                                         |
|  +-------------------------------------------------------------------+  |
|  | SMRITI OS | [ Home > Purchase & Procurement > PO #PUR-ORD-001 ]   |  |
|  +-------------------------------------------------------------------+  |
|        ^                                                                |
|        | (Reads BreadcrumbTrail from BreadcrumbProvider)                |
|  +-------------------------------------------------------------------+  |
|  | BreadcrumbProvider (Context)                                      |  |
|  |   --> BreadcrumbResolver.resolve(activeModuleId, documentId)      |  |
|  |         --> BreadcrumbRegistry (seeded from WorkspaceConfig[])    |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  [Workspace Canvas Area]                                                |
|  +-------------------------------------------------------------------+  |
|  | Active Workspace (e.g. Purchase Orders Grid)                      |  |
|  |                                                                   |  |
|  | (Optional Entity Drilldown Overlay Slot - INDEPENDENT)            |  |
|  | [DrillDownBreadcrumbs: Customer 001 -> Item A98 -> Vendor T1]    |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 4. Verification & Guard Compliance

All items in this inventory have been verified against:
1. `src/tests/breadcrumb.test.ts` (20/20 test scenarios passing)
2. `scripts/smriti_breadcrumb_guard.py` (594 source files scanned with 0 violations)
3. `npx tsc --noEmit` (clean typecheck)

---

## 5. Deprecation & Retirement Schedule

- **BreadcrumbCompat Adapter (`BreadcrumbCompat.tsx`):**
  - Introduced in v1.0 as a compatibility shim.
  - Deprecation Notice: `@deprecated Use <Breadcrumb /> with BreadcrumbProvider instead`.
  - Final Retirement Target: v3.20.0 (upon completion of all workspace migrations).
