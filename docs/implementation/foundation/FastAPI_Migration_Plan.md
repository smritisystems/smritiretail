<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# FastAPI Migration, Staff Management Schema Expansion, and Long-Tail Domain Porting Plan

## 1. Objective
Establish complete FastAPI core compliance for all 96 legacy Express API routes, migrating organizational data, document series numbering, terms, barcode studio, attributes/variant dimensions, data exchange hub, and AI assistant capabilities into FastAPI + PostgreSQL, allowing eventually retiring Express server modules safely.

## 2. Business Motivation
Standardizing the transactional backend on FastAPI + PostgreSQL simplifies development, lowers footprint, enforces unified role-based authorization controls (RBAC), and leverages ACID-compliant transactions (especially row locks in document numbering series) rather than legacy node in-memory arrays.

## 3. Scope
Port all remaining 66 endpoints across 10 functional domains, extend the `users` table schema with all 35 operational details (staff fields, salary structure, payment profiles, preference configs), construct target PostgreSQL database tables, generate database migrations using Alembic, write schemas & services, and register the routes under `/api/v1/*` in the FastAPI `main.py` routing engine.

## 4. Current State
- Express serves 96 endpoints across `/api/*`, including Staff Management, Masters, Numbering, Terms, Attributes, Barcode, Exchange, AI Assistant, and System layout config.
- FastAPI serves ~30 routes for authentication, product inventory, sales invoices, procurement/suppliers, and basic user CRUD under `/api/v1/*`.
- The User model in FastAPI has 8 basic columns, missing 27 operational fields like employee codes, photo base64 strings, salary structures, preferences, and notifications JSON structures.
- Long-tail modules read/write from in-memory objects in Express (`store.ts`) or flat json files.

## 5. Gap Analysis
| Functional Module | Express State | FastAPI Target State | Target DB Tables |
| :--- | :--- | :--- | :--- |
| **Staff Management** | Full 35-field user profile, self-preferences, photos, notifications. | Extended `User` model, updated schemas/services, RBAC update rules. | `users` (extended) |
| **Masters** | Generic `/api/masters/:type` (companies, branches, stores, wh, dept, desig). | Unified `/api/v1/masters/{entity_type}` endpoint, CRUD repository. | `master_entities` |
| **Numbering Engine** | Allocates sequences with reset rules, stored in-memory. | Atomic numbering series with `SELECT FOR UPDATE` locking to prevent POS duplicates. | `document_series`, `numbering_audit_logs` |
| **Terms & Conditions** | Resolve variables, snapshots, clauses defaults. | Priority inheritance terms resolver, snapshot tables. | `terms_clauses`, `terms_defaults`, `terms_snapshots` |
| **Attributes & Variants** | Variant cartesian generator, CSV validator, templates. | Attributes dimensions, templates, CSV validator service. | `attribute_definitions`, `attribute_groups`, `variant_templates`, `category_attribute_group_mappings` |
| **Barcode Studio** | Design templates, print profiles, print job metadata. | ZPL/PRN template config, printer profile database models. | `barcode_templates`, `barcode_print_profiles` |
| **Data Exchange Hub** | Mappings, validation, SHA256 checksum duplicate filters. | CSV validator, Partner registry, Transformation rules repository. | `exchange_partners`, `transformation_mappings`, `exchange_logs` |
| **AI Assistant** | Gemini 2.5 Flash chat, doc content traversal security. | Gemini client integration, local doc search. | None |
| **System / Meta** | Layout preferences, setup wizard provisioning, workflow log. | User preference mappings, company Wizard endpoint, workflow engine. | `master_entities` (company type) |
| **Roles & Permissions** | In-memory roles array. | Database role-permission mappings. | `role_permissions` |

## 6. Architecture Impact
- **Inward Dependency Flow:** Enforces API client call redirection to the Python backend `/api/v1/*`.
- **System of Record:** Discontinues write paths to `db_store.json` for long-tail domains, routing them to the Postgres transactional storage instead.
- **Concurrency Protection:** Protects voucher sequence generation using transactional SELECT FOR UPDATE database locking.

## 7. Proposed Design

### A. Staff Management Profile Extension
- Extend the `User` model (`backend/app/models/auth.py`) to add all 27 missing columns (listed in proposed files section).
- Store JSON fields like salary structures, bank/UPI details, performance metrics, and notifications/preferences as SQLAlchemy `Text` fields to allow DB-agnostic storage and map to Pydantic objects inside serializers.
- Enforce Role-Based Access Control (RBAC): Cache Cashier users can only update their own display name, photo, and preferences; Managers and Sysadmins can edit salary structures and payment settings.

### B. Numbering Engine Concurrency Locking
- Sequence allocation must be atomic:
  ```python
  # Transaction block
  series = await db.execute(
      select(DocumentSeries)
      .where(DocumentSeries.id == series_id)
      .with_for_update() # Row lock
  )
  ```
- Implement prefix/suffix token replacement (e.g. `{FY}`, `{Branch}`) and date-based resets (Daily, Monthly, Financial Year).

### C. Masters / Entity Routing
- Set up a unified repository pattern for master entities under `backend/app/repositories/masters_repository.py`.
- Support CRUD operations for `company`, `branch`, `store`, `warehouse`, `department`, `designation`.

### D. Variant Matrix Cartesian Engine
- Service will generate cartesian products of selected select-value array mappings:
  ```python
  import itertools
  keys, values = zip(*attr_dict.items())
  variants = [dict(zip(keys, v)) for v in itertools.product(*values)]
  ```

### E. Data Exchange Hub Statutory Validations
- Ensure GSTIN format regex matches `^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$`.
- HSN codes validated to match 4, 6, or 8 digit limits.
- Price reconciliation verifies that selling price + discount matches MRP within ₹1.

