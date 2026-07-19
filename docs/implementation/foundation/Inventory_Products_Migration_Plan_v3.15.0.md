<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.15.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Plan: Inventory & Products Migration to FastAPI & Postgres (v3.15.0)

## 1. Objective
Migrate the Inventory/Products module from legacy flat-file caches (`db_store.json`) to the FastAPI + PostgreSQL database backend (Tier 2 of the strangler-fig migration). Remove the unused Express database mapping paths for product and stock ledger data to guarantee that PostgreSQL acts as the single system of record.

## 2. Business Motivation
Unifying core master data (products and stock movements) on PostgreSQL ensures atomic transaction logs, consistent stock levels between POS billing and purchase receipt GRNs, and eliminates flat-file synchronization delays or data loss risks.

## 3. Scope
- **Backend Models:** Create `StockMovement` database model in FastAPI representing inventory movement logs. Register it in the `models` init file and write an Alembic migration.
- **Backend API Endpoints:**
  - Implement `PUT /api/v1/inventory/{product_id}` for editing product masters.
  - Implement `DELETE /api/v1/inventory/{product_id}` for soft deleting products.
  - Implement `POST /api/v1/inventory/{product_id}/barcodes` and `DELETE /api/v1/inventory/{product_id}/barcodes/{value}` for alias secondary barcodes.
  - Implement `POST /api/v1/inventory/stock-movements` to record stock movements (available to server-side callers without JWT auth).
  - Implement `GET /api/v1/inventory/ledger` to list tenant-scoped stock movements.
- **Express Backend Sync:** Modify `recordStockMovement` in `src/lib/helpers.ts` to call FastAPI's `POST /api/v1/inventory/stock-movements` endpoint via an HTTP POST request rather than making a direct database insertion.
- **Frontend Components Wiring:**
  - Update `src/App.tsx` (`fetchSystemState`) to query `apiFetchV1("/inventory")`.
  - Update `ItemMasterTab.tsx` to handle create, update, delete, and barcode additions via `apiFetchV1` to `/inventory` endpoints.
  - Update `StockLedgerTab.tsx` to read logs from `apiFetchV1("/inventory/ledger")`.
  - Update `BarcodeMappingSection.tsx` to query FastAPI secondary barcode endpoints.
  - Update `InventoryForecastWidget.tsx` to fetch products list from FastAPI.
- **Express Backend Deletion:** Remove Express-side product routes (`/api/pos/products` and secondary barcodes) and ledger routes (`/api/inventory/ledger`), and remove the `products` and `stockLedger` keys from `saveDb` in `src/state/store.ts`.

## 4. Current State
- Products table is initialized in Postgres, but the frontend still queries the Express mock route `/api/pos/products`.
- Stock movements are recorded in-memory inside the Express server's `stockLedger` array and saved to `db_store.json`.
- There is no `stock_movements` table in PostgreSQL.
- **Git Repository Verified:** Running `git status` returns a valid checkout context:
  ```bash
  On branch main
  Your branch is up to date with 'origin/main'.
  ```

## 5. Gap Analysis
- Product updates, deletions, and secondary barcodes are only written to the Express in-memory cache and not the transactional PostgreSQL store.
- Stock movements are completely volatile and not recorded in Postgres.

## 6. Architecture Impact
- Enforces inward-pointing dependency rule (PAL Container): Node.js/Express writes to Postgres using the DI container, and client components fetch directly from FastAPI.
- The `products` and `stockLedger` flat-file serialization keys in `db_store.json` are retired.

## 7. Proposed Design

### Database Model: `StockMovement`
All column-level default overrides (such as warehouse, device, branch, approval) are removed to avoid silently attributes to incorrect properties.
```python
class StockMovement(BaseEntity):
    __tablename__ = "stock_movements"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    movement_type = Column(String(20), nullable=False) # IN, OUT, ADJUSTMENT, TRANSFER
    reference_doc_type = Column(String(50))
    reference_doc_id = Column(String(50))
    warehouse = Column(String(100))
    bin = Column(String(50))
    batch = Column(String(50))
    serial = Column(String(50))
    unit_cost = Column(Numeric(15, 2))
    remarks = Column(Text)
    user = Column(String(100))
    device = Column(String(100))
    branch = Column(String(100))
    source_module = Column(String(50))
    approval = Column(String(50))
```

### Soft-Delete Endpoint
The `DELETE /api/v1/inventory/{product_id}` endpoint invokes the repository's `soft_delete` method, setting `is_deleted = True` instead of invoking SQL `DELETE`:
```python
@router.delete(
    "/{product_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a product by setting its is_deleted flag."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await repo.soft_delete(product, deleted_by=tenant_ctx.user_id)
    return {"success": True, "message": "Product deleted successfully"}
```

