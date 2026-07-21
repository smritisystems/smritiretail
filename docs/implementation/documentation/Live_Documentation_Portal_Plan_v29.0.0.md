<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 29.0.0
  Created      : 2026-07-22
  Modified     : 2026-07-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan Standard (IPGP)
-->

# Phase 35: Live Documentation Portal & Knowledge Engine (v29.0.0) — Implementation Plan

## 1. Objective
Deliver the **SMRITI Live Documentation Portal & Knowledge Engine (`v29.0.0`)** as a core portal in the SMRITI Digital Platform (`DPF-001`). This phase provides a versioned, searchable technical documentation portal including User Manuals, Administrator Guides, Developer References, Governance Standards, Interactive OpenAPI Sandbox, and Chronological Release Notes.

## 2. Business Motivation
Following the launch of the Official Product Website (`v28.0.0`), prospects, customers, developers, and partners require a single authoritative destination to learn how to operate, configure, integrate, and extend SMRITI Retail OS without manual support requests.

## 3. Scope
- **Versioned Documentation Reader Engine (`docs_engine.py`):** Articles covering User Manuals, Admin Guides, Developer References, and Governance Standards (`PAR-001`, `CMP-001`, `SIP-001`, `DPF-001`, `GCR-001`, `AOP-001`).
- **Interactive OpenAPI Reference Engine (`api_reference.py`):** Interactive endpoint schema reader and request/response parameter explorer.
- **Release Notes & Changelog Engine (`release_notes_engine.py`):** Version timeline from `v1.0.0` through `v29.0.0`.
- **Search Integration:** Powered by `GlobalUnifiedSearchEngine` (`v27.0.0`).
- **Frontend Live Docs Application (`SmritiLiveDocsPortal.tsx`):** Sidebar article tree, markdown renderer, instant search bar, and release timeline component.

## 4. Current State
- `v28.0.0` establishes the Official Product Website with links to `/docs`.
- `v27.0.0` provides `GlobalUnifiedSearchEngine` indexing documentation content.
- Need dedicated backend documentation services and frontend UI.

## 5. Gap Analysis
- Need backend documentation services under `backend/app/core/documentation/`: `docs_engine.py`, `api_reference.py`, `release_notes_engine.py`.
- Need REST API router `backend/app/api/v1/documentation/docs.py`.
- Need React components in `src/components/documentation/`.

## 6. Architecture Impact
- Reuses `GlobalUnifiedSearchEngine` (`v27.0.0`) for instant search.
- Reuses `PortalRegistry` metadata for portal topology.
- Zero changes to platform foundation layers (Layers 1-7 remain 100% untouched).

## 7. Proposed Design
```text
                       Live Documentation Portal (v29.0.0)
                                        │
    ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
    ▼                   ▼                               ▼                   ▼
Documentation Reader  OpenAPI Reference Sandbox  Release Notes Timeline  Global Search Engine
(User/Admin/Dev/Gov)  (Endpoint Explorer)       (v1.0.0 .. v29.0.0)     (Instant Search)
```

## 8. Files Created
- `backend/app/core/documentation/docs_engine.py`
- `backend/app/core/documentation/api_reference.py`
- `backend/app/core/documentation/release_notes_engine.py`
- `backend/app/schemas/documentation.py`
- `backend/app/api/v1/documentation/docs.py`
- `src/components/documentation/SmritiLiveDocsPortal.tsx`
- `src/components/documentation/ArticleViewer.tsx`
- `src/components/documentation/ApiReferenceSandbox.tsx`
- `src/components/documentation/ReleaseNotesTimeline.tsx`
- `backend/app/tests/test_documentation_engine.py`
- `docs/implementation/documentation/Live_Documentation_Portal_Plan_v29.0.0.md`
- `docs/walkthrough/documentation/Live_Documentation_Portal_v29.0.0.md`

## 9. Files Modified
- `backend/app/core/release_manifest.py`
- `backend/app/core/master_health.py`
- `backend/app/tests/test_master_release.py`
- `backend/app/main.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `DPF-001 Digital Platform Framework`
- `GlobalUnifiedSearchEngine` (`v27.0.0`)
- `PortalRegistry` (`v27.0.0`)
- `FastAPI + Pydantic`
- `React + Lucide Icons`

## 11. Risks
- *Risk:* Document index size causing slow search.
- *Mitigation:* In-memory indexing using `GlobalUnifiedSearchEngine` (<50ms response).

## 12. Rollback Strategy
Revert Phase 35 `git` commit without impacting transactional Retail OS or Product Website.

## 13. Verification Plan
- Pytest suite `test_documentation_engine.py` (Article retrieval, API spec inspection, Release notes timeline).
- Full backend Pytest execution.
- `npx tsc --noEmit` check.

## 14. Test Plan
- `test_docs_engine_articles()`: Validates User Manual, Admin Guide, Dev Guide, and Governance document retrieval.
- `test_api_reference_spec()`: Validates OpenAPI spec metadata.
- `test_release_notes_timeline()`: Validates release history from `v1.0.0` through `v29.0.0`.

## 15. Documentation Impact
- Create Walkthrough `docs/walkthrough/documentation/Live_Documentation_Portal_v29.0.0.md`.
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
Deploy REST router under `/api/v1/docs` and mount `SmritiLiveDocsPortal.tsx` at `/docs`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `PAR-001 Master Platform Architecture Reference`
- `DPF-001 Digital Platform Framework`

## 19. Related Walkthroughs
- `Official_Product_Website_v28.0.0.md`
