<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.7
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Final Item Master Remediation Plan Challenge & Forensic Validation Report

**Document ID:** SMRITI-IM-CHALLENGE-v6.70.7  
**Classification:** Internal Architectural & Forensic Challenge Report  
**Target Subject:** Validation of `SMRITI_ITEM_MASTER_FINAL_REMEDIATION_PLAN_v6.70.7.md`  
**Database System of Record:** PostgreSQL 15.18 (`smriti001` on port 2781)  
**Execution Timestamp:** 2026-10-05T20:10:00+05:30  
**Audit Policy:** Zero code changes, zero schema changes, zero migrations, zero data modifications, read-only SELECT inspection only.

---

## 1. Re-Verified Current Database Baseline

A fresh, independent recalculation of the live PostgreSQL database (`smriti001` on port 2781) was conducted via direct psycopg2 connection.

### Current Table Row Counts
```text
Table Name                 Exact Current Count
----------------------------------------------
items                      : 2,755
item_variants              : 3,450
item_barcodes              : 3,325
products                   : 2,374
sales_invoice_items        : 16,361
purchase_order_items       : 63
purchase_receipt_items     : 77
sales_return_items         : 14
stock_movements            : 9,098
item_prices                : 21
price_book_entries         : 3,726
item_sales_settings        : 3,412
item_uom_settings          : 21
item_tax_profiles          : 21
```

### Environment & Governance Baseline
- **Database System:** PostgreSQL 15.18 on port 2781 (`smriti001`)
- **Alembic Database Version (`alembic_version` table):** `v1522_item_master_phase11_tracking_mode_harmonization`
- **Git Current Branch:** `smritiNX`
- **Git Status Summary:**
  - `M backend/app/logs/canonical_resolution_telemetry.jsonl` (4 runtime telemetry lines appended by automated test execution)
  - `?? SMRITI_ITEM_MASTER_FINAL_REMEDIATION_PLAN_v6.70.7.md` (Uncommitted plan from prior step)
  - `?? SMRITI_ITEM_MASTER_REMEDIATION_CHALLENGE_v6.70.7.md` (This challenge report)
  - **Zero application source code files modified.**
  - **Zero database migrations or schema alterations executed.**
  - **Zero data records inserted, updated, or deleted.**

---

## 2. Synthetic Barcode Challenge & Forensic Audit

Recalculation of synthetic barcode patterns (`^S[0-9A-F]{12}$`) in `item_barcodes`:

### Exact Metric Breakdown
- **A. Total Synthetic Barcodes:** `542`
- **B. Active Synthetic Barcodes:** `542` (100% currently active)
- **C. Inactive Synthetic Barcodes:** `0`
- **D. Synthetic Barcodes With `variant_id`:** `433`
- **E. Synthetic Barcodes Without `variant_id` (`variant_id IS NULL`):** `109`
  *(Note: The previously cited 157 figure represents ALL barcodes with `variant_id IS NULL`, which includes 109 synthetic barcodes and 48 non-synthetic test barcodes like `BAR-INC-...`)*.

### Transactional Dependency Audit
Every transaction table with a barcode or item code column was queried against the 542 synthetic barcodes:
- `sales_invoice_items.code`: **0 matches**
- `stock_movements.sku`: **0 matches**
- `purchase_receipt_items.code`: **0 matches**
- `purchase_order_items.code`: **0 matches**
- `sales_return_items.code`: **0 matches**
- `sales_invoice_lines.barcode`: **0 matches**
- `print_histories.barcode`: **0 matches**
- `stock_count_lines.barcode`: **0 matches**
- `goods_receipt_lines.barcode`: **0 matches**
- `sales_order_reservations.barcode`: **0 matches**
- `customer_article_mappings.barcode`: **0 matches**

**Critical Discovery:** Exactly 135 legacy `products` records have `products.barcode` matching these synthetic barcodes. However, a forensic join against sales, receipts, and stock movements confirms that **these 135 products have 0 transactions**. They represent draft matrix generation fixtures.

