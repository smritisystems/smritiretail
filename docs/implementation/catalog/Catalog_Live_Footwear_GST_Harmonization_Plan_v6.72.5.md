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

# Implementation Plan: Live Footwear Catalog GST Rate Harmonization to Statutory 5% v6.72.5

## 1. Objective
Harmonize the Goods and Services Tax (GST) rate across all 1,136 live footwear catalog products on `https://tattlythreads.smritisys.com/` to the Indian statutory footwear tax rate of **5.00%** (HSN `64041990` / `64032012`), permanently eliminating legacy 0.00% / EXEMPT rates from historical batch ingestion while strictly preserving non-footwear products (e.g. corporate shirt test SKU `UAT-B2B-001` at 18.00% under HSN `6203`).

## 2. Business Motivation
Under Indian GST statutory governance (CBIC Notification No. 1/2017-Central Tax (Rate) as amended), all footwear with sale value up to ₹1,000 per pair falls strictly under HSN 64 and carries a **5% GST** rate (2.5% CGST + 2.5% SGST, or 5% IGST). Footwear can never be 0% or EXEMPT unless specifically notified by the GST Council.
Historical ingestion Batch 1 (534 items across 38 styles: `CH-01` through `CH-25`, `SND-01` through `SND-19`, `SH-02`, `SH-03`) was populated with `gst_percentage: '0.00'` / `tax_rate: 0.0` during initial database bootstrapping. Conversely, Batch 2 (602 items from `OLD TO NEW (1).xlsx`) was loaded with `5.00%`. This disparity created an inconsistency where identical footwear items displayed `0%` GST in Item Master, causing confusion for store operators and audit risks during statutory billing.

## 3. Scope
- Target Environment: Production server `https://tattlythreads.smritisys.com/` (`COMP-001`).
- Target Entities: All live footwear SKUs (`category in ('Footwear', 'CHAPPAL', 'SANDAL', 'SHOE', 'OTHERS')` or HSN `64041990` / `64032012` or code prefix `CH-`, `SND-`, `SH-`).
- Exclusion: Non-footwear corporate apparel `UAT-B2B-001` (18.00% GST, HSN `6203`).
- API Mutation Mechanism: Canonical `PUT /api/v1/inventory/{id}` with JSON `{"gst_percentage": 5.0}`.
- Concurrency Control: Asynchronous client with Semaphore bounded to 12 workers.

## 4. Current State
- Total live catalog products: 1,137.
- Footwear products with 5.00% GST: 603 (1 tested + 602 from Batch 2).
- Footwear products with 0.00% GST: 533 (Batch 1 items requiring migration).
- Non-footwear products: 1 (`UAT-B2B-001` at 18.00%).

## 5. Gap Analysis
- Gap 1: 533 live footwear products possessed 0.00% GST, violating statutory footwear tax compliance.
- Gap 2: In Item Master Workspace (`ItemDetailsGrid.tsx`), viewing Batch 1 products displayed `0%` GST, creating operational confusion.
- Gap 3: Direct database SQL execution via `/api/v1/database-manager/query` is read-only (SELECT-only security sandbox), requiring authoritative REST API mutations via `PUT /api/v1/inventory/{id}`.

## 6. Architecture Impact
- Reuses canonical `PUT /api/v1/inventory/{product_id}` endpoint which invokes `ProductRepository.update` with `model_dump(exclude_unset=True)`.
- Updates both `products.gst_percentage` and `products.tax_rate` in the company PostgreSQL database.
- Bounded concurrency prevents database pool exhaustion or rate limiting.
- Preserves all variant attributes, MRP, selling price, barcodes, and style links.

## 7. Proposed Design
- Implement an automated async migration script (`scripts/update_live_products_gst.py`):
  1. Authenticate with SMRITI Retail OS as `admin` and obtain JWT bearer token.
  2. Paginate through all 1,137 products via `/api/v1/inventory?page={page}&page_size=100`.
  3. Filter products matching footwear criteria with `current_gst == 0.0` (identifying exactly 533 products).
  4. Dispatch concurrent asynchronous updates using `asyncio.Semaphore(12)` targeting `PUT /api/v1/inventory/{pid}`.
  5. Run an independent post-update full catalog scan verifying 100% distribution parity: `5.00%: 1136 products`, `18.00%: 1 product`, `0.00%: 0 products`.

## 8. Files Created
- `scripts/update_live_products_gst.py` — Automated asynchronous GST harmonization script.
- `docs/walkthrough/catalog/Catalog_Live_Footwear_GST_Harmonization_v6.72.5.md` — Walkthrough documentation.
- `docs/implementation/catalog/Catalog_Live_Footwear_GST_Harmonization_Plan_v6.72.5.md` — This implementation plan.

## 9. Files Modified
- `CHANGELOG.md` — Added release notes for v6.72.5.
- `docs/walkthrough/README.md` — Appended master walkthrough index.
- `docs/implementation/README.md` — Appended master implementation plan index.

## 10. Dependencies
- Python 3.11+, `httpx`, `asyncio`.
- SMRITI Retail OS live production instance (`https://tattlythreads.smritisys.com/`).

## 11. Risks
- Risk: Gateway timeouts or rate limiting during mass API updates.
  - Mitigation: Semaphore limit of 12 concurrent workers with individual request error trapping.
- Risk: Inadvertent update of non-footwear products.
  - Mitigation: Explicit category, HSN, and style prefix filtering; corporate shirt `UAT-B2B-001` excluded.

## 12. Rollback Strategy
- The script logs every updated product ID and code. If rollback is required, an inverse payload `{"gst_percentage": 0.0}` can be dispatched to the same product ID set.

## 13. Verification Plan
- Step 1: Pre-update catalog count and distribution audit.
- Step 2: Live batch execution monitoring with real-time progress counters.
- Step 3: Post-update paginated audit across all 1,137 products.
- Step 4: Verification of 0 products remaining at 0.00% GST.

## 14. Test Plan
- Single-item pilot test on `prod_d61713ecabcd` (`CH-01-A-CREAM-36`) returning HTTP 200 OK.
- Full batch execution across 533 products returning 533 successful updates and 0 failures.
- Post-migration audit confirming `1136 products at 5.00%` and `1 product at 18.00%`.

## 15. Documentation Impact
- CHANGELOG entry for `v6.72.5`.
- Walkthrough in `docs/walkthrough/catalog/`.
- Updated master indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
- Execute `python scripts/update_live_products_gst.py` from repository workspace.
- Validate live API responses.
- Commit and push changes to `origin/smritiNX`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042` — Canonical Multi-Tier Item Master and Inventory Dual-Model Strategy.
- `ADR-0018` — Statutory Indian GST Calculation & HSN Classification Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Catalog_Live_Footwear_GST_Harmonization_v6.72.5.md`
- `docs/walkthrough/catalog/Live_Tattly_Threads_Item_Master_Seeding_v6.72.3.md`
- `docs/walkthrough/barcode/Barcode_Label_Style_Vendor_Code_Separation_v6.72.4.md`
