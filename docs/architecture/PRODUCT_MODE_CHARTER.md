# SMRITI Product Philosophy & Product Mode Charter

**By Jawahar R. Mallah**  
*Founder, CEO & Chief Systems Architect*

---

> **"Simplicity is the highest form of enterprise software."**

### Core Principle
> **"There shall be exactly one Billing Workspace, one Purchase Workspace, one Inventory Workspace, and one Universal Person Workspace. Business behavior shall be determined by policies, customer/supplier profiles, document type, and configuration—not by duplicate screens, menus, or modules."**

### Design Promise
> **"A retailer should think about selling products—not about which billing screen to open. SMRITI adapts to the business, so the business never has to adapt to the software."**

### Founder's Vision
> **"One Workspace. Infinite Business Scenarios."**

---

## Mandated Product Mode Rules

### 1. PROD-001 — Customer Value Priority (P0 Mandatory)
Every code change must directly help retailers sell faster, buy better, manage inventory more accurately, or comply with statutory regulations.

### 2. PROD-002 / SWP-001 — Single Workspace Principle (FROZEN P0)
There shall be exactly **one Billing Workspace**, **one Purchase Workspace**, **one Inventory Workspace**, and **one Universal Person Workspace**. Business behavior is determined by policies, customer profiles, and document types—NOT by duplicate screens or modules.

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
