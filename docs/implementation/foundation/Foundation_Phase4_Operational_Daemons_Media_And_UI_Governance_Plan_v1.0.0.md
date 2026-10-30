<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Implementation Plan (IPGP)
-->

# Implementation Plan: SMRITI Retail OS — Phase 4 Operational Daemons, Media Processing & UI Governance

**Plan ID:** `IPGP-FOUNDATION-P4-v1.0.0`  
**Area:** Foundation, Daemons, Outbox Engine, SPIF Media & Workforce Master Governance  
**Status:** Completed  

---

## 1. Objective
Systematically remediate Priority 1 and Priority 2 operational configuration hardcoding findings (FND-024, FND-025, FND-026, FND-027, FND-017, FND-019, FND-034, and FND-P1-06) identified during the Master Forensic Audit. Parameterize Outbox Queue Worker batch operations and retry policies via `SystemParameterService`, parameterize SPIF image optimization boundaries and compression quality, enrich Staff Department and Designation inputs with Master Registry lookups, and officially retire legacy Express cutover flags.

---

## 2. Business Motivation
High-throughput enterprise retail deployments require operational flexibility to tune queue batch sizes, exponential backoff delays, and claim timeouts without rebuilding Docker images or redeploying code. Similarly, badge card printing systems require variable image resolution policies (e.g. 1024px high-resolution vs 300px low-bandwidth), while workforce personnel records must align with authoritative master directories to eliminate typographical inconsistencies in department and designation assignments.

---

## 3. Scope
- **Cluster A: Outbox Worker & Background Daemon Parameterization (FND-024, FND-025, FND-026, FND-027 / FND-P1-02)**:
  - Connect `backend/app/services/outbox_worker.py` to `SystemParameterService`.
  - Dynamically resolve:
    - `SMRITI.OUTBOX.BATCH_SIZE` (default 50)
    - `SMRITI.OUTBOX.MAX_RETRIES` (default 5)
    - `SMRITI.OUTBOX.BACKOFF_SECONDS` (default 2)
    - `SMRITI.OUTBOX.CLAIM_TIMEOUT_SECONDS` (default 60)
    - `SMRITI.OUTBOX.POLL_INTERVAL_SECONDS` (default 5.0)
- **Cluster B: SPIF & Media Processing Operational Parameters (FND-P1-06, FND-017)**:
  - In `backend/app/services/spif.py`, parameterize `process_and_save_base64_image` with caller-configurable `max_dimension` and `quality`.
  - In `backend/app/api/v1/staff.py`, resolve `SMRITI.HR.PHOTO_MAX_DIM_PX` and `SMRITI.HR.PHOTO_QUALITY_RATIO` via `SystemParameterService` with resilient defaults.
  - In `src/components/staff/StaffMasterWs.tsx`, parameterize canvas dimensions and compression ratio.
- **Cluster C: Staff Master Department & Designation Master Integration (FND-019 / FND-P1-04)**:
  - In `src/components/staff/StaffMasterWs.tsx`, provide master lookup datalist/autocomplete backed by `/api/v1/masters/lookup/department` and `/api/v1/masters/lookup/designation` or presets, preventing unstructured typo drift.
- **Cluster D: Feature Flags Retirement (FND-034)**:
  - In `src/config/flags.ts`, document and confirm permanent retirement of legacy Express cutover flags with zero remaining consumers.

---

## 4. Current State
- `backend/app/services/outbox_worker.py` hardcodes `MAX_RETRIES = 5`, `DEFAULT_BATCH_SIZE = 50`, `DEFAULT_BACKOFF_SECONDS = 2`, `DEFAULT_CLAIM_TIMEOUT_SECONDS = 60`, and `poll_interval_seconds = 5.0`.
- `backend/app/services/spif.py` hardcodes `max_size = (1024, 1024)` and `quality=80`.
- `src/components/staff/StaffMasterWs.tsx` hardcodes `MAX_DIM = 500` and `0.85` canvas quality, and uses unstructured text inputs for Department and Designation.
- `src/config/flags.ts` retains obsolete Express transition flags.

---

