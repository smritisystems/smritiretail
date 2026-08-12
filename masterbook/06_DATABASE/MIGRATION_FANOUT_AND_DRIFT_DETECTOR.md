# Masterbook: Migration Fan-Out & Schema Drift Detection Governance

**Document ID:** `MBOOK-DB-MIG-001`  
**Classification:** Database Architecture Specification (Level-2 Platform Contract)  
**Status:** FROZEN — v1.0 (2026-08-12)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Scope:** Multi-Database Alembic DDL Migration Fan-Out & Schema Drift Governance  

---

## 1. Executive Summary

The **Migration Fan-Out & Schema Drift Detection Engine** (`CompanyMigrationFanoutService`, `CompanySchemaDriftDetector`) governs DDL schema synchronization across physically isolated company databases (`smriti_company_{company_code}`).

---

## 2. Core Architecture

```text
               ┌─────────────────────────────────┐
               │       CompanyBase.metadata      │
               │    Canonical Schema Model (v1)  │
               └────────────────┬────────────────┘
                                │ DDL Reflection & Inspection
                                ▼
               ┌─────────────────────────────────┐
               │    CompanySchemaDriftDetector   │
               └────────────────┬────────────────┘
                                │ Inspect Table / Column Delta
                                ▼
               ┌─────────────────────────────────┐
               │   CompanyMigrationFanoutService │
               └────────────────┬────────────────┘
                                │ DDL Synchronization
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
    ┌─────────────────┐┌─────────────────┐┌─────────────────┐
    │  COMPANY DB A   ││  COMPANY DB B   ││  COMPANY DB C   │
    │smriti_company_a ││smriti_company_b ││smriti_company_c │
    └─────────────────┘└─────────────────┘└─────────────────┘
```

---

## 3. Drift Detection States

1. **`IN_SYNC`:** Physical table names, column names, data types, and primary keys 100% match `CompanyBase.metadata`.
2. **`DRIFTED`:** Missing tables, extra tables, or missing columns detected in physical company database.
3. **`CRITICAL`:** Database connection failed or database corrupted.

---

## 4. Operational Rules

1. **Control vs Company Migration Lineage Isolation:** Control DB migrations (`alembic/versions/`) and Company DB migrations (`alembic/company_versions/`) MUST remain completely separate.
2. **Zero Invasiveness:** Schema drift inspection MUST run read-only metadata queries against PostgreSQL system catalogs (`pg_class`, `pg_attribute`, `information_schema.tables`).
