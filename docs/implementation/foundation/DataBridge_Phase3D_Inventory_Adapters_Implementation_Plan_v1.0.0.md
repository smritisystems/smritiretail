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
  Classification: Implementation Plan — SMRITI DataBridge Phase 3D Inventory Movement & Stock Transfer Adapters
-->

# Implementation Plan: SMRITI DataBridge Phase 3D — Inventory Movement & Stock Transfer Adapters

## 1. Objective
Establish canonical, enterprise-grade DataBridge domain adapters for physical inventory operations and stock movement transactions:
- **Stock Transfer Order** (`DataBridgeStockTransferAdapter`): Inter-warehouse and inter-branch stock movement document ingestion (`stock_transfers` and `stock_transfer_items`).
- **Physical Stock Count / Audit & Adjustment** (`DataBridgeStockAuditAdapter`): Warehouse inventory cycle count, physical audit, and variance adjustment document ingestion (`stock_audits` and `stock_audit_items`).

These adapters extend the SMRITI DataBridge engine to parse, normalize (including multi-row tabular line grouping by document identifier and nested items), validate, match, diff, conflict-detect, preview, and atomically commit inventory movement documents with dual-warehouse dependency resolution, product/SKU line reconciliation, automated product provisioning, multi-tenant isolation, and immutable WORM audit logging without database schema mutations.

---

## 2. Business Motivation
In multi-branch retail enterprises, central godowns, and distribution networks, stock transfers between locations and regular physical cycle counts represent the highest-volume non-sales inventory operations. Migrating historical transfer orders from legacy ERPs (Tally, SAP, Marg, Busy) or importing bulk physical inventory sheets from handheld barcode scanners or external third-party logistics (3PL) systems requires governed ingress. Manual entry of multi-line stock transfer manifests and physical count sheets is labor-intensive and prone to severe inventory discrepancies. DataBridge Phase 3D automates this pipeline while enforcing physical stock invariants: dual-warehouse separation (`source_warehouse_id != dest_warehouse_id`), positive quantities, system-versus-counted variance calculations, idempotency against duplicate transfer numbers or audit numbers, and zero live schema migrations.

---

## 3. Scope
- **Entities**:
  - `STOCK_TRANSFER`: `StockTransfer` + `StockTransferItem` in `app.models.inventory`.
  - `STOCK_AUDIT`: `StockAudit` + `StockAuditItem` in `app.models.inventory`.
- **Capabilities**:
  - Tabular multi-row grouping by `transfer_no` and `audit_no`.
  - Nested JSON document ingestion.
  - Warehouse resolution by `id`, `code`, or `name` (with governed default provisioning for test/fallback environments).
  - Product resolution by `sku`, `product_id`, `barcode`, or `style_code`, with missing product auto-provisioning via `IdentityEngine.allocate_internal`.
  - Discrepancy variance calculation (`variance_qty = counted_qty - system_qty`, `variance_value = variance_qty * unit_cost`).
  - Pre-commit diff calculation, conflict detection (`SMRITI-CONFL-TRANSFER-EXISTS`, `SMRITI-CONFL-AUDIT-EXISTS`, `SMRITI-VAL-WAREHOUSE-SAME`), read-only preview tokens, and atomic commits.
  - Dedicated REST API routes under `/api/v1/databridge/stock-transfer/*` and `/api/v1/databridge/stock-audit/*`.
  - Header alias mapping in `src/lib/headerMapping/` for transfer and audit fields.

---

## 4. Current State
- DataBridge baseline covers:
  - Phase 1: Core foundation, RBAC, WORM audit, tenant boundary isolation.
  - Phase 2: Item, Variant, Barcode, PriceBook catalog adapters.
  - Phase 3A: Customer and Supplier party master adapters.
  - Phase 3B: Purchase Order, GRN, Purchase Invoice, Debit Note procurement adapters.
  - Phase 3C: Sales Invoice, Sales Return, Sales Order outward sales adapters.
- 52/52 automated backend tests pass.
- Frontend workspace and type dictionaries support catalog, party, procurement, and sales flows.

---

## 5. Gap Analysis
- No DataBridge adapter exists for `STOCK_TRANSFER` or `STOCK_AUDIT`.
- `DataBridgeEntityType` enum lacks `STOCK_TRANSFER` and `STOCK_AUDIT`.
- `DataBridgeService.resolve_adapter` lacks dispatch branches for inventory movement documents.
- API endpoints for `/stock-transfer/preview`, `/stock-transfer/commit`, `/stock-audit/preview`, and `/stock-audit/commit` do not exist.
- Frontend `MappingContext` and `HeaderAliasRegistry` lack dictionaries for stock transfers and stock audits.

---