## 5. Gap Analysis
- **Operational Inflexibility**: Changes to outbox retry limits or batch thresholds require Python codebase edits.
- **Image Pipeline Rigidity**: Badge card generation cannot request higher quality images without modifying `spif.py`.
- **Master Data Fragmentation**: Free-text staff department and designation inputs cause dirty master records and prevent accurate HR reporting.
- **Dead Code Ambiguity**: Unused cutover flags in `src/config/flags.ts` create uncertainty regarding runtime architecture.

---

## 6. Architecture Impact
- Extends the 4-tier resolution hierarchy of `SystemParameterService` to transactional queue workers and media processors.
- Connects workforce staff profiles directly to Master Registry lookup types.
- Maintains 100% backward compatibility for all existing APIs and workers.

---

## 7. Proposed Design
1. **Dynamic Outbox Parameter Resolver**:
   - In `OutboxQueueWorker`, add `_resolve_operational_parameters(session, company_id)`.
   - Query `SystemParameterService.resolve_parameter` for batch size, retry limit, backoff seconds, claim timeout, and poll interval. Fall back to class-level constants when parameters are undefined in the database.
2. **SPIF Dynamic Scaling & Quality**:
   - Add `max_dimension: int = 1024` and `quality: int = 80` parameters to `SpifService.process_and_save_base64_image()`.
   - In `staff.py`, resolve `SMRITI.HR.PHOTO_MAX_DIM_PX` and `SMRITI.HR.PHOTO_QUALITY_RATIO` via `SystemParameterService` and forward them to SPIF.
3. **Staff Department & Designation Autocomplete**:
   - In `StaffMasterWs.tsx`, load master lookup options for `department` and `designation` using `apiFetchV1` / standard presets, providing HTML5 `<datalist>` or select dropdowns while allowing typed values.
4. **Retired Flag Documentation**:
   - Add tombstone annotations to `src/config/flags.ts`.

---

## 8. Files Created
1. `docs/implementation/foundation/Foundation_Phase4_Operational_Daemons_Media_And_UI_Governance_Plan_v1.0.0.md`
2. `backend/app/tests/test_phase4_operational_daemons_and_media.py`

---

## 9. Files Modified
1. `backend/app/services/outbox_worker.py`
2. `backend/app/services/spif.py`
3. `backend/app/api/v1/staff.py`
4. `src/components/staff/StaffMasterWs.tsx`
5. `src/config/flags.ts`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`

---

## 10. Dependencies
- `SystemParameterService` in `backend/app/services/system_parameter.py`
- `UnifiedOutboxAnalyticsService` in `backend/app/services/outbox_analytics.py`
- Master lookup endpoints `/api/v1/masters/lookup/{type_code}`

---

## 11. Risks
- Risk: Excessive DB queries on each daemon cycle when polling system parameters.
  - Mitigation: Cache resolved parameter objects or query within existing batch session lifecycle.
- Risk: Invalid or non-integer values entered into `system_parameters`.
  - Mitigation: Enforce robust try-catch with fallback to standard defaults.

---

## 12. Rollback Strategy
Revertible via Git rollback (`git checkout`) without database schema migrations.

---

## 13. Verification Plan
- Unit tests verifying OutboxQueueWorker loads parameters from `SystemParameterService`.
- Unit tests verifying SPIF processes custom dimensions and quality ratios.
- Vitest / TypeScript verification for `StaffMasterWs.tsx` and retired `flags.ts`.
- Full regression test execution across Pytest and TypeScript.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase4_operational_daemons_and_media.py`.
- Run Pytest test suite for Phase 1, Phase 2, and Phase 3.
- Run `npx tsc --noEmit`.

---

## 15. Documentation Impact
- Create `docs/walkthrough/foundation/Foundation_Phase4_Operational_Daemons_Media_And_UI_Governance_v1.0.0.md`.
- Update indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Included in next regular SMRITI Retail OS minor release.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-042`: Canonical System Parameter Dot-Notation Architecture.
- `ADR-045`: Complete Retirement and Decommissioning of Express Framework.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Phase4_Operational_Daemons_Media_And_UI_Governance_v1.0.0.md`
