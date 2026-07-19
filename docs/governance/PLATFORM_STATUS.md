<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.0
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Platform Status Registry

This document records high-level metrics of SMRITI Retail OS's evolutionary status. It is updated at the conclusion of every Master Command.

## Codebase Status Summary
* **Current Version:** v3.18.0
* **Platform Architecture:** Hybrid Express + FastAPI
* **Target Architecture:** Modular Microservices Platform
* **Platform Roadmap:** [PLATFORM_MICROSERVICES_ROADMAP.md](../architecture/PLATFORM_MICROSERVICES_ROADMAP.md)
* **PostgreSQL Schema Version:** alembic-96b45b17b8b1 (head)
* **Overall Migration Completion:** 68%

## Accepted Metadata Architecture Dispositions
These entries document accepted architectural decisions for metadata ownership. They are not unresolved debt and require no migration or re-centralization action unless a new ADR is created.

- **WorkflowEngine / workflow metadata:** `backend/app/api/v1/workflow.py` is accepted as the canonical workflow/status-transition metadata owner. This capability is in active use by Sales and Purchase workflows and is not planned to be migrated into `src/services/metadataRegistry.ts`. [ADR-002 v1.1, Ledger §2]
- **`masters_registry.ts` / Customer bespoke pattern:** `src/masters_registry.ts` remains canonical for static master schema metadata, while the Customer domain remains a separate bespoke pattern. No migration from Customer to the generic masters registry is planned. [ADR-002, Ledger §3]
- **Print/report engine metadata independence:** `src/print_engine/print_store.tsx` and `ReportDesignerTab.tsx` remain accepted as subsystem-owned metadata domains. Centralizing print/report metadata under `MetadataRegistry` is not currently planned. [ADR-002, Ledger §4/§5]

---

## Module Migration Breakdown

| Module | Persistence Target | Code Migration % | Frontend Integration % | Operational Status |
|---|---|---|---|---|
| **Auth & Security** | PostgreSQL (Alembic) | 90% | 90% | Stable |
| **Master Data Framework** | PostgreSQL (Alembic) | 100% | 100% | Production |
| **Company Provisioning** | PostgreSQL (Alembic) | 80% | 50% | In Progress |
| **Sales Studio** | Express Memory / PostgreSQL | 60% | 0% | In Progress |
| **Purchase Studio** | Express Memory / PostgreSQL | 80% | 0% | Ready |
| **POS Terminal & Shifts** | Express Memory / PostgreSQL | 80% | 0% | Ready |
| **Accounting Foundation** | Express Memory | 0% | 0% | Pending |

---

## Engineering Roadmap History

| Version | Milestone Date | Master Command Reference | Major Focus / Accomplishment |
|---|---|---|---|
| **v3.17.0** | 2026-07-14 | Master Command 1 | Consolidated Tier-1 & Tier-2 Master Data to FastAPI. |
| **v3.18.0** | 2026-07-14 | Master Command 2 | Transactional Core Migration & controlled cutover (Sales, Purchase, POS). |
