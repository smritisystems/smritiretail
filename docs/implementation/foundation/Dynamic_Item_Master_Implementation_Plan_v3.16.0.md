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

# SMRITI Retail OS Implementation Plan: Dynamic Item Master & Attribute Studio (v3.16.0)

## 1. Objective
Redesign the **Item Master** to be fully dynamic, configurable, and industry-agnostic so that SMRITI Retail OS can support Footwear, Apparel, Grocery, Electronics, Pharma, Manufacturing, and any future business without code changes.

## 2. Business Motivation
Provide ready-made configurations and allow quick manual entry for a wide variety of retail verticals, eliminating database table/schema rebuilds or layout hardcoding on the frontend.

## 3. Scope
- Update SQLAlchemy attributes model schema to capture advanced config properties.
- Implement business templates loading API.
- Refactor frontend Catalog Registry to route entirely via FastAPI.
- Build an interactive Excel-style manual spreadsheet data entry grid.
- Retire legacy Express endpoints.

## 4. Current State
Product custom attributes exist but lack deep metadata rules (such as default values, languages, tooltip, printing, and searchability mappings). Catalog management utilizes a single standard form.

## 5. Gap Analysis
- No interactive spreadsheet-like grid editor.
- No dynamic templates for multiple industries.
- Incomplete attribute definition rules.

## 6. Architecture Impact
Dependencies point inwards. All metadata configurations reside in PostgreSQL and are queried dynamically.

## 7. Proposed Design
Dynamic layouts on the frontend compile columns by reading Attribute Group collections. Search API casts JSONB fields during text matching.

## 8. Files Created
- `backend/alembic/versions/d4e5f6a7b8c9_extend_attribute_definitions.py`
- `src/components/ExcelGridEntrySection.tsx`

## 9. Files Modified
- `backend/app/models/attributes.py`
- `backend/app/schemas/attributes.py`
- `backend/app/services/attributes.py`
- `backend/app/api/v1/attributes.py`
- `backend/app/repositories/product.py`
- `src/types.ts`
- `src/core/interfaces/db.ts`
- `src/db/postgres/PostgresRepositories.ts`
- `src/db/memory/MemoryRepositories.ts`
- `src/db/sqlite/SqliteRepositories.ts`
- `src/db/indexeddb/IndexedDbRepositories.ts`
- `src/components/ItemMasterTab.tsx`
- `src/components/AttributeManagerSection.tsx`
- `server.ts`

## 10. Dependencies
SQLAlchemy, PostgreSQL JSONB and GIN indexes, React, Tailwind CSS.

## 11. Risks
Database migrations in multi-developer setups. Mitigated by isolated migration versioning.

## 12. Rollback Strategy
Alembic schema downgrades.

## 13. Verification Plan
- Unit tests validating templates creation.
- Manual verification of grid operations.

## 14. Test Plan
Add test assertions under `backend/app/tests/test_attributes.py`.

## 15. Documentation Impact
Walkthrough documentation added.

## 16. Deployment Plan
FastAPI migrations run, Vite rebuild.

## 17. Status
Completed

## 18. Related ADRs
- ADR-016: Strangler-Fig Migration

## 19. Related Walkthroughs
- Inventory & Products Migration (v3.15.0)
- Dynamic Item Master & Configurable Attributes (v3.16.0)
