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
  Classification: Architecture & Implementation Plan — SMRITI DataBridge Phase 5
-->

# SMRITI Transaction DataBridge Phase 5: Multi-Format Streaming Exporter & Strangler-Fig Legacy Migration Implementation Plan

## 1. Objective
Design and implement **Phase 5** of the SMRITI Transaction DataBridge. Phase 5 delivers an enterprise-grade, multi-format streaming export engine (`DataBridgeExportEngine`) supporting CSV, JSON, SMRITI-X, and XLSX formats across all 15 catalog, party, procurement, sales, and inventory movement domains. Furthermore, Phase 5 executes the strangler-fig migration of the legacy `exchange.py` router by establishing a backward-compatible proxy forwarding legacy calls to the canonical DataBridge engine with structured deprecation telemetry.

---

## 2. Business Motivation
1. **Data Portability & Statutory Archival**: Retail operators and compliance officers require on-demand, high-fidelity data extraction of catalog items, customer/supplier databases, GST tax invoices, procurement bills, and stock balances in industry-standard formats (CSV, Excel XLSX, and audit-grade SMRITI-X JSON).
2. **Decommissioning Legacy Technical Debt**: Legacy `backend/app/api/v1/exchange.py` contains un-isolated mock parsing logic, lacks WORM compliance audit logging, and operates outside the governed 7-stage security chain. Strangler-fig interception allows retiring this legacy debt without breaking existing legacy clients.
3. **Memory-Safe Streaming**: Exporting large datasets (e.g. 50,000 invoices or SKUs) as monolithic in-memory JSON buffers risks process memory exhaustion. Phase 5 introduces streaming generators yielding chunks dynamically to client HTTP connections.

---

