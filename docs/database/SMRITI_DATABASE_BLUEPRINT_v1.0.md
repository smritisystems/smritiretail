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

# SMRITI Database Blueprint v1.0

**Status:** FROZEN — 2026-07-28  
**ADR Reference:** ADR-012 (Database Blueprint Governance)  
**Constitutional Reference:** ADR-004 · GR-001 · AOP-004 · DBP-001

> **This document is the single authoritative reference for all SMRITI database schema decisions.**  
> No new Alembic migration shall be committed without first updating this document.

---

## §1. Database Constitution

| Property | Value |
|:---|:---|
| Database Engine | PostgreSQL 15+ |
| ORM | SQLAlchemy 2.0 Async (`AsyncSession`) |
| Migration Engine | Alembic (`backend/alembic/versions/`) |
| Naming Convention | `snake_case` for all tables and columns |
| Primary Key | `String(50)` — prefixed IDs (e.g. `prod-abc123`) |
| UUID Field | `String(36)` — globally unique, auto-generated |
| Soft Delete | `is_deleted BOOLEAN DEFAULT FALSE` + `deleted_at TIMESTAMPTZ` |
| Audit Fields | `created_at`, `modified_at`, `created_by`, `updated_by` (via `BaseEntity`) |
| Tenant Isolation | `tenant_id`, `company_id`, `branch_id` (via `BaseEntity`) |
| Versioning | `version INTEGER DEFAULT 1` (via `BaseEntity`) |
| Base Mixin | `backend/app/db/base.py` → `BaseEntity` / `RowSecuredMixin` |

### BaseEntity Inheritance Rule (DBP-001)
All new tables MUST inherit `BaseEntity`. The following fields are automatically provided and must NEVER be redefined:

```python
id            String(50)   PK
uuid          String(36)   Unique, auto-generated
tenant_id     String(50)   Indexed
company_id    String(50)   FK → companies.id
branch_id     String(50)   FK → branches.id
created_at    DateTime(tz) Auto-set on insert
modified_at   DateTime(tz) Auto-set on insert + update
created_by    String(100)
updated_by    String(100)
is_active     Boolean      Default True
is_deleted    Boolean      Default False
deleted_at    DateTime(tz)
deleted_by    String(100)
version       Integer      Default 1
workflow_status String(30)
document_number String(80)
```

---

## §2. Module Table Inventory

**Total tables:** 203 | **Model files:** 47 | **Alembic migrations:** 72

### §2.1 Tenant & Organization (2 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `companies` | `Company` | `tenant.py` | 1 |
| `branches` | `Branch` | `tenant.py` | 1 |

### §2.2 Authentication & Users (2 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---:|:---:|
| `users` | `User` | `auth.py` | 1 |
| `user_sessions` | `UserSession` | `auth.py` | 2 |

### §2.3 Security & RBAC (8 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `smriti_roles` | `SmritiRole` | `security.py` | 1 |
| `smriti_permissions` | `SmritiPermission` | `security.py` | 1 |
| `smriti_permission_sets` | `SmritiPermissionSet` | `security.py` | 2 |
| `smriti_role_permission_sets` | `SmritiRolePermissionSet` | `security.py` | 2 |
| `smriti_permission_set_permissions` | `SmritiPermissionSetPermission` | `security.py` | 2 |
| `smriti_user_roles` | `SmritiUserRole` | `security.py` | 2 |
| `smriti_menus` | `SmritiMenu` | `security.py` | 2 |
| `smriti_security_audits` | `SmritiSecurityAudit` | `security.py` | 3 |

### §2.4 Roles (1 table)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `roles` | `Role` | `role.py` | 2 |

### §2.5 User Assignments (3 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `user_company_assignments` | `UserCompanyAssignment` | `user_assignment.py` | 2 |
| `user_branch_assignments` | `UserBranchAssignment` | `user_assignment.py` | 2 |
| `user_store_assignments` | `UserStoreAssignment` | `user_assignment.py` | 2 |

