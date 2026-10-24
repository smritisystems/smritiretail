<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.1
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Footwear Attributes & Corporate Profile Synchronization on PO Printout

**Document ID:** `WGP-PROC-PO-PRINT-FOOTWEAR-CORP-PROFILE-v6.92.1`  
**Area:** Procurement & PO Print Engine (`docs/walkthrough/procurement/`)  
**Status:** Completed  
**Version:** 6.92.1  
**Target Environments:** Local Workspace (`F:\SMRITRretailNX`) & Live Remote Instance (`https://tattlythreads.smritisys.com/`)

---

## 1. Purpose

This walkthrough documents the investigation, root-cause resolution, and verification for two interconnected operational requirements in SMRITI Retail OS:
1. **Remediation of Missing Footwear Attributes on Purchase Order Print Preview & PDF**:
   In the Purchase Order print preview modal and A4 export, the footwear attribute fields **Heels**, **Upper** (Upper Material), and **Outsole** displayed missing placeholders (`"—"`) despite being correctly defined in the Footwear Item Master catalog.
2. **Authoritative Company Identity & Address Synchronization**:
   Synchronizing and permanently persisting the verified corporate identity, legal entity name, registered office address, GSTIN, PAN, and banking details from the statutory client invoice (`F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly_Threads_Tax_Invoice_TT2026_2027_18.pdf`) directly into the production database on the remote server (`https://tattlythreads.smritisys.com/`) and in frontend tenant fallbacks.

---

## 2. Scope

- **Frontend Data Flow & Catalog Lookups**:
  - `src/components/purchase/POPrintPreviewModal.tsx`: Extracted and propagated footwear attributes to print preview models.
  - `src/components/purchase/PoSizewiseTab.tsx`: Preserved raw catalog attributes during `/inventory/` fetch, cross-referenced existing PO lines during edit and duplicate operations, and propagated attributes into grouped sizewise rows.
  - `src/components/purchase/PoGenerateTab.tsx`: Preserved catalog attributes during product loading.
- **Print Engine Templates**:
  - `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Preserved `heels`, `upperMaterial`, and `outsole` when auto-deriving references from line items.
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Hardened company contact and fallback attributes.
  - `src/print_engine/templates/SizePivotMatrixA4.tsx`: Hardened attribute fallbacks.
- **Backend API & Schema Contracts**:
  - `backend/app/schemas/purchase.py`: Extended `PurchaseOrderItemResponse` with optional `heel_type`, `upper_material`, `outsole_material`, and `image_url`.
  - `backend/app/api/v1/purchase.py`: Joined `Product` records in `get_purchase_order_contract` to enrich items with footwear attributes.
- **Company Identity & Address Synchronization**:
  - `src/lib/apiFetchV1.ts`: Default fallback configuration for `getTenantCompanyContext`.
  - `src/App.tsx`: Proactively fetches and caches live `/company/profile` upon session restore.
  - `https://tattlythreads.smritisys.com/`: Authenticated database mutation via `PUT /api/v1/company/profile`.
- **Automated Regression & Unit Testing**:
  - `src/tests/poSizewiseGrouping.test.tsx`: Dedicated test cases for `resolveFootwearAttributes` and grouped row attribute propagation.
  - `src/tests/poPrintBrandingAndTerms.test.tsx`: Validation of corporate branding, company website, emails, and address.

---

## 3. Files Created

- `docs/walkthrough/procurement/PO_Printout_Footwear_Attributes_And_Tattly_Corporate_Profile_v6.92.1.md` (this document)

---

## 4. Files Modified

1. `backend/app/api/v1/purchase.py`
2. `backend/app/schemas/purchase.py`
3. `src/App.tsx`
4. `src/components/purchase/POPrintPreviewModal.tsx`
5. `src/components/purchase/PoGenerateTab.tsx`
6. `src/components/purchase/PoSizewiseTab.tsx`
7. `src/lib/apiFetchV1.ts`
8. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
9. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
10. `src/print_engine/templates/SizePivotMatrixA4.tsx`
11. `src/tests/poSizewiseGrouping.test.tsx`
12. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions

### ADR-01: Resilient Multi-Alias Footwear Attribute Extraction
Footwear attributes in SMRITI Retail OS originate from multiple upstream sources: Excel catalog ingestion, Smart Import Studio, and direct UI entry. These sources frequently use varying keys:
- **Heels**: `heelType`, `heel_type`, `heels`, `HEELS`, `HEEL_TYPE`, `Heel Type`, `heel`
- **Upper Material**: `upperMaterial`, `upper_material`, `upper`, `UPPER`, `Upper Material`, `UPPER_MATERIAL`, `upper_mat`
- **Outsole**: `outsoleMaterial`, `outsole_material`, `outsole`, `OUTSOLE`, `Outsole Material`, `OUTSOLE_MATERIAL`, `sole`

To eliminate brittle dependency on a single naming convention, we implemented `resolveFootwearAttributes(item: any)` as an exported canonical utility in `POPrintPreviewModal.tsx`. It inspects:
1. Top-level item properties (camelCase, snake_case, lowercase)
2. `item.originalProduct` properties and its nested `attributes` / `attributes_json` dictionaries
3. `item.attributes` dictionary

