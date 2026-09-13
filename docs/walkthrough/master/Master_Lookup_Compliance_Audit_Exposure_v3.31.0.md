<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.0
  Created      : 2026-09-13
  Modified     : 2026-09-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Master Lookup Compliance Audit Exposure & Operational Visibility Walkthrough

## 1. Purpose
This document details the architecture and implementation for exposing Master Lookup modification and lifecycle audit history through the authoritative regulatory compliance audit search path (`/api/v1/integration/audit/logs` and dedicated master lookup audit endpoints). It connects the tamper-evident SHA-256 audit ledger with the front-end `MasterListScreen` and `MasterLookupDetailDrawer` so store managers and system administrators can operationally verify who created, updated, or retired any master lookup value, with visual field-by-field diffs for code, description, active status, and sort order.

---

## 2. Scope
- **Backend Audit Service Expansion**: Enhanced `ComplianceAuditService.search_audit_logs` to support global company fallback (`[company_id, "GLOBAL"]`), prefix matching on `entity_name` (e.g. `master_lookup`), actor username resolution, and parsed before/after operational state envelopes.
- **Unified Regulatory Search Path**: Enhanced `GET /api/v1/integration/audit/logs` to query the control plane database (`smritisys`) with fallback to tenant-specific databases, enabling both master data and transactional compliance records to be retrieved through the single canonical search route.
- **Direct Master Lookup Audit Endpoints**: Exposed `GET /api/v1/masters/lookup/{type_code}/values/{id}/audit` and `GET /api/v1/masters/lookup/{type_code}/audit` for item-level and type-level compliance querying.
- **Audit State Enrichment**: Updated `create_lookup_value` and `update_lookup_value` in `master_lookup.py` to record `sort_order` and `vendor_code` in both before and after states.
- **Operational UI Detail Drawer**: Created `MasterLookupDetailDrawer.tsx` featuring tabbed views for item properties and a chronological audit trail timeline with SHA-256 validation pills and field-by-field before-and-after diffs.
- **Master Management Integration**: Configured `slots.detailDrawer` in `masterLookup.confi.tsx` and wired both per-row "View Details" drawers and a header "Audit Trail" action in `MasterMgmtTab.tsx`.

---

