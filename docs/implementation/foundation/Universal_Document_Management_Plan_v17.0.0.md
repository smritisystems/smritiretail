<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 17.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 23: Universal Document Management System (UDMS) Engine (v17.0.0)

## 1. Objective
Execute **Phase 23** of the SMRITI Modular Platform Roadmap: Deliver the **Universal Document Management System (UDMS) Engine (`backend/app/core/documents/`)** as a core platform service. Deliver **SMP-014 Universal Document Management Standard (`docs/governance/SMP_014_Universal_Document_Management_Standard.md`)**, Storage Provider Abstractions (`storage_providers/`), Attachment Service (`attachment_service.py`), Document Preview Engine (`document_preview_engine.py`), Attachment OCR Pipeline (`attachment_ocr_pipeline.py`), SQLAlchemy ORM Models (`backend/app/models/attachment.py`), REST API Gateway (`/api/v1/attachments`), and full pytest integration suite.

## 2. Business Motivation
- **Universal Attachment Platform:** Standardizes multi-file attachments, document version control, instant inline previews, role-based access, and optional OCR parsing across all business transactions and master records (Sales, Purchase, Inventory, Accounting, CRM, HR, Masters).

## 3. Scope
- Governance: `SMP-014 Universal Document Management Standard`.
- Storage Providers: `base_storage_provider.py`, `local_storage_provider.py`.
- Core Services: `attachment_service.py`, `document_preview_engine.py`, `attachment_ocr_pipeline.py`.
- DB Models & Schemas: `backend/app/models/attachment.py`, `backend/app/schemas/attachment.py`.
- REST API: `backend/app/api/v1/attachments.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Core business modules operational; Phase 23 adds universal attachment capabilities across all transactions.

## 5. Gap Analysis
- Need standardized file storage abstractions, SHA256 checksum integrity, versioning, document preview extraction, and reference-type linking.

## 6. Architecture Impact
- Zero modifications to SPK Kernel runtime execution. Business modules consume UDMS via platform API.

## 7. Proposed Design
- Decoupled storage provider architecture with immutable file version history.

## 8. Files Created
- `/docs/governance/SMP_014_Universal_Document_Management_Standard.md`
- `/backend/app/core/documents/storage_providers/base_storage_provider.py`
- `/backend/app/core/documents/storage_providers/local_storage_provider.py`
- `/backend/app/core/documents/attachment_service.py`
- `/backend/app/core/documents/document_preview_engine.py`
- `/backend/app/core/documents/attachment_ocr_pipeline.py`
- `/backend/app/models/attachment.py`
- `/backend/app/schemas/attachment.py`
- `/backend/app/api/v1/attachments.py`
- `/backend/app/tests/test_udms_engine.py`
- `/docs/implementation/foundation/Universal_Document_Management_Plan_v17.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `hashlib`, `shutil`, `mimetypes`.

## 11. Risks
- Large file uploads exceeding bandwidth: Mitigated by chunked streaming storage providers.

## 12. Rollback Strategy
- Remove `/api/v1/attachments` route; stored files remain intact.

## 13. Verification Plan
- Automated pytest suite `test_udms_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for multi-file uploading, SHA256 checksums, version history, preview metadata, reference queries, and OCR pipeline integration.

## 15. Documentation Impact
- Implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Git commit and build verification.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- AOP-001 SMRITI Optionality Principle
- GCR-001 SMRITI Golden Code Rule

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Universal_Document_Management_v17.0.0.md`
