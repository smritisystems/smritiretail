<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-09-08
  Modified     : 2026-09-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Policy Specification (Phase 2B)
-->

# Phase 2B — Canonical Financial Policy Specification

**Policy Document ID:** SMRITI-POL-FIN-2026-09-2B  
**Version:** 1.0.0  
**Status:** ESTABLISHED (Phase 2B Baseline)  
**Supersedes:** Uncoordinated legacy pricing, discount, and tax behaviors across POS and Sales Ledgers  
**Reference Characterization:** `docs/implementation/foundation/PHASE2A_POS_CONTRACT.md`

---

## 1. Executive Summary & Policy Objective

Phase 2A identified semantic and architectural divergences between the three active sales writers:
1. `POSService.pos_checkout` (Retail POS fast checkout adapter)
2. `UnifiedSalesLedgerService.post_sales_invoice` (Legacy ledger poster)
3. `SalesService.create_sales_invoice` (Canonical B2B Billing & Wholesale Authority)

This document resolves the financial semantic conflicts identified in Phase 2A and establishes the **Canonical Financial Policy** for the SMRITI platform. No production writer was rewired or deleted during this phase. This policy defines the mathematical, statutory, identity, inventory, and credit rules that the **Canonical Sales/Billing Authority** will enforce in Phase 2C.

---

## 2. Statutory Tax Policy (GST Engine Authority)

### 2.1 Statutory Authority & Single Source of Truth
The canonical statutory tax authority for all transactional writes across SMRITI Retail OS is:
`backend/app/core/gst_engine.py`

