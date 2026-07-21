<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# SMRITI Global Naming Convention Standard (SGNCS) — v1.0

**Status:** MANDATORY — PERMANENT — ALL agents, ALL sessions, ALL modules  
**Effective:** 2026-07-21

---

## 1. Objective & Scope
The **SMRITI Global Naming Convention Standard (SGNCS)** establishes canonical, enterprise-grade naming conventions across the entire SMRITI Retail OS ecosystem. It enforces consistency across Domain Objects, Database Tables, ORM Models, DTOs/Schemas, Services, Repositories, REST APIs, Enums, System Events, SSACF Permissions, Test Files, Database Migrations, and Governance Documentation.

---

## 2. Naming Standards Matrix

| Engineering Artifact | Convention Format | Example Target | Counter-Example (Prohibited) |
|---|---|---|---|
| **Domain Entities / Models** | UpperCamelCase (Singular) | `VendorContract`, `ProductVendor` | `vendor_contracts`, `ProductVendors` |
| **SQL Database Tables** | snake_case (Plural) | `vendor_contracts`, `product_vendors` | `VendorContract`, `vendor_contract` |
| **Primary / Foreign Keys** | snake_case + `_id` | `contract_id`, `supplier_id` | `contractId`, `contract_fk` |
| **Pydantic DTO Schemas** | UpperCamelCase + `[Create/Update/Response]` | `VendorContractCreate`, `VendorContractResponse` | `CreateContractDTO`, `vendorContractSchema` |
| **Service Orchestrators** | UpperCamelCase + `Service` / `Engine` | `PurchaseService`, `ProcurementEngine` | `purchase_handler`, `PurchaseManager` |
| **Domain Resolvers** | UpperCamelCase + `Resolver` | `VendorResolver`, `ContractResolver` | `resolve_vendor_helper` |
| **REST API Route Files** | snake_case (Plural noun area) | `purchase_contracts.py`, `product_vendors.py` | `purchaseContracts.py`, `contract_api.py` |
| **REST API Path Slugs** | kebab-case (Plural) | `/api/v1/purchase/contracts`, `/api/v1/suppliers` | `/api/v1/purchaseContracts`, `/api/v1/vendor_contract` |
| **SSACF Permissions** | lowercase:dot:delimited | `purchase.contract.create`, `inventory.vendor.resolve` | `PURCHASE_CONTRACT_CREATE`, `purchase-contract-add` |
| **Domain Enums** | PascalCase enum, UPPER_SNAKE values | `ContractLifecycleStage.ACTIVE` | `contract_lifecycle.active` |
| **System Events** | Domain:Subdomain:Verb | `Procurement:Contract:Approved`, `Procurement:PO:Sourced` | `contract_approved_event` |
| **Alembic Migrations** | `v<Version>_<snake_case_description>.py` | `v570_vendor_contracts_and_tiered_pricing.py` | `migration_123.py`, `v5.7.0.py` |
| **Integration Test Files** | `test_<snake_case_feature>.py` | `test_vendor_contract.py`, `test_product_vendor.py` | `vendor_contract_test.py`, `TestContracts.py` |
| **Walkthrough Artifacts** | `<Area>_<Topic>_v<Version>.md` | `Procurement_VendorContract_Master_v5.7.0.md` | `v5.7_walkthrough.md`, `contract_doc.md` |
| **Implementation Plans** | `<Topic>_Plan_v<Version>.md` | `Vendor_Contracts_And_POSourcing_Plan_v5.7.0.md` | `plan1.md` |
| **ADR Documents** | `ADR-<NNN>-<Snake_Case_Title>.md` | `ADR-056-Vendor_Contract_Aggregate_Model.md` | `adr56.md` |

---

## 3. Domain Terminology Rules

### Primary Domain Term: Vendor
- In all enterprise procurement contexts, **Vendor** is the primary business term (`VendorContract`, `ProductVendor`, `VendorResolver`).
- `supplier_id` and `suppliers` table references are retained exclusively as legacy database storage aliases for backward compatibility.
- New user interfaces, DTOs, walkthroughs, and service APIs must use **Vendor** terminology exclusively.

---

## 4. Currency Governance Standard

1. **Source Currency Preservation**:
   - `VendorContract` stores tier unit costs in the supplier's agreed commercial currency (`currency_id`).
2. **Dynamic Resolution & Conversion**:
   - Currency exchange conversions occur dynamically during procurement resolution, never by mutating saved contract line items.
3. **PO Currency Snapshots**:
   - `PurchaseOrderItem` snapshots both the contract unit price in foreign/source currency and the calculated local currency cost.

---

## 5. Compliance & Enforcement
All coding agents and human contributors must validate proposed file names, database tables, and schema attributes against this document prior to code commit.