### Deterministic Linkage Analysis (for the 109 unlinked synthetic barcodes)
- **Items with exactly 1 active variant:** `83 barcodes`. These are 100% deterministic (1 item = 1 variant).
- **Items with 2 active variants:** `26 barcodes`. These are structurally ambiguous.

### Forensic Barcode Classification Matrix
| Classification | Count | Rationale | Planned Action |
| :--- | :--- | :--- | :--- |
| **SAFE_QUARANTINE** | 433 | Already linked to variants; 0 transaction references; violates Rule 12. | Set `is_active = FALSE, is_primary = FALSE, notes = 'QUARANTINE_SYNTHETIC'`. |
| **SAFE_AFTER_LINKAGE** | 83 | Belong to single-variant items with 0 transactions. | Link `variant_id = v.id`, then deactivate and quarantine to preserve physical audit trail. |
| **MANUAL_REVIEW** | 26 | Belong to multi-variant items (2 variants each); impossible to know which variant without merchant tag verification. | Retain unlinked in quarantine; route to merchant review. |
| **DO_NOT_TOUCH** | 0 | Zero operational transactions reference synthetic barcodes. | None. |

---

## 3. GRN / Purchase Identity & Exception Swallowing Challenge

A comprehensive trace of the inbound procurement flow across `purchase.py`, `schemas/purchase.py`, and `inventory_wms.py` was conducted.

### Pipeline Identity Trace: PO → Purchase Receipt → Stock Movement
1. **Purchase Order Creation (`PurchaseService.create_purchase_order`):**
   - Receives: `PurchaseOrderItemCreate(product_id, item_id, code, name, quantity, cost_price, gst_rate)`.
   - `variant_id` is **NOT** present in `PurchaseOrderItemCreate`.
   - `PurchaseOrderItem` entity is persisted with `product_id` and `item_id`, but `variant_id` is **omitted**.
2. **Purchase Receipt / GRN Inward (`PurchaseService.create_purchase_receipt`):**
   - Receives: `PurchaseReceiptItemCreate(product_id, item_id, code, name, batch_no, batch_id, warehouse_location_id, quantity_received, cost_price)`.
   - `variant_id` is **NOT** present in `PurchaseReceiptItemCreate`.
   - Line 756: `PurchaseReceiptItem` is instantiated with `product_id` and `item_id`, but `variant_id` is **omitted**.
3. **Inward Stock Mutation (`InventoryWMSService.atomic_mutate_batch_stock`):**
   - Called from `purchase.py` line 906 with `product_id`, `batch_no`, `batch_id`, and `location_id`.
   - `variant_id` is **NOT** passed into `atomic_mutate_batch_stock`.
   - Line 254: `StockMovement` audit record is instantiated with `product_id=product_id, sku=product.sku or product.code, batch_id=batch_id, location_id=location_id`.
   - `StockMovement.variant_id` is **omitted**, leaving inward ledger movements untied to Item Variants!

### Complete Audit of Exception Handling in Inbound Receiving
| File & Line | Code Snippet | Classification | Forensic Impact & Architectural Risk |
| :--- | :--- | :--- | :--- |
| `purchase.py:737-738` | `except Exception: pass` around `ItemTrackingService.resolve_or_create_batch` | **DANGEROUS** | If batch resolution fails (e.g. unique collision, DB lock, validation error), exception is swallowed silently, leaving `effective_batch_id = None`. Receipt item is written without batch link, causing silent tracking loss! |
| `purchase.py:753-754` | `except Exception: pass` around `ItemTrackingService.resolve_or_create_warehouse_location` | **DANGEROUS** | If warehouse location resolution fails, exception is swallowed silently, leaving `effective_loc_id = None`. Inward receipt is written without bin location! |
| `purchase.py:637-641` | `except ValueError: raise HTTPException(409, detail="Duplicate GRN")` | **SAFE / INTENTIONAL** | Properly traps duplicate challan submissions and returns 409 Conflict. |
| `purchase.py:975-979` | `except IntegrityError: await self.db.rollback(); raise HTTPException(409)` | **SAFE / INTENTIONAL** | Properly traps receipt number collision, rolls back transaction, and returns 409. |
| `purchase.py:1153-1154`| `except (ValueError, TypeError): pass` | **INTENTIONAL** | Safely skips reorder threshold parsing when threshold is not numeric. |
| `purchase.py:1623-1627`| `except Exception: await self.db.rollback(); raise HTTPException(400)` | **SAFE / INTENTIONAL** | Rolls back transaction on amendment failure. |

