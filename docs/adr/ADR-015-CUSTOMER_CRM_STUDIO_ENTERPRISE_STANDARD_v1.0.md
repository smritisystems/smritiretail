# Architecture Decision Record (ADR-015)
# CUSTOMER_CRM_STUDIO_ENTERPRISE_STANDARD_v1.0 (CRM DOMAIN)

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Base Layer:** Consumes `SMRITI_ENTERPRISE_WORKSPACE_STANDARD_v1.0` (ADR-020 Layer 1 UX Framework)  
**Scope:** Customer CRM & Loyalty Governance Architecture  

---

## Executive Summary

`CUSTOMER_CRM_STUDIO_ENTERPRISE_STANDARD_v1.0` defines the frozen domain-specific architecture for Customer CRM & Loyalty Management across SMRITI Retail OS. It inherits the **Common Workspace UX Framework (`ADR-020`)** for layout rules, while establishing CRM-specific capabilities: Temporary Customer Staging Queue, Master Data Customer Approval Workflow, Collapsible Visual Customer Directory Gallery, Credit Limit & Days Governance, Loyalty Membership Tiers, and Receivables Summary Cards.

---

## 1. DOMAIN BOUNDARIES & ISOLATION

Customer CRM Studio **strictly adheres to domain isolation**:

- **Inherits Layer 1 (`ADR-020`)**: Hero banner (~55px), single-row ERP toolbar, full-width fluid layout (100%), SUPG data grid contracts, right-docked credit summary, and SWMF pop-out window triggers.
- **DOES NOT INHERIT Procurement or Inventory Features**: Does not contain Procurement Temporary Product Engines, Supplier Workflows, or SKU Barcode Hubs.

---

## 2. CRM DOMAIN CAPABILITY MATRIX

| Capability | Scope & Description | Platform Entry Point |
|---|---|---|
| **Temporary Customer Staging** | Instant on-the-fly customer entry for POS billing; tagged `PENDING_APPROVAL` | `CustomerMasterTab` Staging Engine |
| **Master Data Customer Approval** | Review & promote temporary POS customer records into Permanent Customer Masters | `CreateCustomerCommand` |
| **Collapsible Customer Gallery** | Visual card gallery with Customer Logo/Photo, Code, Loyalty Tier, & Credit Balance | `CustomerMasterTab` Gallery |
| **Credit Governance** | Credit limit, credit days, outstanding receivables, & overdue risk indicators | `ICustomerService` |
| **Loyalty & Wallet Rewards** | Loyalty points, membership tiers (Silver, Gold, Platinum, Diamond), & wallet balance | `SPK.services` |
| **CRM Quick Filter Pills** | Instant filtering by Corporate B2B, Retail B2C, & Pending Approval status | SUPG Filter Bar |

---

## 3. CRM CONFIGURATION METADATA (`SPK.configuration`)

```yaml
CustomerCRMStudio:
  enableTemporaryCustomers: true
  requireApprovalForCustomerMaster: true
  enableCustomerGallery: true
  defaultCustomerGroup: "CG-Retail"
  defaultCreditLimit: 25000
  defaultCreditDays: 30
  enableLoyaltyRewards: true
  loyaltyPointsPerHundred: 10
```
