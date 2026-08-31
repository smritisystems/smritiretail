# PHASE 1 TRIAGE REPORT
## Missing Table Classification & Migration Plan

**Date:** 2026-08-30  
**Scope:** 45 unique missing tables  
**Framework:** Schema-only migration triage per ARCHITECTURE_DECISIONS.md

---

## CLASSIFICATION RESULTS

### PARKED_EXPERIMENTAL_ARCHITECTURE (5 tables — DO NOT MIGRATE)

Per ARCHITECTURE_DECISIONS.md, these belong to `origin/feat/physically-isolated-company-dbs` (experimental) and are explicitly excluded from v3.25.0 mainline:

| Table | Classification | Reason |
|-------|---|---|
| control_companies | PARKED | Experimental multi-tenant isolated DB control-plane |
| control_company_databases | PARKED | Experimental multi-tenant isolated DB control-plane |
| control_users | PARKED | Experimental multi-tenant isolated DB control-plane |
| psv_stock_balances | PARKED | Part of experimental PSV stock tracking (feat branch) |
| psv_stock_events | PARKED | Part of experimental PSV stock tracking (feat branch) |

**Action:** Document as parked, do NOT create migrations for v3.25.0

---

### LIVE_AND_CODED (40 tables — MIGRATE TO MAINLINE)

All of these have ORM model definitions and are intended runtime features for v3.25.0. They currently have no production data (empty in both production and fresh DB):

#### CRM Module (4 tables)
- crm_campaigns
- crm_customer_activities
- crm_leads
- crm_opportunities

#### Approvals Module (3 tables)
- approval_actions
- approval_policies
- approval_requests

#### Distribution Module (5 tables)
- distribution_claims
- distribution_route_stops
- distribution_routes
- distribution_settlements
- loading_sheet_items
- loading_sheets

#### Item Tracking (4 tables)
- item_batches
- item_serials
- item_warehouse_locations
- eway_bills

#### E-Commerce (5 tables)
- ecom_channels
- ecom_order_imports
- ecom_reconciliations
- ecom_sku_mappings
- ecom_stock_sync_logs

#### PSV Visibility (4 tables)
- psv_party_scopes
- psv_visibility_policies
- party_addresses
- party_contacts
- party_relationships

#### Predictive Analytics (4 tables)
- pdt_demand_signals
- pdt_distribution_predictions
- pdt_model_registry
- pdt_sku_twin_cache

#### Platform & Workspace (4 tables)
- platform_capabilities
- tenant_capability_bindings
- user_workspace_configs
- workspace_templates
- cge_unified_policies

#### Audit & Config (2 tables)
- module_audit_logs
- module_states
- tally_configs
- report_dispatch_logs

**Total:** 40 tables with models, zero production data, ready for migration

---

## TABLE → ORM MODEL MAPPING

All 45 tables have corresponding ORM models in `app/models/`:

**Models identified in:**
- app/models/approvals.py
- app/models/crm.py
- app/models/distribution.py
- app/models/ecommerce.py
- app/models/inventory.py
- app/models/party.py
- app/models/platform.py
- app/models/predictive_analytics.py
- app/models/psv.py
- app/models/tenant.py
- app/models/workspace.py

---

## MIGRATION PLAN

### Grouping Strategy (Domain-Based)

Create 5 new Alembic migrations grouped by logical domain:

1. **v1385_crm_and_approvals.py**
   - 7 tables: crm_campaigns, crm_customer_activities, crm_leads, crm_opportunities, approval_actions, approval_policies, approval_requests

2. **v1386_distribution_and_warehousing.py**
   - 9 tables: distribution_claims, distribution_route_stops, distribution_routes, distribution_settlements, loading_sheet_items, loading_sheets, item_batches, item_serials, item_warehouse_locations

3. **v1387_ecommerce_and_visibility.py**
   - 9 tables: ecom_channels, ecom_order_imports, ecom_reconciliations, ecom_sku_mappings, ecom_stock_sync_logs, psv_party_scopes, psv_visibility_policies, party_addresses, party_contacts, party_relationships, eway_bills

4. **v1388_platform_and_analytics.py**
   - 12 tables: platform_capabilities, tenant_capability_bindings, user_workspace_configs, workspace_templates, cge_unified_policies, tally_configs, pdt_demand_signals, pdt_distribution_predictions, pdt_model_registry, pdt_sku_twin_cache, module_audit_logs, module_states, report_dispatch_logs

5. **v1389_parked_architecture.py**
   - 0 tables (document that control_* and psv_stock_* are parked, not migrated)

### Migration Chain

Current Head: v1384_company_code_constraint  
New migrations chain from v1384:
- v1384 → v1385
- v1385 → v1386
- v1386 → v1387
- v1387 → v1388
- v1388 → v1389

### Schema Source

Each table definition extracted from:
- ORM model definition (app/models/*)
- Production database `information_schema.columns` for:
  - Column types
  - Nullable / NOT NULL
  - Defaults
  - Unique constraints
- Production database `information_schema.table_constraints` for:
  - Foreign keys
  - Primary keys
  - Check constraints
  - Unique constraints

### Data Migration Rule (STRICT)

**NO production data** migrated into these schema migrations.

- ✅ Table structures (CREATE TABLE)
- ✅ Column definitions
- ✅ Constraints (PK, FK, UNIQUE, CHECK)
- ✅ Indexes
- ❌ Production rows
- ❌ Hardcoded business data
- ❌ Seeded operational records

---

## NEXT STEPS

1. ✅ Phase 1 (TRIAGE) — Complete
2. → Phase 2 (CREATE MIGRATIONS) — In progress
3. → Phase 3 (FRESH DB TEST) — Pending
4. → Phase 4 (REGRESSION SUITE) — Pending
5. → Phase 5 (VERIFICATION) — Pending
6. → Phase 6 (FINAL REPORT) — Pending

---

## CLASSIFICATION SUMMARY

| Classification | Count | Action |
|---|---|---|
| LIVE_AND_CODED | 40 | Migrate |
| PARKED_EXPERIMENTAL_ARCHITECTURE | 5 | Do NOT migrate, document as parked |
| **TOTAL** | **45** | — |

---

**Per user's master command: Schema-only, canonical-only, no production data, grouped by domain, proper chain from current HEAD.**