### §2.6 Inventory (16 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `products` | `Product` | `inventory.py` | 1 |
| `product_barcodes` | `ProductBarcode` | `inventory.py` | 1 |
| `stock_movements` | `StockMovement` | `inventory.py` | 1 |
| `stores` | `Store` | `inventory.py` | 2 |
| `warehouses` | `Warehouse` | `inventory.py` | 2 |
| `product_vendors` | `ProductVendor` | `inventory.py` | 2 |
| `product_tax_profiles` | `ProductTaxProfile` | `inventory.py` | 2 |
| `product_inventory_policies` | `ProductInventoryPolicy` | `inventory.py` | 3 |
| `stock_counts` | `StockCount` | `inventory.py` | 2 |
| `stock_count_items` | `StockCountItem` | `inventory.py` | 2 |
| `stock_adjustments` | `StockAdjustment` | `inventory.py` | 2 |
| `stock_transfers` | `StockTransfer` | `inventory.py` | 2 |
| `stock_transfer_items` | `StockTransferItem` | `inventory.py` | 2 |
| `stock_transfer_shipments` | `StockTransferShipment` | `inventory.py` | 3 |
| `replenishment_plans` | `ReplenishmentPlan` | `inventory.py` | 3 |
| `replenishment_items` | `ReplenishmentItem` | `inventory.py` | 3 |

### §2.7 Sales (14 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `sales_invoices` | `SalesInvoice` | `sales.py` | 1 |
| `sales_invoice_items` | `SalesInvoiceItem` | `sales.py` | 1 |
| `sales_payments` | `SalesPayment` | `sales.py` | 1 |
| `sales_orders` | `SalesOrder` | `sales.py` | 1 |
| `sales_order_items` | `SalesOrderItem` | `sales.py` | 1 |
| `sales_quotations` | `SalesQuotation` | `sales.py` | 2 |
| `sales_quotation_items` | `SalesQuotationItem` | `sales.py` | 2 |
| `sales_returns` | `SalesReturn` | `sales.py` | 2 |
| `sales_return_items` | `SalesReturnItem` | `sales.py` | 2 |
| `credit_notes` | `CreditNote` | `sales.py` | 2 |
| `fulfillment_waves` | `FulfillmentWave` | `sales.py` | 3 |
| `pick_lists` | `PickList` | `sales.py` | 3 |
| `pick_list_items` | `PickListItem` | `sales.py` | 3 |
| `shipment_packages` | `ShipmentPackage` | `sales.py` | 3 |