**Challenge Finding:** The proposed remediation in ADR-004 to remove lines 737–738 and 753–754 and replace them with transactional fail-fast handling is **100% VALIDATED AND URGENT**.

---

## 4. Historical Transaction Reconciliation Challenge

Independent recalculation of records with `variant_id IS NULL` across all 5 transaction tables:

```text
Table Name                 Current NULL variant_id    Previous Report    Variance Reason
-----------------------------------------------------------------------------------------------------------
sales_invoice_items        : 1,119                    1,118              +1 (Created by Phase 12 test suite)
stock_movements            : 39                       38                 +1 (Created by Phase 12 test suite)
purchase_order_items       : 62                       62                  0 (Unchanged)
purchase_receipt_items     : 19                       18                 +1 (Created by Phase 12 test suite)
sales_return_items         : 14                       13                 +1 (Created by Phase 12 test suite)
```
*(Exact match confirmed: the variance of +1 in 4 tables was caused by automated test execution during the Phase 12 certification run).*

### Granular Forensic Evidence Classification
Every single NULL variant record was classified based strictly on deterministic criteria:

#### 1. `sales_invoice_items` (1,119 rows)
- **NOT_APPLICABLE (150 rows):** `product_id IS NULL`. These represent non-inventory service lines, delivery fees, and miscellaneous charges. They legitimately have no variant.
- **DETERMINISTIC (954 rows):** `sii.product_id = p.id` where `p.variant_id IS NOT NULL`. The legacy product points directly to an authoritative Item Variant. Safe to backfill with 100% certainty.
- **AMBIGUOUS (14 rows):** `sii.product_id = p.id` where `p.variant_id IS NULL`, but parent item has 2 or more variants. Choosing a variant would be pure fabrication.
- **ORPHANED / NO VARIANTS (1 row):** Item exists but has 0 variants in `item_variants`.

#### 2. `stock_movements` (39 rows)
- **NOT_APPLICABLE (5 rows):** `product_id IS NULL`.
- **AMBIGUOUS (33 rows):** All 33 rows point to items with multiple variants (e.g. `ITM-API-095A` has 5 variants: S-BLUE, S-RED, M-BLUE, M-RED, STD). The movement log contains no size/color identifier. **Must be routed to `MANUAL_REVIEW`. Never backfill.**
- **ORPHANED / NO VARIANTS (1 row):** Item has 0 variants.

#### 3. `purchase_order_items` (62 rows)
- **DETERMINISTIC (43 rows):** 6 rows via `products.variant_id`; 37 rows where parent item has exactly 1 active variant.
- **AMBIGUOUS (19 rows):** Parent item has multiple variants. Routed to `MANUAL_REVIEW`.

#### 4. `purchase_receipt_items` (19 rows)
- **NOT_APPLICABLE (5 rows):** `product_id IS NULL`.
- **AMBIGUOUS (13 rows):** Multi-variant items.
- **ORPHANED PRODUCT (1 row):** Product ID does not exist in master table.

#### 5. `sales_return_items` (14 rows)
- **NOT_APPLICABLE (4 rows):** `product_id IS NULL`.
- **DETERMINISTIC (5 rows):** Linked via `products.variant_id`.
- **AMBIGUOUS (5 rows):** Multi-variant items.

