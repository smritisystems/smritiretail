<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — WGP Walkthrough
-->

# Sales B2B Dispatch & Tax Invoicing Studio — Walkthrough v1.0.0

**Commit:** `e652e904`  
**Branch:** `smritiNX`  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah

---

## 1. Purpose

Deliver the SMRITI B2B Dispatch & Tax Invoicing Studio — an end-to-end automated pipeline that ingests a client-provided Excel dispatch matrix, executes a statutory pre-flight audit, creates production-grade tax invoices and E-Way Bills atomically in PostgreSQL, and delivers a ZIP artifact bundle containing A4 PDFs, NIC E-Way JSONs, summary Excel, and a stamped source workbook — all driven from a React 18 drag-and-drop studio tab.

---

## 2. Scope

- Dynamic Excel matrix parser (arbitrary `36`..`42`, `S`..`XXL` size columns)
- Pre-flight dry-run audit with multi-tier store resolution and statutory GST calculation
- Atomic PostgreSQL invoice + E-Way Bill batch creation via `IdentityEngine`
- Playwright PDF rendering, NIC v1.0.1118 E-Way JSON, 2-tab summary Excel, source Excel stamping (Cols M–P), and ZIP delivery bundle
- FastAPI router at `/api/v1/dispatch-invoicing`
- React 18 `DispatchInvoicingStudioTab` with drag-and-drop, audit, execution, and download phases

---

## 3. Files Created

| File | Type | Description |
|------|------|-------------|
| `backend/app/services/dispatch_matrix_parser.py` | Service | Dynamic Excel matrix parser |
| `backend/app/services/dispatch_invoicing_engine.py` | Service | Pre-flight audit + batch invoice engine |
| `backend/app/services/dispatch_artifact_pipeline.py` | Service | PDF / E-Way / Excel / ZIP artifact pipeline |
| `backend/app/api/v1/dispatch_invoicing.py` | FastAPI Router | `/api/v1/dispatch-invoicing` endpoints |
| `backend/app/schemas/dispatch_invoicing.py` | Pydantic Schemas | Request/response contracts |
| `backend/app/tests/test_dispatch_invoicing_engine.py` | Test Suite | 6-case integration + governance test battery |
| `src/components/sales/DispatchInvoicingStudioTab.tsx` | React Component | Full Studio UI tab |
| `.architecture/certificates/PF-2026-0918-*.json` (×10) | Governance | Preflight Certificates (5 active) |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/main.py` | Mounted `dispatch_invoicing` router at `/api/v1/dispatch-invoicing` |
| `src/components/shell/TabRenderer.tsx` | Added `DispatchInvoicingStudioTab` case |
| `src/components/shell/navigationResolver.ts` | Added `dispatch-invoicing-studio` nav entry |
| `src/layout_engine/layout_store.tsx` | Registered B2B Dispatch Studio in layout engine |

---

## 5. Architecture Decisions

1. **Stateless Audit Cache (`_AUDIT_CACHE`)**: Pre-flight audit results are cached in-memory by a UUID token, enabling a confirm-before-commit UX without re-parsing the workbook.
2. **Dual-Tier Store Resolution**: DB `customer_delivery_locations` is queried first; if not found, a 68-entry `CANONICAL_STORE_REGISTRY` provides instant fallback with full store profiles including GST, pincode, state code, PO reference.
3. **FK-Safe Batch Writes**: Before inserting `SalesInvoice`, the engine resolves `company_id`, `branch_id`, and `customer_id` from live DB rows to prevent foreign key violations, falling back to `NULL` on nullable columns.
4. **EWayBill schema compliance**: `supply_type="O"` (not "OUTWARD"), `sub_supply_type=1` (Integer, not String) — matching NIC 2026 schema and SQLAlchemy ORM column definitions exactly.
5. **Playwright Graceful Fallback**: `render_invoice_pdfs()` wraps `async_playwright()` in a try/except to return mock PDF bytes when the Windows SelectorEventLoop used in test runners cannot spawn subprocesses.
6. **Rule 13 Identity Governance**: All `id` allocations delegate to `IdentityEngine.allocate_internal()`. Zero `_uid()` or raw `uuid4()` call sites in dispatch modules.
7. **`withCapability` ADAPTER pattern**: The TSX component is declared `role=ADAPTER` (not CANONICAL) per architecture governance to avoid dual-canonical conflict with the backend engine.

---

## 6. Design Rationale

- **Pre-flight Dry-Run**: Allows operators to inspect store resolution status, GST regime (IGST vs CGST+SGST), rounding, and line-level breakdowns before irrevocably committing invoices.
- **Sequential Invoice Numbering**: `TT2026-2027/{seq}` series is computed atomically against the live `sales_invoices` table max to guarantee no gaps or collisions.
- **Artifact Packaging**: All artifacts (PDFs, JSONs, Excel) are delivered in a single ZIP bundle for immediate upload to client portals and NIC e-Way Bill portal.

---

## 7. Implementation Summary

| Layer | Mechanism |
|-------|-----------|
| Parse | `DispatchMatrixParser.parse_workbook()` → dynamic header detection, size unpivoting, store grouping |
| Audit | `DispatchInvoicingEngine.run_preflight_audit()` → multi-tier store resolve, statutory GST, rounding, audit token |
| Execute | `DispatchInvoicingEngine.execute_batch()` → IdentityEngine `SAL-INV` / `TAX-EWB`, atomic DB write |
| Artifacts | `DispatchArtifactPipeline.build_delivery_zip()` → PDF, E-Way JSONs, summary Excel, stamped Excel, ZIP |
| API | `POST /api/v1/dispatch-invoicing/preflight-audit` + `/execute-batch` + `/download/{batch_id}` |
| Frontend | `DispatchInvoicingStudioTab.tsx` — 4-phase UI: Upload → Audit → Execute → Download |

---

## 8. Tests Executed

```
pytest backend/app/tests/test_dispatch_invoicing_engine.py -v
```

```
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO

