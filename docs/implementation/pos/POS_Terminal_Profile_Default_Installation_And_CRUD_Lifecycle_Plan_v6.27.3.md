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

# Implementation Plan: POS Terminal Profile Default Installation Baseline & CRUD Lifecycle

## 1. Objective
Establish the statutory POS Terminal Profile (`Counter 01 - Express Billing`, Code: `REG-01`) as the default installation baseline and provide complete RESTful CRUD endpoints (`POST`, `GET`, `PUT`, `DELETE`) with full database schema parity across SMRITI Retail OS.

## 2. Business Motivation
In retail and distributor environments, cashiers and billing operators must be able to conduct billing immediately following system onboarding or database provisioning. Previously, if no POS register existed or if the profile code was unset, checkout flows failed. Establishing a statutory installation default guarantees immediate checkout readiness and aligns with enterprise retail practices (e.g., Tally Shoper 9 Counter 01 baseline).

## 3. Scope
- Schema default values for `POSProfileCreate` (`name`, `code`, `cashier`, `warehouse`, `is_locked`, `notes`).
- Automatic database seeding of default registers (`REG-01` and `REG-02`) in `seed_baseline_users.py`.
- Onboarding wizard auto-provisioning of `REG-01` in `company_setup` (`/api/v1/company/setup`).
- Full CRUD API support (`PUT` update and `DELETE` soft-delete) in `POSService` and `pos.py`.
- Form configuration and payload transformation in `posProfiles.config.tsx`.
- Rule 12 column parity for `warehouse_id` on `cash_registers` in `smritisys` and `smriti001`.

## 4. Current State
Prior to this implementation:
- `POSProfileCreate` required `name` and `code` with no installation defaults.
- No `PUT` or `DELETE` endpoints existed for `/pos/profiles/{id}`.
- New company onboarding via `/company/setup` did not provision an initial POS register.
- Database `smritisys` lacked the `warehouse_id` column present in `smriti001`.

## 5. Gap Analysis
1. Schema gap: Missing defaults in Pydantic schema caused manual overhead during setup.
2. API gap: Operators could not edit or delete POS profiles via `/api/v1/pos/profiles/`.
3. Installation gap: Fresh installs required manual terminal profile creation before first sale.
4. Schema parity gap: `warehouse_id` missing in `smritisys.cash_registers` (Rule 12 drift).

## 6. Architecture Impact
- **Service Layer**: `POSService` extended with `update_profile` and relaxed branch filtering (`(branch_id == tenant.branch_id) | (branch_id.is_(None))`).
- **Data Model**: `cash_registers` table updated with `warehouse_id` in control database.
- **Onboarding Flow**: Company setup wizard atomically provisions `REG-01` alongside branches and numbering series.

## 7. Proposed Design
- Update `POSProfileCreate` with default field values.
- Implement `PUT /pos/profiles/{profile_id}` and `DELETE /pos/profiles/{profile_id}` in `backend/app/api/v1/pos.py`.
- Inject default terminal creation into `backend/app/api/v1/system.py` inside `company_setup()`.
- Update `backend/app/db/seed_baseline_users.py` to seed `REG-01` and `REG-02`.
- Update `src/components/global/configs/posProfiles.config.tsx` to handle code/notes.

## 8. Files Created
- `docs/implementation/pos/POS_Terminal_Profile_Default_Installation_And_CRUD_Lifecycle_Plan_v6.27.3.md`
- `docs/walkthrough/pos/POS_Terminal_Profile_Default_Installation_And_CRUD_Lifecycle_v6.27.3.md`

## 9. Files Modified
- `backend/app/schemas/pos.py`
- `backend/app/services/pos.py`
- `backend/app/api/v1/pos.py`
- `backend/app/api/v1/system.py`
- `backend/app/db/seed_baseline_users.py`
- `src/components/global/configs/posProfiles.config.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0+
- PostgreSQL 15+ (control DB `smritisys` & company DB `smriti001`)

## 11. Risks
- Duplicate register code integrity collisions: mitigated by `IntegrityError` handling with business-friendly error detail.
- Branch filter hiding company-wide registers: mitigated by allowing `branch_id.is_(None)`.

## 12. Rollback Strategy
- Revert schema defaults and API methods via git.
- Deactivate created cash registers using `is_active = False` or `is_deleted = True`.

## 13. Verification Plan
- Syntax and compilation check with `py_compile`.
- End-to-end Python test script executing full CRUD lifecycle.
- Full frontend Vitest test suite execution.
- TypeScript compiler validation.

## 14. Test Plan
- Unit tests: verify `POSProfileCreate` accepts default payload.
- API tests: verify `POST`, `GET`, `PUT`, `DELETE` on `/api/v1/pos/profiles/`.
- Regression tests: ensure all 132 Vitest suites remain green.

## 15. Documentation Impact
- Update `CHANGELOG.md` under version `6.27.3`.
- Update master index `docs/walkthrough/README.md`.
- Update master index `docs/implementation/README.md`.

## 16. Deployment Plan
- Apply schema alteration on `cash_registers` in `smritisys` if not already present.
- Sync backend Python code to `smriti-api` and restart container.
- Rebuild production Vite bundle and mount into `smriti-web`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-POS-01`: Out-of-the-Box Terminal Availability
- `ADR-POS-02`: Branch Hierarchical Scoping for POS Registers
- `ADR-005`: Canonical Table Convergence & One-Way Projections

## 19. Related Walkthroughs
- `docs/walkthrough/pos/POS_Terminal_Profile_Default_Installation_And_CRUD_Lifecycle_v6.27.3.md`
