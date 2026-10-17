<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Conditional Store Code Visibility & Automatic PSV Account Mapping (Phase 2)

**Version:** 1.0.0  
**Date:** 2026-10-16  
**Area:** Sales & Inventory Projection  
**Status:** Completed  

---

## 1. Purpose
The purpose of this implementation is to provide seamless, error-free store-level visibility for Modern Trade transactions in SMRITI Retail OS without imposing cognitive or operational friction on non-Modern-Trade workflows. Specifically:
1. Dynamically render and mandate Delivery Location / Store Code in the Billing Terminal only when the operative Sales Channel demands store-level tracking (e.g., `MODERN_TRADE`).
2. Automatically and idempotently resolve or create a corresponding Party Stock Visibility (PSV) account from the validated store master (`customer_delivery_locations`), guaranteeing that 0 stock movements or inventory ledger distortions occur during account resolution.

---

## 2. Scope
- **Channels Covered:** `MODERN_TRADE`, `GENERAL_TRADE`, `B2B_WHOLESALE`, `POS_RETAIL`, `ECOMMERCE`.
- **Database Scope:** Alembic migration `v1535_psv_parties_store_uniqueness.py` adding partial unique indexes on `psv_parties` for `(company_id, delivery_location_id)` and `(company_id, host_customer_id, store_code)`.
- **Backend API Scope:**
  - `GET /api/v1/sales/channel-capabilities`: Authoritative capability map with runtime parameter overrides.
  - `POST /api/v1/psv/resolve-store-party`: Idempotent resolution/creation endpoint for store-mapped PSV accounts.
  - Mandatory store location validation in `POST /api/v1/sales/invoices` when channel requires it.
- **Frontend Scope:**
  - `BillingTerm.tsx`: Operational Sales Channel selector in Header Row 1; conditional visibility and mandatory asterisks on Delivery Location and Store Code in Row 3; automatic resolution upon customer/location selection; pre-save settlement validation.
  - Non-destructive state preservation: toggling channels hides fields without wiping previously selected store associations.

---

