<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 3.12.0
  Created      : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# CRM Customer Catalogue — GroupCode, CrmSegments CRUD & Batch Export (v3.12.0)

**Walkthrough ID:** CRM-WT-3.12.0
**Date:** 2026-10-19
**Author:** Jawahar Ramkripal Mallah
**Commit:** `4b705655`
**Status:** Completed

---

## 1. Purpose

Three outstanding Customer Catalogue improvements:
- **H2** — Short `code` field on `CustomerGroup` (e.g. CG-CORP, CG-VIP)
- **M3** — Full `CrmSegment` ORM table with CRUD: list, create, get, add-member, per-customer membership. Backward-compatible tag-derived fallback.
- **M4** — Streaming batch CSV export `GET /crm/export/customers/batch` (no row limit, offset-paginated, selectinload).

Bug fixes discovered during implementation:
- **M2** route path collision (`/customers/export` shadowed by `{customer_id}` param)
- **M2** missing `selectinload` import in export function

---

## 2. Scope

| Item | Type | Component |
|---|---|---|
| H2 CustomerGroup.code | Enhancement | models/crm.py, api/v1/crm.py, alembic/v1539 |
| M3 CrmSegment CRUD | Feature | models/crm.py, api/v1/crm.py, alembic/v1539 |
| M4 Batch streaming export | Feature | api/v1/crm.py |
| M2 route path fix + import fix | Bug fix | api/v1/crm.py |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1539_crm_segments_and_group_code.py` | Alembic migration: code on customer_groups, crm_segments + crm_segment_memberships tables |

---

## 4. Files Modified

| File | Changes |
|---|---|
| `backend/app/models/crm.py` | Added code to CustomerGroup; added CrmSegment + CrmSegmentMembership ORM models; fixed assigned_at=DateTime(timezone=True) |
| `backend/app/api/v1/crm.py` | Replaced M1 tag-only section with M3 CRUD; H2 PATCH route; M4 batch export; CustomerGroup import; M2 route rename + selectinload fix |

---

## 5. Architecture Decisions

### 5.1 CrmSegment Table vs Pure Tag Approach
Tags on Customer.tags[] are unmanaged. CrmSegment provides audit trail, member counts, and rule_definition JSONB for future rule evaluation. Backward compatibility: GET /crm/segments falls back to tag-derived pseudo-segments when table is empty.

### 5.2 BaseEntity Inheritance
CrmSegment and CrmSegmentMembership extend BaseEntity (13 columns: id, uuid, company_id, branch_id, created_at, modified_at, created_by, updated_by, is_active, is_deleted, deleted_at, deleted_by, version). Migration must include all — missing ones (uuid, deleted_at, deleted_by, version, is_active) added via ALTER TABLE and back-ported.

### 5.3 Route Ordering Fix
FastAPI resolves in registration order. `/customers/export` after `/customers/{customer_id}` causes param shadowing. Fix: move to `/crm/export/customers` prefix.

### 5.4 M4 Streaming Export
Async generator yields CSV chunks via StreamingResponse. Offset/limit pagination (100-2000 rows/batch). Compatible with Nginx reverse-proxy buffering.

---

## 6. Design Rationale

| Decision | Rationale |
|---|---|
| segment_type enum (TAG_BASED/RULE_BASED/MANUAL) | Supports rule-engine evolution without schema change |
| member_count denormalised on CrmSegment | Avoids COUNT on every list request |
| uq_crm_segment_customer unique constraint | Idempotent membership add (returns already_member) |
| assigned_at = DateTime(timezone=True) | asyncpg requires column+value timezone agreement |
| /crm/export/customers path | Permanently avoids static-vs-param FastAPI ordering issue |

---

## 7. Implementation Summary

### H2 — CustomerGroup Short Code
- `CustomerGroup.code = Column(String(30), nullable=True)`
- Migration: `op.add_column("customer_groups", ...)` + `ix_customer_groups_code` index
- Endpoint: `PATCH /crm/customer-groups/{group_id}/code` (MANAGER/SYSADMIN)

### M3 — CrmSegment CRUD (5 endpoints)
- `GET /crm/segments` — list (DB first, tag fallback)
- `POST /crm/segments` — create (MANAGER/SYSADMIN)
- `GET /crm/segments/{id}` — detail with live member_count
- `POST /crm/segments/{id}/members` — idempotent add
- `GET /crm/customers/{id}/segments` — merged DB + tag memberships

### M4 — Batch Streaming Export
- `GET /crm/export/customers/batch?batch_size=500&status=Active`
- 16-field CSV: code, name, mobile, email, gst_number, customer_type, environment, status, outstanding, group_code, group_name, credit_limit, credit_days, payment_category, payment_term, tags

### M2 — Route Fix
- Renamed to `/crm/export/customers` and `/crm/export/customers/batch`
- Added `from sqlalchemy.orm import selectinload` inside function body

---

## 8. Tests Executed

```
Command: PowerShell 16-endpoint smoke suite vs http://localhost:1981/api/v1/crm
Tenant:  smriti001 (COMP-001, ~3 customers, 42 loyalty members)

