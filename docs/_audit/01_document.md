<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Version      : 3.16.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- Audit Artifact
-->

# SMRITI Retail OS -- Document Inventory
## Phase 1: Document Inventory

**Audit Date:** 2026-08-17
**Total Documents Found:** 382 (in docs/) + root-level .md files
**Binary Documents (not parsed):** SMRITI_Control_Plane_Architecture_Review.xlsx, SMRITI_Menu_Management_Database_Review.xlsx, SMRITI_UI_UX_Control_Plane_Audit.xlsx, SINGLE_VERIFIED_TT2026-2027_18_RECONCILED.pdf, Tattly_Threads_10_Tax_Invoices_Bundle.pdf

---

## 1. Root-Level Documents

| Document | Classification | Topic | Status |
|---|---|---|---|
| README.md | CANONICAL | Project overview | CURRENT |
| CHANGELOG.md | CANONICAL | Version history | CURRENT |
| DEVELOPMENT_STATUS.md | CANONICAL | Module status dashboard | CURRENT (modified) |
| ARCHITECTURE_DECISIONS.md | REFERENCE | Architecture decisions | CURRENT |
| SECURITY.md | REFERENCE | Security policy | CURRENT |
| CONTRIBUTING.md | REFERENCE | Contribution guide | CURRENT |
| CODE_OF_CONDUCT.md | REFERENCE | Community conduct | CURRENT |
| THIRD_PARTY_LICENSES.md | REFERENCE | License info | CURRENT |
| db_store.POLICY.md | REFERENCE | Express/db_store freeze policy | CURRENT |

---

## 2. Architecture Documents (docs/architecture/ -- 47 files)

| Document | Classification | Topic | Status |
|---|---|---|---|
| MULTI_COMPANY.md | CANONICAL | Multi-company DB naming/topology | CURRENT |
| SMRITISYS.md | CANONICAL | smritisys identity audit | CURRENT |
| COMPANY_DATABASE.md | CANONICAL | Provisioning engine spec | CURRENT |
| COMPANY_DATABASE_2.md | CANONICAL | Lifecycle state machine | CURRENT |
| DATABASE_ROUTING.md | CANONICAL | Routing security invariants | CURRENT |
| CONTROL_PLANE_2_3.md | CANONICAL | Control plane 248-table audit | CURRENT |
| CONFIGURATION.md | CANONICAL | Config ownership 25-area matrix | CURRENT |
| COMPANY_CONTROL_2.md | CANONICAL | Control center spec | CURRENT |
| COMPANY_CONTROL.md | CANONICAL | E2E test plan | CURRENT |
| COMPANY.md | REFERENCE | Onboarding checklist | CURRENT |
| COMP001.md | REFERENCE | Company 001 readiness | CURRENT |
| COMPANY_001.md | REFERENCE | Functional readiness | CURRENT |
| CONTROL_PLANE_2.md | CANONICAL | Control plane boundary rules | CURRENT |
| CONTROL_PLANE.md | REFERENCE | Migration plan | CURRENT |
| DEVELOPMENT.md | REFERENCE | DHI reconciliation | CURRENT |
| PRODUCT_IDENTITY_13.md | CANONICAL | Product Identity Engine | CURRENT |
| PRODUCT_IDENTITY__6.md | CANONICAL | PIE API spec | CURRENT |
| PLATFORM_ADAPTER.md | REFERENCE | Platform adapter rules | CURRENT |
| PLATFORM_2.md | REFERENCE | Microservices roadmap | REFERENCE |
| README.md | REFERENCE | Architecture README | CURRENT |
| GLOSSARY.md | REFERENCE | Architecture glossary | CURRENT |
| (remaining 26 files) | REFERENCE/CANONICAL | Various topics | CURRENT |

---

## 3. Audit Documents (docs/audits/)

| Document | Classification | Topic | Status |
|---|---|---|---|
| SMRITI_ERP_AUDIT.md | HISTORICAL | ERP audit | UNKNOWN |
| INTERNAL_ROLE.md | REFERENCE | Role dashboard audit | CURRENT |
| CONSIGNMENT_AUDIT.md | REFERENCE | Consignment module audit | CURRENT |

---

## 4. Implementation Plans (docs/implementation/ -- multiple)

| Document | Classification | Topic | Status |
|---|---|---|---|
| MULTI_DB_PLATFORM.md | CANONICAL | Multi-DB platform plan | CURRENT |
| CONSOLIDATED_PLANS.md | REFERENCE | Merged plans | CURRENT |
| (additional per area) | REFERENCE | Various | CURRENT |

---

## 5. Walkthrough Documents (docs/walkthrough/ -- 100+ files)

Organized under: foundation/, inventory/, pos/, procurement/, purchase/, reports/, sales/, security/, user_guide/

Key walkthroughs relevant to this audit:
- Fdn_Multi_Company.md
- System_Master.md
- Company_Control.md
- Menu_Mgmt_Gov_v1.0.md

---

## 6. UX/Runtime Audit Documents (docs/ root -- 21 files)

| Document | Classification | Status |
|---|---|---|
| MODULE_INVENTORY.md | REFERENCE | CURRENT |
| GLOBAL_UX.md | REFERENCE | CURRENT |
| RUNTIME_E2E.md | REFERENCE | CURRENT |
| RUNTIME_DATABASE.md | REFERENCE | CURRENT |
| HOME.md | REFERENCE | CURRENT |
| (remaining 16) | REFERENCE | CURRENT |

---

## 7. Binary Documents (Inventoried Only -- Not Parsed)

| File | Type | Relevance |
|---|---|---|
| SMRITI_Control_Plane_Architecture_Review.xlsx | Excel | HIGH -- Control plane table classification |
| SMRITI_Menu_Management_Database_Review.xlsx | Excel | MEDIUM -- Menu governance |
| SMRITI_UI_UX_Control_Plane_Audit.xlsx | Excel | MEDIUM -- UI/UX audit |
| SINGLE_VERIFIED_TT2026-2027_18_RECONCILED.pdf | PDF | LOW -- Tax invoice sample |
| Tattly_Threads_10_Tax_Invoices_Bundle.pdf | PDF | LOW -- Tax invoice sample |

---

## 8. Document Classification Summary

| Classification | Count |
|---|---|
| CANONICAL | ~25 architecture + root docs |
| CURRENT/REFERENCE | ~340 walkthroughs/guides/reports |
| HISTORICAL | ~5 (ERP audit, old reports) |
| SUPERSEDED | 0 explicitly marked |
| UNKNOWN | <5 |
| BINARY (not parsed) | 5 |
