"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from typing import Optional
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.inventory import Product, StockMovement, ProductBarcode, ProductVendor, ProductTaxProfile, ProductInventoryPolicy
from ..models.master_lookup import MasterType, MasterValue
from ..schemas.inventory import ProductCreate
from ..api.deps import TenantContext


def _build_sku(p) -> str:
    sku = getattr(p, "sku", None)
    if sku and str(sku).strip():
        return str(sku).strip()
    parts = [
        getattr(p, "style_code", None),
        getattr(p, "color", None),
        getattr(p, "size", None),
    ]
    filled = [str(x).strip() for x in parts if x is not None and str(x).strip()]
    return "-".join(filled) if filled else ""


async def _validate_master_field(
    db: AsyncSession,
    field_name: str,
    type_code: str,
    raw_value: str | None,
    tenant_id: str | None = None
) -> str | None:
    """
    Normalize and validate a product field against master_values.
    - Sizes: UPPER() match  (xxl → XXL)
    - All others: Title Case (red → Red)
    - Returns canonical name from DB (correct casing guaranteed)
    - If master_type not seeded yet: passes through (safe degradation)
    """
    if not raw_value or not raw_value.strip():
        return None

    normalized = (
        raw_value.strip().upper()
        if type_code == "product_size"
        else raw_value.strip().title()
    )

    # Find master type
    mt_res = await db.execute(
        select(MasterType).where(MasterType.code == type_code)
    )
    mt = mt_res.scalar_one_or_none()
    if not mt:
        return normalized  # type not seeded yet — allow through safely

    # Find value: system values OR this tenant's custom values
    mv_res = await db.execute(
        select(MasterValue).where(
            MasterValue.master_type_id == mt.id,
            MasterValue.is_deleted.is_(False),
            MasterValue.active.is_(True),
            func.upper(MasterValue.name) == normalized.upper(),
            or_(
                MasterValue.is_system.is_(True),
                MasterValue.tenant_id == tenant_id
            )
        )
    )
    mv = mv_res.scalar_one_or_none()

    if not mv:
        # Fetch valid options for helpful error message
        opts_res = await db.execute(
            select(MasterValue.name).where(
                MasterValue.master_type_id == mt.id,
                MasterValue.is_deleted.is_(False),
                MasterValue.active.is_(True),
                or_(
                    MasterValue.is_system.is_(True),
                    MasterValue.tenant_id == tenant_id
                )
            ).order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
        )
        valid = [r[0] for r in opts_res.fetchall()]
        raise HTTPException(
            status_code=422,
            detail={
                "title": f"Invalid {field_name.title()}",
                "explanation": (
                    f"'{raw_value}' is not a valid {field_name}. "
                    f"Valid options are: {', '.join(valid) if valid else 'none configured yet'}."
                ),
                "suggested_action": (
                    f"Check spelling, or add '{normalized}' from "
                    f"Settings → Master Values → {field_name.title()}."
                ),
                "reference_id": "SMRITI-VAL-010"
            }
        )
    return mv.name  # canonical casing from DB


