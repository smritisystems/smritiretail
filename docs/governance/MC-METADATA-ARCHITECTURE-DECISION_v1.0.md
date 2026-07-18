MASTER COMMAND: MC-METADATA-ARCHITECTURE-DECISION v1.0
PENDING ARCHITECT AUTHORIZATION
PHASE: 2 of 2 (Architecture Decision)

Date: 2026-07-17
Status: Proposed

## Objective
Derive canonical metadata architecture decisions from the Phase 1 evidence ledger at `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`.

## Inputs
- `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`
- `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md`

## Process
1. Verify the ledger exists and is internally consistent.
2. Use the ledger's evidence to classify metadata domains and canonical owners.
3. Identify any dead or unused registry APIs in `src/services/metadataRegistry.ts`.
4. Determine whether subsystem-owned metadata domains (print, report, numbering) should remain separate.
5. Evaluate WorkflowEngine evidence and make a canonical/non-canonical disposition.

## Expected deliverables
- A stable architecture decision document under `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md`.
- A clear linkage from Phase 1 evidence to Phase 2 decisions.

## Notes
This Phase 2 directive is the parent of the v1.1 correction patch. It exists so that the current ADR revision is grounded in a real governance trail rather than only in chat history.
