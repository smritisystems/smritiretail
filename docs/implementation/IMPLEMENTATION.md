# SMRITI Retail OS Implementation Roadmap

This document defines the controlled implementation sequence for SMRITI Retail OS under the frozen governance baseline.

## Purpose
- Provide a clear, repeatable execution roadmap.
- Keep implementation work aligned with the approved architecture.
- Avoid creating new governance artifacts unless a genuine architectural change is required.
- Guide AI agents and developers on the next phases of module delivery.

## Governance Baseline
Implementation work must obey the following hierarchy:
1. `docs/governance/IMPLEMENTATION_GATE.md`
2. `docs/governance/GOVERNANCE_FREEZE_CHECKLIST.md`
3. `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md`
4. `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`
5. `docs/developer_guide/AI_IMPLEMENTATION_STANDARD.md`

Governance Status:
- Version: 1.0
- Status: FROZEN

> No governance document changes during normal feature development. Any governance change requires a dedicated governance review and, where applicable, a new or superseding ADR.

## Implementation Phases

### Phase 1 — Foundation
Goal: Prepare common infrastructure for all modules.

Tasks:
- Metadata Infrastructure
- Common Repository Layer
- Entity Base Classes
- Shared Validation Framework
- Event Infrastructure
- Dependency Injection cleanup
- Common Error Handling
- Audit Framework

Expected output:
- Build PASS
- Tests PASS
- ADR Compliance PASS

### Phase 2 — Master Data
Implement core organizational entities:
- Company
- Branch
- Store
- Warehouse

### Phase 3 — Business Masters
Implement business master entities:
- Customer
- Supplier
- Product
- Barcode
- Category
- Brand
- Tax Master

### Phase 4 — Inventory
Implement inventory management:
- Stock
- GRN
- Transfers
- Adjustments
- Batch
- Serial
- Costing

### Phase 5 — Purchase
Implement the complete purchase module.

### Phase 6 — Sales
Implement the complete sales module.

### Phase 7 — POS
Implement point-of-sale capabilities:
- Billing
- Offline Sync
- Printer
- Barcode Scanner
- Cash Drawer
- Payment Gateway

### Phase 8 — Reporting
Implement reporting and analytics:
- Reports
- Dashboard
- Analytics
- Print Engine

### Phase 9 — Government Integrations
Implement regulatory and compliance integrations:
- GST
- E-Invoice
- E-Way Bill
- Compliance
- SGIP

## Module Workflow
Every implementation should follow this sequence:

1. Module Readiness Check
   - Dependencies available
   - Governance reviewed
   - Entry criteria satisfied
   - Scope limited to one module
   - No architectural changes planned

2. Implementation
   - Implement only the assigned module
   - Stay within ADR-002 and the implementation standard

3. Validation
   - Build
   - Lint
   - Unit tests
   - Integration tests, where applicable

4. Compliance Check
   - Confirm ADR-002 compliance
   - Confirm no architecture drift

5. Merge Readiness
   - Implementation summary
   - Risks
   - Remaining work

## Implementation Start Check
- [ ] `docs/governance/IMPLEMENTATION_GATE.md` reviewed
- [ ] `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md` reviewed
- [ ] Module dependencies satisfied
- [ ] Scope limited to one module
- [ ] No architectural changes planned

If any answer is NO:
- STOP
- Request architecture review

## Implementation Completion Report
Every completed module should include:
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
- This roadmap is for execution only.
- It does not change the governance baseline.
- Do not create new architecture governance documents unless a genuine architectural change is required.
