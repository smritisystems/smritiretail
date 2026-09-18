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

# SMRITI Breadcrumb Engine v1.0 — Architecture & Governance Policy

**Policy ID:** BRP-v1.0  
**Status:** FROZEN — Canonical Standard  
**Effective Date:** 2026-09-18  
**Scope:** All Frontend Navigation, UI Shell Components, Context Resolvers, and Workspaces

---

## 1. Architectural Philosophy

In enterprise retail operating systems, breadcrumbs are **not decorative visual accents**. They serve as the operator's **primary hierarchical compass and state anchor**. An operator executing mission-critical workflows (such as point-of-sale billing, purchase order verification, goods receipt note approval, or inventory audits) must know with zero cognitive overhead:

1. **Where am I in the enterprise hierarchy?** (Context & Parent Module)
2. **How did I arrive here?** (Deterministic lineage back to Fiori Launchpad)
3. **What active entity is open?** (Dynamic record identifier, e.g. PO number, invoice number, customer code)
4. **How do I safely ascend to parent scope?** (Single-click ascending traversal without losing session integrity)

---

## 2. Canonical Source of Truth (SSOT)

1. **No Ad-Hoc Breadcrumb Arrays:** Individual workspace views, tabs, and components are strictly prohibited from maintaining private breadcrumb arrays (`["Home", "Inventory", "Stock"]`).
2. **Single Source of Truth:** The SMRITI Navigation Registry (`WorkspaceConfig[]` registered in `layout_store.tsx`) is the single canonical source of truth for workspace metadata, identifiers, and categories.
3. **Hierarchical Relationships:** Structural parentage is resolved exclusively through `BreadcrumbRegistry.ts`, which maps registered workspaces to their hierarchical ancestors.
4. **Resolution Engine:** The `BreadcrumbResolver` class takes a `BreadcrumbResolutionContext` (`activeModuleId`, `documentId`, `userRole`, `branchId`) and evaluates the canonical trail deterministically.
5. **Context Propagation:** The `BreadcrumbProvider` (React Context) injects the resolved trail throughout the application shell.

---

## 3. Breadcrumb Node Contract & Schema

Every node in a SMRITI breadcrumb trail conforms to the immutable TypeScript interface:

```typescript
export interface BreadcrumbNode {
  /** Unique workspace, module, or document record identifier */
  id: string;
  /** Human-readable display label (Sentence or Title Case) */
  label: string;
  /** Material Symbols icon identifier (optional) */
  icon?: string;
  /** Navigation target. Present on all non-terminal nodes; undefined on terminal */
  href?: string;
  /** True when this node represents the current active viewport. Not clickable */
  isTerminal: boolean;
  /** True for dynamically resolved document records (PO, Customer, Invoice) */
  isDynamic?: boolean;
  /** Accessible label for screen readers. Defaults to label if absent */
  ariaLabel?: string;
}
```

---

## 4. Visual Presentation & Formatting Standards

1. **Root Node:**
   - Always represents the SMRITI Fiori Launchpad: `{ id: "launchpad", label: "Home", icon: "home", href: "launchpad" }`.
   - When the user is on the Launchpad itself, the trail contains **exactly 1 node** which is terminal (`isTerminal: true`, `href: undefined`).
2. **Separators:**
   - The visual separator between nodes is the Material Symbol `chevron_right` (12px, styled with `text-indigo-400/60`).
   - Separators are decorative and carry `aria-hidden="true"`.
3. **Typography & Colors:**
   - **Non-Terminal Nodes:** Styled in `text-indigo-200 hover:text-white transition-colors` with focus ring visibility.
   - **Terminal Node (Current Page):** Styled in `text-white font-semibold text-xs truncate` with `aria-current="page"`.
   - **Ellipsis Collapse Node:** Rendered as `…` in `text-indigo-300/70` with `aria-hidden="true"`.

---

## 5. Dynamic Record Nodes

When an operator navigates inside a module to inspect or edit a concrete business entity (such as purchase order `PUR-ORD-00000001`, invoice `INV-2026-081`, or customer `CUST-10492`):