---

## 5. HSN 0000 Challenge & Tax Compliance Audit

### Forensic Investigation into Origin of `'0000'`
1. `'0000'` does **NOT** exist in statutory tariff schedules (statutory Indian GST chapters range from 01 to 99).
2. Table `hsn_sac_codes` does not exist in the database; HSN is stored directly as strings.
3. Transaction tables (`sales_invoice_items`, `sales_order_items`, `sales_invoice_lines`, `goods_receipt_lines`) contain **ZERO records with `hsn_code = '0000'`**.
4. Origin: In legacy retail ERPs (e.g. Shoper 9, Tally POS), `'0000'` was used as a dummy placeholder by data entry operators to bypass mandatory HSN fields for items where tariff classification was unknown.

### Active Variants HSN 5-Tier Breakdown
Across all 3,434 active variants in `item_variants`:
1. **Own Valid HSN:** `484 variants` (Variant carries its own explicit, valid HSN).
2. **Inherited Valid Parent HSN:** `1,927 variants` (Variant has NULL/empty HSN, but parent `Item` carries a valid HSN).
3. **Own `'0000'` HSN:** `0 variants` (Zero variants define their own `'0000'`).
4. **Parent `'0000'` HSN:** `676 variants` (Parent `Item` has `'0000'`, which variants inherit).
5. **Completely Missing HSN:** `345 variants` (Both variant and parent have NULL/empty HSN).

### Can `'0000'` Safely Be Converted to NULL?
**Answer: ONLY AFTER BUSINESS REVIEW.**
- **Technical Risk:** Submitting `'0000'` to NIC E-Way Bill or E-Invoice APIs causes immediate schema rejection (`Invalid HSN format`).
- **Operational Risk:** If all 676 parent items with `'0000'` are immediately converted to `NULL` via SQL update, the Item Readiness Engine will instantly transition 676 active variants to `INCOMPLETE` (`missing HSN code`), which will block B2C retail POS checkout if readiness gating is applied universally.
- **Approved Strategy:** 
  1. Immediately reject `'0000'` at the E-Invoice / E-Way Bill export gateway with a clear validation error.
  2. For retail POS, allow checkout under B2C exemption thresholds if turnover permits.
  3. Provide an interactive bulk-update tool for the merchant to replace `'0000'` with statutory tariff codes before converting untransacted rows to NULL.

---

## 6. UOM Challenge & Candidate Validation

A deep forensic inspection was performed on the candidates proposed for automated UOM assignment in ADR-005.

### Forensic Discovery on Candidates
```text
Candidate Group         Proposed Action    Audit Verification Result
-----------------------------------------------------------------------------------------------------------
20 Footwear Items       Assign 'PRS'       REJECT BLIND ASSIGNMENT. 19 of the 20 items are automated test
                                           fixtures ('Return Test Item', 'GRN Test Item', 'Movement Test Item')
                                           with 0 variants! Only 1 item ('CH-28') is a real footwear item.
21 Apparel Items        Assign 'PCS'       REJECT BLIND ASSIGNMENT. All 21 items are automated test fixtures
                                           ('Formal Linen Shirt 106CB7', 'STYLE-TEST-...') created by test runners.
54 TEST Items           Quarantine         VALIDATED. Confirmed test artifacts.
433 Unknown Items       MANUAL_REVIEW      VALIDATED.
```

### Classification of Proposed Assignments
- **Footwear -> PRS:** **AMBIGUOUS / LIKELY** (True for `CH-28`, but 19 items are test fixtures that must not be backfilled as merchant inventory).
- **Apparel -> PCS:** **AMBIGUOUS** (All 21 candidates are ephemeral test fixtures).

**Challenge Conclusion:** **ADR-005 MUST BE REWORKED.** Automated SQL assignment of `PRS` and `PCS` based on `category ILIKE '%footwear%'` or `'%apparel%'` would update test fixtures rather than commercial goods. The 40 test items must be archived/quarantined as `TEST_FIXTURES`, and real merchant catalog items must be routed to `MANUAL_REVIEW`.