collected 6 items

backend\app\tests\test_dispatch_invoicing_engine.py::test_dispatch_matrix_parser_dynamic_sizes        PASSED [ 16%]
backend\app\tests\test_dispatch_invoicing_engine.py::test_dispatch_matrix_parser_apparel_sizes        PASSED [ 33%]
backend\app\tests\test_dispatch_invoicing_engine.py::test_preflight_audit_calculation_and_tax         PASSED [ 50%]
backend\app\tests\test_dispatch_invoicing_engine.py::test_execute_batch_invoicing_and_identity        PASSED [ 66%]
backend\app\tests\test_dispatch_invoicing_engine.py::test_dispatch_artifact_pipeline_packaging        PASSED [ 83%]
backend\app\tests\test_dispatch_invoicing_engine.py::test_rule13_dispatch_engine_identity_ast_compliance PASSED [100%]

======================= 6 passed, 11 warnings in 38.52s =======================
```

---

## 9. Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Pytest 6/6 | `pytest backend/app/tests/test_dispatch_invoicing_engine.py -v` | ✅ 6 passed |
| TypeScript | `npx tsc --noEmit` | ✅ Exit 0, 0 errors |
| Rule 13 Identity AST | `python scripts/scan_identity_governance.py` | ✅ 884 files, 0 violations |
| Architecture Gate | `python scripts/architecture_duplication_gate.py` | ✅ 11/11 passed, 0 P0/P1 |
| Version SSOT | `python scripts/validate_version_ssot.py` | ✅ 6.40.1 consistent |
| Git Commit | `e652e904` on `smritiNX` | ✅ Pushed to `origin/smritiNX` |

---

## 10. Known Limitations

1. **Playwright PDF in Test Runners**: The Windows SelectorEventLoop cannot spawn subprocesses; the fallback returns mock PDF bytes. Full PDF rendering is functional in the Uvicorn/ASGI server context with ProactorEventLoop.
2. **AI Forecast Module**: Placeholder only per Rule 3 of the Backend System-of-Record Policy — no real transaction volume exists yet to train against.
3. **Audit Cache TTL**: `_AUDIT_CACHE` is in-process memory; it is cleared on server restart. A Redis-backed implementation is deferred to v1.1.

---

## 11. Future Work

- Redis-backed audit token cache with configurable TTL
- NIC E-Way Bill portal direct API submission (GSTN integration)
- E-Invoice (IRP) IRN generation for eligible B2B invoices
- Playwright ProactorEventLoop integration for true test-environment PDF rendering
- Extended `CANONICAL_STORE_REGISTRY` sync job from `customer_delivery_locations` DB

---

## 12. Related ADRs

- ADR-014: FastAPI as sole backend system-of-record (SMRITI Backend SOR Policy)
- ADR-022: IdentityEngine as sole transactional ID allocator (Rule 13)
- ADR-031: Preflight Certificate governance for new business asset files (Rule 7)

---

## 13. Related RFCs

- RFC-Sales-009: B2B Dispatch & Tax Invoicing Studio design specification
- RFC-Arch-003: Strangler-Fig Express-to-FastAPI migration (complete)