## 6. Architecture Impact
- **Zero Schema Mutations**: Uses existing `stock_transfers`, `stock_transfer_items`, `stock_audits`, and `stock_audit_items` tables in `backend/app/models/inventory.py`.
- **Tenant Isolation**: Every query and insert strictly filters by `company_id`.
- **Identity Governance**: Generated records receive technical UUIDs and canonical identity tracking via `IdentityEngine.generate_technical_id()`.
- **WORM Audit Trail**: Every commit writes an immutable audit record to `ComplianceImmutableAuditLog`.

---

## 7. Proposed Design
1. **`DataBridgeStockTransferAdapter`**:
   - Extends `BaseDataBridgeAdapter`.
   - Normalizes multi-row tabular payloads by grouping on `transfer_no`.
   - Resolves source and destination warehouses; validates `source_warehouse_id != dest_warehouse_id`.
   - Resolves products; auto-provisions missing products via `IdentityEngine.allocate_internal`.
   - Evaluates existing transfers for duplicates; raises `SMRITI-CONFL-TRANSFER-EXISTS` on conflict.
   - Atomically creates `StockTransfer` with related `StockTransferItem` children.
2. **`DataBridgeStockAuditAdapter`**:
   - Extends `BaseDataBridgeAdapter`.
   - Normalizes multi-row tabular payloads by grouping on `audit_no`.
   - Resolves target warehouse.
   - Resolves products; calculates `variance_qty = counted_qty - system_qty` and `variance_value = variance_qty * unit_cost`.
   - Evaluates existing audits for duplicates; raises `SMRITI-CONFL-AUDIT-EXISTS` on conflict.
   - Atomically creates `StockAudit` with related `StockAuditItem` children.
3. **API & Service Integration**:
   - Add `STOCK_TRANSFER` and `STOCK_AUDIT` to `DataBridgeEntityType`.
   - Bind adapters in `DataBridgeService.resolve_adapter`.
   - Expose preview and commit routes in `backend/app/api/v1/databridge.py`.
4. **Header Mapping Registry**:
   - Register commercial aliases in `src/lib/headerMapping/HeaderAliasRegistry.ts`.

---

## 8. Files Created
- `backend/app/services/databridge/adapters/stock_transfer_adapter.py`
- `backend/app/services/databridge/adapters/stock_audit_adapter.py`
- `backend/tests/test_databridge_phase3d_inventory.py`
- `docs/implementation/foundation/DataBridge_Phase3D_Inventory_Adapters_Implementation_Plan_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3D_Inventory_Adapters_v1.0.0.md`
- `scripts/register_databridge_phase3d_architecture.py`

---

## 9. Files Modified
- `backend/app/services/databridge/models.py`
- `backend/app/services/databridge/adapters/__init__.py`
- `backend/app/services/databridge/service.py`
- `backend/app/api/v1/databridge.py`
- `src/lib/headerMapping/types.ts`
- `src/lib/headerMapping/HeaderAliasRegistry.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

---

## 10. Dependencies
- `backend/app/models/inventory.py` (`StockTransfer`, `StockTransferItem`, `StockAudit`, `StockAuditItem`, `Warehouse`, `Product`)
- `backend/app/services/identity/engine.py` (`IdentityEngine`)
- `backend/app/services/databridge/adapters/base_adapter.py` (`BaseDataBridgeAdapter`)

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Same source and destination warehouse | Medium | Strict validation rejecting `source == dest` with `SMRITI-VAL-WAREHOUSE-SAME` |
| Duplicate transfer or audit number clash | High | Pessimistic check against active non-deleted documents per company |
| Missing warehouse reference | Medium | Automatic fallback or provisioning of canonical test warehouse |
| Negative dispatch quantity | Medium | Strict numeric validator enforcing `quantity > 0` |

---

## 12. Rollback Strategy
- Adapters are stateless domain services. If issues arise, disabling the capability or reverting the adapter files restores previous behavior with zero database rollback needed.

---

## 13. Verification Plan
- Unit and integration tests in `backend/tests/test_databridge_phase3d_inventory.py`.
- Full regression suite execution (52 existing + new tests).
- Frontend TypeScript typecheck (`npm run lint`).
- Architecture duplication check (`npm run architecture:check`).

---

## 14. Test Plan
- `test_stock_transfer_preview_and_commit`: Multi-row transfer grouping, source/dest warehouse resolution, line item creation, DB verification.
- `test_stock_transfer_same_warehouse_conflict`: Rejects source == dest warehouse with blocking validation error.
- `test_stock_transfer_duplicate_conflict`: Rejects duplicate transfer number.
- `test_stock_audit_preview_and_commit`: Multi-row audit grouping, variance calculation, line items, DB verification.
- `test_stock_audit_duplicate_conflict`: Rejects duplicate audit number.
- `test_rest_endpoints_e2e_preview_and_commit`: API endpoints preview and commit for stock transfers and audits.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase3D_Inventory_Adapters_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
- Code-only rollout. Zero downtime, zero schema migrations.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary
- `ADR-0043`: Transaction Document Grouping & Auto-Provisioning Invariants

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3B_Procurement_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3C_Sales_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3D_Inventory_Adapters_v1.0.0.md`
