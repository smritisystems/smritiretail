<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.27.3
  * Created    : 2026-09-16
  * Modified   : 2026-09-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: POS Terminal Profile Default Installation Baseline & CRUD Lifecycle

## 1. Purpose
The purpose of this implementation is to establish the statutory POS Terminal Profile (`Counter 01 - Express Billing`, Code: `REG-01`) as the authoritative installation baseline across SMRITI Retail OS. This ensures that any fresh system installation, database seeding, or onboarding company setup automatically provisions an out-of-the-box active billing terminal, eliminating unconfigured terminal errors and manual prerequisite friction, while providing full lifecycle CRUD (`POST`, `GET`, `PUT`, `DELETE`) management for POS profiles.

## 2. Scope
- **Schema Defaults**: Establish statutory installation defaults in `POSProfileCreate` schema (`Counter 01 - Express Billing`, `REG-01`, default cashier `EMP001 - John Doe`, and warehouse `Main Store`).
- **Database Baseline Seeding**: Seed standard terminals (`REG-01` and `REG-02`) across system databases (`smritisys` and tenant databases such as `smriti001`) during baseline startup via `seed_baseline_users.py`.
- **Onboarding Setup Wizard**: Integrate default POS profile auto-provisioning into `company_setup` (`/api/v1/company/setup`) so new tenants created through the setup wizard immediately have terminal `REG-01`.
- **Backend Service & API CRUD**: Enhance `POSService` and `pos.py` API endpoints with full CRUD support:
  - `POST /api/v1/pos/profiles/`: Create terminal profile with auto-code derivation or explicit code.
  - `GET /api/v1/pos/profiles/`: List active profiles with flexible branch scoping (matching active branch or company-wide profiles).
  - `PUT /api/v1/pos/profiles/{id}`: Update terminal profile metadata, assigned cashier, warehouse, lock status, and notes.
  - `DELETE /api/v1/pos/profiles/{id}`: Soft-delete/deactivate terminal profile.
- **Frontend Configuration**: Align `posProfiles.config.tsx` with `code` and `notes` form fields and payload transformation fallback logic.
- **Database Column Parity (Rule 12)**: Harmonize `warehouse_id` column on `cash_registers` between control database (`smritisys`) and tenant databases (`smriti001`).

## 3. Files Created
- `docs/walkthrough/pos/POS_Terminal_Profile_Default_Installation_And_CRUD_Lifecycle_v6.27.3.md`: This comprehensive WGP walkthrough.

## 4. Files Modified
- `backend/app/schemas/pos.py`: Added default values to `POSProfileCreate` for name, code, cashier, warehouse, is_locked, and notes.
- `backend/app/services/pos.py`: Added `update_profile` method, auto-derived code fallback in `create_profile`, and relaxed branch filtering to include company-level registers (`branch_id.is_(None)`).
- `backend/app/api/v1/pos.py`: Added `PUT /pos/profiles/{profile_id}` and `DELETE /pos/profiles/{profile_id}` endpoints with 200 OK responses.
- `backend/app/api/v1/system.py`: Added automatic statutory POS profile (`REG-01`) provisioning in `company_setup()`.
- `backend/app/db/seed_baseline_users.py`: Added installation baseline seeding for `REG-01` (`Counter 01 - Express Billing`) and `REG-02` (`Counter 02 - Standard Checkout`) in both control and tenant databases.
- `src/components/global/configs/posProfiles.config.tsx`: Added form fields for `code` and `notes`, and configured `payloadTransform` with default code generation.
- `docs/walkthrough/README.md`: Appended this walkthrough entry into the master index table.

## 5. Architecture Decisions
- **ADR-POS-01: Out-of-the-Box Terminal Availability**: Retail billing cannot commence without an active cash register / POS profile. Making `REG-01` (`Counter 01 - Express Billing`) an installation default guarantees immediate checkout readiness post-install.
- **ADR-POS-02: Branch Hierarchical Scoping**: Terminal profiles can be assigned to a specific branch (`branch_id = BR-MAIN-001`) or left unassigned (`branch_id = None`) to denote company-wide available profiles. `list_registers` selects `(CashRegister.branch_id == self.tenant.branch_id) | (CashRegister.branch_id.is_(None))`.
- **ADR-POS-03: Idempotent Seed Guards**: Database seeding and onboarding checks query existing active registers before inserting to ensure re-running startup scripts or setup wizard does not duplicate terminals.

## 6. Design Rationale
In enterprise retail operations (such as Tally Shoper 9 and SAP Retail environments), every store installation ships with standard POS counters configured (Counter 01, Counter 02). Requiring operators to manually configure a cash register before their first transaction causes onboarding stalls. By establishing statutory defaults at the schema, onboarding, and seeding layers, SMRITI ensures immediate usability while allowing administrators full flexibility to edit, add, or deactivate counters.

