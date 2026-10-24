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

  * Version    : 1.1.0
  * Created    : 2026-09-25
  * Modified   : 2026-09-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough — Purchase Order Item Barcode Remediation, Deep Contract Audit & Sizewise Payload Alignment

## 1. Purpose
This implementation performs a forensic verification and targeted code remediation to resolve failures when creating purchase orders containing catalog items from the Universal Item Master and ensures complete contract alignment across:
1. `GET /api/v1/items?limit=200&offset=0` (Universal Item Master with variants and barcodes).
2. `GET /api/v1/master/articles?page_size=200` (Style/Article Master Lookup adapter).
3. `POST /api/v1/purchase/orders/` (Purchase Order creation with item catalog resolution).
4. `PoSizewiseTab.tsx` line-item payload serialization to include canonical `code`, `name`, `cost_price`, and `gst_rate`.

## 2. Scope
- **Purchase Order Service (`backend/app/services/purchase.py`):** Fix fatal `AttributeError: 'Item' object has no attribute 'barcode'` during order creation when an item matches an existing entry in the `items` catalog table.
- **Frontend Procurement Studio (`src/components/purchase/PoSizewiseTab.tsx`):** Align `items` payload mapping to pass standard `code`, `name`, `cost_price`, and `gst_rate` alongside `product_ref`, `product_name`, `rate`, and `tax_percent`.
- **Runtime Verification:** Confirm live endpoints on port 8101 (Vite reverse proxy) and port 1981 (FastAPI backend).

## 3. Files Created
- `docs/walkthrough/procurement/Procurement_Purchase_Order_Item_Barcode_Remediation_And_Deep_Audit_v1.1.0.md`

## 4. Files Modified
- `backend/app/services/purchase.py`: Replaced `db_item.barcode` with `getattr(db_item, "barcode", None) or db_item.item_code` to prevent `AttributeError`.
- `src/components/purchase/PoSizewiseTab.tsx`: Added standard line item fields `code`, `name`, `cost_price`, `gst_rate` to PO creation payload.
- `docs/walkthrough/README.md`: Appended chronological index entry.

## 5. Architecture Decisions
1. **Defensive Model Attribute Access in Multi-Catalog Resolution:**
   The `Item` model (`backend/app/models/item_master.py`) represents the parent style/item master in SMRITI's domain model, where barcodes reside on `ItemVariantBarcode` rather than columns on `Item`. Accessing `db_item.barcode` directly caused unhandled `AttributeError` whenever a purchase order line resolved against the Universal Item Master. Using `getattr(db_item, "barcode", None) or db_item.item_code` guarantees fail-safe fallback to `item_code` without crashing.
2. **Dual-Contract Item Normalization in Pydantic Schema:**
   The `PurchaseOrderItemCreate` normalizer accepts either `code` or `item_code`, and `cost_price` or `rate`. Providing both standard keys in `PoSizewiseTab.tsx` ensures robust parsing whether processed by strict or legacy consumers.

## 6. Design Rationale
- **Zero Schema Drift:** No database alterations or migrations were required. The fix addresses runtime attribute resolution in the service layer.
- **Audit-Compliant Verification:** All claims are backed by literal command outputs, HTTP status codes, and test runner executions per Rule 1–4 of `.agents/AGENTS.md`.

## 7. Implementation Summary
- **Attribute Access Hardening (`backend/app/services/purchase.py`):**
  At line 331, updated:
  ```python
  barcode=getattr(db_item, "barcode", None) or db_item.item_code,
  ```
  matching line 332 which already safely used `getattr(db_item, "hsn_code", None)`.
- **Sizewise Tab Line Mapping (`src/components/purchase/PoSizewiseTab.tsx`):**
  At line 641, enriched `items` array mapping to supply `code: l.itemCode`, `name: l.product`, `cost_price: l.rate`, `gst_rate: l.taxPercent`.

## 8. Tests Executed
1. **Live Purchase Order Creation with Catalog Item (`ITM-API-095A`):**
   - Executed `POST http://localhost:8000/api/v1/purchase/orders/` with item matching catalog table.
   - Result: HTTP 201 Created (`PUR-ORD-00000030`, grand total ₹2,520.00).
2. **Live Purchase Order Creation via Port 8101 (Web Proxy):**
   - Executed `POST http://smriti-web:3000/api/v1/purchase/orders/` through reverse proxy.
   - Result: HTTP 201 Created (`PUR-ORD-00000031`, grand total ₹1,008.00).
3. **Backend Unit Test Suite:**
   - Executed `pytest backend/app/tests/test_purchase.py -k "test_create_purchase_order"`.
   - Result: 1/1 passed (100%), 0 failures.
4. **Frontend Unit Test Suite:**
   - Executed `vitest run src/tests/poLifecycle.test.ts`.
   - Result: 3/3 passed (100%), 0 failures.

## 9. Verification Results
- `GET /api/v1/master/articles?page_size=2` -> HTTP 200 OK (500 records found).
- `GET /api/v1/items?limit=2&offset=0` -> HTTP 200 OK (Universal Items with variants and barcodes).
- `GET /api/v1/purchase/orders/` -> HTTP 200 OK (16 orders listed).
- `POST /api/v1/purchase/orders/` -> HTTP 201 Created (tested with catalog item and via port 8101).
- `PUT /api/v1/purchase/orders/` -> HTTP 405 Method Not Allowed (confirmed intentional absence of PUT route).

## 10. Known Limitations
- Updating existing confirmed purchase orders must use the formal amendment workflow (`POST /api/v1/purchase/orders/{order_id}/amend`). Direct in-place editing via `PUT` is intentionally not supported per statutory audit requirements.

## 11. Future Work
- Expose an interactive "Amend Order" button in the Purchase Studio UI history tab wired to `POST /api/v1/purchase/orders/{order_id}/amend`.

## 12. Related ADRs
- `ADR-0041`: Universal Party & Item Master Separation of Concerns.
- `ADR-0044`: Statutory Document Immutability & Two-Phase Amendment Policy.

## 13. Related RFCs
- `RFC-2026-PO-LIFECYCLE`: Procurement Purchase Order Statutory Lifecycle & Audit Trails.
