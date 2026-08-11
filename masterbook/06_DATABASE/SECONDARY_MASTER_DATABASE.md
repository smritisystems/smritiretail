# SMRITI RETAIL OS — SECONDARY MASTER DATABASE ARCHITECTURE SPECIFICATION
**Document ID:** MBOOK-DB-SEC-001  
**Version:** 1.0.0 (Phase 3 Architectural Baseline)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Architectural Specification — FROZEN BASELINE  

---

## 1. Executive Summary & Purpose

This specification defines the canonical Secondary Master Database (`smriti_master_hub`) architecture, Master Exchange Hub principles, versioning schemas, mapping boundaries, and security governance for SMRITI Retail OS.

The Secondary Master Database serves as an **opt-in Master Exchange Hub**. It enables legal business entities (Companies) to publish and fetch shared master metadata (e.g. Products, Brands, Categories, UOMs, Barcodes, HSN Codes) without:
1. Replacing local Company DB master authority.
2. Forcing automatic database synchronization across companies.
3. Exposing private operational/financial values (stock, selling price, purchase cost, ledger balances, customer/supplier ledgers).
4. Creating cross-database relational SQL foreign keys.

---

## 2. Master Exchange Hub Architecture Topology

```text
                    ┌──────────────────┐
                    │   CONTROL DB     │
                    │ Users / RBAC     │
                    │ Companies        │
                    │ DB Registry      │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        Company A DB   Company B DB   Company C DB
        Own Masters    Own Masters    Own Masters
              │              │              │
              └──────────────┼──────────────┘
                             │
                       OPTIONAL
                    PUBLISH / FETCH
                             │
                             ▼
                  ┌────────────────────┐
                  │ SECONDARY MASTER   │
                  │    smriti_master_hub
                  │                    │
                  │ Master Exchange    │
                  │ Hub                │
                  └────────────────────┘
```

---

## 3. Five Mandatory Safeguards

1. **Hub is NOT a Global Master Owner:** The Secondary Master DB stores exchange representations. The local Company DB remains 100% authoritative for its own operational master data and ledgers.
2. **No Automatic Synchronization:** Master exchange operates strictly via explicit, authenticated `PUBLISH` and `FETCH`. `check_for_updates()` returns `UPDATE_AVAILABLE` notifications only and NEVER mutates Company DB records automatically.
3. **Never Publish Operational Values:** Payloads strictly sanitize and exclude operational/financial attributes (stock balances, selling price, purchase cost, ledger balances, customer/supplier credit outstanding, sales/purchase history).
4. **Company Code is Metadata, NOT Authorization:** Security is enforced strictly via Control DB user assignments, permissions, and policy rules. Client-supplied `company_code` headers/claims cannot bypass authorization.
5. **Granular Per-Master-Type Policy:** Policies support granular `ALL`, `SELECTED`, `NONE` options per company and master type (`publish_enabled`, `fetch_enabled`).

---

## 4. Master Hub Database Schemas (8 Tables)

- `master_hub_types`: Master type registry (`Product`, `Item`, `Brand`, `Category`, `SubCategory`, `Department`, `UOM`, `Size`, `Color`, `Shade`, `HSN`, `Barcode`, `SupplierIdentity`, `CustomerIdentity`).
- `master_hub_records`: Universal master record identities (`hub_master_id` UUID, `source_company_id`, `source_company_code`, `source_record_id`, `latest_version`, `status`).
- `master_hub_versions`: Immutable versioned snapshot payloads (`version`, `payload_json`, `checksum`, `published_by`, `published_at`).
- `master_hub_publications`: Publication event log.
- `master_hub_imports`: Per-company import status (`target_company_id`, `hub_master_id`, `version_imported`, `local_record_id`, `import_status`, `update_status`).
- `master_hub_mappings`: Bi-directional reference mapping (`hub_master_id` <-> local `local_record_id`). Tracks relationships without owning local records.
- `master_hub_policies`: Per-company, per-master-type policy rules (`publish_enabled`, `fetch_enabled`, `auto_accept`, `conflict_policy`).
- `master_hub_audits`: Immutable audit trail for all `PUBLISH`, `FETCH`, `ACCEPT`, `REJECT`, `UPDATE`, `UNPUBLISH`, `DEPRECATE` operations.

---

## 5. Universal Master Identity (`hub_master_id`)

A Master Hub record possesses its own immutable UUID identity (`hub_master_id` = `hub-{hex12}`).

Mapping structure:
```text
H-1001 (Universal Identity)
 ├── Company A → local product A-123
 ├── Company B → local product B-778
 └── Company C → local product C-441
```

Each local Company DB retains complete authority over its local PK (`A-123`, `B-778`, `C-441`) and local price/stock/tax configurations.
