# SMRITI RETAIL OS — COMPANY DATABASE TEMPLATE SPECIFICATION
**Document ID:** MBOOK-DB-TMPL-001  
**Version:** 1.0.0 (Phase 2 Execution)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Architectural Specification — FROZEN BASELINE  

---

## 1. Executive Summary & Purpose

This specification defines the canonical Company Database Template (`company_db_template`) schema, session architecture, migration lineage, and isolation governance for SMRITI Retail OS.

Every legal business entity (Company) is provisioned an independent, physically isolated PostgreSQL database derived from this canonical template.

---

## 2. Company Database Schema Boundaries (184 Tables)

Each Company DB contains 100% of operational master data and transactional ledgers for that specific legal business entity:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      COMPANY DATABASE SCHEMAS                          │
 ├────────────────────────┬───────────────────────┬───────────────────────┤
 │ OPERATIONAL MASTERS    │ TRANSACTIONS & LEDGERS│ COMPLIANCE & POS      │
 ├────────────────────────┼───────────────────────┼───────────────────────┤
 │ • products             │ • sales_invoices      │ • pos_sessions        │
 │ • product_barcodes     │ • purchase_orders     │ • pos_transactions    │
 │ • customers            │ • stock_movements     │ • gst_return_filings  │
 │ • suppliers            │ • inventory_ledger    │ • eway_bills          │
 │ • warehouses & bins    │ • journal_vouchers    │ • wms_fulfillment     │
 │ • pricing_groups       │ • journal_entries     │ • consignment         │
 └────────────────────────┴───────────────────────┴───────────────────────┘
```

---

## 3. Declarative Base & Session Architecture

- **Declarative Base:** `app.db.company_base.CompanyBase` (alias bridging operational `BaseEntity` models). 100% decoupled from `ControlBase.metadata`.
- **Dynamic Pool Manager:** `app.db.company_session.company_db_pool_manager` manages bounded LRU AsyncEngine connection pools (`pool_size=5`, `max_overflow=10`, `pool_recycle=600`).
- **Server-Side Resolution:** Client requests supply ONLY `X-Company-Code` header or JWT claims. Database connection strings, credentials, hosts, and database names are resolved strictly server-side via Control DB.

---

## 4. Defense-in-Depth RLS Strategy

Physical database isolation serves as the **Primary Security Boundary**.

To enforce defense-in-depth security:
- `tenant_id`, `company_id`, `RowSecuredMixin`, and query filters remain active inside Company DB schemas.
- If a query filter omission occurs, physical database isolation guarantees Company A user queries execution strictly within `smriti_company_A` database.

---

## 5. Automated Provisioning Flow for New Companies

```text
 Create Company Request (Control DB)
                │
                ▼
 Generate Permanent Immutable Company Code (e.g. SMR001)
                │
                ▼
 Allocate Database Identifier (`smriti_company_smr001`)
                │
                ▼
 Run Canonical Company DB Schema Creation (`CompanyBase.metadata.create_all`)
                │
                ▼
 Verify Schema Fingerprint Hash (SHA-256)
                │
                ▼
 Seed Company Default Master Data (Tax Profiles, Document Series)
                │
                ▼
 Register Database Entry in Control DB (`status='ACTIVE'`)
```

---

## 6. Migration Lineage & Governance

- Control DB Alembic Lineage: `alembic/versions/` (Control DB migrations).
- Company DB Alembic Lineage: `alembic/company_versions/` (Isolated Company DB migrations).
- No Alembic migration file may mix Control DB schema changes with Company DB schema changes.
