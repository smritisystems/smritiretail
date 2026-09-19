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
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
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
    DebitNoteCreate, PurchaseBillCreate,
)
from .identity.engine import IdentityEngine


class PurchaseService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    def _effective_branch_id(self) -> str:
        if not self.tenant.branch_id or self.tenant.branch_id == "MAIN":
            return "BR-MAIN-001"
        return self.tenant.branch_id

    async def get_effective_branch_id(self) -> str:
        """
        Dynamically resolve active branch from the database for this company.
        Falls back to tenant branch or default seed branch.
        """
        if self.tenant.branch_id and self.tenant.branch_id not in ("MAIN", ""):
            return self.tenant.branch_id
        from ..models.tenant import Branch
        if self.tenant.company_id:
            b_stmt = (
                select(Branch.id)
                .where(
                    Branch.company_id == self.tenant.company_id,
                    Branch.is_active == True,
                    Branch.is_deleted == False,
                )
                .order_by(Branch.created_at.asc())
                .limit(1)
            )
            b_res = await self.db.execute(b_stmt)
            b_id = b_res.scalars().first()
            if b_id:
                return b_id
        return self._effective_branch_id()

    def _branch_filter(self, col):
        if not self.tenant.branch_id:
            return True
        if self.tenant.branch_id in ("BR-MAIN-001", "MAIN", "BR-001"):
            return or_(col.in_(["BR-MAIN-001", "MAIN", "BR-001"]), col.is_(None))
        return or_(col == self.tenant.branch_id, col.is_(None))

    # ──────────────────────────────────────────────────────────────
    # Supplier helpers
    # ──────────────────────────────────────────────────────────────

    async def _get_supplier(self, supplier_id: str) -> Supplier:
        clean_sup = (supplier_id or "").strip()
        stmt = select(Supplier).where(
            (Supplier.id == clean_sup) | (Supplier.code == clean_sup) | (Supplier.identity_code == clean_sup) | (Supplier.name.ilike(clean_sup)),
            Supplier.is_deleted == False,
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                (Supplier.company_id == self.tenant.company_id) | (Supplier.company_id.is_(None))
            )
        res = await self.db.execute(stmt)
        supplier = res.scalars().first()
        if not supplier and clean_sup:
            # Fallback 1: substring match on Supplier name
            sub_stmt = select(Supplier).where(
                Supplier.name.ilike(f"%{clean_sup}%"),
                Supplier.is_deleted == False,
            )
            if self.tenant.company_id:
                sub_stmt = sub_stmt.where(
                    (Supplier.company_id == self.tenant.company_id) | (Supplier.company_id.is_(None))
                )
            sub_res = await self.db.execute(sub_stmt)
            supplier = sub_res.scalars().first()

        if not supplier and clean_sup:
            # Fallback 2: Check Universal Party Master (parties table)
            from ..models.party import Party
            party_stmt = select(Party).where(
                (Party.id == clean_sup) | (Party.party_code == clean_sup) | (Party.identity_code == clean_sup) | (Party.legal_name.ilike(clean_sup)) | (Party.legal_name.ilike(f"%{clean_sup}%")),
                Party.is_deleted == False,
            )
            if self.tenant.company_id:
                party_stmt = party_stmt.where(
                    (Party.company_id == self.tenant.company_id) | (Party.company_id.is_(None))
                )
            party_res = await self.db.execute(party_stmt)
            party = party_res.scalars().first()
            if party:
                sup_check = await self.db.execute(
                    select(Supplier).where(
                        (Supplier.code == party.party_code) | (Supplier.id == party.id),
                        Supplier.is_deleted == False,
                    )
                )
                supplier = sup_check.scalars().first()
                if not supplier:
                    eff_branch = await self.get_effective_branch_id()
                    supplier = Supplier(
                        id=party.id,
                        name=party.legal_name or party.trade_name or party.party_code,
                        code=party.party_code,
                        identity_code=party.identity_code,
                        gst_number=party.gstin,
                        mobile=party.mobile or party.phone,
                        email=party.email,
                        address=party.address_line1,
                        city=party.city,
                        state=party.state,
                        pincode=party.pincode,
                        outstanding=Decimal("0.00"),
                        company_id=self.tenant.company_id,
                        branch_id=eff_branch,
                    )
                    self.db.add(supplier)
                    await self.db.flush()

        if not supplier:
            raise HTTPException(
                status_code=404,
                detail=f"Supplier not found for identifier '{clean_sup}'. "
                       f"Please verify the supplier ID and try again.",
            )
        return supplier

    async def _get_product(self, product_id: str) -> Product:
        stmt = select(Product).where(
            (Product.id == product_id) | (Product.code == product_id),
            Product.is_deleted == False,
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                (Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None))
            )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product '{product_id}' was not found in your inventory.",
            )
        return product

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
        stmt = select(Supplier).where(
            Supplier.company_id == self.tenant.company_id,
            Supplier.is_deleted == False,
        )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(Supplier.branch_id))
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_supplier(self, supplier_id: str) -> Supplier:
        return await self._get_supplier(supplier_id)

    # ──────────────────────────────────────────────────────────────
    # Purchase Order
    # ──────────────────────────────────────────────────────────────

    async def create_purchase_order(self, req: PurchaseOrderCreate) -> PurchaseOrder:
        # Validate supplier belongs to tenant
        supplier = await self._get_supplier(req.supplier_id)

        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="A purchase order must contain at least one item.",
            )

        # ── Prevent duplicate order_no for this company (HREP-compliant 409) ──
        if req.order_no:
            existing_stmt = select(PurchaseOrder).where(
                PurchaseOrder.order_no == req.order_no.strip(),
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.is_deleted == False,
            )
            existing_res = await self.db.execute(existing_stmt)
            if existing_res.scalars().first():
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"A purchase order with number '{req.order_no.strip()}' already exists. "
                        "Please use a different order number or retrieve the existing order."
                    ),
                )

        eff_branch_id = await self.get_effective_branch_id()
        tech_id, identity_code = await IdentityEngine.allocate_internal(
            session=self.db,
            entity_type="PURCHASE_ORDER",
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=eff_branch_id,
            purpose="ENTITY_CREATION",
        )
        po_id = tech_id

        subtotal  = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows = []

        for item in req.items:
            clean_item_code = (item.code or "").strip()
            clean_prod_id = (item.product_id or "").strip()
            # Validate product is in this tenant (matching by id, code, or barcode)
            stmt = select(Product).where(
                (Product.id == clean_prod_id) | (Product.code == clean_prod_id) | (Product.code.ilike(clean_item_code)) | (Product.barcode == clean_item_code),
                Product.is_deleted == False,
            )
            if self.tenant.company_id:
                stmt = stmt.where(
                    (Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if not product:
                # Fallback: check by id or code in items table (Universal Item Master)
                from ..models.item_master import Item
                item_stmt = select(Item).where(
                    (Item.id == clean_prod_id) | (Item.item_code.ilike(clean_prod_id)) | (Item.item_code.ilike(clean_item_code)) | (Item.identity_code == clean_item_code),
                    Item.is_deleted == False,
                )
                if self.tenant.company_id:
                    item_stmt = item_stmt.where(
                        (Item.company_id == self.tenant.company_id) | (Item.company_id.is_(None))
                    )
                item_res = await self.db.execute(item_stmt)
                db_item = item_res.scalars().first()
                if db_item:
                    res_p = await self.db.execute(
                        select(Product).where(
                            (Product.item_id == db_item.id) | (Product.code == db_item.item_code),
                            Product.is_deleted == False,
                        )
                    )
                    product = res_p.scalars().first()
                    if not product:
                        product = Product(
                            id=f"prd_{db_item.id[:20]}",
                            item_id=db_item.id,
                            code=db_item.item_code,
                            name=db_item.item_name,
                            category=db_item.category or "GENERAL",
                            barcode=db_item.barcode or db_item.item_code,
                            hsn_code=getattr(db_item, "hsn_code", None) or "6109",
                            company_id=self.tenant.company_id,
                            branch_id=eff_branch_id,
                            price=Decimal("0.00"),
                            cost_price=Decimal(str(item.cost_price or 0.00)),
                            stock=0,
                            reserved_stock=Decimal("0.0000"),
                        )
                        self.db.add(product)
                        await self.db.flush()

            if not product and (clean_item_code or clean_prod_id):
                # Fallback 2: auto-provision catalog product row for order line item
                import re
                code_base = re.sub(r'[^A-Za-z0-9_-]', '', clean_item_code or clean_prod_id) or f"SKU-{uuid.uuid4().hex[:8].upper()}"
                prod_id = f"prd_{uuid.uuid4().hex[:16]}"
                product = Product(
                    id=prod_id,
                    code=code_base,
                    name=item.name or code_base,
                    category="GENERAL",
                    barcode=code_base,
                    hsn_code="6109",
                    price=Decimal(str(item.cost_price or 0.00)),
                    cost_price=Decimal(str(item.cost_price or 0.00)),
                    stock=0,
                    reserved_stock=Decimal("0.0000"),
                    company_id=self.tenant.company_id,
                    branch_id=eff_branch_id,
                )
                self.db.add(product)
                await self.db.flush()

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
                id=IdentityEngine.generate_technical_id(),
                uuid=IdentityEngine.generate_technical_id(),
                order_id=po_id,
                product_id=product.id,
                item_id=getattr(product, "item_id", None),
                code=product.code or item.code,
                name=product.name or item.name,
                quantity=item.quantity,
                cost_price=item.cost_price,
                gst_rate=item.gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=self.tenant.company_id,
                branch_id=eff_branch_id,
            ))

        order = PurchaseOrder(
            id=po_id,
            identity_code=identity_code,
            order_no=req.order_no,
            supplier_id=supplier.id,
            status="CONFIRMED",
            notes=req.notes,
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01")),
            company_id=self.tenant.company_id,
            branch_id=eff_branch_id,
        )
        self.db.add(order)
        self.db.add_all(item_rows)
        try:
            await self.db.commit()
        except IntegrityError as e:
            await self.db.rollback()
            err_str = str(getattr(e, "orig", e)).lower()
            # Human-readable constraint translation (SMRITI HREP policy)
            if "uq_purchase_orders_order_no_company" in err_str or "purchase_orders_order_no_key" in err_str or ("order_no" in err_str and "unique" in err_str):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"A purchase order with number '{req.order_no}' already exists. "
                        "Please use a different order number or retrieve the existing order."
                    ),
                )
            elif "uq_purchase_orders_identity_code" in err_str or ("identity_code" in err_str and "unique" in err_str):
                raise HTTPException(
                    status_code=409,
                    detail="An internal identity code conflict occurred. Please try again.",
                )
            elif "foreign key" in err_str or "fk" in err_str:
                raise HTTPException(
                    status_code=400,
                    detail="One or more referenced records (product, supplier, or branch) could not be found. Please verify your selections and try again.",
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="The purchase order could not be saved due to a data conflict. Please check your entries and try again.",
                )
        await self.db.refresh(order)
        order.items = item_rows          # attach items for response serialisation
        return order

    async def list_purchase_orders(self) -> list[PurchaseOrder]:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.company_id == self.tenant.company_id,
            PurchaseOrder.is_deleted == False,
        )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(PurchaseOrder.branch_id))
        stmt = stmt.order_by(PurchaseOrder.created_at.desc())
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_next_order_number(self, prefix: Optional[str] = None) -> dict:
        """
        Return the next available sequential order number for the given prefix
        and this company.  Scans existing non-deleted POs whose order_no matches
        <prefix>-<digits> and returns max+1.  Falls back to 1 when no POs
        exist so the frontend never needs a hardcoded seed value.
        """
        import re
        stmt = select(PurchaseOrder.order_no).where(
            PurchaseOrder.company_id == self.tenant.company_id,
            PurchaseOrder.is_deleted == False,
        )
        if prefix:
            stmt = stmt.where(PurchaseOrder.order_no.like(f"{prefix}-%"))
        res = await self.db.execute(stmt)
        order_nos: list[str] = [row[0] for row in res.fetchall() if row[0]]

        max_seq = 0
        pattern = re.compile(r"(\d+)$")
        for no in order_nos:
            m = pattern.search(no)
            if m:
                val = int(m.group(1))
                if val > max_seq:
                    max_seq = val

        return {
            "prefix": prefix or "",
            "next_number": max_seq + 1,
            "next_order_no": f"{prefix}-{max_seq + 1}" if prefix else str(max_seq + 1),
        }

    async def get_purchase_order(self, order_id: str) -> tuple[PurchaseOrder, list[PurchaseOrderItem]]:
        stmt = select(PurchaseOrder).where(
            (PurchaseOrder.id == order_id) | (PurchaseOrder.order_no == order_id) | (PurchaseOrder.identity_code == order_id),
            PurchaseOrder.company_id == self.tenant.company_id,
            PurchaseOrder.is_deleted == False,
        )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(PurchaseOrder.branch_id))
        res = await self.db.execute(stmt)
        order = res.scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found.")

        items_res = await self.db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.order_id == order.id,
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
            po_stmt = select(PurchaseOrder).where(
                (PurchaseOrder.id == req.order_id) | (PurchaseOrder.order_no == req.order_id) | (PurchaseOrder.identity_code == req.order_id),
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.is_deleted == False,
            )
            if self.tenant.branch_id:
                po_stmt = po_stmt.where(self._branch_filter(PurchaseOrder.branch_id))
            po_res = await self.db.execute(po_stmt)
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

        from .inventory_wms import InventoryWmsService
        from .inventory_warehouse_resolver import InventoryWarehouseResolver
        wms_service = InventoryWmsService(self.db, self.tenant)
        resolver = InventoryWarehouseResolver(self.db)
        warehouse_id = req.warehouse_id
        if not warehouse_id:
            warehouse = await resolver.resolve(company_id=self.tenant.company_id, branch_id=self.tenant.branch_id)
            warehouse_id = warehouse.id

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows = []

        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=self.db,
            entity_type="PURCHASE_RECEIPT",
            group_code="PUR",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            purpose="GRN_CREATION",
        )
        receipt_id = tech_id
        receipt_no = req.receipt_no or id_code
        identity_code = id_code

        # Register external challan/paper GRN as alias if custom number provided
        if req.receipt_no and req.receipt_no != id_code:
            await IdentityEngine.register_alias(
                session=self.db,
                entity_type="PURCHASE_RECEIPT",
                entity_id=receipt_id,
                alias_code=req.receipt_no,
                alias_type="PHYSICAL_GRN",
                source_system="CHALLAN",
                canonical_identity_code=id_code,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                notes="Supplier physical challan GRN reference",
            )

        for idx, item in enumerate(req.items, start=1):
            if item.quantity_received <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail="Quantity received must be greater than zero.",
                )
            product = await self._get_product(item.product_id)
            tax_amt = (
                item.cost_price * item.quantity_received * (item.gst_rate / Decimal("100"))
            ).quantize(Decimal("0.01"))
            line_tot = (item.cost_price * item.quantity_received + tax_amt).quantize(
                Decimal("0.01")
            )
            subtotal += item.cost_price * item.quantity_received
            tax_total += tax_amt

            item_tech_id = IdentityEngine.generate_technical_id()
            batch_no = item.batch_no or f"BATCH-{receipt_no}-{idx:02d}"

            item_rows.append(PurchaseReceiptItem(
                id=item_tech_id,
                uuid=item_tech_id,
                receipt_id=receipt_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                batch_no=batch_no,
                mfg_date=item.mfg_date,
                expiry_date=item.expiry_date,
                mrp=item.mrp,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                quantity_damaged=item.quantity_damaged or Decimal("0.00"),
                cost_price=item.cost_price,
                gst_rate=item.gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
            ))

        grand_total = (subtotal + tax_total).quantize(Decimal("0.01"))

        # Build logistics & landed cost notes if transport details provided
        transport_parts = []
        if req.transporter_name:
            transport_parts.append(f"Transporter: {req.transporter_name}")
        if req.lr_number:
            transport_parts.append(f"LR: {req.lr_number}")
        if req.lr_date:
            transport_parts.append(f"Date: {req.lr_date}")
        if req.vehicle_number:
            transport_parts.append(f"Vehicle: {req.vehicle_number}")
        if req.freight_amount and req.freight_amount > Decimal("0.00"):
            transport_parts.append(f"Freight: Rs. {req.freight_amount}")
        if req.handling_amount and req.handling_amount > Decimal("0.00"):
            transport_parts.append(f"Handling: Rs. {req.handling_amount}")
        if req.insurance_amount and req.insurance_amount > Decimal("0.00"):
            transport_parts.append(f"Insurance: Rs. {req.insurance_amount}")
        if req.pkg_forward_amount and req.pkg_forward_amount > Decimal("0.00"):
            transport_parts.append(f"P&F: Rs. {req.pkg_forward_amount}")

        combined_notes = req.notes or ""
        if transport_parts:
            transport_str = f"[LOGISTICS & LANDED COST: {', '.join(transport_parts)}]"
            combined_notes = f"{combined_notes} | {transport_str}" if combined_notes else transport_str

        receipt = PurchaseReceipt(
            id=receipt_id,
            uuid=receipt_id,
            receipt_no=receipt_no,
            identity_code=identity_code,
            supplier_id=req.supplier_id,
            warehouse_id=warehouse_id,
            order_id=req.order_id,
            status="RECEIVED",
            notes=combined_notes or None,
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=grand_total,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(receipt)
        self.db.add_all(item_rows)

        # Inward Landed Cost & Multi-Component Allocation Engine
        from .landed_cost import LandedCostAllocationEngine
        from ..schemas.inward_cost import InwardCostComponentCreate

        effective_components: list[InwardCostComponentCreate] = []
        if req.cost_components:
            effective_components = list(req.cost_components)
        else:
            if req.freight_amount and req.freight_amount > Decimal("0.00"):
                effective_components.append(InwardCostComponentCreate(
                    component_type="FREIGHT",
                    amount=req.freight_amount,
                    allocation_method=req.allocation_method or "VALUE",
                    transporter_name=req.transporter_name,
                    document_no=req.lr_number,
                    document_date=req.lr_date,
                    vehicle_no=req.vehicle_number,
                    itc_eligible=True,
                    is_capitalizable=True,
                ))
            if req.handling_amount and req.handling_amount > Decimal("0.00"):
                effective_components.append(InwardCostComponentCreate(
                    component_type="HANDLING",
                    amount=req.handling_amount,
                    allocation_method="QUANTITY",
                    itc_eligible=True,
                    is_capitalizable=True,
                ))
            if req.insurance_amount and req.insurance_amount > Decimal("0.00"):
                effective_components.append(InwardCostComponentCreate(
                    component_type="INSURANCE",
                    amount=req.insurance_amount,
                    allocation_method="VALUE",
                    itc_eligible=True,
                    is_capitalizable=True,
                ))
            if req.pkg_forward_amount and req.pkg_forward_amount > Decimal("0.00"):
                effective_components.append(InwardCostComponentCreate(
                    component_type="PACKING_FORWARDING",
                    amount=req.pkg_forward_amount,
                    allocation_method="VALUE",
                    itc_eligible=True,
                    is_capitalizable=True,
                ))

        if effective_components:
            await LandedCostAllocationEngine.allocate_and_persist_components_async(
                db=self.db,
                receipt=receipt,
                item_rows=item_rows,
                components_in=effective_components,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                user_id=getattr(self.tenant, "user_id", None),
            )

        # Inward into WMS Batch Stock atomically with true calculated landed cost
        from ..models.profitability import ProductCostValuation
        for item_row in item_rows:
            landed = getattr(item_row, "landed_cost", None)
            effective_unit_cost = (
                Decimal(str(landed))
                if landed is not None and Decimal(str(landed)) > Decimal("0.00")
                else item_row.cost_price
            )

            await wms_service.atomic_mutate_batch_stock(
                product_id=item_row.product_id,
                warehouse_id=warehouse_id,
                batch_no=item_row.batch_no,
                qty_delta=Decimal(str(item_row.quantity_received)),
                movement_type="INWARD_GRN",
                mfg_date=item_row.mfg_date,
                expiry_date=item_row.expiry_date,
                mrp=item_row.mrp,
                purchase_rate=item_row.cost_price,
                unit_cost=effective_unit_cost,
                reference_doc_type="Purchase Receipt",
                reference_doc_id=receipt_id,
                remarks=f"Inward GRN receipt {receipt_no} from supplier {req.supplier_id}",
            )

            # Atomically update / upsert ProductCostValuation for retail multi-valuation COGS
            val_res = await self.db.execute(
                select(ProductCostValuation).where(ProductCostValuation.product_id == item_row.product_id)
            )
            valuation = val_res.scalars().first()
            if valuation:
                valuation.purchase_cost = item_row.cost_price
                valuation.last_purchase_cost = item_row.cost_price
                valuation.landed_cost = effective_unit_cost
                if item_row.mrp and item_row.mrp > Decimal("0.00"):
                    valuation.mrp = item_row.mrp
                valuation.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                val_tech_id = IdentityEngine.generate_technical_id()
                new_val = ProductCostValuation(
                    id=val_tech_id,
                    uuid=val_tech_id,
                    product_id=item_row.product_id,
                    purchase_cost=item_row.cost_price,
                    last_purchase_cost=item_row.cost_price,
                    landed_cost=effective_unit_cost,
                    mrp=item_row.mrp or Decimal("0.00"),
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
                self.db.add(new_val)


        supplier = await self._get_supplier(req.supplier_id)
        supplier.outstanding = (supplier.outstanding + grand_total).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        # Record Transactional Outbox event atomically within same DB transaction
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "PURCHASE_RECEIPT_COMPLETED",
                "receipt_no": receipt.receipt_no,
                "supplier_id": receipt.supplier_id,
                "grand_total": str(receipt.grand_total),
                "company_code": self.tenant.company_id
            },
            causation_id=receipt.receipt_no
        )

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
        stmt = (
            select(PurchaseReceipt)
            .options(
                selectinload(PurchaseReceipt.items),
                selectinload(PurchaseReceipt.cost_components),
            )
            .where(
                PurchaseReceipt.is_deleted == False,
            )
            .order_by(PurchaseReceipt.created_at.desc())
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                or_(
                    PurchaseReceipt.company_id == self.tenant.company_id,
                    PurchaseReceipt.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(PurchaseReceipt.branch_id))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_purchase_receipt(
        self, receipt_id: str
    ) -> tuple[PurchaseReceipt, list[PurchaseReceiptItem]]:
        stmt = (
            select(PurchaseReceipt)
            .options(
                selectinload(PurchaseReceipt.items),
                selectinload(PurchaseReceipt.cost_components),
            )
            .where(
                PurchaseReceipt.id == receipt_id,
                PurchaseReceipt.is_deleted == False,
            )
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                or_(
                    PurchaseReceipt.company_id == self.tenant.company_id,
                    PurchaseReceipt.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(PurchaseReceipt.branch_id))
        res = await self.db.execute(stmt)
        receipt = res.scalars().first()
        if not receipt:
            raise HTTPException(status_code=404, detail="Purchase receipt not found.")

        return receipt, list(receipt.items or [])

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
        cfg_stmt = select(PurchaseReorderConfig).where(
            PurchaseReorderConfig.is_deleted == False
        )
        if self.tenant.company_id:
            cfg_stmt = cfg_stmt.where(
                or_(
                    PurchaseReorderConfig.company_id == self.tenant.company_id,
                    PurchaseReorderConfig.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            cfg_stmt = cfg_stmt.where(self._branch_filter(PurchaseReorderConfig.branch_id))
        cfg_res = await self.db.execute(cfg_stmt)
        configs = {cfg.product_id: cfg for cfg in cfg_res.scalars().all()}

        # Fetch ItemWarehouseLocations from DB for items with reorder levels
        from ..models.item_master import ItemWarehouseLocation
        loc_res = await self.db.execute(select(ItemWarehouseLocation))
        item_locs = {loc.item_id: loc for loc in loc_res.scalars().all()}

        # Fetch all suppliers and confirmed orders for sourcing history rate calculations
        suppliers_list = await self.list_suppliers()
        confirmed_po_stmt = select(PurchaseOrder).where(
            PurchaseOrder.status.in_(["Confirmed", "Complete"]),
            PurchaseOrder.is_deleted == False,
        )
        if self.tenant.company_id:
            confirmed_po_stmt = confirmed_po_stmt.where(
                or_(
                    PurchaseOrder.company_id == self.tenant.company_id,
                    PurchaseOrder.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            confirmed_po_stmt = confirmed_po_stmt.where(self._branch_filter(PurchaseOrder.branch_id))
        confirmed_po_res = await self.db.execute(confirmed_po_stmt)
        confirmed_orders = confirmed_po_res.scalars().all()

        suggestions = []

        for prod in products:
            # 1. Match database configuration from PurchaseReorderConfig
            db_cfg = configs.get(prod.id)
            level = None
            reorder_qty = None
            preferred_supplier_id = None

            if db_cfg:
                level = float(db_cfg.reorder_level)
                reorder_qty = float(db_cfg.reorder_quantity)
                preferred_supplier_id = db_cfg.preferred_supplier_id

            # 2. Check ItemWarehouseLocation from DB
            if level is None and prod.item_id and prod.item_id in item_locs:
                loc = item_locs[prod.item_id]
                if loc.min_reorder_level and float(loc.min_reorder_level) > 0:
                    level = float(loc.min_reorder_level)
                    reorder_qty = float(loc.reorder_quantity or (level * 2))

            # 3. Check product JSON attributes in DB
            if level is None and prod.attributes and isinstance(prod.attributes, dict):
                attr_lvl = prod.attributes.get("reorder_level") or prod.attributes.get("min_stock_level")
                if attr_lvl is not None:
                    try:
                        level = float(attr_lvl)
                        reorder_qty = float(prod.attributes.get("reorder_qty") or (level * 2))
                    except (ValueError, TypeError):
                        pass

            # If no reorder threshold defined in DB, skip
            if level is None:
                continue

            # Resolve preferred supplier from DB if not already set
            if not preferred_supplier_id:
                if prod.vendor_code:
                    v_sup = next((s for s in suppliers_list if s.code == prod.vendor_code or s.id == prod.vendor_code), None)
                    if v_sup:
                        preferred_supplier_id = v_sup.id
                if not preferred_supplier_id and suppliers_list:
                    preferred_supplier_id = suppliers_list[0].id

            if supplier_id and preferred_supplier_id != supplier_id:
                continue

            current_qty = prod.stock
            if current_qty <= level:
                suggested_qty = reorder_qty - current_qty
                supplier = next((s for s in suppliers_list if s.id == preferred_supplier_id), None)

                # Fetch true purchase rate from DB sourcing history or product cost master
                last_rate = None
                rate_source = None

                # Sort confirmed orders by date desc to find last rate from DB
                sorted_orders = sorted(
                    [o for o in confirmed_orders if o.supplier_id == preferred_supplier_id],
                    key=lambda o: o.created_at,
                    reverse=True
                )
                if sorted_orders:
                    order_items_res = await self.db.execute(
                        select(PurchaseOrderItem).where(
                            PurchaseOrderItem.order_id == sorted_orders[0].id,
                            PurchaseOrderItem.product_id == prod.id
                        )
                    )
                    o_item = order_items_res.scalars().first()
                    if o_item and o_item.cost_price:
                        last_rate = float(o_item.cost_price)
                        rate_source = "Supplier Sourcing History"

                # If no order history, check Product Cost Master in DB
                if last_rate is None and prod.cost_price and Decimal(str(prod.cost_price)) > Decimal("0.00"):
                    last_rate = float(prod.cost_price)
                    rate_source = "Product Cost Master"
                elif last_rate is None and prod.buying_price and Decimal(str(prod.buying_price)) > Decimal("0.00"):
                    last_rate = float(prod.buying_price)
                    rate_source = "Product Buying Master"
                elif last_rate is None:
                    last_rate = float(prod.price) * 0.6
                    rate_source = "Estimated Margin Base"

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

        order_id = IdentityEngine.generate_technical_id()

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
            gst_rate = Decimal(str(product.gst_percentage or 18))
            tax_amount = (cost_price * quantity * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
            line_total = (cost_price * quantity + tax_amount).quantize(Decimal("0.01"))

            subtotal += cost_price * quantity
            tax_total += tax_amount

            poi_id = IdentityEngine.generate_technical_id()
            item_rows.append(PurchaseOrderItem(
                id=poi_id,
                uuid=poi_id,
                order_id=order_id,
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
        Fetch company state tax jurisdiction from DB.
        """
        stmt = select(PurchaseJurisdictionConfig).where(
            PurchaseJurisdictionConfig.is_deleted == False
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                or_(
                    PurchaseJurisdictionConfig.company_id == self.tenant.company_id,
                    PurchaseJurisdictionConfig.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            stmt = stmt.where(self._branch_filter(PurchaseJurisdictionConfig.branch_id))

        res = await self.db.execute(stmt)
        cfg = res.scalars().first()
        if cfg and cfg.company_state:
            return cfg.company_state

        # Check Company record from DB
        from ..models.tenant import Company
        if self.tenant.company_id:
            c_res = await self.db.execute(
                select(Company).where(Company.id == self.tenant.company_id, Company.is_deleted == False)
            )
            comp = c_res.scalars().first()
            if comp and comp.gst_number and len(comp.gst_number) >= 2 and comp.gst_number[:2].isdigit():
                from ..core.gst_engine import GST_STATE_CODES
                gst_code = comp.gst_number[:2]
                if gst_code in GST_STATE_CODES:
                    return gst_code

        return "DL"

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
            jur_id = IdentityEngine.generate_technical_id()
            cfg = PurchaseJurisdictionConfig(
                id=jur_id,
                uuid=jur_id,
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
            amend_poi_id = IdentityEngine.generate_technical_id()
            item_rows.append(PurchaseOrderItem(
                id=amend_poi_id,
                uuid=amend_poi_id,
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
        Return the last GRN (PurchaseReceiptItem) cost_price for supplier+product from DB.
        Falls back to last PurchaseOrderItem cost_price if no GRN exists,
        or product master cost_price/buying_price from database.
        """
        # Try last GRN cost from DB
        receipt_stmt = (
            select(PurchaseReceiptItem)
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .where(
                PurchaseReceipt.is_deleted == False,
                PurchaseReceipt.supplier_id == supplier_id,
                PurchaseReceiptItem.product_id == product_id,
            )
        )
        if self.tenant.company_id:
            receipt_stmt = receipt_stmt.where(
                or_(
                    PurchaseReceipt.company_id == self.tenant.company_id,
                    PurchaseReceipt.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            receipt_stmt = receipt_stmt.where(self._branch_filter(PurchaseReceipt.branch_id))

        receipt_stmt = receipt_stmt.order_by(PurchaseReceipt.created_at.desc()).limit(1)
        receipt_res = await self.db.execute(receipt_stmt)
        grn_item = receipt_res.scalars().first()
        if grn_item and grn_item.cost_price:
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(grn_item.cost_price),
                "source": "last_grn",
            }

        # Fallback 1: last PO cost from DB
        po_stmt = (
            select(PurchaseOrderItem)
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.order_id)
            .where(
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.supplier_id == supplier_id,
                PurchaseOrderItem.product_id == product_id,
            )
        )
        if self.tenant.company_id:
            po_stmt = po_stmt.where(
                or_(
                    PurchaseOrder.company_id == self.tenant.company_id,
                    PurchaseOrder.company_id.is_(None),
                )
            )
        if self.tenant.branch_id:
            po_stmt = po_stmt.where(self._branch_filter(PurchaseOrder.branch_id))

        po_stmt = po_stmt.order_by(PurchaseOrder.created_at.desc()).limit(1)
        po_res = await self.db.execute(po_stmt)
        po_item = po_res.scalars().first()
        if po_item and po_item.cost_price:
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(po_item.cost_price),
                "source": "last_purchase_order",
            }

        # Fallback 2: Check database Product Master (cost_price / buying_price)
        prod = await self._get_product(product_id)
        if prod.cost_price and Decimal(str(prod.cost_price)) > Decimal("0.00"):
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(prod.cost_price),
                "source": "product_master_cost",
            }
        if prod.buying_price and Decimal(str(prod.buying_price)) > Decimal("0.00"):
            return {
                "supplier_id": supplier_id,
                "product_id": product_id,
                "default_rate": float(prod.buying_price),
                "source": "product_master_buying_price",
            }

        raise HTTPException(
            status_code=404,
            detail=f"No purchase history or product cost found in database for supplier '{supplier_id}' and product '{product_id}'.",
        )

    # ─── Debit Notes ────────────────────────────────────────────────────────
    async def create_debit_note(self, req: DebitNoteCreate) -> dict:
        supplier = await self._get_supplier(req.supplier_id)
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=self.db,
            entity_type="DEBIT_NOTE",
            group_code="PUR",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            purpose="DEBIT_NOTE_CREATION",
        )
        dn_id = tech_id
        dn_no = req.debit_note_no or id_code

        # Register external debit note reference as alias if supplied
        if req.debit_note_no and req.debit_note_no != id_code:
            await IdentityEngine.register_alias(
                session=self.db,
                entity_type="DEBIT_NOTE",
                entity_id=dn_id,
                alias_code=req.debit_note_no,
                alias_type="EXTERNAL_DEBIT_NOTE",
                source_system="SUPPLIER_PORTAL",
                canonical_identity_code=id_code,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                notes="External debit note reference",
            )

        supplier.outstanding = (supplier.outstanding - req.total_debit_amount).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PURCHASE_DEBIT_NOTES",
            event_type="PURCHASE_DEBIT_NOTE_ISSUED",
            aggregate_type="PurchaseDebitNote",
            aggregate_id=dn_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            payload={
                "debit_note_no": dn_no,
                "identity_code": id_code,
                "supplier_id": supplier.id,
                "supplier_name": supplier.name,
                "receipt_id": req.receipt_id,
                "claim_amount": str(req.claim_amount),
                "tax_amount": str(req.tax_amount or Decimal("0.00")),
                "total_debit_amount": str(req.total_debit_amount),
                "reason": req.reason,
            },
        )
        await self.db.commit()
        return {
            "id": dn_id,
            "debit_note_no": dn_no,
            "identity_code": id_code,
            "supplier_id": supplier.id,
            "receipt_id": req.receipt_id,
            "claim_amount": req.claim_amount,
            "tax_amount": req.tax_amount or Decimal("0.00"),
            "total_debit_amount": req.total_debit_amount,
            "status": req.status or "ISSUED",
            "reason": req.reason,
            "created_at": datetime.now(timezone.utc),
        }

    # ─── Purchase Bills ─────────────────────────────────────────────────────
    async def create_purchase_bill(self, req: PurchaseBillCreate) -> dict:
        supplier = await self._get_supplier(req.supplier_id)
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=self.db,
            entity_type="PURCHASE_BILL",
            group_code="PUR",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            purpose="PURCHASE_BILL_CREATION",
        )
        bill_id = tech_id
        bill_no = req.bill_no or id_code

        # Register external supplier invoice number as sovereign alias
        if req.bill_no and req.bill_no != id_code:
            await IdentityEngine.register_alias(
                session=self.db,
                entity_type="PURCHASE_BILL",
                entity_id=bill_id,
                alias_code=req.bill_no,
                alias_type="SUPPLIER_INVOICE",
                source_system="SUPPLIER",
                canonical_identity_code=id_code,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                notes="External supplier invoice reference",
            )

        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PURCHASE_BILLS",
            event_type="PURCHASE_BILL_POSTED",
            aggregate_type="PurchaseBill",
            aggregate_id=bill_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            payload={
                "bill_no": bill_no,
                "identity_code": id_code,
                "supplier_id": supplier.id,
                "supplier_name": supplier.name,
                "receipt_id": req.receipt_id,
                "order_id": req.order_id,
                "taxable_amount": str(req.taxable_amount),
                "tax_amount": str(req.tax_amount),
                "total_amount": str(req.total_amount),
            },
        )
        await self.db.commit()
        return {
            "id": bill_id,
            "bill_no": bill_no,
            "identity_code": id_code,
            "supplier_id": supplier.id,
            "receipt_id": req.receipt_id,
            "order_id": req.order_id,
            "bill_date": req.bill_date or datetime.now(timezone.utc).date(),
            "taxable_amount": req.taxable_amount,
            "tax_amount": req.tax_amount,
            "total_amount": req.total_amount,
            "status": "POSTED",
            "notes": req.notes,
        }
