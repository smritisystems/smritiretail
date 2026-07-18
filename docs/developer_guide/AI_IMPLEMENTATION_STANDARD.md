# AI IMPLEMENTATION STANDARD v1.0

Document Status: ACTIVE
Version: 1.0

Authority Order

1. `IMPLEMENTATION_GATE.md`
2. `GOVERNANCE_FREEZE_CHECKLIST.md`
3. `ADR-002-SMRITI-METADATA-ARCHITECTURE.md`
4. `METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`
5. `AI_IMPLEMENTATION_STANDARD.md`

If any instruction in this document conflicts with a higher-priority document, the higher-priority document prevails.

Governance Baseline

Version: 1.0
Status: FROZEN

No governance document changes are permitted during normal feature development. Governance changes require a dedicated governance review and, where applicable, a new or superseding ADR.

This document defines the operating standard for AI implementation agents working on SMRITI Retail OS.

## Authority (highest to lowest)
1. `IMPLEMENTATION_GATE.md`
2. `GOVERNANCE_FREEZE_CHECKLIST.md`
3. `ADR-002-SMRITI-METADATA-ARCHITECTURE.md`
4. `METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`

## Mission
Implement approved functionality.

- Do not redesign architecture.
- Do not change governance.
- Do not introduce competing frameworks or parallel metadata models.

## Rules
- Read the governing documents before implementation.
- Implement only within approved architectural boundaries.
- If implementation conflicts with ADR-002:
  - STOP.
  - Report the conflict.
  - Do not invent a workaround.
- Do not modify governance documents without an approved governance review.

## Required before completion
- Build succeeds.
- Tests succeed.
- Lint succeeds.
- ADR-002 compliance is confirmed.
- No architecture drift is introduced.

## Final report
Every implementation delivery must include:
- Summary
- Files changed
- Tests executed
- ADR compliance statement
- Risks
- Known limitations

## Module Workflow
Implementation requests should follow a repeatable module workflow.

### 1. Module Readiness Check
- Dependencies are available.
- Governance has been reviewed.
- Entry criteria are satisfied.
- The scope is limited to one module.
- No architectural changes are planned.

### 2. Implementation
- Work on one bounded module only.
- Keep the scope narrow and aligned with the approved architecture.

### 3. Validation
- Build.
- Lint.
- Unit tests.
- Integration tests, where applicable.

### 4. Compliance Check
- Confirm ADR-002 compliance.
- Confirm no architecture drift.

### 5. Merge Readiness
- Implementation summary.
- Risks.
- Remaining work.

## Implementation Start Check
Use this checklist before beginning implementation:

- [ ] `IMPLEMENTATION_GATE.md` reviewed
- [ ] `ADR-002-SMRITI-METADATA-ARCHITECTURE.md` reviewed
- [ ] Module dependencies satisfied
- [ ] Scope limited to one module
- [ ] No architectural changes planned

If any answer is NO:
- STOP
- Request architecture review.

## Implementation Completion Report
Every completed task should include:

- Module:
- Summary:
- Files Changed:
- Build: PASS / FAIL
- Lint: PASS / FAIL
- Tests: PASS / FAIL
- ADR-002 Compliance: PASS / FAIL
- Architecture Drift Introduced: YES / NO
- Known Limitations:

## Notes
- This is an execution standard, not a governance artifact.
- It exists to enforce consistent implementation discipline under the frozen architecture.
