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

* Version    : 3.35.0
* Created    : 2026-07-11
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

import logging
import uuid
from typing import Optional, List, Any, Dict
from decimal import Decimal
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseReorderConfig, PurchaseJurisdictionConfig,
    PurchaseBill, PurchaseBillItem,
)
from ..models.inventory import Product, StockMovement
from ..models.item_master import ItemVariant
from ..models.workflow import WorkflowEvent
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
            (Product.id == product_id)
            | (Product.code == product_id)
            | (Product.sku == product_id)
            | (Product.barcode == product_id),
            Product.is_deleted == False,
        )
        if self.tenant.company_id:
            stmt = stmt.where(
                (Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None))
            )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product and self.tenant.company_id:
            from .product_resolution_service import ProductResolutionService
            resolved = await ProductResolutionService.resolve(
                session=self.db,
                company_id=self.tenant.company_id,
                identifier=product_id,
            )
            if resolved and resolved.product_id:
                p_stmt = select(Product).where(
                    Product.id == resolved.product_id,
                    Product.is_deleted == False,
                )
                if self.tenant.company_id:
                    p_stmt = p_stmt.where(
                        (Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None))
                    )
                p_res = await self.db.execute(p_stmt)
                product = p_res.scalars().first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "ITEM_NOT_FOUND",
                    "title": "Item Not Found",
                    "message": f"Item/SKU/Barcode '{product_id}' not found in Item Master. Please create the item in Item Master first.",
                },
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

        from .product_resolution_service import ProductResolutionService
        from ..schemas.product_resolution import TransactionLineItemInput

        for idx, item in enumerate(req.items):
            line_no = idx + 1
            clean_item_code = (item.code or "").strip()
            clean_prod_id = (item.product_id or "").strip()

            line_input = TransactionLineItemInput(
                line_no=line_no,
                product_id=clean_prod_id or None,
                code=clean_item_code or None,
                sku=clean_item_code or None,
                barcode=clean_item_code if (clean_item_code and clean_item_code.isdigit()) else None,
                quantity=item.quantity,
            )
            res = await ProductResolutionService.validate_line(
                session=self.db,
                company_id=self.tenant.company_id,
                line=line_input,
                allow_inactive=False,
            )
            if not res.success:
                err = res.error_detail
                status_code = 404 if res.code == "PRODUCT_NOT_FOUND" else 400
                ident_val = clean_item_code or clean_prod_id
                raise HTTPException(
                    status_code=status_code,
                    detail={
                        "code": res.code or "PRODUCT_NOT_FOUND",
                        "title": err.title if err else "Product Not Found",
                        "explanation": err.explanation if err else f"Product '{ident_val}' was not found in Product List.",
                        "suggested_action": err.suggested_action if err else "Please add the product to Product List before continuing.",
                        "identifier": ident_val,
                        "line_no": line_no,
                    },
                )

            # Ensure we have a persistent Product row reference for transactional foreign keys
            product = await self.db.get(Product, res.product_id) if res.product_id else None
            if not product:
                p_stmt = select(Product).where(
                    (Product.id == res.product_id) | (Product.code == res.sku) | (Product.item_id == res.item_id),
                    Product.is_deleted == False,
                )
                if self.tenant.company_id:
                    p_stmt = p_stmt.where((Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None)))
                product = (await self.db.execute(p_stmt)).scalars().first()

            if not product and res.item_id:
                # Synchronize legacy Product bridge record linked directly to canonical item_id
                bc_val = (res.barcode or "").strip() or (res.sku or "").strip() or clean_item_code or f"PROD-{uuid.uuid4().hex[:8]}"
                var_suffix = f"_{res.variant_id[-8:]}" if res.variant_id else f"_{uuid.uuid4().hex[:6]}"
                product = Product(
                    id=f"prd_{res.item_id[:20]}{var_suffix}",
                    item_id=res.item_id,
                    item_variant_id=res.variant_id,
                    code=res.sku or clean_item_code or f"SKU{var_suffix}",
                    name=res.name or item.name or clean_item_code or "Product",
                    category=res.category or "GENERAL",
                    barcode=bc_val,
                    hsn_code=res.hsn_code or "6109",
                    company_id=self.tenant.company_id,
                    branch_id=eff_branch_id,
                    price=res.selling_price,
                    cost_price=Decimal(str(item.cost_price or 0.00)),
                    stock=0,
                    reserved_stock=Decimal("0.0000"),
                )
                self.db.add(product)
                await self.db.flush()

            if not product:
                ident_val = clean_item_code or clean_prod_id
                raise HTTPException(
                    status_code=404,
                    detail={
                        "code": "PRODUCT_NOT_FOUND",
                        "title": "Product Not Found",
                        "explanation": f"Product '{ident_val}' was not found in Product List.",
                        "suggested_action": "Please add the product to Product List before continuing.",
                        "identifier": ident_val,
                        "line_no": line_no,
                    },
                )

            tax_amt  = (item.cost_price * item.quantity * item.gst_rate / 100).quantize(Decimal("0.01"))
            line_tot = (item.cost_price * item.quantity + tax_amt).quantize(Decimal("0.01"))
            subtotal  += item.cost_price * item.quantity
            tax_total += tax_amt

            # Resolve variant_id with strict ambiguity guard (ADR-001 / R-01)
            po_variant_id = getattr(item, "variant_id", None)
            canonical_item_id = getattr(product, "item_id", None) or res.item_id
            if not po_variant_id and canonical_item_id:
                var_q = select(ItemVariant).where(
                    ItemVariant.item_id == canonical_item_id,
                    ItemVariant.company_id == self.tenant.company_id,
                    ItemVariant.is_active == True,
                    ItemVariant.is_deleted == False,
                )
                active_vars = (await self.db.execute(var_q)).scalars().all()
                if len(active_vars) == 1:
                    po_variant_id = active_vars[0].id
                elif len(active_vars) > 1:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "AMBIGUOUS_ITEM_VARIANT",
                            "title": "Ambiguous Item Variant",
                            "explanation": (
                                f"Item '{product.code or clean_item_code}' has {len(active_vars)} active variants. "
                                "A specific variant_id must be provided; silent variant inference is prohibited."
                            ),
                            "suggested_action": "Select the specific variant (Size/Color) to include in this purchase order.",
                            "line_no": line_no,
                            "available_variants": [{"id": v.id, "sku": v.variant_sku} for v in active_vars],
                        },
                    )
            elif not po_variant_id:
                po_variant_id = res.variant_id or getattr(product, "item_variant_id", None)

            item_rows.append(PurchaseOrderItem(
                id=IdentityEngine.generate_technical_id(),
                uuid=IdentityEngine.generate_technical_id(),
                order_id=po_id,
                product_id=product.id,
                item_id=getattr(product, "item_id", None),
                variant_id=po_variant_id,
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

        # ── Normalize and guard status server-side ──────────────────────────
        # Clients may send DRAFT (or omit). CONFIRMED may only be set via the
        # /confirm endpoint, never by the create payload directly.
        _ALLOWED_CREATE_STATUSES = {"DRAFT", "SUBMITTED", "CONFIRMED"}
        raw_status = str(req.status or "DRAFT").strip().upper()
        if raw_status not in _ALLOWED_CREATE_STATUSES:
            raw_status = "DRAFT"
        # For safety: only MANAGER/SYSADMIN can create as CONFIRMED via payload.
        # DRAFT is the safe default for all create operations.
        po_status = raw_status if raw_status == "DRAFT" else "DRAFT"

        order = PurchaseOrder(
            id=po_id,
            identity_code=identity_code,
            order_no=req.order_no or identity_code or f"PO-{uuid.uuid4().hex[:8].upper()}",
            supplier_id=supplier.id,
            status=po_status,
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
            logger.error(f"[PO INTEGRITY ERROR] {e} | orig: {getattr(e, 'orig', e)}")
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

    async def list_purchase_orders(
        self,
        pending_only: bool = False,
        supplier_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[PurchaseOrder]:
        """
        List purchase orders for the tenant.
        Phase B: status filter — pass a single status value (e.g. 'DRAFT',
        'SUBMITTED', 'CONFIRMED') or None for all.
        """
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.company_id == self.tenant.company_id,
            PurchaseOrder.is_deleted == False,
        )
        if supplier_id:
            stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)
        if status:
            # Normalise to uppercase; support comma-separated multi-status
            statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
            if statuses:
                stmt = stmt.where(PurchaseOrder.status.in_(statuses))
        elif pending_only:
            stmt = stmt.where(
                ~PurchaseOrder.status.in_(["RECEIVED", "COMPLETED", "CANCELLED", "Received", "Completed", "Cancelled", "DRAFT", "Draft"])
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

        # Pre-flight check: duplicate GRN receipt_no immutability
        if req.receipt_no and req.receipt_no.strip():
            existing_receipt_stmt = select(PurchaseReceipt).where(
                PurchaseReceipt.receipt_no == req.receipt_no.strip(),
                PurchaseReceipt.company_id == self.tenant.company_id,
                PurchaseReceipt.is_deleted == False,
            )
            existing_receipt_res = await self.db.execute(existing_receipt_stmt)
            if existing_receipt_res.scalars().first():
                raise HTTPException(
                    status_code=409,
                    detail=f"Purchase Receipt / GRN '{req.receipt_no.strip()}' has already been posted and committed. Duplicate GRN submission is prohibited.",
                )

        linked_po: Optional[PurchaseOrder] = None
        if req.order_id:
            po_stmt = select(PurchaseOrder).where(
                (PurchaseOrder.id == req.order_id) | (PurchaseOrder.order_no == req.order_id) | (PurchaseOrder.identity_code == req.order_id),
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.is_deleted == False,
            )
            if self.tenant.branch_id:
                po_stmt = po_stmt.where(self._branch_filter(PurchaseOrder.branch_id))
            po_res = await self.db.execute(po_stmt)
            linked_po = po_res.scalars().first()
            if not linked_po:
                raise HTTPException(
                    status_code=404,
                    detail="The linked purchase order was not found. "
                           "Please verify the order ID.",
                )
            if (linked_po.status or "").upper() in ("RECEIVED", "COMPLETED"):
                raise HTTPException(
                    status_code=409,
                    detail=f"Purchase Order '{linked_po.order_no or req.order_id}' has already been fully received and closed. Duplicate receipt against a fulfilled PO is prohibited.",
                )
            if (linked_po.status or "").upper() == "CANCELLED":
                raise HTTPException(
                    status_code=400,
                    detail=f"Purchase Order '{linked_po.order_no or req.order_id}' is cancelled and cannot be received.",
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
            try:
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
            except ValueError:
                raise HTTPException(
                    status_code=409,
                    detail=f"Purchase Receipt / GRN '{req.receipt_no.strip()}' has already been registered or committed. Duplicate GRN submission is prohibited.",
                )

        for idx, item in enumerate(req.items, start=1):
            if item.quantity_received <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail="Quantity received must be greater than zero.",
                )
            product = await self._get_product(item.product_id)

            target_po_id = (item.purchase_order_id or item.order_id or req.order_id or "").strip()
            target_po: Optional[PurchaseOrder] = None
            target_po_line: Optional[PurchaseOrderItem] = None
            if target_po_id:
                po_stmt = select(PurchaseOrder).where(
                    (PurchaseOrder.id == target_po_id) | (PurchaseOrder.order_no == target_po_id) | (PurchaseOrder.identity_code == target_po_id),
                    PurchaseOrder.company_id == self.tenant.company_id,
                    PurchaseOrder.is_deleted == False,
                )
                if self.tenant.branch_id:
                    po_stmt = po_stmt.where(self._branch_filter(PurchaseOrder.branch_id))
                po_res = await self.db.execute(po_stmt)
                target_po = po_res.scalars().first()
                if not target_po:
                    raise HTTPException(status_code=404, detail="The linked purchase order was not found.")
                if target_po.supplier_id != req.supplier_id:
                    raise HTTPException(status_code=400, detail=f"Receipt supplier '{req.supplier_id}' does not match purchase order '{target_po.order_no}'.")
                if (target_po.status or "").upper() in ("RECEIVED", "COMPLETED"):
                    raise HTTPException(status_code=409, detail=f"Purchase Order '{target_po.order_no}' has already been fully received and closed.")
                if (target_po.status or "").upper() == "CANCELLED":
                    raise HTTPException(status_code=400, detail=f"Purchase Order '{target_po.order_no}' is cancelled and cannot be received.")

                canonical_variant_id = getattr(item, "variant_id", None) or getattr(product, "item_variant_id", None) or (str(product.variant_id) if getattr(product, "variant_id", None) else None)
                po_line_stmt = select(PurchaseOrderItem).where(
                    PurchaseOrderItem.order_id == target_po.id,
                    PurchaseOrderItem.is_deleted == False,
                )
                if canonical_variant_id:
                    po_line_stmt = po_line_stmt.where(
                        or_(
                            PurchaseOrderItem.variant_id == canonical_variant_id,
                            PurchaseOrderItem.product_id == product.id,
                        )
                    )
                else:
                    po_line_stmt = po_line_stmt.where(PurchaseOrderItem.product_id == product.id)

                po_line_res = await self.db.execute(po_line_stmt)
                target_po_line = po_line_res.scalars().first()
                if not target_po_line:
                    raise HTTPException(status_code=400, detail=f"Product '{product.code}' is not present on purchase order '{target_po.order_no}'.")

                received_stmt = select(func.coalesce(func.sum(PurchaseReceiptItem.quantity_received), Decimal("0.00"))).select_from(PurchaseReceiptItem).join(
                    PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id
                ).where(
                    PurchaseReceiptItem.purchase_order_id == target_po.id,
                    PurchaseReceiptItem.is_deleted == False,
                    PurchaseReceipt.is_deleted == False,
                )
                if canonical_variant_id:
                    received_stmt = received_stmt.where(
                        or_(
                            PurchaseReceiptItem.variant_id == canonical_variant_id,
                            PurchaseReceiptItem.product_id == product.id,
                        )
                    )
                else:
                    received_stmt = received_stmt.where(PurchaseReceiptItem.product_id == product.id)
                received_res = await self.db.execute(received_stmt)
                already_received = Decimal(str(received_res.scalar() or Decimal("0.00")))
                remaining_allowed = target_po_line.quantity - already_received
                if item.quantity_received > remaining_allowed:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Receipt quantity {item.quantity_received} exceeds remaining pending quantity "
                            f"{remaining_allowed} for product '{product.code}' on purchase order '{target_po.order_no}'."
                        ),
                    )

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
            effective_batch_id = getattr(item, "batch_id", None)
            effective_loc_id = getattr(item, "warehouse_location_id", None) or getattr(item, "location_id", None)

            # Phase 2: Dual-Key Canonical Identity Resolution & Validation
            canonical_item_id = getattr(product, "item_id", None)
            grn_variant_id = (
                getattr(item, "variant_id", None)
                or (getattr(target_po_line, "variant_id", None) if target_po_line else None)
            )
            if not canonical_item_id or not grn_variant_id:
                from .product_resolution_service import ProductResolutionService
                resolved_canon = await ProductResolutionService.resolve_by_product_id(
                    session=self.db,
                    company_id=self.tenant.company_id,
                    product_id=product.id,
                )
                if resolved_canon and resolved_canon.item_id:
                    canonical_item_id = canonical_item_id or resolved_canon.item_id
                    grn_variant_id = grn_variant_id or resolved_canon.variant_id

            if not grn_variant_id and canonical_item_id:
                var_q = select(ItemVariant).where(
                    ItemVariant.item_id == canonical_item_id,
                    ItemVariant.company_id == self.tenant.company_id,
                    ItemVariant.is_active == True,
                    ItemVariant.is_deleted == False,
                )
                active_vars = (await self.db.execute(var_q)).scalars().all()
                if len(active_vars) == 1:
                    grn_variant_id = active_vars[0].id
                elif len(active_vars) > 1:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "AMBIGUOUS_ITEM_VARIANT",
                            "title": "Ambiguous Item Variant",
                            "explanation": (
                                f"Item '{product.code}' has {len(active_vars)} active variants. "
                                "A specific variant_id must be provided; silent variant inference is prohibited."
                            ),
                            "suggested_action": "Specify the exact variant_id (Size/Color) being received in the GRN.",
                            "line_no": idx,
                            "available_variants": [{"id": v.id, "sku": v.variant_sku} for v in active_vars],
                        },
                    )
            elif not grn_variant_id:
                grn_variant_id = getattr(product, "item_variant_id", None)

            # Strict Phase 2 Gate: NO STOCK WITHOUT CANONICAL IDENTITY
            if not canonical_item_id or not grn_variant_id:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "UNLINKED_PRODUCT_NOT_ALLOWED",
                        "title": "Unlinked Product Prohibited",
                        "message": f"Product '{product.code}' is not linked to canonical Item Master. Stock inward via GRN is prohibited.",
                        "suggested_action": "Item/SKU/Barcode not found in Item Master. Please create the item in Item Master first.",
                    },
                )

            # Validate cross-field mismatch if caller explicitly supplied item_id or variant_id
            caller_item_id = getattr(item, "item_id", None)
            caller_variant_id = getattr(item, "variant_id", None)
            if caller_item_id and caller_item_id != canonical_item_id:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "PRODUCT_CANONICAL_MISMATCH",
                        "title": "Product Item Mismatch",
                        "message": f"Provided item_id '{caller_item_id}' does not match canonical item '{canonical_item_id}' for product '{product.id}'.",
                    },
                )
            if caller_variant_id and grn_variant_id and caller_variant_id != grn_variant_id:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "PRODUCT_CANONICAL_MISMATCH",
                        "title": "Product Variant Mismatch",
                        "message": f"Provided variant_id '{caller_variant_id}' does not match canonical variant '{grn_variant_id}' for product '{product.id}'.",
                    },
                )

            # Resolve canonical ItemBatch and ItemWarehouseLocation
            if not effective_batch_id and batch_no:
                try:
                    from .item.item_tracking_svc import ItemTrackingService
                    b_obj = await ItemTrackingService.resolve_or_create_batch(
                        session=self.db,
                        item_id=canonical_item_id,
                        variant_id=grn_variant_id,
                        batch_number=batch_no,
                        company_id=self.tenant.company_id,
                        branch_id=self.tenant.branch_id,
                        mfg_date=item.mfg_date,
                        exp_date=item.expiry_date,
                        mrp=item.mrp,
                        cost_price=item.cost_price,
                        auto_commit=False,
                    )
                    if b_obj:
                        effective_batch_id = b_obj.id
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.error(
                        f"[GRN BATCH RESOLUTION ERROR] Line {idx}: Failed to resolve or create batch '{batch_no}' "
                        f"for item '{canonical_item_id}' (company '{self.tenant.company_id}'): {exc}",
                        exc_info=True,
                    )
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "BATCH_RESOLUTION_FAILED",
                            "title": "Batch Tracking Resolution Failed",
                            "explanation": f"Unable to resolve or create batch '{batch_no}' for product '{product.code}'.",
                            "suggested_action": "Verify batch details and dates, or contact your system administrator.",
                            "batch_no": batch_no,
                            "error": str(exc),
                        },
                    ) from exc

            if not effective_loc_id and warehouse_id:
                try:
                    from .item.item_tracking_svc import ItemTrackingService
                    l_obj = await ItemTrackingService.resolve_or_create_warehouse_location(
                        session=self.db,
                        item_id=canonical_item_id,
                        warehouse_id=warehouse_id,
                        company_id=self.tenant.company_id,
                        branch_id=self.tenant.branch_id,
                        auto_commit=False,
                    )
                    if l_obj:
                        effective_loc_id = l_obj.id
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.error(
                        f"[GRN LOCATION RESOLUTION ERROR] Line {idx}: Failed to resolve or create warehouse location "
                        f"for warehouse '{warehouse_id}' and item '{canonical_item_id}' (company '{self.tenant.company_id}'): {exc}",
                        exc_info=True,
                    )
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "WAREHOUSE_LOCATION_RESOLUTION_FAILED",
                            "title": "Warehouse Location Resolution Failed",
                            "explanation": f"Unable to resolve or create warehouse location for warehouse '{warehouse_id}' and product '{product.code}'.",
                            "suggested_action": "Verify warehouse assignment or contact your system administrator.",
                            "warehouse_id": warehouse_id,
                            "error": str(exc),
                        },
                    ) from exc

            item_rows.append(PurchaseReceiptItem(
                id=item_tech_id,
                uuid=item_tech_id,
                receipt_id=receipt_id,
                product_id=item.product_id,
                item_id=canonical_item_id,
                variant_id=grn_variant_id,
                purchase_order_id=target_po.id if target_po else None,
                purchase_order_no=target_po.order_no if target_po else None,
                purchase_order_line_id=target_po_line.id if target_po_line else None,
                code=item.code,
                name=item.name,
                batch_no=batch_no,
                batch_id=effective_batch_id,
                warehouse_location_id=effective_loc_id,
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
        if getattr(req, "attachments", None):
            import json
            import base64
            raw_json = json.dumps(req.attachments)
            b64 = base64.b64encode(raw_json.encode("utf-8")).decode("ascii")
            att_str = f"[ATTACHMENTS_METADATA_B64:{b64}]"
            combined_notes = f"{combined_notes} | {att_str}" if combined_notes else att_str

        receipt = PurchaseReceipt(
            id=receipt_id,
            uuid=receipt_id,
            receipt_no=receipt_no,
            identity_code=identity_code,
            supplier_id=req.supplier_id,
            warehouse_id=warehouse_id,
            order_id=linked_po.id if linked_po else req.order_id,
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

        if linked_po:
            linked_po.status = "RECEIVED"
            linked_po.modified_at = datetime.now(timezone.utc)

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
                batch_id=item_row.batch_id,
                location_id=item_row.warehouse_location_id,
                item_id=item_row.item_id,
                variant_id=item_row.variant_id,
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
        curr_outstanding = Decimal(str(supplier.outstanding)) if supplier.outstanding is not None else Decimal("0.00")
        supplier.outstanding = (curr_outstanding + grand_total).quantize(Decimal("0.01"))
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
                status_code=409,
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

    async def update_purchase_receipt(
        self, receipt_id: str, req: Any
    ) -> tuple[PurchaseReceipt, list[PurchaseReceiptItem]]:
        """Update existing purchase receipt notes, transport or attachments."""
        receipt, items = await self.get_purchase_receipt(receipt_id)
        import json
        import re

        current_notes = receipt.notes or ""
        if getattr(req, "notes", None) is not None:
            current_notes = req.notes or ""

        if getattr(req, "attachments", None) is not None:
            import base64
            cleaned = re.sub(r'\[ATTACHMENTS_METADATA_B64:[A-Za-z0-9+/=]+\]', '', current_notes)
            cleaned = re.sub(r'\[ATTACHMENTS_METADATA:\[.*?\]\]', '', cleaned)
            cleaned = cleaned.strip(' |').strip()
            if req.attachments:
                raw_json = json.dumps(req.attachments)
                b64 = base64.b64encode(raw_json.encode("utf-8")).decode("ascii")
                att_str = f"[ATTACHMENTS_METADATA_B64:{b64}]"
                current_notes = f"{cleaned} | {att_str}" if cleaned else att_str
            else:
                current_notes = cleaned

        receipt.notes = current_notes or None
        await self.db.commit()
        await self.db.refresh(receipt)
        return receipt, items

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

            canonical_item_id = product.item_id
            canonical_variant_id = product.item_variant_id
            if not (canonical_item_id and canonical_variant_id):
                from .product_resolution_service import ProductResolutionService
                c_res = await ProductResolutionService.resolve_by_product_id(
                    session=self.db,
                    company_id=self.tenant.company_id,
                    product_id=product.id,
                )
                if c_res.success and c_res.item_id and c_res.variant_id:
                    canonical_item_id = c_res.item_id
                    canonical_variant_id = c_res.variant_id

            poi_id = IdentityEngine.generate_technical_id()
            item_rows.append(PurchaseOrderItem(
                id=poi_id,
                uuid=poi_id,
                order_id=order_id,
                product_id=product.id,
                item_id=canonical_item_id,
                variant_id=canonical_variant_id,
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
        Fetch company state tax jurisdiction authoritatively from DB.
        Resolution order:
        1. Branch GSTIN / state_code
        2. Company GSTIN / state_code / states_ref lookup
        3. PurchaseJurisdictionConfig
        4. SystemParameterService (SMRITI.PURCHASE.DEFAULT_JURISDICTION_STATE or SMRITI.TAX.DEFAULT_STATE_CODE)
        5. Explicit failure (HTTPException 400 SMRITI-JURISDICTION-001) - NEVER silently defaults to DL or any state.
        """
        from ..models.tenant import Company, Branch
        from ..models.localization import StateRef

        # 1. Branch GSTIN / state_code
        if self.tenant.branch_id:
            b_res = await self.db.execute(
                select(Branch).where(Branch.id == self.tenant.branch_id, Branch.is_deleted == False)
            )
            branch = b_res.scalars().first()
            if branch:
                b_gst = getattr(branch, "gstin", None) or getattr(branch, "gst_number", None)
                if b_gst and len(b_gst) >= 2 and b_gst[:2].isdigit():
                    return b_gst[:2]
                if getattr(branch, "state_code", None):
                    return str(branch.state_code).strip().upper()

        # 2. Company GSTIN / state_code / states_ref
        if self.tenant.company_id:
            c_res = await self.db.execute(
                select(Company).where(Company.id == self.tenant.company_id, Company.is_deleted == False)
            )
            comp = c_res.scalars().first()
            if comp:
                if comp.gst_number and len(comp.gst_number) >= 2 and comp.gst_number[:2].isdigit():
                    return comp.gst_number[:2]
                if getattr(comp, "state_code", None):
                    return str(comp.state_code).strip().upper()
                if getattr(comp, "state", None):
                    st_res = await self.db.execute(
                        select(StateRef).where(
                            StateRef.country_code == "IN",
                            (func.lower(StateRef.name) == comp.state.strip().lower())
                            | (func.upper(StateRef.state_code) == comp.state.strip().upper()),
                            StateRef.is_active == True,
                        )
                    )
                    st_ref = st_res.scalars().first()
                    if st_ref:
                        if st_ref.gst_state_code:
                            return st_ref.gst_state_code
                        if st_ref.state_code:
                            return st_ref.state_code

        # 3. PurchaseJurisdictionConfig
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

        # 4. SystemParameterService
        from ..services.system_parameter import SystemParameterService
        jurisdiction_param = await SystemParameterService.resolve_parameter(
            db=self.db,
            param_code="SMRITI.PURCHASE.DEFAULT_JURISDICTION_STATE",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        if jurisdiction_param and jurisdiction_param.effective_value:
            return str(jurisdiction_param.effective_value).strip().upper()

        tax_param = await SystemParameterService.resolve_parameter(
            db=self.db,
            param_code="SMRITI.TAX.DEFAULT_STATE_CODE",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        if tax_param and tax_param.effective_value:
            return str(tax_param.effective_value).strip().upper()

        # 5. Fail explicitly
        raise HTTPException(
            status_code=400,
            detail="SMRITI-JURISDICTION-001: Purchase tax jurisdiction cannot be resolved. Branch/Company GSTIN, purchase jurisdiction config, or SMRITI.PURCHASE.DEFAULT_JURISDICTION_STATE must be configured.",
        )

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

    async def cancel_purchase_order(
        self,
        order_id: str,
        reason: Optional[str] = None,
        cancelled_by: Optional[str] = None,
        reason_code: Optional[str] = None,
    ) -> dict:
        """
        Cancel a purchase order: DRAFT or CONFIRMED → CANCELLED.
        RECEIVED POs cannot be cancelled (stock already ingested).
        Phase C: accepts structured reason_code from PO_CANCEL_REASON master.
        Captures cancellation_reason, cancellation_reason_code, and cancelled_by/at audit columns.
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

        prev_status = order.status
        now = datetime.now(timezone.utc)
        order.status = "CANCELLED"
        order.is_deleted = False
        order.deleted_at = None
        order.modified_at = now
        order.cancelled_by = cancelled_by or (self.tenant.user_id if hasattr(self.tenant, "user_id") else cancelled_by)
        order.cancelled_at = now

        # Phase C: structured reason_code stored in cancellation_reason_code if column exists
        if reason_code and hasattr(order, "cancellation_reason_code"):
            order.cancellation_reason_code = reason_code.strip().upper()

        if reason:
            order.cancellation_reason = reason
            # Also keep notes for backward-compat with existing queries that read notes
            order.notes = f"{order.notes or ''} | Cancelled: {reason}".strip(" |")
        elif reason_code:
            # No free-text but we have a structured code — store code as fallback reason
            order.cancellation_reason = reason_code
            order.notes = f"{order.notes or ''} | Cancelled: {reason_code}".strip(" |")

        event = WorkflowEvent(
            doc_type="PurchaseOrder",
            doc_id=order.id,
            action="CANCEL",
            from_status=prev_status,
            to_status="CANCELLED",
            performed_by_name=order.cancelled_by,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id or "BR-001",
            notes=reason or reason_code,
            created_at=now,
        )
        self.db.add(event)
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
        Amend a Confirmed PO (Phase D — full revision chain):
          1. Validate: only CONFIRMED POs may be amended.
          2. Mark original as CANCELLED + Amended & Superseded, recording amended_by/at.
          3. Compute new amend_revision = original.amend_revision + 1.
          4. Create new CONFIRMED PO with parent_order_id = original.id,
             amend_revision = N, and full item list.
        Chain: PO-001 (rev 0) → PO-001-R1 (rev 1, parent=PO-001) → …
        DO NOT convert, rewrite, or alter existing PO data beyond the audit columns.
        """
        original, _ = await self.get_purchase_order(original_id)

        if original.status != "CONFIRMED":
            raise HTTPException(
                status_code=400,
                detail="Only Confirmed purchase orders can be amended.",
            )

        now = datetime.now(timezone.utc)
        acting_user = self.tenant.user_id if hasattr(self.tenant, "user_id") else None

        # Compute next revision number
        next_revision = (original.amend_revision or 0) + 1

        # ── Mark original as Cancelled/Superseded ─────────────────────────────
        original.status = "CANCELLED"
        original.is_deleted = False
        original.deleted_at = None
        original.modified_at = now
        original.amended_by = acting_user
        original.amended_at = now
        original.notes = (
            f"{original.notes or ''} | Amended & Superseded. "
            f"Reason: {req.reason or 'No reason given'}"
        ).strip(" |")
        self.db.add(original)

        # ── Build new PO items ─────────────────────────────────────────────────
        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="An amendment must contain at least one item.",
            )

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows: list[PurchaseOrderItem] = []

        # Use caller-supplied id or generate one
        new_po_id = req.new_order_id or IdentityEngine.generate_technical_id()

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

            canonical_item_id = getattr(item, "item_id", None) or getattr(product, "item_id", None)
            canonical_variant_id = getattr(item, "variant_id", None) or getattr(product, "item_variant_id", None)
            if not (canonical_item_id and canonical_variant_id):
                from .product_resolution_service import ProductResolutionService
                c_res = await ProductResolutionService.resolve_by_product_id(
                    session=self.db,
                    company_id=self.tenant.company_id,
                    product_id=product.id,
                )
                if c_res.success and c_res.item_id and c_res.variant_id:
                    canonical_item_id = canonical_item_id or c_res.item_id
                    canonical_variant_id = canonical_variant_id or c_res.variant_id

            amend_poi_id = IdentityEngine.generate_technical_id()
            item_rows.append(PurchaseOrderItem(
                id=amend_poi_id,
                uuid=amend_poi_id,
                order_id=new_po_id,
                product_id=item.product_id,
                item_id=canonical_item_id,
                variant_id=canonical_variant_id,
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

        # ── Create the replacement (amended) PO ───────────────────────────────
        new_order = PurchaseOrder(
            id=new_po_id,
            order_no=req.new_order_no,
            supplier_id=original.supplier_id,
            status="CONFIRMED",
            # Phase D: link chain and set revision counter
            parent_order_id=original.id,
            amend_revision=next_revision,
            confirmed_by=acting_user,
            confirmed_at=now,
            notes=(
                f"Amendment #{next_revision} of {original.order_no}. "
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

    async def get_amendment_history(self, order_id: str) -> list:
        """
        Phase D: Return the full amendment chain for a PO.
        Walks parent_order_id to find root, then breadth-first collects all
        POs in the chain, sorted by amend_revision ascending.
        Returns list of dicts: {id, order_no, status, amend_revision,
        parent_order_id, amended_at, amended_by, grand_total, created_at}.
        """
        from sqlalchemy import select as _select

        # Step 1: resolve root by walking parent_order_id (max 20 hops)
        visited: set[str] = set()
        current_id = order_id
        root_id = order_id

        for _ in range(20):
            if current_id in visited:
                break
            visited.add(current_id)
            res = await self.db.execute(
                _select(PurchaseOrder).where(PurchaseOrder.id == current_id)
            )
            po = res.scalars().first()
            if not po:
                break
            if not po.parent_order_id:
                root_id = current_id
                break
            current_id = po.parent_order_id

        # Step 2: BFS from root collecting the whole chain (max 10 amendments)
        chain: list[dict] = []
        seen_ids: set[str] = set()
        queue = [root_id]

        for _ in range(10):
            if not queue:
                break
            batch_ids = queue[:]
            queue = []
            res = await self.db.execute(
                _select(PurchaseOrder).where(
                    (PurchaseOrder.id.in_(batch_ids) |
                     PurchaseOrder.parent_order_id.in_(batch_ids)),
                    PurchaseOrder.company_id == self.tenant.company_id,
                )
            )
            pos = res.scalars().all()
            for p in pos:
                if p.id not in seen_ids:
                    seen_ids.add(p.id)
                    chain.append({
                        "id":              p.id,
                        "order_no":        p.order_no,
                        "status":          p.status,
                        "amend_revision":  p.amend_revision or 0,
                        "parent_order_id": p.parent_order_id,
                        "amended_at":      p.amended_at.isoformat() if p.amended_at else None,
                        "amended_by":      p.amended_by,
                        "grand_total":     str(p.grand_total),
                        "created_at":      p.created_at.isoformat() if hasattr(p, "created_at") and p.created_at else None,
                    })
                    if p.id not in batch_ids:
                        queue.append(p.id)

        chain.sort(key=lambda x: x["amend_revision"])
        return chain


    # ─────────────────────── Phase A: Submit PO ─────────────────────────────

    async def submit_purchase_order(self, order_id: str, submitted_by: Optional[str] = None) -> dict:
        """
        Submit a purchase order: DRAFT → SUBMITTED.
        Only DRAFT orders can be submitted. Records submitted_by and submitted_at.
        Phase A: SUBMITTED is the new intermediate state before CONFIRMED.
        """
        order, _ = await self.get_purchase_order(order_id)
        if order.status != "DRAFT":
            raise HTTPException(
                status_code=400,
                detail=f"Only DRAFT orders can be submitted. Current status: {order.status}.",
            )
        now = datetime.now(timezone.utc)
        order.status = "SUBMITTED"
        order.submitted_by = submitted_by
        order.submitted_at = now
        order.modified_at = now
        self.db.add(order)

        event = WorkflowEvent(
            doc_type="PurchaseOrder",
            doc_id=order.id,
            action="SUBMIT",
            from_status="DRAFT",
            to_status="SUBMITTED",
            performed_by_name=submitted_by,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id or "BR-001",
            notes=f"Submitted by {submitted_by}",
            created_at=now,
        )
        self.db.add(event)
        await self.db.commit()
        return {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "status": "SUBMITTED",
            "submitted_by": submitted_by,
            "message": f"Purchase order '{order.order_no}' has been submitted for approval.",
        }

    # ─────────────────────── Phase A: Confirm PO ────────────────────────────

    async def confirm_purchase_order(self, order_id: str, confirmed_by: Optional[str] = None, notes: Optional[str] = None) -> dict:
        """
        Confirm a purchase order: SUBMITTED → CONFIRMED.
        Only SUBMITTED orders can be confirmed. Records confirmed_by and confirmed_at.
        MANAGER or SYSADMIN role required (enforced at the API layer).
        """
        order, _ = await self.get_purchase_order(order_id)
        if order.status != "SUBMITTED":
            raise HTTPException(
                status_code=400,
                detail=f"Only SUBMITTED orders can be confirmed. Current status: {order.status}.",
            )
        now = datetime.now(timezone.utc)
        order.status = "CONFIRMED"
        order.confirmed_by = confirmed_by
        order.confirmed_at = now
        order.modified_at = now
        if notes:
            order.notes = f"{order.notes or ''} | Confirmed: {notes}".strip(" |")
        self.db.add(order)

        event = WorkflowEvent(
            doc_type="PurchaseOrder",
            doc_id=order.id,
            action="CONFIRM",
            from_status="SUBMITTED",
            to_status="CONFIRMED",
            performed_by_name=confirmed_by,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id or "BR-001",
            notes=notes,
            created_at=now,
        )
        self.db.add(event)
        await self.db.commit()
        return {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "status": "CONFIRMED",
            "confirmed_by": confirmed_by,
            "message": f"Purchase order '{order.order_no}' has been confirmed.",
        }

    # ─────────────────────────── Phase 4B: Reports ──────────────────────────────

    async def get_outstanding_suppliers(self) -> list[dict]:
        """
        Outstanding report: suppliers with booked ledger AP liabilities or open POs (DRAFT/CONFIRMED).
        """
        # Fetch all active suppliers for this tenant
        sup_stmt = select(Supplier).where(
            Supplier.company_id == self.tenant.company_id,
            Supplier.is_deleted == False,
        )
        sup_res = await self.db.execute(sup_stmt)
        suppliers = sup_res.scalars().all()
        supplier_map = {s.id: s for s in suppliers}

        # Fetch open POs (DRAFT/CONFIRMED)
        res = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.company_id == self.tenant.company_id,
                PurchaseOrder.branch_id  == self.tenant.branch_id,
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.status.in_(["DRAFT", "CONFIRMED"]),
            )
        )
        orders = res.scalars().all()

        # Group open POs by supplier
        po_summary: dict[str, dict] = {}
        for po in orders:
            sid = po.supplier_id
            if sid not in po_summary:
                po_summary[sid] = {
                    "order_count": 0,
                    "po_total": Decimal("0.00"),
                    "statuses": set(),
                }
            items_res = await self.db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.order_id == po.id)
            )
            items = items_res.scalars().all()
            total = sum(Decimal(str(it.cost_price)) * it.quantity for it in items)
            po_summary[sid]["order_count"] += 1
            po_summary[sid]["po_total"] += total
            po_summary[sid]["statuses"].add(po.status)

        # Include any supplier that has either booked outstanding liability or open POs
        rows = []
        all_supplier_ids = set(po_summary.keys()) | {
            s.id for s in suppliers if Decimal(str(s.outstanding or 0.00)) > Decimal("0.00")
        }

        for sid in all_supplier_ids:
            supplier = supplier_map.get(sid)
            if not supplier:
                continue
            po_data = po_summary.get(sid, {"order_count": 0, "po_total": Decimal("0.00"), "statuses": set()})
            sup_outstanding = Decimal(str(supplier.outstanding or 0.00))
            # If supplier has recorded AP liability, that is their true ledger outstanding balance
            effective_outstanding = sup_outstanding if sup_outstanding > Decimal("0.00") else po_data["po_total"]

            rows.append({
                "supplier_id": sid,
                "supplier_name": supplier.name,
                "supplier_code": supplier.code or "",
                "order_count": po_data["order_count"],
                "total_outstanding": float(effective_outstanding),
                "ledger_outstanding": float(sup_outstanding),
                "open_statuses": list(po_data["statuses"]),
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
                item_res = await self.db.execute(
                    select(PurchaseOrderItem).where(
                        PurchaseOrderItem.order_id == po.id,
                        PurchaseOrderItem.is_deleted == False,
                    )
                )
                items = item_res.scalars().all()
                total_qty = sum(it.quantity for it in items)
                pending.append({
                    "order_id": po.id,
                    "order_no": po.order_no,
                    "supplier_id": po.supplier_id,
                    "supplier_name": supplier.name if supplier else "Unknown",
                    "status": po.status,
                    "pending_qty": int(total_qty),
                    "pending_amount": float(po.grand_total or 0.0),
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
        Canonical variant supremacy is enforced with fallback to product_id.
        """
        prod = await self._get_product(product_id)
        canon_var_id = getattr(prod, "item_variant_id", None) or (str(prod.variant_id) if getattr(prod, "variant_id", None) else None)

        # Try last GRN cost from DB
        receipt_stmt = (
            select(PurchaseReceiptItem)
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .where(
                PurchaseReceipt.is_deleted == False,
                PurchaseReceipt.supplier_id == supplier_id,
            )
        )
        if canon_var_id:
            receipt_stmt = receipt_stmt.where(
                or_(
                    PurchaseReceiptItem.variant_id == canon_var_id,
                    PurchaseReceiptItem.product_id == product_id,
                )
            )
        else:
            receipt_stmt = receipt_stmt.where(PurchaseReceiptItem.product_id == product_id)

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
            )
        )
        if canon_var_id:
            po_stmt = po_stmt.where(
                or_(
                    PurchaseOrderItem.variant_id == canon_var_id,
                    PurchaseOrderItem.product_id == product_id,
                )
            )
        else:
            po_stmt = po_stmt.where(PurchaseOrderItem.product_id == product_id)

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
        await self.db.flush()

        from .unified_ledger import UnifiedAccountingLedgerService
        voucher = await UnifiedAccountingLedgerService.post_debit_note_to_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            debit_note_id=dn_id,
            supplier_id=supplier.id,
            claim_amount=req.claim_amount,
            tax_amount=req.tax_amount or Decimal("0.00"),
            total_debit_amount=req.total_debit_amount,
            debit_note_no=dn_no,
            branch_id=self.tenant.branch_id,
        )

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
                "voucher_id": voucher.id if voucher else None,
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
            "journal_voucher_id": voucher.id if voucher else None,
        }

    async def cancel_debit_note(
        self,
        debit_note_id: str,
        supplier_id: str,
        claim_amount: Decimal,
        tax_amount: Decimal,
        total_debit_amount: Decimal,
        debit_note_no: Optional[str] = None,
        reason: Optional[str] = None,
        cancelled_by: Optional[str] = None,
    ) -> dict:
        """
        Cancels a debit note, restoring supplier outstanding liability and posting
        a compensating reversal double-entry GL voucher (DEBIT_NOTE_CANCEL).
        """
        supplier = await self._get_supplier(supplier_id)

        from .unified_ledger import UnifiedAccountingLedgerService
        reversal_voucher = await UnifiedAccountingLedgerService.reverse_debit_note_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            debit_note_id=debit_note_id,
            supplier_id=supplier.id,
            claim_amount=claim_amount,
            tax_amount=tax_amount or Decimal("0.00"),
            total_debit_amount=total_debit_amount,
            debit_note_no=debit_note_no,
            branch_id=self.tenant.branch_id,
            reason=reason,
            cancelled_by=cancelled_by,
        )

        supplier.outstanding = (supplier.outstanding + total_debit_amount).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PURCHASE_DEBIT_NOTES",
            event_type="PURCHASE_DEBIT_NOTE_CANCELLED",
            aggregate_type="PurchaseDebitNote",
            aggregate_id=debit_note_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            payload={
                "debit_note_no": debit_note_no or debit_note_id,
                "supplier_id": supplier.id,
                "total_debit_amount": str(total_debit_amount),
                "reversal_voucher_id": reversal_voucher.id if reversal_voucher else None,
                "reason": reason,
            },
        )
        await self.db.commit()
        return {
            "id": debit_note_id,
            "identity_code": debit_note_no or debit_note_id,
            "debit_note_no": debit_note_no or debit_note_id,
            "supplier_id": supplier.id,
            "receipt_id": None,
            "claim_amount": claim_amount,
            "tax_amount": tax_amount or Decimal("0.00"),
            "total_debit_amount": total_debit_amount,
            "status": "CANCELLED",
            "reason": reason,
            "created_at": datetime.now(timezone.utc),
            "journal_voucher_id": reversal_voucher.id if reversal_voucher else None,
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
        bill_entity = PurchaseBill(
            id=bill_id,
            uuid=bill_id,
            bill_no=bill_no,
            identity_code=id_code,
            supplier_id=supplier.id,
            receipt_id=req.receipt_id,
            order_id=req.order_id,
            bill_date=req.bill_date or datetime.now(timezone.utc).date(),
            due_date=req.due_date,
            taxable_amount=req.taxable_amount,
            tax_amount=req.tax_amount,
            total_amount=req.total_amount,
            paid_amount=Decimal("0.00"),
            status="POSTED",
            notes=req.notes,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(bill_entity)

        # If linked to a GRN, copy line items to PurchaseBillItem for 3-way match audit
        if req.receipt_id:
            from sqlalchemy.orm import selectinload
            grn_stmt = select(PurchaseReceipt).where(
                PurchaseReceipt.id == req.receipt_id,
                PurchaseReceipt.company_id == self.tenant.company_id,
            ).options(selectinload(PurchaseReceipt.items))
            grn_res = await self.db.execute(grn_stmt)
            grn = grn_res.scalars().first()
            if grn and grn.items:
                for grn_it in grn.items:
                    bill_it_id = IdentityEngine.generate_technical_id()
                    self.db.add(PurchaseBillItem(
                        id=bill_it_id,
                        uuid=bill_it_id,
                        bill_id=bill_id,
                        product_id=grn_it.product_id,
                        item_id=grn_it.item_id,
                        variant_id=grn_it.variant_id,
                        po_item_id=grn_it.purchase_order_line_id,
                        receipt_item_id=grn_it.id,
                        code=grn_it.code,
                        name=grn_it.name,
                        quantity=grn_it.quantity_received,
                        rate=grn_it.cost_price,
                        taxable_amount=(grn_it.cost_price * grn_it.quantity_received).quantize(Decimal("0.01")),
                        tax_amount=grn_it.tax_amount,
                        total_amount=grn_it.line_total,
                        company_id=self.tenant.company_id,
                        branch_id=self.tenant.branch_id,
                    ))

        # If linked to a GRN, reconcile provisional GRN inward liability before formal AP Bill posting
        if req.receipt_id and grn:
            grn_val = Decimal(str(grn.grand_total or 0.00))
            if grn_val > 0:
                supplier.outstanding = max(Decimal("0.00"), Decimal(str(supplier.outstanding or 0.00)) - grn_val).quantize(Decimal("0.01"))

        await self.db.flush()

        from .unified_ledger import UnifiedAccountingLedgerService
        voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            bill_id=bill_id,
            branch_id=self.tenant.branch_id,
            created_by=getattr(self.tenant, "user_id", None),
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
                "journal_voucher_id": voucher.id if voucher else None,
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
            "due_date": req.due_date,
            "taxable_amount": req.taxable_amount,
            "tax_amount": req.tax_amount,
            "total_amount": req.total_amount,
            "paid_amount": Decimal("0.00"),
            "status": "POSTED",
            "notes": req.notes,
            "journal_voucher_id": voucher.id if voucher else None,
        }

    async def cancel_purchase_bill(
        self,
        bill_id: str,
        reason: Optional[str] = None,
        cancelled_by: Optional[str] = None,
    ) -> dict:
        """
        Cancel a purchase bill, reversing GL entries and restoring supplier liability.
        """
        bill = await self.get_purchase_bill(bill_id)
        if (bill.status or "").upper() == "CANCELLED":
            raise HTTPException(status_code=400, detail="Purchase bill is already cancelled.")

        from .unified_ledger import UnifiedAccountingLedgerService
        reversal_voucher = await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            bill_id=bill_id,
            branch_id=self.tenant.branch_id,
            reason=reason,
            cancelled_by=cancelled_by,
        )

        bill.status = "CANCELLED"
        bill.cancellation_reason = reason
        bill.modified_at = datetime.now(timezone.utc)
        self.db.add(bill)

        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PURCHASE_BILLS",
            event_type="PURCHASE_BILL_CANCELLED",
            aggregate_type="PurchaseBill",
            aggregate_id=bill_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            payload={
                "bill_no": bill.bill_no,
                "supplier_id": bill.supplier_id,
                "total_amount": str(bill.total_amount),
                "reversal_voucher_id": reversal_voucher.id if reversal_voucher else None,
                "reason": reason,
            },
        )
        await self.db.commit()
        return {
            "id": bill.id,
            "bill_no": bill.bill_no,
            "status": "CANCELLED",
            "cancellation_reason": reason,
            "reversal_voucher_id": reversal_voucher.id if reversal_voucher else None,
        }

    async def list_purchase_bills(
        self,
        supplier_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[PurchaseBill]:
        """
        List purchase bills for the tenant, optionally filtered by supplier and status.
        """
        stmt = select(PurchaseBill).where(
            PurchaseBill.company_id == self.tenant.company_id,
            PurchaseBill.is_deleted == False,
        )
        if supplier_id:
            stmt = stmt.where(PurchaseBill.supplier_id == supplier_id)
        if status:
            statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
            if statuses:
                stmt = stmt.where(PurchaseBill.status.in_(statuses))
        if self.tenant.branch_id:
            stmt = stmt.where(
                or_(
                    PurchaseBill.branch_id == self.tenant.branch_id,
                    PurchaseBill.branch_id.is_(None),
                )
            )
        stmt = stmt.order_by(
            PurchaseBill.bill_date.desc().nullslast(),
            PurchaseBill.created_at.desc(),
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_purchase_bill(self, bill_id: str) -> PurchaseBill:
        """
        Retrieve a specific purchase bill by ID for the tenant.
        """
        stmt = select(PurchaseBill).where(
            PurchaseBill.id == bill_id,
            PurchaseBill.company_id == self.tenant.company_id,
            PurchaseBill.is_deleted == False,
        )
        res = await self.db.execute(stmt)
        bill = res.scalars().first()
        if not bill:
            raise HTTPException(status_code=404, detail="Purchase bill not found.")
        return bill
