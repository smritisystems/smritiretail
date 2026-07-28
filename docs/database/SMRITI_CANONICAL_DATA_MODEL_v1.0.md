# SMRITI Canonical Data Model v1.0

**Status:** FROZEN — 2026-07-28  
**ADR Reference:** ADR-012 (Database Blueprint Governance)  
**Constitutional Reference:** GR-001 (SSOT) · DBP-001 · DBP-002

> **Every API, report, UI component, and integration MUST derive from these canonical entity definitions.**  
> No module may define an alternative shape for these entities.

---

## Canonical Entity: Product

**Owner Module:** Inventory  
**Canonical Table:** `products`  
**Repository:** `ProductRepository`  
**Service:** `ProductService` (or `InventoryService`)  
**API:** `/api/internal/v1/inventory/products`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`prod-xxx`) |
| `uuid` | String(36) | ✅ | UUID v4, globally unique |
| `code` | String(50) | ✅ | Unique product code |
| `name` | String(255) | ✅ | Display name |
| `barcode` | String(100) | ✅ | Primary barcode (EAN/UPC) |
| `price` | Numeric(15,2) | ✅ | Selling price |
| `cost_price` | Numeric(15,2) | — | Purchase cost |
| `mrp` | Numeric(15,2) | — | Maximum retail price |
| `stock` | Integer | ✅ | Current stock level |
| `category` | String(100) | ✅ | Product category |
| `brand` | String(100) | — | Brand name |
| `hsn_code` | String(15) | — | GST HSN code |
| `gst_percentage` | Numeric(5,2) | — | Default GST rate |
| `sku` | String(100) | — | Unique SKU |
| `tracking_mode` | String(30) | — | Standard/Serial/Batch |
| `is_active` | Boolean | ✅ | Inherited from BaseEntity |
| `is_deleted` | Boolean | ✅ | Inherited from BaseEntity |
| `company_id` | String(50) | ✅ | Tenant isolation |
| `branch_id` | String(50) | — | Branch scoping |

**Domain Events:** `ProductCreated`, `ProductUpdated`, `StockAdjusted`

---

## Canonical Entity: Customer

**Owner Module:** CRM  
**Canonical Table:** `customers`  
**Repository:** `CustomerRepository`  
**Service:** `CustomerService` (or `CrmService`)  
**API:** `/api/internal/v1/crm/customers`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`cust-xxx`) |
| `name` | String(255) | ✅ | Full name |
| `mobile` | String(20) | — | Primary mobile |
| `email` | String(255) | — | Email address |
| `gstin` | String(15) | — | GST registration number |
| `pan` | String(10) | — | PAN number |
| `customer_group_id` | String(50) | — | FK → `customer_groups.id` |
| `credit_limit` | Numeric(15,2) | — | Credit ceiling |
| `outstanding` | Numeric(15,2) | — | Current balance due |
| `loyalty_points` | Integer | — | Current loyalty points |
| `is_active` | Boolean | ✅ | Inherited |
| `company_id` | String(50) | ✅ | Tenant isolation |

**Domain Events:** `CustomerCreated`, `CustomerUpdated`

---

## Canonical Entity: Supplier

**Owner Module:** Purchase  
**Canonical Table:** `suppliers`  
**Repository:** `SupplierRepository`  
**Service:** `SupplierService` (within `PurchaseService`)  
**API:** `/api/internal/v1/purchase/suppliers`

> **Architectural Note (ADR-012):** CRM may read supplier contact data via the Purchase API only.  
> A duplicate `Supplier` model in `crm.py` is prohibited (GR-001 / DBP-002).

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`supp-xxx`) |
| `name` | String(255) | ✅ | Legal business name |
| `gstin` | String(15) | — | GST registration |
| `pan` | String(10) | — | PAN number |
| `credit_days` | Integer | — | Payment terms in days |
| `currency` | String(3) | — | ISO 4217 (default INR) |
| `company_id` | String(50) | ✅ | Tenant isolation |

