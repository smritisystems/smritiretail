<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough (Administrative Observability UI for Legacy Deprecation Telemetry)
-->

# Walkthrough: SMRITI Legacy Deprecation Telemetry Observability UI (Option B Post-Convergence)

**Document ID:** WGP-2026-1008-GOV-TELEMETRY-UI  
**Version:** v1.0.0  
**Date:** 2026-10-08  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Enterprise Observability & System Governance  
**Area:** UI/UX, Frontend Workspace, API Gateway Observability, Option B Governance  
**Architecture:** Option B — Administrative Observability & Telemetry UI Workspace  

---

## 1. Purpose
This walkthrough documents the design, implementation, and automated verification of the **Administrative Observability UI Workspace** (`LegacyDeprecationTelemetryTab.tsx`) within SMRITI Retail OS. Following the successful completion of Option B (Dual-Key Transitional Architecture, Phases 1–5), this interface surfaces real-time and historical telemetry recorded by `LegacyProductTelemetrySink`, equipping system administrators and store managers with visual metrics, route distribution analytics, and audit logging to monitor client migration progress toward the 2028 legacy endpoint sunset deadline.

---

## 2. Scope
- **Backend API Expansion**: Exposing `GET /api/v1/governance/legacy-telemetry/events` with pagination, filtering, and durable disk querying; updating role checks to allow `MANAGER` role access alongside `SYSADMIN` and `ADMIN`.
- **Frontend Workspace**: Implementing `src/components/governance/LegacyDeprecationTelemetryTab.tsx` with executive KPI cards, route access distribution breakdown, fallback caller analytics, and an interactive event log table with JSON detail drawer.
- **Data Export & Live Polling**: Providing one-click export (JSONL, CSV), summary clipboard copy, and configurable auto-refresh polling (Off, 10s, 30s, 60s).
- **Navigation & Shell Wiring**: Mounting the tab in `TabRenderer.tsx`, adding sub-view toggling in `LegacyMigDashTab.tsx`, adding a Launchpad tile in `launchpadCatalog.ts`, and updating breadcrumb routing.
- **SSOT Version Bump**: Aligning version `6.70.23` across all 4 SSOT anchors.
- **Zero Schema Mutation**: Strict adherence to the Schema Freeze invariant (zero database migrations, zero DDL, zero historical ledger modifications).

---

