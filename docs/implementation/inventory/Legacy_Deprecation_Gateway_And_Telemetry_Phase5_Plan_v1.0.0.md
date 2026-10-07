<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.22
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Phase 5 Legacy Deprecation Gateway & Structured Telemetry Logger

**Plan ID:** IP-CAT-INV-005  
**Version:** v1.0.0  
**Status:** In Progress  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Date:** 2026-10-08  
**Area:** API Gateway, Telemetry, Observability, Inventory Governance, Option B Certification  
**Architecture:** Option B — Phase 5: Legacy Deprecation Gateway & Structured Telemetry Logger  

---

## 1. Objective
Establish an enterprise-grade **Legacy Deprecation Gateway & Structured Telemetry Logger** across SMRITI Retail OS. Following Phase 1 (Resolver Consolidation), Phase 2 (Write-Path Dual-Key Invariant Enforcement), Phase 3 (Read-Path Canonical Supremacy), and Phase 4 (External Connectors & Streaming Export Alignment), Phase 5 delivers the final governance infrastructure for Option B (Dual-Key Transitional Architecture):
1. Stamp standard RFC 8594 HTTP deprecation headers (`Deprecation`, `Sunset`, `Link: rel="successor-version"`, and `X-Smriti-Warning: SMRITI-DEPR-002`) on all legacy product endpoints (`/api/v1/products/*`, `/api/v1/inventory/products/*`, `/api/v1/variants/*`).
2. Implement a high-performance, durable, thread-safe structured telemetry sink (`LegacyProductTelemetrySink`) logging both external legacy endpoint traffic and internal runtime legacy fallbacks (when transactions/queries fall back from canonical `variant_id` to legacy `product_id`).
3. Protect observability log volume via thread-safe windowed rate-limiting / deduplication.
4. Provide administrative telemetry inspection APIs.
5. Provide a comprehensive Option B convergence certification test suite validating end-to-end multi-phase system integrity under the strict Schema Freeze.

## 2. Business Motivation
In large retail enterprises migrating from monolithic flat-SKU ERP models to multi-dimensional canonical catalogs:
1. **Developer & Integrator Visibility**: API consumers, third-party software vendors, and POS terminals must receive unambiguous, machine-readable notice (RFC 8594) that legacy `/products` endpoints are transitional and will sunset, guiding them to `/api/v1/universal/items`.
2. **Operational Observability**: Systems architects must possess exact quantitative telemetry of which tenants, branches, and callers are still relying on legacy product endpoints and fallbacks, enabling targeted merchant migration assistance.
3. **Zero-Breakage Guarantee**: Deprecation notices must be transmitted as standard HTTP response headers and telemetry logs without failing active legacy calls, guaranteeing 100% operational uptime for existing retail counters.
4. **Final Architecture Certification**: Formally certify that Option B fulfills all dual-key operational requirements without altering database schemas or historical financial ledgers.

## 3. Scope
- **In Scope**:
  - `backend/app/services/legacy_product_telemetry.py`: Durable thread-safe telemetry sink recording `LEGACY_ENDPOINT_ACCESSED` and `LEGACY_FALLBACK_INVOKED` events with in-memory windowed rate-limiting, file persistence (`backend/app/logs/legacy_deprecation_telemetry.jsonl`), and metric aggregation.
  - `backend/app/middleware/legacy_deprecation_middleware.py`: FastAPI middleware intercepting legacy product routes (`/api/v1/products`, `/api/v1/inventory/products`, `/api/v1/variants`), injecting RFC 8594 headers (`Deprecation`, `Sunset`, `Link`, `X-Smriti-Warning`), and recording telemetry.
  - Integration with `backend/app/main.py`: Middleware registration and router mounting.
  - Fallback telemetry hooks in `ReportsService` (`backend/app/services/reports.py`) and `DataBridgeExportEngine` (`backend/app/services/databridge/export_engine.py`) when legacy `product_id` fallback occurs.
  - Administrative telemetry endpoint in `backend/app/api/v1/governance.py` (`GET /api/v1/governance/legacy-telemetry/summary`).
  - Automated test suite `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py` covering RFC 8594 header conformance, telemetry recording, rate limiting, and Option B certification.
  - Version bump to `6.70.22` across all four SSOT version anchors.
