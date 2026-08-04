# Theme Purity Audit

## Audit ID

AUD-004

## Title

Theme Purity Audit

## Purpose

Measure adherence to the SMRITI theme token system and identify visual drift caused by direct CSS class or inline style usage.

## Scope

- CSS token usage in UI components
- Inline style overrides
- Legacy theme class references
- Color and spacing consistency

## Evidence

- Hard-coded color and spacing patterns
- Inline style blocks in workspace-related components
- Token definitions in `src/styles/smriti-tokens.css`

## Current State

(To be populated during the theme purity audit.)

## Problems

## Scope

- CSS token usage in UI components
- Inline style overrides
- Legacy theme class references
- Color and spacing consistency

## Evidence

- Scan component files for hard-coded colors
- Identify inline style blocks in workspace-related components
- Compare against `src/styles/smriti-tokens.css`

## Current State

(To be populated during the theme purity audit.)

## Problems

- Hard-coded values bypass token theming
- Inline styles reduce theme portability
- Legacy classes may not respond to theme mode changes

## Architecture Score

- Runtime: TBD
- Ownership: TBD
- Theme: TBD
- Responsive: TBD
- Accessibility: TBD
- Overall: TBD

## Recommendations

- Replace hard-coded colors with semantic token names
- Remove inline style overrides where possible
- Centralize theme decisions in `ThemeContext` and token CSS

## Migration Priority

- High for runtime-critical shell components
- Medium for document studio visuals
- Low for low-impact helper components

## Owner

- Architecture Team / UX Governance

## Last Reviewed

- 2026-08-04

## Status

- Draft
