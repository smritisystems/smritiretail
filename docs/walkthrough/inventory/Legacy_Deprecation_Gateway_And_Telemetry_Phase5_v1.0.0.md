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
  Classification: Technical Walkthrough — Phase 5: Legacy Deprecation Gateway & Structured Telemetry Logger
-->

# Walkthrough: SMRITI Legacy Deprecation Gateway & Structured Telemetry Logger (Phase 5 Option B Convergence)

## 1. Purpose
This walkthrough documents the design, implementation, and verification of **Phase 5: Legacy Deprecation Gateway & Structured Telemetry Logger** under **Option B (Dual-Key Transitional Architecture)** for SMRITI Retail OS. Phase 5 establishes standard RFC 8594 soft-deprecation signaling on legacy product endpoints and instruments a high-performance, durable structured telemetry pipeline (`LegacyProductTelemetrySink`) with rate-limiting across external APIs and runtime fallback hooks.

## 2. Scope
- **Deprecation Gateway Middleware**: Intercepts external calls to `/api/v1/products`, `/api/v1/inventory/products`, and `/api/v1/variants`, injecting RFC 8594 standard headers (`Deprecation`, `Sunset`, `Link: rel="successor-version"`) and emitting audit telemetry.
- **Durable Structured Telemetry Sink**: Thread-safe JSONL file logger (`backend/app/logs/legacy_deprecation_telemetry.jsonl`) recording `LEGACY_ENDPOINT_ACCESSED` and `LEGACY_FALLBACK_INVOKED` events with 60-second in-memory rate-limiting / deduplication.
- **Administrative Governance Observability API**: `GET /api/v1/governance/legacy-telemetry/summary` endpoint providing aggregated telemetry metrics across paths, callers, and tenants.
- **Runtime Fallback Instrumentation**: Telemetry hooks in `ReportsService.item_wise_sales` and `DataBridgeExportEngine.sales_invoice` auditing when legacy `product_id` defaults are triggered due to null `variant_id`.
- **Option B Convergence Certification**: 9 automated tests certifying zero database schema alterations, zero historical transaction mutations, and complete backward compatibility.

## 3. Files Created
1. `backend/app/services/legacy_product_telemetry.py`: Thread-safe durable telemetry sink with JSONL append, rate-limiting, and summary metrics.
2. `backend/app/middleware/legacy_deprecation_middleware.py`: ASGI middleware injecting RFC 8594 deprecation headers and recording access events.
3. `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py`: Automated verification suite with 9 convergence certification tests.
4. `docs/implementation/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_Plan_v1.0.0.md`: 19-section IPGP implementation plan.
5. `docs/walkthrough/inventory/Legacy_Deprecation_Gateway_And_Telemetry_Phase5_v1.0.0.md`: This 13-section WGP walkthrough document.

## 4. Files Modified
1. `backend/app/main.py`: Mounted `LegacyDeprecationMiddleware` into FastAPI ASGI middleware stack.
2. `backend/app/api/v1/governance.py`: Mounted `GET /api/v1/governance/legacy-telemetry/summary` inspection endpoint.
3. `backend/app/services/reports.py`: Connected `LegacyProductTelemetrySink.record_fallback_invoked` hook in `item_wise_sales`.
4. `backend/app/services/databridge/export_engine.py`: Connected fallback hook in `sales_invoice` export and added `order_by(SalesInvoice.created_at.desc())`.
5. `src/config/version.ts`: Bumping SSOT version to `6.70.22`.
6. `package.json`: Bumping package version to `6.70.22`.
7. `backend/app/core/config.py`: Bumping backend configuration version to `6.70.22`.
8. `CHANGELOG.md`: Added release notes for `[6.70.22] - 2026-10-08`.
9. `docs/implementation/README.md`: Updated master implementation plan index table.
10. `docs/walkthrough/README.md`: Appended master walkthrough index table.

## 5. Architecture Decisions
- **RFC 8594 Standard Compliance**: Rather than using non-standard proprietary headers, the gateway injects `Deprecation: @1798761600` (Unix epoch timestamp for 2027-01-01), `Sunset: Sat, 01 Jan 2028 00:00:00 GMT` (RFC 7231 HTTP-date), and `Link: </api/v1/universal/items>; rel="successor-version"` (RFC 8288), paired with `X-Smriti-Warning: SMRITI-DEPR-002`.
- **Exact Prefix Exclusion**: Canonical endpoints (`/api/v1/product-identity`, `/api/v1/product-resolution`, `/api/v1/universal/*`) are explicitly safeguarded from receiving deprecation headers while matching legacy aliases (`/api/v1/products`, `/api/v1/inventory/products`, `/api/v1/variants`).
- **60-Second In-Memory Deduplication Window**: High-frequency POS barcode scanning loops invoking fallback or legacy paths could saturate disk I/O. The sink deduplicates consecutive events with identical keys (`FALLBACK:{company_id}:{caller}:{product_id}:{reason}`) to a single disk write within each 60-second window, while retaining in-memory real-time metrics.
- **Fail-Safe Try/Except Enclosure**: All telemetry invocations inside transactional services (`ReportsService`, `DataBridgeExportEngine`) are enclosed in guarded blocks to ensure observability telemetry never fails a business transaction or export stream.