## 3. Files Created
1. `backend/alembic/versions/v1535_psv_parties_store_uniqueness.py` — Multi-tenant Alembic migration adding partial unique constraints to `psv_parties`.
2. `backend/alembic/versions/v1536_sales_invoice_sales_channel.py` — Multi-tenant Alembic migration persisting `sales_channel` column and index on `sales_invoices`.
3. `backend/app/core/sales_channels.py` — Canonical Sales Channel definitions, default capabilities dictionary, and lookup helpers.
4. `backend/app/tests/test_psv_store_mapping.py` — 15 automated backend tests validating logic, endpoints, service idempotency, tenant boundary checks, zero stock movements, DB unique constraints, and canonical posting persistence.
5. `src/tests/conditionalStoreCodePsv.test.ts` — 6 automated Vitest tests validating frontend channel mapping, mandatory field validation, and non-destructive state preservation.
6. `docs/implementation/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md` — Authoritative 19-section IPGP implementation plan.
7. `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md` — This official WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/psv.py` — Added SQLAlchemy `Index(..., unique=True, postgresql_where=text(...))` definitions to `PSVParty.__table_args__`.
2. `backend/app/models/sales.py` — Added `sales_channel` column to `SalesInvoice` with default `B2B_WHOLESALE`.
3. `backend/app/schemas/canonical_posting.py` — Added `sales_channel` field to `CanonicalPostingContext` and `CanonicalPostingRequest`.
4. `backend/app/schemas/sales.py` — Added `sales_channel` attribute to `SalesInvoiceBase`.
5. `backend/app/schemas/psv.py` — Added `PSVStoreResolutionReq` and `PSVStoreResolutionResp` Pydantic schemas.
6. `backend/app/services/canonical_sales_writer.py` — Wired `sales_channel` persistence in `SalesInvoice` creation and rule snapshots.
7. `backend/app/services/psv_projection.py` — Implemented `PSVProjectionService.resolve_or_create_store_psv_party` with savepoint race condition defense; updated `project_posted_invoice` to delegate to it.
8. `backend/app/api/v1/psv.py` — Mounted `POST /api/v1/psv/resolve-store-party` endpoint.
9. `backend/app/api/v1/sales.py` — Mounted `GET /api/v1/sales/channel-capabilities` endpoint.
10. `backend/app/services/sales.py` — Added sales channel store requirement validation before invoice commit.
11. `src/components/billing/types.ts` — Added `SALES_CHANNELS` constant, `channelRequiresStoreLocation()`, and `salesChannel` / `psvPartyId` to `BillingHeaderState`.
12. `src/components/billing/BillingTerm.tsx` — Wired Sales Channel dropdown, conditional container rendering, automatic PSV resolution, settlement guards, and invoice payload.
13. `backend/app/tests/conftest.py` — Added `sales_channel` column to template database initialization.
14. `docs/implementation/README.md` — Updated master index with implementation plan entry.
15. `docs/walkthrough/README.md` — Appended master index with this walkthrough.

---

## 5. Architecture Decisions
1. **Separation of Operational Channel from Ingress Source:**
   Order ingress (`billingSource` like `DIRECT`, `CUSTOMER_PO`) describes how an order arrived. Sales channel (`sales_channel` like `MODERN_TRADE`, `B2B_WHOLESALE`) describes the commercial and operational distribution channel governing downstream compliance, tracking, and visibility.
2. **PostgreSQL Partial Unique Indexes on PSV Parties:**
   To guarantee single-account resolution without duplicates under high concurrency:
   - `uq_psv_parties_company_deliv_loc` on `(company_id, delivery_location_id) WHERE (delivery_location_id IS NOT NULL)`
   - `uq_psv_parties_company_cust_store` on `(company_id, host_customer_id, store_code) WHERE (host_customer_id IS NOT NULL AND store_code IS NOT NULL)`
3. **Database Savepoints (`session.begin_nested()`) for Race-Condition Resilience:**
   In high-concurrency environments, catching `IntegrityError` in SQLAlchemy async requires an inner transaction savepoint. If two concurrent requests try to insert a party for the same store code simultaneously, the second catches `IntegrityError`, rolls back only the savepoint, and gracefully queries the winner's committed row.
4. **Shadow-Only PSV Projection Invariant:**
   PSV accounts are purely descriptive shadow projections. Resolving or creating a PSV party produces exactly 0 stock movements in the physical `stock_movements` ledger.

---

## 6. Design Rationale
- **Operator Velocity vs Accuracy:** In General Trade or B2B Wholesale, operators should not be forced to select dummy delivery locations or store codes. However, for Modern Trade (e.g. Reliance Retail, Trent, DMart), store codes are critical for dispatch, ASN, and sell-through visibility. Conditional visibility gives the best of both worlds.
- **Non-Destructive UI Switching:** When an operator accidentally selects General Trade and switches back to Modern Trade, the selected store location and store code badge must not be cleared or destroyed. Wrapping only the visual containers with `{isStoreLocationRequired && (...)}` preserves state integrity.

---

## 7. Implementation Summary
- **Database:** Executed Alembic migrations `v1535` and `v1536` on tenant database `smriti001`. Verified live partial unique indexes (`uq_psv_parties_company_deliv_loc`, `uq_psv_parties_company_cust_store`) and column `sales_channel` with index (`ix_sales_invoices_sales_channel`) via PostgreSQL catalogs.
- **Backend Service:** Implemented `PSVProjectionService.resolve_or_create_store_psv_party`. Validates tenant company ID, verifies customer ownership, ensures store status is `ACTIVE` and not deleted, checks existing party by location ID or (customer, store_code), links legacy unlinked parties, and atomically creates new ones if none exists. Wired `CanonicalSalesPostingWriter` to persist `sales_channel` on `SalesInvoice`.
- **Frontend Terminal:** Configured Sales Channel dropdown in `BillingTerm.tsx`. When customer type is `MODERN_TRADE`, the channel auto-selects `MODERN_TRADE`. When channel requires store location, Delivery Location and Store Code are rendered with mandatory indicators and settlement is blocked if missing.

---

## 8. Tests Executed
1. **Backend Integration Tests:** `backend/app/tests/test_psv_store_mapping.py` (15/15 passed):
   - Sales channel capability defaults and resolution.
   - Capability REST endpoint (`/api/v1/sales/channel-capabilities`).
   - New PSV party creation with 0 stock ledger movements.
   - Idempotent repeated resolution returning identical party ID.
   - Historical unlinked PSV party auto-linking.
   - Rejection of inactive or soft-deleted delivery locations.
   - Rejection of customer ownership mismatch.
   - Rejection of cross-tenant company access.
   - HTTP API endpoint (`/api/v1/psv/resolve-store-party`) happy path and validation errors.
   - Database partial unique index rejection of duplicate locations.
   - API resolve store party header tampering rejection.
   - Zero stock movements guarantee during PSV resolution.
   - Canonical sales posting persists operational `sales_channel`.
   - Canonical sales posting defaults `sales_channel` to `B2B_WHOLESALE`.
2. **Frontend Vitest Tests:** `src/tests/conditionalStoreCodePsv.test.ts`
   - Canonical sales channel definitions and labels.
   - `channelRequiresStoreLocation()` mapping for all channels.
   - Pre-save validation blocking Modern Trade invoices without store location.
   - Validation success when store location is supplied.
   - Non-destructive state preservation across channel toggles.
3. **Regression Tests:**
   - `src/tests/psvEngine.test.ts` (5/5 passed).
   - `src/tests/billingCorporateWiring.test.ts` (5/5 passed).
   - `tsc --noEmit` (clean compilation, exit 0).

---

## 9. Verification Results & Visual Evidence

### 9.1 Automated Headless Full-Cycle Playwright Execution
A complete, unattended headless browser full-cycle verification script (`scripts/verify_conditional_store_code_psv_headless.py`) executed all 10 operational and transactional verification steps against Vite (port 3000), FastAPI Docker (port 1981), and PostgreSQL 15 (port 2781):

```text
==========================================================================================
SMRITI RETAIL OS — HEADLESS PLAYWRIGHT FULL-CYCLE VERIFICATION
Phase 2: Conditional Store Code Visibility & Automatic PSV Projection Mapping
==========================================================================================
Frontend URL : http://localhost:3000
Backend API  : http://127.0.0.1:1981
PostgreSQL   : postgresql://postgres:postgres@localhost:2781/smriti001
Output Dir   : F:\SMRITRretailNX\docs\walkthrough\sales\evidence
Artifact Dir : C:\Users\netma\.gemini\antigravity-ide\brain\d3046702-19a3-432b-a17e-17337a4ec8a8\screenshots_sales_channel_psv
------------------------------------------------------------------------------------------
[AUTH OK] Admin token acquired: eyJhbGciOiJIUzI1NiIsInR5c...

