# PROD-002 — Single Workspace Principle (SWP-001)

**Status:** 🔒 **FROZEN (Product Mode Charter v1.0)**  
**Priority:** P0 (Mandatory)  
**Applies To:** All Developers, AI Agents, Contributors, Extensions, Future Modules  

---

## Principle

> **There shall be exactly one Billing Workspace, one Purchase Workspace, one Inventory Workspace, and one Universal Person Workspace. Business behavior must be determined by policies, customer/supplier profiles, document type, and configuration—not by duplicate screens, menus, or modules.**

---

## Objectives

SMRITI Retail OS shall never evolve into duplicate billing/purchasing/master screens:
- ❌ POS Billing
- ❌ Sales Billing
- ❌ Retail Billing
- ❌ GST Billing
- ❌ Corporate Billing
- ❌ B2B Billing
- ❌ Export Billing

Instead:
- ✅ **ONE Billing Workspace** (`sales-billing-studio`) that automatically adapts via `CustomerPolicyEngine`.
- ✅ **ONE Purchase Workspace** (`purchase-studio`) that automatically adapts via `SupplierPolicyEngine`.
- ✅ **ONE Inventory Workspace** (`item-master`) that automatically adapts via `InventoryPolicyEngine`.
- ✅ **ONE Universal Person Workspace** (`crm-studio`) that automatically adapts via `PersonPolicyEngine`.

---

## Workspace Architecture Workflow

```text
Billing Workspace
        │
        ▼
Customer Selection ("Who is the customer?")
        │
        ▼
Customer Policy Engine
        │
        ▼
──────────────────────────────────
Retail Customer
Wholesale Customer
GST Customer
Corporate Customer
Export Customer
Walk-in Customer
Credit Customer
Cash Customer
──────────────────────────────────
        │
        ▼
Dynamic Workspace Adaptation (Price Group, Tax Group, Payment Terms, Print Format)
        │
        ▼
Same Billing Screen
```

---

## Mandatory AI Decision Matrix

| Request | Action | Rationale |
| --- | --- | --- |
| **New Billing Screen** | ❌ Reject | Adapt existing `SalesBillingStudio` via `CustomerPolicyEngine` |
| **New Purchase Screen** | ❌ Reject | Adapt existing `PurchaseStudio` via `SupplierPolicyEngine` |
| **New Inventory Screen** | ❌ Reject | Adapt existing `ItemMaster` via `InventoryPolicyEngine` |
| **New Customer/Supplier/Staff Master** | ❌ Reject | Adapt existing `Universal Person Workspace` |
| **Extend Existing Workspace** | ✅ Allowed | Promotes platform reuse (`PBC-001`) |
| **Add Customer/Supplier Policy** | ✅ Allowed | Policy-driven ERP philosophy |
| **Add Configuration / Rules** | ✅ Allowed | Metadata-driven platform configuration |

---

## Mandated Tags & Identifiers

- **Tag:** `PROD-002`
- **Alias:** `SWP-001` (Single Workspace Principle)
- **Keywords:** `#SingleWorkspace`, `#PolicyDrivenERP`, `#NoDuplicateModules`, `#CustomerFirst`, `#OneWorkspaceManyBehaviors`