## 3. Scope
- **Domain Coverage**: Full export capabilities across all 15 supported entities:
  - Catalog: `ITEM`, `VARIANT`, `BARCODE`, `PRICEBOOK`.
  - Parties: `CUSTOMER`, `SUPPLIER`.
  - Procurement: `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `PURCHASE_DEBIT_NOTE`.
  - Sales: `SALES_INVOICE`, `SALES_RETURN`, `SALES_ORDER`.
  - Inventory: `STOCK_TRANSFER`, `STOCK_AUDIT`.
- **Export Formats**:
  - `CSV`: Standard RFC 4180 UTF-8 with BOM for Excel compatibility.
  - `JSON`: Formatted JSON array of normalized entity documents.
  - `SMRITI-X`: Sealed enterprise package containing schema metadata, cryptographic SHA-256 payload hash, tenant context, and data payload.
  - `XLSX`: OpenXML Excel workbook generated via streaming `openpyxl`.
- **Legacy Migration**:
  - Deprecation headers and structured warnings emitted on `/api/v1/exchange/*`.
  - Forwarding of `/api/v1/exchange/tasks/{id}/execute` to canonical DataBridge adapters.
- **Frontend Integration**:
  - Export trigger buttons and format selector in `DataBridgeWorkspace.tsx`.
  - Client export helper in `databridgeService.ts`.

---

## 4. Current State
- Phases 1 through 4 are complete and committed.
- DataBridge currently specializes in **ingestion** (import, preview, validation, conflict detection, outbox queue).
- Data export is currently handled by legacy `backend/app/api/v1/exchange.py`, which only exports up to 50 hardcoded rows without WORM logging or multi-entity support.

---

## 5. Gap Analysis
1. **Missing Unified Export Engine**: No canonical engine currently exports procurement, sales, or inventory entities with multi-line line-item unfolding.
2. **Missing Excel XLSX Streaming**: No native XLSX export pipeline exists in DataBridge.
3. **Legacy Exchange Disconnect**: Legacy `/exchange` endpoints remain disconnected from the canonical DataBridge service boundary.

---

## 6. Architecture Impact
- **Service Boundary**: Housing `DataBridgeExportEngine` under `backend/app/services/databridge/export_engine.py`.
- **Database Layer**: Zero schema migrations; read-only streaming queries against company PostgreSQL database.
- **Compliance Layer**: Each export operation registers an immutable audit event in `compliance_immutable_audit_logs` (`event_type="DATABRIDGE_DATA_EXPORT"`).

---

## 7. Proposed Design
### 7.1 Architecture Flow
```
Client / Studio / Legacy Exchange
    │
    ▼
GET /api/v1/databridge/export/{entity_type}?format=csv|xlsx|json|smriti-x
    │
    ▼
FastAPI Security Chain (AUTH -> TenantContext -> Capability -> RBAC)
    │
    ▼
DataBridgeExportEngine.export_entity_stream()
    ├── Query PostgreSQL with tenant company_id scoping
    ├── Unfold headers and line items
    ├── Format into CSV / JSON / SMRITI-X / XLSX
    ├── Record WORM Compliance Audit Log
    └── Yield StreamingResponse with filename Content-Disposition
```

### 7.2 Strangler-Fig Proxy Flow
```
Legacy Client -> POST /api/v1/exchange/tasks/{id}/execute
    │
    ▼
exchange.py (Logs Deprecation Warning SMRITI-DEPR-001)
    │
    ▼
Routes to DataBridgeService (Import) or DataBridgeExportEngine (Export)
    │
    ▼
Returns Standard Response Envelope
```

---

## 8. Files Created
1. `backend/app/services/databridge/export_engine.py`: Canonical multi-format streaming export engine.
2. `backend/tests/test_databridge_phase5_export.py`: Automated verification test suite for Phase 5.
3. `scripts/register_databridge_phase5_architecture.py`: Governance registration script for capability and preflight certificates.
4. `docs/implementation/foundation/DataBridge_Phase5_Export_Strangler_Plan_v1.0.0.md`: This 19-section IPGP implementation plan.
5. `docs/walkthrough/foundation/DataBridge_Phase5_Export_Strangler_v1.0.0.md`: Formal 13-section WGP walkthrough document.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added export request/response contracts and format enums.
2. `backend/app/services/databridge/__init__.py`: Exported `DataBridgeExportEngine`.
3. `backend/app/api/v1/databridge.py`: Added `GET /export/{entity_type}` streaming endpoint.
4. `backend/app/api/v1/exchange.py`: Added deprecation telemetry and strangler-fig forwarding.
5. `src/components/databridge/databridgeTypes.ts`: Added frontend export interfaces.
6. `src/components/databridge/databridgeService.ts`: Added client export methods.
7. `src/components/databridge/DataBridgeWorkspace.tsx`: Added export action triggers and modal.
8. `docs/implementation/README.md`: Synchronized Phase 5 plan entry.
9. `docs/walkthrough/README.md`: Appended Phase 5 walkthrough entry.

---

## 10. Dependencies
- Python `openpyxl` (already installed) for OpenXML workbook formatting.
- FastAPI `StreamingResponse` for memory-efficient chunked HTTP transmission.
- `app.models.audit.ComplianceImmutableAuditLog` for WORM compliance records.

---

## 11. Risks & Mitigations
- **Large Dataset Memory Usage**: Mitigated by querying PostgreSQL with batch cursor limits and yielding streamed file chunks rather than loading entire tables into RAM.
- **Legacy Client Breakage**: Mitigated by keeping `exchange.py` route signatures identical while shimming internal execution to canonical services.

---

## 12. Rollback Strategy
- The export engine is purely read-only and does not mutate transactional or master tables.
- Strangler-fig shims in `exchange.py` can be reverted to standalone logic if any legacy caller behaves unexpectedly.

---

## 13. Verification Plan
- Zero database migrations verified.
- `npm run lint` and `npm run architecture:check` pass with zero violations.
- All Phase 5 automated tests pass in `backend/tests/test_databridge_phase5_export.py`.
- Regression suite across all Phases 1-5 passes.

---

## 14. Test Plan
- `test_tc_export_001_csv_export_catalog`: Tests CSV export with proper UTF-8 BOM and headers.
- `test_tc_export_002_json_export_parties`: Tests JSON format export of customer and supplier records.
- `test_tc_export_003_smriti_x_export_transactions`: Tests sealed SMRITI-X envelope with SHA-256 hash.
- `test_tc_export_004_xlsx_export_inventory`: Tests binary Excel OpenXML workbook generation.
- `test_tc_export_005_tenant_isolation`: Verifies that exported streams never leak records across tenants.
- `test_tc_export_006_worm_audit_logging`: Verifies immutable audit entry creation for export operations.
- `test_tc_export_007_legacy_exchange_strangler_forwarding`: Verifies `/api/v1/exchange` forwards to DataBridge.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase5_Export_Strangler_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Zero schema migration requirement.
- Hot code rollout across FastAPI backend and React frontend.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase5_Export_Strangler_v1.0.0.md`
