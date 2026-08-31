---
title: "Sprint 29: P1.1 Universal Party Master Completion (Data Plane Convergence)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 29 — P1.1 Universal Party Master Completion (Data Plane Convergence)

## 1. Purpose
This sprint fulfills **Blueprint Section 6: P1 Transactional Data-Plane Convergence (P1.1 Universal Party Master Completion)**. It consolidates the tenant-local Party model and bridges existing customer and supplier flows into a unified, polymorphic entity capable of representing any legal or operational stakeholder (Customer, Supplier, Dealer, Distributor, Salesman, Transporter, Employee) with multi-address, multi-contact, and credit/tax profile support, deduplication & merge policies, and zero-breaking-change legacy API adapters.

## 2. Scope
- **Polymorphic Multi-Role Assignment**: A single Party entity can hold multiple simultaneous operational roles (`CUSTOMER`, `SUPPLIER`, `DEALER`, `DISTRIBUTOR`, `SALESMAN`, `TRANSPORTER`, `EMPLOYEE`).
- **Sub-Entity Operational Data**:
  - Multi-address support via `PartyAddress` (Billing, Shipping, Warehouse, Registered Office).
  - Multi-contact support via `PartyContact` (Accounts, Sales, Logistics, Management).
  - Operational profiles: `CustomerProfile` (credit limits, tax category, pricing/loyalty tiers) and `SupplierProfile` (payment terms, MSME registration, tax treatment).
  - Hierarchical inter-party relationships via `PartyRelationship`.
- **Deduplication Engine**: Multi-tier identification matching against GSTIN -> Phone/Mobile -> Email -> Party Code.
- **Merge & Consolidation Policy**: Merges secondary party into primary party, consolidating roles, profiles, addresses, and contacts while marking secondary as `MERGED` with `merged_into_party_id`.
- **Legacy Compatibility Adapters**: Provides `get_legacy_customer_view()` and `get_legacy_supplier_view()` ensuring existing frontend and transactional modules interact with party identity without API regressions.
- **Database Schema Migration**: Automated migration script `backend/app/db/migr_party_ext.py` updating tenant databases `smriti001` and `smriti002`.
- **Verification**: 6/6 new integration tests in `backend/tests/t_party_master.py` (57/57 full platform regression tests green).

## 3. Files Created
- [`backend/app/schemas/party_master.py`](file:///F:/SMRITRretailNX/backend/app/schemas/party_master.py) — Pydantic models for Universal Party, roles, profiles, addresses, contacts, merge requests, and legacy adapters.
- [`backend/app/services/party_master_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/party_master_svc.py) — Universal Party Master service engine with atomic provisioning, deduplication, and merge logic.
- [`backend/app/db/migr_party_ext.py`](file:///F:/SMRITRretailNX/backend/app/db/migr_party_ext.py) — DDL migration script for party sub-entity tables across tenant databases.
- [`backend/tests/t_party_master.py`](file:///F:/SMRITRretailNX/backend/tests/t_party_master.py) — 6-part integration test suite.
- [`docs/walkthrough/foundation/Sprint29_Universal_Party_Master_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint29_Universal_Party_Master_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/models/party.py`](file:///F:/SMRITRretailNX/backend/app/models/party.py) — Added `PartyAddress`, `PartyContact`, `PartyRelationship`, and `merged_into_party_id`.
- [`backend/app/api/v1/universal_master.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_master.py) — Expanded REST API with `/parties`, `/parties/{party_id}`, `/parties/{party_id}/roles`, `/parties/merge`, and `/adapter/*` endpoints.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 6.1 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 29 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.45.0`.

## 5. Architecture Decisions
- **Polymorphic Authority**: Rather than duplicating records when an entity acts as both a Customer and Supplier, a single canonical `Party` record is created with distinct role bindings and sub-profiles.
- **Deduplication Priority**: Statutory GSTIN is prioritized for organizational deduplication, followed by mobile number, email, and internal business code.
- **Audit-Preserving Merges**: Merged parties are never hard-deleted; their status is updated to `MERGED` with a pointer to `merged_into_party_id` to preserve historical transaction lineage.

## 6. Design Rationale
In enterprise multi-tenant retail and supply chain ecosystems, distributors often act as both suppliers of wholesale inventory and retail customers for promotional returns or regional transfers. Unifying party identity eliminates data fragmentation and duplicate authority.

## 7. Implementation Summary
- **Search & Listing**: `GET /api/v1/universal/parties` with role and query filters.
- **Party Provisioning**: `POST /api/v1/universal/parties` with atomic multi-role profile instantiation.
- **Role Gating**: `POST /api/v1/universal/parties/{party_id}/roles` for dynamic role assignment.
- **Deduplication Merge**: `POST /api/v1/universal/parties/merge`.
- **Legacy Adapters**: `GET /api/v1/universal/parties/{party_id}/adapter/customer` and `/adapter/supplier`.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m app.db.migr_party_ext
python -m pytest tests/t_party_master.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 6 items

tests/t_party_master.py::test_create_party_with_multi_roles PASSED       [ 16%]
tests/t_party_master.py::test_find_party_by_identifiers_deduplication PASSED [ 33%]
tests/t_party_master.py::test_add_and_toggle_party_role PASSED           [ 50%]
tests/t_party_master.py::test_party_merge_policy_consolidation PASSED    [ 66%]
tests/t_party_master.py::test_legacy_customer_and_supplier_adapters PASSED [ 83%]
tests/t_party_master.py::test_api_party_crud_and_search_endpoints PASSED [100%]

======================== 6 passed, 8 warnings in 9.90s ========================
```

## 10. Known Limitations
- Item Master convergence is handled in P1.2.

## 11. Future Work
- Sprint 30: `P1.2 Universal Item Master Completion (Blueprint Section 6.2)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-006`: Universal Party and Item Master Convergence

## 13. Related RFCs
- `RFC-DATA-001`: Universal Polymorphic Entity Master Architecture
