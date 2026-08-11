# SMRITI RETAIL OS — CONTROL DATABASE ARCHITECTURE SPECIFICATION
**Document ID:** MBOOK-DB-CTRL-001  
**Version:** 1.0.0 (Phase 1 Execution)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Architectural Specification — FROZEN BASELINE  

---

## 1. Executive Summary & Purpose

This specification defines the canonical architecture, schema, session governance, and security model for the **SMRITI Control Database (`smriti_control`)**.

The Control Database acts as the central authority across all physically isolated Company Databases in the SMRITI Retail OS ecosystem.

---

## 2. Core Responsibilities & Domain Boundaries

The Control Database owns:
1. **Central User Authentication & Identities (`control_users`)**
2. **Multi-Company & Multi-Tenant Registries (`control_companies`)**
3. **Physical Company Database Registry & Credential References (`control_company_databases`)**
4. **User-to-Company Authorization Assignments (`control_user_company_assignments`)**
5. **Feature & Module Capability Entitlements (`control_capability_assignments`)**
6. **Platform System Configurations (`control_system_configs`)**
7. **Cross-Tenant Security Access Audit Logs (`control_security_audits`)**

```text
               ┌──────────────────────────────────────────────┐
               │              CONTROL DATABASE                │
               │             (`smriti_control`)               │
               ├──────────────────────────────────────────────┤
               │ • Users & Credentials                        │
               │ • Companies & Branches Registry              │
               │ • Database Registry (Status/Revisions/Hashes) │
               │ • User Access Assignments                    │
               │ • Capabilities & Entitlements                │
               │ • System Configs                             │
               │ • Security Audit Log                         │
               └──────────────────────┬───────────────────────┘
                                      │
                         Database Connection Resolver
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
      Company DB (SMR001)                       Company DB (SMR002)
   (`smriti_company_smr001`)                 (`smriti_company_smr002`)
```

---

## 3. Schema & Model Specifications

### 3.1 `ControlBase` Metadata Decoupling
- **Module:** `app.db.control_base.ControlBase`
- Completely decoupled from `BaseEntity.metadata` to guarantee zero metadata collision between Control DB and operational Company DBs.

### 3.2 Canonical Control DB Tables

| Table Name | Entity Class | Primary Key | Description |
|---|---|---|---|
| `control_companies` | `ControlCompany` | `id` (VARCHAR 64) | Legal business entity registry. Immutable `company_code`. |
| `control_company_databases` | `ControlCompanyDatabase` | `id` (VARCHAR 64) | Physical DB connection registry, credential references, schema revisions, fingerprints. |
| `control_users` | `ControlUser` | `id` (VARCHAR 64) | Single authoritative user identity and authentication credentials. |
| `control_user_company_assignments` | `ControlUserCompanyAssignment` | `id` (VARCHAR 64) | Explicit user access authorization mapping to companies. |
| `control_capability_assignments` | `ControlCapabilityAssignment` | `id` (VARCHAR 64) | Module entitlements (POS, Inventory, WMS, CRM, etc.) per company. |
| `control_system_configs` | `ControlSystemConfig` | `id` (VARCHAR 64) | Centralized system flags and environment configuration settings. |
| `control_security_audits` | `ControlSecurityAudit` | `id` (VARCHAR 64) | Security audit trail for authentication, company switches, and access decisions. |

---

## 4. Security & Credential Isolation Rules

1. **Credential Protection:**
   `ControlCompanyDatabase.to_public_dict()` MUST NEVER expose `encrypted_credentials`, `secrets_ref`, `db_user`, `db_host`, or `db_name` in public/API responses.
2. **Parameter Escalation Prevention:**
   `ControlDatabaseRegistryService.verify_user_company_access(db, user_id, company_code)` strictly validates user authorization in Control DB before yielding a connection to any target database.
3. **Database Registry Lifecycle Enum:**
   Statuses strictly governed by `DatabaseRegistryStatus`:
   `PROVISIONING` ──► `ACTIVE` ──► `SUSPENDED` / `MIGRATING` / `FAILED` / `DRIFTED` / `ARCHIVED`.

---

## 5. Session Factory & Dependency Injection

- **Engine:** `control_engine` (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`).
- **Sessionmaker:** `control_async_session_maker`.
- **FastAPI Dependency:** `get_control_db()`.
