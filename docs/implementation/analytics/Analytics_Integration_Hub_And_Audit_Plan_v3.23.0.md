<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.23.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Analytics & Intelligence Plane + Compliance Integration Hub (Sections 11 & 12)

## 1. Objective
Establish an isolated downstream Analytics & Intelligence Plane and an authoritative Compliance Integration Hub for SMRITI Retail OS. This ensures heavy analytical aggregations do not lock core transactional OLTP ledgers, provides native TallyPrime XML export for B2B/B2C invoices and journal vouchers, and creates cryptographic SHA-256 tamper-evident compliance audit logs.

## 2. Business Motivation
- **High-Speed Analytics Without OLTP Contention**: Real-time sales dashboards, product profitability metrics, and category margins require aggregations that should not lock operational invoicing tables.
- **TallyPrime Ecosystem Interoperability**: Retailers and accountants require standardized XML interchange for seamless export into TallyPrime.
- **Regulatory & Audit Immutability**: Financial compliance mandates cryptographic checksums on sensitive business and master data modifications to detect unauthorized data manipulation.

## 3. Scope
- Downstream Materialized Fact Table: `analytics_daily_sales_facts` (`v1367_analytics_and_integration`).
- Regulatory Audit Trail Table: `compliance_immutable_audit_logs` with deterministic SHA-256 payload checksums.
- Domain Services:
  - `AnalyticalIntelligenceService`: Daily sales aggregation, cash/digital/credit payment breakdown, estimated COGS, gross margin calculations.
  - `TallyIntegrationService`: Standard XML DTD envelope generation for Sales Invoices and Double-Entry Journal Vouchers.
  - `ComplianceAuditService`: Cryptographic hash calculation, audit event logging, tamper-detection verification.
- REST API Routers:
  - `/api/v1/analytics/*`: Daily sales summaries, category margins, on-demand rebuilds.
  - `/api/v1/integration/*`: Tally Sales XML, Tally Journal XML, Compliance Audit search.

## 4. Current State
- Transactional ledgers (Sales, Stock, POS, General Ledger) operate authoritatively in Postgres.
- Outbox events are dispatched asynchronously via `unified_outbox_analytics_service.py`.
- No dedicated materialized fact table or standardized Tally XML generation existed prior to v3.23.0.

## 5. Gap Analysis
- Gap 1: High-volume dashboard queries previously hit operational sales and item tables directly.
- Gap 2: Accountants lacked direct Tally XML export for B2B vouchers.
- Gap 3: Audit logs lacked cryptographic SHA-256 hash chaining to prove tamper-evidence during statutory audits.

## 6. Architecture Impact
- Multi-Tenant Isolation: All analytical facts and audit records reside in tenant databases, routed dynamically via `get_company_db`.
- Database Separation: `smritisys` maintains reference architecture; tenant databases authoritatively store operational analytics facts.

## 7. Proposed Design
- Table schemas with strict foreign keys, indexes, and forward-only Alembic migration `v1367_analytics_and_integration`.
- Domain services operating over `AsyncSession` with Decimal precision currency quantization.

## 8. Files Created
- `backend/app/models/analytics.py`
- `backend/app/models/audit.py`
- `backend/alembic/versions/v1367_analytics_and_integration.py`
- `backend/app/services/analytical_intelligence_service.py`
- `backend/app/services/tally_integration_service.py`
- `backend/app/services/compliance_audit_service.py`
- `backend/app/api/v1/analytics.py`
- `backend/app/api/v1/integration.py`
- `backend/tests/test_analytics_and_integration_hub.py`

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/main.py`
- `backend/tests/test_ephemeral_tenant_migration_harness.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, SQLAlchemy Async, Alembic, PostgreSQL, Pytest.

## 11. Risks
- Performance of daily aggregate computation on high transaction volume tenants. Mitigated by date-scoped indexed range queries.

## 12. Rollback Strategy
- Forward-only data governance. Defective code is resolved by forward patching.

## 13. Verification Plan
- Automated testing via Pytest asserting exact fact values, XML schema validity, SHA-256 tamper-evidence, and HTTP endpoints.

## 14. Test Plan
- `backend/tests/test_analytics_and_integration_hub.py` (6 tests).
- Clean-slate ephemeral tenant test harness (6 tests).
- 13-suite master regression test (87 tests).

## 15. Documentation Impact
- Update Walkthroughs, CHANGELOG, and implementation indices.

## 16. Deployment Plan
- Apply Alembic migration `v1367_analytics_and_integration` to all tenant databases and control plane database.

## 17. Status
- Completed (100% verified with 87 passing regression tests).

## 18. Related ADRs
- `ADR-001`: Multi-Tenant Dual Engine Routing.
- `ADR-POS-002`: Authoritative Double-Entry Accounting & Ledger Truth.

## 19. Related Walkthroughs
- `docs/walkthrough/analytics/Analytics_Integration_Hub_And_Audit_v3.23.0.md`