1. The dynamic record node is passed via `documentId` and optional `documentLabel` in the resolution context.
2. The dynamic record node is **always terminal** (`isTerminal: true`).
3. Its parent module becomes navigable (`href: module.id`).
4. The dynamic record node must be formatted with the canonical business identifier:
   - Example: `Home > Purchase & Procurement > PO #PUR-ORD-00000001`
   - Example: `Home > Sales & Billing > Invoice #INV-2026-081`
5. When the user exits the record view, `clearDocument()` returns the trail to the parent module level immediately.

---

## 6. Depth Management & Truncation Policies

### 6.1 Maximum Depth
- The maximum allowed breadcrumb depth on desktop is **5 logical nodes**:
  `Home > Top-Level Domain > Functional Module > Sub-Module > Document Record`
- If a deep hierarchy exceeds 5 nodes, the trail is left-truncated starting at position 1 (preserving Home at index 0 and preserving the terminal node at the end).
- The trail flags `isTruncated: true`.

### 6.2 Responsive / Mobile Presentation
- On small viewport devices (`< sm` / mobile screens), rendering 4 or 5 full breadcrumb items leads to header wrapping or overflow.
- Mobile policy:
  - Collapse ancestors into a single ellipsis (`…`) indicator node (`id: "__ellipsis__"`).
  - Render only the **last 2 nodes** (terminal current page + immediate parent).
  - Example Desktop: `Home > CRM & Loyalty > Customer Master > Customer 360 > CUST-1002`
  - Example Mobile: `… > Customer 360 > CUST-1002`

---

## 7. Strict Prohibitions & Anti-Patterns

1. **Prohibition of URL Query Parameters:**
   Breadcrumb nodes must never contain query strings, filters, pagination state, or sort parameters (`/sales?page=2&sort=desc` -> FORBIDDEN). Breadcrumbs reflect hierarchical structural location, not view state.
2. **Prohibition of Unrouted Tab Nodes:**
   Sub-tabs within a workspace (e.g. "Tab A", "Tab B") must NOT create breadcrumb nodes unless each tab is an independently routable sub-workspace with its own entry in `WorkspaceConfig`.
3. **Prohibition of String-Concat Breadcrumbs:**
   Writing `"Home > Sales > Invoice"` as a literal string in TSX/JSX is strictly blocked by `scripts/smriti_breadcrumb_guard.py`.
4. **Prohibition of Duplicate Routes:**
   The `BreadcrumbRegistry` enforces route uniqueness via `detectDuplicates()`.

---

## 8. Coexistence Architecture: Navigation Breadcrumb vs Entity DrillDown

SMRITI Retail OS maintains two distinct navigation constructs:

| Dimension | Page Navigation Breadcrumb (`<Breadcrumb />`) | Record DrillDown Trail (`<DrillDownBreadcrumbs />`) |
|---|---|---|
| **Location** | GlobalHeader (top header bar) | DrillDown / UniversalBrowseEngine sub-toolbar |
| **Purpose** | Workspace & module hierarchy in application shell | Entity-level record hopping (Customer → Item → Vendor) |
| **Source of Truth**| `registeredWorkspaces` & `BreadcrumbRegistry` | `drilldown_store` stack (`breadcrumbs[]`) |
| **State Lifespan** | Tied to active workspace and document view | Ephemeral modal / browse drill session |
| **Coexistence** | Completely decoupled; separate contexts and zero shared state |

---

## 9. Accessibility (WCAG 2.1 AA & ARIA)

Every breadcrumb implementation must fulfill the following accessibility contract:
1. The root element is a `<nav aria-label="Breadcrumb: ...">` wrapper.
2. The nodes are structured in an `<ol>` (ordered list) representing hierarchical sequence.
3. The active terminal node contains `aria-current="page"`.
4. All navigable buttons/links provide descriptive `aria-label` attributes (e.g., `aria-label="Go to Purchase & Procurement"`).
5. Decorative separators carry `aria-hidden="true"`.
6. Full keyboard navigability (Tab, Enter, Space) with visible focus indicators (`focus-visible:ring-1`).

---

## 10. Automated Governance & CI Enforcement

The policy is enforced automatically through:
1. **Vitest Unit Suite:** `src/tests/breadcrumb.test.ts` (20 validation scenarios).
2. **CI Governance Guard:** `scripts/smriti_breadcrumb_guard.py` (scans 590+ TS/TSX source files for forbidden patterns).
3. **TypeScript Static Analysis:** `npx tsc --noEmit` (strict type validation).
