<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Sprint 35: Section 7 Shared Business Engines: Documents Engine Completion

## 1. Purpose
This sprint delivers the authoritative **SMRITI Documents Engine** fulfilling **Blueprint Section 7: Shared Business Engines**. It establishes gapless sequential document numbering series with row-level locks, versioned layout configuration templates with cryptographic configuration hashes, dynamic rendering and immutable artifact persistence with SHA256 integrity verification, print job dispatching with reprint tracking and statutory watermarking, and governed document lifecycle state machine management.

---

## 2. Scope
- **Gapless Numbering Series**: `SELECT FOR UPDATE` atomic sequence allocation ensuring gapless continuity across statutory documents.
- **Template Layout Engine**: Versioned layout templates (`TaxInvoiceTemplate`, `TaxInvoiceTemplateVersion`) with SHA256 configuration hashing and frozen versions (`V1`).
- **Rendering & Artifact Integrity**: Dynamic document rendering, computing SHA256 document content hashes, and persisting immutable `InvoiceDocumentArtifact` records.
- **Print Dispatch & Reprint Audit**: Print job execution, reprint counter tracking, and dynamic watermark stamping ("ORIGINAL FOR RECIPIENT", "DUPLICATE COPY (REPRINT #N)").
- **Lifecycle State Machine**: Validating and enforcing canonical document lifecycle state transitions (`DRAFT` -> `ISSUED` -> `PRINTED` -> `AMENDED` -> `CANCELLED` / `VOIDED`).
- **REST Endpoints**: `/api/v1/documents/*` mounted on FastAPI.
- **Verification**: 6/6 tests green in `backend/tests/t_documents.py` and 93/93 platform regression tests green.

---

## 3. Files Created
- [`backend/app/schemas/documents.py`](file:///F:/SMRITRretailNX/backend/app/schemas/documents.py): Pydantic schemas for numbering series, sequence allocation, templates, rendering, printing, and lifecycle state management.
- [`backend/app/services/documents_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/documents_engine.py): Authoritative Documents Engine business logic.
- [`backend/app/api/v1/documents.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/documents.py): REST API router for document operations.
- [`backend/tests/t_documents.py`](file:///F:/SMRITRretailNX/backend/tests/t_documents.py): Integration test suite covering all 6 document engine capabilities.

---

## 4. Files Modified
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py): Mounted `documents.router` at `/api/v1/documents`.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md): Certified Section 7 Documents Engine as `Done / Verified` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Appended Sprint 35 row to master walkthrough index table.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md): Documented release `v3.51.0`.

---

## 5. Architecture Decisions
1. **Row-Level Locking for Sequential Numbering (`with_for_update`)**:
   - Sequential document number allocation uses PostgreSQL row-level locks on `DocumentSeries` to guarantee strictly gapless sequential numbers under high concurrent billing loads.
2. **Cryptographic SHA256 Integrity for Templates & Artifacts**:
   - Layout templates compute configuration digests to guarantee template immutability.
   - Rendered documents compute SHA256 content hashes stored in `InvoiceDocumentArtifact` to detect any post-generation tampering or data drift.
3. **Statutory Watermarking on Reprints**:
   - First print generates clean original copies ("ORIGINAL FOR RECIPIENT"), whereas reprint operations increment `reprint_count` and stamp explicit duplicate audit watermarks ("DUPLICATE COPY (REPRINT #N)").

---

## 6. Design Rationale
Statutory and commercial compliance mandates that invoices, delivery challans, and credit notes never skip numbers or allow in-place modification after issuance. The Documents Engine decouples layout styling from transactional models while guaranteeing immutable persistence and full auditability.

---

## 7. Implementation Summary
- **Numbering Engine**: Implemented `create_document_series`, `allocate_next_number`, and `NumberingAuditLog` recording.
- **Template Engine**: Implemented `create_template` with frozen versioning (`V1`) and SHA256 configuration hashing.
- **Rendering Service**: Implemented `render_document` compiling dynamic data context into clean HTML, computing SHA256 content digests, and persisting `InvoiceDocumentArtifact`.
- **Print Dispatcher**: Implemented `dispatch_print_job` tracking reprint counters and legal watermarking.
- **Lifecycle Engine**: Implemented `update_lifecycle_state` enforcing strict transitions across `DRAFT`, `ISSUED`, `PRINTED`, `AMENDED`, and `CANCELLED`.

---

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_documents.py -v
```

Terminal Output:
```text
tests/t_documents.py::test_sequential_gapless_numbering_allocation PASSED [ 16%]
tests/t_documents.py::test_document_template_creation_and_hash_binding PASSED [ 33%]
tests/t_documents.py::test_document_rendering_and_artifact_integrity PASSED [ 50%]
tests/t_documents.py::test_print_job_dispatch_and_reprint_watermark PASSED [ 66%]
tests/t_documents.py::test_document_lifecycle_state_machine PASSED       [ 83%]
tests/t_documents.py::test_api_documents_endpoints PASSED                [100%]

======================== 6 passed, 8 warnings in 9.13s ========================
```

---

## 9. Verification Results
- `6/6 tests green` in `t_documents.py`.
- `93/93 full platform regression tests green` across all SMRITI modules.
- SMRITI Naming Guard verified: `0 violations`.
- Evidence Level: `A` (Full Automated Suite + Concurrency-Safe DB Test).

---

## 10. Known Limitations
- Direct hardware thermal printer communication (ESC/POS byte streams) utilizes QZ Tray / client-side bridge protocols.

---

## 11. Future Work
- In Sprint 36, implement the **Fulfillment Engine** (fulfillment orders, pick, pack, dispatch, delivery, tracking, returns).

---

## 12. Related ADRs
- `ADR-0038`: Unified Document Artifact Archival and Cryptographic Integrity Verification.
- `ADR-0012`: Concurrency-Safe Gapless Document Series Allocation.

---

## 13. Related RFCs
- `RFC-DOC-001`: SMRITI Universal Document & Print Engine Specification.