All manual or divergent tax calculations (including POS's flat `qty * price * gst_rate / 100` and unrounded 4-decimal tax accumulation) are deprecated and must converge on `calculate_line_item_tax()`.

### 2.2 Inclusive vs. Exclusive Tax Determination
The tax engine natively supports both Tax-Inclusive (Consumer Retail MRP) and Tax-Exclusive (Wholesale/Commercial Base Rate) transactions:

| Mode | Trigger Condition | Statutory Formula |
| :--- | :--- | :--- |
| **Tax-Inclusive (MRP)** | POS Retail default, or `item.is_tax_inclusive == True`, or unregistered B2C | Gross Total = `(unit_price * quantity) - discount_amount`<br>Taxable Value = `Gross Total / (1 + (gst_rate / 100))`<br>Tax Total = `Gross Total - Taxable Value` |
| **Tax-Exclusive (Base Rate)** | Wholesale B2B default, or `item.is_tax_inclusive == False`, or registered B2B invoice | Taxable Value = `(unit_price * quantity) - discount_amount`<br>Tax Total = `Taxable Value * (gst_rate / 100)`<br>Gross Total = `Taxable Value + Tax Total` |

**Policy Rule:**
- Retail POS transactions default to **Tax-Inclusive (MRP)** because retail shelf prices in India are statutory Maximum Retail Prices (MRP) inclusive of all taxes (Legal Metrology Act & CGST Rules).
- B2B Wholesale transactions default to **Tax-Exclusive**, where rates are quoted net of GST.
- Any line item may explicitly specify `is_tax_inclusive: bool` to override the channel default.

### 2.3 Taxable Value & Discount Interaction
Discount applied at the line level directly reduces the transaction value before tax calculation under Section 15(3)(a) of the CGST Act 2017:
- Discount Amount = `(unit_price * quantity * disc_pct / 100.00)`
- The discounted base is fed into `calculate_line_item_tax()`.

### 2.4 Intra-State vs. Inter-State Jurisdiction (Place of Supply)
The tax split between `CGST + SGST` vs `IGST` is strictly derived from the Place of Supply (POS) state versus the Supplier Company home state:
- **Company State Code:** Authoritatively extracted from `Company.gst_number` (first 2 digits) via `extract_state_code_from_gstin()`. Defaults to `"27"` (Maharashtra) only if unconfigured.
- **Place of Supply (POS) State Code:** Hierarchically resolved from authoritative transaction context:
  1. `delivery_location.state_code` (if Delivery Location specified)
  2. `invoice_in.place_of_supply_code` (if explicitly provided)
  3. `billed_party_gstin.state_code` (if B2B Billed Party GSTIN selected)
  4. `customer.gstin` (if customer master has valid GSTIN)
  5. `company_state_code` (default intra-state retail transaction)

**Statutory Split Rules:**
- **Inter-State (`company_state_code != pos_state_code`):**
  - `cgst_amount = 0.00`
  - `sgst_amount = 0.00`
  - `igst_amount = tax_total_rounded`
- **Intra-State (`company_state_code == pos_state_code`):**
  - `half_tax = round_currency(tax_total_rounded / 2.00)`
  - `cgst_amount = half_tax`
  - `sgst_amount = tax_total_rounded - half_tax` *(Canonical 1-paisa divergence adjustment: ensures `cgst + sgst == tax_total` exactly)*
  - `igst_amount = 0.00`

### 2.5 Statutory Line & Invoice Snapshot Fields
Every generated invoice line (`SalesInvoiceItem`) and header (`SalesInvoice`) must persist immutable snapshots:
- **Line Snapshot:** `taxable_value`, `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `tax_amount`, `total_amount`, `hsn_code`.
- **Header Snapshot:** `taxable_value`, `tax_total`, `grand_total`, `is_interstate`, `place_of_supply_code`, `pos_state`.

---

## 3. Discount Policy (Line-Level vs. Bill-Level)

### 3.1 Line-Level Discount (Established)
- Supported parameter: `disc_pct` (Decimal percentage).
- Evaluated prior to tax computation.
- Stored on `sales_invoice_items.disc_pct`.
- Perfectly aligns with Section 15(3)(a) CGST Act.

### 3.2 POS Bill-Level Discount Conflict & Analysis
In retail POS, cashiers frequently apply a bill-level discount (either flat rupee amount, e.g. ₹50 off, or percentage, e.g. 5% off bill).
Currently:
- `POSService.pos_checkout` deducts bill discount directly from `grand_total` post-tax:
  ```python
  grand_total = max(Decimal("0.00"), grand_total - discount)
  ```
- Line item amounts and tax amounts are NOT updated.
- Consequently, `SUM(items.total_amount) != invoice.grand_total`.

### 3.3 Decision Classification: `NEEDS_APPROVAL`
Under Indian GST Law, there are two distinct legal/accounting interpretations for post-line bill discounts:

| Option | Commercial Mechanism | Tax Liability Impact | Implementation Complexity |
| :--- | :--- | :--- | :--- |
| **Option A: Pre-Tax Proportional Allocation** | Allocate bill discount across all taxable lines proportionally based on `(price * qty)`. Recalculate line taxable value, CGST/SGST/IGST, and total per line. | GST liability is reduced on every line. Compliant with Section 15(3) if recorded on the invoice. | Moderate. Requires allocation algorithm + remainder 1-paisa reconciliation. |
| **Option B: Post-Tax Financial/Commercial Discount** | Lines retain statutory taxable value and full GST liability. Bill discount is treated as a financial subsidy / settlement deduction recorded on the invoice header (`discount_amount`) without altering line tax. | GST payable to the government is NOT reduced. Merchant absorbs GST on full price. | Simple. Preserves line tax calculations; header records `net_amount = grand_total - discount_amount`. |

> [!IMPORTANT]
> **GOVERNANCE STATUS: `NEEDS_APPROVAL`**  
> The repository does not currently contain a proportional bill-discount allocation engine. Silent adoption of Option A or Option B affects merchant tax liability and reconciliation. Phase 2C will implement Option A or Option B upon explicit stakeholder approval. In the interim, line-level discount remains the canonical tax-reduction mechanism.

---

## 4. Monetary Precision & Deterministic Rounding Contract

### 4.1 Precision & Quantization Rules
All financial calculations across SMRITI Retail OS must adhere to a single deterministic rounding contract:

| Financial Element | Storage Datatype | Internal Precision | Quantization Rounding |
| :--- | :--- | :--- | :--- |
| `unit_price` / `price` | `Numeric(15, 2)` | 2 decimals | `ROUND_HALF_UP` |
| `quantity` | `Numeric(12, 4)` | 4 decimals | Exact / No rounding |
| `disc_pct` | `Numeric(7, 4)` | 4 decimals | Exact / No rounding |
| Line `taxable_value` | `Numeric(15, 2)` | 2 decimals | `ROUND_HALF_UP` |
| Line `tax_amount` | `Numeric(15, 2)` | 2 decimals | `ROUND_HALF_UP` |
| Line `cgst_amount` | `Numeric(15, 2)` | 2 decimals | `ROUND_HALF_UP` |
| Line `sgst_amount` | `Numeric(15, 2)` | 2 decimals | Exact `tax_amount - cgst_amount` |
| Line `igst_amount` | `Numeric(15, 2)` | 2 decimals | `ROUND_HALF_UP` |
| Line `total_amount` | `Numeric(15, 2)` | 2 decimals | Exact `taxable_value + tax_amount` |
| Header `taxable_value` | `Numeric(15, 2)` | 2 decimals | Exact `SUM(items.taxable_value)` |
| Header `tax_total` | `Numeric(15, 2)` | 2 decimals | Exact `SUM(items.tax_amount)` |
| Header `grand_total` (unrounded) | `Numeric(15, 2)` | 2 decimals | Exact `taxable_value + tax_total` |
| Header `rounding_amount` | `Numeric(10, 4)` | 2 decimals | `rounded_grand_total - unrounded_grand_total` |
| Header `grand_total` (final) | `Numeric(15, 2)` | 2 decimals | `unrounded_grand_total + rounding_amount` |

### 4.2 Reversal of 4-Decimal POS Line Tax
POS previously quantized line tax to `Decimal("0.0001")`. This caused sub-paisa discrepancies when summed with standard 2-decimal lines.
**Canonical Rule:** Line tax is quantized strictly to 2 decimal places (`Decimal("0.01")`) via `round_currency()`.

---

## 5. Item / Variant Identity & Catalog Integrity

### 5.1 Dual-Key Authority Engine
The canonical item resolution authority is:
`backend/app/services/canonical_transaction_writer.py:CanonicalTransactionWriter.resolve_dual_key_for_line`

### 5.2 Resolution Hierarchy
Every transaction line item is resolved in the following strict order:
1. **Canonical `variant_id`:** If supplied, query `item_variants` joined with `legacy_id_mappings`.
2. **Barcode / SKU:** If code supplied, query `item_barcodes` and `item_variants.variant_sku`.
3. **Legacy `product_id`:** Transitional fallback checking `legacy_id_mappings` for canonical linkage.

### 5.3 Quarantined Record Protection
- If any resolved record has `legacy_id_mappings.disposition == "REQUIRES_REVIEW"`, the authority MUST reject the transaction immediately with error code:
  `SMRITI-QUARANTINE-REJECT`  
  *("Item is locked under catalog review and cannot be transacted.")*

### 5.4 Unresolved Identity Rejection
- Physical goods whose identity cannot be resolved against active catalog tables MUST fail closed:
  `SMRITI-VAL-NO-IDENTITY`  
  *("No identifiable product or variant was provided.")*
- **Strict Prohibition:** Creating ad-hoc synthetic products (e.g. `prod_adhoc_<uuid>` seen in `sales_ledger_svc.py`) is strictly prohibited. Unregistered goods must be registered before billing.

### 5.5 Service and Non-Stock Goods
- Lines flagged with `is_fee_line=True` or products with `tracking_mode == "No-stock"`:
  - Line type set to `NON_INVENTORY_FEE` or `SERVICE`.
  - Allowed without physical stock deduction.
  - Generates zero `StockMovement` records.

---

## 6. Physical Inventory Policy (WMS Authority)

### 6.1 Physical Stock Authority
The sole, canonical physical inventory authority is:
`backend/app/services/inventory_wms.py:InventoryWmsService`

Direct mutation of `Product.stock` in memory (as performed in `POSService.pos_checkout`) is strictly prohibited and classified as duplicate/defective behavior to remove.

### 6.2 Mutation & Aggregate Synchronization Contract
All physical stock decrements must execute via `InventoryWmsService.atomic_mutate_batch_stock()`:
1. Pessimistically lock candidate batch (`ProductBatchStock ... FOR UPDATE`).
2. Validate available batch stock (`quantity - reserved_quantity - damaged_quantity >= requested_qty`).
3. Mutate batch stock atomically.
4. Insert immutable audit record in `StockMovement`.
5. Synchronize cached aggregate `products.stock` from `SUM(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity)`.

### 6.3 FEFO Selection vs. Explicit Batch
- **Explicit Batch Supplied:** When the caller (barcode scanner, cashier, or picking list) supplies `batch_no`, the authority validates and decrements that specific batch.
- **No Batch Supplied (Auto-Allocation):** The authority invokes `allocate_stock_fefo()`, ordering candidate batches by `expiry_date ASC NULLS LAST, created_at ASC` with `FOR UPDATE` row locks.

### 6.4 Multi-Batch Allocation & Movement Cardinality
**Explicit Contract Guarantee:**
When FEFO allocation splits an invoice line across multiple batches:
- **One invoice line produces N stock movements** (where $N \ge 1$ for stocked physical goods, one per deducted batch).
- For service or `No-stock` lines, $N = 0$.
- Under no circumstances is stock movement cardinality constrained to a false 1:1 line ratio.

### 6.5 Movement Quantity Sign Convention
- **Canonical Convention:** `StockMovement.quantity` stores `abs(qty_delta)` (positive decimal magnitude).
- **Directionality:** Specified strictly via `movement_type = "OUTWARD_SALE"`.
- Legacy negative quantity conventions (`-qty`) in POS and sales ledger are deprecated and will be removed in Phase 2C.

### 6.6 FEFO Fallback Policy
Under `POLICY_BILLING_CONTROLS.enforce_strict_stock_check == True`:
- If tracked batches have insufficient stock, the transaction MUST fail closed with `SMRITI-STOCK-001`.
- Silently concealing stock stockouts by creating phantom negative `BATCH-OPENING` batches is prohibited unless explicitly configured in store policy.

---

## 7. Document Numbering Policy

### 7.1 Authority & Series Engine
The canonical document numbering authority is:
`backend/app/services/documents_engine.py:DocumentsEngine`

### 7.2 Series Isolation & Concurrency
- Numbering is scoped by `company_id`, `branch_id`, and `document_type` (`SALES_INVOICE` or `POS_BILL`).
- Sequence generation locks the series counter row with `SELECT DocumentSeries ... FOR UPDATE`.
- Flushes the sequence without committing, preserving the outer caller's transaction boundary.

### 7.3 Auto vs. Client-Supplied Numbering
- **Missing / Empty / `"AUTO"`:** The authority allocates the next gapless number from `DocumentSeries`.
- **Terminal-Supplied Number:** POS terminals operating offline or maintaining terminal sequences may supply a client-generated `invoice_no`.
  - The authority checks `SalesInvoice` for existing active invoice with matching `(invoice_no, company_id)`.
  - If collision occurs, returns `HTTP 409 Conflict` (*"Duplicate document number: Invoice '...' already exists under active company context"*).
- **Separation from Idempotency:** Document number is NEVER used as the request idempotency key.

---

## 8. Customer & Credit Governance Policy

### 8.1 Authority Boundary
Customer existence, group policies, and credit risk are authoritatively governed by:
`backend/app/services/crm.py:CRMService`

### 8.2 Scope & Cross-Tenant Protection
- Customers must belong to the active `tenant_ctx.company_id` and assigned `tenant_ctx.branch_id` (or global customer with `branch_id IS NULL`).
- Cross-company customer access is strictly blocked (`HTTP 403 Forbidden`).

### 8.3 Walk-In Customers
- Identified by `customer_id == "CUST-WALKIN"` or omitted.
- Handled as cash/immediate tender only.
- **Credit Billing Prohibited:** Walk-in customers cannot bill on credit (`HTTP 400`).
- Corporate B2B fields (Delivery Location, Billed GSTIN, Customer PO) cannot be attached to walk-in customers.

### 8.4 Authoritative Credit Enforcement
When `payment_mode == "CREDIT"`:
1. Customer row is locked pessimistically (`SELECT Customer ... FOR UPDATE`).
2. Credit limit check via `CRMService.check_credit_limit()`:
   - Verifies `group.credit_hold == False` (`SMRITI-CREDIT-002`).
   - Verifies `outstanding + invoice_amount <= credit_limit` (`SMRITI-CREDIT-001`).
3. Updates `customer.outstanding = previous_outstanding + grand_total`.
4. Writes atomic audit entry to `CustomerCreditLedgerEntry` (`entry_type="DEBIT"`).

---

## 9. Multi-Tenant Isolation & Zero-Trust Hierarchy

### 9.1 Database Separation Rule
- **Company DB (`smritiXXX`):** The ONLY valid target for transactional financial data (Invoices, Items, Movements, Payments, Shifts, Outbox, GL).
- **Control Plane DB (`smritisys`):** Strictly metadata, routing registry, and UI configuration. **`smritisys` is NEVER a financial transaction target.**

### 9.2 Adapter Identity Validation
The Canonical Authority does NOT trust adapter-provided IDs without verification against the active Company DB:
- `branch_id`: Must exist in `branches`, belong to `company_id`, and be active.
- `warehouse_id`: Must exist in `warehouses`, belong to `company_id` and `branch_id`.
- `shift_id`: Must exist in `shifts`, belong to `company_id` and `branch_id`, and be in `OPEN` status.
- `product_id` / `variant_id`: Must resolve to active catalog items in the company.
- `batch_no`: Must exist in `product_batch_stocks` for the target warehouse and product.

---

## 10. Approval Summary

| Policy Area | Canonical Authority | Status |
| :--- | :--- | :--- |
| **Tax Engine** | `backend/app/core/gst_engine.py` | **APPROVED (ESTABLISHED)** |
| **Discount (Line-level)** | `SalesService` & `gst_engine.py` | **APPROVED (ESTABLISHED)** |
| **Discount (Bill-level)** | Allocation across lines vs Post-tax deduction | **NEEDS_APPROVAL** |
| **Monetary Rounding** | 2-decimal `ROUND_HALF_UP` | **APPROVED (ESTABLISHED)** |
| **Item/Variant Identity** | `CanonicalTransactionWriter` (Dual-Key) | **APPROVED (ESTABLISHED)** |
| **Inventory & FEFO** | `InventoryWmsService` | **APPROVED (ESTABLISHED)** |
| **Document Numbering** | `DocumentsEngine` | **APPROVED (ESTABLISHED)** |
| **Customer & Credit** | `CRMService` & `SalesService` | **APPROVED (ESTABLISHED)** |
| **Tenant Routing** | `get_company_db` / Company DB only | **APPROVED (ESTABLISHED)** |

*End of Policy Specification.*
