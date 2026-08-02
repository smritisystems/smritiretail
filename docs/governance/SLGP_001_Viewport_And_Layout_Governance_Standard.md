<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Policy SLGP-001: Viewport & Layout Governance Standard

**Status:** FROZEN — v2.0 (2026-07-28)
**Category:** UI Architecture & Governance Policy
**Tier:** Level 2 Platform Engineering Standard

---

## 1. Vision & Purpose
To guarantee consistent, predictable, and responsive UI layout boundaries across all SMRITI Retail OS applications, modules, and extensions. This standard resolves viewport clipping, missing scrollbars, footer overlaps, nested scrollbar conflicts, and broken dialog heights by enforcing centralized layout management, reusable workspace wrappers, layout tokens, developer inspection overlays, and automated build linters.

---

## 2. Core Governance Rules

### Rule SLGP-R1: Single Scroll Responsibility Principle (SSRP)
For any given view, exactly **ONE** container in the DOM hierarchy holds vertical scrolling responsibility. Outer shells must never conflict with inner content scrollbars.

### Rule SLGP-R2: Prohibition of Viewport Units in Child Components
Sub-components, page tabs, widgets, and dialogs shall never declare `h-screen`, `w-screen`, `100vh`, or `100vw`. Viewport sizing belongs exclusively to the root `LayoutManager`.

### Rule SLGP-R3: Mandatory Flexbox Bounding Box (`min-h-0`)
All nested flex containers with dynamic height children (`flex-1 flex-col`) MUST specify `min-h-0` (or `min-height: 0`). This forces browser flex calculation engines to respect parent layout bounds.

### Rule SLGP-R4: Standardized Dialog Box Model
Modals and dialogs must implement fixed headers, scrollable bodies, and fixed footers. Dialogs shall never allow the outer backdrop window to scroll.

### Rule SLGP-R5: Fixed Toolbars and Summaries (`shrink-0`)
Top toolbars and bottom summary footers in full-bleed studio screens must declare `shrink-0` to guarantee visibility regardless of content volume.

### Rule SLGP-R6: Modules Shall Never Control the Viewport (Level 1 Constitution)
Business modules must not define viewport dimensions or application-level overflow behavior. Modules consume allocated workspace bounds provided by `<WorkspaceLayout />`.

---

## 3. The Three Canonical Layout Patterns

```text
Viewport Engine (LayoutManager)
 ├── Pattern A: Continuous Scroll Page (List Reports / Launchpad / Settings)
 ├── Pattern B: Viewport-Constrained Fixed Studio (POS Terminal / Excel Studio)
 └── Pattern C: Master–Detail Split-Pane Workspace (Item Master / Customer CRM / Vendor POs)
```

1. **Pattern A — Continuous Scroll Page**: Used for list reports, launchpad, and settings. Content scrolls naturally inside `<main>` with header and sidebar fixed.
2. **Pattern B — Fixed Studio**: Used for POS terminals, billing desks, and spreadsheet grids. Top toolbar and bottom totals stay pinned while the central data grid scrolls inside.
3. **Pattern C — Master–Detail Workspace**: Used for master entities (Item Master, Customer CRM, Vendor POs). Left list/grid panel and Right details form scroll independently within a fixed workspace.

---

## 4. Centralized Layout Tokens

| Token Name | Token Key | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **Header Height** | `HEADER_HEIGHT` | `48px` | Top workspace navigation bar height |
| **Toolbar Height** | `TOOLBAR_HEIGHT` | `44px` | Operational action toolbar height |
| **Sidebar Width** | `SIDEBAR_WIDTH` | `256px` | Expanded contextual sidebar width |
| **Sidebar Collapsed** | `SIDEBAR_COLLAPSED_WIDTH` | `64px` | Mini icon-only sidebar width |
| **Status Bar Height** | `STATUS_BAR_HEIGHT` | `32px` | Bottom system status bar height |
| **Workspace Padding** | `WORKSPACE_PADDING` | `16px` (Desktop) | Outer content margin |
| **Content Gap** | `CONTENT_GAP` | `16px` | Spacing between layout panels |
| **Card Radius** | `CARD_RADIUS` | `8px` | Default card border radius |

---

## 5. Automated Build Linting
The layout linter script (`scripts/validate_layout_tokens.py`) is run as part of pre-commit and build pipelines. Any file declaring `h-screen`, `100vh`, `min-h-screen`, or `w-screen` inside `src/components/` will fail the build assertion.