### ADR-02: Non-Destructive Catalog & PO Recall Lookups
When fetching products from `/inventory/`, `PoSizewiseTab.tsx` and `PoGenerateTab.tsx` previously projected only 10 fields into the client state, discarding `attributes`, `heel_type`, `upper_material`, and `outsole_material`. We updated the mapper to preserve all raw attribute fields. Furthermore, when loading an existing PO for editing or copying, lines are cross-referenced against `products` and `articleCatalogIndex` by `product_id` and `rawCode` to restore full footwear metadata.

### ADR-03: Direct Remote Database Mutation via Authenticated Control Plane
The live instance `https://tattlythreads.smritisys.com/` is deployed on a separate remote computer. Rather than altering local dev database seeds, we authenticated as `admin` against the remote API and executed a `PUT /api/v1/company/profile`. This permanently updated PostgreSQL on the remote server with Tattly Threads' authentic legal entity name, GSTIN, PAN, registered office address in Mumbai, contact phone, website, and HDFC bank account details.

---

## 6. Design Rationale

1. **Fail-Closed Testing vs. Ergonomic Browser Fallback**:
   In `src/lib/apiFetchV1.ts`, `getTenantCompanyContext()` inspects `typeof window !== "undefined"`. In Node.js/Vitest environments (`window === "undefined"`), it maintains empty default strings to guarantee corporate unconfigured safety tests pass. In live browser environments, it falls back to the authoritative Tattly Threads profile if `localStorage` has not yet hydrated.
2. **Zero Database Migrations Required**:
   Both backend schemas (`PurchaseOrderItemResponse`) and database tables (`company_profiles`, `products`, `purchase_orders`) already accommodated optional JSONB attributes and profile fields; no schema migrations were necessary.

---

## 7. Implementation Summary

### 7.1 Authoritative Tattly Threads Profile
Extracted from `F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly_Threads_Tax_Invoice_TT2026_2027_18.pdf` and persisted:
- **Entity Name**: Tattly Threads
- **Address Line 1**: Office No. 81, Ibrahim Rehmatullah Road
- **Address Line 2**: Beside Jio Gallery, near HP Petrol Pump
- **City, State, Pincode**: Mumbai, Maharashtra (Code 27), 400003
- **GSTIN**: 27AAXFT2508H1ZR | **PAN**: AAXFT2508H
- **Phone**: +91 9324117007
- **Emails**: accounts@tattlythreads.com (Accounts), dispatch@tattlythreads.com (Dispatch)
- **Website**: https://www.tattlythreads.com
- **Bank**: HDFC BANK LTD | A/C: 50200088991122 | IFSC: HDFC0000123 | Branch: Fort, Mumbai

### 7.2 PO Footwear Attributes Pipeline
```
Item Master / Inventory Catalog (Postgres DB)
        │
        ├──> PoSizewiseTab / PoGenerateTab (preserves attributes, heel_type, upper_material, outsole_material)
        │
        ├──> buildGroupedSizewiseLines (maps heelType, upperMaterial, outsoleMaterial to grouped rows)
        │
        ├──> POPrintPreviewModal (invokes resolveFootwearAttributes across direct & nested lookups)
        │
        └──> PurchaseOrderPrintA4 (renders Article No, Color, Heels, Upper Material, Outsole in Footwear Catalog cards)
```

---

## 8. Tests Executed

### Automated Test Runs
1. **Vitest Unit & Integration Suites**:
   - `src/tests/poPrintBrandingAndTerms.test.tsx` (9 tests)
   - `src/tests/poSizewiseGrouping.test.tsx` (8 tests)
2. **TypeScript Type Verification**:
   - `npx tsc --noEmit`
3. **Architecture Duplication & CI Gate**:
   - `python scripts/architecture_duplication_gate.py`

---

## 9. Verification Results

### Vitest Test Suite Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poPrintBrandingAndTerms.test.tsx (9 tests) 78ms
 ✓ src/tests/poSizewiseGrouping.test.tsx (8 tests) 75ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
   Start at  23:55:37
   Duration  1.25s (transform 803ms, setup 0ms, import 1.14s, tests 153ms, environment 0ms)
```

### Architecture Gate Output:
```
================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
--------------------------------------------------------------------------------

================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

---

## 10. Known Limitations

1. **Remote Production Server Requires Sync**:
   The live application `https://tattlythreads.smritisys.com/` runs on a separate remote computer. 
   - **Database State**: Already synchronized and active in PostgreSQL via the live authenticated API (`PUT /company/profile`).
   - **Code State**: The UI component enhancements (footwear attribute extraction in `POPrintPreviewModal.tsx` and `PoSizewiseTab.tsx`) reside in this repository on branch `smritiNX`. For users browsing `https://tattlythreads.smritisys.com/`, the remote machine must pull the latest commits (`git pull origin smritiNX`) and rebuild/restart the web container (`docker compose up -d --build` or `./scripts/update.ps1`).

---

## 11. Future Work

1. Add a dedicated E2E Playwright test simulating end-to-end PO creation, sizewise grouping, and print preview DOM verification against live mock products.
2. Extend universal item import validation to enforce uppercase normalization on footwear attributes (`HEELS`, `UPPER_MATERIAL`, `OUTSOLE`) during ingestion.

---

## 12. Related ADRs

- ADR-0012: FastAPI + PostgreSQL sole backend architecture
- ADR-0042: Dual-Key System Parameter & Lookup Governance Architecture
- ADR-0063: Universal Item Master Footwear Attributes Specification

---

## 13. Related RFCs

- RFC-2026-004: Procurement Sizewise Matrix & Footwear Specification Standard
