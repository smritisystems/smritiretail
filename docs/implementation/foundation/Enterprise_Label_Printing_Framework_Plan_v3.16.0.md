<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS Implementation Plan: Enterprise Label Printing Framework - ELPF (v3.16.0)

## 1. Objective
Build a centralized, metadata-driven Label Printing Framework (ELPF) that enables barcode and price labels to be printed from the Item Master catalog. 

## 2. Business Motivation
Provide non-technical shop operators with a streamlined 3-step label printing flow: Upload Excel -> Preview rendered HTML labels with editable counts -> Print directly to a TCP-connected thermal printer.

## 3. Scope
- PostgreSQL DB table schema updates for `print_histories` tracking.
- TCP/IP socket connection handler to stream raw ZPL/PRN data directly to a physical thermal printer.
- System configurations integration for default printer IP:Port storage.
- 3-step React printing wizard:
  1. Excel/CSV drag-and-drop parser with case/whitespace-tolerant column matcher.
  2. Live HTML preview of rendered labels.
  3. One-click batch print run, editable quantity overrides, and real-time print history logs.

## 4. Current State
`BarcodeLayout` models exist, but print processing only generates mock ZPL streams without physical TCP socket connections, logging, or user-friendly preview/upload UI.

## 5. Gap Analysis
- No physical TCP/IP printer connection implementation.
- No database model for tracking printed history.
- No user-friendly Excel bulk-upload and HTML preview wizards.

## 6. Architecture Impact
Dependencies point inwards. Socket printing is handled by FastAPI service background threads or synchronous blockers. Print jobs and settings are fetched dynamically.

## 7. Proposed Design
- **Socket Sender**: Python standard library `socket` connects to port `9100` and streams generated ZPL commands.
- **HTML Renderer**: Frontend parses layout `elements` configuration to compile styled `absolute` CSS divs for pixel-perfect label preview blocks.

## 8. Files Created
- `backend/alembic/versions/e5f6g7h8i9j0_add_print_history.py`
- `src/components/LabelPrintingSection.tsx`

## 9. Files Modified
- `backend/app/models/barcode.py`
- `backend/app/schemas/barcode.py`
- `backend/app/api/v1/barcode.py`
- `src/components/ItemMasterTab.tsx`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
FastAPI, PostgreSQL, standard Python `socket` module, React, Lucide-react.

## 11. Risks
Network timeout during printer socket connects. Mitigated with a 5.0 seconds socket timeout and clean error feedback back to user via HREP.

## 12. Rollback Strategy
Alembic migration downgrade, Git revert.

## 13. Verification Plan
- Unit tests validating socket trigger execution.
- Verification of HTML visual preview.
- Socket mock logging checks.

## 14. Test Plan
Add test assertions under `backend/app/tests/test_barcode.py`.

## 15. Documentation Impact
Walkthrough documentation will be added.

## 16. Deployment Plan
FastAPI database migrations run, Vite build.

## 17. Status
Draft

## 18. Related ADRs
- ADR-016: Strangler-Fig Migration

## 19. Related Walkthroughs
- Dynamic Item Master & Configurable Attributes (v3.16.0)
