<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# SMRITI Enterprise Engine Framework (SEEF) Theme Migration & Compliance Guide v1.0

**Status:** FROZEN — SEEF Migration & Compliance Guide v1.0 (2026-08-03)
**Scope:** Developer Guidelines, Approved Mapping Rules, & Studio Checklist

---

## 1. Approved Token Mapping Matrix

When creating or refactoring components, developers MUST replace raw colors or legacy names with canonical SEEF tokens or Semantic Component Tokens (SCT v1.0).

| Category | Forbidden Legacy / Literal | Approved SEEF / SCT Token | Intended Usage |
|---|---|---|---|
| **Background (Base)** | `#0D1117`, `#0E131F`, `#121824` | `var(--c-theme-surface-1)` / `var(--launchpad-shell-bg)` | Deepest workspace background & shell canvas |
| **Background (Panels)** | `#161E2E`, `#1E293B`, `#1A2333` | `var(--c-theme-surface-2)` / `var(--workspace-card-bg)` | Cards, dialog panels, header bars, and form sections |
| **Borders & Dividers** | `border-[#1E293B]`, `border-[#30363d]` | `var(--c-theme-divider)` / `var(--workspace-card-border)` | Card outlines, table gridlines, and section splitters |
| **Primary Accent** | `#0A6ED1`, `#2563EB`, `dark:#6FA8DC` | `var(--c-seef-accent)` / `var(--workspace-sidebar-active-bg)` | Interactive buttons, selected tabs, focus rings, brand badges |
| **Body / Readability** | `text-[#E2E8F0]`, `text-[#C9D1D9]`, `text-slate-200` | `var(--c-theme-body)` / `var(--c-theme-primary)` | Main readable body text and input text |
| **Muted Metadata** | `text-[#64748B]`, `text-[#8B949E]`, `text-slate-400` | `var(--c-theme-muted)` / `var(--input-placeholder)` | Labels, subtitles, timestamps, placeholder text |
| **Status (Success)** | Hardcoded `#10B981` in theme background | `var(--c-seef-success)` / `var(--approval-badge-done-fg)` | Positive indicators, complete states, stock in-bound |
| **Status (Warning)** | Hardcoded `#F59E0B` in theme background | `var(--c-seef-warning)` / `var(--approval-badge-pending-fg)` | Pending alerts, low stock warnings, reorder thresholds |
| **Status (Danger)** | Hardcoded `#EF4444` in theme background | `var(--c-seef-danger)` / `var(--approval-badge-alert-fg)` | Error messages, destructive actions, out-of-stock indicators |

---

## 2. Forbidden Patterns vs. Approved Solutions

### ❌ Pattern 1: Hardcoded Hex in JSX `className`
```tsx
// FORBIDDEN (Triggers SEEF-001 & ESLint TGR-002 Violation)
<div className="bg-[#0E131F] border border-[#1E293B] text-white">

// APPROVED SOLUTION
<div className="bg-theme-surface-1 border border-theme-divider text-theme-primary">
```

### ❌ Pattern 2: Tailwind `dark:` Variants in Workspace Layers
```tsx
// FORBIDDEN (Triggers SEEF-002 & ESLint TGR-001 Violation)
<div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">

// APPROVED SOLUTION
<div className="bg-theme-surface-2 text-theme-body">
```

### ❌ Pattern 3: Legacy Token Aliases
```tsx
// FORBIDDEN (Triggers SEEF-004 & scan_undefined_vars.js Gate Failure)
<div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>

// APPROVED SOLUTION
<div style={{ background: "var(--workspace-card-bg)", border: "1px solid var(--workspace-card-border)" }}>
```

---

## 3. New Studio SEEF Compliance Checklist

Before registering any new business studio or workspace module with the platform, the author MUST complete and verify this checklist:

```text
[ ] 1. ZERO Hardcoded Hex Colors: Verified clean with `git grep 'bg-\[#'` and `SEEF-001`.
[ ] 2. ZERO Tailwind dark: Overrides: Verified clean with `SEEF-002` and ESLint TGR-001.
[ ] 3. SCT Token Integration: Component consumes Level 3 SCT tokens (`var(--workspace-*)`).
[ ] 4. Undefined Variable Gate: Executed `node scripts/scan_undefined_vars.js` with 0 errors.
[ ] 5. SEEF Certification: Fully compliant with SEEF_CERTIFICATION_STANDARD_V1.md.
[ ] 6. Browser Verification: Tested across Light, Dark, SAP Fiori Lite, and High Contrast modes.
```
