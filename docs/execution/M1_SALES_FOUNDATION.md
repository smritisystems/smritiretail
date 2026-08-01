# Milestone 1 — Sales Foundation

**Status:** Planned  
**Objective:** Deliver the first complete Sales capability pack using the approved document-driven workflow.

## Business Documents

1. Sales Quotation
2. Sales Order
3. Delivery Challan
4. Sales Invoice
5. Sales Return

## Delivery Sequence

```text
Quotation
    ↓
Sales Order
    ↓
Reservation
    ↓
Delivery Challan
    ↓
Sales Invoice
    ↓
Payment
    ↓
Sales Return
```

## Definition of Done

A document is considered complete only when it includes:
- Master Data integration
- Business validation
- Workflow
- Document Lifecycle
- Numbering
- Inventory integration (where applicable)
- Finance integration (where applicable)
- Tax
- Discount
- Audit Trail
- Print
- Reports
- Dashboard
- APIs
- Tests
- Documentation
- UAT

## Progress

- Overall Progress: 0%
- Current Focus: Sales Quotation

## Dependency

- RC1 Platform Foundation must be frozen and stable
- Document Definition, pipeline, workflow, numbering, and lifecycle mechanisms must be available

## Risks

- Scope creep into platform abstraction work
- Incomplete integration across inventory and finance
- Missing UAT coverage for the full workflow

## Blockers

- None recorded yet

## Test Status

- Backend: Pending
- Frontend: Pending
- End-to-End: Pending

## UAT Status

- Pending

## Release Decision

- Not yet ready for release
