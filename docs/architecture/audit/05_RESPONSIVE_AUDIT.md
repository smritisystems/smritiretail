# Responsive Audit

## Audit ID

AUD-005

## Title

Responsive Audit

## Purpose

Validate the current responsive behavior of SMRITI workspace shell and ensure the intended breakpoints and layout adaptivity are enforced.

## Scope

- Shell header / toolbar layout across viewports
- Breadcrumb and filter strip behavior on mobile
- Dashboard grid collapse rules
- POS focus and touch mode adaptation

## Evidence

- Responsive rules in `src/layout_engine/responsive_manager.ts`
- Breakpoints in `src/styles/smriti-tokens.css`
- Shell header and filter strip layout patterns

## Current State

(To be populated during the responsive audit.)

## Problems

## Scope

- Shell header / toolbar layout across viewports
- Breadcrumb and filter strip behavior on mobile
- Dashboard grid collapse rules
- POS focus and touch mode adaptation

## Evidence

- Review `src/layout_engine/responsive_manager.ts`
- Compare CSS breakpoints in `src/styles/smriti-tokens.css`
- Inspect actual workspace shell rendering rules

## Current State

(To be populated during the responsive audit.)

## Problems

- Misaligned breakpoint behavior can break mobile workflows
- Filter strip may not adapt consistently across zones
- POS focus mode must remain compact and usable on small screens

## Architecture Score

- Runtime: TBD
- Ownership: TBD
- Theme: TBD
- Responsive: TBD
- Accessibility: TBD
- Overall: TBD

## Recommendations

- Keep responsive behavior driven by `responsive_manager.ts` and tokenized breakpoints
- Enforce shell consistency across all workspaces
- Audit `WorkspaceKernelHeader` mobile/compact styles for drift

## Migration Priority

- High for shell and global header layout
- Medium for dashboard widget grid behavior
- Low for isolated desktop-only views

## Owner

- Architecture Team / UX Governance

## Last Reviewed

- 2026-08-04

## Status

- Draft
