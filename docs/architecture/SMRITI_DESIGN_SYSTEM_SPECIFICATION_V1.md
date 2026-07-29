<!--
  Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Specification: SMRITI Design System (SDS v1.0) & SUXG Governance
  Version      : 1.0.0
  Created      : 2026-07-28
  Classification: Internal Core Architecture Standard
-->

# SMRITI Design System (SDS v1.0) & UX Governance (SUXG) Specification

**Status:** FROZEN BASELINE — v1.0 (2026-07-28)

The **SMRITI Design System (SDS v1.0)** and **SMRITI UX Governance System (SUXG)** define the authoritative, non-negotiable frontend design language, component contract hierarchy, theme token architecture, and user experience governance rules for the **SMRITI Retail OS v5.0 Workspace Experience Platform**.

---

## 1. Executive Core Design Principles

1. **Enterprise Density & Zero Clutter**: Interfaces must display dense, actionable data cleanly without visual fatigue or unnecessary whitespace.
2. **SAP Fiori Lite Aesthetics**: Inspired by SAP Fiori 3 / Horizon visual clarity—sleek headers, structured object pages, compact filter bars, and status-driven color badges.
3. **Keyboard-First Operations**: Every operational workspace—especially POS Checkout and Item Master—must be 100% operable without mouse interaction using standard hotkeys (`F1`–`F12`, `Alt+Key`, Tab navigation).
4. **100% Token-Based Styling**: Zero inline pixel offsets or hardcoded hex colors. Every visual property MUST dereference CSS custom variables (`var(--sds-*)`).
5. **Adaptive Workspace Engine (AWE)**: Screens must dynamically adapt visual density across three user-selectable modes:
   - **Simple Mode**: High visual comfort, essential fields only (2-column forms).
   - **Hybrid Mode**: Balanced view for daily operational managers (2–3 column forms).
   - **Advanced Mode**: Maximum data density for power users & accountants (3–4 column forms).

---

## 2. SMRITI UX Governance System (SUXG) Constraints Matrix

Every workspace screen MUST strictly adhere to the quantitative performance, interaction, and structural budgets outlined below.

| SUXG Metric / Rule | Hard Enterprise Limit | Enforcement & Behavior |
| :--- | :---: | :--- |
| **Max Clicks to Work** | **≤ 3 Clicks** | User must reach any master or transaction workspace from Launchpad within 3 clicks. |
| **Form Column Budget** | **2 (Simple) / 3 (Hybrid) / 4 (Advanced)** | Enforced dynamically by Adaptive Workspace Engine (AWE). |
| **Max Modal Depth** | **≤ 2 Modals** | Nested modals beyond level 2 are strictly prohibited; use Drawers or Object Page tabs instead. |
| **Loading Time Budget** | **< 2.0 Seconds** | Initial workspace shell render and data query response must complete within 2 seconds. |
| **POS Checkout Speed** | **< 10.0 Seconds** | Complete retail barcode scan to thermal receipt print cycle target for experienced cashiers. |
| **Theme Token Compliance**| **100% Tokenized** | Zero raw CSS color values or pixel magic numbers allowed in component code. |
| **Keyboard Hotkey Coverage**| **100% POS & Item Master** | Full keyboard shortcuts mapped for item lookup, quantity edit, hold bill, payment, and receipt printing. |

---

## 3. Theme Engine Token Architecture

All SDS themes MUST override the standardized CSS Custom Variable namespaces defined in `smriti-tokens.css`.

