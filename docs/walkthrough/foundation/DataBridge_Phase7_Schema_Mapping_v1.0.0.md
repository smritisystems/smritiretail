<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Technical Walkthrough
-->

# Walkthrough: SMRITI DataBridge Phase 7 — Automated Schema Mapping Intelligence & Field Detection Engine

**Walkthrough ID:** WGP-DATABRIDGE-PHASE-7-v1.0.0  
**Phase:** Phase 7 — Automated Schema Mapping Intelligence & Field Detection Engine  
**Date:** 2026-10-06  
**Status:** Completed  
**Evidence Level:** Level A (Direct Terminal Execution & 87/87 Regression Tests Green)

---

## 1. Purpose
The purpose of Phase 7 is to provide server-side heuristic, semantic, and content-aware column mapping intelligence for the SMRITI DataBridge. Retailers migrating from disparate legacy accounting and ERP systems (Tally, Busy, Marg, SAP Business One, custom Excel spreadsheets) frequently provide files with irregular, informal, or abbreviated column headers. Phase 7 automates column recognition, calculates confidence scores, detects candidate ambiguities, profiles sample data using statutory Indian GST/PAN/phone regex patterns, and verifies mandatory import requirements before submission.

---

## 2. Scope
- **Multi-Tier Schema Detection Engine (`DataBridgeSchemaMapper`)**:
  - *Tier 1 (Exact & Commercial Alias Match)*: $O(1)$ dictionary resolution against canonical and commercial synonym registers.
  - *Tier 2 (Token Similarity)*: Normalized Levenshtein distance combined with token Jaccard word overlap handling camelCase, snake_case, spaces, and typographical errors.
  - *Tier 3 (Content Profiling)*: Inspects optional sample data rows (1–10 rows) using regex patterns (15-character GSTIN, 10-character PAN, 10-digit Indian mobile, Email, 6-digit Pincode, 8–14 digit Barcode, ISO/Indian dates), elevating match confidence up to 0.98.
  - *Tier 4 (Ambiguity Detection)*: Flags column mappings as `AMBIGUOUS` when competing fields score within 0.06 of each other ($\ge 0.70$).
  - *Tier 5 (Completeness Validation)*: Computes `missing_required_fields` and flags whether the dataset `is_valid_for_import`.
- **FastAPI Endpoint**:
  - `POST /api/v1/databridge/schema/detect`
- **Zero Schema Alterations**: Pure service and engine layer logic utilizing existing schema tables and fields.

---