### Client-Side Key Transpiler
To prevent rewriting camelCase fields in the UI components, we map snake_case response fields to camelCase properties when loading products:
```typescript
export function mapBackendProductToFrontend(p: any): Product {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    price: parseFloat(p.price),
    stock: p.stock,
    category: p.category,
    isFavorite: p.is_favorite,
    barcode: p.barcode,
    secondaryBarcodes: p.secondary_barcodes || [],
    brand: p.brand,
    color: p.color,
    size: p.size,
    mrp: p.mrp ? parseFloat(p.mrp) : undefined,
    gstPercentage: p.gst_percentage ? parseFloat(p.gst_percentage) : 18,
    styleCode: p.style_code,
    costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
    sku: p.sku,
    hsnCode: p.hsn_code,
    attributes: p.attributes || {},
    pricingMode: p.pricing_mode,
    trackingMode: p.tracking_mode,
    variantTemplateId: p.variant_template_id,
    weightGrams: p.weight_grams ? parseFloat(p.weight_grams) : 0,
  };
}
```

## User Review Required
> [!IMPORTANT]
> A database migration is required to create the `stock_movements` table. The Python container must execute Alembic upgrades upon deployment.

## Open Questions
- **Stock Movements Write Path during Tier 4 migration:** Resolved. `recordStockMovement` in Node/Express will perform an HTTP POST request to `POST /api/v1/inventory/stock-movements` inside python-core (using Docker Compose bridge host `http://python-core:8000` or local `http://localhost:8000`). This maintains the single-writer pattern through python-core.

## Proposed Changes

### Database & Migrations

#### [MODIFY] [inventory.py (Models)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/inventory.py)
- Declare the `StockMovement` database model.

#### [MODIFY] [__init__.py (Models Registry)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/__init__.py)
- Import `StockMovement` model to expose it to SQLAlchemy.

#### [NEW] [Alembic Version Script](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/)
- Create table `stock_movements` migration file.

### Backend Endpoints

#### [MODIFY] [inventory.py (API Routes)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/inventory.py)
- Expose PUT, DELETE, and secondary barcode routes for products.
- Expose `POST /api/v1/inventory/stock-movements` for server-side writers.
- Expose `GET /api/v1/inventory/ledger` to return stock movements.

### Express Backend

#### [MODIFY] [helpers.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/lib/helpers.ts)
- Update `recordStockMovement` to dispatch HTTP POST request to FastAPI `/api/v1/inventory/stock-movements`.

#### [MODIFY] [store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts)
- Remove `products` and `stockLedger` serialization lists from `saveDb`.

#### [DELETE] [products.ts (Express Route)](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/products.ts)
- Remove file completely as the API paths are fully replaced by the FastAPI router.

#### [MODIFY] [inventory.ts (Express Route)](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/inventory.ts)
- Remove the `/api/inventory/ledger` endpoint. Keep ledger entries (/api/ledger) until Tier 4 (Sales/Purchase/POS).

### Frontend Components

#### [MODIFY] [App.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/App.tsx)
- Fetch products list using `apiFetchV1("/inventory")` and map response elements.

#### [MODIFY] [ItemMasterTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ItemMasterTab.tsx)
- Wire product CRUD commits to FastAPI endpoints via `apiFetchV1`.

#### [MODIFY] [StockLedgerTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/StockLedgerTab.tsx)
- Wire ledger loading to `apiFetchV1("/inventory/ledger")`.

#### [MODIFY] [BarcodeMappingSection.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/BarcodeMappingSection.tsx)
- Wire barcode mapping actions to FastAPI secondary barcode endpoints.

#### [MODIFY] [InventoryForecastWidget.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/InventoryForecastWidget.tsx)
- Fetch products list from FastAPI `/inventory`.

## 8. Files Created
- `backend/alembic/versions/<revision>_add_stock_movements_table.py`

## 9. Files Modified
- `backend/app/models/inventory.py`
- `backend/app/models/__init__.py`
- `backend/app/api/v1/inventory.py`
- `src/lib/helpers.ts`
- `src/state/store.ts`
- `src/routes/inventory.ts`
- `src/App.tsx`
- `src/components/ItemMasterTab.tsx`
- `src/components/StockLedgerTab.tsx`
- `src/components/BarcodeMappingSection.tsx`
- `src/components/InventoryForecastWidget.tsx`

## 10. Dependencies
No new dependencies. Standard `apiFetchV1` and Postgres `pool` are already operational.

## 11. Risks
- Delay in DB reads from Postgres for list tables.
- *Mitigation:* Ensure indexes exist on category and code fields (included in database schema).

## 12. Rollback Strategy
As a git repository exists, revert changes using `git checkout -- <file>` (or `git restore <file>`) and drop table `stock_movements` in Postgres.

## 13. Verification Plan
- Verify DB connection and verify new migrations apply successfully.
- Verify `npx tsc --noEmit` and `npm run build` execute cleanly.
- Verify `vitest run` runs successfully.
- Curl GET `/health` and verify FastAPI inventory queries return correct transactional products JSON.

## 14. Test Plan
- Run existing Vitest suite (`npm test`).

## 15. Documentation Impact
- Document migration walkthrough.

## 16. Deployment Plan
- Pull modifications, run Alembic migrations, restart Compose services.

## 17. Status
Draft

## 18. Related ADRs
- ADR-016: Strangler-Fig Migration to FastAPI + PostgreSQL.

## 19. Related Walkthroughs
- Reports module migration v3.15.0.