## 3. Files Created
1. `src/components/governance/LegacyDeprecationTelemetryTab.tsx` — Full-featured administrative observability dashboard.
2. `src/tests/legacyDeprecationTelemetryUI.test.ts` — Frontend Vitest suite validating dashboard rendering, roles, and routing.
3. `.architecture/certificates/PF-2026-1008-B8CAED.json` — Architecture preflight certificate.
4. `docs/implementation/inventory/Legacy_Deprecation_Telemetry_Observability_UI_Plan_v1.0.0.md` — 19-section implementation plan.
5. `docs/walkthrough/inventory/Legacy_Deprecation_Telemetry_Observability_UI_v1.0.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `backend/app/api/v1/governance.py` — Added `/legacy-telemetry/events` route, normalized router prefix, and expanded role check (`_require_admin_or_manager`).
2. `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py` — Added test `test_tc_p5_010`.
3. `src/components/shell/TabRenderer.tsx` — Mounted `"legacy-telemetry"` and aliases in lazy import and switch cases.
4. `src/components/LegacyMigDashTab.tsx` — Added sub-navigation toggle between Menu Migration and Telemetry Observability.
5. `src/components/launchpad/launchpadCatalog.ts` — Registered Launchpad tile for Legacy Telemetry Observability.
6. `src/navigation/breadcrumb/BreadcrumbRegistry.ts` — Registered breadcrumb mapping.
7. `backend/app/core/config.py` — Version bumped to `6.70.23`.
8. `package.json` — Version bumped to `6.70.23`.
9. `src/config/version.ts` — Version bumped to `6.70.23`.
10. `CHANGELOG.md` — Added release notes for `v6.70.23`.
11. `docs/implementation/README.md` — Master index update.
12. `docs/walkthrough/README.md` — Master index update.

---

## 5. Architecture Decisions
1. **Two-Tier Telemetry Querying (Memory vs Disk)**:
   By default, the UI queries the in-memory windowed buffer for sub-millisecond responsiveness. A dedicated toggle switch allows operators to query the durable `.jsonl` disk log when conducting deep forensic audits.
2. **Unified Role Governance (`_require_admin_or_manager`)**:
   Expanded read-only observability access to `MANAGER` users in addition to `SYSADMIN` and `ADMIN`, enabling store operations managers to monitor handheld POS scanners and third-party integrations without granting full administrative privileges.
3. **Dual Access Patterns in UX**:
   Mounted both as an independent top-level tab (`"legacy-telemetry"`) accessible via Fiori Launchpad and as an embedded sub-tab inside `LegacyMigDashTab.tsx`, consolidating legacy modernization under a single conceptual area.

---

## 6. Design Rationale
- **High-Density Glassmorphism Aesthetics**: Built to match SMRITI's modern dark theme (`bg-[#0b0f17]`, `border-white/10`, `font-mono`), maintaining consistency with the core ERP aesthetic.
- **Sunset Countdown**: Features a live countdown indicator toward January 1, 2028 GMT (`Sat, 01 Jan 2028 00:00:00 GMT`), providing visual urgency for API migration.
- **Micro-Animations & Visual Hierarchy**: Gradient progress bars for route frequencies and fallback caller distributions make migration bottlenecks immediately apparent without manual log parsing.

---

## 7. Implementation Summary
- **Backend API**:
  `GET /api/v1/governance/legacy-telemetry/events` invokes `LegacyProductTelemetrySink.get_events(limit=limit, company_id=cid, event_type=event_type, from_disk=from_disk)` returning serialized event payloads.
- **Frontend Workspace**:
  `LegacyDeprecationTelemetryTab.tsx` provides executive KPI cards, route breakdown meters, fallback caller bars, a live event table with auto-refresh and search, export mechanisms (JSONL/CSV), and a full JSON inspection modal.
- **Synergy with Migration Dashboard**:
  `LegacyMigDashTab.tsx` provides a seamless tab bar toggling between "Shoper9 Menu Lineage" and "RFC 8594 API Telemetry", giving users one-stop visibility into legacy sunsetting.

---

## 8. Tests Executed
1. **Backend Pytest (`backend/tests/test_phase5_legacy_deprecation_and_telemetry.py`)**:
   - `test_tc_p5_001` through `test_tc_p5_009`: RFC 8594 headers, rate limiting, and Option B certification.
   - `test_tc_p5_010`: Events endpoint schema, event type filtering, and role authorization.
   - **Result**: 10 passed in 20.75s.
2. **Frontend Vitest (`src/tests/legacyDeprecationTelemetryUI.test.ts`)**:
   - `TC-TEL-001`: Tile registration in `LAUNCHPAD_CATALOG`.
   - `TC-TEL-002`: Role-based tile visibility (`MANAGER` and `SYSADMIN` only).
   - `TC-TEL-003`: `TabRenderer` alias normalization.
   - `TC-TEL-004`: Sunset countdown calculation.
   - `TC-TEL-005`: Summary data schema validation.
   - **Result**: 5 passed in 23.15s.
3. **Static Analysis**: `npx tsc --noEmit` exited code 0 (zero errors).
4. **Architecture Gate**: `python scripts/architecture_duplication_gate.py` passed 11/11 checks (0 violations).
5. **UX Guard**: `python scripts/ci_ux_field_governance_guard.py` passed with 0 critical violations.

---

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (10 backend, 5 frontend)
✓ Documentation Updated (Implementation Plan & Walkthrough)
✓ Wiki Updated (Walkthrough Index)
✓ CHANGELOG Updated (v6.70.23)
✓ Release Notes Updated
✓ Architecture Updated (Certificate PF-2026-1008-B8CAED)
✓ GitHub Published (git ready)
✓ Links Verified

Evidence Level: Level A
```

---

## 10. Known Limitations
- The in-memory buffer stores the most recent 1,000 events before rolling over. For historical analytics spanning multiple months, durable disk logging (`from_disk=true`) or external log shippers (ELK / Loki) must be utilized.

---

## 11. Future Work
- Integration with alert webhooks to notify administrators via WhatsApp or email when legacy route volume spikes.
- Tenant-specific breakdown views allowing multi-store headquarters to identify specific branches that have not updated their POS scanner hardware.

---

## 12. Related ADRs
- `ADR-0043`: Dual-Key Transitional Strategy (Option B).
- `ADR-0049`: RFC 8594 Legacy API Deprecation Gateway & Telemetry Standard.

---

## 13. Related RFCs
- `RFC 8594`: The Sunset and Deprecation HTTP Headers.
- `RFC 8288`: Web Linking (`Link: rel="successor-version"`).
- `RFC 7231`: HTTP/1.1 Semantics and Content (HTTP-date format).
