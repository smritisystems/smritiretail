# Contributing to SMRITI Retail OS

Thank you for contributing to SMRITI Retail OS! Please read and follow these mandatory architectural guardrails before creating pull requests or adding features.

---

## Mandatory Product Mode Rules

### 1. PROD-001 — Customer Value Priority
Every code change must directly help retailers sell faster, buy better, manage inventory more accurately, or comply with statutory regulations.

### 2. PROD-002 / SWP-001 — Single Workspace Principle (FROZEN P0)
> **There shall be exactly one Billing Workspace, one Purchase Workspace, one Inventory Workspace, and one Universal Person Workspace. Business behavior must be determined by policies, customer/supplier profiles, document type, and configuration—not by duplicate screens, menus, or modules.**

#### Mandatory AI & Developer Decision Checklist:
```text
STEP 1: Does this capability already exist?
        ↳ YES ──► REUSE (Rule PBC-001)

STEP 2: Can an existing Workspace adapt through Policy?
        ↳ YES ──► Extend Policy Engine (CustomerPolicyEngine, SupplierPolicyEngine, PersonPolicyEngine)

STEP 3: Will this create a duplicate menu, screen, master, or registry?
        ↳ YES ──► REJECT IMMEDIATELY and redesign within the Single Workspace.
```

---

## The Four Universal Workspaces

1. **Billing Workspace (`sales-billing-studio`):** One single workspace for all Billing (Walk-In, Retail, GST, Corporate, Export, Wholesale).
2. **Purchase Workspace (`purchase-studio`):** One single workspace for all Purchase Operations (PO, GRN, Vendor Invoices).
3. **Inventory Workspace (`item-master`):** One single workspace for Product Master, Stock Ledger, Consignment, Stock Transfers.
4. **Universal Person Workspace (`crm-studio`):** One single workspace for Customers, Suppliers, Staff, Sales Executives, Drivers.
