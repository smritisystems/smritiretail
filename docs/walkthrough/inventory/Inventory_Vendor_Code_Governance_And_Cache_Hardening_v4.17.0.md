<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 4.17.0
  * Created    : 2026-09-12
  * Modified   : 2026-09-12
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Inventory Vendor Code Governance, Automated E2E Testing & Cache Hardening

**Document Version:** 4.17.0  
**Date:** 2026-09-12  
**Status:** Completed  
**Area:** Inventory / Master Data / Architecture  

---

## 1. Purpose
To address and systematically eliminate all four remaining architectural and operational risks identified in the SMRITI Master Data Governance Review:
1. Provide automated API integration and E2E database tests for duplicate Vendor Codes, whitespace/case collisions, and reassignment guards.
2. Formulate and execute a controlled migration and diagnostic audit workflow for legacy Article/Style records with unassigned Vendor Codes.
3. Harden client-side bundle cache invalidation across `index.html` and Vite production bundling to prevent live browser caches from serving stale JavaScript chunks.
4. Establish 100% column/AST parity for `warehouse_locations` with `BaseEntity` audit columns across PostgreSQL migrations.

---

## 2. Scope
- **Backend Models & Migrations:**
  - `backend/alembic/versions/v1431_seed_item_catalog_lookup_types.py` (removed `"product"` from generic lookups).
  - `backend/alembic/versions/v1433_add_warehouse_locations.py` (added `BaseEntity` audit columns).
  - `backend/alembic/versions/v1435_add_warehouse_location_audit_columns.py` (migration adding `created_by`, `updated_by`, `deleted_by`, `version`).
- **Audit & Migration Tools:**
  - `backend/tools/audit_legacy_vendor_codes.py` (diagnostic audit and automated backfill tool for legacy products).
- **Backend Automated Test Suites:**
  - `backend/tests/test_vendor_service.py` (isolated test phone fixtures avoiding foreign key collision).
  - `backend/tests/test_vendor_code_governance_e2e.py` (comprehensive 3-test E2E integration suite).
- **Frontend Governance & Cache Invalidation:**
  - `src/services/itemMasterLookupGate.ts` (removed `"product"` blocker from `GOVERNED_LOOKUP_TYPES`).
  - `index.html` (injected `Cache-Control`, `Pragma`, and `Expires` meta tags).
  - `vite.config.ts` (configured content hash patterns for entry, chunk, and asset files).

---

