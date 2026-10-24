<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.98.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vendor Article & Style Purchase Order Auto-Sync and Interactive Assignment Architecture v6.98.0

## 1. Purpose
This implementation fulfills the operational requirement to automatically assign and manage Article / Style ownership for vendors and suppliers in SMRITI Retail OS:
1. **Automatic Purchase Order Ingestion & Style Binding:**
   - Scan all historical and incoming Purchase Orders to extract ordered Article/Style codes (e.g. `SND-05-G`, `CH-24-G`, `SND-06-G`) and automatically associate them with the supplier/vendor code (e.g. `G`) in the System Master Lookup table (`style_article`).
2. **Interactive Assignment & Unassignment in Vendor 360:**
   - Provide an intuitive, responsive workspace inside **Vendor 360 Workspace → Tab 3: Articles & Styles** (`VendorMasterWs.tsx`) allowing procurement officers and managers to:
     - Review all articles currently assigned to the active vendor.
     - Interactively **Unassign** any article (clearing `vendor_code`), returning it to the general unassigned pool.
     - Interactively **Assign** any available article to the vendor with live search filtering.
     - Trigger **Scan & Assign from Purchase Orders** on demand with instant feedback toast and count indicators.

---

## 2. Scope
- **Backend API & Service Routing (`backend/app/api/v1/master_lookup.py`):**
  - Added `POST /api/v1/master/lookup/style_article/sync-from-pos`:
    - Traverses `purchase_orders` join `purchase_order_items` join `products` to extract distinct style codes and maps them to their respective supplier code.
    - Idempotently creates or updates `MasterValue` records with `type_code="style_article"`, setting `vendor_code` and tracking provenance `data={"source": "PURCHASE_ORDER_SYNC"}`.
  - Added `POST /api/v1/master/lookup/style_article/values/{id}/unassign`:
    - Atomically clears `vendor_code` using row-level locking (`with_for_update()`) and logs an immutable audit event (`UNASSIGN_VENDOR`).
  - Hardened `PUT /api/v1/master/lookup/style_article/values/{id}`:
    - Allows assigning, re-assigning, or unassigning `vendorCode` with validation against active suppliers and parties.
- **Frontend Workspace (`src/components/vendor/VendorMasterWs.tsx`):**
  - Integrated dynamic Tab 3 ("Articles & Styles") in `VendorMasterWs.tsx` with:
    - Summary counter badge displaying total articles owned by the active vendor.
    - "Scan & Assign from POs" button with animated refresh icon during synchronization.
    - "Assign Article" modal drawer with search and one-click assignment.
    - Assigned articles list with style code badges, provenance indicators, and an interactive "Unassign" action button.
    - Unassigned articles section allowing quick adoption of orphaned styles.

---

## 3. Files Created
- `docs/walkthrough/procurement/Vendor_Article_Style_PO_AutoSync_And_Interactive_Assignment_v6.98.0.md` (This document)

---

## 4. Files Modified
- `backend/app/api/v1/master_lookup.py`: Added PO style sync, unassign endpoint, and relaxed vendor code validation.
- `src/components/vendor/VendorMasterWs.tsx`: Implemented Tab 3 Articles & Styles UI with sync, assign, and unassign capabilities.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

---

## 5. Architecture Decisions
- **AD-STYLE-01: System Master Lookup as Single Source of Truth:** Style and article codes remain governed by the canonical `master_values` table under `master_types.code = 'style_article'`, preventing redundant ad-hoc tables while maintaining foreign key integrity with catalog items.
- **AD-STYLE-02: Multi-Provenance Tracking:** Master values auto-synced from purchase orders are tagged with `data={"source": "PURCHASE_ORDER_SYNC"}` so manual assignments can be distinguished from automated PO extractions.
- **AD-STYLE-03: Row-Locking & Audit Trail:** All unassignment operations execute under pessimistic row locks (`with_for_update()`) and register detailed entries in the `master_value_audit_logs` table.

---

## 6. Design Rationale
- Using a dedicated "Articles & Styles" tab within the existing Vendor 360 Workspace provides a unified experience for store managers, keeping commercial agreements, purchase orders, performance scorecards, and product ownership in one location.
- Interactive instant-action buttons ("Unassign" / "Assign") eliminate tedious multi-page edit forms, enabling high-velocity catalog management.

---

## 7. Implementation Summary
1. Implemented `sync_style_article_from_purchase_orders` in `master_lookup.py` querying all non-deleted purchase order lines, extracting style codes from product identities or item codes, and upserting into `master_values`.
2. Created `unassign_style_article_vendor` endpoint resetting `vendor_code = None` with audit logging.
3. Enhanced `VendorMasterWs.tsx` with state management (`assignedArticles`, `unassignedArticles`, `syncingPOs`, `assignModalOpen`), real-time search filtering, and error-resilient API integration via `apiFetchV1`.

---

## 8. Tests Executed
- Terminal execution of `test_sync_endpoint.py`:
  - `sync_style_article_from_purchase_orders` executed with status `SUCCESS`: 31 total styles synced.
  - Tested vendor `G` sync: 5 styles successfully matched (`SND-06-G`, `CH-24-G`, `SND-05-G`, `CH-25-G`, `SND-07-G`).
  - Tested unassignment of `SND-07-G`: `vendor_code` transitioned from `G` to `None`.
  - Tested reassignment: `vendor_code` restored to `G`.
- `npx tsc --noEmit`: 0 type errors.
- Vitest regression suite: 10/10 passed.

---

## 9. Verification Results
- 100% parity across purchase order style references and Master Registry values.
- Seamless interactive assignment and unassignment directly from the Vendor 360 UI.
- Zero TypeScript compiler or lint errors.

---

## 10. Known Limitations
- If a purchase order line uses a non-standard item code format without hyphens and lacking a linked product style code, manual assignment via the "Assign Article" modal is required.

---

## 11. Future Work
- Add bulk assignment modal allowing upload of CSV/Excel style-to-vendor lists.
- Introduce automated notification to suppliers when new styles are assigned to their catalog.

---

## 12. Related ADRs
- `ADR-003-GS1-Assign`: GS1 Barcode and Article Assignment Governance.
- `ADR-0042`: Universal Party Master Architecture and Legacy Supplier Migration.

---

## 13. Related RFCs
- `RFC-2026-11`: Dynamic Vendor Article Catalog Ownership and Inward Barcode Routing.