---

## 7. Zero Price Book Challenge & Risk Analysis

Recalculation of all active `price_book_entries WHERE selling_price <= 0`:
- **Total Zero SP Entries:** `420` (419 active, 1 inactive).
- **Entries in Test Tenant Companies:** `203 entries` belong to ephemeral test tenants (`COMP_TX_...`, `TENANT_A_...`, `comp-foreign-...`).
- **Entries in `COMP-001` (Main Tenant):** `217 entries`.
- **MRP > 0 with SP <= 0:** `1 entry` (`itm_...` has valid MRP, but SP was left ₹0.00).
- **Both MRP <= 0 and SP <= 0:** `419 entries`.

### Is "Deactivate All 414" Justified?
**Answer: REWORK TO SCOPED DEACTIVATION.**
- Deactivating entries in ephemeral test tenants (`COMP_TX_...`) risks breaking automated regression test suites that expect active fixture items in those test companies.
- In `COMP-001`, deactivating the 216 entries where both MRP and SP are ₹0.00 is **SAFE AND REQUIRED** to prevent accidental checkout of ₹0 goods.
- The 1 entry where MRP > 0 but SP <= 0 must be routed to `MANUAL_REVIEW`.

---

## 8. SKU Architecture Challenge (ADR-001 Critique)

### Deep Technical Critique of Proposed Option C (Generated Column)
The remediation plan proposed:
```sql
ALTER TABLE item_variants ADD COLUMN sku VARCHAR(100) GENERATED ALWAYS AS (variant_sku) STORED;
```
**CRITICAL FLAW DISCOVERED IN OPTION C:**
In PostgreSQL (v12+):
1. A column created with `GENERATED ALWAYS` is strictly read-only.
2. If any application code, SQLAlchemy ORM writer, bulk importer, or API service executes an `INSERT` or `UPDATE` that includes column `sku`, PostgreSQL immediately throws:
   `ERROR: cannot insert into column "sku" DETAIL: Column "sku" is a generated column.`
3. In SQLAlchemy, mapping `sku = Column(String(100))` on `ItemVariant` causes SQLAlchemy to automatically include `sku` in its INSERT statements, which **WILL CRASH ALL VARIANT CREATION**.
4. Over 350 direct SQL statements, scripts, migrations, and reports reference `variant_sku`.

### Evaluation of Options
| Option | Strategy | Technical Feasibility | ORM Write Safety | Migration Complexity | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A** | Rename physical `variant_sku` → `sku` | Valid DDL | Safe | Extreme (Breaks 350+ unmigrated queries) | **HIGH** |
| **Option B** | Keep physical `variant_sku`, map canonical attribute `sku = Column("variant_sku", ...)` in ORM | **100% Supported** | **100% Safe** | **Low (Zero DDL changes required)** | **LOW (RECOMMENDED)** |
| **Option C** | Generated stored column `sku` | Infeasible | **CRITICAL FAILURE (Crashes on ORM INSERT)** | High | **UNACCEPTABLE** |
| **Option D** | Physical column `sku` with bidirectional sync trigger | Supported | Safe | Medium (Trigger overhead, double storage) | **MEDIUM** |

### Definitive Recommendation
**ADR-001 MUST BE REWORKED TO OPTION B.**
Map the SQLAlchemy model attribute `sku` directly to physical database column `"variant_sku"`:
```python
class ItemVariant(Base):
    __tablename__ = "item_variants"
    
    # Physical column in PostgreSQL is 'variant_sku'
    sku = Column("variant_sku", String(100), nullable=False, index=True)
    
    # Backwards-compatible alias property for legacy code
    @property
    def variant_sku(self) -> str:
        return self.sku
```
This guarantees that Python code, Pydantic schemas, and API payloads use canonical `sku` everywhere, while physical storage remains on `variant_sku` without requiring risky schema rewrites or breaking 350+ queries.

