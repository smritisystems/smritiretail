<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.2
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Deprecation Review: SMRITI Development Intelligence Center (SDIC)

## 1. Executive Summary

This document presents a formal deprecation review for the **SMRITI Development Intelligence Center (SDIC)**. Introduced in `v3.5.0` as an automated system health and metric reporting module, SDIC has been audited against the **SMRITI Governance Rules (AGENTS.md)** and the **AI Agent Output Verification Framework (AOVF v1.0)**. 

The audit reveals that SDIC's metric calculation engine contradicts SMRITI's core governance principle of **verifiable evidence** by displaying self-reported, unverified, and static/phantom scores (e.g., hardcoded security or completeness percentages with no dynamic testing or linting base). To restore full compliance with governance gates, this review recommends the formal deprecation, decommissioning, and eventual purging of all SDIC components.

---

## 2. Governance Violations & Architecture Conflict

Under **AOVF v1.0 Section A3 (Self-reported metrics with no underlying data)** and **SMRITI Governance Rules 4 & 7**, all quantitative assertions must be derived from directly executable commands. SDIC violates these mandates in the following ways:

* **Phantom Metrics (AOVF §A3):** SDIC's dashboard displays a `Development Health Index (DHI)`, `Security Score`, and `Release Score` based on regex searches for `TODO` or `FIXME` and file count heuristics rather than dynamic test suite outputs or certified static analysis tools.
* **Stale Reports:** The generated status files in `docs/reports/` represent snapshots that go out of sync with active codebase upgrades, leading to false indicators of completeness or gaps.
* **Violation of Rule 7 (Four-state system):** SDIC utilizes arbitrary scoring percentages (e.g., `87%` or `100%`) instead of SMRITI's required objective states: `Done`, `Failed`, `Partially Verified`, and `Unverified`.

---

## 3. Codebase Footprint (Affected Files)

The SDIC footprint spans both the frontend React client, the legacy Express routing layer, and the FastAPI backend core:

### A. Python Backend (FastAPI Core)
* [dev_tracker/scanner.py](file:///f:/SMRITRretailNXmgrt/backend/app/dev_tracker/scanner.py) — Gathers git metadata and performs regex file scans.
* [dev_tracker/reports.py](file:///f:/SMRITRretailNXmgrt/backend/app/dev_tracker/reports.py) — Writes reports into `docs/reports/` and updates `history.json`.
* [api/v1/dev_tracker.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/dev_tracker.py) — Defines routes for `/api/v1/dev-tracker` and `/api/v1/dev-tracker/scan`.
* [tests/test_main.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_main.py#L60-L68) — Contains the unit test `test_dev_tracker_api`.

### B. Node/React Frontend (Legacy & Build Layers)
* `src/modules/dev_tracker/` — Contains frontend scanner controllers, interfaces, routing, and UI panels.
* [server.ts](file:///f:/SMRITRretailNXmgrt/server.ts) — Performs Express routing configuration and startup scan triggers.
* [src/layout_engine/layout_store.tsx](file:///f:/SMRITRretailNXmgrt/src/layout_engine/layout_store.tsx) — Registers the `dev-tracker` tab layout.
* [src/App.tsx](file:///f:/SMRITRretailNXmgrt/src/App.tsx) — Handles client-side tab switching routing.

---

## 4. Decommissioning & Retirement Plan

To ensure a clean deprecation that prevents breaking changes while removing the unverified status pages, the retirement is structured into three phases:

### Phase 1: Soft Deprecation (Immediate)
* Mark FastAPI endpoints in `backend/app/api/v1/dev_tracker.py` as deprecated.
* Add an HTTP header warning (`Warning: 299 - "SMRITI SDIC is deprecated and will be removed in v4.0"`).
* Update `docs/walkthrough/README.md` and `docs/implementation/README.md` to classify SDIC as **Deprecated**.

### Phase 2: Decommissioning (Next Release Cycle - v3.33.0)
* Disable UI access by removing the `dev-tracker` tab registration from `src/layout_engine/layout_store.tsx`.
* Stop executing the automatic startup scans in `server.ts` and `backend/entrypoint.sh` to reclaim boot performance.
* Re-route UI navigation away from `/dev-tracker` or return a friendly "Subsystem Decommissioned" view.

### Phase 3: Purging (v4.0.0 Release Target)
* Delete all directories:
  * `backend/app/dev_tracker/`
  * `backend/app/api/v1/dev_tracker.py`
  * `src/modules/dev_tracker/`
* Remove unit test assertions from `backend/app/tests/test_main.py`.
* Delete historical report folders (`docs/reports/*`).

---

## 5. Summary Recommendation

SDIC should be retired immediately from active development metrics. Rather than self-reporting quality indices, quality gates should be enforced solely through local linters (`ruff`, `eslint`), standard test frameworks (`pytest`, `vitest`), and strict manual verification ledgers.
