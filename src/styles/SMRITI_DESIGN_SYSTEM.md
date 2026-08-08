# SMRITI Design System v1.0

This document describes the token hierarchy, naming conventions, and usage guidance for SMRITI Retail OS design tokens and workspace primitives.

## Token Hierarchy
- SEEF base tokens: `smriti-tokens.css`, `sxp-tokens.css`
- Brand tokens: `smriti-brand-tokens.css`
- Foundational tokens: `smriti-typography-tokens.css`, `smriti-spacing-tokens.css`, `smriti-radius-tokens.css`, `smriti-shadow-tokens.css`, `smriti-zindex-tokens.css`, `smriti-mobile-tokens.css`, `smriti-motion-tokens.css`
- Semantic tokens: `smriti-semantic-tokens.css`
- Component tokens: `smriti-component-tokens.css`
- Theme overrides: `smriti-theme-*.css`

## Naming conventions
- Prefix component-level tokens with `--smriti-`.
- Use semantic intent names for colors: `--smriti-status-success`, `--smriti-status-error`.
- Spacing tokens follow `--smriti-space-{size}` and map to SEEF (`--sds-space-*`).

## Usage examples
- Card background: `background: var(--smriti-card-bg, var(--c-theme-surface-1))`
- Rounded corners: `border-radius: var(--smriti-radius-md)`
- Elevation: `box-shadow: var(--smriti-shadow-md)`

## Do / Don't
- Do: use tokens (e.g., `var(--smriti-card-bg)`)
- Don't: hardcode hex values or `rgb(...)` in component styles

## Component architecture
- Workspace primitives (stable): `WorkspaceCard`, `WorkspaceHeader`, `WorkspaceToolbar`, `WorkspaceSection`, `WorkspaceActionBar`, `WorkspaceBottomSheet`, `WorkspaceEmptyState`, `WorkspaceLoadingState`, `WorkspaceErrorState`
- Business components (thin wrappers) should compose the primitives.

## Mobile guidelines
- Prefer `--smriti-mobile-*` tokens for touch targets and gaps.
- Use bottom sheets for mobile actions, not modals.

## Accessibility
- Ensure color contrast against `--c-theme-body` meets WCAG 2.1 AA.
- Provide ARIA roles for interactive widgets and error/alert states.

## Governance
- Freeze tokens for v1.0. Changes must be approved and documented in `SMRITI_DESIGN_SYSTEM.md`.
- CI lint rules will be added after migration to block raw colors and inline spacing values.