- **Out of Scope / Schema Freeze**:
  - No database schema alterations or migrations (Alembic).
  - No alteration of historical database records.
  - No breaking HTTP status code rejections on legacy endpoints (soft-deprecation only).

## 4. Current State
- Phases 1–4 are fully implemented, verified (53/53 tests green), and pushed to `origin/smritiNX`.
- Legacy endpoints (`/api/v1/products`, `/api/v1/inventory/products`, `/api/v1/variants`) remain mounted as legacy aliases in `backend/app/main.py` without standard deprecation headers.
- When read services and export engines encounter legacy transactions without `variant_id` and fall back to `product_id`, no centralized telemetry records the event.

## 5. Gap Analysis
| Component | Pre-Phase 5 State | Target Phase 5 State | Impact |
|:---|:---|:---|:---|
| Legacy Product APIs | Returns 200 OK without deprecation metadata | Injects RFC 8594 `Deprecation`, `Sunset`, `Link: rel="successor-version"`, and `X-Smriti-Warning` headers | Clear migration guidance for API clients |
| Canonical Universal Items API | Serves canonical items | Continues serving canonical items without deprecation headers | Distinguishes canonical from legacy endpoints |
| Legacy Endpoint Observability | No structured audit of legacy callers | Records `LEGACY_ENDPOINT_ACCESSED` JSONL events with client IP, path, and method | Enables tenant deprecation monitoring |
| Runtime Fallback Observability | Silent fallback from variant to legacy product | Records `LEGACY_FALLBACK_INVOKED` telemetry with caller ID and product ID | Identifies unmigrated transaction lines |
| Telemetry Log Safety | Unbounded log file risk during batch runs | In-memory 60s rate-limiting / deduplication per `(company_id, caller, key)` | Prevents disk space exhaustion |

## 6. Architecture Impact
Phase 5 introduces zero schema changes and zero database dependencies:
- **Middleware Overhead**: Sub-millisecond path prefix matching using Python string/tuple checks.
- **Asynchronous / Thread-Safe Telemetry**: Non-blocking atomic file appends with rate-limiting locks.
- **RFC 8594 Conformance**: Standardized header names compliant with modern HTTP infrastructure (proxies, CDNs, API gateways).

## 7. Proposed Design
1. **RFC 8594 Response Headers**:
   ```http
   Deprecation: @1798761600
   Sunset: Sat, 01 Jan 2028 00:00:00 GMT
   Link: </api/v1/universal/items>; rel="successor-version"
   X-Smriti-Warning: SMRITI-DEPR-002: Legacy product endpoint is deprecated and scheduled for decommissioning. Please migrate to /api/v1/universal/items.
   ```
2. **`LegacyProductTelemetrySink` Architecture**:
   - Durable file path: `backend/app/logs/legacy_deprecation_telemetry.jsonl`
   - In-memory event window: tracks `(event_type, company_id, key)` timestamps, suppressing duplicate disk writes within 60 seconds while incrementing in-memory aggregate counters.
   - Aggregation API: returns total requests, unique companies, top callers, and breakdown by endpoint.

## 8. Files Created
- `docs/implementation/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_Plan_v1.0.0.md`
- `backend/app/services/legacy_product_telemetry.py`
- `backend/app/middleware/legacy_deprecation_middleware.py`
- `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py`
- `docs/walkthrough/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_v1.0.0.md`