**Domain Events:** `SupplierCreated`, `SupplierUpdated`

---

## Canonical Entity: Sales Invoice

**Owner Module:** Sales  
**Canonical Table:** `sales_invoices` + `sales_invoice_items`  
**Repository:** `SalesRepository`  
**Service:** `SalesService` / `SalesInvoicingEngine`  
**API:** `/api/internal/v1/sales/invoices`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`inv-xxx`) |
| `invoice_no` | String(80) | ✅ | Human-readable number |
| `customer_id` | String(50) | — | FK → `customers.id` |
| `order_id` | String(50) | — | FK → `sales_orders.id` |
| `invoice_date` | DateTime | ✅ | Invoice issue date |
| `subtotal` | Numeric(15,2) | ✅ | Pre-tax total |
| `cgst_amount` | Numeric(15,2) | ✅ | Central GST |
| `sgst_amount` | Numeric(15,2) | ✅ | State GST |
| `igst_amount` | Numeric(15,2) | ✅ | Interstate GST |
| `tax_total` | Numeric(15,2) | ✅ | Total tax |
| `grand_total` | Numeric(15,2) | ✅ | Final payable amount |
| `paid_amount` | Numeric(15,2) | ✅ | Amount received |
| `balance_due` | Numeric(15,2) | ✅ | Outstanding balance |
| `status` | String(30) | ✅ | Unpaid / Partial / Paid / Cancelled |

**Domain Events:** `SaleCompleted` (on create), `InvoiceCancelled` (on cancel)

---

## Canonical Entity: Purchase Order

**Owner Module:** Purchase  
**Canonical Table:** `purchase_orders` + `purchase_order_items`  
**Repository:** `PurchaseRepository`  
**Service:** `PurchaseService`  
**API:** `/api/internal/v1/purchase/orders`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`po-xxx`) |
| `po_number` | String(80) | ✅ | Human-readable PO number |
| `supplier_id` | String(50) | ✅ | FK → `suppliers.id` |
| `order_date` | DateTime | ✅ | PO issue date |
| `expected_date` | DateTime | — | Expected delivery |
| `grand_total` | Numeric(15,2) | ✅ | Total PO value |
| `status` | String(30) | ✅ | Draft / Confirmed / Received / Cancelled |

**Domain Events:** `PurchaseOrderCreated`, `PurchaseOrderConfirmed`

---

## Canonical Entity: Stock Movement

**Owner Module:** Inventory  
**Canonical Table:** `stock_movements`  
**Repository:** `InventoryRepository`  
**Service:** `InventoryService`  
**API:** `/api/internal/v1/inventory/movements`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK |
| `product_id` | String(50) | ✅ | FK → `products.id` |
| `warehouse_id` | String(50) | ✅ | FK → `warehouses.id` |
| `movement_type` | String(30) | ✅ | IN / OUT / TRANSFER / ADJUST |
| `quantity` | Numeric(12,4) | ✅ | Movement quantity |
| `reference_no` | String(80) | — | Source document reference |
| `narration` | Text | — | Movement description |

**Domain Events:** `StockAdjusted`

---

## Canonical Entity: Ledger Entry

**Owner Module:** Accounting  
**Canonical Table:** `ledger_entries`  
**Repository:** `AccountingRepository`  
**Service:** `AccountingService`  
**API:** `/api/internal/v1/accounting/entries`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK |
| `account_id` | String(50) | ✅ | FK → `chart_of_accounts.id` |
| `journal_id` | String(50) | — | FK → `journal_entries.id` *(planned)* |
| `debit_amount` | Numeric(15,2) | ✅ | Debit side |
| `credit_amount` | Numeric(15,2) | ✅ | Credit side |
| `narration` | Text | — | Description |
| `ref_document_type` | String(50) | — | `INVOICE` / `PO` / `PAYMENT` |
| `ref_document_id` | String(50) | — | Source document ID |
| `posting_date` | DateTime | ✅ | Effective date |

