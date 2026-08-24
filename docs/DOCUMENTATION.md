<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: MASTER DOCUMENTATION INDEX & GOVERNANCE CATALOG
-->

# SMRITI RETAIL OS — MASTER DOCUMENTATION INDEX

**Status:** **ACTIVE CANONICAL REPOSITORY INDEX**  
**Effective Date:** 2026-08-17

This index serves as the single authoritative navigation registry for all architecture specifications, governance guidelines, implementation plans, and verification audit artifacts across the SMRITI Retail OS repository.

---

## 1. Primary Canonical Architecture Specification

| Document | Classification | Scope & Description |
|---|---|---|
| [`docs/architecture/MULTI_COMPANY_2.md`](file:///F:/SMRITRretailNX/docs/architecture/MULTI_COMPANY_2.md) | **CANONICAL** | **Single Source of Truth** for SMRITI multi-company database topology, Control Plane governance, routing resolver, and operational isolation. |

---

## 2. Governance Directives & AI Agent Rules

| Document | Classification | Scope & Description |
|---|---|---|
| [`docs/AI_AGENT.md`](file:///F:/SMRITRretailNX/docs/AI_AGENT.md) | **MANDATORY GOVERNANCE** | The 10 Golden Rules that every AI agent and developer must follow before proposing or making database/architecture modifications. |
| [`.agents/AGENTS.md`](file:///F:/SMRITRretailNX/.agents/AGENTS.md) | **CORE GOVERNANCE** | Universal code verification, test output, diff reporting, and author header governance rules. |

---

## 3. Current Subsystem Architecture Documents

| Document | Classification | Scope & Description |
|---|---|---|
| [`docs/architecture/DATABASE_ROUTING.md`](file:///F:/SMRITRretailNX/docs/architecture/DATABASE_ROUTING.md) | **CURRENT SPECIFICATION** | Dynamic database resolver runtime execution, naming conventions, and connection lifecycle. |
| [`docs/architecture/PRODUCT_IDENTITY_13.md`](file:///F:/SMRITRretailNX/docs/architecture/PRODUCT_IDENTITY_13.md) | **CURRENT SPECIFICATION** | Product Identity Engine (PIE) central schemas and barcode provider infrastructure. |
| [`docs/architecture/PSV_ARCHITECTURE.md`](file:///F:/SMRITRretailNX/docs/architecture/PSV_ARCHITECTURE.md) | **CURRENT SPECIFICATION** | Party Stock Visibility (PSV) shadow inventory projection engine and boundaries. |
| [`DEVELOPMENT_STATUS.md`](file:///F:/SMRITRretailNX/DEVELOPMENT_STATUS.md) | **CURRENT STATUS** | Master module matrix and implementation progress tracking. |

---

## 4. Current Audit & Certification Artifacts (2026-08-17)

| Document | Classification | Scope & Description |
|---|---|---|
| [`docs/_audit/USER_TRAINING.md`](file:///F:/SMRITRretailNX/docs/_audit/USER_TRAINING.md) | **USER TRAINING READINESS MATRIX** | Authoritative 3-Day user training and Go-Live readiness matrix with live E2E execution verification. |
| [`docs/_audit/PARALLEL.md`](file:///F:/SMRITRretailNX/docs/_audit/PARALLEL.md) | **PARALLEL STATUS REPORT** | Master Track 1 development + Track 2 certification gap tracking report. |
| [`docs/_audit/RUNTIME_OWNERSHIP.md`](file:///F:/SMRITRretailNX/docs/_audit/RUNTIME_OWNERSHIP.md) | **RUNTIME OWNERSHIP AUDIT** | Comprehensive runtime ownership & multi-company architecture enforcement audit with literal execution logs. |
| [`docs/_audit/LEGACY_TABLE.md`](file:///F:/SMRITRretailNX/docs/_audit/LEGACY_TABLE.md) | **LEGACY TABLE AUDIT** | 179 legacy/scaffolding table runtime retirement audit with code and runtime evidence. |
| [`docs/_audit/BUSINESS_PROCESS.md`](file:///F:/SMRITRretailNX/docs/_audit/BUSINESS_PROCESS.md) | **ACCEPTANCE MATRIX** | 3-Day user training lifecycle business process acceptance matrix (14/16 verified). |
| [`docs/_audit/FINAL_TABLE.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL_TABLE.md) | **TABLE OWNERSHIP MATRIX** | Comprehensive table-by-table ownership, runtime reader/writer, and authority matrix for all 283 base tables. |
| [`docs/_audit/CANONICAL_SYSTEM.md`](file:///F:/SMRITRretailNX/docs/_audit/CANONICAL_SYSTEM.md) | **FORENSIC RECONCILIATION** | Live forensic database schema & numerical table reconciliation certifying PostgreSQL 15.18, 283 base tables, and exact disjoint partitions. |
| [`docs/_audit/FINAL.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL.md) | **FINAL MASTER CERTIFICATION** | Master documentation certification declaration certifying complete reconciliation across all repository documents. |
| [`docs/_audit/ECOMMERCE.md`](file:///F:/SMRITRretailNX/docs/_audit/ECOMMERCE.md) | **ECOMMERCE FINAL CERTIFICATION** | Final certification of eCommerce as a core capability, company-local ownership, and zero writes to smritisys. |
| [`docs/_audit/GLOBAL.md`](file:///F:/SMRITRretailNX/docs/_audit/GLOBAL.md) | **DOCUMENTATION AUDIT** | Full repository-wide reconciliation report with AI Agent Confusion Test results. |
| [`docs/_audit/ECOMMERCE_CORE.md`](file:///F:/SMRITRretailNX/docs/_audit/ECOMMERCE_CORE.md) | **ECOMMERCE CORE AUDIT** | Canonical audit and capability matrix establishing eCommerce / Omnichannel as a core channel capability. |
| [`docs/_audit/PSV_COMPANY_LOCAL.md`](file:///F:/SMRITRretailNX/docs/_audit/PSV_COMPANY_LOCAL.md) | **PSV CANONICAL CERTIFICATION** | Certification of 100% company-local PSV architecture (SmritiPSV dropped, 0 cross-company leakage, 336/336 tests PASS). |
| [`docs/_audit/LEGACY_175_TABLE.md`](file:///F:/SMRITRretailNX/docs/_audit/LEGACY_175_TABLE.md) | **LEGACY FORENSIC AUDIT** | Exhaustive table-by-table forensic classification of all 172+ legacy/scaffolding tables in smritisys. |
| [`docs/_audit/SMRITISYS_RUNTIME.md`](file:///F:/SMRITRretailNX/docs/_audit/SMRITISYS_RUNTIME.md) | **FORENSIC RUNTIME AUDIT** | Forensic operational-authority runtime write audit and table classification report (CONTROL_PLANE_RUNTIME_VERIFIED). |
| [`docs/_audit/POST_FREEZE.md`](file:///F:/SMRITRretailNX/docs/_audit/POST_FREEZE.md) | **POST-FREEZE VERIFICATION** | Phase 2 Barcode runtime pipeline verification report. |
| [`docs/_audit/ARCHITECTURE.md`](file:///F:/SMRITRretailNX/docs/_audit/ARCHITECTURE.md) | **BASELINE FREEZE** | Master architectural baseline freeze declaration and table accounting reconciliation (76 mapped vs 99 Company DB tables). |
| [`docs/_audit/FINAL_2.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL_2.md) | **FINAL CERTIFICATION** | Comprehensive architecture certification declaration with explicit verified vs pending boundaries. |
| [`docs/_audit/FINAL_DATA.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL_DATA.md) | **MIGRATION AUDIT** | Zero-data-loss verification, pre-migration backup evidence, checksum reconciliations, and test passes. |
| [`docs/_audit/TABLE_MIGRATION_MAP.md`](file:///F:/SMRITRretailNX/docs/_audit/TABLE_MIGRATION_MAP.md) | **MIGRATION AUDIT** | Complete classification of all 283 base tables in `smritisys` and target routing rules. |
| [`docs/_audit/DATA_MIGRATION.md`](file:///F:/SMRITRretailNX/docs/_audit/DATA_MIGRATION.md) | **MIGRATION AUDIT** | Anomaly analysis and resolution for default template series and pricing groups. |
| [`docs/_audit/FINAL_2_3.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL_2_3.md) | **AUDIT EVIDENCE** | Pre-migration remediation closure and integration test suite verification report. |

---

## 5. Historical & Superseded Audit Records

| Document | Classification | Note |
|---|---|---|
| `docs/_audit/01_to_09_AUDIT_EVIDENCE.md` | **HISTORICAL AUDIT** | Retained as immutable historical record of previous audit phases. |
| `docs/_audit/REMEDIATION_TRACKER.md` | **HISTORICAL AUDIT** | Retained as record of phase 1–3 remediation tracking. |
| `docs/_audit/FINAL_REMEDIATION.md` | **SUPERSEDED** | Superseded by `FINAL_2.md`. |
