# Business Document Registry

**Purpose:** Provide the single operational source of truth for RC2 execution tracking across capabilities, documents, ownership, readiness, milestones, and versioning.

## Registry Format

| Capability | Document | Owner | Status | Readiness | Milestone | Version |
|---|---|---|---|---:|---|---|
| Sales | Sales Quotation | Sales Lead | Planned | 0% | M1 | v1 |
| Sales | Sales Order | Sales Lead | Planned | 0% | M1 | v1 |
| Sales | Delivery Challan | Sales Lead | Planned | 0% | M1 | v1 |
| Sales | Sales Invoice | Sales Lead | Planned | 0% | M1 | v1 |
| Sales | Sales Return | Sales Lead | Planned | 0% | M1 | v1 |
| Purchase | Purchase Order | Purchase Lead | Planned | 0% | M2 | v1 |
| Purchase | GRN | Purchase Lead | Planned | 0% | M2 | v1 |
| Inventory | Stock Transfer | Inventory Lead | Planned | 0% | M3 | v1 |
| Finance | Receipt Voucher | Finance Lead | Planned | 0% | M4 | v1 |
| CRM | Lead | CRM Lead | Planned | 0% | M5 | v1 |
| Unified Commerce | Retail POS | Commerce Lead | Planned | 0% | M6 | v1 |

## Governance Rule

The registry is the authoritative tracker for execution status. Updates should be made here before reporting progress elsewhere.

## Recommended Use

- Update readiness as each document progresses
- Mark status when a document reaches implementation, testing, or UAT readiness
- Use the registry for release planning and executive reporting
