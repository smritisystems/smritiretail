<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-15
  Modified     : 2026-10-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
-->

# SMRITI Retail OS — Item Master Un-transacted SKU & Barcode Guarded Hard Delete Implementation Plan

**Document ID:** SMRITI-IP-IM-HARD-DELETE-v1.0.0  
**Classification:** Enterprise Architecture & Operational Governance Plan  
**Target Module:** Item Master Domain (`backend/app/api/v1/item_domain.py`, `backend/app/services/item_domain_svc.py`, `src/components/itemMaster/`)  
**Database System of Record:** PostgreSQL 15.18 (`smriti001`)  
**Backend Framework:** FastAPI Core  
**Frontend Client:** React 18 + Vite  
**Lifecycle Status:** Completed  

---

## 1. Objective
Establish a secure, audit-compliant **Guarded Hard Delete (Physical Removal)** mechanism for Item Master items, variants (SKUs), and barcodes that have **never been transacted** across any financial, inventory, sales, or procurement ledger.

## 2. Business Motivation
In day-to-day retail operations, operators frequently make typographical or configuration mistakes during initial article, color, or size intake (e.g. entering color "Red" instead of "Blue", or scanning a wrong manufacturer barcode). Because SMRITI strictly enforces unique identity constraints (`uq_variants_company_sku` on `(company_id, variant_sku)` and `uq_barcodes_company_barcode` on `(company_id, barcode)`), soft-deleting an un-transacted variant continues to lock those SKU and barcode strings, preventing re-entry of the corrected variant. Operators require a guarded capability to physically purge 100% un-transacted mistakes, releasing the SKU and barcode for clean reuse without leaving orphan or confusing records in the database.

## 3. Scope
- **In Scope:**
  - Pre-flight transaction dependency verification across all 11 sales, procurement, inventory, and tracking tables.
  - Backend API endpoint for pre-flight check: `GET /api/v1/item-variants/{variant_id}/deletion-status`.
  - Backend API endpoint for physical purge: `DELETE /api/v1/item-variants/{variant_id}/hard-delete`.
  - Cascade cleanup of child policy records (`item_barcodes`, `barcode_registry_audit`, `price_book_entries`, `item_prices`, `item_uom_settings`, `item_tax_profiles`, `item_supplier_settings`, `item_sales_settings`, `item_inventory_policies`, `products`).
  - Immutable WORM audit snapshot recorded in `ComplianceImmutableAuditLog` prior to physical deletion.
  - UI action in `VariantEditModal.tsx` and confirmation dialog with human-readable error reporting if blocked.
  - Test suite covering un-transacted deletion and transacted rejection.
- **Out of Scope:**
  - Hard deletion of records with ≥ 1 transaction (which remains strictly prohibited under HTTP 409).
  - Bulk un-guarded database truncate scripts.

## 4. Current State
- `backend/app/api/v1/inventory.py` provides `DELETE /api/v1/products/{product_id}`, which only performs a soft-delete (`is_deleted = true`).
- `item_variants` has a hard unique constraint `(company_id, variant_sku)`. Soft-deleted variants continue to hold the unique SKU slot.
- `VariantEditModal.tsx` locks SKU and Barcode fields but provides no delete or retirement button.
- Users cannot remove or re-enter a mistaken SKU/barcode even when zero stock, zero GRNs, zero POs, and zero sales invoices exist.

## 5. Gap Analysis
| Requirement | Current State | Required State |
| :--- | :--- | :--- |
| Zero-Transaction Check | Manual or absent in item domain | Automated cross-table query across 11 transaction ledgers |
| Physical SKU Release | Blocked by hard unique constraint | Physical purge of un-transacted variant, releasing SKU & barcode |
| Multi-MRP Barcode Purge | Barcodes stay active or orphan | Atomic cascade deletion of attached barcodes and price-book entries |
| Transacted Protection | Relies on foreign keys or soft-delete | Explicit HTTP 409 pre-flight guard with itemized blocking reasons |
| Audit Trail | Soft-delete only logs updated timestamp | Full JSON pre-deletion snapshot in `ComplianceImmutableAuditLog` |
| UI Control | No delete option in VariantEditModal | Red "Delete Variant" button with modal confirmation and pre-flight check |

## 6. Architecture Impact
- **Database:** Zero schema modifications required. Leverages existing CASCADE definitions on child domain settings and explicit cleanups for barcodes and price book entries.
- **Backend:** Adds `check_variant_deletion_status` and `hard_delete_variant` to `ItemDomainService`, exposed via `backend/app/api/v1/item_domain.py`.
- **Frontend:** Adds `handleHardDelete` and a confirmation modal to `src/components/itemMaster/modals/VariantEditModal.tsx`.
- **Compliance:** Full compliance with WORM immutable audit standards via `ComplianceImmutableAuditLog`.