[STEP 1] Pre-seeding authenticated local storage on domain...
[STEP 2] Navigating to Billing Terminal (?tab=propos)...

[STEP 3] Verifying initial B2B Wholesale state...
  Sales Channel current value: 'B2B_WHOLESALE'
  ✓ Delivery Location and Store Code containers are hidden for B2B_WHOLESALE.
  -> Synced to Artifacts: 01_initial_b2b_wholesale.png

[STEP 4] Selecting General Trade channel...
  ✓ Delivery Location and Store Code containers remain hidden for GENERAL_TRADE.
  -> Synced to Artifacts: 02_general_trade_hidden.png

[STEP 5] Selecting Modern Trade channel & Customer Reliance Retail...
  ✓ Delivery Location and Store Code containers are now VISIBLE for MODERN_TRADE.
  -> Synced to Artifacts: 03_modern_trade_mandatory_store.png

[STEP 6] Adding line item to cart (SKU-CPO1-31e3cb)...
  ✓ Item successfully committed to cart table (Widget A).

[STEP 7] Negative Test: Attempting settlement with store code unselected...
  ✓ Toast caught: 'Store Location Required'
  -> Synced to Artifacts: 04_settlement_blocked_missing_store.png
  ✓ Settlement blocked with mandatory store location requirement.

