"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import (
    StockAudit, StockAuditItem, Warehouse, Product,
    ProductBatchStock, StockMovement
)
from ..api.deps import TenantContext


class StockAuditService:
    """
    Domain service for managing Warehouse Physical Stock Audits,
    Barcode Scanner Batch Counting, Variance Tracking, and Ledger Reconciliations.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def _generate_audit_no(self) -> str:
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        hex_suffix = uuid.uuid4().hex[:6].upper()
        return f"AUD-{date_str}-{hex_suffix}"

    async def _sync_product_stock_cache(self, product_id: str):
        """Resynchronize aggregate products.stock cache with sum of active batch quantities."""
        res = await self.db.execute(
            select(ProductBatchStock.quantity).where(
                ProductBatchStock.company_id == self.tenant.company_id,
                ProductBatchStock.product_id == product_id,
                ProductBatchStock.is_deleted == False
            )
        )
        total_qty = sum(float(q or 0.0) for q in res.scalars().all())
        
        prod_res = await self.db.execute(
            select(Product).where(
                Product.company_id == self.tenant.company_id,
                Product.id == product_id
            )
        )
        prod = prod_res.scalar_one_or_none()
        if prod:
            prod.stock = int(total_qty)
            await self.db.flush()

    async def create_stock_audit(
        self,
        warehouse_id: str,
        audit_type: str = "CYCLE_COUNT",
        notes: Optional[str] = None
    ) -> StockAudit:
        """
        Initiate a new Physical Stock Audit by taking a baseline snapshot
        of all active batch quantities currently on hand in the specified godown.
        """
        # 1. Validate warehouse
        wh_res = await self.db.execute(
            select(Warehouse).where(
                Warehouse.company_id == self.tenant.company_id,
                Warehouse.id == warehouse_id,
                Warehouse.is_deleted == False
            )
        )
        warehouse = wh_res.scalar_one_or_none()
        if not warehouse:
            raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found.")

        audit_id = f"aud-{uuid.uuid4().hex[:12]}"
        audit_no = await self._generate_audit_no()

        audit = StockAudit(
            id=audit_id,
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            audit_no=audit_no,
            warehouse_id=warehouse_id,
            audit_date=datetime.now(timezone.utc),
            status="IN_PROGRESS",
            audit_type=audit_type,
            notes=notes
        )
        self.db.add(audit)
        await self.db.flush()

        # 2. Snapshot all active batch stocks in this warehouse
        batch_res = await self.db.execute(
            select(ProductBatchStock).where(
                ProductBatchStock.company_id == self.tenant.company_id,
                ProductBatchStock.warehouse_id == warehouse_id,
                ProductBatchStock.is_deleted == False,
                ProductBatchStock.quantity > 0
            )
        )
        batches = batch_res.scalars().all()

        # Batch load products for cost prices
        prod_ids = list(set(b.product_id for b in batches if b.product_id))
        products_map = {}
        if prod_ids:
            p_res = await self.db.execute(
                select(Product).where(Product.id.in_(prod_ids))
            )
            products_map = {p.id: p for p in p_res.scalars().all()}

        for b in batches:
            p = products_map.get(b.product_id)
            unit_cost = float(getattr(p, 'cost_price', None) or getattr(p, 'price', 100.0) or 100.0)
            sys_qty = float(b.quantity)
            
            audit_item = StockAuditItem(
                id=f"audi-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                audit_id=audit_id,
                product_id=b.product_id,
                batch_no=b.batch_no,
                system_qty=sys_qty,
                counted_qty=0.0,
                variance_qty=-sys_qty,  # Initial variance is deficit until counted
                unit_cost=unit_cost,
                variance_value=round(-sys_qty * unit_cost, 2),
                discrepancy_reason="PENDING_COUNT",
                is_reconciled=False
            )
            self.db.add(audit_item)

        await self.db.commit()

        # Reload with items
        return await self.get_stock_audit(audit_id)

    async def get_stock_audit(self, audit_id: str) -> Optional[StockAudit]:
        """Fetch stock audit with all item variance records."""
        res = await self.db.execute(
            select(StockAudit).where(
                StockAudit.company_id == self.tenant.company_id,
                StockAudit.id == audit_id,
                StockAudit.is_deleted == False
            ).options(
                selectinload(StockAudit.items).selectinload(StockAuditItem.product),
                selectinload(StockAudit.warehouse)
            )
        )
        return res.scalar_one_or_none()

    async def list_stock_audits(
        self,
        warehouse_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[StockAudit]:
        """List stock audits with optional filters."""
        query = select(StockAudit).where(
            StockAudit.company_id == self.tenant.company_id,
            StockAudit.is_deleted == False
        ).order_by(StockAudit.created_at.desc()).limit(limit)

        if warehouse_id:
            query = query.where(StockAudit.warehouse_id == warehouse_id)
        if status:
            query = query.where(StockAudit.status == status)

        res = await self.db.execute(query.options(selectinload(StockAudit.items), selectinload(StockAudit.warehouse)))
        return list(res.scalars().all())

    async def record_item_count(
        self,
        audit_id: str,
        item_id: str,
        counted_qty: float,
        discrepancy_reason: Optional[str] = None,
        notes: Optional[str] = None
    ) -> StockAuditItem:
        """Update physical count for a specific audit item and recompute variance."""
        audit = await self.get_stock_audit(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")
        if audit.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Cannot edit a completed and reconciled stock audit.")

        res = await self.db.execute(
            select(StockAuditItem).where(
                StockAuditItem.id == item_id,
                StockAuditItem.audit_id == audit_id,
                StockAuditItem.is_deleted == False
            )
        )
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail=f"Audit item {item_id} not found.")

        sys_qty = float(item.system_qty)
        unit_cost = float(item.unit_cost)
        var_qty = counted_qty - sys_qty

        item.counted_qty = counted_qty
        item.variance_qty = var_qty
        item.variance_value = round(var_qty * unit_cost, 2)
        
        if discrepancy_reason:
            item.discrepancy_reason = discrepancy_reason
        elif var_qty == 0:
            item.discrepancy_reason = "MATCHED"
        elif var_qty < 0:
            item.discrepancy_reason = "DEFICIT_UNSPECIFIED"
        else:
            item.discrepancy_reason = "SURPLUS_FOUND"

        if notes:
            item.notes = notes

        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def scan_barcode_increment(
        self,
        audit_id: str,
        barcode_or_sku: str,
        qty_increment: float = 1.0,
        batch_no: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Barcode scanner rapid counting action.
        Resolves product by barcode/SKU, finds or adds batch line in audit,
        and increments counted quantity.
        """
        audit = await self.get_stock_audit(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")
        if audit.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Cannot scan into a completed stock audit.")

        # Find product by barcode or SKU
        p_res = await self.db.execute(
            select(Product).where(
                Product.company_id == self.tenant.company_id,
                (Product.barcode == barcode_or_sku) | (Product.sku == barcode_or_sku) | (Product.code == barcode_or_sku),
                Product.is_deleted == False
            )
        )
        product = p_res.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with barcode/SKU '{barcode_or_sku}' not found.")

        # Find matching item in audit
        matched_item = None
        for it in audit.items:
            if it.product_id == product.id:
                if batch_no and it.batch_no == batch_no:
                    matched_item = it
                    break
                elif not batch_no:
                    matched_item = it
                    break

        if matched_item:
            new_counted = float(matched_item.counted_qty) + qty_increment
            sys_qty = float(matched_item.system_qty)
            var_qty = new_counted - sys_qty
            unit_cost = float(matched_item.unit_cost)

            matched_item.counted_qty = new_counted
            matched_item.variance_qty = var_qty
            matched_item.variance_value = round(var_qty * unit_cost, 2)
            matched_item.discrepancy_reason = "MATCHED" if var_qty == 0 else ("DEFICIT" if var_qty < 0 else "SURPLUS_FOUND")
            await self.db.commit()
            item_ref = matched_item
        else:
            # Unlisted item found in warehouse during audit (Surplus)
            unit_cost = float(getattr(product, 'cost_price', None) or getattr(product, 'price', 100.0) or 100.0)
            target_batch = batch_no or "BATCH-FOUND"
            new_item = StockAuditItem(
                id=f"audi-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                audit_id=audit_id,
                product_id=product.id,
                batch_no=target_batch,
                system_qty=0.0,
                counted_qty=qty_increment,
                variance_qty=qty_increment,
                unit_cost=unit_cost,
                variance_value=round(qty_increment * unit_cost, 2),
                discrepancy_reason="SURPLUS_FOUND",
                is_reconciled=False
            )
            self.db.add(new_item)
            await self.db.commit()
            item_ref = new_item

        return {
            "status": "SCAN_RECORDED",
            "audit_id": audit_id,
            "product_id": product.id,
            "product_name": product.name,
            "barcode": product.barcode,
            "batch_no": item_ref.batch_no,
            "system_qty": float(item_ref.system_qty),
            "counted_qty": float(item_ref.counted_qty),
            "variance_qty": float(item_ref.variance_qty),
            "variance_value": float(item_ref.variance_value),
            "discrepancy_reason": item_ref.discrepancy_reason
        }

    async def reconcile_and_post_discrepancies(
        self,
        audit_id: str,
        user_identifier: str = "SYSADMIN"
    ) -> StockAudit:
        """
        Finalize audit and apply physical inventory adjustments to the ledger.
        - Deficits (< 0): Creates PHYSICAL_INVENTORY_WRITE_OFF movement and deducts batch stock.
        - Surpluses (> 0): Creates PHYSICAL_INVENTORY_SURPLUS movement and increases batch stock.
        - Resynchronizes products.stock.
        - Marks audit as COMPLETED.
        """
        audit = await self.get_stock_audit(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")
        if audit.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Stock audit has already been reconciled.")

        affected_product_ids = set()

        for item in audit.items:
            var_qty = float(item.variance_qty)
            if var_qty == 0.0 or item.is_reconciled:
                item.is_reconciled = True
                continue

            affected_product_ids.add(item.product_id)

            # Query existing batch stock
            bs_res = await self.db.execute(
                select(ProductBatchStock).where(
                    ProductBatchStock.company_id == self.tenant.company_id,
                    ProductBatchStock.warehouse_id == audit.warehouse_id,
                    ProductBatchStock.product_id == item.product_id,
                    ProductBatchStock.batch_no == item.batch_no,
                    ProductBatchStock.is_deleted == False
                )
            )
            batch_stock = bs_res.scalar_one_or_none()

            # Query product details for StockMovement
            p_res = await self.db.execute(select(Product).where(Product.id == item.product_id))
            prod = p_res.scalar_one_or_none()
            prod_name = prod.name if prod else item.product_id
            prod_sku = prod.sku if (prod and prod.sku) else (prod.code if prod else item.product_id)

            if var_qty < 0:
                # Stock deficit / loss
                loss_qty = abs(var_qty)
                if batch_stock:
                    batch_stock.quantity = max(0.0, float(batch_stock.quantity) - loss_qty)
                    batch_stock.last_counted_date = datetime.now(timezone.utc)

                movement = StockMovement(
                    id=f"sm-aud-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    product_id=item.product_id,
                    product_name=prod_name,
                    sku=prod_sku,
                    movement_type="OUTWARD_LOSS",
                    quantity=loss_qty,
                    warehouse_id=audit.warehouse_id,
                    batch=item.batch_no,
                    unit_cost=float(item.unit_cost),
                    reference_doc_type="STOCK_AUDIT",
                    reference_doc_id=audit.audit_no,
                    remarks=f"Audit Write-off: {item.discrepancy_reason or 'Stock Loss'}"
                )
                self.db.add(movement)

            elif var_qty > 0:
                # Stock surplus / found stock
                surplus_qty = var_qty
                if batch_stock:
                    batch_stock.quantity = float(batch_stock.quantity) + surplus_qty
                    batch_stock.last_counted_date = datetime.now(timezone.utc)
                else:
                    new_batch = ProductBatchStock(
                        id=f"pbs-{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=self.tenant.company_id,
                        branch_id=self.tenant.branch_id,
                        warehouse_id=audit.warehouse_id,
                        product_id=item.product_id,
                        batch_no=item.batch_no,
                        quantity=surplus_qty,
                        reserved_quantity=0.0,
                        damaged_quantity=0.0,
                        last_counted_date=datetime.now(timezone.utc)
                    )
                    self.db.add(new_batch)

                movement = StockMovement(
                    id=f"sm-aud-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    product_id=item.product_id,
                    product_name=prod_name,
                    sku=prod_sku,
                    movement_type="INWARD_SURPLUS",
                    quantity=surplus_qty,
                    warehouse_id=audit.warehouse_id,
                    batch=item.batch_no,
                    unit_cost=float(item.unit_cost),
                    reference_doc_type="STOCK_AUDIT",
                    reference_doc_id=audit.audit_no,
                    remarks=f"Audit Surplus Inward: {item.discrepancy_reason or 'Found Stock'}"
                )
                self.db.add(movement)

            item.is_reconciled = True

        # Resynchronize all affected product stock balances
        for pid in affected_product_ids:
            await self._sync_product_stock_cache(pid)

        audit.status = "COMPLETED"
        audit.reconciled_at = datetime.now(timezone.utc)
        audit.reconciled_by = user_identifier
        await self.db.commit()

        return await self.get_stock_audit(audit_id)