## 3. Files Created
1. `backend/alembic/versions/v1435_add_warehouse_location_audit_columns.py` — Alembic migration adding `created_by`, `updated_by`, `deleted_by`, `version` to `warehouse_locations`.
2. `backend/tools/audit_legacy_vendor_codes.py` — Diagnostic audit CLI tool supporting dry-run and `--apply` backfill of legacy products.
3. `backend/tests/test_vendor_code_governance_e2e.py` — Pytest integration suite covering collision detection, Article/Style variant matrices, and immutability guards.
4. `docs/walkthrough/inventory/Inventory_Vendor_Code_Governance_And_Cache_Hardening_v4.17.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `backend/alembic/versions/v1431_seed_item_catalog_lookup_types.py` — Removed `("product", "Product")` from `LOOKUP_TYPES`.
2. `backend/alembic/versions/v1433_add_warehouse_locations.py` — Added `BaseEntity` audit columns to table definition.
3. `backend/tests/test_vendor_service.py` — Shifted test phones to dedicated test space (`9920011223`) avoiding collision with database seed data.
4. `src/services/itemMasterLookupGate.ts` — Added UADHP author header, removed `"product"` from `GOVERNED_LOOKUP_TYPES`.
5. `index.html` — Injected HTTP cache-control meta tags.
6. `vite.config.ts` — Added explicit hash patterns to `rollupOptions.output`.
7. `docs/walkthrough/README.md` — Appended walkthrough record to master chronological index.

---

## 5. Architecture Decisions
- **AD-INV-01 (Product vs Lookup Boundary):** Product is the canonical transactional business entity (`Product` / `Item`), NOT a generic lookup option. It is created freely in Item Master Studio without requiring pre-registration in `master_values`. Catalog dimensions (`brand`, `category`, `subcategory`, `style_article`, `size`, `color`, `vendor_code`) remain strictly governed in System Lookups.
- **AD-INV-02 (Vendor Code Immutability & Single Ownership):** Vendor Code is strictly 1:1 with a canonical Vendor legal entity. Once assigned to a product or style variant, it is immutable in standard edit workflows to prevent audit and ledger corruption.
- **AD-INV-03 (3-Layer Browser Cache Shield):** Root `index.html` is strictly served with `no-cache, no-store, must-revalidate`, while chunk assets (`/assets/[name]-[hash].js`) use cryptographic content hashes.

---

## 6. Design Rationale
- Omitting `created_by` / `version` in `v1433` caused SQLAlchemy `BaseEntity` inserts to fail with `UndefinedColumnError`. Migration `v1435` guarantees complete AST parity between database catalogs and ORM models.
- Running fleet migration on `smriti001` brought the tenant catalog from `v1430` up to date (`v1435`), ensuring all tenant databases share the identical schema contract as the control plane (`smritisys`).

---

## 7. Implementation Summary
1. **Remediated `itemMasterLookupGate.ts`:** Removed `"product"` from `GOVERNED_LOOKUP_TYPES`, eliminating the blocker that prevented users from authoring new product names in Item Details Grid.
2. **Built `audit_legacy_vendor_codes.py`:** Discovered 59 legacy products in `smritisys` with unassigned `vendor_code`. Executed controlled backfill assigning `LEGACY-UNASSIGNED` with 0 errors.
3. **Executed Multi-Tenant Fleet Upgrade:** Upgraded `smriti001` and `smritisys` through `migrate_fleet.py` up to `v1435_add_warehouse_location_audit_columns`.
4. **Hardened Bundle Caching:** Updated `index.html` with anti-caching meta tags and updated `vite.config.ts` with explicit chunk hash patterns.
5. **Implemented Automated Test Suite:** Authored `test_vendor_code_governance_e2e.py` verifying vendor collision detection (exact + whitespace/case), variant matrix generation, PostgreSQL constraint enforcement, and immutability rules.

---

## 8. Tests Executed
1. `npm test -- --run src/tests/globalFieldRegistry.test.ts` (Vitest: 8/8 passed).
2. `npm run lint` (`tsc --noEmit`: 0 errors).
3. `pytest backend/tests/test_vendor_service.py backend/tests/test_vendor_code_governance_e2e.py backend/app/tests/t_masters_consol.py` (Pytest: 10/10 passed).
4. `python backend/tools/audit_legacy_vendor_codes.py --company smritisys` (Audit: 0 unassigned products).
5. `npm run build` (Vite production build: 3,529 modules transformed, 0 errors).
6. `git diff --check` (Clean: 0 whitespace errors).

---

## 9. Verification Results
- **Vitest:** 8 passed (445ms).
- **TypeScript:** 0 compiler errors.
- **Pytest:** 10 passed in 47.33s.
- **Vite Build:** 3,529 modules transformed; dist bundle emitted in 29.27s.
- **Parity Check:** 100% column AST parity verified on `warehouse_locations`.

---

## 10. Known Limitations
- `stores` table in `backend/app/models/inventory.py` remains deprecated (retained for backward compatibility). All new physical stores should be authored as `Branch` records with POS counters.

---

## 11. Future Work
- Add partial composite unique index: `CREATE UNIQUE INDEX uq_branches_company_code_active ON branches (company_id, code) WHERE is_deleted = false;` to allow tenant-scoped branch codes while handling soft deletes gracefully.

---

## 12. Related ADRs
- `ADR-FROZEN-001` (Universal Party Single Source of Truth).
- `ADR-FROZEN-002` (Canonical Item Master 5-Tier Architecture).
- `ADR-FROZEN-003` (Universal Global Field Registry).

---

## 13. Related RFCs
- `RFC-2026-INV-001` (Vendor Code Governance & Catalog Protection).
- `RFC-2026-SEC-002` (Multi-Tenant Fleet Migration Protocol).
