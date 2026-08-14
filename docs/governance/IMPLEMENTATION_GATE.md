# Implementation Gate

PENDING ARCHITECT AUTHORIZATION

Status: ACTIVE
Version: 1.0
Effective Date:
Approved By:
Baseline ADR: ADR-002-SMRITI-METADATA-ARCHITECTURE
Supersedes: None

This gate defines when implementation work is allowed and how it must remain aligned with the frozen ADR governance baseline.

## Entry Criteria
- ADR-002 is approved.
- The compliance audit has no blocking findings.
- The Governance Freeze Checklist is approved.

## Blocking Conditions
Implementation must not begin or continue if:
- ADR-002 has been superseded.
- A blocking finding exists in the compliance audit.
- The Governance Freeze Checklist is no longer valid.
- A required architectural decision is unresolved.

## Implementation Rules
- No module may introduce a second metadata ownership model.
- No implementation may bypass ADR-002 without a superseding ADR.
- Architectural assumptions must be traceable to governance documents.
- Any change affecting metadata ownership, workflow ownership, validation ownership, or runtime metadata behavior must reference ADR-002 or a new approved ADR.

## Exit Criteria (per module)
- The module passes tests appropriate to the module (unit, integration, and any required regression tests).
- The module conforms to ADR-002.
- The module has no unresolved architectural drift.
- The compliance checklist is completed for the module.

## Governance control
- Implementation may proceed only after this gate is in place.
- Any PR that affects architecture must cite the relevant governance baseline document.
- If a module cannot satisfy the exit criteria, it must be paused and reviewed under a separate ADR or audit.

## Notes
- This document is a transition gate, not an architecture decision.
- It preserves the boundary between governance approval and execution.

## Implementation Contract
Authority:
- ADR-002
- Governance Freeze Checklist

Allowed:
- Implement features
- Fix bugs
- Improve performance
- Add tests
- Update documentation

Not Allowed:
- Change metadata ownership
- Introduce parallel architectures
- Bypass ADR-002
- Create new registries
- Add competing frameworks
- Modify governance documents without an approved governance review

Before finishing each module:
1. Build passes
2. Tests appropriate to the module pass (unit, integration, and any required regression tests)
3. Lint passes
4. ADR-002 still satisfied
5. No architecture drift introduced

Output for completed work:
- Implementation summary
- Evidence
- Files changed
- Tests executed
- ADR compliance statement
- Outstanding risks (if any)
- Known limitations