---

## 9. Color / Size Master Lookup Challenge

### Audit of `/universal/masters/color` and `/universal/masters/size`
- Lines 1344 and 1377 of `master_lookup.py` query `Item.color` and `Item.size`.
- Both columns were cleared to NULL in Phase 10, resulting in empty autocomplete dropdowns in the UI.
- Furthermore, the existing queries **fail to filter by `company_id`**, leaking global values across tenants.

### Verification of Proposed Fix
Simply changing the query to `ItemVariant.color` and `ItemVariant.size` is **VALIDATED**, provided the following 4 conditions are met:
1. Filter by `ItemVariant.company_id == tenant.company_id`.
2. Filter by `ItemVariant.is_active == True` and `ItemVariant.is_deleted == False`.
3. Filter out NULL and empty strings (`ItemVariant.color.isnot(None), ItemVariant.color != ""`).
4. Project response in the exact expected dictionary format:
   `{"code": c.upper(), "name": c, "shade": c, "hex": "#808080", "group": "Standard", "status": "Active"}`.
This preserves 100% backward compatibility with existing frontend autocomplete widgets.

---

## 10. Tenant Isolation Challenge

Search across `backend/app/services/` identified 48 occurrences of `company_id.is_(None)`:
- **System Parameters (`SystemParameter.company_id.is_(None)`):** **REQUIRED / INTENTIONAL** (Global system defaults shareable across tenants).
- **Master Lookup Values (`MasterValue.company_id.is_(None)`):** **INTENTIONAL** (Global reference values).
- **Tracking Services (`ItemBatch`, `ItemSerial`, `ItemWarehouseLocation`):** **DEAD CODE & SECURITY RISK.**
  - All 3 tracking tables physically enforce `company_id NOT NULL` and have 0 NULL rows in PostgreSQL.
  - Queries using `or_(company_id == ..., company_id.is_(None))` must be purged and replaced with strict `company_id == tenant.company_id`.
- **Unique Constraints:** Current constraints omit `company_id`. They must be updated in a future migration to:
  - `item_batches`: `UNIQUE (company_id, item_id, batch_number)`
  - `item_serials`: `UNIQUE (company_id, item_id, serial_number)`
  - `item_warehouse_locations`: `UNIQUE (company_id, item_id, warehouse_id)`

---

## 11. Tracking Identity Architecture Challenge

Forensic inspection of live tracking data:
- `item_batches`: 57 rows (100% have `item_id`; 68.4% have `variant_id`).
- `item_serials`: 53 rows (100% have `item_id`; 75.5% have `variant_id`).

### Architectural Identity Decision
- **BATCH (Style-Level Dye/Production Batch):** Anchored to `(company_id, item_id, batch_number)`. An entire production run of shirts or shoes shares one batch number, mfg date, and expiry date. `variant_id` is optional and populated only when batch is size-specific.
- **SERIAL (Unit-Level Item):** Anchored to `(company_id, variant_id, serial_number)`. A serial number (e.g. IMEI, luxury tag) belongs to an individual physical piece of a specific size and color.
- **LOCATION (Warehouse Bin):** Anchored to `(company_id, item_id, warehouse_id)` with optional `location_bin`.

---

## 12. Test Failure Classification Audit

