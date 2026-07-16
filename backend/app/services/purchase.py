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
        supplier.outstanding = (supplier.outstanding + grand_total).quantize(Decimal("0.01"))
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
