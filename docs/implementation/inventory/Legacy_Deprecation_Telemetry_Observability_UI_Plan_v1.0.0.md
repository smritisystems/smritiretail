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
  Classification: Implementation Plan (Administrative Observability UI for Legacy Deprecation Telemetry)
-->

# Implementation Plan: SMRITI Legacy Deprecation Telemetry Observability UI (Option B Post-Convergence)

**Document ID:** IP-2026-1008-GOV-TELEMETRY-UI  
**Version:** v1.0.0  
**Date:** 2026-10-08  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Enterprise Observability & System Governance  
**Area:** UI/UX, Frontend Workspace, API Gateway Observability, Option B Governance  
**Architecture:** Option B — Administrative Observability & Telemetry UI Workspace  

---

## 1. Objective
Deliver an enterprise-grade, high-density Administrative Observability UI workspace and embeddable dashboard (`LegacyDeprecationTelemetryTab.tsx`) within SMRITI Retail OS. This interface visualizes real-time and historical telemetry captured by the Phase 5 `LegacyProductTelemetrySink`, exposing key performance indicators, route distribution metrics, runtime fallback origins, and an interactive event audit log to system operators and store administrators tracking the 2028 legacy endpoint sunset timeline.

---

## 2. Business Motivation
Following the completion of Option B (Dual-Key Transitional Architecture, Phases 1–5), legacy endpoints (`/api/v1/products`, `/api/v1/inventory/products`, `/api/v1/variants`) and runtime fallback code paths emit RFC 8594 headers and append structured telemetry events. Without an administrative user interface, monitoring client migration progress requires direct server file inspection (`logs/legacy_deprecation_telemetry.jsonl`) or manual curl invocation of `GET /api/v1/governance/legacy-telemetry/summary`. A native, reactive governance workspace empowers store managers, IT operations, and system administrators to:
1. Identify external third-party software (POS handhelds, partner EDI, custom spreadsheets) still invoking deprecated routes.
2. Monitor runtime fallback invocation rates across financial reports and data bridge export pipelines.
3. Quantify progress toward the January 1, 2028 RFC 8594 Sunset date.

---

## 3. Scope
- **Backend API Expansion**:
  - Expose `GET /api/v1/governance/legacy-telemetry/events` with pagination, filtering by event type, company ID, and durable disk reading.
  - Expand access role checks to include `MANAGER` alongside `ADMIN` and `SYSADMIN` for read-only telemetry observation.
- **Frontend Observability Workspace**:
  - Implement `src/components/governance/LegacyDeprecationTelemetryTab.tsx` with executive KPI cards, route access distribution breakdown, fallback caller analytics, and an interactive event log table with JSON detail drawer.
  - Support auto-refresh intervals (Off, 10s, 30s, 60s) and manual refresh with spin indicator.
  - Enable one-click export of telemetry logs (JSONL/CSV) and clipboard summary copying.
- **Shell & Navigation Wiring**:
  - Mount tab in `src/components/shell/TabRenderer.tsx` under `"legacy-telemetry"`, `"deprecation-telemetry"`, and `"legacy-deprecation-telemetry"`.
  - Wire dual-view toggle into `src/components/LegacyMigDashTab.tsx` allowing seamless switching between Shoper 9 Menu Migration and API Deprecation Telemetry.
  - Register Launchpad tile in `src/components/launchpad/launchpadCatalog.ts` under "System & Operations".
  - Register route in `src/navigation/breadcrumb/BreadcrumbRegistry.ts`.
- **SSOT Version Alignment**:
  - Bump system version from `6.70.22` to `6.70.23` across all 4 SSOT anchors.

---

## 4. Current State
- The backend features `LegacyProductTelemetrySink` (`backend/app/services/legacy_product_telemetry.py`) with thread-safe JSONL disk logging and a 60-second rate-limiting window.
- `GET /api/v1/governance/legacy-telemetry/summary` is operational and returns aggregated counters (`total_events`, `endpoint_access_total`, `fallback_invoked_total`, `by_path`, `by_caller`, `by_reason`).
- No user-facing frontend screen currently visualizes this data.

---

## 5. Gap Analysis
| Capability | Current State | Target State |
|---|---|---|
| Summary Metrics API | Exists (`/summary`) | Preserved and enriched with event detail API (`/events`) |
| Granular Event API | Backend sink has `get_events()`, no HTTP route | `GET /api/v1/governance/legacy-telemetry/events` implemented |
| User Interface | None | Dedicated executive observability dashboard with KPI cards & live audit stream |
| Launchpad Integration | Missing | Accessible via Launchpad tile under "System & Operations" |
| Migration Dash Synergy | Shoper 9 menu only | Integrated sub-view in `LegacyMigDashTab.tsx` |

---

## 6. Architecture Impact
- **Zero Schema Mutation**: Strictly zero database migrations, DDL changes, or data modifications.
- **Client Protocol**: Uses canonical `src/lib/apiFetchV1.ts` for all HTTP communication (`/api/v1/governance/legacy-telemetry/*`).
- **Aesthetic Conformance**: High-density executive layout using SMRITI theme tokens, Lucide icons, responsive flex/grid layouts, micro-animations, and full WCAG accessibility (`aria-label`, `role="region"`).

---

