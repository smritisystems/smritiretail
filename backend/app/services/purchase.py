"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseReorderConfig, PurchaseJurisdictionConfig,
    VendorContract, VendorContractTier,
)
from ..models.inventory import Product, StockMovement
from ..api.deps import TenantContext
from ..schemas.purchase import (
    SupplierCreate, SupplierUpdate,
    PurchaseOrderCreate, PurchaseOrderAmendRequest,
    PurchaseReceiptCreate,
)


def _uid() -> str:
    return uuid.uuid4().hex[:8]


# Default fallback specs for reorders matching legacy Express store
REORDER_SPECS = {
    "p1": {"level": 50, "reorderQty": 100, "preferredSupplierId": "sup-1"},
    "p2": {"level": 40, "reorderQty": 80, "preferredSupplierId": "sup-1"},
    "p3": {"level": 20, "reorderQty": 50, "preferredSupplierId": "sup-1"},
    "p4": {"level": 30, "reorderQty": 60, "preferredSupplierId": "sup-2"},
    "p5": {"level": 25, "reorderQty": 50, "preferredSupplierId": "sup-2"},
    "p6": {"level": 15, "reorderQty": 40, "preferredSupplierId": "sup-3"},
    "p7": {"level": 20, "reorderQty": 50, "preferredSupplierId": "sup-3"},
    "p8": {"level": 25, "reorderQty": 60, "preferredSupplierId": "sup-2"},
    "p9": {"level": 20, "reorderQty": 50, "preferredSupplierId": "sup-2"},
    "p10": {"level": 50, "reorderQty": 100, "preferredSupplierId": "sup-1"}
}


