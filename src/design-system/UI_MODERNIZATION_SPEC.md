<!--
  Project      : SMRITI Business OS
  Specification: SMRITI Enterprise UI Modernization & Design Token Specification
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  Classification: Enterprise UI Governance Standard
-->

# SMRITI Enterprise UI Modernization Specification

## 1. Objective & Design Philosophy
Refactor the SMRITI Business OS application suite to achieve an enterprise-grade user experience inspired by leading enterprise platforms (SAP Fiori, Microsoft Fluent, IBM Carbon), while maintaining a unique, distinct SMRITI identity.

This is a complete architectural UI modernization governed by **SMRITI Enterprise Design System (SEDS)** and **SEEF Framework**.

---

## 2. Mandatory Color System (Design Tokens First)
- **Prohibited:** Hardcoded hex colors (`#1e293b`), arbitrary Tailwind colors (`bg-[#101322]`), inline color styles (`style={{ color: 'red' }}`).
- **Required:** Every component MUST consume central CSS variable design tokens:
  ```css
  --theme-base: HSL Canvas background
  --theme-surface-1: Surface card background
  --theme-surface-2: Input & secondary surface background
  --theme-surface-3: Elevated drawer & hover background
  --theme-surface-hover: Hover state surface
  --theme-heading: Text primary
  --theme-body: Text secondary
  --theme-muted: Text disabled / muted
  --theme-divider: Border & divider lines
  ```

---

## 3. Visual Style & Typography
- **Surfaces:** Flat surfaces with subtle elevation (`shadow-sm` / `shadow-md`), spacious padding, neutral backgrounds.
- **Typography:** Inter / Outfit font stack.
  - Headings: `font-display font-bold text-theme-heading`
  - Body: `font-sans text-theme-body text-xs`
  - Code/Numbers: `font-mono text-xs text-theme-heading`

---

## 4. Standardized Controls
- **Buttons (`SEDSButton`):** `primary`, `secondary`, `tertiary`, `ghost`, `danger`, `success`, `icon`.
- **Forms (`SEDSInput`, `SEDSSelect`, `SEDSCheckbox`, `SEDSRadioGroup`, `SEDSSwitch`):** Uniform label hierarchy, helper text, and validation states.
- **Page Shell (`SEDSWorkspaceShell`):** Universal header, breadcrumbs, action toolbar, search/filter drawer, utility drawer, status bar.
- **Tables (`SMRITIGrid`):** Column resize, density switcher (compact / normal / relaxed), export, saved views.

---

## 5. Cultural & Historical Illustrations Rule
Cultural and historical SMRITI illustrations are reserved **exclusively** for:
- Login & Authentication
- Launchpad & Welcome Pages
- Empty States
- Help & Documentation

Cultural illustrations MUST NEVER be placed inside transactional business forms, grids, or POS terminals.

---

## 6. Universal Keyboard Navigation
| Shortcut | Enterprise Action |
| :--- | :--- |
| `Ctrl + N` | Create New Record |
| `Ctrl + S` | Save Current Record |
| `Ctrl + P` | Print Document |
| `Ctrl + F` | Search Active View |
| `Ctrl + K` | Global Enterprise Search |
| `Ctrl + E` | Export Grid / Report |
| `Ctrl + I` | Import Data Template |
| `F5` | Refresh Workspace State |
| `Esc` | Cancel / Close Drawer |

---

## 7. Migration Governance Rule
- All business logic, API endpoints, database models, and transaction contracts remain 100% untouched.
- All legacy themes and un-tokenized slate classes are governed by `npm run validate:seds` (CI/CD Release Gate).