class InventoryService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def update_stock(
        self, 
        product_id: str, 
        quantity: float, 
        movement_type: str, 
        reference_doc_type: str, 
        reference_doc_id: str, 
        remarks: Optional[str] = None,
        unit_cost: Optional[float] = None,
        source_module: str = "inventory"
    ):
        """
        Centralized method to update product stock and record the movement.
        movement_type: 'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if product.tracking_mode == "No-stock":
            return

        # Update product stock
        if movement_type == "IN":
            product.stock += int(quantity)
        elif movement_type == "OUT":
            product.stock -= int(quantity)
        elif movement_type == "ADJUSTMENT":
            product.stock += int(quantity) # Quantity can be negative for adjustments
        
        self.db.add(product)

        # Create StockMovement record
        movement = StockMovement(
            product_id=product.id,
            product_name=product.name,
            sku=_build_sku(product),
            quantity=quantity,
            movement_type=movement_type,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            unit_cost=unit_cost,
            remarks=remarks,
            branch=self.tenant_ctx.branch_id,
            source_module=source_module,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(movement)

    async def create_product(self, product_in: ProductCreate) -> Product:

        # Check for duplicate code
        existing_code = await self.db.execute(
            select(Product).filter(
                Product.code == product_in.code,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing_code.scalars().first():
            raise HTTPException(status_code=400, detail="Product with this code already exists")

        # Check for duplicate barcode across primary and secondary barcode tables
        barcodes_to_check = [product_in.barcode] + (product_in.secondary_barcodes or [])
        for bc in barcodes_to_check:
            if not bc or not str(bc).strip():
                continue
            bc_str = str(bc).strip()
            # Primary check
            p_exist = await self.db.execute(
                select(Product).filter(
                    Product.barcode == bc_str,
                    Product.is_deleted == False,
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.branch_id == self.tenant_ctx.branch_id
                )
            )
            if p_exist.scalars().first():
                raise HTTPException(status_code=400, detail=f"Product with barcode '{bc_str}' already exists")

            # Secondary check
            sec_exist = await self.db.execute(
                select(ProductBarcode).filter(
                    ProductBarcode.barcode == bc_str,
                    ProductBarcode.company_id == self.tenant_ctx.company_id,
                    ProductBarcode.branch_id == self.tenant_ctx.branch_id
                )
            )
            if sec_exist.scalars().first():
                raise HTTPException(status_code=400, detail=f"Secondary barcode '{bc_str}' is already assigned to another product")

        tenant_id = getattr(self.tenant_ctx, "tenant_id", None) or getattr(self.tenant_ctx, "company_id", None)

        from ..core.validation import get_validation_engine
        pve = get_validation_engine()
        val_res = await pve.validate_entity(
            db=self.db,
            entity_type="product",
            data=product_in.model_dump(),
            tenant_id=tenant_id,
            user_role=getattr(self.tenant_ctx, "role", "MANAGER")
        )
        product_data = val_res.normalized_data
        sec_barcodes = product_data.pop("secondary_barcodes", None) or product_in.secondary_barcodes or []
        vendors_data = product_data.pop("vendors", None) or []
        tax_profiles_data = product_data.pop("tax_profiles", None) or []
        inventory_policy_data = product_data.pop("inventory_policy", None)

        db_product = Product(
            **product_data,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_product)

        from ..models.inventory import ProductVendor, ProductTaxProfile, ProductInventoryPolicy
        for vdata in vendors_data:
            v_dict = vdata.model_dump() if hasattr(vdata, "model_dump") else dict(vdata)
            if not v_dict.get("workflow_status"):
                v_dict["workflow_status"] = "Approved"
            pv_obj = ProductVendor(
                id=f"pv-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                product_id=db_product.id,
                tenant_id=tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **v_dict
            )
            self.db.add(pv_obj)

        for tpdata in tax_profiles_data:
            tp_dict = tpdata.model_dump() if hasattr(tpdata, "model_dump") else dict(tpdata)
            if not tp_dict.get("workflow_status"):
                tp_dict["workflow_status"] = "Approved"
            tp_obj = ProductTaxProfile(
                id=f"ptp-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                product_id=db_product.id,
                tenant_id=tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **tp_dict
            )
            self.db.add(tp_obj)

        if inventory_policy_data:
            ip_dict = inventory_policy_data.model_dump() if hasattr(inventory_policy_data, "model_dump") else dict(inventory_policy_data)
            if not ip_dict.get("workflow_status"):
                ip_dict["workflow_status"] = "Approved"
            ip_obj = ProductInventoryPolicy(
                id=f"pip-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                product_id=db_product.id,
                tenant_id=tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **ip_dict
            )
            self.db.add(ip_obj)

        for sbc in sec_barcodes:
            if sbc and str(sbc).strip():
                bc_obj = ProductBarcode(
                    id=f"BC-{uuid.uuid4().hex[:8]}",
                    uuid=str(uuid.uuid4()),
                    product_id=db_product.id,
                    barcode=str(sbc).strip(),
                    is_primary=False,
                    tenant_id=tenant_id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
                self.db.add(bc_obj)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Product with this code or barcode already exists"
            )
        await self.db.refresh(db_product)
        return db_product

    async def check_stock_availability(self, product_id: str, quantity: float) -> bool:
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # If tracking mode is No-stock, then stock is infinite
        if product.tracking_mode == "No-stock":
            return True
            
        if product.stock < quantity:
            return False
        return True

    async def resolve_effective_gst_percentage(self, product: Product) -> float:
        """
        Resolves effective GST percentage for a product following v5.1.0 Architecture:
        1. Date-Effective ProductTaxProfile (v5.6.0)
        2. Item Classification / HSN Registry (VariantTemplate)
        3. Legacy Product.gst_percentage
        4. System Default (18.0)
        """
        stmt_tp = select(ProductTaxProfile).filter(
            ProductTaxProfile.product_id == product.id,
            ProductTaxProfile.is_active == True,
            ProductTaxProfile.is_deleted == False
        ).order_by(ProductTaxProfile.effective_from.desc())
        res_tp = await self.db.execute(stmt_tp)
        active_tp = res_tp.scalars().first()
        if active_tp and active_tp.gst_rate is not None:
            return float(active_tp.gst_rate)

        if product.variant_template_id:
            from ..models.attributes import VariantTemplate
            stmt = select(VariantTemplate).filter(
                VariantTemplate.id == product.variant_template_id,
                VariantTemplate.is_deleted == False
            )
            res = await self.db.execute(stmt)
            vt = res.scalars().first()
            if vt and vt.gst_percentage is not None:
                return float(vt.gst_percentage)
        
        if product.gst_percentage is not None:
            return float(product.gst_percentage)

        return 18.0

    async def add_product_vendor(self, product_id: str, vendor_in) -> ProductVendor:
        """
        Adds ProductVendor link enforcing 3-level procurement sourcing hierarchy:
        System Default -> Company Setting -> Product Override (SINGLE / MULTIPLE / HYBRID)
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Resolve Sourcing Mode Override Hierarchy
        sourcing_mode = (product.sourcing_mode_override or "HYBRID").upper()

        # Check existing vendors
        existing_stmt = select(ProductVendor).filter(
            ProductVendor.product_id == product_id,
            ProductVendor.is_deleted == False,
            ProductVendor.company_id == self.tenant_ctx.company_id
        )
        existing_res = await self.db.execute(existing_stmt)
        existing_vendors = list(existing_res.scalars().all())

        # Check duplicate supplier link
        for ev in existing_vendors:
            if ev.supplier_id == vendor_in.supplier_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Supplier '{vendor_in.supplier_id}' is already linked to this product."
                )

        # Mode 1 SINGLE Supplier Constraint Enforcement
        if sourcing_mode == "SINGLE" and len(existing_vendors) >= 1:
            raise HTTPException(
                status_code=400,
                detail="Procurement sourcing mode is set to SINGLE. Product cannot be linked to multiple suppliers."
            )

        # Mode 3 HYBRID Preferred Vendor Single Enforcement
        is_pref = vendor_in.is_preferred
        if sourcing_mode == "SINGLE":
            is_pref = True

        if is_pref:
            for ev in existing_vendors:
                if ev.is_preferred:
                    ev.is_preferred = False
                    self.db.add(ev)

        tenant_id = getattr(self.tenant_ctx, "tenant_id", None) or getattr(self.tenant_ctx, "company_id", None)
        new_pv = ProductVendor(
            id=f"pv-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            product_id=product_id,
            supplier_id=vendor_in.supplier_id,
            supplier_product_code=vendor_in.supplier_product_code,
            supplier_barcode=vendor_in.supplier_barcode,
            purchase_uom_id=vendor_in.purchase_uom_id,
            currency_id=vendor_in.currency_id,
            cost_price=vendor_in.cost_price,
            last_purchase_price=vendor_in.last_purchase_price,
            last_purchase_date=vendor_in.last_purchase_date,
            discount_percentage=vendor_in.discount_percentage,
            tax_inclusive=vendor_in.tax_inclusive,
            minimum_order_qty=vendor_in.minimum_order_qty,
            maximum_order_qty=vendor_in.maximum_order_qty,
            lead_time_days=vendor_in.lead_time_days,
            supplier_warranty_days=vendor_in.supplier_warranty_days,
            priority=vendor_in.priority,
            is_preferred=is_pref,
            approval_status=vendor_in.approval_status,
            workflow_status="Approved"
        )
        self.db.add(new_pv)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Vendor link constraint violation (duplicate supplier for product)."
            )

        await self.db.refresh(new_pv)
        return new_pv

    async def resolve_vendor(self, product_id: str, strategy: str = "PREFERRED", order_qty: float = 1.0) -> VendorResolutionResult:
        """
        Pluggable Strategic Vendor Resolution Engine:
        - CONTRACT_FIRST: Evaluate active commercial VendorContract & volume tiers first
        - PREFERRED: Preferred primary vendor
        - LOWEST_COST: Lowest net cost price
        - FASTEST_DELIVERY: Shortest lead time in days
        """
        from dataclasses import dataclass, field
        from datetime import datetime, timezone
        from ..models.purchase import VendorContract, VendorContractTier

        @dataclass
        class VendorResolutionResult:
            vendor_id: Optional[str]
            supplier_id: Optional[str]
            contract_id: Optional[str]
            contract_code: Optional[str]
            contract_version: Optional[int]
            tier_id: Optional[str]
            strategy_used: str
            score: float
            reason: str
            estimated_cost: float
            applied_discount: float
            estimated_lead_time: int
            resolution_trace: List[str] = field(default_factory=list)

        trace = []
        trace.append(f"Initiating resolution for product_id='{product_id}', order_qty={order_qty}, strategy='{strategy}'")

        strat_upper = strategy.upper()

        # Step 1: Check CONTRACT_FIRST strategy if active contract tier exists
        if strat_upper == "CONTRACT_FIRST" or strat_upper == "AUTO":
            now = datetime.now(timezone.utc)
            stmt_contract = select(VendorContractTier, VendorContract).join(
                VendorContract, VendorContractTier.contract_id == VendorContract.id
            ).filter(
                VendorContractTier.product_id == product_id,
                VendorContractTier.is_active == True,
                VendorContractTier.is_deleted == False,
                VendorContract.is_active == True,
                VendorContract.is_deleted == False,
                VendorContract.approval_status.in_(["Approved", "Active"]),
                VendorContract.valid_from <= now,
                VendorContract.valid_to >= now,
                VendorContract.company_id == self.tenant_ctx.company_id
            )
            res_contract = await self.db.execute(stmt_contract)
            contract_pairs = list(res_contract.all())

            if contract_pairs:
                trace.append(f"Step 1: Found {len(contract_pairs)} active contracts matching product '{product_id}'")
                matching_tier_pair = None
                for tier, contract in contract_pairs:
                    min_q = float(tier.min_quantity)
                    max_q = float(tier.max_quantity) if tier.max_quantity is not None else float("inf")
                    if min_q <= order_qty <= max_q:
                        matching_tier_pair = (tier, contract)
                        break

                if matching_tier_pair:
                    tier, contract = matching_tier_pair
                    price = float(tier.contract_unit_price)
                    disc = float(tier.discount_percentage)
                    net = round(price * (1.0 - disc / 100.0), 2)
                    trace.append(f"Step 2: Matched Tier '{tier.id}' (min={tier.min_quantity}, max={tier.max_quantity}) under Contract '{contract.contract_code}' (v{contract.version_number})")
                    trace.append(f"Step 3: Applied contract price ₹{net} (unit=₹{price}, disc={disc}%)")
                    return VendorResolutionResult(
                        vendor_id=None,
                        supplier_id=contract.supplier_id,
                        contract_id=contract.id,
                        contract_code=contract.contract_code,
                        contract_version=contract.version_number,
                        tier_id=tier.id,
                        strategy_used="CONTRACT_FIRST",
                        score=100.0,
                        reason=f"Resolved via active VendorContract '{contract.contract_code}' (v{contract.version_number}) Tier '{tier.id}'",
                        estimated_cost=net,
                        applied_discount=disc,
                        estimated_lead_time=1,
                        resolution_trace=trace
                    )
                else:
                    trace.append(f"Step 2: No contract tier matched quantity slab ({order_qty}). Falling back to ProductVendor catalog.")
            else:
                trace.append("Step 1: No active date-effective contracts found. Falling back to ProductVendor catalog.")

        # Step 2: ProductVendor catalog resolution fallback
        stmt = select(ProductVendor).filter(
            ProductVendor.product_id == product_id,
            ProductVendor.is_deleted == False,
            ProductVendor.is_active == True,
            ProductVendor.company_id == self.tenant_ctx.company_id
        )
        res = await self.db.execute(stmt)
        vendors = list(res.scalars().all())

        if not vendors:
            trace.append("Step 2: No active vendors linked to product catalog.")
            return VendorResolutionResult(
                vendor_id=None,
                supplier_id=None,
                contract_id=None,
                contract_code=None,
                contract_version=None,
                tier_id=None,
                strategy_used=strategy,
                score=0.0,
                reason="No active vendors linked to product",
                estimated_cost=0.0,
                applied_discount=0.0,
                estimated_lead_time=0,
                resolution_trace=trace
            )

        selected: Optional[ProductVendor] = None
        reason = ""

        if strat_upper == "LOWEST_COST":
            vendors.sort(key=lambda v: float(v.cost_price) * (1.0 - float(v.discount_percentage) / 100.0))
            selected = vendors[0]
            reason = f"Selected supplier '{selected.supplier_id}' with lowest net cost price ₹{selected.cost_price}"
            trace.append(f"Step 2: LOWEST_COST evaluated {len(vendors)} vendors -> Selected '{selected.supplier_id}'")

        elif strat_upper == "FASTEST_DELIVERY":
            vendors.sort(key=lambda v: v.lead_time_days)
            selected = vendors[0]
            reason = f"Selected supplier '{selected.supplier_id}' with shortest lead time {selected.lead_time_days} days"
            trace.append(f"Step 2: FASTEST_DELIVERY evaluated {len(vendors)} vendors -> Selected '{selected.supplier_id}'")

        else:
            preferred_list = [v for v in vendors if v.is_preferred]
            if preferred_list:
                selected = preferred_list[0]
                reason = f"Selected preferred supplier '{selected.supplier_id}'"
                trace.append(f"Step 2: Selected preferred vendor '{selected.supplier_id}'")
            else:
                vendors.sort(key=lambda v: v.priority)
                selected = vendors[0]
                reason = f"Selected top priority supplier '{selected.supplier_id}'"
                trace.append(f"Step 2: Selected top priority vendor '{selected.supplier_id}'")

        net_cost = round(float(selected.cost_price) * (1.0 - float(selected.discount_percentage) / 100.0), 2)
        return VendorResolutionResult(
            vendor_id=selected.id,
            supplier_id=selected.supplier_id,
            contract_id=None,
            contract_code=None,
            contract_version=None,
            tier_id=None,
            strategy_used=strat_upper,
            score=100.0 if selected.is_preferred else 90.0,
            reason=reason,
            estimated_cost=net_cost,
            applied_discount=float(selected.discount_percentage),
            estimated_lead_time=selected.lead_time_days,
            resolution_trace=trace
        )