## 6. Design Rationale
- **Schema Freeze Invariant**: Option B mandates strictly ZERO alterations to the PostgreSQL schema. No columns were added, dropped, or modified.
- **Dual-Key Parity**: Transitional dual keys (`product_id` + canonical `item_id`/`variant_id`) allow legacy consumers and modern canonical consumers to operate concurrently without data divergence.
- **Zero Breakage on Legacy Clients**: Endpoints return HTTP 200/201 with normal payloads; deprecation is conveyed purely through HTTP response metadata and internal telemetry.

## 7. Implementation Summary
```text
Client Request
      │
      ▼
LegacyDeprecationMiddleware
      │
      ├── Path matches legacy prefix?
      │     ├── YES: Injects RFC 8594 Headers (Deprecation, Sunset, Link, X-Smriti-Warning)
      │     │        Records LEGACY_ENDPOINT_ACCESSED in LegacyProductTelemetrySink
      │     └── NO: Passthrough
      ▼
Endpoint Handler
      │
      ├── ReportsService / DataBridgeExportEngine
      │     ├── Item has variant_id?
      │     │     ├── YES: Canonical item processing (zero fallback telemetry)
      │     │     └── NO: Defaults to legacy product_id
      │     │             Records LEGACY_FALLBACK_INVOKED in LegacyProductTelemetrySink
      ▼
LegacyProductTelemetrySink
      ├── In-Memory Deduplication / Rate-Limiting (60s Window)
      └── Thread-Safe Atomic JSONL Append (backend/app/logs/legacy_deprecation_telemetry.jsonl)
```

## 8. Tests Executed
1. `backend/tests/test_phase5_legacy_deprecation_and_telemetry.py` (9 tests):
   - `test_tc_p5_001`: RFC 8594 `Deprecation`, `Sunset`, `Link`, and `X-Smriti-Warning` headers on `/api/v1/products/`.
   - `test_tc_p5_002`: Deprecation headers on legacy aliases `/api/v1/inventory/products` and `/api/v1/variants`.
   - `test_tc_p5_003`: Absence of deprecation headers on canonical `/api/v1/universal/items/resolve`.
   - `test_tc_p5_004`: `LEGACY_ENDPOINT_ACCESSED` telemetry recording.
   - `test_tc_p5_005`: `LEGACY_FALLBACK_INVOKED` telemetry recording in `ReportsService.item_wise_sales`.
   - `test_tc_p5_006`: `LEGACY_FALLBACK_INVOKED` telemetry recording in `DataBridgeExportEngine`.
   - `test_tc_p5_007`: Rate-limiting / deduplication preventing log file saturation under repeated calls.
   - `test_tc_p5_008`: Telemetry summary aggregation and breakdown across paths and callers.
   - `test_tc_p5_009`: Complete Option B end-to-end convergence certification.
2. Full Regression Suites:
   - `backend/tests/test_phase4_external_connectors_canonical_alignment.py` (9/9 passed).
   - `backend/tests/test_phase3_canonical_read_supremacy.py` (10/10 passed).
   - `backend/tests/test_phase2_transaction_dual_write.py` (20/20 passed).
   - `backend/tests/test_databridge_phase5_export.py` (7/7 passed).
   - `backend/tests/test_databridge_phase8_connectors.py` (7/7 passed).
   - `npx tsc --noEmit` (TypeScript static analysis passed with 0 errors).

## 9. Verification Results
- **Phase 5 Suite**: 9 passed in 21.84s (100% green).
- **Phase 4 Suite**: 9 passed in 20.80s (100% green).
- **Phase 3 Suite**: 10 passed in 7.85s (100% green).
- **Phase 2 Suite**: 20 passed in 16.11s (100% green).
- **DataBridge Phase 5**: 7 passed in 17.33s (100% green).
- **DataBridge Phase 8**: 7 passed in 17.34s (100% green).
- **Total Tests Green**: **62 / 62 tests passed** across all transitional dual-key test suites.
- **Frontend TypeScript**: 0 errors (`npx tsc --noEmit` exit code 0).

## 10. Known Limitations
- The telemetry sink uses local thread locking and atomic file append, suitable for single-node FastAPI workers. Distributed multi-node setups will aggregate JSONL logs via log collection daemons (e.g., Vector, Fluentbit) or export directly to central observability.

## 11. Future Work
- Scheduled monitoring and reporting on legacy endpoint access volumes leading up to the 2028 Sunset date.
- Eventual hard-deprecation cutoff of legacy endpoints after external third parties migrate to `/api/v1/universal/items`.

## 12. Related ADRs
- `ADR-0042`: Canonical Identity Model (Item, Variant, Barcode Hierarchy).
- `ADR-0043`: Dual-Key Transitional Strategy (Option B).
- `ADR-0049`: RFC 8594 Legacy API Deprecation Gateway & Telemetry Standard.

## 13. Related RFCs
- `RFC-8594`: The Deprecation HTTP Header Field.
- `RFC-7231`: Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content (Section 7.1.1.1: Sunset Date Format).
- `RFC-8288`: Web Linking (Successor-Version relation).