## 3. Files Created
1. `backend/app/services/databridge/schema_mapping_engine.py`: Canonical implementation of `DataBridgeSchemaMapper`.
2. `backend/tests/test_databridge_phase7_schema_mapping.py`: Comprehensive test suite verifying all 7 test cases (`TC-MAP-001` through `007`).
3. `scripts/register_databridge_phase7_architecture.py`: Architecture decision and capability registration runner issuing preflight certificates.
4. `docs/implementation/foundation/DataBridge_Phase7_Schema_Mapping_Plan_v1.0.0.md`: Complete 19-section IPGP implementation plan.
5. `docs/walkthrough/foundation/DataBridge_Phase7_Schema_Mapping_v1.0.0.md`: This 13-section WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`: Added contract models `DataBridgeCandidateMatch`, `DataBridgeColumnMapping`, `DataBridgeMissingField`, `DataBridgeSchemaDetectRequest`, and `DataBridgeSchemaDetectResponse`.
2. `backend/app/services/databridge/__init__.py`: Exported Phase 7 models and `DataBridgeSchemaMapper`.
3. `backend/app/api/v1/databridge.py`: Mounted `/schema/detect` endpoint with `TenantContext`, `UserRole`, and entitlement guards.
4. `docs/implementation/README.md`: Updated master implementation index marking Phase 7 plan as Completed.
5. `docs/walkthrough/README.md`: Appended Phase 7 walkthrough entry to master index.
6. `CHANGELOG.md`: Added release notes under version `[6.70.12]`.

---

## 5. Architecture Decisions
- **ADR-DATABRIDGE-01 Addendum (Phase 7)**:
  - *Decoupled Intelligence*: Schema detection runs independently of database writes, allowing fast preview and dry-run validation without opening transactional locks.
  - *Multi-Tier Scoring Hierarchy*: Exact aliases score 1.0; token similarity scores 0.40–0.90; content profiling elevates matching fields to 0.90–0.98.
  - *Strict Ambiguity Protection*: If multiple candidate targets have close scores ($\le 0.06$ difference), the mapping is flagged as `AMBIGUOUS` to prevent silent mis-assignments.
  - *Statutory Profile Boost*: Recognizes Indian GSTIN, PAN, and Mobile Phone numbers directly from cell values.

---

## 6. Design Rationale
Prior to Phase 7, column matching was performed exclusively client-side in the React application (`HeaderMappingEngine.ts`). This created a functional gap for headless API consumers, asynchronous jobs, and future WhatsApp document intake workflows. Implementing `DataBridgeSchemaMapper` in the core Python service layer centralizes mapping logic as the Single Source of Truth across all client channels.

---

## 7. Implementation Summary
- **Normalization Pipeline**:
  - `normalize_token`: Converts camelCase to spaced tokens, replaces punctuation (`_`, `-`, `/`, `.`) with spaces, strips accents and extra whitespace.
  - `calculate_similarity`: Evaluates both character sequence ratio and word token Jaccard similarity.
  - `profile_sample_content`: Runs compiled regexes against non-null sample row values, requiring $\ge 50\%$ match rate to identify dominant content type.
- **Evaluation Pipeline**:
  - Iterates over all headers in `req.headers`.
  - Compares against entity field definitions in `ENTITY_FIELD_CATALOG`.
  - Produces sorted `candidates` list and assigns top candidate.
  - Validates missing required fields and computes `is_valid_for_import`.

---

## 8. Tests Executed
The test suite `backend/tests/test_databridge_phase7_schema_mapping.py` was executed:
1. `test_tc_map_001_exact_alias_resolution`: Verifies exact alias resolution for catalog and pricing fields (PASSED).
2. `test_tc_map_002_fuzzy_token_similarity_matching`: Verifies token similarity for misspelled and snake_case headers (PASSED).
3. `test_tc_map_003_content_profiling_gstin_elevation`: Verifies content profiling boost with GSTIN regex pattern (PASSED).
4. `test_tc_map_004_content_profiling_phone_elevation`: Verifies content profiling boost with Indian phone number regex pattern (PASSED).
5. `test_tc_map_005_missing_mandatory_fields_validation`: Verifies missing required fields reporting and validation flags (PASSED).
6. `test_tc_map_006_unmapped_unknown_columns`: Verifies clean handling of unmatchable columns (PASSED).
7. `test_tc_map_007_fastapi_rest_detect_endpoint`: Verifies end-to-end FastAPI endpoint `POST /api/v1/databridge/schema/detect` (PASSED).

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_001_exact_alias_resolution PASSED [ 14%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_002_fuzzy_token_similarity_matching PASSED [ 28%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_003_content_profiling_gstin_elevation PASSED [ 42%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_004_content_profiling_phone_elevation PASSED [ 57%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_005_missing_mandatory_fields_validation PASSED [ 71%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_006_unmapped_unknown_columns PASSED [ 85%]
backend\tests\test_databridge_phase7_schema_mapping.py::test_tc_map_007_fastapi_rest_detect_endpoint PASSED [100%]

======================= 7 passed, 22 warnings in 19.53s =======================

Full Regression Suite Across Phases 1 through 7:
================= 87 passed, 22 warnings in 105.10s (0:01:45) =================

Architecture Duplication Gate:
================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================

TypeScript Lint (tsc --noEmit):
Exit code: 0
```

---

## 10. Known Limitations
- Content profiling requires at least 2 valid non-empty sample cell values to trigger pattern matching.
- Multi-line headers (e.g. headers spanning multiple merged spreadsheet rows) should be pre-flattened before submitting to `/schema/detect`.

---

## 11. Future Work
- Phase 8: External Third-Party Connector Framework (Shopify, Tally, SAP B1, Unicommerce).
- Phase 9: Real-Time Webhook & Streaming Change Data Capture (CDC) Sync.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

---

## 13. Related RFCs
- `RFC-SCHEMA-MAPPING-01`: Automated Schema Mapping Intelligence & Field Detection Specification.