### §2.8 Purchase (37 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `suppliers` | `Supplier` | `purchase.py` | 1 |
| `purchase_orders` | `PurchaseOrder` | `purchase.py` | 1 |
| `purchase_order_items` | `PurchaseOrderItem` | `purchase.py` | 1 |
| `purchase_receipts` | `PurchaseReceipt` | `purchase.py` | 1 |
| `purchase_receipt_items` | `PurchaseReceiptItem` | `purchase.py` | 1 |
| `supplier_tax_profiles` | `SupplierTaxProfile` | `purchase.py` | 2 |
| `supplier_compliance_profiles` | `SupplierComplianceProfile` | `purchase.py` | 2 |
| `supplier_payment_profiles` | `SupplierPaymentProfile` | `purchase.py` | 2 |
| `supplier_credit_profiles` | `SupplierCreditProfile` | `purchase.py` | 2 |
| `supplier_bank_details` | `SupplierBankDetails` | `purchase.py` | 2 |
| `supplier_addresses` | `SupplierAddress` | `purchase.py` | 2 |
| `supplier_contacts` | `SupplierContact` | `purchase.py` | 2 |
| `vendor_contracts` | `VendorContract` | `purchase.py` | 2 |
| `vendor_contract_tiers` | `VendorContractTier` | `purchase.py` | 3 |
| `three_way_matches` | `ThreeWayMatch` | `purchase.py` | 2 |
| `three_way_match_lines` | `ThreeWayMatchLine` | `purchase.py` | 2 |
| `landed_cost_vouchers` | `LandedCostVoucher` | `purchase.py` | 3 |
| `procurement_tolerance_policies` | `ProcurementTolerancePolicy` | `purchase.py` | 3 |
| `procurement_rfqs` | `ProcurementRFQ` | `purchase.py` | 2 |
| `procurement_rfq_items` | `ProcurementRFQItem` | `purchase.py` | 2 |
| `procurement_rfq_vendors` | `ProcurementRFQVendor` | `purchase.py` | 2 |
| `vendor_quotations` | `VendorQuotation` | `purchase.py` | 2 |
| `vendor_quotation_items` | `VendorQuotationItem` | `purchase.py` | 2 |
| `quotation_evaluations` | `QuotationEvaluation` | `purchase.py` | 3 |
| `purchase_reorder_configs` | `PurchaseReorderConfig` | `purchase.py` | 3 |
| `purchase_jurisdiction_configs` | `PurchaseJurisdictionConfig` | `purchase.py` | 3 |
| `blanket_purchase_agreements` | `BlanketPurchaseAgreement` | `purchase.py` | 3 |
| `blanket_purchase_agreement_lines` | `BlanketPurchaseAgreementLine` | `purchase.py` | 3 |
| `requisition_approval_policies` | `RequisitionApprovalPolicy` | `purchase.py` | 3 |
| `purchase_requisitions` | `PurchaseRequisition` | `purchase.py` | 2 |
| `purchase_requisition_lines` | `PurchaseRequisitionLine` | `purchase.py` | 2 |
| `requisition_approvals` | `RequisitionApproval` | `purchase.py` | 2 |
| `quality_inspections` | `QualityInspection` | `purchase.py` | 2 |
| `quality_inspection_items` | `QualityInspectionItem` | `purchase.py` | 2 |
| `supplier_debit_notes` | `SupplierDebitNote` | `purchase.py` | 2 |
| `supplier_scorecards` | `SupplierScorecard` | `purchase.py` | 3 |
| `supplier_scorecard_metrics` | `SupplierScorecardMetric` | `purchase.py` | 3 |

### §2.9 CRM (8 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `customers` | `Customer` | `crm.py` | 1 |
| `customer_addresses` | `CustomerAddress` | `crm.py` | 1 |
| `pricing_groups` | `PricingGroup` | `crm.py` | 2 |
| `customer_groups` | `CustomerGroup` | `crm.py` | 2 |
| `customer_loyalty_points` | `CustomerLoyaltyPoints` | `crm.py` | 3 |
| `customer_price_overrides` | `CustomerPriceOverride` | `crm.py` | 3 |
| `customer_credit_limits` | `CustomerCreditLimit` | `crm.py` | 3 |
| `customer_channel_preferences` | `CustomerChannelPreference` | `crm.py` | 3 |

### §2.10 Accounting (4 tables — Phase 1 gaps identified)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `chart_of_accounts` | `ChartOfAccount` | `accounting.py` | 1 |
| `ledger_entries` | `LedgerEntry` | `accounting.py` | 1 |
| `accounting_periods` | `AccountingPeriod` | `accounting.py` | 2 |
| `payment_allocations` | `PaymentAllocation` | `accounting.py` | 2 |
| `financial_year` *(PLANNED)* | `FinancialYear` | `accounting.py` | 1 |
| `journal_entries` *(PLANNED)* | `JournalEntry` | `accounting.py` | 1 |

### §2.11 POS (4 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `pos_sessions` | `PosSession` | `pos.py` | 1 |
| `pos_transactions` | `PosTransaction` | `pos.py` | 1 |
| `pos_transaction_items` | `PosTransactionItem` | `pos.py` | 1 |
| `pos_offline_sync_queue` | `PosOfflineSyncQueue` | `pos.py` | 3 |

### §2.12 Tax & GST (3 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `gst_tax_settlements` | `GSTTaxSettlement` | `tax.py` | 2 |
| `gst_return_filings` | `GSTReturnFiling` | `tax.py` | 2 |
| `eway_bills` | `EwayBill` | `tax.py` | 2 |