## 7. Proposed Design
### 7.1 Backend Route Specification
```python
@router.get("/legacy-telemetry/events")
async def get_legacy_telemetry_events(
    limit: int = Query(default=100, ge=1, le=1000),
    company_id: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    from_disk: bool = Query(default=False),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user = Depends(get_current_user),
):
    ...
```

### 7.2 UI Workspace Architecture
1. **Header Toolbar**: Title, Sunset Countdown Badge (`Sunset: 2028-01-01 GMT`), Auto-Refresh selector (Off, 10s, 30s, 60s), Manual Refresh, and Export buttons.
2. **Executive KPI Cards**:
   - Total Telemetry Events
   - Legacy Route Hits (`LEGACY_ENDPOINT_ACCESSED`)
   - Internal Runtime Fallbacks (`LEGACY_FALLBACK_INVOKED`)
   - Active Companies Monitored
   - Gateway RFC 8594 Soft-Deprecation Compliance Status (100% Active)
3. **Distribution Analytics Section**:
   - Frequency by Request Path (Progress meters and counts)
   - Frequency by Fallback Caller (`ReportsService`, `DataBridgeExportEngine`, etc.)
   - Frequency by Fallback Reason (`VARIANT_ID_NULL`, etc.)
4. **Live Event Stream & Forensic Inspector**:
   - Searchable, filterable event table (Event Type, Method/Path, Caller, IP, Timestamp).
   - Click to inspect full JSON payload in a slide-out modal or inline viewer.

---

## 8. Files Created
1. `src/components/governance/LegacyDeprecationTelemetryTab.tsx` — Full-featured administrative observability dashboard.
2. `src/tests/legacyDeprecationTelemetryUI.test.ts` — Frontend Vitest suite validating dashboard rendering and state logic.
3. `docs/implementation/inventory/Legacy_Deprecation_Telemetry_Observability_UI_Plan_v1.0.0.md` — This implementation plan.
4. `docs/walkthrough/inventory/Legacy_Deprecation_Telemetry_Observability_UI_v1.0.0.md` — 13-section walkthrough.

---

## 9. Files Modified
1. `backend/app/api/v1/governance.py` — Added `/legacy-telemetry/events` route and expanded role check to include `MANAGER`.
2. `src/components/shell/TabRenderer.tsx` — Mounted `"legacy-telemetry"` cases.
3. `src/components/LegacyMigDashTab.tsx` — Added sub-navigation tab to switch between Menu Migration and Telemetry Observability.
4. `src/components/launchpad/launchpadCatalog.ts` — Added Launchpad tile for Legacy Telemetry Observability.
5. `src/navigation/breadcrumb/BreadcrumbRegistry.ts` — Registered breadcrumb mapping.
6. `backend/app/core/config.py` — Version bumped to `6.70.23`.
7. `package.json` — Version bumped to `6.70.23`.
8. `src/config/version.ts` — Version bumped to `6.70.23`.
9. `CHANGELOG.md` — Release notes for `v6.70.23`.
10. `docs/implementation/README.md` — Master index update.
11. `docs/walkthrough/README.md` — Master index update.

---

## 10. Dependencies
- Starlette / FastAPI backend ASGI middleware.
- Lucide React icon suite.
- React 18, TypeScript, Vite.

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Disk I/O saturation on high event volume | Low | Rate-limiting (60s window per key) already in sink; default event queries read from memory |
| Unauthorized access to system telemetry | Low | Guarded by `_require_admin_or_manager` requiring valid JWT with `SYSADMIN`, `ADMIN`, or `MANAGER` role |
| Client rendering lag with thousands of events | Low | Capped at 1,000 events max with pagination and virtualized/limited table rendering |

---

## 12. Rollback Strategy
Remove the frontend component and revert `backend/app/api/v1/governance.py` via `git revert`. Zero database state rollback required.

---

## 13. Verification Plan
1. Backend pytest execution of governance telemetry endpoints.
2. Frontend Vitest unit test suite execution (`src/tests/legacyDeprecationTelemetryUI.test.ts`).
3. TypeScript compiler static analysis check: `npx tsc --noEmit`.
4. Architecture duplication gate check: `python scripts/architecture_duplication_gate.py`.
5. UX Field Governance guard check: `python scripts/ci_ux_field_governance_guard.py`.

---

## 14. Test Plan
- `test_tc_p5_010`: Verify `GET /api/v1/governance/legacy-telemetry/events` returns list of events with correct schema.
- `test_tc_p5_011`: Verify manager role access authorization on telemetry routes.
- Frontend test suite verifying component mounts, KPI display, and table filtering.

---

## 15. Documentation Impact
- Append entry to `docs/implementation/README.md`.
- Generate 13-section walkthrough in `docs/walkthrough/inventory/`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Update backend governance routes.
2. Build frontend React components and navigation wiring.
3. Run test suites and static analysis.
4. Commit and push to `origin/smritiNX`.
5. Sync test environment via `git pull`.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0043`: Dual-Key Transitional Strategy (Option B).
- `ADR-0049`: RFC 8594 Legacy API Deprecation Gateway & Telemetry Standard.

---

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_v1.0.0.md`
- `docs/walkthrough/inventory/Legacy_Deprecation_Telemetry_Observability_UI_v1.0.0.md`
