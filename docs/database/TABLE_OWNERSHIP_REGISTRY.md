<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Table Ownership Registry v1.0

**Status:** LIVING DOCUMENT — Updated: 2026-07-28  
**ADR Reference:** ADR-012 · DBP-002  
**Constitutional Reference:** GR-001 (SSOT) · GR-011 (Canonical Ownership)

> **One table. One owner. One repository. One service. One API.**  
> If a module needs data from another module's table, it calls the owning module's service or API — never the table directly.

---

## How to Read This Registry

| Column | Meaning |
|:---|:---|
| **Table** | PostgreSQL table name |
| **Owner Module** | The single module with write authority |
| **Repository** | SQLAlchemy repository class |
| **Service** | Business logic service layer |
| **API Route** | FastAPI endpoint prefix |
| **Events Published** | Domain events fired by this table's mutations |

---

## Tenant & Organization

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `companies` | Tenant | `TenantRepository` | `TenantService` | `/api/internal/v1/org/companies` | `CompanyCreated` |
| `branches` | Tenant | `TenantRepository` | `TenantService` | `/api/internal/v1/org/branches` | `BranchCreated` |

---

## Authentication & Security

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `users` | Auth | `UserRepository` | `AuthService` | `/api/internal/v1/auth/users` | `UserCreated` |
| `user_sessions` | Auth | `UserRepository` | `AuthService` | `/api/internal/v1/auth/sessions` | — |
| `smriti_roles` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/roles` | `RoleAssigned` |
| `smriti_permissions` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/permissions` | — |
| `smriti_permission_sets` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/permission-sets` | — |
| `smriti_role_permission_sets` | Security | `SecurityRepository` | `SecurityService` | *(internal join)* | — |
| `smriti_permission_set_permissions` | Security | `SecurityRepository` | `SecurityService` | *(internal join)* | — |
| `smriti_user_roles` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/user-roles` | `RoleAssigned` |
| `smriti_menus` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/menus` | — |
| `smriti_security_audits` | Security | `SecurityRepository` | `SecurityService` | `/api/internal/v1/security/audits` | — |

---

## Inventory

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `products` | Inventory | `ProductRepository` | `InventoryService` | `/api/internal/v1/inventory/products` | `ProductCreated`, `ProductUpdated`, `StockAdjusted` |
| `product_barcodes` | Inventory | `ProductRepository` | `InventoryService` | `/api/internal/v1/inventory/products/{id}/barcodes` | — |
| `stock_movements` | Inventory | `InventoryRepository` | `InventoryService` | `/api/internal/v1/inventory/movements` | `StockAdjusted` |
| `stores` | Inventory | `InventoryRepository` | `InventoryService` | `/api/internal/v1/inventory/stores` | — |
| `warehouses` | Inventory | `InventoryRepository` | `InventoryService` | `/api/internal/v1/inventory/warehouses` | — |
| `product_vendors` | Inventory | `ProductRepository` | `InventoryService` | `/api/internal/v1/inventory/products/{id}/vendors` | — |
| `product_tax_profiles` | Inventory | `ProductRepository` | `InventoryService` | `/api/internal/v1/inventory/products/{id}/tax-profiles` | — |
| `product_inventory_policies` | Inventory | `ProductRepository` | `InventoryService` | `/api/internal/v1/inventory/products/{id}/policy` | — |
| `stock_counts` | Inventory | `StockAuditRepository` | `StockAuditEngine` | `/api/internal/v1/inventory/stock-counts` | `StockAdjusted` |
| `stock_count_items` | Inventory | `StockAuditRepository` | `StockAuditEngine` | *(child of stock_counts)* | — |
| `stock_adjustments` | Inventory | `StockAuditRepository` | `StockAuditEngine` | `/api/internal/v1/inventory/adjustments` | `StockAdjusted` |
| `stock_transfers` | Inventory | `InventoryRepository` | `TransferService` | `/api/internal/v1/inventory/transfers` | `StockTransferCreated` |
| `stock_transfer_items` | Inventory | `InventoryRepository` | `TransferService` | *(child of transfers)* | — |
| `stock_transfer_shipments` | Inventory | `InventoryRepository` | `TransferService` | *(child of transfers)* | — |
| `replenishment_plans` | Inventory | `InventoryRepository` | `ReplenishmentService` | `/api/internal/v1/inventory/replenishment` | — |
| `replenishment_items` | Inventory | `InventoryRepository` | `ReplenishmentService` | *(child of plans)* | — |

---

## Sales

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `sales_invoices` | Sales | `SalesRepository` | `SalesService` / `SalesInvoicingEngine` | `/api/internal/v1/sales/invoices` | `SaleCompleted`, `InvoiceCancelled` |
| `sales_invoice_items` | Sales | `SalesRepository` | `SalesService` | *(child of invoices)* | — |
| `sales_payments` | Sales | `SalesRepository` | `SalesInvoicingEngine` | `/api/internal/v1/sales/invoices/{id}/payments` | `PaymentReceived` |
| `sales_orders` | Sales | `SalesRepository` | `SalesService` | `/api/internal/v1/sales/orders` | `SalesOrderCreated` |
| `sales_order_items` | Sales | `SalesRepository` | `SalesService` | *(child of orders)* | — |
| `sales_quotations` | Sales | `SalesRepository` | `SalesService` | `/api/internal/v1/sales/quotations` | — |
| `sales_quotation_items` | Sales | `SalesRepository` | `SalesService` | *(child of quotations)* | — |
| `sales_returns` | Sales | `SalesRepository` | `SalesService` | `/api/internal/v1/sales/returns` | `SalesReturnCreated` |
| `sales_return_items` | Sales | `SalesRepository` | `SalesService` | *(child of returns)* | — |
| `credit_notes` | Sales | `SalesRepository` | `SalesService` | `/api/internal/v1/sales/credit-notes` | — |

---

## Purchase

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `suppliers` | **Purchase** | `SupplierRepository` | `PurchaseService` | `/api/internal/v1/purchase/suppliers` | `SupplierCreated` |
| `supplier_addresses` | Purchase | `SupplierRepository` | `PurchaseService` | *(child of suppliers)* | — |
| `supplier_contacts` | Purchase | `SupplierRepository` | `PurchaseService` | *(child of suppliers)* | — |
| `purchase_orders` | Purchase | `PurchaseRepository` | `PurchaseService` | `/api/internal/v1/purchase/orders` | `PurchaseOrderCreated` |
| `purchase_order_items` | Purchase | `PurchaseRepository` | `PurchaseService` | *(child of orders)* | — |
| `purchase_receipts` | Purchase | `PurchaseRepository` | `PurchaseService` | `/api/internal/v1/purchase/receipts` | `GRNCompleted` |
| `purchase_receipt_items` | Purchase | `PurchaseRepository` | `PurchaseService` | *(child of receipts)* | — |
| `procurement_rfqs` | Purchase | `PurchaseRepository` | `ProcurementService` | `/api/internal/v1/purchase/rfqs` | — |
| `purchase_requisitions` | Purchase | `PurchaseRepository` | `ProcurementService` | `/api/internal/v1/purchase/requisitions` | — |
| `quality_inspections` | Purchase | `PurchaseRepository` | `QualityService` | `/api/internal/v1/purchase/inspections` | — |
| `supplier_scorecards` | Purchase | `SupplierRepository` | `PurchaseService` | `/api/internal/v1/purchase/suppliers/{id}/scorecard` | — |

---

## CRM

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `customers` | CRM | `CustomerRepository` | `CrmService` | `/api/internal/v1/crm/customers` | `CustomerCreated`, `CustomerUpdated` |
| `customer_addresses` | CRM | `CustomerRepository` | `CrmService` | *(child of customers)* | — |
| `customer_groups` | CRM | `CustomerRepository` | `CrmService` | `/api/internal/v1/crm/customer-groups` | — |
| `pricing_groups` | CRM | `CustomerRepository` | `CrmService` | `/api/internal/v1/crm/pricing-groups` | — |

---

## Accounting

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `chart_of_accounts` | Accounting | `AccountingRepository` | `AccountingService` | `/api/internal/v1/accounting/accounts` | — |
| `ledger_entries` | Accounting | `AccountingRepository` | `AccountingService` | `/api/internal/v1/accounting/entries` | `LedgerEntryPosted` |
| `financial_year` *(PLANNED)* | Accounting | `AccountingRepository` | `AccountingService` | `/api/internal/v1/accounting/financial-years` | `FinancialYearOpened`, `FinancialYearClosed` |
| `journal_entries` *(PLANNED)* | Accounting | `AccountingRepository` | `AccountingService` | `/api/internal/v1/accounting/journals` | `JournalEntryPosted` |

---

## POS

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `pos_sessions` | POS | *(PosEngine direct)* | `PosEngine` | `/api/internal/v1/pos/sessions` | `POSSessionOpened`, `POSSessionClosed` |
| `pos_transactions` | POS | *(PosEngine direct)* | `PosEngine` | `/api/internal/v1/pos/sessions/{id}/checkout` | `SaleCompleted`, `StockAdjusted` |
| `pos_transaction_items` | POS | *(PosEngine direct)* | `PosEngine` | *(child of transactions)* | — |
| `pos_offline_sync_queue` | POS | *(PosEngine direct)* | `PosEngine` | `/api/internal/v1/pos/sync` | — |

---

## Tax & GST

| Table | Owner | Repository | Service | API | Events |
|:---|:---|:---|:---|:---|:---|
| `gst_tax_settlements` | Tax | `TaxRepository` | `TaxService` | `/api/internal/v1/tax/settlements` | — |
| `gst_return_filings` | Tax | `TaxRepository` | `TaxService` | `/api/internal/v1/tax/filings` | — |
| `eway_bills` | Tax | `TaxRepository` | `TaxService` | `/api/internal/v1/tax/eway-bills` | — |

---

## Ownership Conflict Register

| Conflict | Resolution |
|:---|:---|
| `suppliers` could belong to either Purchase or CRM | **Owned by Purchase.** CRM reads via `/api/internal/v1/purchase/suppliers` |
| `product_barcodes` is both in `inventory.py` and `barcode.py` | `inventory.py::ProductBarcode` is canonical. `barcode.py` templates are for label printing only. |

---

*Last updated: 2026-07-28 | Next review: On any new table addition*