### §2.13 Barcode & Identity (7 tables)
| Table | Model Class | Module | Tier |
|:---|:---|:---|:---:|
| `product_barcodes` | `ProductBarcode` | `barcode.py` | 2 |
| `barcode_templates` | `BarcodeTemplate` | `barcode.py` | 3 |
| `barcode_print_jobs` | `BarcodePrintJob` | `barcode.py` | 3 |
| `barcode_audit_log` | `BarcodeAuditLog` | `barcode.py` | 4 |
| `barcode_providers` | `BarcodeProvider` | `product_identity.py` | 3 |
| `identity_rules` | `IdentityRule` | `product_identity.py` | 3 |
| `product_identities` | `ProductIdentity` | `product_identity.py` | 2 |

### §2.14 Remaining Modules (102 tables across 30 files)
*(approval, attachment, analytics, apparel, attributes, consignment, dispatch, ecommerce, ecosystem, exchange, franchise, integration_hub, loyalty, master_lookup, nic_gst, notification, numbering, pharma, platform, psv, report_schedule, screen_studio, sip, size_master, sre, supplier_payment, system, terms, transfer, wms, workflow)*

Full specifications to be documented in v1.1 iterative updates.

---

## §3. Ownership Matrix

| Business Entity | Owning Module | Table | Access Rule |
|:---|:---|:---|:---|
| Product | Inventory | `products` | Only via `ProductRepository` |
| Customer | CRM | `customers` | Only via `CustomerRepository` |
| Supplier | **Purchase** | `suppliers` | CRM reads via `/api/internal/v1/suppliers` |
| Sales Invoice | Sales | `sales_invoices` | Only via `SalesRepository` |
| Purchase Order | Purchase | `purchase_orders` | Only via `PurchaseRepository` |
| POS Session | POS | `pos_sessions` | Only via `PosEngine` |
| Ledger Entry | Accounting | `ledger_entries` | Only via `AccountingRepository` |
| Company/Branch | Tenant | `companies`, `branches` | Read-only via `TenantContext` |
| User | Auth | `users` | Only via `AuthService` |
| Role/Permission | Security | `smriti_roles`, `smriti_permissions` | Only via `SecurityService` |

---

## §4. Domain Event Mapping (Current State)

| Table | Event Published | Subscriber |
|:---|:---|:---|
| `pos_transactions` | `SaleCompleted`, `StockAdjusted` | Accounting, Analytics, Inventory |
| `sales_invoices` | `SaleCompleted` (create), `InvoiceCancelled` (cancel) | Accounting |
| `stock_adjustments` | `StockAdjusted` (per reconciled line) | Inventory Ledger |
| All others | *(not yet wired)* | — |

---

## §5. Tier Classification

| Tier | Definition | Count (est.) |
|:---|:---|:---:|
| **Tier 1** | Core business transaction tables — highest test + governance priority | ~25 |
| **Tier 2** | Supporting master & transaction-support tables | ~70 |
| **Tier 3** | Configuration, policy & operational tables | ~70 |
| **Tier 4** | Integration, connector & external system tables | ~20 |
| **Tier 5** | Analytics, cache & temporary tables | ~18 |

### Tier 1 Tables (Highest Governance Priority)
`products` · `customers` · `suppliers` · `sales_invoices` · `sales_invoice_items` · `sales_orders` · `purchase_orders` · `purchase_receipts` · `stock_movements` · `pos_sessions` · `pos_transactions` · `chart_of_accounts` · `ledger_entries` · `companies` · `branches` · `users` · `smriti_roles` · `smriti_permissions` · `financial_year` *(planned)* · `journal_entries` *(planned)*

---

## §6. Migration Governance

All migrations must follow DBP-003 traceability header:
```python
"""<Migration description>

DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §<section>
CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — <Entity> (if applicable)
ADR Reference : ADR-<number>
Revision ID   : <alembic revision hash>
"""
```

Current migration count: **72 revisions** (pre-DBP — exempt from retroactive enforcement)
All new migrations from 2026-07-28 onward: **DBP-003 mandatory**.