## 7. Implementation Summary
1. **Schema Layer**: `POSProfileCreate` in `backend/app/schemas/pos.py` updated with default values:
   ```python
   name: str = Field(default="Counter 01 - Express Billing", min_length=2, max_length=100)
   code: Optional[str] = Field(default="REG-01", max_length=50)
   cashier: Optional[str] = Field(default="EMP001 - John Doe", max_length=100)
   warehouse: Optional[str] = Field(default="Main Store", max_length=100)
   is_locked: Optional[bool] = False
   notes: Optional[str] = Field(default="Default installation POS terminal profile", max_length=500)
   ```
2. **Service & API Layer**:
   - `create_profile`: Uses user-supplied `code` or generates `REG-XXXXXX`.
   - `update_profile`: Updates name, code, cashier, warehouse, lock status, and notes.
   - `delete_profile`: Marks `is_active=False` and `is_deleted=True`.
   - `list_registers`: Queries active registers matching company and branch/global scope.
3. **Database Seeding Layer**: `seed_baseline_users.py` automatically provisions `PROF-DEFAULT-REG01` (`REG-01`) and `PROF-DEFAULT-REG02` (`REG-02`) in `smritisys` and `smriti001`.
4. **Onboarding Wizard**: `company_setup` in `backend/app/api/v1/system.py` automatically injects `REG-01` if no registers exist for the newly onboarded company.
5. **Frontend Config**: `posProfiles.config.tsx` updated with code and notes form fields and default payload transform.

## 8. Tests Executed
- **Python Compilation**:
  - Command: `python -m py_compile backend/app/api/v1/system.py backend/app/schemas/pos.py backend/app/services/pos.py backend/app/api/v1/pos.py backend/app/db/seed_baseline_users.py`
  - Result: Exit code 0, 0 syntax/compile errors.
- **Container Compilation**:
  - Command: `docker exec smriti-api python -m py_compile /app/app/api/v1/system.py /app/app/schemas/pos.py /app/app/services/pos.py /app/app/api/v1/pos.py /app/app/db/seed_baseline_users.py`
  - Result: Exit code 0.
- **REST API End-to-End Test (CRUD Lifecycle)**:
  - Created test script `test_crud_pos_profiles.py` validating:
    - Authentication with `sysadmin`.
    - Profile Creation (`POST /api/v1/pos/profiles/`) -> `PROF-47C318DA` / `REG-03`.
    - Profile Update (`PUT /api/v1/pos/profiles/{id}`) -> Updated cashier and warehouse.
    - Profile Soft-Delete (`DELETE /api/v1/pos/profiles/{id}`) -> Marked inactive.
    - Profile Listing (`GET /api/v1/pos/profiles/`) -> Confirmed only active `REG-01` returned.
  - Result: Exit code 0, all CRUD stages verified.
- **Frontend Test Suite**:
  - Command: `npm test`
  - Result: 132 test suites passed, 875 unit tests passed (100% green).
- **TypeScript Compiler**:
  - Command: `npx tsc --noEmit`
  - Result: Exit code 0, 0 type errors.
- **Production Bundle Build**:
  - Command: `npm run build` (`vite build`)
  - Result: Built successfully in 28.52s across 3,549 modules.

## 9. Verification Results
- Database query confirms `REG-01` (`Counter 01 - Express Billing`) exists with status `Active` in both control and tenant databases.
- Endpoint `GET /api/v1/pos/profiles/` returns `[REG-01] Counter 01 - Express Billing (ID: PROF-A8E3DFE3, Cashier: EMP001 - John Doe, Warehouse: Main Store)`.
- Rebuilt frontend bundle binds directly to `/usr/src/app/dist` in `smriti-web`.
- No broken links, missing fields, or compilation warnings.

## 10. Known Limitations
- Warehouse assignment currently stores string name and nullable foreign key `warehouse_id`. Full strict foreign key validation requires warehouse lookup by code.
- Terminal shift binding requires an active open shift on the register before transactions can be committed through POS checkout.

## 11. Future Work
- Add hardware profile binding (thermal printer IP/port, customer display COM port, cash drawer kick pulse) to POS Terminal Profile.
- Implement multi-counter real-time load balancing and cashier shift handoff wizard.

## 12. Related ADRs
- `ADR-POS-01`: Out-of-the-Box Terminal Availability
- `ADR-POS-02`: Branch Hierarchical Scoping for POS Registers
- `ADR-005`: Canonical Table Convergence & One-Way Projections

## 13. Related RFCs
- `RFC-POS-004`: Physical Cash Register & Terminal Profile Architecture
- `RFC-SYS-002`: Multi-Tenant Company Onboarding & Statutory Provisioning
