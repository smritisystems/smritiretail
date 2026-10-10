<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.51
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Industrial Barcode Print Job Architecture, Multi-Protocol Compiler & QZ Tray Bridge (Phases 1 & 2)

## 1. Purpose
To deliver an industrial, server-side barcode printing architecture that eliminates fragile browser-dependent printing and Playwright workarounds. Implements a first-class `BarcodePrintJob` lifecycle, continuous mathematical DPI scaling (`dots_per_mm = dpi / 25.4`), protocol-agnostic label templates, multi-protocol rendering (Zebra ZPL, Honeywell DPL, SVG), QZ Tray auto-discovery with persistent default printer selection, and bidirectional print job status acknowledgment.

---

## 2. Scope
- **Backend Compiler:** `app/services/barcode_engine/` implementing `DpiEngine`, `BarcodeCompiler`, `template_registry`, and renderers (`zpl_renderer.py`, `dpl_renderer.py`, `svg_renderer.py`).
- **Database Entity:** `BarcodePrintJob` in `models/barcode.py` and Alembic migration `v1526_add_barcode_print_jobs_table.py` tracking print job lifecycles (`QUEUED`, `COMPILING`, `READY`, `PRINTING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- **API Surface:** `POST /api/v1/barcode/print-jobs`, `GET /api/v1/barcode/print-jobs`, `GET /api/v1/barcode/print-jobs/{job_id}`, `PATCH /api/v1/barcode/print-jobs/{job_id}/status`, `POST /api/v1/barcode/print-jobs/{job_id}/ack`, and `GET /api/v1/barcode/templates`.
- **Frontend QZ Tray Auto-Discovery & Persistence:** `BarcodePrinterSele.tsx` discovers Windows queues on mount, auto-loads previously selected default printer from `localStorage`, and persists confirmed choices.
- **Frontend Print Dispatch & PRN Export:** `TagLabelPrintingTa.tsx` connects to `POST /api/v1/barcode/print-jobs`, handles direct QZ Tray hardware dispatch with ACK callback, and supports zero-dependency compiled `.prn`/`.zpl` file downloads.
- **Layout Registry:** `src/services/barcodeLayoutRegistry.ts` unifying protocol-agnostic label definitions and SVG preview generators across frontend modules.
- **Automated Verification:** 7/7 backend python tests passing, 10/10 Vitest frontend tests passing, and 0 `tsc --noEmit` errors.

---

## 3. Files Created
- [`backend/app/services/barcode_engine/__init__.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/__init__.py)
- [`backend/app/services/barcode_engine/models.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/models.py)
- [`backend/app/services/barcode_engine/dpi.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/dpi.py)
- [`backend/app/services/barcode_engine/registry.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/registry.py)
- [`backend/app/services/barcode_engine/compiler.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/compiler.py)
- [`backend/app/services/barcode_engine/renderers/__init__.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/renderers/__init__.py)
- [`backend/app/services/barcode_engine/renderers/zpl_renderer.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/renderers/zpl_renderer.py)
- [`backend/app/services/barcode_engine/renderers/dpl_renderer.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/renderers/dpl_renderer.py)
- [`backend/app/services/barcode_engine/renderers/svg_renderer.py`](file:///F:/SMRITRretailNX/backend/app/services/barcode_engine/renderers/svg_renderer.py)
- [`backend/app/schemas/barcode_job.py`](file:///F:/SMRITRretailNX/backend/app/schemas/barcode_job.py)
- [`backend/alembic/versions/v1526_add_barcode_print_jobs_table.py`](file:///F:/SMRITRretailNX/backend/alembic/versions/v1526_add_barcode_print_jobs_table.py)
- [`src/services/barcodeLayoutRegistry.ts`](file:///F:/SMRITRretailNX/src/services/barcodeLayoutRegistry.ts)
- [`backend/app/tests/test_barcode_print_engine.py`](file:///F:/SMRITRretailNX/backend/app/tests/test_barcode_print_engine.py)
- [`src/tests/barcodeLayoutRegistry.test.ts`](file:///F:/SMRITRretailNX/src/tests/barcodeLayoutRegistry.test.ts)

---

## 4. Files Modified
- [`backend/app/models/barcode.py`](file:///F:/SMRITRretailNX/backend/app/models/barcode.py) (Added `BarcodePrintJob` ORM model)
- [`backend/app/api/v1/barcode.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/barcode.py) (Added `/print-jobs`, `/templates`, and `/print-jobs/{job_id}/ack` endpoints)
- [`backend/app/schemas/barcode_job.py`](file:///F:/SMRITRretailNX/backend/app/schemas/barcode_job.py) (Added `PrintJobAckRequest` schema)
- [`src/components/barcode/BarcodePrinterSele.tsx`](file:///F:/SMRITRretailNX/src/components/barcode/BarcodePrinterSele.tsx) (Auto-discovery, localStorage persistence)
- [`src/components/barcode/TagLabelPrintingTa.tsx`](file:///F:/SMRITRretailNX/src/components/barcode/TagLabelPrintingTa.tsx) (Wired to `/print-jobs`, layout selector, QZ dispatch)

---

## 5. Architecture Decisions
1. **Four-Tier Architecture Boundary:** The backend compiles raw thermal command streams (`ZPL`, `DPL`) and manages job states, while the local client layer (QZ Tray) bridges to physical Windows printer queues (`IMPACT by Honeywell IH-2`, `Zebra ZT411`).
2. **Single Source of Truth Layouts:** Templates are defined once using standard metric dimensions (`mm`). A mathematical continuous scaling factor converts coordinates to target printer dots without maintaining separate layout files for different DPI heads.
3. **Idempotent Job Tracking & ACK Loop:** `idempotency_key` ensures rapid double-clicks on print buttons do not generate duplicate physical labels. QZ Tray sends an execution ACK back to `POST /api/v1/barcode/print-jobs/{job_id}/ack` to record completion or hardware spooler faults.

---

## 6. Design Rationale
- **Zero Browser Dependence:** Direct backend compilation executes in sub-milliseconds without initializing or stalling browser engines.
- **Physical Footwear Spec Parity:** Built-in template `tattly-threads-footwear-100x50.7` matches the physical 100mm × 50.7mm 3-part tag (Dual counter stubs + Main shoe box label with inverted black size box `^GB` and `^FR`).
- **Resilient Fallback Mode:** In environments without local QZ Tray daemons, users can export compiled `.prn` or `.zpl` files directly to disk for USB thumb-drive or command-line spooling.

---

## 7. Implementation Summary
- **DPI Engine:** Continuous formula `dots_per_mm = dpi / 25.4` supporting 203 DPI (8.00 dpmm), 300 DPI (11.81 dpmm), and 600 DPI (23.62 dpmm).
- **ZPL & DPL Renderers:** Output standard industrial printer commands with reverse text blocks, Code 128 symbology, and Human-Readable Interpretation (HRI).
- **FastAPI Endpoints:** Mounted `@router.post("/print-jobs")`, `@router.get("/templates")`, `@router.get("/print-jobs")`, `@router.get("/print-jobs/{job_id}")`, `@router.patch("/print-jobs/{job_id}/status")`, and `@router.post("/print-jobs/{job_id}/ack")`.
- **Database Schema:** Created `barcode_print_jobs` table and verified column-by-column parity on `smritisys` and `smriti001`.
- **Frontend Integration:** Wired `TagLabelPrintingTa.tsx` and `BarcodePrinterSele.tsx` with live QZ Tray scanning, localStorage persistence, and layout switching.

---

## 8. Tests Executed
### 8.1 Backend Python Test Suite (`test_barcode_print_engine.py`)
```text
test_barcode_print_job_ack_status_transition (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_barcode_print_job_ack_status_transition)
Verify print job acknowledgment handles success/failure status transitions. ... ok
test_barcode_print_job_db_persistence (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_barcode_print_job_db_persistence)
Verify async persistence, status updating, and retrieval of BarcodePrintJob entity. ... ok
test_dpi_engine_mathematical_precision (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_dpi_engine_mathematical_precision)
Verify continuous dots_per_mm = dpi / 25.4 calculation across printer heads. ... ok
test_dpl_compilation (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_dpl_compilation)
Verify DPL compilation produces standard Datamax/Honeywell start/end codes. ... ok
test_svg_preview_generation (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_svg_preview_generation)
Verify SVG renderer returns valid XML with proper viewBox dimensions. ... ok
test_template_registry_builtins (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_template_registry_builtins)
Verify registration and resolution of standard industrial templates. ... ok
test_zpl_compilation_footwear_3stub (app.tests.test_barcode_print_engine.TestBarcodePrintEngine.test_zpl_compilation_footwear_3stub)
Verify ZPL compilation contains reverse print boxes and 3-part layout geometry. ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.994s

OK
```

### 8.2 Frontend Vitest Suite (`barcodeLayoutRegistry.test.ts` & `qzTrayClient.test.ts`)
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/barcodeLayoutRegistry.test.ts (4 tests) 7ms
 ✓ src/tests/qzTrayClient.test.ts (6 tests) 12ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  12:26:55
   Duration  1.26s (transform 159ms, setup 0ms, import 248ms, tests 19ms, environment 0ms)
```

### 8.3 TypeScript Type Checker (`tsc --noEmit`)
```text
npx tsc --noEmit
Exit code: 0 (0 errors)
```

---

## 9. Verification Results
- **Status:** Done
- **Evidence Level:** Level A (Direct terminal outputs and tests verified)
- **Compilation:** 100% Type-Safe (TypeScript and Pydantic)
- **Database Status:** Lineage validated across control (`smritisys`) and tenant (`smriti001`)

---

## 10. Known Limitations
- TSPL (Taiwan Semiconductor Printer Language) currently falls back to ZPL emulation on TSPL-compatible printers.

---

## 11. Future Work
- Add TSPL compiler generator for TSC printers without ZPL emulation firmware.
- Add label printing batch analytics dashboard.

---

## 12. Related ADRs
- `ADR-0082`: Server-Side Barcode Compilation & Local Client Dispatch Architecture
- `ADR-0043`: Database Per Tenant Multi-Tenancy Architecture

---

## 13. Related RFCs
- `RFC-2026-09`: Thermal Barcode Printing Hardware Abstraction
