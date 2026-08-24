<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS Walkthrough: Enterprise Label Printing Framework - ELPF (v3.16.0)

## 1. Purpose
Centralize barcode and price label printing from the Item Master catalog. Connect directly to a physical TCP/IP thermal printer and audit printed logs.

## 2. Scope
- PostgreSQL database migrations creating `print_histories` and `system_configs` tables.
- Raw TCP socket print sender streams dispatched over network port `9100`.
- 3-step non-technical user interface containing: CSV worksheet parser, live pixel-perfect HTML preview block rendering, editable counts, and print history log tables.

## 3. Files Created
- [Foundation_Enterprise_Label_Printing_Framework_v3.16.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/Foundation_Enterprise_Label_Printing_Framework_v3.16.0.md) (Walkthrough)
- [e5f6g7h8i9j0_add_print_history.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/e5f6g7h8i9j0_add_print_history.py) (Alembic Migration)
- [LabelPrintingSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/LabelPrintingSection.tsx) (React UI wizard)
- [test_barcode.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_barcode.py) (FastAPI endpoint unit tests)

## 4. Files Modified
- [barcode.py (models)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/barcode.py) (Schema model definition)
- [barcode.py (schemas)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/barcode.py) (Pydantic request/response objects)
- [barcode.py (router)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/barcode.py) (FASTAPI endpoint socket triggers & db log commit)
- [ItemMasterTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ItemMasterTab.tsx) (UI mount button and view switcher)
- [conftest.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/conftest.py) (Safe database cleanups)
- [README.md (walkthrough index)](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
- Centralized socket TCP connections inside FastAPI services instead of client browser drivers.
- Strangler-fig inward-only dependencies (Express proxy, FastAPI DB, Postgres store).

## 6. Design Rationale
Provides a robust 3-step wizard with case-tolerant headers parsing (`sku`/`code`/`id`), enabling non-technical shop owners to print label sheets from spreadsheets without custom drivers.

## 7. Implementation Summary
- Standard raw socket streaming to raw IP:Port with 5.0 seconds network connect timeout.
- Dynamic visual rendering in HTML matching elements positioning configurations of the selected layout template.

## 8. Tests Executed
- `python -m pytest app/tests/test_barcode.py` (verified Settings persistence, Print histories logging, and Socket timed-out offline triggers).
- `npx tsc --noEmit` (verified React code type-safety).

## 9. Verification Results
Both test cases in `test_barcode.py` pass without conflicts. UI compilation checks succeed with zero errors.

## 10. Known Limitations
None inside the V1 scope.

## 11. Future Work
Add automatic triggers to print labels directly upon Goods Receipt Note (GRN) transaction commits.

## 12. Related ADRs
- ADR-016: Strangler-Fig Migration

## 13. Related RFCs
- RFC-045: Thermal Printing Protocols
