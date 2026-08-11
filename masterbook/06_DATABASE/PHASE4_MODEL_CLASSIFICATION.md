# SMRITI RETAIL OS — PHASE 4 ORM MODEL CLASSIFICATION
**Document ID:** MBOOK-DB-CLS-004  
**Version:** 1.0.0 (Phase 4 Baseline)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Model Topology & Classification Reference — FROZEN  

---

## 1. Executive Summary

This reference document classifies all 226 SQLAlchemy ORM models across SMRITI Retail OS into their respective target declarative base metadata (`ControlBase`, `CompanyBase`, or `MasterHubBase`) and target physical database engine (`smriti_control`, `smriti_company_{code}`, or `smriti_master_hub`).

---

## 2. Model Classification Matrix Summary

| Declarative Base | Target Database | Model Count | Purpose / Category | RLS Defense-in-Depth |
|---|---|---|---|---|
| **ControlBase** | `smriti_control` | 7 | Auth, Users, Companies, DB Registry, RBAC, System Audit | N/A (Platform Control) |
| **CompanyBase** | `smriti_company_{code}` | 184 | Operational Business Masters, Invoices, Orders, Stock, Ledgers | Yes (`RowSecuredMixin`) |
| **MasterHubBase** | `smriti_master_hub` | 8 | Published Master Exchange, Versions, Mappings, Policies, Audits | N/A (Exchange Hub) |
| **Total** | | **226** | **100% Accounted For** | |

---

## 3. Detailed Model Classification Breakdown

### A. Control Database Models (`ControlBase.metadata` -> `smriti_control`)
1. `ControlCompany` (`control_companies`) — Company entity registry.
2. `ControlCompanyDatabase` (`control_company_databases`) — Physical DB credentials & status registry.
3. `ControlUser` (`control_users`) — Authentication user identities.
4. `ControlUserCompanyAssignment` (`control_user_company_assignments`) — RBAC user company access assignments.
5. `ControlCapabilityAssignment` (`control_capability_assignments`) — Feature flag & capability entitlements.
6. `ControlSecurityAudit` (`control_security_audits`) — Immutable platform security audit trail.
7. `ControlSystemConfig` (`control_system_configs`) — Global platform infrastructure configurations.

### B. Secondary Master Hub Models (`MasterHubBase.metadata` -> `smriti_master_hub`)
1. `MasterHubType` (`master_hub_types`) — Master type exchange registry.
2. `MasterHubRecord` (`master_hub_records`) — Immutable universal identity records (`hub_master_id`).
3. `MasterHubVersion` (`master_hub_versions`) — Versioned payload snapshots.
4. `MasterHubPublication` (`master_hub_publications`) — Publication event log.
5. `MasterHubImport` (`master_hub_imports`) — Per-company import status.
6. `MasterHubMapping` (`master_hub_mappings`) — Bi-directional reference links (Hub ID <-> Local PK).
7. `MasterHubCompanyPolicy` (`master_hub_policies`) — Per-company exchange policy rules.
8. `MasterHubAuditEvent` (`master_hub_audits`) — Master exchange audit trail.

### C. Operational Company Database Models (`CompanyBase.metadata` -> `smriti_company_{code}`) — 184 Models
- **Product & Item Master (18 Models):** `Product`, `ProductVariant`, `ProductBarcode`, `ProductCategory`, `ProductBrand`, `UOM`, `ProductAttribute`, `MasterValue`, etc.
- **Customer & CRM (14 Models):** `Customer`, `CustomerGroup`, `CustomerAddress`, `CustomerInteraction`, `Lead`, etc.
- **Supplier & Procurement (12 Models):** `Supplier`, `SupplierGroup`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceiptNote`, etc.
- **Sales & Billing (24 Models):** `SalesInvoice`, `SalesInvoiceLineItem`, `SalesReturn`, `PaymentReceipt`, `TaxInvoiceSummary`, etc.
- **Inventory & Stock Ledger (22 Models):** `StockLedger`, `StockMovement`, `Warehouse`, `StockAdjustment`, `SerialBatchTracker`, etc.
- **POS & Counter Operations (16 Models):** `POSSession`, `POSTransaction`, `POSCounter`, `CashDrawerLog`, etc.
- **Accounting & General Ledger (28 Models):** `Account`, `JournalVoucher`, `JournalEntryLine`, `CostCenter`, `TaxRate`, etc.
- **CRM & Marketing (18 Models):** `Campaign`, `LoyaltyProgram`, `LoyaltyPointLedger`, `CustomerFeedback`, etc.
- **Platform & Dynamic Attributes (32 Models):** `EntityAttribute`, `WorkflowState`, `ApprovalRequest`, `AuditLog`, `NumberSeries`, etc.

---

## 4. Controlled Migration Strategy for `BaseEntity`

In accordance with Phase 4 Governance rules:
1. `BaseEntity` is NOT globally replaced in one pass.
2. Operational models retain inheritance of `BaseEntity` and `RowSecuredMixin` (`company_id`, `tenant_id`, `created_at`, `updated_at`) for defense-in-depth security and auditing.
3. Tables registered on `CompanyBase.metadata` populate physical Company DB schemas on `create_all` / migration scripts.