SETUP: H2=CG-CORP | SEG=seg-f5c188befd50 | MEMBER=added
  PASS  [C1]  loyalty       -> enrolled=False pts=0
  PASS  [C2]  credit        -> credit_limit=100000.0
  PASS  [C4]  summary       -> credit_limit=100000.0
  PASS  [H7a] search Active -> array[3]
  PASS  [H7b] list Active   -> array[5]
  PASS  [C5]  price-groups  -> array[3]
  PASS  [M3a] GET /segments -> array[5]
  PASS  [M3b] /segments/{id}-> member_count=1
  PASS  [M3c] cust segments -> seg_count=3
  PASS  [M3d] member add    -> added
  PASS  [H2]  group code    -> updated
  PASS  [M2]  export JSON   -> total=3 data[3]
  PASS  [M4]  export batch  -> streaming CSV header confirmed
  PASS  [H4]  tiers         -> array[2]
  PASS  [H4b] Silver=42     -> Silver mc=42
  PASS  [H1]  customers?100 -> array[100]
FINAL: 16/16 PASS
```

---

## 9. Verification Results

| Check | Status | Evidence |
|---|---|---|
| Migration v1539 applied | Done | INFO Running upgrade v1538 -> v1539 |
| customer_groups.code column + index | Done | psql \d customer_groups |
| crm_segments table (19 cols) | Done | information_schema.columns count |
| crm_segment_memberships (20 cols) | Done | information_schema.columns count |
| BaseEntity column parity (both tables) | Done | PowerShell audit: OK — all BaseEntity columns present |
| 16/16 smoke tests | Done | Literal terminal output above |
| mounted_routes=1650 | Done | GET http://localhost:1981/ response |

---

## 10. Known Limitations

- rule_definition JSONB stored but not evaluated — rule-based auto-assignment is future work
- member_count not decremented on membership soft-delete (no DELETE endpoint)
- Offset pagination degrades at >50 000 rows — keyset pagination recommended at scale
- No bulk member import endpoint

---

## 11. Future Work

| Priority | Item |
|---|---|
| HIGH | Rule evaluation engine for RULE_BASED segments |
| HIGH | DELETE membership endpoint with member_count decrement |
| MEDIUM | Cursor/keyset pagination for batch export |
| MEDIUM | Nightly segment refresh job |
| LOW | Segment analytics (overlap, growth) |
| LOW | Bulk member import via CSV upload |

---

## 12. Related ADRs

- ADR-012: FastAPI route ordering — static before parameterised
- ADR-007: BaseEntity column contract

---

## 13. Related RFCs

- RFC-CRM-003: Customer Segmentation Architecture
- RFC-CRM-004: Batch Export Strategy