**Domain Events:** `LedgerEntryPosted`

---

## Canonical Entity: POS Transaction

**Owner Module:** POS  
**Canonical Table:** `pos_transactions` + `pos_transaction_items`  
**Repository:** *(via `PosEngine`)* 
**Service:** `PosEngine`  
**API:** `/api/internal/v1/pos/sessions/{id}/checkout`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`pos-tx-xxx`) |
| `receipt_no` | String(50) | ✅ | Human-readable receipt |
| `session_id` | String(50) | ✅ | FK → `pos_sessions.id` |
| `customer_id` | String(50) | — | Optional customer |
| `grand_total` | Numeric(15,2) | ✅ | Final bill |
| `payment_method` | String(20) | ✅ | CASH / CARD / UPI / QR |
| `tendered_amount` | Numeric(15,2) | ✅ | Amount given |
| `change_due` | Numeric(15,2) | ✅ | Change returned |
| `status` | String(30) | ✅ | COMPLETED / REFUNDED |

**Domain Events:** `SaleCompleted`, `StockAdjusted` (per item)

---

## Canonical Entity: Payment

**Owner Module:** Sales  
**Canonical Table:** `sales_payments`  
**Repository:** `SalesRepository`  
**Service:** `SalesInvoicingEngine.record_payment()`  
**API:** `/api/internal/v1/sales/invoices/{id}/payments`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK |
| `invoice_id` | String(50) | ✅ | FK → `sales_invoices.id` |
| `amount` | Numeric(15,2) | ✅ | Payment amount |
| `payment_mode` | String(20) | ✅ | CASH / CARD / UPI / CREDIT |
| `reference_no` | String(100) | — | Cheque/UTR/txn ref |
| `payment_date` | DateTime | ✅ | Value date |

---

## Canonical Entity: Warehouse

**Owner Module:** Inventory  
**Canonical Table:** `warehouses`  
**Repository:** `InventoryRepository`  
**API:** `/api/internal/v1/inventory/warehouses`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK |
| `name` | String(255) | ✅ | Warehouse name |
| `branch_id` | String(50) | ✅ | FK → `branches.id` |
| `is_default` | Boolean | — | Default warehouse flag |
| `address` | Text | — | Physical address |

---

## Canonical Entity: Financial Year *(PLANNED — Phase 1 Gap)*

**Owner Module:** Accounting  
**Planned Table:** `financial_year`  
**ADR Reference:** ADR-012 §Phase 1

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`fy-xxx`) |
| `name` | String(50) | ✅ | e.g. `2025-26` |
| `start_date` | Date | ✅ | April 1 |
| `end_date` | Date | ✅ | March 31 |
| `is_active` | Boolean | ✅ | Currently active year |
| `is_locked` | Boolean | ✅ | Locked for posting |
| `company_id` | String(50) | ✅ | Tenant isolation |

---

## Canonical Entity: Journal Entry *(PLANNED — Phase 1 Gap)*

**Owner Module:** Accounting  
**Planned Table:** `journal_entries`  
**ADR Reference:** ADR-012 §Phase 1

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `id` | String(50) | ✅ | Prefixed PK (`jnl-xxx`) |
| `journal_no` | String(80) | ✅ | Human-readable number |
| `journal_type` | String(30) | ✅ | SALES / PURCHASE / PAYMENT / ADJUSTMENT |
| `posting_date` | Date | ✅ | Effective date |
| `financial_year_id` | String(50) | ✅ | FK → `financial_year.id` |
| `narration` | Text | — | Journal description |
| `ref_document_type` | String(50) | — | Source document type |
| `ref_document_id` | String(50) | — | Source document ID |
| `status` | String(20) | ✅ | DRAFT / POSTED / REVERSED |
| `company_id` | String(50) | ✅ | Tenant isolation |

**Domain Events:** `JournalEntryPosted`
