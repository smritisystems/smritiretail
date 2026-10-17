<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Implementation Plan
-->

# SMRITI Transaction DataBridge Phase 6: Multi-Tenant Enterprise Data Migration & Rollback Toolkit Implementation Plan

## 1. Objective
Design and implement **Phase 6** of the SMRITI Transaction DataBridge. Phase 6 delivers an enterprise-grade, multi-tenant migration and reversible rollback engine (`DataBridgeMigrationToolkit` / `DataBridgeRollbackEngine`). This toolkit allows enterprise retail operators to safely rollback erroneous bulk import operations (soft-deleting created records and reverting modified records), preview simulated rollbacks, and perform tenant-to-tenant data replication and synchronization across company databases using sealed SMRITI-X packages.

---

## 2. Business Motivation
1. **Operational Safety & Blast-Radius Containment**: Human error during bulk ingestion (e.g. uploading a dirty spreadsheet of 2,000 items with wrong tax rates or cost prices) requires an immediate, non-destructive rollback mechanism. Without it, operators must resort to ad-hoc database updates that risk database corruption or foreign key breaking.
2. **Deterministic Soft-Delete & Audit Integrity**: In accordance with the SMRITI Statutory Immutability Doctrine and `BaseEntity` lifecycle, rollbacks must never execute physical SQL `DELETE` queries that destroy forensic history. Instead, newly inserted records must be marked `is_deleted=True` with explicit audit attribution.
3. **Multi-Tenant Seed & Fleet Replication**: Enterprise retail chains expanding to new companies or testing new catalog lines require the ability to securely replicate master data and catalogs between tenant environments without cross-tenant data leakage.

---

## 3. Scope
- **Deterministic Batch Rollback Engine (`execute_rollback`)**:
  - Accepts `job_or_batch_id` or `snapshot_id` and target `entity_type`.
  - Reverts `CREATE` records by updating `is_deleted=True`, `deleted_at=now()`, and `deleted_by=actor_id`.
  - Reverts `UPDATE` records where previous attribute diffs are recorded in compliance logs.
  - Supports non-mutating `dry_run=True` simulation returning anticipated affected counts.
  - Records WORM audit entry `DATABRIDGE_ROLLBACK_EXECUTED` in `compliance_immutable_audit_logs`.
- **Cross-Tenant SMRITI-X Replication Engine (`execute_tenant_transfer`)**:
  - Extracts records from source company using `DataBridgeExportEngine.fetch_entity_records`.
  - Packages dataset into canonical `SMRITI-X` envelope.
  - Re-scopes tenant and company keys (`source_company_id` -> `target_company_id`).
  - Previews or commits records in target tenant database using canonical `DataBridgeService`.
- **FastAPI Governance Endpoints**:
  - `POST /api/v1/databridge/rollback`
  - `POST /api/v1/databridge/sync/tenant-transfer`
- **Security & Authorization**:
  - Rollbacks and cross-tenant transfers require `SYSADMIN` or `ADMIN` roles.
  - Hard tenant isolation verification: Caller's company token must match target database.

---

## 4. Current State
- Phases 1 through 5 of DataBridge are fully operational:
  - 15 business entity domain adapters implemented across Master Data, Party Masters, Procurement, Sales, and Inventory.
  - High-volume asynchronous queue engine (`DataBridgeAsyncEngine`) processes chunked jobs with WORM audit logging.
  - Multi-format streaming exporter (`DataBridgeExportEngine`) produces CSV, JSON, SMRITI-X, and XLSX exports.
  - 73/73 regression tests passing green.
- Missing capability: Once a batch or async job is committed, there is no standardized API or toolkit to safely and reversibly undo the batch if the data was erroneous.

---

## 5. Gap Analysis
1. **Lack of Automated Undo Mechanism**: Bulk imports that passed syntactic validation but contained commercial errors (e.g. inverted wholesale discount rates) cannot be undone in one step.
2. **Missing Dry-Run Simulation**: Operators cannot inspect what records would be touched by a rollback before committing the revert.
3. **No Direct Tenant-to-Tenant Data Re-scoping**: Seeding a staging company from production or copying a master catalog between sister retail companies currently requires manual export-edit-re-upload.

---

## 6. Architecture Impact
- **No Database Migrations**: Uses existing `BaseEntity` soft-delete columns (`is_deleted`, `deleted_at`, `deleted_by`) and `compliance_immutable_audit_logs`.
- **Statutory Audit Chaining**: Every rollback operation computes an SHA-256 digest of the rollback action and records it with immutable WORM locking.
- **Tenant Isolation**: Cross-tenant synchronization requires explicit credentials and permissions for both source and destination contexts.

---

