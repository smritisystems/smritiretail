# Architecture Drift Audit

## Audit ID

AUD-009

## Title

Architecture Drift Audit

## Purpose

Capture drift between the intended SMRITI architecture and the actual implementation in the frontend workspace shell, header, theme, and runtime patterns.

## Scope

- Expected shell/header/runtime patterns
- Actual component and style usage
- Architecture drift in theme tokens and layout primitives
- Runtime governance violations and duplication

## Evidence

- Comparison between source files and intended architecture contract
- Non-canonical component and style patterns
- Header and theme drift examples

## Current State

(To be populated during the architecture drift audit.)

## Problems

## Scope

- Expected shell/header/runtime patterns
- Actual component and style usage
- Architecture drift in theme tokens and layout primitives
- Runtime governance violations and duplication

## Evidence

- Compare actual source files against the intended `WorkspaceShell` / `WorkspaceKernelHeader` architecture
- Scan for `DocumentHeader`, `WorkspaceHeader`, `AdaptiveHeader`, and other non-canonical header implementations
- Identify direct theme token bypass patterns such as `bg-white` or inline color values

## Current State

(To be populated during the architecture drift audit.)

## Problems

- Drift reduces the value of the governance baseline
- Multiple header implementation variants increase maintenance cost
- Non-canonical theme styling weakens design-system consistency

## Severity Classification

- Critical: TBD
- High: TBD
- Medium: TBD
- Low: TBD
- Informational: TBD

## Technical Debt Score

- Critical : TBD
- High : TBD
- Medium : TBD
- Low : TBD
- Debt Score : TBD

## Confidence

- Evidence Confidence: TBD
- Manual Verification: TBD
- Automated Scan: TBD
- Source Verified: TBD

## Architecture Score

- Runtime: TBD
- Ownership: TBD
- Theme: TBD
- Responsive: TBD
- Accessibility: TBD
- Overall: TBD

## Recommendations

- Define the canonical architecture contract and mark deviations as drift.
- Flag all non-shell/non-kernel header implementations for consolidation.
- Add a drift detection step to architecture reviews.

## Migration Priority

- High for shell/header drift
- Medium for theme and runtime drift
- Low for isolated visual drift

## Owner

- Architecture Team / Governance

## Last Reviewed

- 2026-08-04

## Status

- Draft
