# SMRITI Responsive UX Constitution v1.0

_Status: Approved for implementation_

## Core Principle

SMRITI adopts enterprise UX principles and responsive architecture inspired by SAP Fiori while preserving its own visual identity, retail-first workflows, adaptive workspace engine, and high-density productivity.

## Constitutional Rules

### SRUX-001: Shared Components First

New screens use the SMRITI shared component library by default. Custom layouts are allowed for specialized workflows such as POS, barcode printing, dashboards, visual designers, and high-density data entry. Exceptions remain compatible with the shared framework.

### SRUX-002: Shared Responsive Framework

Layer 1 owns responsive layout, breakpoints, grids, containers, dialogs, navigation, responsive utilities, accessibility infrastructure, and design tokens. Business modules consume these services instead of recreating their own responsive foundations.

### SRUX-003: Single-Responsibility Components

Shared components expose focused contracts. Page shells own regions, toolbars own action priority and overflow, tables own responsive column strategies, forms own field layout and validation, and dialogs own viewport sizing and focus behavior.

### SRUX-004: Responsive Strategies

Responsive behavior is chosen by workflow. Forms stack fields; tables may use priority columns, expandable details, compact cards, or internal scrolling when the data is genuinely tabular; toolbars prioritize primary actions and move secondary actions into overflow.

### SRUX-005: Centralized Tokens

Colors, typography, radius, shadows, spacing, breakpoints, container widths, grid sizes, motion, focus, and touch targets are centrally managed. Modules must not introduce parallel token systems.

### SRUX-006: Controlled Exceptions

POS, barcode printing, label design, analytics, visual editors, and high-density data entry may extend shared behavior when required by their workflow. They may not bypass shared accessibility, viewport safety, or token contracts.

### SRUX-007: Incremental Migration

New screens use shared components first. High-traffic screens migrate before low-risk legacy screens. Legacy layouts remain supported during transition. Migrations require validation and must avoid disruptive rewrites.

### SRUX-008: Accessibility

Interactive targets provide at least 44 by 44 CSS pixels where practical. UX changes preserve keyboard navigation, visible focus, screen-reader semantics, touch access, and WCAG 2.2 AA contrast.

### SRUX-009: Responsive Standards

Validate at 320, 768, 1024, 1440, and 2560 pixels. Pages must not create avoidable viewport-level horizontal overflow, clip controls, hide inaccessible actions, or place dialogs outside the viewport. Dialogs retain a minimum 12px viewport margin.

### SRUX-010: Print Integrity

Screen previews may scale visually. Physical output must preserve dimensions, DPI, margins, barcode sizes, and printer command formats such as ZPL, TSPL, EPL, and ESC/POS.

### SRUX-011: Performance

Responsive behavior minimizes layout reflows and resize work. Large datasets use virtualization or pagination where appropriate, and shared primitives avoid unnecessary rendering.

### SRUX-012: Validation

Validation is risk-based. Shared layout, dialog, table, token, and navigation changes require TypeScript compilation, linting, focused tests, responsive viewport checks, accessibility checks, and visual regression coverage. Narrow changes require the smallest equivalent focused checks.

## Success Criteria

- One shared responsive framework powers all modules.
- Shared components are the default building blocks.
- Exceptions are controlled, documented, and justified.
- Supported viewports have no avoidable page-level horizontal overflow.
- Responsive behavior is consistent, accessible, performant, and maintainable.
- Print output remains physically accurate regardless of screen layout.
- Existing modules migrate progressively without disruptive rewrites.
- Future modules inherit responsive behavior automatically.

## UX Philosophy

> Enterprise Power. Retail Simplicity. Mobile First. Fiori-Inspired. Uniquely SMRITI.
