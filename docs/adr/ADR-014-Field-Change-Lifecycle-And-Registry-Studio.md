<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
-->

# ADR-014 — Field Change Lifecycle (FCL) & Field Registry Studio (FRS) Architecture

**Status:** ACCEPTED  
**Date:** 2026-07-28  
**Author:** Jawahar Ramkripal Mallah — Chief Systems Architect  
**Supersedes:** None  
**Related:** ADR-003 (Engineering Constitution), ADR-004 (Database Governance), ADR-005 (API Governance), ADR-006 (Repository Pattern), ADR-012 (Database Blueprint Governance)

---

## Context

Adding or modifying entity attributes without structured impact assessment leads to technical debt, broken reporting pipelines, unindexed search queries, missing export columns, and security oversights. Tier-1 enterprise ERP systems (SAP DDIC, Dynamics 365, Oracle Fusion) enforce a formal **Change Management Process** for schema evolution.

SMRITI Retail OS requires a permanent governance framework where **neither developers nor AI coding agents add fields on an ad-hoc basis**. Every schema modification must be registered as a formal Change Request and evaluated across the **13-Layer Impact Chain**.

---

## Decision

1. **Mandatory Field Change Lifecycle (FCL)**:
   - Every field addition, modification, or removal MUST follow the 7-stage Field Change Lifecycle:
     `Business Request (CR)` ──► `13-Layer Impact Analysis` ──► `9-Point Property Clarification` ──► `Auto Task Graph` ──► `Implementation` ──► `13-Layer Verification Gate` ──► `Release Certification`.

2. **The 13-Layer Impact Chain**:
   - Every field change MUST explicitly evaluate and update:
     `Database Schema` · `Alembic Migration` · `ORM Model` · `Repository` · `Domain Service` · `REST API Schema` · `UI Form/Pattern` · `Global Unified Search` · `Reports & BI` · `Barcode Engine` · `Data Exchange (Excel/CSV)` · `Print Framework` · `RBAC & Security`.

3. **Field Registry Catalog (`FIELD_REGISTRY`)**:
   - All fields MUST be registered in the Central Field Registry (`backend/app/core/metadata/field_registry.py`) recording CR ID, target table, data type, version added, author, and impact graph.

4. **AI Agent Execution Rules**:
   - AI agents are strictly prohibited from generating field modification code without first creating a Change Request (CR) and completing 13-Layer Impact Analysis (Rule FCL-001).

---

## Consequences

- **Positive**: Zero hidden breakages, predictable 10-year ERP evolution, automated task generation, future-safe refactoring.
- **Trade-off**: Requires registering a Change Request (CR) before writing code.