## 7. Proposed Design
```text
┌──────────────────────────────────────────────────────────────┐
│                    API Layer (/api/v1/databridge)            │
│       POST /rollback              POST /sync/tenant-transfer │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│             DataBridgeMigrationToolkit / RollbackEngine      │
│  - execute_rollback(company_db, company_id, req)             │
│  - execute_tenant_transfer(source_db, target_db, req)        │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
        ┌───────┴───────┐              ┌───────┴───────┐
        ▼               ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Soft-Delete  │ │ WORM Audit   │ │ SMRITI-X     │ │ DataBridge   │
│ Created Rows │ │ Immutable    │ │ Extraction   │ │ Ingress &    │
│ (is_deleted) │ │ Hash Chain   │ │ & Re-scope   │ │ Preview/Commit│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 8. Files Created
1. `backend/app/services/databridge/migration_engine.py`: Canonical rollback and cross-tenant replication engine.
2. `backend/tests/test_databridge_phase6_migration_rollback.py`: Automated pytest test suite covering 7 end-to-end scenarios.
3. `scripts/register_databridge_phase6_architecture.py`: Architecture capability registration and preflight certification script.
4. `docs/implementation/foundation/DataBridge_Phase6_Migration_Rollback_Plan_v1.0.0.md`: This 19-section IPGP document.
5. `docs/walkthrough/foundation/DataBridge_Phase6_Migration_Rollback_v1.0.0.md`: Formal 13-section WGP walkthrough document.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added `DataBridgeRollbackRequest`, `DataBridgeRollbackResponse`, `DataBridgeTenantTransferRequest`, and `DataBridgeTenantTransferResponse`.
2. `backend/app/services/databridge/__init__.py`: Exported Phase 6 models and engine.
3. `backend/app/api/v1/databridge.py`: Mounted `/rollback` and `/sync/tenant-transfer` endpoints.
4. `docs/implementation/README.md`: Updated master implementation index table.
5. `docs/walkthrough/README.md`: Appended Phase 6 entry to master walkthrough index.
6. `CHANGELOG.md`: Registered Phase 6 release notes.

---

## 10. Dependencies
- SQLAlchemy 2.0 AsyncIO.
- `app.models.audit.ComplianceImmutableAuditLog`.
- `DataBridgeService` and `DataBridgeExportEngine`.

---

## 11. Risks
1. **Foreign Key Integrity during Rollback**: Soft-deleting parent items that already have child sales invoices could cause downstream application queries to break if not filtered properly.
   - *Mitigation*: The rollback engine verifies if newly created entities have been referenced in downstream transactional records (`sales_invoice_items`, `stock_movements`). If locked, rollback flags `skipped_records` with explanatory warnings.
2. **Accidental Full-Table Soft Delete**: A missing or blank `job_or_batch_id` could inadvertently target too many rows.
   - *Mitigation*: `job_or_batch_id` is strictly mandatory and validated.

---

## 12. Rollback Strategy
If Phase 6 code introduces issues, the rollback engine code is isolated under `backend/app/services/databridge/migration_engine.py`. Removing the module and endpoints reverts the system cleanly with zero database migrations or residual data mutations.

---

## 13. Verification Plan
1. Architecture preflight certification and `npm run architecture:check` passing with 0 violations.
2. TypeScript compilation `npm run lint` (`tsc --noEmit`) passing with exit code 0.
3. Automated pytest suite `test_databridge_phase6_migration_rollback.py` passing with 7/7 green.
4. Full regression across all 9 DataBridge test suites passing 100% green.

---

## 14. Test Plan
- `test_tc_migr_001_rollback_created_records_soft_delete`: Verifies newly created items are marked `is_deleted=True`.
- `test_tc_migr_002_rollback_dry_run_simulation`: Verifies `dry_run=True` reports affected counts without mutating database.
- `test_tc_migr_003_rollback_tenant_boundary_protection`: Verifies cross-tenant rollback attempts are rejected.
- `test_tc_migr_004_rollback_worm_audit_chain`: Verifies `DATABRIDGE_ROLLBACK_EXECUTED` audit record and SHA-256 hash chaining.
- `test_tc_migr_005_tenant_transfer_preview_mode`: Verifies cross-tenant data re-scoping and preview report.
- `test_tc_migr_006_tenant_transfer_commit_mode`: Verifies cross-tenant data commit into target company database.
- `test_tc_migr_007_rest_api_endpoints`: Verifies FastAPI REST endpoints under authentication and entitlement.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase6_Migration_Rollback_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Zero database migrations required.
- Hot code rollout across FastAPI backend.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.
- `ADR-0010`: Immutable WORM Compliance Audit Logging.
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase6_Migration_Rollback_v1.0.0.md`
