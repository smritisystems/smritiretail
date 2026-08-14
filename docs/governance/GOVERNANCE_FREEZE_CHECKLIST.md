# Governance Freeze Checklist

PENDING ARCHITECT AUTHORIZATION

This checklist formally freezes the current ADR and evidence documents as the architecture baseline for the repository.

## Frozen documents
- `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`
- `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md`
- `docs/governance/ADR_002_COMPLIANCE_AUDIT.md`

## Governance Baseline

Baseline Version: 1.0
Baseline Date: 2026-07-17
Approved By: [PENDING ARCHITECT REVIEW]
Repository Commit SHA: `617570892cd1e5f0169c4aa1429b5e8cffbe620a`

Supersedes:
- None

May be superseded only by:
- A new approved ADR

## Freeze principles
- These documents are the approved baseline for ADR-002 metadata architecture governance.
- Future implementation changes must be assessed against this baseline.
- Do not modify these documents without a separate ADR or governance approval.

## Architecture Change Rule
Any pull request that changes:
- metadata ownership
- entity definition model
- runtime metadata behavior
- workflow ownership
- validation ownership
- generated artifact boundaries

MUST either:
1. Comply with ADR-002, or
2. Include a new ADR that supersedes ADR-002.

Otherwise the PR should not be approved.

## Reviewer questions for any implementation PR
1. Does this change comply with ADR-002 as documented in the frozen governance files?
2. If not, has a new ADR been approved or is a new ADR being proposed?
3. Does the PR introduce new runtime metadata ownership, new workflow behavior, or new subsystem boundaries?
4. Are any proposed changes reflected in an updated governance audit or decision document?

## Notes
- This checklist is governance guidance only.
- It does not authorize implementation changes by itself.