## 9. Files Modified
- `backend/app/main.py`: Register `LegacyDeprecationMiddleware`.
- `backend/app/api/v1/governance.py`: Add `/legacy-telemetry/summary` endpoint.
- `backend/app/services/reports.py`: Wire `LegacyProductTelemetrySink.record_fallback_invoked()`.
- `backend/app/services/databridge/export_engine.py`: Wire `LegacyProductTelemetrySink.record_fallback_invoked()`.
- `src/config/version.ts`: Bump to `6.70.22`.
- `package.json`: Bump to `6.70.22`.
- `backend/app/core/config.py`: Bump to `6.70.22`.
- `CHANGELOG.md`: Release notes for `6.70.22`.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.

## 10. Dependencies
- Standard Python libraries: `os`, `json`, `time`, `threading`, `collections`.
- Starlette / FastAPI: `BaseHTTPMiddleware`, `Request`, `Response`.

## 11. Risks
| Risk | Severity | Mitigation |
|:---|:---|:---|
| Client parsers fail on unfamiliar headers | Low | RFC 8594 headers are standard HTTP extension headers ignored by compliant HTTP clients. |
| Telemetry disk file unbounded growth | Medium | In-memory windowed rate-limiting / deduplication prevents log saturation during load. |
| Middleware latency impact | Low | Header evaluation consists of O(1) path prefix checks with <0.1ms overhead. |

## 12. Rollback Strategy
Remove `LegacyDeprecationMiddleware` from `main.py` and revert code modifications via standard `git revert`. Zero database migrations or data repairs required.

## 13. Verification Plan
- Unit tests validating header injection on `/api/v1/products/*` and omission on `/api/v1/universal/items`.
- Telemetry tests verifying file recording, rate-limiting, and summary aggregation.
- Verification of reporting and export fallback hooks.
- Full regression across Phases 1–4.
- TypeScript compiler verification: `npx tsc --noEmit`.

## 14. Test Plan
Automated test suite `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py`:
1. `test_tc_p5_001`: RFC 8594 `Deprecation` header presence on legacy `/products` routes.
2. `test_tc_p5_002`: RFC 8594 `Sunset` and `Link: rel="successor-version"` header format validation.
3. `test_tc_p5_003`: Absence of deprecation headers on canonical `/universal/items`.
4. `test_tc_p5_004`: `LEGACY_ENDPOINT_ACCESSED` telemetry event emission and formatting.
5. `test_tc_p5_005`: `LEGACY_FALLBACK_INVOKED` telemetry event emission in reports fallback.
6. `test_tc_p5_006`: `LEGACY_FALLBACK_INVOKED` telemetry event emission in export engine fallback.
7. `test_tc_p5_007`: Rate-limiting / deduplication behavior under repeated calls.
8. `test_tc_p5_008`: Telemetry summary API aggregation across companies and callers.
9. `test_tc_p5_009`: Complete Option B end-to-end convergence certification.

## 15. Documentation Impact
- Register plan in `docs/implementation/README.md`.
- Produce 13-section walkthrough in `docs/walkthrough/inventory/`.
- Update `CHANGELOG.md` for version `6.70.22`.

## 16. Deployment Plan
1. Implement telemetry sink, middleware, and governance routes.
2. Wire fallback hooks in reports and export engine.
3. Execute dedicated Phase 5 test suite and full regression.
4. Verify TypeScript static analysis (`tsc --noEmit`).
5. Commit and push to `origin/smritiNX`.
6. Sync test environment via `git pull`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Canonical Identity Model (Item, Variant, Barcode Hierarchy).
- `ADR-0043`: Dual-Key Transitional Strategy (Option B).
- `ADR-0049`: RFC 8594 Legacy API Deprecation Gateway & Telemetry Standard.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_v1.0.0.md`
- `docs/walkthrough/inventory/External_Connectors_Canonical_Alignment_Phase4_v1.0.0.md`
- `docs/walkthrough/inventory/Canonical_Transaction_Supremacy_Phase3_v1.0.0.md`
- `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`
- `docs/walkthrough/catalog/Product_Resolution_Consolidation_Phase1_v1.0.0.md`
