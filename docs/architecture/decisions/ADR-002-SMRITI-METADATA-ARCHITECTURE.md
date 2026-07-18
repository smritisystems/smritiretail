# ADR-002: SMRITI Metadata Architecture

Date: 2026-07-17
Status: Accepted
Approved by: Chief Software Architect, 2026-07-17
Revision: v1.1 — corrects Section 6(b) only. See "Revision note" below.

## Revision note (v1.0 → v1.1)

v1.0's disposition on `WorkflowEngine` was based on Ledger §2, whose only evidence was a frontend-only search for `WorkflowEngine` in `src/**/*.{ts,tsx}`. That search could not and did not check whether the same capability existed under different naming in the backend. It does.

Verified against the live repository at the time of this revision:

- `backend/app/api/v1/workflow.py` — exists, mounted in `backend/app/main.py:110`:
  `app.include_router(workflow.router, prefix="/api/v1/workflow", tags=["Workflow"])  # AD-3: Core Workflow`
- `src/components/SalesStudioTab.tsx:523` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/approve`)`
- `src/components/SalesStudioTab.tsx:537` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/cancel`)`
- `src/components/SalesStudioTab.tsx:764` — `apiFetchV1(`/workflow/${docType}/${id}/${action}`)`
- `src/components/PurchaseStudioTab.tsx:516` — `apiFetchV1(`/workflow/PurchaseOrder/${id}/${action}`)`

The TypeScript `WorkflowEngine` class still exists in `src/services/workflowEngine.ts`, unmodified, with zero import/call sites — its capability has been superseded by `backend/app/api/v1/workflow.py`, but the dead file itself has not been removed. Its deletion is a separate, not-yet-authorized action. This revision corrects the workflow disposition while leaving the rest of ADR-002 unchanged.

## Context
This decision is derived solely from the Phase 1 evidence ledger at `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`.
No additional codebase audit or external proposals are introduced.

## 6 — Architecture Decision

### Canonical metadata architecture
The canonical metadata architecture is a bounded hybrid model:
- `src/services/metadataRegistry.ts` is canonical for runtime module metadata only.
- `src/masters_registry.ts` is canonical for design-time master schema metadata.
- `backend/app/api/v1/workflow.py` is canonical for workflow/status-transition metadata.
- Subsystem-owned metadata domains remain canonical within their own engines where evidence shows real operation, specifically print, report, and numbering.

This decision accepts separate canonical owners for distinct metadata domains rather than forcing a single registry for all runtime metadata. It is based on ledger findings in printing and reporting metadata evidence and print/report engine ownership (Ledger §4 and §5), and — as of this revision — on the workflow evidence in the Revision note above.

### Ownership matrix
| Metadata domain | Canonical owner | Decision source |
|---|---|---|
| Module runtime metadata | `src/services/metadataRegistry.ts` | Ledger §1, Appendix A |
| Static master schema metadata | `src/masters_registry.ts` | Ledger §3 |
| Workflow / status-transition metadata | `backend/app/api/v1/workflow.py` (`main.py:109`) | Revision note (v1.1); supersedes Ledger §2 |
| Print template metadata | `src/print_engine/print_store.tsx` | Ledger §5 |
| Report metadata | report UI/backend report APIs | Ledger §5 |
| Numbering metadata | `src/services/numberingEngine.ts` | Ledger §4 |
| Customer business validation/policy | `src/services/customerValidation.ts` / `src/services/customerPolicyEngine.ts` | Ledger §3 |

### Design-time vs runtime metadata
- Design-time metadata: `src/masters_registry.ts` static definitions and global audit field metadata are design-time artifacts. [Ledger §3]
- Runtime metadata: `MetadataRegistry` is runtime metadata for modules; `workflow.py` is runtime metadata for document status transitions, consumed live by Sales and Purchase; print/report/numbering engines are runtime metadata owners for their own domains. [Ledger §1, §4, §5; Revision note for workflow]

### Generated artifacts
No generated artifacts are justified by the ledger evidence. The canonical architecture is authored metadata plus runtime registration and lookup, not generator-produced artifacts. This holds for the workflow correction as well — `workflow.py`'s transition rules are a hand-authored table, not a generated one. [Ledger §1, §5; Revision note]

### Manual business logic boundaries
Manual business logic remains handwritten for:
- Customer validation and policy enforcement. [Ledger §3]
- Numbering allocation and audit metadata behavior. [Ledger §4]
- Print output registration and report scheduling behavior. [Ledger §5]
- Workflow transition rules (which docType/action/role combinations are valid). [Revision note]
These domains are explicitly supported by dedicated services and engines rather than by a generic metadata registry, so the decision preserves handwritten business logic in those areas.

### Mandatory dispositions

(a) MetadataRegistry's unused register* methods
- Decision: Retire the unused `registerScreen`, `registerReport`, `registerForm`, `registerApi`, `registerDatabase`, and `registerPrintTemplate` categories from the canonical metadata architecture. Keep `MetadataRegistry` canonical only for module metadata. [Ledger §1, Appendix A row "MetadataRegistry dead-method finding"]

(b) WorkflowEngine — CORRECTED in this revision
- v1.0 decision (superseded): "Do not wire `WorkflowEngine` into the canonical metadata architecture at this time. It remains non-canonical until ledger evidence of active consumers appears."
- v1.1 decision: WorkflowEngine's capability is canonical, implemented at `backend/app/api/v1/workflow.py`, mounted at `/api/v1/workflow`, and actively consumed by `SalesStudioTab.tsx` (approve, cancel, generic workflow action) and `PurchaseStudioTab.tsx` (generic workflow action on Purchase Orders). It is not a candidate for retirement or repurposing — it is load-bearing today. [Revision note, citations above]

(c) `masters_registry.ts` vs Customer bespoke-pattern split
- Decision: Treat `masters_registry.ts` as canonical for static schema metadata and retain the Customer domain as a separate bespoke business pattern. Do not migrate Customer to the generic static schema until concrete evidence shows the generic metadata can represent its business and policy semantics. [Ledger §3, Appendix A row "masters_registry.ts vs. Customer bespoke-pattern finding"]

(d) Print/report engine independence
- Decision: Accept subsystem-owned metadata for print and report as acceptable long-term. The ledger shows these engines have real working registration systems independent of `MetadataRegistry`, so a single global registry is not required to be canonical for those domains. [Ledger §4 and §5]

### Open risk
- v1.0 stated: "The ledger does not provide evidence for a unified external metadata consumer beyond module metadata and backend application metadata." This is now partially resolved: workflow metadata has exactly this shape — one canonical owner (`workflow.py`) consumed by two independent domains (Sales, Purchase). This strengthens rather than weakens the case for domain-scoped canonical owners over one universal registry — the pattern that works (`workflow.py`) succeeded by being purpose-built for one concern, not by being generic.
- Any future proposal to centralize print, report, or numbering metadata under one registry still requires new evidence and a separate ADR — that part of v1.0's open risk stands.
- Process risk, not an architecture risk: this correction exists because Ledger §2's search methodology could not see a backend port of a frontend-named concept. Any future ledger revision covering a TS-to-Python migration should search both sides independently rather than re-running the same string search against a tree that may no longer hold the answer.

## 7 — Implementation Roadmap titles

1. Establish module metadata owner in MetadataRegistry
2. Consolidate static master schema ownership under masters_registry.ts
3. Recognize workflow/status-transition metadata as canonical under backend/app/api/v1/workflow.py
4. Stabilize subsystem-owned print and report metadata domains
5. Preserve customer validation and policy as explicit handwritten boundaries
6. Document canonical metadata ownership and architecture boundaries