| Test Name | File | Expected Behavior | Actual Behavior | Classification | Root Cause & Required Future Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `test_product_create_rejects_blank_hsn_code[]` | `t_item_val.py:116` | Raise `ValidationError` | No error raised | **OUTDATED TEST / ARCHITECTURE CONFLICT** | Schema relaxed HSN to optional for draft intake; update test assertion to verify draft allows optional HSN. |
| `test_product_create_rejects_blank_hsn_code[   ]` | `t_item_val.py:116` | Raise `ValidationError` | No error raised | **OUTDATED TEST / ARCHITECTURE CONFLICT** | Same as above. |
| `test_product_create_rejects_blank_hsn_code[None]` | `t_item_val.py:116` | Raise `ValidationError` | No error raised | **OUTDATED TEST / ARCHITECTURE CONFLICT** | Same as above. |
| `test_create_item_with_variants_and_barcodes` | `t_item_master.py:81` | Record created in DB | `NotNullViolationError` on `company_id` | **BAD FIXTURE** | Phase 8 enforced `company_id NOT NULL` on `item_warehouse_locations`; test fixture omitted `company_id`. Update fixture. |
| `test_matrix_variant_generator_cartesian` | `t_item_master.py` | Matrix variants generated | `NotNullViolationError` on `company_id` | **BAD FIXTURE / CONFLICT** | Fixture lacks `company_id` and requests synthetic barcodes (`auto_generate_barcodes=True`). Update fixture. |
| `test_fast_4_tier_scanner_resolver` | `t_item_master.py` | Resolver executes | `NotNullViolationError` on `company_id` | **BAD FIXTURE** | Setup fixture omitted `company_id` on warehouse location. Update fixture. |
| `test_batch_registration_and_tracking` | `t_item_master.py` | Batch created | `IntegrityError` | **BAD FIXTURE** | Setup fixture lacked valid company context and valid HSN. Update fixture. |
| `test_api_item_endpoints` | `t_item_master.py:511` | Status 200 OK | Status 400 Bad Request | **ARCHITECTURE CONFLICT** | Matrix payload specified `"auto_generate_barcodes": True` and omitted tenant headers. Align payload. |

---

## 13. Telemetry Governance Violation Forensic Report

- **File Inspected:** `backend/app/logs/canonical_resolution_telemetry.jsonl`
- **Observed Mutation:** Exactly 4 lines appended during the certification run.
- **Root Cause:**
  - `CanonicalTelemetrySink` (`backend/app/services/canonical_telemetry_sink.py` line 24) hardcodes log output to `backend/app/logs/canonical_resolution_telemetry.jsonl`.
  - When `pytest backend/app/tests/test_item_master_phase*.py` executed in Gate 25, the pipeline tests called `resolve_product_or_canonical_item`, which invoked `CanonicalTelemetrySink.record_event()`.
- **Governance Assessment:**
  - This is an automated runtime telemetry side effect, not an intentional source code edit.
  - However, storing active runtime log files inside a git-tracked repository path violates Clean Repository Governance.
- **Remediation Action:**
  - Revert the 4 telemetry lines before any git commit (`git checkout -- backend/app/logs/canonical_resolution_telemetry.jsonl`).
  - Add `*.jsonl` under `backend/app/logs/` to `.gitignore`.

---

## 14. Formal ADR Cross-Check & Evaluation Matrix

| ADR ID | Title | Status | Evaluation Evidence & Required Modifications |
| :--- | :--- | :--- | :--- |
| **ADR-001** | SKU Physical Naming | **REWORK (REJECT OPTION C)** | PostgreSQL generated stored column crashes on ORM writes. Adopt **Option B** (SQLAlchemy Column-to-Physical alias). |
| **ADR-002** | Synthetic Barcode Policy | **APPROVE WITH CONDITION** | Approved. Deactivate 433 and 83 synthetic barcodes; quarantine from POS. Verify 135 draft products. |
| **ADR-003** | Variant-First Transactions | **APPROVE** | Approved. 954 sales lines and 6 PO lines backfilled deterministically; 33 multi-variant stock movements routed to `MANUAL_REVIEW`. |
| **ADR-004** | GRN Tracking Identity | **APPROVE** | Approved. Remove `except Exception: pass` lines 737–738 and 753–754; wire `variant_id` on receipts and movements. |
| **ADR-005** | UOM Authority | **REWORK** | 40 of 41 footwear/apparel candidates are automated test fixtures. Quarantine test items; route commercial items to `MANUAL_REVIEW`. |
| **ADR-006** | Pricing SSOT | **APPROVE WITH CONDITION** | Scope deactivation of zero-price entries to `COMP-001`. Route the 1 entry with `mrp > 0` to `MANUAL_REVIEW`. |
| **ADR-007** | Tax / HSN Authority | **APPROVE WITH CONDITION** | Reject `'0000'` at GST gateways immediately; notify merchant before nullifying 676 parent items. |
| **ADR-008** | Color / Size Lookup | **APPROVE** | Approved. Update `master_lookup.py` to query `ItemVariant` with tenant filter and active status. |
| **ADR-009** | Tracking Identity Scope | **APPROVE** | Approved. Batch anchored to `item_id`; Serial anchored to `variant_id`. |
| **ADR-010** | Tenant Isolation | **APPROVE** | Approved. Purge `company_id.is_(None)` from tracking resolvers. |