## 3. Files Created
- [MasterLookupDetailDrawer.tsx](file:///F:/SMRITRretailNX/src/components/global/master/MasterLookupDetailDrawer.tsx): Slide-over drawer component providing item overview and compliance audit history timeline with diffs and SHA-256 validation.
- [test_master_lookup_compliance_audit.py](file:///F:/SMRITRretailNX/backend/tests/test_master_lookup_compliance_audit.py): Automated test suite validating master lookup audit creation, update diff tracking, prefix search, and SHA-256 integrity verification.

---

## 4. Files Modified
- [compliance_audit.py](file:///F:/SMRITRretailNX/backend/app/services/compliance_audit.py): Added `actor_username` resolution, `GLOBAL` company fallback, and `entity_name` prefix matching in `search_audit_logs`.
- [integration.py](file:///F:/SMRITRretailNX/backend/app/api/v1/integration.py): Updated `/audit/logs` endpoint to query control-plane `get_db` with seamless tenant fallback.
- [master_lookup.py](file:///F:/SMRITRretailNX/backend/app/api/v1/master_lookup.py): Added `sort_order` to create audit payload, and introduced `/lookup/{type_code}/values/{id}/audit` and `/lookup/{type_code}/audit` endpoints.
- [masterLookup.confi.tsx](file:///F:/SMRITRretailNX/src/components/global/configs/masterLookup.confi.tsx): Configured `slots.detailDrawer` to instantiate `MasterLookupDetailDrawer`.
- [MasterMgmtTab.tsx](file:///F:/SMRITRretailNX/src/components/MasterMgmtTab.tsx): Added `detailDrawer` binding and header "Audit Trail" action button.

---

## 5. Architecture Decisions
1. **Multi-Plane Database Awareness**: Because master lookup types, user credentials, and platform schemas reside in `smritisys` while financial transactions reside in tenant databases, the regulatory search path (`/api/v1/integration/audit/logs`) queries `control_db` (`get_db`) first and cascades to tenant databases if needed.
2. **Deterministic Cryptographic Sealing**: All master lookup modifications continue to produce SHA-256 payload hashes computed deterministically as `company_id|event_type|entity_name|entity_id|timestamp_str|action_summary|before_state|after_state`.
3. **Structured Field Diffing**: Rather than displaying raw JSON dumps, `MasterLookupDetailDrawer` parses before-and-after operational envelopes to produce visual red (before) ➔ green (after) diff chips for `code`, `name`, `description`, `active`, and `sort_order`.

---

## 6. Design Rationale
- **Single Source of Truth for Compliance**: Using the existing compliance audit search path (`/integration/audit/logs`) ensures that compliance officers, auditors, and managers share the same audit trail and verification mechanisms.
- **Ergonomic Drawer Workflow**: Leveraging `MasterListScreen`'s built-in `detailDrawer` slot (triggered by the Search icon on each row) ensures a seamless workflow without navigating away from the list screen.

---

## 7. Implementation Summary
- Integrated `ComplianceAuditService.record_audit_event` on all master lookup mutations.
- Enriched `ComplianceAuditService.search_audit_logs` to return parsed `before_state`, `after_state`, and `actor_username`.
- Standardized UI drawer with `motion/react` spring transitions, responsive metadata cards, and copyable SHA-256 badges.
- Recompiled frontend production bundle with `npm run build` and restarted multi-container Docker Compose stack.

---

## 8. Tests Executed
1. **Automated Unit & Integration Tests**:
   - Executed `pytest backend/tests/test_master_lookup_compliance_audit.py`:
     - `1 passed in 8.76s` (100% green).
   - Executed `pytest backend/tests/t_analytics_hub.py -k test_compliance_immutable_audit_log_hash_integrity`:
     - `1 passed in 7.77s` (100% green).
2. **Frontend Type Check & Linter**:
   - Executed `npm run lint` (`tsc --noEmit`):
     - `Exit code 0` (0 errors across entire workspace).
3. **Production Build**:
   - Executed `npm run build`:
     - `✓ built in 26.82s` (all chunks compiled cleanly).
4. **End-to-End Live API Characterization**:
   - Executed create, update, search, and delete lifecycle against live running Docker container:
     - Item created: `DEPT-AUDIT-VERIF-2` (`active: True, sort_order: 5`)
     - Item updated: `active: False, sort_order: 20`
     - Compliance search path count: `2 logs`
     - Verified `actor_username == "manager"` and `actor_role == "MANAGER"`
     - Verified diffs: `sort_order: 5 -> 20`, `active: True -> False`
     - SHA-256 hash verified authentic.

---

## 9. Verification Results
| Check | Requirement | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Backend Service** | `search_audit_logs` returns before/after state & username | **Done** | Unit test `test_master_lookup_compliance_audit.py` passed |
| **Search Path** | `/api/v1/integration/audit/logs` serves lookup history | **Done** | Live HTTP 200 with 2 audit logs |
| **Direct Endpoint** | `/api/v1/masters/lookup/{type}/values/{id}/audit` | **Done** | Live HTTP 200 with 2 audit logs |
| **Frontend UI** | `MasterLookupDetailDrawer` in `MasterListScreen` | **Done** | `npm run lint` 0 errors, `npm run build` green |
| **Docker Stack** | Multi-container stack recompiled & healthy | **Done** | All 4 containers healthy (`smriti-api`, `smriti-web`, `smriti-db`, `smriti-mssql`) |

---

## 10. Known Limitations
- Master Lookup audit history prior to v3.31.0 only exists if mutations occurred after the introduction of `_audit_master_value_change`.

---

## 11. Future Work
- Add batch export of compliance audit logs directly to PDF with statutory watermarks.
- Support multi-field historical timeline comparison for nested JSON schemas.

---

## 12. Related ADRs
- None.

---

## 13. Related RFCs
- None.