[STEP 8] Selecting Store Location 'cdl-c64f6f2fec8a1d4e0a656483' (S4NN/8319)...
  Store Code Display value: 'S4NN/8319'
  ✓ Store code badge updated to S4NN/8319.
  -> Synced to Artifacts: 05_store_selected_psv_resolved.png
  -> Synced to Artifacts: 06_item_added_to_cart.png

[STEP 9] Opening Settlement modal and committing invoice...
  ✓ Toast caught: 'Settlement Complete'
  -> Synced to Artifacts: 07_invoice_settlement_success.png
  ✓ Invoice settlement committed successfully.

[STEP 10] Direct PostgreSQL Transactional Verification on port 2781...
Latest Invoice Record in PostgreSQL:
  Invoice No           : INV/CR/0001
  Sales Channel        : MODERN_TRADE
  Delivery Location ID : cdl-c64f6f2fec8a1d4e0a656483
  Delivery Store Code  : S4NN/8319
  Grand Total (₹)      : 56.24
  Customer Name        : Reliance Retail Limited

Linked PSV Party in PostgreSQL:
  Party ID             : psv-COMP-001-cdl-c64f6f2fec8a1d4e0a656483
  Company ID           : COMP-001
  Host Customer ID     : cust-rrl-192b561d
  Delivery Location ID : cdl-c64f6f2fec8a1d4e0a656483
  Store Code           : S4NN/8319
  Party Name           : Reliance Retail Limited
  Stock Model          : OUTRIGHT_SALE
  Status               : Healthy

==========================================================================================
ALL 10 VERIFICATION STEPS PASSED WITH 100% SUCCESS — EVIDENCE GENERATED!
==========================================================================================
```

### 9.2 Generated Verification Screenshot Artifacts

| Step | Evidence File | Description |
|---|---|---|
| Step 3 | [01_initial_b2b_wholesale.png](evidence/01_initial_b2b_wholesale.png) | Billing Terminal with default channel `B2B_WHOLESALE`; Store Code and Delivery Location containers hidden. |
| Step 4 | [02_general_trade_hidden.png](evidence/02_general_trade_hidden.png) | Channel changed to `GENERAL_TRADE`; store code containers verified as hidden. |
| Step 5 | [03_modern_trade_mandatory_store.png](evidence/03_modern_trade_mandatory_store.png) | Channel switched to `MODERN_TRADE` with Reliance Retail (`RRL-001`); store code containers dynamically displayed with red required asterisks. |
| Step 7 | [04_settlement_blocked_missing_store.png](evidence/04_settlement_blocked_missing_store.png) | Negative test: Settlement blocked with toast banner *"Store Location Required"* when store selection is omitted. |
| Step 8 | [05_store_selected_psv_resolved.png](evidence/05_store_selected_psv_resolved.png) | Store location `cdl-c64f6f2fec8a1d4e0a656483` selected; store code badge `S4NN/8319` and PSV account automatically resolved. |
| Step 8 | [06_item_added_to_cart.png](evidence/06_item_added_to_cart.png) | Cart populated with line item (Widget A) ready for settlement. |
| Step 9 | [07_invoice_settlement_success.png](evidence/07_invoice_settlement_success.png) | Invoice committed and saved; *"Settlement Complete"* confirmation. |

---

## 10. Known Limitations
- If a customer delivery location is modified externally (e.g. store code changed in master), existing PSV party display name is not automatically retroactively renamed to preserve historical audit trail consistency. A separate master-sync utility can be run if renaming is desired.

---

## 11. Future Work
- Add batch automated PSV account provisioning from bulk customer store Excel/EDI imports.
- Extend SMRITI System Parameters UI with a dedicated toggle for per-channel capability overrides.

---

## 12. Related ADRs
- `docs/adr/ADR-0089_PSV_Party_Stock_Visibility_Architecture.md`
- `docs/adr/ADR-0094_Customer_Delivery_Location_Canonical_Store_Master.md`

---

## 13. Related RFCs
- `docs/rfc/RFC-0042_Modern_Trade_Store_Level_Fulfillment_And_PSV.md`
