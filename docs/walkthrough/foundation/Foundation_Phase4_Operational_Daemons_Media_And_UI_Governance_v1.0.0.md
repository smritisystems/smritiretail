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
  Classification: Canonical Walkthrough (WGP)
-->

# Walkthrough: SMRITI Retail OS — Phase 4 Operational Daemons, Media Processing & UI Governance

**Walkthrough ID:** `WGP-FOUNDATION-P4-v1.0.0`  
**Area:** Foundation, Daemons, Outbox Engine, SPIF Media & Workforce Master Governance  
**Status:** Completed  

---

## 1. Purpose
This walkthrough documents the technical implementation and verification of Phase 4 operational configuration remediations derived from the Master Forensic Audit Report. It covers the parameterization of the Outbox Queue Worker background daemon via `SystemParameterService`, configurable SPIF image resizing and quality compression, workforce master lookup integration for department and designation inputs, and formal tombstoning of retired Express feature flags.

---

## 2. Scope
- Parameterization of `OutboxQueueWorker` limits (`batch_size`, `max_retries`, `backoff_seconds`, `claim_timeout_seconds`, `poll_interval_seconds`) using `SystemParameterService`.
- Parameterization of `SpifService.process_and_save_base64_image` with caller-configurable `max_dimension` and `quality`.
- Server-authoritative resolution of `SMRITI.HR.PHOTO_MAX_DIM_PX` and `SMRITI.HR.PHOTO_QUALITY_RATIO` in `backend/app/api/v1/staff.py`.
- Integration of `DEFAULT_PHOTO_MAX_DIM` and `DEFAULT_PHOTO_QUALITY` with native `<datalist>` master options for Department and Designation in `src/components/staff/StaffMasterWs.tsx`.
- Architectural tombstoning of dead Express cutover flags in `src/config/flags.ts` (FND-034).

---

## 3. Files Created
1. `docs/implementation/foundation/Foundation_Phase4_Operational_Daemons_Media_And_UI_Governance_Plan_v1.0.0.md`
2. `backend/app/tests/test_phase4_operational_daemons_and_media.py`
3. `docs/walkthrough/foundation/Foundation_Phase4_Operational_Daemons_Media_And_UI_Governance_v1.0.0.md`

---

## 4. Files Modified
1. `backend/app/services/outbox_worker.py`: Added dynamic parameter resolution via `SystemParameterService`.
2. `backend/app/services/spif.py`: Enabled configurable `max_dimension` and `quality` parameters.
3. `backend/app/api/v1/staff.py`: Resolved photo dimension and quality parameters before calling `SpifService`.
4. `src/components/staff/StaffMasterWs.tsx`: Added master lookup datalists and parameterized canvas dimensions.
5. `src/config/flags.ts`: Documented permanent retirement and tombstoning of Express flags.
6. `docs/implementation/README.md`: Registered Phase 4 plan.
7. `docs/walkthrough/README.md`: Registered Phase 4 walkthrough.
8. `CHANGELOG.md`: Logged release `[6.70.42]`.

---

## 5. Architecture Decisions
- **Daemon Parameter Fallback Hierarchy**: In transactional daemons, parameter resolution failures or missing records never halt processing; they cleanly fall back to class-level invariants (`DEFAULT_BATCH_SIZE = 50`, `MAX_RETRIES = 5`, `DEFAULT_BACKOFF_SECONDS = 2`, `DEFAULT_CLAIM_TIMEOUT_SECONDS = 60`, `DEFAULT_POLL_INTERVAL_SECONDS = 5.0`).
- **Caller Override Precedence**: If an administrative script or custom test invokes `process_company_outbox_batch` with explicit non-None arguments, caller parameters override system-level database defaults.
- **Datalist-Based Master Suggestions**: In `StaffMasterWs.tsx`, using HTML5 `<datalist>` rather than rigid `<select>` provides canonical auto-suggestions while preserving backward compatibility with legacy custom job titles.

---

## 6. Design Rationale
- Embedding operational parameters directly in Python code required rebuilding and redeploying backend containers whenever a high-throughput retail store experienced dead-letter timeouts or required higher queue concurrency. Connecting the Outbox worker to `SystemParameterService` enables runtime tuning per tenant or platform-wide.
- Free-form text fields for "Department" and "Designation" previously led to duplicate entries like "Sales", "sales", "Sales Dept", degrading organizational reporting. Pre-populating canonical values standardizes data entry.

---

## 7. Implementation Summary
- **Outbox Worker**: Implemented `resolve_operational_parameters(session, company_id)` querying `SMRITI.OUTBOX.BATCH_SIZE`, `SMRITI.OUTBOX.MAX_RETRIES`, `SMRITI.OUTBOX.BACKOFF_SECONDS`, `SMRITI.OUTBOX.CLAIM_TIMEOUT_SECONDS`, and `SMRITI.OUTBOX.POLL_INTERVAL_SECONDS`. Updated `process_company_outbox_batch`, `process_tenant_database`, `run_worker_cycle`, and `run_daemon_loop`.
- **SPIF Service**: Updated `process_and_save_base64_image(base64_data, max_dimension=1024, quality=80)`.
- **Staff Photo Endpoint**: Extracted `SMRITI.HR.PHOTO_MAX_DIM_PX` and `SMRITI.HR.PHOTO_QUALITY_RATIO` from tenant configuration.
- **Frontend Master UI**: Added `STANDARD_STAFF_DEPARTMENTS` and `STANDARD_STAFF_DESIGNATIONS` autocomplete datalists to `StaffMasterWs.tsx`.

---

## 8. Tests Executed
1. `pytest backend/app/tests/test_phase4_operational_daemons_and_media.py`: 6/6 tests green (100% pass rate).
2. Regression suite (Phase 0, 1, 2, 3, 4): 51/51 tests green in 74.68s.
3. Vitest (`salesAuditAndFormatters.test.ts`, `pricingDiscountEngine.test.ts`): 27/27 tests green in 509ms.
4. TypeScript (`npx tsc --noEmit`): Clean compilation, code 0, zero errors.

---

## 9. Verification Results
- All unit, integration, and regression suites passed with 0 failures and 0 errors.
- Outbox Queue Worker correctly yields configured batch sizes and retry counts.
- Image uploads respect bounded dimensions and WebP compression quality.
- TypeScript compiler verified all UI typings without error.

---

## 10. Known Limitations
- The Outbox worker queries system parameters per batch session; in ultra-high concurrency environments, caching resolved parameters with a 60-second TTL can further reduce query overhead if needed.

---

## 11. Future Work
- Phase 5: UI Metadata, Screen Control Plane & Launchpad Catalog integration with `screen_definitions` and `smriti_menus` (FND-060).

---

## 12. Related ADRs
- `ADR-042`: Canonical System Parameter Dot-Notation Architecture.
- `ADR-045`: Complete Retirement and Decommissioning of Express Framework.

---

## 13. Related RFCs
- `RFC-024`: Transactional Postgres Outbox Dispatch & Dead-Letter Queue Architecture.
- `RFC-031`: SPIF High-Performance WebP Image Optimization Pipeline.