class PurchaseService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    # ──────────────────────────────────────────────────────────────
    # Supplier helpers
    # ──────────────────────────────────────────────────────────────

    async def _get_supplier(self, supplier_id: str) -> Supplier:
        res = await self.db.execute(
            select(Supplier).where(
                Supplier.id == supplier_id,
                Supplier.company_id == self.tenant.company_id,
                Supplier.branch_id  == self.tenant.branch_id,
                Supplier.is_deleted == False,
            )
        )
        supplier = res.scalars().first()
        if not supplier:
            raise HTTPException(
                status_code=404,
                detail=f"Supplier not found. "
                       f"Please verify the supplier ID and try again.",
            )
        return supplier

    # ──────────────────────────────────────────────────────────────
    # Supplier CRUD
    # ──────────────────────────────────────────────────────────────

    async def create_supplier(self, req: SupplierCreate) -> Supplier:
        supplier = Supplier(
            id=req.id,
            name=req.name,
            code=req.code,
            gst_number=req.gst_number,
            mobile=req.mobile,
            email=req.email,
            address=req.address,
            city=req.city,
            state=req.state,
            pincode=req.pincode,
            outstanding=Decimal("0.00"),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(supplier)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A supplier with this ID or code already exists. "
                       "Please use a different supplier code.",
            )
        await self.db.refresh(supplier)
        return supplier

    async def list_suppliers(self) -> list[Supplier]:
        res = await self.db.execute(
            select(Supplier).where(
                Supplier.company_id == self.tenant.company_id,
                Supplier.branch_id  == self.tenant.branch_id,
                Supplier.is_deleted == False,
            )
        )
        return res.scalars().all()

    async def get_supplier(self, supplier_id: str) -> Supplier:
        return await self._get_supplier(supplier_id)

    # ──────────────────────────────────────────────────────────────
    # Purchase Order
    # ──────────────────────────────────────────────────────────────

    async def create_purchase_order(self, req: PurchaseOrderCreate) -> PurchaseOrder:
        # Validate supplier belongs to tenant
        await self._get_supplier(req.supplier_id)

        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="A purchase order must contain at least one item.",
            )

        subtotal  = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows = []

        for item in req.items:
            # Validate product is in this tenant
            res = await self.db.execute(
                select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id  == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = res.scalars().first()
            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product '{item.code}' was not found in your inventory. "
                           f"Please verify the product and try again.",
                )

            tax_amt  = (item.cost_price * item.quantity * item.gst_rate / 100).quantize(Decimal("0.01"))
            line_tot = (item.cost_price * item.quantity + tax_amt).quantize(Decimal("0.01"))
            subtotal  += item.cost_price * item.quantity
            tax_total += tax_amt

            # Check resolution for contract snapshotting
            sourcing_res = await self.resolve_procurement_source(item.product_id, float(item.quantity), strategy="CONTRACT_FIRST")
            
            c_id = getattr(item, "contract_id", None) or sourcing_res.contract_id
            c_ver = getattr(item, "contract_version", None) or sourcing_res.contract_version
            t_id = getattr(item, "applied_tier_id", None) or sourcing_res.tier_id
            unit_p = Decimal(str(sourcing_res.applied_price)) if sourcing_res.applied_price else item.cost_price
            disc_p = Decimal(str(sourcing_res.applied_discount)) if sourcing_res.applied_discount else Decimal("0.00")
            is_overridden = getattr(item, "is_manually_overridden", False)

            item_rows.append(PurchaseOrderItem(
                id=f"poi-{_uid()}",
                order_id=req.id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                cost_price=item.cost_price,
                gst_rate=item.gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                contract_id=c_id,
                contract_version=c_ver,
                applied_tier_id=t_id,
                applied_unit_price=unit_p,
                applied_discount_percentage=disc_p,
                is_manually_overridden=is_overridden,
                override_reason=getattr(item, "override_reason", None),
                overridden_by=getattr(item, "overridden_by", None),
                overridden_at=datetime.now(timezone.utc) if is_overridden else None,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
            ))

        order = PurchaseOrder(
            id=req.id,
            order_no=req.order_no,
            supplier_id=req.supplier_id,
            status="CONFIRMED",
            notes=req.notes,
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01")),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(order)
        self.db.add_all(item_rows)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A purchase order with this order number already exists.",
            )
        await self.db.refresh(order)
        order.items = item_rows          # attach items for response serialisation
        return order

    async def list_purchase_orders(self) -> list[PurchaseOrder]:
        res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.is_deleted == False,
            )
        )
        return res.scalars().all()

    async def get_purchase_order(self, order_id: str) -> tuple[PurchaseOrder, list[PurchaseOrderItem]]:
        res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.id == order_id,
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.is_deleted == False,
            )
        )
        order = res.scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found.")

        items_res = await self.db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.order_id == order_id,
                PurchaseOrderItem.is_deleted == False,
            )
        )
        return order, items_res.scalars().all()

    # ──────────────────────────────────────────────────────────────
    # Purchase Receipt (GRN)
    # ──────────────────────────────────────────────────────────────

    async def create_purchase_receipt(self, req: PurchaseReceiptCreate) -> PurchaseReceipt:
        await self._get_supplier(req.supplier_id)

        if req.order_id:
            po_res = await self.db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.id == req.order_id,
                    PurchaseOrder.company_id == self.tenant.company_id,
                    PurchaseOrder.branch_id  == self.tenant.branch_id,
                    PurchaseOrder.is_deleted == False,
                )
            )
            if not po_res.scalars().first():
                raise HTTPException(
                    status_code=404,
                    detail="The linked purchase order was not found. "
                           "Please verify the order ID.",
                )

        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="A purchase receipt must contain at least one item.",
            )

        subtotal  = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows = []
        product_stock_updates: list[tuple[Product, Decimal]] = []

        for item in req.items:
            if item.quantity_received <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Quantity received for '{item.code}' must be greater than zero.",
                )

            res = await self.db.execute(
                select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id  == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = res.scalars().first()
            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product '{item.code}' was not found in your inventory.",
                )

            tax_amt  = (item.cost_price * item.quantity_received * item.gst_rate / 100).quantize(Decimal("0.01"))
            line_tot = (item.cost_price * item.quantity_received + tax_amt).quantize(Decimal("0.01"))
            subtotal  += item.cost_price * item.quantity_received
            tax_total += tax_amt

            item_rows.append(PurchaseReceiptItem(
                id=f"pri-{_uid()}",
                receipt_id=req.id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                cost_price=item.cost_price,
                gst_rate=item.gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
            ))
            product_stock_updates.append((product, item.quantity_received))

        grand_total = (subtotal + tax_total).quantize(Decimal("0.01"))

        receipt = PurchaseReceipt(
            id=req.id,
            receipt_no=req.receipt_no,
            supplier_id=req.supplier_id,
            order_id=req.order_id,
            status="RECEIVED",
            notes=req.notes,
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=grand_total,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(receipt)
        self.db.add_all(item_rows)

        # Apply stock increments, update supplier outstanding, and record stock movements
        for product, qty in product_stock_updates:
            product.stock += int(qty)
            product.modified_at = datetime.now(timezone.utc)
            self.db.add(product)

            # Record StockMovement
            movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
            db_movement = StockMovement(
                id=movement_id,
                uuid=str(uuid.uuid4()),
                product_id=product.id,
                product_name=product.name,
                sku=product.sku or product.code,
                quantity=qty,  # Positive for IN
                movement_type="IN",
                reference_doc_type="Purchase Receipt",
                reference_doc_id=receipt.id,
                warehouse="Default Warehouse",
                unit_cost=product.cost_price,
                remarks=f"Stock received for purchase receipt: {receipt.receipt_no}",
                source_module="Purchase",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id
            )
            self.db.add(db_movement)

        supplier = await self._get_supplier(req.supplier_id)
        current_out = Decimal(str(supplier.outstanding or 0.0))
        supplier.outstanding = float((current_out + grand_total).quantize(Decimal("0.01")))
        supplier.modified_at = datetime.now(timezone.utc)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A purchase receipt with this receipt number already exists.",
            )
        await self.db.refresh(receipt)
        return receipt

    async def list_purchase_receipts(self) -> list[PurchaseReceipt]:
        res = await self.db.execute(
            select(PurchaseReceipt).where(
                PurchaseReceipt.company_id == self.tenant.company_id,
                PurchaseReceipt.branch_id  == self.tenant.branch_id,
                PurchaseReceipt.is_deleted == False,
            )
        )
        return res.scalars().all()

    async def get_purchase_receipt(
        self, receipt_id: str
    ) -> tuple[PurchaseReceipt, list[PurchaseReceiptItem]]:
        res = await self.db.execute(
            select(PurchaseReceipt).where(
                PurchaseReceipt.id == receipt_id,
                PurchaseReceipt.company_id == self.tenant.company_id,
                PurchaseReceipt.branch_id  == self.tenant.branch_id,
                PurchaseReceipt.is_deleted == False,
            )
        )
        receipt = res.scalars().first()
        if not receipt:
            raise HTTPException(status_code=404, detail="Purchase receipt not found.")

        items_res = await self.db.execute(
            select(PurchaseReceiptItem).where(
                PurchaseReceiptItem.receipt_id == receipt_id,
                PurchaseReceiptItem.is_deleted == False,
            )
        )
        return receipt, items_res.scalars().all()

    # ──────────────────────────────────────────────────────────────
    # Reorder Suggestion logic
    # ──────────────────────────────────────────────────────────────

    async def list_reorder_suggestions(self, supplier_id: Optional[str] = None) -> list[dict]:
        """
        Generate inventory reorder suggestions per product.
        """
        # Fetch all active products
        prod_res = await self.db.execute(
            select(Product).where(
                Product.company_id == self.tenant.company_id,
                Product.branch_id  == self.tenant.branch_id,
                Product.is_deleted == False
            )
        )
        products = prod_res.scalars().all()

        # Fetch custom reorder configs from DB
        cfg_res = await self.db.execute(
            select(PurchaseReorderConfig).where(
                PurchaseReorderConfig.company_id == self.tenant.company_id,
                PurchaseReorderConfig.branch_id  == self.tenant.branch_id,
                PurchaseReorderConfig.is_deleted == False
            )
        )
        configs = {cfg.product_id: cfg for cfg in cfg_res.scalars().all()}

        # Fetch all suppliers and confirmed orders for sourcing history rate calculations
        suppliers_list = await self.list_suppliers()
        confirmed_po_res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.status.in_(["Confirmed", "Complete"]),
                PurchaseOrder.is_deleted == False
            )
        )
        confirmed_orders = confirmed_po_res.scalars().all()

        suggestions = []

        for prod in products:
            # Match database configuration or fall back to static specifications
            db_cfg = configs.get(prod.id)
            if db_cfg:
                level = float(db_cfg.reorder_level)
                reorder_qty = float(db_cfg.reorder_quantity)
                preferred_supplier_id = db_cfg.preferred_supplier_id
            elif prod.id in REORDER_SPECS:
                fallback = REORDER_SPECS[prod.id]
                level = float(fallback["level"])
                reorder_qty = float(fallback["reorderQty"])
                preferred_supplier_id = fallback["preferredSupplierId"]
            else:
                continue

            if supplier_id and preferred_supplier_id != supplier_id:
                continue

            current_qty = prod.stock
            if current_qty <= level:
                suggested_qty = reorder_qty - current_qty
                supplier = next((s for s in suppliers_list if s.id == preferred_supplier_id), None)

                # Fetch last purchase rate
                last_rate = float(prod.price) * 0.6
                rate_source = "Default Cost Fallback"

                # Sort confirmed orders by date desc to find last rate
                sorted_orders = sorted(
                    [o for o in confirmed_orders if o.supplier_id == preferred_supplier_id],
                    key=lambda o: o.created_at,
                    reverse=True
                )
                if sorted_orders:
                    # check if product in items
                    order_items_res = await self.db.execute(
                        select(PurchaseOrderItem).where(
                            PurchaseOrderItem.order_id == sorted_orders[0].id,
                            PurchaseOrderItem.product_id == prod.id
                        )
                    )
                    o_item = order_items_res.scalars().first()
                    if o_item:
                        last_rate = float(o_item.cost_price)
                        rate_source = "Supplier Sourcing History"

                suggestions.append({
                    "productId": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "color": prod.color or "",
                    "size": prod.size or "",
                    "currentStock": current_qty,
                    "reorderLevel": level,
                    "reorderQty": reorder_qty,
                    "suggestedQty": max(0.0, suggested_qty),
                    "preferredSupplierId": preferred_supplier_id,
                    "preferredSupplierName": supplier.name if supplier else "Unknown",
                    "lastPurchaseRate": last_rate,
                    "rateSource": rate_source
                })

        return suggestions

    async def convert_reorder_suggestions_to_draft(
        self, supplier_id: str, selected_product_ids: List[str]
    ) -> PurchaseOrder:
        """
        Convert selected low-stock reorder suggestions into a draft purchase order.
        """
        if not selected_product_ids:
            raise HTTPException(
                status_code=400,
                detail="Supplier and product selection are required to convert suggestions.",
            )

        await self._get_supplier(supplier_id)
        suggestions = await self.list_reorder_suggestions(supplier_id)
        selected_ids = set(selected_product_ids)
        items_data = [s for s in suggestions if s["productId"] in selected_ids]

        if len(items_data) != len(selected_ids):
            raise HTTPException(
                status_code=400,
                detail="Some selected products are not eligible for reorder conversion.",
            )

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows: list[PurchaseOrderItem] = []

        for suggestion in items_data:
            product_res = await self.db.execute(
                select(Product).where(
                    Product.id == suggestion["productId"],
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = product_res.scalars().first()
            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product '{suggestion['productId']}' was not found.",
                )

            quantity = Decimal(str(suggestion["suggestedQty"]))
            cost_price = Decimal(str(suggestion["lastPurchaseRate"]))
            effective_gst = await self.inventory_service.resolve_effective_gst_percentage(product)
            gst_rate = Decimal(str(effective_gst))
            tax_amount = (cost_price * quantity * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
            line_total = (cost_price * quantity + tax_amount).quantize(Decimal("0.01"))

            subtotal += cost_price * quantity
            tax_total += tax_amount

            item_rows.append(PurchaseOrderItem(
                id=f"poi-{_uid()}",
                order_id=f"po-{_uid()}",
                product_id=product.id,
                code=product.code,
                name=product.name,
                quantity=quantity,
                cost_price=cost_price,
                gst_rate=gst_rate,
                tax_amount=tax_amount,
                line_total=line_total,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
            ))

        order_id = f"po-{_uid()}"
        order_no = f"PO-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        order = PurchaseOrder(
            id=order_id,
            order_no=order_no,
            supplier_id=supplier_id,
            status="DRAFT",
            notes="Auto-generated from reorder trigger suggestions",
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01")),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(order)
        for item in item_rows:
            item.order_id = order_id
        self.db.add_all(item_rows)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Unable to create draft purchase order from reorder suggestions.",
            )

        await self.db.refresh(order)
        order.items = item_rows
        return order

    # ──────────────────────────────────────────────────────────────
    # Jurisdiction Configuration Helpers
    # ──────────────────────────────────────────────────────────────

    async def get_jurisdiction(self) -> str:
        """
        Fetch company state tax jurisdiction.
        """
        res = await self.db.execute(
            select(PurchaseJurisdictionConfig).where(
                PurchaseJurisdictionConfig.company_id == self.tenant.company_id,
                PurchaseJurisdictionConfig.branch_id  == self.tenant.branch_id,
                PurchaseJurisdictionConfig.is_deleted == False
            )
        )
        cfg = res.scalars().first()
        return cfg.company_state if cfg else "DL"

    async def set_jurisdiction(self, state: str) -> str:
        """
        Set company state tax jurisdiction.
        """
        res = await self.db.execute(
            select(PurchaseJurisdictionConfig).where(
                PurchaseJurisdictionConfig.company_id == self.tenant.company_id,
                PurchaseJurisdictionConfig.branch_id  == self.tenant.branch_id,
                PurchaseJurisdictionConfig.is_deleted == False
            )
        )
        cfg = res.scalars().first()
        if cfg:
            cfg.company_state = state
            cfg.modified_at = datetime.now(timezone.utc)
        else:
            cfg = PurchaseJurisdictionConfig(
                id=f"jur-{_uid()}",
                company_state=state,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id
            )
            self.db.add(cfg)

        await self.db.commit()
        return cfg.company_state

    # ── Phase 3 ─────────────────────────────────────────────────────
    # Supplier UPDATE / DELETE
    # ─────────────────────────────────────────────────────────────────

    async def update_supplier(self, supplier_id: str, update_in: SupplierUpdate) -> Supplier:
        """
        Partial-update a supplier. Only non-None fields are applied.
        Mirrors Express PUT /api/purchase/suppliers/:id behaviour.
        """
        supplier = await self._get_supplier(supplier_id)

        for attr in ("name", "gst_number", "mobile", "email", "address", "city", "state", "pincode"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(supplier, attr, val)

        supplier.modified_at = datetime.now(timezone.utc)
        self.db.add(supplier)
        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def delete_supplier(self, supplier_id: str) -> dict:
        """
        Soft-delete a supplier (is_deleted=True).
        Returns a success confirmation dict.
        """
        supplier = await self._get_supplier(supplier_id)
        supplier.is_deleted = True
        supplier.deleted_at = datetime.now(timezone.utc)
        supplier.modified_at = datetime.now(timezone.utc)
        self.db.add(supplier)
        await self.db.commit()
        return {"success": True, "message": f"Supplier '{supplier.name}' has been removed successfully."}

    # ── Purchase Order CANCEL / AMEND ────────────────────────────────

    async def cancel_purchase_order(self, order_id: str, reason: Optional[str] = None) -> dict:
        """
        Cancel a purchase order: set status=CANCELLED and soft-delete.
        Only CONFIRMED orders can be cancelled (RECEIVED = stock already taken).
        """
        order, _ = await self.get_purchase_order(order_id)

        if order.status == "CANCELLED":
            raise HTTPException(
                status_code=400,
                detail="This purchase order is already cancelled.",
            )
        if order.status == "RECEIVED":
            raise HTTPException(
                status_code=400,
                detail="A fully received purchase order cannot be cancelled. "
                       "Please raise a return/debit note instead.",
            )

        order.status = "CANCELLED"
        order.is_deleted = True
        order.deleted_at = datetime.now(timezone.utc)
        order.modified_at = datetime.now(timezone.utc)
        if reason:
            order.notes = f"{order.notes or ''} | Cancelled: {reason}".strip(" |")
        self.db.add(order)
        await self.db.commit()
        return {
            "success": True,
            "message": f"Purchase order '{order.order_no}' has been cancelled.",
        }

    async def amend_purchase_order(
        self, original_id: str, req: PurchaseOrderAmendRequest
    ) -> PurchaseOrder:
        """
        Amend a Confirmed PO:
          1. Cancel the original (status=CANCELLED, is_deleted=True).
          2. Create a new CONFIRMED PO with the replacement items.
        This mirrors Express POST /api/purchase/orders/:id/amend.
        """
        original, _ = await self.get_purchase_order(original_id)

        if original.status != "CONFIRMED":
            raise HTTPException(
                status_code=400,
                detail="Only Confirmed purchase orders can be amended.",
            )

        # Cancel original
        original.status = "CANCELLED"
        original.is_deleted = True
        original.deleted_at = datetime.now(timezone.utc)
        original.modified_at = datetime.now(timezone.utc)
        original.notes = (
            f"{original.notes or ''} | Amended & Superseded. "
            f"Reason: {req.reason or 'No reason given'}"
        ).strip(" |")
        self.db.add(original)

        # Build new PO items
        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="An amendment must contain at least one item.",
            )

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows: list[PurchaseOrderItem] = []

        for item in req.items:
            res = await self.db.execute(
                select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = res.scalars().first()
            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product '{item.code}' not found in your inventory.",
                )

            tax_amt = (item.cost_price * item.quantity * item.gst_rate / 100).quantize(Decimal("0.01"))
            line_tot = (item.cost_price * item.quantity + tax_amt).quantize(Decimal("0.01"))
            subtotal += item.cost_price * item.quantity
            tax_total += tax_amt
            item_rows.append(PurchaseOrderItem(
                id=f"poi-{_uid()}",
                order_id=req.new_order_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                cost_price=item.cost_price,
                gst_rate=item.gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
            ))

        new_order = PurchaseOrder(
            id=req.new_order_id,
            order_no=req.new_order_no,
            supplier_id=original.supplier_id,
            status="CONFIRMED",
            notes=(
                f"Amendment of {original.order_no}. "
                f"Reason: {req.reason or 'Not specified'}."
            ),
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01")),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(new_order)
        self.db.add_all(item_rows)

        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Amendment failed — duplicate order number or integrity constraint.",
            )

        await self.db.refresh(new_order)
        return new_order



    # ─────────────────────────── Phase 4B: Submit PO ────────────────────────────

    async def submit_purchase_order(self, order_id: str) -> dict:
        """
        Submit a purchase order: DRAFT → CONFIRMED.
        Mirrors the workflow action POST /workflow/PurchaseOrder/{id}/submit.
        Only DRAFT orders can be submitted.
        """
        order, _ = await self.get_purchase_order(order_id)
        if order.status != "DRAFT":
            raise HTTPException(
                status_code=400,
                detail=f"Only DRAFT orders can be submitted. Current status: {order.status}.",
            )
        order.status = "CONFIRMED"
        order.modified_at = datetime.now(timezone.utc)
        self.db.add(order)
        await self.db.commit()
        return {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "status": "CONFIRMED",
            "message": f"Purchase order '{order.order_no}' submitted for fulfilment.",
        }

    # ─────────────────────────── Phase 4B: Reports ──────────────────────────────

    async def get_outstanding_suppliers(self) -> list[dict]:
        """
        Outstanding report: suppliers with DRAFT or CONFIRMED (open) POs
        and their total outstanding PO value.
        """
        res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.status.in_(["DRAFT", "CONFIRMED"]),
            )
        )
        orders = res.scalars().all()

        # Group by supplier
        summary: dict[str, dict] = {}
        for po in orders:
            sid = po.supplier_id
            if sid not in summary:
                summary[sid] = {
                    "supplier_id": sid,
                    "order_count": 0,
                    "total_outstanding": Decimal("0.00"),
                    "statuses": set(),
                }
            items_res = await self.db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.order_id == po.id)
            )
            items = items_res.scalars().all()
            total = sum(Decimal(str(it.cost_price)) * it.quantity for it in items)
            summary[sid]["order_count"] += 1
            summary[sid]["total_outstanding"] += total
            summary[sid]["statuses"].add(po.status)

        # Enrich with supplier names
        rows = []
        for sid, data in summary.items():
            sup_res = await self.db.execute(
                select(Supplier).where(Supplier.id == sid, Supplier.is_deleted == False)
            )
            supplier = sup_res.scalars().first()
            rows.append({
                "supplier_id": sid,
                "supplier_name": supplier.name if supplier else "Unknown",
                "order_count": data["order_count"],
                "total_outstanding": float(data["total_outstanding"]),
                "open_statuses": list(data["statuses"]),
            })
        rows.sort(key=lambda x: -x["total_outstanding"])
        return rows

    async def get_pending_delivery_pos(self) -> list[dict]:
        """
        Pending delivery: CONFIRMED POs that have no linked purchase receipt.
        """
        res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.status     == "CONFIRMED",
            )
        )
        orders = res.scalars().all()

        pending = []
        for po in orders:
            receipt_res = await self.db.execute(
                select(PurchaseReceipt).where(
                    PurchaseReceipt.order_id   == po.id,
                    PurchaseReceipt.is_deleted        == False,
                )
            )
            receipt = receipt_res.scalars().first()
            if receipt is None:
                sup_res = await self.db.execute(
                    select(Supplier).where(Supplier.id == po.supplier_id)
                )
                supplier = sup_res.scalars().first()
                pending.append({
                    "order_id": po.id,
                    "order_no": po.order_no,
                    "supplier_id": po.supplier_id,
                    "supplier_name": supplier.name if supplier else "Unknown",
                    "status": po.status,
                    "created_at": po.created_at.isoformat() if po.created_at else None,
                })
        return pending

    # ─────────────────────────── Phase 4B: Supplier Default Rate ───────────────

    async def get_supplier_default_rate(
        self, supplier_id: str, product_id: str
    ) -> dict:
        """
        Return the last GRN (PurchaseReceiptItem) unit_cost for supplier+product.
        Falls back to last PurchaseOrderItem unit_cost if no GRN exists.
        """
        # Try last GRN cost
        receipt_res = await self.db.execute(
            select(PurchaseReceiptItem)
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.purchase_receipt_id)
            .where(
                PurchaseReceipt.company_id == self.tenant.company_id,
                PurchaseReceipt.branch_id  == self.tenant.branch_id,
                PurchaseReceipt.is_deleted == False,
                PurchaseReceipt.supplier_id == supplier_id,
                PurchaseReceiptItem.product_id == product_id,
            )
            .order_by(PurchaseReceipt.created_at.desc())
            .limit(1)
        )
        grn_item = receipt_res.scalars().first()
        if grn_item:
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(grn_item.unit_cost),
                "source": "last_grn",
            }

        # Fallback: last PO cost
        po_res = await self.db.execute(
            select(PurchaseOrderItem)
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
            .where(
                PurchaseOrder.company_id  == self.tenant.company_id,
                PurchaseOrder.branch_id   == self.tenant.branch_id,
                PurchaseOrder.is_deleted  == False,
                PurchaseOrder.supplier_id == supplier_id,
                PurchaseOrderItem.product_id == product_id,
            )
            .order_by(PurchaseOrder.created_at.desc())
            .limit(1)
        )
        po_item = po_res.scalars().first()
        if po_item:
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(po_item.unit_cost),
                "source": "last_purchase_order",
            }

        raise HTTPException(
            status_code=404,
            detail=f"No purchase history found for supplier '{supplier_id}' and product '{product_id}'.",
        )

    # ──────────────────────────────────────────────────────────────
    # Strategic Sourcing Orchestration & Vendor Contract Management
    # ──────────────────────────────────────────────────────────────

    async def resolve_procurement_source(self, product_id: str, order_qty: float = 1.0, strategy: str = "CONTRACT_FIRST"):
        """
        Purchase Module Orchestrator for Strategic Sourcing Resolution.
        Delegates resolution to InventoryService.resolve_vendor() and resolves supplier name.
        """
        from .inventory import InventoryService
        inv_service = InventoryService(self.db, self.tenant)
        res = await inv_service.resolve_vendor(product_id=product_id, strategy=strategy, order_qty=order_qty)

        supplier_name = None
        if res.supplier_id:
            sup_stmt = select(Supplier).where(Supplier.id == res.supplier_id)
            sup_res = await self.db.execute(sup_stmt)
            sup_obj = sup_res.scalars().first()
            if sup_obj:
                supplier_name = sup_obj.name

        from ..schemas.purchase import ProcurementSourcingResolution
        return ProcurementSourcingResolution(
            vendor_id=res.vendor_id,
            supplier_id=res.supplier_id,
            supplier_name=supplier_name,
            contract_id=res.contract_id,
            contract_code=res.contract_code,
            contract_version=res.contract_version,
            tier_id=res.tier_id,
            strategy_used=res.strategy_used,
            applied_price=res.estimated_cost,
            applied_discount=res.applied_discount,
            reason=res.reason,
            estimated_lead_time=res.estimated_lead_time,
            resolution_trace=res.resolution_trace
        )

    async def create_vendor_contract(self, contract_in) -> VendorContract:
        """
        Creates a new VendorContract Aggregate with tiered pricing lines.
        Validates tier quantity ranges and price invariants.
        """
        tenant_id = getattr(self.tenant, "tenant_id", None) or getattr(self.tenant, "company_id", None)
        c_id = contract_in.id or f"vc-{uuid.uuid4().hex[:12]}"

        # Validate duplicate contract_code
        code_stmt = select(VendorContract).where(
            VendorContract.contract_code == contract_in.contract_code,
            VendorContract.company_id == self.tenant.company_id,
            VendorContract.is_deleted == False
        )
        dup = (await self.db.execute(code_stmt)).scalars().first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Contract code '{contract_in.contract_code}' already exists")

        # Validate contract valid_from < valid_to
        if contract_in.valid_from >= contract_in.valid_to:
            raise HTTPException(status_code=400, detail="Contract valid_from date must be prior to valid_to date")

        contract_obj = VendorContract(
            id=c_id,
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            supplier_id=contract_in.supplier_id,
            contract_code=contract_in.contract_code,
            contract_title=contract_in.contract_title,
            version_number=1,
            valid_from=contract_in.valid_from,
            valid_to=contract_in.valid_to,
            currency_id=contract_in.currency_id,
            payment_terms_id=contract_in.payment_terms_id,
            delivery_terms=contract_in.delivery_terms,
            min_commitment_value=contract_in.min_commitment_value,
            terms_and_conditions=contract_in.terms_and_conditions,
            attachment_url=contract_in.attachment_url,
            digital_signature_hash=contract_in.digital_signature_hash,
            approval_status="Draft",
            lifecycle_stage="Draft",
            workflow_status="Approved"
        )
        self.db.add(contract_obj)

        for t_in in contract_in.tiers:
            if t_in.contract_unit_price < 0 or t_in.discount_percentage < 0:
                raise HTTPException(status_code=400, detail="Contract tier prices and discounts cannot be negative")
            if t_in.max_quantity is not None and t_in.min_quantity > t_in.max_quantity:
                raise HTTPException(status_code=400, detail=f"Tier min_quantity ({t_in.min_quantity}) cannot exceed max_quantity ({t_in.max_quantity})")

            tier_id = t_in.id or f"vct-{uuid.uuid4().hex[:12]}"
            t_obj = VendorContractTier(
                id=tier_id,
                uuid=str(uuid.uuid4()),
                tenant_id=tenant_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                contract_id=contract_obj.id,
                product_id=t_in.product_id,
                purchase_uom_id=t_in.purchase_uom_id,
                currency_id=t_in.currency_id,
                min_quantity=t_in.min_quantity,
                max_quantity=t_in.max_quantity,
                contract_unit_price=t_in.contract_unit_price,
                discount_percentage=t_in.discount_percentage,
                bonus_quantity=t_in.bonus_quantity,
                effective_from=t_in.effective_from or contract_in.valid_from,
                effective_to=t_in.effective_to or contract_in.valid_to,
                workflow_status="Approved"
            )
            self.db.add(t_obj)

        await self.db.commit()
        await self.db.refresh(contract_obj)
        return contract_obj

    async def list_vendor_contracts(self) -> List[VendorContract]:
        stmt = select(VendorContract).where(
            VendorContract.company_id == self.tenant.company_id,
            VendorContract.is_deleted == False
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_vendor_contract(self, contract_id: str) -> VendorContract:
        stmt = select(VendorContract).where(
            VendorContract.id == contract_id,
            VendorContract.company_id == self.tenant.company_id,
            VendorContract.is_deleted == False
        )
        contract = (await self.db.execute(stmt)).scalars().first()
        if not contract:
            raise HTTPException(status_code=404, detail=f"Vendor contract '{contract_id}' not found")
        return contract

    async def activate_vendor_contract(self, contract_id: str) -> VendorContract:
        contract = await self.get_vendor_contract(contract_id)
        contract.approval_status = "Approved"
        contract.lifecycle_stage = "Active"
        contract.modified_at = datetime.now(timezone.utc)
        self.db.add(contract)
        await self.db.commit()
        await self.db.refresh(contract)
        return contract

    async def amend_vendor_contract(self, contract_id: str, amendment_data) -> VendorContract:
        """
        Contract Revision Policy: Active contracts cannot be edited in place.
        Creates version +1 parent-linked amendment.
        """
        old_contract = await self.get_vendor_contract(contract_id)
        if old_contract.lifecycle_stage not in ["Active", "Approved"]:
            raise HTTPException(status_code=400, detail="Only Active or Approved contracts can be amended")

        old_contract.lifecycle_stage = "Archived"
        self.db.add(old_contract)

        new_contract_id = f"vc-{uuid.uuid4().hex[:12]}"
        new_version = old_contract.version_number + 1

        new_contract = VendorContract(
            id=new_contract_id,
            uuid=str(uuid.uuid4()),
            tenant_id=old_contract.tenant_id,
            company_id=old_contract.company_id,
            branch_id=old_contract.branch_id,
            supplier_id=old_contract.supplier_id,
            contract_code=old_contract.contract_code,
            contract_title=amendment_data.contract_title or old_contract.contract_title,
            version_number=new_version,
            parent_contract_id=old_contract.id,
            valid_from=amendment_data.valid_from or old_contract.valid_from,
            valid_to=amendment_data.valid_to or old_contract.valid_to,
            currency_id=old_contract.currency_id,
            payment_terms_id=amendment_data.payment_terms_id or old_contract.payment_terms_id,
            delivery_terms=amendment_data.delivery_terms or old_contract.delivery_terms,
            min_commitment_value=amendment_data.min_commitment_value if amendment_data.min_commitment_value is not None else old_contract.min_commitment_value,
            terms_and_conditions=amendment_data.terms_and_conditions or old_contract.terms_and_conditions,
            attachment_url=amendment_data.attachment_url or old_contract.attachment_url,
            digital_signature_hash=amendment_data.digital_signature_hash or old_contract.digital_signature_hash,
            approval_status="Approved",
            lifecycle_stage="Active",
            workflow_status="Approved"
        )
        self.db.add(new_contract)

        # Copy tier lines to new contract version
        tier_stmt = select(VendorContractTier).where(
            VendorContractTier.contract_id == old_contract.id,
            VendorContractTier.is_deleted == False
        )
        old_tiers = (await self.db.execute(tier_stmt)).scalars().all()
        for ot in old_tiers:
            nt = VendorContractTier(
                id=f"vct-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=ot.tenant_id,
                company_id=ot.company_id,
                branch_id=ot.branch_id,
                contract_id=new_contract.id,
                product_id=ot.product_id,
                purchase_uom_id=ot.purchase_uom_id,
                currency_id=ot.currency_id,
                min_quantity=ot.min_quantity,
                max_quantity=ot.max_quantity,
                contract_unit_price=ot.contract_unit_price,
                discount_percentage=ot.discount_percentage,
                bonus_quantity=ot.bonus_quantity,
                effective_from=ot.effective_from,
                effective_to=ot.effective_to,
                workflow_status="Approved"
            )
            self.db.add(nt)

        await self.db.commit()
        await self.db.refresh(new_contract)
        return new_contract
