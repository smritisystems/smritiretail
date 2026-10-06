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
  Classification: Architecture & Implementation Plan — SMRITI DataBridge Phase 7
-->

# SMRITI Transaction DataBridge Phase 7: Automated Schema Mapping Intelligence & Field Detection Engine Implementation Plan

## 1. Objective
Design and implement **Phase 7** of the SMRITI Transaction DataBridge. Phase 7 delivers an intelligent server-side schema mapping and field detection engine (`DataBridgeSchemaMapper` / `backend/app/services/databridge/schema_mapping_engine.py`). The engine provides automated header normalization, token-distance fuzzy matching, statutory regex-based content profiling on sample data, candidate ambiguity detection, and missing mandatory field validation across all 15 retail entities in SMRITI Retail OS.

---

## 2. Business Motivation
1. **Frictionless Ingestion for Disparate Client Formats**: Retailers migrating to SMRITI Retail OS bring messy spreadsheets exported from legacy ERPs (Tally, Busy, Marg, SAP B1, Excel). Manual column-by-column mapping is error-prone and time-consuming.
2. **Statutory & Content-Aware Recognition**: Standard string matching fails when columns have generic names like "Tax No", "Reference", or "Code". By inspecting sample row data (e.g. verifying 15-digit GSTIN patterns, 10-digit PAN, 13-digit EAN barcodes, or phone numbers), the engine achieves near-100% confidence.
3. **Omni-Channel API Capability**: While frontend TypeScript mapping exists in `HeaderMappingEngine.ts`, headless API consumers, asynchronous background workers, and future WhatsApp document intake require a robust, server-side Python implementation with zero frontend dependencies.

---

## 3. Scope
- **Server-Side Schema Mapping Engine (`DataBridgeSchemaMapper`)**:
  - Authoritative dictionary of field definitions, labels, statutory requirements, and synonyms for all 15 entities.
  - Multi-tier matching pipeline:
    - Tier 1: Exact alias lookup ($O(1)$) against canonical and commercial alias registers.
    - Tier 2: Token-similarity algorithm (Normalized Levenshtein / Jaro-Winkler / N-gram token overlap).
    - Tier 3: Content profiling on sample rows with regex matching (GSTIN, PAN, Phone, Email, Pincode, Barcode, Dates, Numeric amounts).
    - Tier 4: Ambiguity classifier flagging candidate fields when confidence scores are close ($\le 0.05$ difference).
    - Tier 5: Completeness validation detecting missing required/statutory fields.
- **REST Endpoints**:
  - `POST /api/v1/databridge/schema/detect`: Analyzes headers and sample rows; returns column mapping recommendations with confidence scores.
- **Contract Models**:
  - `DataBridgeSchemaDetectRequest`, `DataBridgeColumnMapping`, `DataBridgeSchemaDetectResponse`.
- **Zero Schema Alterations**: Pure service and engine layer implementation utilizing existing database structures.

---

## 4. Current State
- Phases 1 through 6 are fully implemented, verified, and committed in `smritiNX` (80/80 regression tests green).
- Client-side TypeScript mapping exists in `src/lib/headerMapping/` (`HeaderAliasRegistry.ts`, `HeaderMappingEngine.ts`), but no server-side mapping intelligence exists in Python.

---

## 5. Gap Analysis
| Capability | Current State | Phase 7 Target State |
|---|---|---|
| Server-side Header Mapping | Absent | Authoritative `DataBridgeSchemaMapper` in `schema_mapping_engine.py` |
| Content Profiling | Absent | Sample-data regex inspection (GSTIN, PAN, Phone, Barcode, etc.) |
| Schema Detection Endpoint | Absent | `POST /api/v1/databridge/schema/detect` |
| Ambiguity Resolution | Client-side only | Server-side candidate scoring and ambiguous flag |

---

## 6. Architecture Impact
- Housed entirely within the canonical DataBridge service boundary: `backend/app/services/databridge/schema_mapping_engine.py`.
- No database migrations, no tenant schema mutations, no control plane changes.
- Capability registered under `architecture_capabilities` as `databridge.schema_mapping_engine`.

