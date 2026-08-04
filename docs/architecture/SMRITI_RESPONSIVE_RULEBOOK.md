<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritisys.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Specification: SMRITI Responsive Rulebook
  Version      : 1.0.0
  Created      : 2026-08-04
  Classification: Internal Product Architecture
-->

# SMRITI Responsive Rulebook

**Status:** DRAFT RULEBOOK — v1.0 (2026-08-04)

## 1. Purpose

The SMRITI Responsive Rulebook defines business-driven responsive behavior for the SEP UX platform.
It focuses on experience transitions and interaction patterns rather than raw CSS breakpoints.

## 2. Responsive Platform Rules

### Phone

- Use bottom navigation.
- Use stacked content and cards.
- Avoid sidebars.
- Prefer bottom sheets for forms and quick workflows.

### Tablet

- Use dual-pane layouts where appropriate.
- Use bottom navigation or compact side navigation.
- Support touch and keyboard where available.

### Desktop

- Use sidebar navigation.
- Use workspace shells with docked panels.
- Enable keyboard and mouse-first workflows.
- Use expandable grids, pivot tables, and inspector panels.

## 3. Transition Rules

- When moving from phone to tablet, preserve task continuity using adaptive stacks.
- When moving from tablet to desktop, reveal additional workspace panels and inspectors.
- The same business flow may adapt interaction density, but must preserve user intent.

## 4. Responsive UX Patterns

### Phone Pattern

```
Phone

↓

Bottom Navigation
```

### Tablet Pattern

```
Tablet

↓

Dual Pane
```

### Desktop Pattern

```
Desktop

↓

Sidebar
```

## 5. Business Rules

- Use the Mobile experience when the user is operationally focused on speed and touch.
- Use the Desktop experience when the user is focused on productivity, data review, and multi-tasking.
- Responsive behavior should never collapse Desktop workflow into Mobile interactions.
- Different UX modes may share components, but the experience contract is separate.
