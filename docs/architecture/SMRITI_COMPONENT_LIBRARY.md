<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritisys.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Specification: SMRITI Component Library
  Version      : 1.0.0
  Created      : 2026-08-04
  Classification: Internal Product Architecture
-->

# SMRITI Component Library

**Status:** DRAFT LIBRARY SPEC — v1.0 (2026-08-04)

## 1. Purpose

The SMRITI Component Library defines the shared UI primitives and design contracts used by both Mobile and Desktop experiences.

## 2. Component Categories

### 2.1 Core Primitives

- `Button`
- `Input`
- `Select`
- `Checkbox`
- `Radio`
- `Toggle`
- `Label`
- `Text`
- `Tooltip`

### 2.2 Layout & Surface

- `Card`
- `Panel`
- `Sheet`
- `Dialog`
- `Drawer`
- `Toolbar`
- `Tabs`
- `Stack`

### 2.3 Navigation

- `Sidebar`
- `BottomNavigation`
- `CommandPalette`
- `Breadcrumb`
- `Pagination`

### 2.4 Data Display

- `Table`
- `List`
- `Badge`
- `Chip`
- `Avatar`
- `Progress`
- `Chart`

### 2.5 UX System Components

- `WorkspaceCard`
- `Notification`
- `BottomSheet`
- `StatusBar`
- `WorkspaceShell`
- `PropertyPanel`

## 3. Shared Behavior Rules

- Components share styling tokens and visual rhythm.
- Behavior adapts to Mobile or Desktop context.
- Components remain presentationally decoupled from business logic.
- Export the same contract across Mobile and Desktop when possible.

## 4. Implementation Notes

- Mobile uses compact touch targets, bottom sheets, and stacked panels.
- Desktop uses grid layouts, side panels, and multi-column workspaces.
- Both use the same style tokens, motion rules, and accessibility contracts.