## 8. Files Created
1. `backend/app/models/masters.py` (MasterEntity model)
2. `backend/app/models/numbering.py` (DocumentSeries and NumberingAuditLog models)
3. `backend/app/models/terms.py` (TermsClause, TermsDefault, TermsSnapshot models)
4. `backend/app/models/attributes.py` (AttributeDefinition, AttributeGroup, VariantTemplate, CategoryAttributeGroupMapping models)
5. `backend/app/models/barcode.py` (BarcodeTemplate, BarcodePrintProfile models)
6. `backend/app/models/exchange.py` (ExchangePartner, TransformationMapping, ExchangeLog models)
7. `backend/app/models/roles.py` (RolePermission model)
8. `backend/app/schemas/masters.py` (Masters request/response schemas)
9. `backend/app/schemas/numbering.py` (Numbering request/response schemas)
10. `backend/app/schemas/terms.py` (Terms request/response schemas)
11. `backend/app/schemas/attributes.py` (Attributes request/response schemas)
12. `backend/app/schemas/barcode.py` (Barcode request/response schemas)
13. `backend/app/schemas/exchange.py` (Exchange request/response schemas)
14. `backend/app/schemas/roles.py` (Roles schemas)
15. `backend/app/schemas/layout.py` (Layout preference schemas)
16. `backend/app/schemas/company_setup.py` (Wizard configurations schemas)
17. `backend/app/services/numbering.py` (Voucher generation logic with SELECT FOR UPDATE)
18. `backend/app/services/terms.py` (Terms resolving logic)
19. `backend/app/services/attributes.py` (Variant matrices product calculations and CSV validation rules)
20. `backend/app/services/exchange.py` (Partner validation rules for GSTIN/HSN/MRP reconciliation)
21. `backend/app/api/v1/masters.py` (Masters endpoints)
22. `backend/app/api/v1/numbering.py` (Numbering series endpoints)
23. `backend/app/api/v1/terms.py` (Terms & conditions endpoints)
24. `backend/app/api/v1/attributes.py` (Variant and attributes dimensions endpoints)
25. `backend/app/api/v1/barcode.py` (Barcode template and print profile endpoints)
26. `backend/app/api/v1/exchange.py` (Partner validation and synchronization endpoints)
27. `backend/app/api/v1/assistant.py` (Gemini chat and document search endpoints)
28. `backend/app/api/v1/layout.py` (Preferences persistence endpoints)
29. `backend/app/api/v1/company_setup.py` (Wizard company provisioning endpoints)
30. `backend/app/api/v1/tally.py` (Tally queue endpoints)
31. `backend/app/api/v1/workflow.py` (Workflow transition endpoints)
32. `backend/app/api/v1/audit.py` (Audit log endpoints)
33. `backend/app/api/v1/roles_router.py` (Roles permission mapping endpoints)
34. `backend/app/tests/test_staff_management.py` (Test suite for staff endpoints and RBAC rules)
35. `backend/app/tests/test_migration_v11.py` (Integrations unit tests for long-tail domains)

## 9. Files Modified
1. `backend/app/models/auth.py` (Extend User model with 27 staff details fields)
2. `backend/app/schemas/user.py` (Add StaffUserCreate, StaffUserUpdate, StaffUserResponse, and subschemas)
3. `backend/app/services/user.py` (Update create/update/preferences methods)
4. `backend/app/api/v1/users.py` (Rewrite user endpoints for manager access and field-level RBAC)
5. `backend/app/main.py` (Include new routers)
6. `backend/app/models/__init__.py` (Import all SQLAlchemy models for Alembic auto-discovery)

## 10. Dependencies
- **Libraries:** Pytest, SQLAlchemy, Pydantic, FastAPI.
- **Keys:** `GEMINI_API_KEY` (must be defined in settings or environments).

## 11. Risks
- **Concurrency Race Conditions:** Simultaneously billing counters requesting voucher numbers might receive duplicate numbers if row lock is not correctly implemented. (Mitigated using `with_for_update()`).
- **Database Schema Mismatch:** Running migrations while Express is connected might cause lockouts. (Mitigated using soft changes and backwards-compatible nullable fields).

## 12. Rollback Strategy
If any DB table migration or API routing fails:
1. Revert Alembic schema using `alembic downgrade -1`.
2. Revert the code changes in git to restore the original FastAPI endpoints.

## 13. Verification Plan
### Automated Tests
- Run full pytest command: `pytest backend/app/tests`
- Run specific new tests: `pytest backend/app/tests/test_staff_management.py`

### Manual Verification
- Query `/api/v1/users` with Manager authorization token and verify full schema representation.
- Post a new numbering series and run allocation multiple times to check financial year reset and sequential output.
- Request the `/api/v1/assistant/chat` with mock user queries.

## 14. Test Plan
Write 5 test cases for each domain under `backend/app/tests/`:
- **Staff management:** Verify cashiers cannot modify fixed monthly salary fields.
- **Numbering:** Verify resetting numbering resets correctly when date changes.
- **Terms resolve:** Verify unresolved variables fall back correctly.
- **Attribute csv import:** Verify row with 5-character HSN fails validation check.
- **Assistant traversal:** Verify paths outside `docs/` are blocked.

## 15. Documentation Impact
- Update `/docs/walkthrough/` directory with `FastAPI_Migration_Walkthrough_v3.16.md`.
- Append to index `docs/walkthrough/README.md`.

## 16. Deployment Plan
1. Apply database migrations: `alembic upgrade head`.
2. Deploy expanded backend service docker image.
3. Repoint frontend calls using `apiFetchV1` wrapper.

## 17. Status
Draft (Awaiting approval)

## 18. Related ADRs
None

## 19. Related Walkthroughs
None