### 3.1 Theme Palette Matrix

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      SDS v1.0 FOUR-THEME SYSTEM                        │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. SMRITI Light         │ Clean Quartz background, Slate typography    │
 │ 2. SAP Fiori Lite       │ Fiori Deep Blue (#0a6ed1), Quartz Header     │
 │ 3. Dark Obsidian        │ Deep Obsidian (#121824), High-Contrast Text  │
 │ 4. High Contrast        │ Pure Black/White (#000000 / #ffffff) WCAG AAA│
 └────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Token Namespace Architecture (`var(--sds-*)`)

```css
:root {
  /* Colors */
  --sds-color-primary: #0a6ed1;
  --sds-color-primary-hover: #085caf;
  --sds-color-surface: #ffffff;
  --sds-color-background: #f4f6f9;
  --sds-color-text-main: #1d2d3e;
  --sds-color-text-muted: #6a7d93;
  --sds-color-border: #d0d7de;

  /* Status Colors */
  --sds-status-success: #107e3e;
  --sds-status-warning: #e66c00;
  --sds-status-error: #bb0000;
  --sds-status-info: #0a6ed1;

  /* Typography */
  --sds-font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --sds-font-mono: 'JetBrains Mono', monospace;
  --sds-font-size-xs: 0.75rem;
  --sds-font-size-sm: 0.875rem;
  --sds-font-size-md: 1.000rem;
  --sds-font-size-lg: 1.250rem;

  /* Spacing & Elevation */
  --sds-space-xs: 4px;
  --sds-space-sm: 8px;
  --sds-space-md: 16px;
  --sds-space-lg: 24px;
  --sds-radius-sm: 4px;
  --sds-radius-md: 8px;
  --sds-radius-lg: 12px;
  --sds-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

---

## 4. SDS Component Library Contracts (Zero Business Logic)

All UI components MUST remain 100% presentationally decoupled from backend models or domain logic.

1. **`Button`**: Primary, Secondary, Ghost, Danger, Icon-Only; supports loading spinner & hotkey badge.
2. **`Input`**: Text, Number, Monospace Tabular (for currency), with label, error message, and prefix/suffix icons.
3. **`Select / Dropdown`**: Searchable dropdown with keyboard arrow-key navigation and clear trigger.
4. **`Lookup`**: Searchable async picklist with multi-column tabular results and quick add button.
5. **`Status Badge`**: Compact status indicator with color codes for `Active`, `Draft`, `Pending`, `Posted`, `Completed`, `Cancelled`.
6. **`Card / KPI Tile`**: Container with title, value summary, trend indicator, and interactive click handler.
7. **`DataGrid`**: Sortable, filterable table with column resizing, fixed headers, row selection, and pagination.
8. **`Object Header`**: Fixed summary banner for Master Object pages featuring title, avatar, key status badges, and action buttons.
9. **`Drawer / Modal`**: Slide-in overlay for secondary workflows (e.g. quick item view or payment breakdown).

---

## 5. Workspace Lab (`/workspace-lab`) Preview Environment

The **SMRITI Workspace Lab** serves as an isolated internal component preview, theme testing, and UI regression harness.

- **URL**: `/workspace-lab`
- **Sections**:
  - `Typography & Color Palette`
  - `Component Catalog (Buttons, Inputs, Modals, Grids)`
  - `Theme Switcher Live Playground`
  - `AWE Density Mode Switcher (Simple / Hybrid / Advanced)`
  - `SUXG Audit Checklist Validator`

---

## 6. Execution Roadmap: Item Master & POS Flagship Priority

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │           SMRITI WORKSPACE EXPERIENCE PLATFORM ROADMAP                 │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Phase A0 ✅ │ SMRITI Design Language & SUXG Specification (THIS DOC)    │
 │ Phase A1 🎨 │ SDS Token CSS Files (smriti-tokens.css, 4 Themes)        │
 │ Phase A2 🧩 │ Component Library & Workspace Lab (/workspace-lab)       │
 │ Phase A3 📱 │ Adaptive Workspace Shell & AWE Density Mode Switcher     │
 │ Phase A4 📦 │ Item Master Studio (8-Tier Hierarchy, Grid, Barcode)     │
 │ Phase A5 ⚡ │ POS Billing Workspace (Ultra-Fast Keyboard Checkout)     │
 └────────────────────────────────────────────────────────────────────────┘
```