---

## 7. Proposed Design
```text
Raw Headers + Sample Rows
          ↓
[1. Normalize Tokens] (lowercase, trim, strip punctuation)
          ↓
[2. Exact Alias Matching] (Dictionary lookup)
          ↓ (if not exact)
[3. Token Distance Similarity] (Levenshtein & Token Jaccard)
          ↓ (if sample rows present)
[4. Content Profiling] (GSTIN, PAN, Barcode, Phone, Date regex boost)
          ↓
[5. Ambiguity & Threshold Check] (Score >= 0.85 -> HIGH, 0.65 -> MEDIUM, < 0.65 -> LOW)
          ↓
Output: Column Mappings + Missing Required Fields
```

---

## 8. Files Created
1. `backend/app/services/databridge/schema_mapping_engine.py`: Canonical implementation of `DataBridgeSchemaMapper`.
2. `backend/tests/test_databridge_phase7_schema_mapping.py`: Comprehensive test suite verifying all 7 test cases (`TC-MAP-001` through `007`).
3. `scripts/register_databridge_phase7_architecture.py`: Preflight certificate issuer and capability registration runner.
4. `docs/implementation/foundation/DataBridge_Phase7_Schema_Mapping_Plan_v1.0.0.md`: This 19-section implementation plan.
5. `docs/walkthrough/foundation/DataBridge_Phase7_Schema_Mapping_v1.0.0.md`: 13-section walkthrough document.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added schema detection request and response contract models.
2. `backend/app/services/databridge/__init__.py`: Exported Phase 7 models and `DataBridgeSchemaMapper`.
3. `backend/app/api/v1/databridge.py`: Mounted `POST /schema/detect` endpoint.
4. `docs/implementation/README.md`: Master implementation plan index table updated.
5. `docs/walkthrough/README.md`: Master walkthrough index table updated.
6. `CHANGELOG.md`: Registered Phase 7 release notes under version `[6.70.12]`.

---

## 10. Dependencies
- Python standard library (`re`, `math`, `typing`, `uuid`, `datetime`).
- Pydantic v2 contract models.
- FastAPI dependency injection (`TenantContext`, `get_current_user`, `require_databridge_entitlement`).

---

## 11. Risks
- **Over-zealous fuzzy matching**: Headers with slight similarity might wrongly map to sensitive fields.  
  *Mitigation*: Threshold scoring requires $\ge 0.70$ for automatic mapping; below threshold remains `UNMAPPED`.
- **False positive content profiling**: Numbers resembling phone numbers or dates.  
  *Mitigation*: Content profiling only boosts existing token matches; does not map purely on content unless column name is generic.

---

## 12. Rollback Strategy
- Phase 7 adds pure logic files and API endpoints without altering database tables.
- In case of regression, git revert commit or remove endpoint route.

---

## 13. Verification Plan
- Unit tests validating exact alias matching, fuzzy similarity, content profiling, ambiguity detection, and missing fields.
- End-to-end FastAPI endpoint test using `httpx.AsyncClient`.
- Full regression test execution across Phases 1 through 7 (expecting 87/87 tests green).
- Architecture duplication gate check (`npm run architecture:check`).
- TypeScript compiler verification (`npm run lint`).

---

## 14. Test Plan
- `TC-MAP-001`: Exact alias resolution for catalog and pricing fields.
- `TC-MAP-002`: Fuzzy token-similarity matching for misspelled and snake_case headers.
- `TC-MAP-003`: Content profiling elevation with GSTIN regex pattern.
- `TC-MAP-004`: Content profiling elevation with Indian phone number regex pattern.
- `TC-MAP-005`: Candidate ambiguity detection when multiple target fields match closely.
- `TC-MAP-006`: Missing mandatory / statutory fields validation report.
- `TC-MAP-007`: FastAPI REST endpoint `POST /api/v1/databridge/schema/detect` integration.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase7_Schema_Mapping_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Zero database migrations.
- Hot code rollout across FastAPI backend.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase7_Schema_Mapping_v1.0.0.md`
