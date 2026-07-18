<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Master Framework — Phase A (Foundation Tables) Implementation Plan

## 1. Objective
Establish the database schema foundation for the generic SMRITI Master Framework to enable dynamic data-driven types and dynamic master values.

## 2. Business Motivation
SMRITI requires a unified, flexible framework to define dynamic metadata schemas (`master_types`) and record respective dynamic dataset values (`master_values`) to support scalable extensibility across different modules (Inventory, CRM, Finance, etc.) without requiring constant physical schema alterations.

## 3. Scope
* Create Alembic migration mapping the `master_types` and `master_values` tables.
* Configure primary keys, foreign key relations, unique constraints, and PostgreSQL GIN & partial index optimizers.
* Write rollback (`downgrade`) steps for schema reversion.

## 4. Current State
Database contains structured relational models for Core Entities but lacks generic dynamic schemas.

## 5. Gap Analysis
Need generic entity-attribute-value / schema-value tables to configure non-core lookups dynamically.

## 6. Architecture Impact
Introduction of `master_types` (metadata registry) and `master_values` (lookup store).

## 7. Proposed Design
* `master_types`: stores fields schema (`JSONB`) and module mapping.
* `master_values`: stores instances referencing `master_types` with data payload (`JSONB`), parent-child value hierarchy.

## 8. Files Created
* `backend/alembic/versions/a3e4b5c6d7e8_add_smriti_master_framework_tables.py`

## 9. Files Modified
* None in this phase.

## 10. Dependencies
* Alembic, SQLAlchemy, PostgreSQL.

## 11. Risks
* Large data volumes in `master_values` may degrade query speed if un-indexed. Mitigated by partial indexes and GIN path indexes.

## 12. Rollback Strategy
* Downgrade migration via `alembic downgrade -1`.

## 13. Verification Plan
* Run migration checks: `alembic heads`, `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head` again.
* Describe schema using PostgreSQL client.

## 14. Test Plan
* Validate schema and index structures.

## 15. Documentation Impact
* Update Walkthrough and Master Index.

## 16. Deployment Plan
* Apply Alembic migration during startup.

## 17. Status
Completed

## 18. Related ADRs
* None

## 19. Related Walkthroughs
* [SMRITI Master Framework Phase A Walkthrough](../../walkthrough/foundation/SMRITI_Master_Framework_Phase_A_Walkthrough_v3.16.0.md)
