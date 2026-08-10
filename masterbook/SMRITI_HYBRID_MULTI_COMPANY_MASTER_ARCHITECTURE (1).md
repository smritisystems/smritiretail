# SMRITI Retail OS — Hybrid Multi-Company Architecture Reference

## Constitutional Principle
**Centralized Access → Configurable Master Ownership → Isolated Company State → Consolidated Visibility**

## Target
- Central Control Plane: users, roles, permissions, company registry, assignments, DB registry, schema registry, master policy, migration/health/backup controls.
- Optional Central Master DB: only masters selected by the business owner.
- Separate Company DB per legal company: all operational transactions and company-owned state.
- Consolidated Reporting DB: downstream projection only.

## Master Ownership
1. Fully isolated
2. Product/Item centralized
3. Selected masters centralized
4. All eligible masters centralized

Centralized master identity never implies shared stock, sales, purchase, accounting, outstanding, or other company state.

## Security
Effective access = User Assignment ∩ Company Assignment ∩ Location Assignment ∩ Permission ∩ Master Applicability.
FastAPI is authoritative. Frontend is not a security boundary.
Anonymous switch = 401; unassigned company = 403.

## Schema Governance
Use a central Schema Registry with versioned migrations. Track each company DB schema version. Never manually drift individual company DBs.

## Company Code
Immutable company_code (e.g. SMR001) is the identity/reporting/audit key. It is not the sole security boundary.

## Consolidation
Company DBs remain authoritative. A downstream pipeline feeds a Consolidated Reporting DB, partitioned by company_code and applicable branch/store/document lineage.

## Recovery
Stop rollout, identify affected company_code/database/schema/migration, preserve evidence, restore only the affected company if needed, verify schema compatibility and isolation tests, then resume.

## AI Agent Rule
Treat this file as architectural source of truth. Audit current implementation before changes. If current reality differs, report the gap and stop before architectural changes. Never claim migration complete without real evidence.
