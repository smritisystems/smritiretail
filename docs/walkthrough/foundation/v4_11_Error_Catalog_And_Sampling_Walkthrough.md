<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.11.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Machine Error Catalog, Probabilistic Trace Sampling & Capability Matrix (v4.11.0)

**Status:** Done  
**Evidence Level:** A (Direct Automated Test Outputs + Git Diffs)

## 1. Purpose
To deliver **v4.11.0 — Machine Error Catalog, Probabilistic Trace Sampling & Connector Capability Matrix**, establishing a central catalog mapping machine codes to HTTP status and retry policies, introducing configurable trace sampling rates with a 100% error trace-on bypass protocol, standardizing metric prefixes, and publishing outbound connector integration capability matrices.

## 2. Scope
- **Central Error Catalog:** `SMRITI_ERROR_CATALOG` dictionary in `backend/app/core/error_catalog.py`.
- **Probabilistic Sampling & 100% Error Bypass:** `RequestContextMiddleware` in `backend/app/middleware/request_context.py`.
- **Governed Metrics Prefixes:** Standardized names (`smriti_system_*`, `smriti_pos_*`, `smriti_security_*`) in `backend/app/services/telemetry_service.py`.
- **Connector Capability Matrix:** `get_connector_capabilities()` in `backend/app/services/communicator_service.py`.
- **Tests:** `backend/app/tests/test_v4_11_error_catalog_and_sampling.py`.

## 3. Files Created
- `backend/app/core/error_catalog.py`
- `backend/app/tests/test_v4_11_error_catalog_and_sampling.py`
- `docs/implementation/foundation/v4_11_Error_Catalog_And_Sampling_Plan.md`
- `docs/walkthrough/foundation/v4_11_Error_Catalog_And_Sampling_Walkthrough.md`

## 4. Files Modified
- `backend/app/middleware/request_context.py`
- `backend/app/services/telemetry_service.py`
- `backend/app/services/communicator_service.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Standardized Machine Error Catalog:** Centralizing status mappings and retry logic ensures that client applications, logs, and background retry queues handle errors consistently.
- **Probabilistic Trace Context Sampling:** Setting `TRACE_SAMPLE_RATE` prevents trace logging overhead and disk bloat in high-volume environments, while the `100% Error Trace-On` rule guarantees all HTTP error responses (>= 500) are fully captured regardless of sampling rates.
- **Observability Connector Capability Matrix:** Exposing protocol capabilities enables deployments to assess connectivity features natively.

## 6. Design Rationale
Enterprise operations need to scale trace capture selectively while maintaining full trace visibility on server-side exceptions.

## 7. Implementation Summary
Implemented error catalog, request context probabilistic sampling, standardized metrics namespaces, connector capabilities matrix, and verified via automated pytest.

## 8. Tests Executed
Executed automated test suite:
```bash
..\.venv311\Scripts\python.exe -m pytest app/tests/test_v4_11_error_catalog_and_sampling.py -v
```

## 9. Verification Results
```text
collected 3 items

app/tests/test_v4_11_error_catalog_and_sampling.py::test_error_catalog_structure PASSED [ 33%]
app/tests/test_v4_11_error_catalog_and_sampling.py::test_probabilistic_trace_sampling PASSED [ 66%]
app/tests/test_v4_11_error_catalog_and_sampling.py::test_connector_capability_matrix PASSED [100%]

======================== 3 PASSED in 19.64s ========================
```

## 10. Known Limitations
- **Static Sampling Configuration:** The `TRACE_SAMPLE_RATE` setting is currently defined at class/application initialization time; dynamic live sampling rate adjustments without backend reloads will require a configuration daemon in a future release.
- **Capability Matrix Metadata Bounds:** The Connector Capability Matrix represents a static metadata declaration of connector protocol features and does not perform live network connection verification on the downstream endpoint.

## 11. Future Work
- Dynamic runtime sampling rate configuration endpoint.
- Outbound retry queue worker hook using error catalog retry flags.

## 12. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 13. Related RFCs
- RFC-4.11.0: Observability Scale & Error Catalog Protocol