## 7. Proposed Design
1. **Dependency Engine:**
   Checks:
   - `SalesInvoiceItem` (`variant_id`, `product_id`, `code`, `barcode`)
   - `SalesOrderItem` (`variant_id`, `product_id`, `code`)
   - `SalesReturnItem` (`variant_id`, `product_id`, `code`)
   - `PurchaseReceiptItem` (GRN lines: `variant_id`, `product_id`, `code`, `barcode`)
   - `PurchaseOrderItem` (`variant_id`, `product_id`, `code`)
   - `PurchaseReturnItem` (`variant_id`, `product_id`, `code`)
   - `StockLedgerEntry` (`variant_id`, `product_id`)
   - `StockMovement` (`variant_id`, `product_id`)
   - `Product` current stock (`stock > 0`)
   - `ItemBatch` (allocated batches with stock or GRN)
   - `ItemSerial` (allocated serials)
2. **Purge Sequence (Atomic Transaction):**
   - Create pre-deletion snapshot dict.
   - Insert `ComplianceImmutableAuditLog` row (`event_type="ITEM_VARIANT_HARD_DELETED"`).
   - Delete `barcode_registry_audit` entries for attached barcodes.
   - Delete `item_barcodes` entries for variant.
   - Delete `price_book_entries` for variant.
   - Delete variant policy rows: `ItemPrice`, `ItemUOMSetting`, `ItemTaxProfile`, `ItemSupplierSetting`, `ItemSalesSetting`, `ItemInventoryPolicy`, `ItemWarehouseLocation`.
   - Delete un-transacted `ItemBatch` and `ItemSerial`.
   - Delete `ItemVariant`.
   - Delete matching legacy `Product` row (or mark deleted if shared).
   - If parent `Item` (Style) has 0 remaining variants and 0 transactions, optionally purge the empty parent Style.
   - Commit transaction.

## 8. Files Created
- `docs/implementation/inventory/Item_Master_Untransacted_SKU_Hard_Delete_Plan_v1.0.0.md`
- `docs/walkthrough/inventory/Item_Master_Untransacted_SKU_Hard_Delete_v1.0.0.md`
- `backend/app/tests/test_item_variant_hard_delete.py`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `backend/app/services/item_domain_svc.py`
- `backend/app/api/v1/item_domain.py`
- `src/components/itemMaster/modals/VariantEditModal.tsx`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI Core & SQLAlchemy AsyncSession
- PostgreSQL 15.18 foreign key integrity
- `ComplianceImmutableAuditLog` in `backend/app/models/audit.py`
- React 18 / Lucide Icons (`Trash2`, `AlertTriangle`, `CheckCircle2`)

## 11. Risks
- *Risk:* Accidental deletion of transacted inventory.
  - *Mitigation:* 11-table exhaustive count guard. If count > 0 in any table, hard deletion is rejected with 409.
- *Risk:* Deletion breaks parent Style with other valid variants.
  - *Mitigation:* Variant hard delete targets only the specific `variant_id`. Parent Style is only cleaned up if it has 0 variants remaining and 0 style-level transactions.

## 12. Rollback Strategy
- The purge is wrapped in a single database transaction (`async with session.begin():`). Any failure immediately triggers a rollback.
- Full snapshot is saved in `ComplianceImmutableAuditLog`, allowing restoration if an administrative mistake occurs.

## 13. Verification Plan
- Unit and integration tests verifying:
  1. An un-transacted variant is physically deleted and removed from `item_variants`.
  2. The unique SKU constraint is released and the exact same SKU can be recreated.
  3. A transacted variant (with simulated GRN line or invoice line) is rejected with `HTTP 409` and an explicit blocking error.
  4. Audit event is properly logged in `compliance_immutable_audit_logs`.

## 14. Test Plan
- Run `pytest backend/app/tests/test_item_variant_hard_delete.py -v`.
- Run frontend type check and verify modal rendering.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/inventory/Item_Master_Untransacted_SKU_Hard_Delete_v1.0.0.md` and update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Backend routes deploy to FastAPI server on port 8000.
- Frontend bundle compiles via Vite and deploys on port 3000.
- Zero database migration needed (tables and cascade definitions exist).

## 17. Status
Completed

## 18. Related ADRs
- `ADR-001`: Physical SKU Column Naming & Contract
- `ADR-002`: Synthetic Barcode Decommissioning & Quarantine
- `ADR-003`: Variant-First Transaction Identity Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Item_Master_Untransacted_SKU_Hard_Delete_v1.0.0.md`
