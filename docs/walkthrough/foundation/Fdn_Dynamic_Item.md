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
-->

# SMRITI Walkthrough: Dynamic Item Master & Configurable Product Attributes (v3.16.0)

## 1. Purpose
This walkthrough documents the full design, structural refactoring, and integration of the Dynamic Item Master and Configurable Product Attributes module inside SMRITI Retail OS. It facilitates industry-agnostic catalog configurations without code modification.

## 2. Scope
- Excel-style manual catalog entry grid supporting spreadsheet copy-paste, arrow keyboard navigation, and automatic row creation.
- Dynamic industry-agnostic business template seeder (Apparel, Footwear, Grocery, Electronics, Jewellery) loaded directly into PostgreSQL.
- Database migration extending the `attribute_definitions` schema.
- High-performance text casting search over GIN-indexed attributes.
- Strangler-fig backend migration of all attributes and variant routes to FastAPI + Postgres backend, unmounting them from Express.

## 3. Files Created
- [ExcelGridEntrySection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ExcelGridEntrySection.tsx)
- [d4e5f6a7b8c9_extend_attribute_definitions.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/d4e5f6a7b8c9_extend_attribute_definitions.py)

## 4. Files Modified
- [IndexedDbRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/indexeddb/IndexedDbRepositories.ts)
- [attributes.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/attributes.py)
- [attributes.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/attributes.py)
- [attributes.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/attributes.py)
- [attributes.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/attributes.py)
- [product.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/product.py)
- [ItemMasterTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ItemMasterTab.tsx)
- [AttributeManagerSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/AttributeManagerSection.tsx)
- [VariantTemplateSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/VariantTemplateSection.tsx)
- [BulkImportSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/BulkImportSection.tsx)
- [AttributeAnalyticsSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/AttributeAnalyticsSection.tsx)
- [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts)
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)

## 5. Architecture Decisions
- Moved all custom attribute models, categories, mappings, variant generators, and templates from the legacy JSON Express layer to FastAPI + PostgreSQL.
- Cast postgres JSONB attributes column into a generic database String to perform highly flexible, index-friendly global case-insensitive `ILIKE` pattern matches.
- Handled all spreadsheet events client-side using React key down state coordinates and clipboard TSV text parsing.

## 6. Design Rationale
- Standardizing the layout dynamically permits custom metadata (tooltips, defaults, displayed order) to automatically populate user forms, saving development overhead when adapting the system to new sectors (e.g. Pharma).

## 7. Implementation Summary
- **Database Schema Upgrades**: Extended `attribute_definitions` columns for extended configurations, mapping definitions, and display controls.
- **Service Layer Expansion**: Built the `load_industry_template` logic in Python services to auto-seed properties for multiple business verticals.
- **Spreadsheet Component**: Developed arrow navigation handlers (`ArrowUp`/`ArrowDown`/`Enter`/`Tab`) with automatic boundary cell selection, alongside Excel Tab-separated Clipboard text mapper.
- **Rerouted All Actions**: Replaced standard React browser fetch calls in analytics, template manager, and importer views with `apiFetchV1` calls hitting the FastAPI backend, and deleted the Express attributes route handler.

## 8. Tests Executed
- Backend tests ran via `pytest` to guarantee REST router endpoints, tenant contexts, and transactional database integrity.
- Frontend builds and TypeScript validations checked via `npx tsc --noEmit`.

## 9. Verification Results
- Database migration applied successfully with `alembic upgrade head`.
- TypeScript compiler output cleanly compiled with zero errors.
- Pytest backend tests fully passed.

## 10. Known Limitations
- Excel copy-paste parser expects standard Tab-separated values; other format boundaries might require user manual adjustment.

## 11. Future Work
- Build UI options to support multiple localizations for dynamic attributes directly inside the Attribute Studio view.

## 12. Related ADRs
- `ADR-0012`: System of Record Transition to PostgreSQL.

## 13. Related RFCs
- `RFC-0089`: Dynamic Extensible Attributes Schema.
