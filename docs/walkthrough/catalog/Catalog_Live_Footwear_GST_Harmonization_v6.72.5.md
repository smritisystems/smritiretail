<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.5
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Live Footwear Catalog GST Rate Harmonization to Statutory 5% v6.72.5

## 1. Purpose
This walkthrough documents the full harmonization of the Goods and Services Tax (GST) rate across all 1,136 live footwear catalog products on the production server `https://tattlythreads.smritisys.com/` to the statutory footwear tax rate of **5.00%** (HSN `64041990` / `64032012`), permanently remediating legacy 0.00% / EXEMPT rates resulting from historical batch ingestion.

## 2. Scope
- Target Environment: Production server `https://tattlythreads.smritisys.com/` (`COMP-001`).
- Target Catalog Items: 533 footwear items from Historical Batch 1 (`CH-01` through `CH-25`, `SND-01` through `SND-19`, `SH-02`, `SH-03`) loaded with `0.00%` GST.
- Excluded Items: Corporate apparel test item `UAT-B2B-001` (18.00% GST, HSN `6203`).
- Target Rate: Exactly `5.00%` GST.

## 3. Files Created
- `scripts/update_live_products_gst.py` — Automated asynchronous concurrent batch update script for live production inventory.
- `docs/implementation/catalog/Catalog_Live_Footwear_GST_Harmonization_Plan_v6.72.5.md` — Implementation plan with 19 required IPGP sections.
- `docs/walkthrough/catalog/Catalog_Live_Footwear_GST_Harmonization_v6.72.5.md` — This walkthrough document with 13 required WGP sections.

## 4. Files Modified
- `CHANGELOG.md` — Added release notes under `[6.72.5] — 2026-10-13`.
- `docs/walkthrough/README.md` — Appended entry to the master walkthrough index.
- `docs/implementation/README.md` — Appended entry to the master implementation plan index.

## 5. Architecture Decisions
- **REST API Authoritative Mutation:** Leveraged `PUT /api/v1/inventory/{id}` with JSON `{"gst_percentage": 5.0}` instead of direct SQL mutations, ensuring full validation through `ProductRepository.update` and preserving data consistency.
- **Bounded Asynchronous Concurrency:** Implemented `asyncio.Semaphore(12)` in `scripts/update_live_products_gst.py` to achieve rapid execution (< 30 seconds for 533 updates) without overwhelming PostgreSQL connection pools or HTTP gateway buffers.
- **Selective Domain Filtering:** Guarded update targeting to footwear categories (`Footwear`, `CHAPPAL`, `SANDAL`, `SHOE`, `OTHERS`), HSN codes (`64041990`, `64032012`), or code prefixes (`CH-`, `SND-`, `SH-`), ensuring non-footwear articles remain untouched.

## 6. Design Rationale
In India, footwear under HSN 64 carries a statutory GST rate of 5% for sale prices up to ₹1,000. Under no statutory provision is commercial retail footwear exempt (0% GST). When Batch 1 was initially ingested into the database, the items were bootstrapped with `0.00%` GST, while Batch 2 (ingested via `OLD TO NEW (1).xlsx`) was populated with `5.00%`. Harmonizing all footwear products to 5.00% ensures complete legal and fiscal compliance across all POS billing transactions, tax invoice generation, and Item Master views.

## 7. Implementation Summary
1. **Pilot Update Verification:** Tested `PUT /api/v1/inventory/prod_d61713ecabcd` (`CH-01-A-CREAM-36`) with `{"gst_percentage": 5.0}`, which returned HTTP 200 OK and successfully persisted `gst_percentage = 5.0`.
2. **Batch Script Execution:** Ran `python scripts/update_live_products_gst.py`:
   - Authenticated against `https://tattlythreads.smritisys.com/` as `admin`.
   - Identified all 533 footwear products with `0.00%` GST.
   - Dispatched 533 asynchronous PUT requests across 12 concurrent workers.
   - Recorded 533/533 successful updates and 0 failures.
3. **Comprehensive Post-Migration Verification:** Queried all 1,137 products across all inventory pages:
   - `5.00%` GST: 1,136 products (100% of footwear catalog).
   - `18.00%` GST: 1 product (`UAT-B2B-001`, preserved).
   - `0.00%` GST: 0 products (completely eliminated).

## 8. Tests Executed
- Execution of `python scripts/update_live_products_gst.py`:
  - 533 / 533 requests returned HTTP 200.
  - Concurrency: 12 workers.
  - Duration: ~18 seconds.
- Post-migration audit via `scratch/verify_live_gst.py`:
  - 1,137 total products audited.
  - 0 products at 0.00% GST.
  - 1,136 products at 5.00% GST.
  - 1 product at 18.00% GST.

## 9. Verification Results
```
[1/4] Authenticating with SMRITI Retail OS...
  Authenticated successfully.
[2/4] Fetching all products from inventory...
  Total products fetched: 1137
[3/4] Found 533 footwear products with 0.00% GST requiring update to 5.00%.
  Beginning asynchronous concurrent batch updates (concurrency=12)...
    Progress: 50/533 updated to 5.00% GST...
    Progress: 100/533 updated to 5.00% GST...
    Progress: 150/533 updated to 5.00% GST...
    Progress: 200/533 updated to 5.00% GST...
    Progress: 250/533 updated to 5.00% GST...
    Progress: 300/533 updated to 5.00% GST...
    Progress: 350/533 updated to 5.00% GST...
    Progress: 400/533 updated to 5.00% GST...
    Progress: 450/533 updated to 5.00% GST...
    Progress: 500/533 updated to 5.00% GST...
    Progress: 533/533 updated to 5.00% GST...

[4/4] Verification & Audit Summary:
  Successfully updated: 533
  Failures: 0
  Running post-update verification scan across all inventory...
  Final GST Rate Distribution across 1137 products:
    18.00%: 1 products
    5.00%: 1136 products
```
Verification Status: **Done**.

## 10. Known Limitations
- The script targets `products` (`/api/v1/inventory`). The separate parent `items` lookup table (`/api/v1/universal/items`) currently lacks an item-level PUT endpoint in FastAPI; however, all retail POS billing, label printing, inventory tracking, and Item Master screens pull directly from `products`.

## 11. Future Work
- Add `PUT /api/v1/universal/items/{id}` route to `backend/app/api/v1/universal_master.py` to enable parent item metadata mutations directly from the universal catalog interface.

## 12. Related ADRs
- `ADR-0042` — Canonical Multi-Tier Item Master and Inventory Dual-Model Strategy.
- `ADR-0018` — Statutory Indian GST Calculation & HSN Classification Architecture.

## 13. Related RFCs
- `RFC-2026-07-04` — Universal Catalog and Item Master Convergence.