---

## 15. Safety & Data Change Reversibility Gate

| Operation | Reversibility Classification | Backout & Rollback Strategy | Risk Rating |
| :--- | :--- | :--- | :--- |
| **Synthetic Barcode Deactivation** | **REVERSIBLE** | Flip `is_active = TRUE, is_primary = TRUE` where `notes = 'QUARANTINE_SYNTHETIC'`. | Low |
| **Single-Variant Barcode Linkage** | **REVERSIBLE WITH BACKUP** | Snapshot `item_barcodes` prior to update; revert `variant_id = NULL` on error. | Low |
| **Historical Transaction Backfill** | **REVERSIBLE WITH BACKUP** | Write backfilled line IDs to `remediation_backfill_audit_log`; reset `variant_id = NULL` on rollback. | Medium |
| **Zero-Price PBE Deactivation** | **REVERSIBLE** | Flip `is_active = TRUE` where `selling_price <= 0` and `notes = 'REMED_DEACT_ZERO'`. | Low |
| **HSN `'0000'` Nullification** | **REVERSIBLE WITH BACKUP** | Snapshot parent item HSN codes; restore `'0000'` if needed. | Medium |
| **Physical SKU Migration (DDL)** | **REVERSIBLE WITH BACKUP** | Revert SQLAlchemy model attribute mapping (Option B requires zero DDL!). | Low |

---

## 16. Final Decision & Approval Gate

```text
REMEDIATION PLAN STATUS:
    APPROVED WITH CONDITIONS
    (Subject to mandatory rework of ADR-001 from Option C to Option B,
     and rework of ADR-005 to quarantine test fixtures instead of backfilling them).

IMPLEMENTATION STATUS:
    NOT STARTED — PLANNING & CHALLENGE ONLY

DATABASE STATUS:
    UNCHANGED

PRODUCTION STATUS:
    HOLD

NEXT ACTION:
    Formally incorporate ADR-001 (Option B) and ADR-005 (Test Fixture Quarantine)
    reworks into the remediation plan before initiating Phase R-01.
```

### Critical Blockers Summary
- **P0-1:** Synthetic barcode generator active in `ItemCatalogService` (157 synthetic barcodes live).
- **P0-2:** Silent exception swallowing in `purchase.py` (lines 737–738, 753–754) causing tracking loss.
- **P0-3:** `variant_id` completely omitted from `PurchaseReceiptItem` and inward `StockMovement`.
- **P0-4:** Master autocomplete broken (`master_lookup.py` querying cleared parent `Item.color`/`size`).
- **P1-1:** 1,119 unmapped sales invoice items and 39 unmapped stock movements.
- **P1-2:** 528 items lacking UOM (including 40 unassigned test fixtures).
- **P1-3:** 420 price book entries with ₹0.00 selling price.
- **P1-4:** 676 active variants inheriting invalid dummy `'0000'` HSN.
- **P2-1:** Multi-tenant query fallback leakage (`or_(company_id.is_(None))`) in tracking service.
- **P2-2:** Unique tracking constraints omitting `company_id`.
