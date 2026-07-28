<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
-->

# ADR-014 — SMRITI Change Studio (SCS) & Change Engine (SCE) Architecture

**Status:** ACCEPTED  
**Date:** 2026-07-28  
**Author:** Jawahar Ramkripal Mallah — Chief Systems Architect  
**Supersedes:** None  
**Related:** ADR-003 (Engineering Constitution), ADR-004 (Database Governance), ADR-005 (API Governance), ADR-006 (Repository Pattern), ADR-012 (Database Blueprint Governance)

---

## Context

Enterprise ERP platforms (SAP DDIC, Dynamics 365, Oracle Fusion) maintain 20-year stability because **all platform modifications follow a unified Change Management Engine**.

Treating schema, API, report, workflow, screen, or print format additions as uncoordinated code edits introduces silent breakages, broken reports, unindexed search queries, missing export columns, and security risks.

SMRITI Retail OS requires a unified, automated **SMRITI Change Studio (SCS)** and **SMRITI Change Engine (SCE)** to govern all 11 change types.

---

## Decision

1. **Mandatory SMRITI Change Studio (SCS)**:
   - All platform changes (fields, tables, APIs, screens, reports, print formats, workflows, integrations) MUST be registered through the SMRITI Change Engine CLI (`scripts/smriti_change_engine.py`).

2. **Unified Change Types Catalog**:
   - SCE natively supports 11 change types: `new_field`, `modify_field`, `delete_field`, `new_table`, `modify_table`, `new_api`, `new_screen`, `new_report`, `new_print_format`, `new_workflow`, `new_integration`.

3. **6-Step Universal Change Protocol**:
   - `Requirement` ──► `AI Impact Analysis` ──► `Task Generation & Approval` ──► `Implementation` ──► `Automated Validation` ──► `Release`.

4. **SCS Registry Catalog Architecture**:
   - `SMRITI Change Studio` integrates: Change Requests, Impact Analyzer, Task Generator, Field Registry, API Registry, Report Registry, Workflow Registry, Validation Center, and Release Center.

5. **AI Agent Enforcement (Rule SCE-001)**:
   - AI coding agents MUST NOT write code for any architectural or schema change without registering a Change Request (CR) and generating an Impact Analysis report.

---

## Consequences

- **Positive**: Single unified engine for fields, reports, APIs, workflows, and screens; zero hidden breakages; automated scaffolding.
- **Trade-off**: Requires running `python scripts/smriti_change_engine.py` to register Change Requests.
