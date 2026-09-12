"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import itertools
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text, case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemBatch,
    ItemSerial,
    ItemWarehouseLocation,
)
from ..models.customer_article_mapping import CustomerArticleMapping
from ..models.inventory import Product, ProductBatchStock
from ..schemas.item_master import (
    ItemCreateRequest,
    ItemUpdateRequest,
    ItemBatchItem,
    ItemSerialItem,
    MatrixVariantGenRequest,
    ItemResolutionResponse,
    LegacyProductAdapterResponse,
)


class UniversalItemMasterService:
    """
    Complete Universal Item Master Service (P1.2).
    Canonical Item, Variant matrix generator, Universal Barcode mapper, Batch/Serial tracking, and scanner resolver.
    """

    @classmethod
    async def get_item_by_code(
        cls,
        session: AsyncSession,
        item_code: str,
    ) -> Optional[Item]:
        """Fetches an item by unique SKU / item_code with loaded variants and barcodes."""
        stmt = (
            select(Item)
            .where(
                Item.item_code == item_code.strip().upper(),
                Item.is_deleted == False,
            )
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.serials),
                selectinload(Item.locations),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def create_item(
        cls,
        session: AsyncSession,
        req: Optional[ItemCreateRequest] = None,
        company_id: Optional[str] = None,
        item_code: Optional[str] = None,
        item_name: Optional[str] = None,
        category: Optional[str] = None,
        tax_rate: float = 18.00,
        mrp: float = 0.00,
        selling_price: float = 0.00,
        buying_price: Optional[float] = None,
        cost_price: float = 0.00,
        primary_barcode: Optional[str] = None,
        primary_uom: str = "PCS",
        item_type: str = "FINISHED_GOOD",
        hsn_code: str = "64041990",
        brand: Optional[str] = None,
        is_batch_tracked: bool = False,
        variants_data: Optional[List[Dict[str, Any]]] = None,
        branch_id: str = "BR-001",
        commit: bool = True,
        **kwargs: Any,
    ) -> Item:
        """
        Atomically creates or updates a Universal Item with default or custom variants, barcodes, batches, and warehouse locations.
        Supports both schema-based (ItemCreateRequest) and direct parameter invocations.
        """
        if req is not None:
            sku = req.item_code or f"ITM-{uuid.uuid4().hex[:8].upper()}"
            item_id = f"itm_{uuid.uuid4().hex[:12]}"

            item = Item(
                id=item_id,
                item_code=sku,
                item_name=req.item_name,
                item_type=req.item_type,
                category=req.category,
                category_code=req.category_code,
                brand=req.brand,
                hsn_code=req.hsn_code or "0000",
                tax_rate=Decimal(str(req.tax_rate)),
                primary_uom=req.primary_uom,
                mrp=Decimal(str(req.mrp)),
                selling_price=Decimal(str(req.selling_price)),
                cost_price=Decimal(str(req.cost_price)),
                buying_price=Decimal(str(req.buying_price)) if req.buying_price is not None else None,
                is_batch_tracked=req.is_batch_tracked,
                is_serial_tracked=req.is_serial_tracked,
                is_favorite=req.is_favorite,
                primary_image_url=req.primary_image_url,
                tags=req.tags,
                attributes_json=req.attributes_json,
                status="ACTIVE",
            )
            session.add(item)
            await session.flush()

            # 1. Custom or Default Variants
            if req.variants:
                for v_data in req.variants:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        variant_sku=v_data.variant_sku,
                        variant_name=v_data.variant_name,
                        attributes_json=v_data.attributes_json,
                        mrp=Decimal(str(v_data.mrp or item.mrp)),
                        selling_price=Decimal(str(v_data.selling_price or item.selling_price)),
                        cost_price=Decimal(str(v_data.cost_price or item.cost_price)),
                        is_active=v_data.is_active,
                    )
                    session.add(variant)
                    await session.flush()

                    # Add barcodes tied to variant
                    for bc in v_data.barcodes:
                        session.add(
                            ItemBarcode(
                                id=f"bc_{uuid.uuid4().hex[:12]}",
                                item_id=item.id,
                                variant_id=variant.id,
                                barcode=bc.barcode,
                                barcode_type=bc.barcode_type,
                                is_primary=bc.is_primary,
                            )
                        )
            else:
                # Create standard default variant
                variant = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_sku=f"{sku}-STD",
                    variant_name=f"{req.item_name} (Standard)",
                    mrp=item.mrp,
                    selling_price=item.selling_price,
                    cost_price=item.cost_price,
                    is_active=True,
                )
                session.add(variant)
                await session.flush()

                # Add primary item barcode if supplied or auto-generate EAN-style barcode
                if req.barcodes:
                    for bc in req.barcodes:
                        session.add(
                            ItemBarcode(
                                id=f"bc_{uuid.uuid4().hex[:12]}",
                                item_id=item.id,
                                variant_id=variant.id,
                                barcode=bc.barcode,
                                barcode_type=bc.barcode_type,
                                is_primary=bc.is_primary,
                            )
                        )
                else:
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=sku,
                            barcode_type="CUSTOM",
                            is_primary=True,
                        )
                    )

            # 2. Batches
            for b_data in req.batches:
                session.add(
                    ItemBatch(
                        id=f"batch_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        variant_id=b_data.variant_id or variant.id,
                        batch_number=b_data.batch_number,
                        mrp=Decimal(str(b_data.mrp or item.mrp)),
                        cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
                        is_active=b_data.is_active,
                    )
                )

            # 3. Warehouse Locations
            for loc in req.locations:
                session.add(
                    ItemWarehouseLocation(
                        id=f"loc_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        warehouse_id=loc.warehouse_id,
                        location_bin=loc.location_bin,
                        min_reorder_level=Decimal(str(loc.min_reorder_level)),
                        max_capacity=Decimal(str(loc.max_capacity)),
                        reorder_quantity=Decimal(str(loc.reorder_quantity)),
                    )
                )

            await session.commit()
            return await cls.get_item_by_id(session, item.id)

        # Direct parameter workflow
        clean_code = (item_code or "").strip().upper()
        clean_hsn = (hsn_code or "64041990").strip()
        existing = await cls.get_item_by_code(session, clean_code) if clean_code else None

        if not existing:
            item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                company_id=company_id or "COMP-001",
                branch_id=branch_id,
                item_code=clean_code,
                item_name=item_name or clean_code,
                item_type=item_type,
                category=category,
                brand=brand,
                hsn_code=clean_hsn,
                tax_rate=Decimal(str(tax_rate)),
                primary_uom=primary_uom,
                mrp=Decimal(str(mrp)),
                selling_price=Decimal(str(selling_price)),
                buying_price=Decimal(str(buying_price)) if buying_price is not None else None,
                cost_price=Decimal(str(cost_price)),
                is_batch_tracked=is_batch_tracked,
                status="ACTIVE",
                is_active=True,
                is_deleted=False,
            )
            session.add(item)
            await session.flush()
        else:
            item = existing
            if item_name:
                item.item_name = item_name
            if category:
                item.category = category
            if tax_rate is not None:
                item.tax_rate = Decimal(str(tax_rate))
            if mrp is not None:
                item.mrp = Decimal(str(mrp))
            if selling_price is not None:
                item.selling_price = Decimal(str(selling_price))
            if buying_price is not None:
                item.buying_price = Decimal(str(buying_price))
            if cost_price is not None:
                item.cost_price = Decimal(str(cost_price))
            if hsn_code:
                item.hsn_code = hsn_code
            if brand:
                item.brand = brand

        # Process Variants
        if variants_data:
            for v_data in variants_data:
                v_sku = v_data.get("variant_sku", f"{clean_code}-{v_data.get('variant_name', 'VAR')}").strip().upper()
                v_stmt = select(ItemVariant).where(
                    ItemVariant.item_id == item.id,
                    ItemVariant.variant_sku == v_sku,
                    ItemVariant.is_deleted == False,
                )
                variant = (await session.execute(v_stmt)).scalar_one_or_none()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        company_id=company_id or "COMP-001",
                        branch_id=branch_id,
                        item_id=item.id,
                        variant_sku=v_sku,
                        variant_name=v_data.get("variant_name", "Standard Variant"),
                        attributes_json=v_data.get("attributes_json", {}),
                        mrp=Decimal(str(v_data.get("mrp", mrp))),
                        selling_price=Decimal(str(v_data.get("selling_price", selling_price))),
                        cost_price=Decimal(str(v_data.get("cost_price", cost_price))),
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(variant)
                    await session.flush()

                # Variant barcode if provided
                if v_data.get("barcode"):
                    bc_val = str(v_data["barcode"]).strip().upper()
                    bc_stmt = select(ItemBarcode).where(
                        ItemBarcode.barcode == bc_val,
                        ItemBarcode.is_deleted == False,
                    )
                    bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
                    if not bc_obj:
                        bc_obj = ItemBarcode(
                            id=f"ibc_{uuid.uuid4().hex[:12]}",
                            company_id=company_id or "COMP-001",
                            branch_id=branch_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=bc_val,
                            barcode_type="EAN13",
                            is_primary=False,
                            is_active=True,
                            is_deleted=False,
                        )
                        session.add(bc_obj)

        # Primary Barcode
        if primary_barcode:
            bc_clean = str(primary_barcode).strip().upper()
            bc_stmt = select(ItemBarcode).where(
                ItemBarcode.barcode == bc_clean,
                ItemBarcode.is_deleted == False,
            )
            bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
            if not bc_obj:
                bc_obj = ItemBarcode(
                    id=f"ibc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id or "COMP-001",
                    branch_id=branch_id,
                    item_id=item.id,
                    variant_id=None,
                    barcode=bc_clean,
                    barcode_type="EAN13",
                    is_primary=True,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(bc_obj)

        if commit:
            await session.commit()
        else:
            await session.flush()
        return await cls.get_item_by_code(session, clean_code)

    @classmethod
    async def _compute_inventory_buckets(
        cls,
        session: AsyncSession,
        item_id: str,
        variant_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        item_code: Optional[str] = None,
        variant_sku: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Computes the 5 canonical enterprise inventory buckets:
        1. physical_on_hand: Total physical stock in store/warehouse
        2. in_transit_qty: Stock dispatched via transfer or inbound shipment, awaiting receipt
        3. reserved_qty: Soft allocation (cart hold / pending order hold)
        4. committed_qty: Hard allocations committed to confirmed sales orders / PO dispatches
        5. quarantine_qty: Damaged / expired / QC hold stock
        
        Adopted Enterprise Available-To-Promise (ATP) Formula:
        available_to_promise = max(0.0, round((physical_on_hand + in_transit_qty) - (reserved_qty + committed_qty + quarantine_qty), 4))
        """
        physical_on_hand = 0.0
        in_transit_qty = 0.0
        reserved_qty = 0.0
        committed_qty = 0.0
        quarantine_qty = 0.0

        if variant_id:
            batch_stock_stmt = select(ProductBatchStock).where(
                ProductBatchStock.variant_id == variant_id,
                ProductBatchStock.is_deleted == False,
            )
            if branch_id:
                batch_stock_stmt = batch_stock_stmt.where(ProductBatchStock.warehouse_id == branch_id)
            batch_stocks = (await session.execute(batch_stock_stmt)).scalars().all()
            if batch_stocks:
                for bs in batch_stocks:
                    physical_on_hand += float(bs.quantity or 0.0)
                    reserved_qty += float(bs.reserved_quantity or 0.0)
                    quarantine_qty += float(bs.damaged_quantity or 0.0)

        # Fallback to Product table
        if physical_on_hand == 0.0 and reserved_qty == 0.0:
            clauses = [Product.is_deleted == False]
            ident_clauses = []
            if variant_id:
                ident_clauses.append(Product.item_variant_id == variant_id)
            if item_id:
                ident_clauses.append(Product.item_id == item_id)
            if item_code:
                ident_clauses.append(Product.code == item_code)
            if variant_sku:
                ident_clauses.append(Product.sku == variant_sku)
            if ident_clauses:
                prod_stmt = select(Product).where(and_(*clauses, or_(*ident_clauses))).limit(1)
                prod_row = (await session.execute(prod_stmt)).scalar_one_or_none()
                if prod_row:
                    physical_on_hand = float(prod_row.stock or 0.0)
                    reserved_qty = float(prod_row.reserved_stock or 0.0)

        # Query committed sales order allocations
        try:
            async with session.begin_nested():
                from app.models.sales import SalesOrderReservation
                res_stmt = (
                    select(func.coalesce(func.sum(SalesOrderReservation.reserved_quantity), 0.0))
                    .where(
                        SalesOrderReservation.is_deleted == False,
                        SalesOrderReservation.status.in_(["ACTIVE", "PARTIAL"]),
                    )
                )
                if branch_id:
                    res_stmt = res_stmt.where(SalesOrderReservation.warehouse_id == branch_id)
                if variant_id or item_id:
                    prod_sub = select(Product.id).where(
                        or_(
                            Product.item_variant_id == variant_id if variant_id else False,
                            Product.item_id == item_id,
                        )
                    )
                    res_stmt = res_stmt.where(SalesOrderReservation.product_id.in_(prod_sub))
                committed_qty = float((await session.execute(res_stmt)).scalar() or 0.0)
        except Exception:
            committed_qty = 0.0

        # Query in-transit stock transfers
        try:
            async with session.begin_nested():
                from app.models.inventory import StockTransfer, StockTransferItem
                xfer_stmt = (
                    select(func.coalesce(func.sum(StockTransferItem.quantity_dispatched - StockTransferItem.quantity_received), 0.0))
                    .select_from(StockTransferItem)
                    .join(StockTransfer, StockTransfer.id == StockTransferItem.transfer_id)
                    .where(
                        StockTransfer.is_deleted == False,
                        StockTransferItem.is_deleted == False,
                        StockTransfer.status.in_(["DISPATCHED", "IN_TRANSIT"]),
                    )
                )
                if branch_id:
                    xfer_stmt = xfer_stmt.where(StockTransfer.dest_warehouse_id == branch_id)
                if variant_id or item_id:
                    prod_sub = select(Product.id).where(
                        or_(
                            Product.item_variant_id == variant_id if variant_id else False,
                            Product.item_id == item_id,
                        )
                    )
                    xfer_stmt = xfer_stmt.where(StockTransferItem.product_id.in_(prod_sub))
                in_transit_qty = float((await session.execute(xfer_stmt)).scalar() or 0.0)
        except Exception:
            in_transit_qty = 0.0

        # Strict Semantic Ownership & De-duplication Rules:
        # 1. committed_qty (Hard B2B Order Allocations):
        #    - Source Model : SalesOrderReservation (sales_order_reservations)
        #    - Statuses     : status IN ('ACTIVE', 'PARTIAL') AND is_deleted = false
        #    - Ownership    : Legally committed allocations against confirmed Sales Orders / PO releases
        # 2. reserved_qty (Soft In-Flight Holds):
        #    - Source Model : ProductBatchStock.reserved_quantity or Product.reserved_stock
        #    - Ownership    : Volatile cart holds (ecom_reservation.py) and active POS checkout sessions
        #    - De-duplication Rule:
        #      In sales.py (line 1002), confirming a SalesOrderReservation increments Product.reserved_stock.
        #      To eliminate double-deduction when Product.reserved_stock aggregates both:
        #      net_reserved_qty = max(0.0, raw_reserved_qty - committed_qty)
        raw_reserved_qty = reserved_qty
        net_reserved_qty = max(0.0, round(raw_reserved_qty - committed_qty, 4))

        # Adopted Enterprise ATP Formula:
        # available_to_promise = max(0.0, (physical_on_hand + in_transit_qty) - (reserved_qty + committed_qty + quarantine_qty))
        atp = max(0.0, round((physical_on_hand + in_transit_qty) - (net_reserved_qty + committed_qty + quarantine_qty), 4))
        return {
            "physical_on_hand": physical_on_hand,
            "in_transit_qty": in_transit_qty,
            "reserved_qty": net_reserved_qty,
            "committed_qty": committed_qty,
            "quarantine_qty": quarantine_qty,
            "available_to_promise": atp,
        }

    @classmethod
    async def _evaluate_pricing_contract(
        cls,
        session: AsyncSession,
        cam: Optional[CustomerArticleMapping],
        customer_id: Optional[str],
        base_mrp: float,
        selling_price: float,
        tax_rate: float,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Dict[str, Any]:
        """
        Evaluates customer commercial contract with temporal validity, customer authorization,
        customer group eligibility, currency validation, statutory GST slab checking, and full auditability.
        """
        as_of = as_of_date or date.today()
        is_customer_authorized = False
        is_contract_active = False
        contract_status = "NO_CONTRACT"
        rejection_reason = None
        contract_rate = None
        contract_discount_pct = None
        currency = (cam.currency if cam and cam.currency else "INR").upper()
        pricing_rule_applied = "BASE_SELLING_PRICE" if selling_price > 0 else "BASE_MRP"
        effective_price = selling_price if selling_price > 0 else base_mrp

        if cam:
            # 1. Customer Authorization Gate
            if not customer_id:
                is_customer_authorized = False
                contract_status = "UNAUTHORIZED_CONTEXT"
                rejection_reason = "No customer context provided for contract rate evaluation"
            elif str(cam.customer_id) != str(customer_id):
                is_customer_authorized = False
                contract_status = "CUSTOMER_MISMATCH"
                rejection_reason = f"Contract belongs to customer '{cam.customer_id}', mismatch with requested '{customer_id}'"
            else:
                # Customer match! Query customer to verify CRM active status and customer group
                from app.models.crm import Customer
                cust_stmt = select(Customer).where(Customer.id == str(customer_id), Customer.is_deleted == False)
                cust = (await session.execute(cust_stmt)).scalar_one_or_none()
                if cust and (cust.is_active is False or getattr(cust, "status", "ACTIVE") in ("INACTIVE", "SUSPENDED")):
                    is_customer_authorized = False
                    contract_status = "CUSTOMER_INACTIVE"
                    rejection_reason = "Customer account is inactive or suspended"
                else:
                    # Check customer group if specified in contract metadata
                    cam_meta = cam.metadata_json or {}
                    allowed_groups = cam_meta.get("eligible_customer_groups")
                    c_group = customer_group_id or (getattr(cust, "customer_group_id", None) if cust else None)
                    if allowed_groups and c_group and (c_group not in allowed_groups):
                        is_customer_authorized = False
                        contract_status = "CUSTOMER_GROUP_MISMATCH"
                        rejection_reason = f"Customer group '{c_group}' is not eligible for this contract (allowed: {allowed_groups})"
                    else:
                        is_customer_authorized = True

            # 2. Currency Validation Gate
            tx_curr = (transaction_currency or "INR").strip().upper()
            if is_customer_authorized and tx_curr != currency:
                is_customer_authorized = False
                contract_status = "CURRENCY_MISMATCH"
                rejection_reason = f"Transaction currency '{tx_curr}' does not match contract currency '{currency}'"

            # 3. Temporal & Status Gate
            if is_customer_authorized:
                if not cam.is_active or cam.is_deleted:
                    contract_status = "INACTIVE"
                    rejection_reason = "Contract mapping is inactive or deleted"
                elif cam.status != "ACTIVE":
                    contract_status = cam.status
                    rejection_reason = f"Contract status is {cam.status}"
                elif cam.effective_from and cam.effective_to and cam.effective_from > cam.effective_to:
                    contract_status = "INVALID_DATE_RANGE"
                    rejection_reason = f"Contract effective_from ({cam.effective_from}) is greater than effective_to ({cam.effective_to})"
                elif cam.effective_from and as_of < cam.effective_from:
                    contract_status = "FUTURE_CONTRACT"
                    rejection_reason = f"Contract effective date ({cam.effective_from}) is in the future"
                elif cam.effective_to and as_of > cam.effective_to:
                    contract_status = "EXPIRED"
                    rejection_reason = f"Contract expired on ({cam.effective_to})"
                else:
                    contract_status = "ACTIVE"
                    is_contract_active = True

            # 4. Rate Resolution Gate
            if is_contract_active:
                if cam.contract_rate and float(cam.contract_rate) > 0:
                    contract_rate = float(cam.contract_rate)
                    effective_price = contract_rate
                    pricing_rule_applied = "CUSTOMER_CONTRACT_RATE"
                elif cam.contract_discount_pct and float(cam.contract_discount_pct) > 0:
                    contract_discount_pct = float(cam.contract_discount_pct)
                    discount_factor = 1.0 - (contract_discount_pct / 100.0)
                    effective_price = round(base_mrp * discount_factor, 2)
                    pricing_rule_applied = "CUSTOMER_CONTRACT_DISCOUNT"
                else:
                    pricing_rule_applied = "BASE_SELLING_PRICE"
            else:
                if cam.contract_rate:
                    contract_rate = float(cam.contract_rate)
                if cam.contract_discount_pct:
                    contract_discount_pct = float(cam.contract_discount_pct)

        # 5. Statutory GST Slab Validation & Split
        statutory_slabs = {0.0, 5.0, 12.0, 18.0, 28.0}
        tax_rate_f = float(tax_rate or 0.0)
        is_standard_slab = round(tax_rate_f, 2) in statutory_slabs

        pos = (place_of_supply or "").strip()
        c_state = (company_state or "27").strip()
        tax_amount = round(effective_price * (tax_rate_f / 100.0), 2)

        if pos and pos == c_state:
            # Intra-state: CGST (50%) + SGST (50%)
            cgst_rate = tax_rate_f / 2.0
            sgst_rate = tax_rate_f / 2.0
            igst_rate = 0.0
            cgst_amount = round(effective_price * (cgst_rate / 100.0), 2)
            sgst_amount = round(effective_price * (sgst_rate / 100.0), 2)
            igst_amount = 0.0
        elif pos and pos != c_state:
            # Inter-state: IGST (100%)
            cgst_rate = 0.0
            sgst_rate = 0.0
            igst_rate = tax_rate_f
            cgst_amount = 0.0
            sgst_amount = 0.0
            igst_amount = tax_amount
        else:
            # Standard default split
            cgst_rate = tax_rate_f / 2.0
            sgst_rate = tax_rate_f / 2.0
            igst_rate = 0.0
            cgst_amount = round(tax_amount / 2.0, 2)
            sgst_amount = round(tax_amount - cgst_amount, 2)
            igst_amount = 0.0

        effective_price_inclusive = round(effective_price + tax_amount, 2)

        return {
            "effective_price": effective_price,
            "effective_price_inclusive": effective_price_inclusive,
            "tax_treatment": "TAXABLE_EXCLUSIVE",
            "tax_rate": tax_rate_f,
            "tax_amount": tax_amount,
            "currency": currency,
            "contract_rate": contract_rate,
            "contract_discount_pct": contract_discount_pct,
            "pricing_audit": {
                "contract_id": cam.id if cam else None,
                "customer_id": customer_id,
                "as_of_date": str(as_of),
                "effective_from": str(cam.effective_from) if (cam and cam.effective_from) else None,
                "effective_to": str(cam.effective_to) if (cam and cam.effective_to) else None,
                "contract_status": contract_status,
                "is_contract_active": is_contract_active,
                "customer_authorized": is_customer_authorized,
                "pricing_rule_applied": pricing_rule_applied,
                "effective_rate": effective_price,
                "currency": currency,
                "transaction_currency": transaction_currency,
                "rejection_reason": rejection_reason,
                "source_system": cam.source_system if cam else "DEFAULT_PRICE_LIST",
                "verification_status": cam.verification_status if cam else "UNMAPPED",
                "statutory_gst": {
                    "hsn_code": cam.buyer_hsn if (cam and cam.buyer_hsn) else None,
                    "tax_rate": tax_rate_f,
                    "is_standard_slab": is_standard_slab,
                    "place_of_supply": pos or None,
                    "company_state": c_state,
                    "is_inter_state": bool(pos and pos != c_state),
                    "cgst_rate": cgst_rate,
                    "sgst_rate": sgst_rate,
                    "igst_rate": igst_rate,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "igst_amount": igst_amount,
                    "total_tax": tax_amount,
                },
            },
        }

    @classmethod
    async def lookup_by_barcode(
        cls,
        session: AsyncSession,
        barcode: str,
        branch_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Universal Barcode Resolver. Resolves barcode across canonical ItemBarcode registry,
        linking with item metadata, 5-bucket inventory, and batch tracking.
        """
        clean_bc = str(barcode).strip()

        # 1. Search canonical ItemBarcode table
        stmt = (
            select(ItemBarcode)
            .where(
                ItemBarcode.barcode == clean_bc,
                ItemBarcode.is_deleted == False,
            )
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant),
            )
        )
        res = await session.execute(stmt)
        barcode_row = res.scalar_one_or_none()

        if barcode_row and barcode_row.item:
            item = barcode_row.item
            variant = barcode_row.variant
            mrp = float(variant.mrp if variant and variant.mrp else (item.mrp or 0.0))
            selling_price = float(variant.selling_price if variant and variant.selling_price else (item.selling_price or 0.0))
            cost_price = float(variant.cost_price if variant and variant.cost_price else (item.cost_price or 0.0))
            tax_rate = float(variant.tax_rate if variant and variant.tax_rate is not None else (item.tax_rate or 0.0))

            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            tax_amount = round(selling_price * (tax_rate / 100.0), 2)

            return {
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "variant_id": variant.id if variant else None,
                "variant_sku": variant.variant_sku if variant else item.item_code,
                "variant_name": variant.variant_name if variant else None,
                "barcode": clean_bc,
                "barcode_type": barcode_row.barcode_type or "EAN13",
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": cost_price,
                "effective_price": selling_price if selling_price > 0 else mrp,
                "currency": "INR",
                "tax_rate": tax_rate,
                "tax_treatment": "TAXABLE_EXCLUSIVE",
                "tax_amount": tax_amount,
                "effective_price_inclusive": round(selling_price + tax_amount, 2),
                "hsn_code": variant.hsn_code or item.hsn_code or "64041990",
                "primary_uom": item.primary_uom or "PAIR",
                "is_batch_tracked": item.is_batch_tracked,
                # 5-Bucket Inventory
                "inventory": inv_buckets,
                "physical_on_hand": inv_buckets["physical_on_hand"],
                "in_transit_qty": inv_buckets["in_transit_qty"],
                "reserved_qty": inv_buckets["reserved_qty"],
                "committed_qty": inv_buckets["committed_qty"],
                "quarantine_qty": inv_buckets["quarantine_qty"],
                "available_to_promise": inv_buckets["available_to_promise"],
            }

        # 2. Backward compatibility fallback to Product table
        prod_stmt = select(Product).where(
            or_(
                Product.barcode == clean_bc,
                Product.secondary_barcodes.any(clean_bc),
            ),
            Product.is_deleted == False,
        )
        prod_res = await session.execute(prod_stmt)
        prod = prod_res.scalar_one_or_none()
        if prod:
            mrp = float(prod.mrp or prod.price or 0.0)
            selling_price = float(prod.price or 0.0)
            tax_rate = float(prod.gst_percentage or 18.0)
            tax_amount = round(selling_price * (tax_rate / 100.0), 2)
            on_hand = float(prod.stock or 0.0)
            res_stock = float(prod.reserved_stock or 0.0)
            atp = max(0.0, round(on_hand - res_stock, 4))
            inv_buckets = {
                "physical_on_hand": on_hand,
                "in_transit_qty": 0.0,
                "reserved_qty": res_stock,
                "committed_qty": 0.0,
                "quarantine_qty": 0.0,
                "available_to_promise": atp,
            }
            return {
                "item_id": prod.id,
                "item_code": prod.sku or prod.code,
                "item_name": prod.name,
                "variant_id": None,
                "variant_sku": prod.sku or prod.code,
                "variant_name": None,
                "barcode": clean_bc,
                "barcode_type": "EAN13",
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": float(prod.cost_price or 0.0),
                "effective_price": selling_price if selling_price > 0 else mrp,
                "currency": "INR",
                "tax_rate": tax_rate,
                "tax_treatment": "TAXABLE_EXCLUSIVE",
                "tax_amount": tax_amount,
                "effective_price_inclusive": round(selling_price + tax_amount, 2),
                "hsn_code": prod.hsn_code or "6403",
                "primary_uom": "PAIR",
                "is_batch_tracked": getattr(prod, "is_batch_tracked", False),
                # 5-Bucket Inventory
                "inventory": inv_buckets,
                "physical_on_hand": on_hand,
                "in_transit_qty": 0.0,
                "reserved_qty": res_stock,
                "committed_qty": 0.0,
                "quarantine_qty": 0.0,
                "available_to_promise": atp,
            }

        return None

    @classmethod
    async def resolve_by_key(
        cls,
        session: AsyncSession,
        key: str,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Optional[Dict[str, Any]]:
        """
        Universal 3-Way Product Resolver.
        Resolves product payload by Barcode, Variant SKU / Stock No, or Buyer Material Code,
        applying temporal contract-governed pricing and 5-bucket inventory calculation.
        """
        clean_key = str(key).strip().upper()
        if not clean_key:
            return None

        stmt = (
            select(
                Item,
                ItemVariant,
                ItemBarcode,
                CustomerArticleMapping,
            )
            .join(ItemVariant, ItemVariant.item_id == Item.id)
            .outerjoin(ItemBarcode, and_(ItemBarcode.variant_id == ItemVariant.id, ItemBarcode.is_deleted == False))
            .outerjoin(
                CustomerArticleMapping,
                and_(
                    CustomerArticleMapping.variant_id == ItemVariant.id,
                    CustomerArticleMapping.is_active == True,
                    CustomerArticleMapping.is_deleted == False,
                ),
            )
            .where(
                Item.is_deleted == False,
                ItemVariant.is_deleted == False,
                or_(
                    ItemBarcode.barcode == clean_key,
                    ItemVariant.variant_sku == clean_key,
                    CustomerArticleMapping.customer_article == clean_key,
                ),
            )
            .order_by(
                case((CustomerArticleMapping.customer_id == customer_id, 1), else_=2) if customer_id else CustomerArticleMapping.id
            )
            .limit(1)
        )
        res = await session.execute(stmt)
        row = res.first()

        if row:
            item, variant, barcode_obj, cam = row
            mrp = float(variant.mrp) if variant and variant.mrp and variant.mrp > 0 else float(item.mrp or 0.0)
            selling_price = float(variant.selling_price) if variant and variant.selling_price and variant.selling_price > 0 else float(item.selling_price or 0.0)
            cost_price = float(variant.cost_price) if variant and variant.cost_price and variant.cost_price > 0 else float(item.cost_price or 0.0)

            # Contract-Governed Pricing & Temporal Validation
            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=cam,
                customer_id=customer_id,
                base_mrp=mrp,
                selling_price=selling_price,
                tax_rate=float(item.tax_rate or 0.0),
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )

            # 5-Bucket Enterprise Inventory
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return {
                "item_id": item.id,
                "vendor_article": item.item_code,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "brand": item.brand,
                "category": item.category,
                "hsn_code": (cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                "tax_rate": pricing_eval["tax_rate"],
                "tax_treatment": pricing_eval["tax_treatment"],
                "tax_amount": pricing_eval["tax_amount"],
                "effective_price_inclusive": pricing_eval["effective_price_inclusive"],
                "primary_uom": item.primary_uom or "PAIR",
                "variant_id": variant.id,
                "variant_sku": variant.variant_sku,
                "variant_name": variant.variant_name,
                "attributes_json": variant.attributes_json or {},
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": cost_price,
                "effective_price": pricing_eval["effective_price"],
                "currency": pricing_eval["currency"],
                "barcode": barcode_obj.barcode if barcode_obj else (cam.barcode if cam else None),
                "barcode_type": barcode_obj.barcode_type if barcode_obj else "EAN13",
                "customer_article": cam.customer_article if cam else None,
                "contract_discount_pct": pricing_eval["contract_discount_pct"],
                "contract_rate": pricing_eval["contract_rate"],
                "customer_style_description": cam.customer_style_description if cam else None,
                "verification_status": cam.verification_status if cam else "UNMAPPED",
                "is_batch_tracked": item.is_batch_tracked,
                # 5-Bucket Inventory Output
                "inventory": inv_buckets,
                "physical_on_hand": inv_buckets["physical_on_hand"],
                "in_transit_qty": inv_buckets["in_transit_qty"],
                "reserved_qty": inv_buckets["reserved_qty"],
                "committed_qty": inv_buckets["committed_qty"],
                "quarantine_qty": inv_buckets["quarantine_qty"],
                "available_to_promise": inv_buckets["available_to_promise"],
                # Temporal & Contract-Governed Pricing Audit
                "pricing_audit": pricing_eval["pricing_audit"],
            }

        return await cls.lookup_by_barcode(session, clean_key, branch_id=branch_id)

    @classmethod
    async def get_item_by_id(cls, session: AsyncSession, item_id: str) -> Optional[Item]:
        """Fetches item by ID with variants, barcodes, batches, and locations."""
        stmt = (
            select(Item)
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.serials),
                selectinload(Item.locations),
            )
            .where(Item.id == item_id)
            .execution_options(populate_existing=True)
        )
        return (await session.execute(stmt)).scalars().first()

    @classmethod
    async def list_items(
        cls,
        session: AsyncSession,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Item]:
        """Searches and lists items."""
        stmt = (
            select(Item)
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.locations),
            )
            .execution_options(populate_existing=True)
        )
        if category:
            stmt = stmt.where(Item.category == category)
        if brand:
            stmt = stmt.where(Item.brand == brand)

        if query:
            q = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Item.item_name.ilike(q),
                    Item.item_code.ilike(q),
                    Item.brand.ilike(q),
                    Item.category.ilike(q),
                )
            )

        stmt = stmt.order_by(Item.item_name).limit(limit).offset(offset)
        return (await session.execute(stmt)).scalars().all()

    @classmethod
    async def generate_matrix_variants(
        cls,
        session: AsyncSession,
        item_id: str,
        req: MatrixVariantGenRequest,
    ) -> List[ItemVariant]:
        """
        Matrix Variant Generator (Size x Color Cartesian product):
        Generates unique SKU dimensions and primary barcodes automatically.
        """
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        dim_names = [d.dimension_name for d in req.dimensions]
        dim_values = [d.values for d in req.dimensions]

        combinations = list(itertools.product(*dim_values))
        created_variants = []

        for combo in combinations:
            attr_dict = {dim_names[i]: combo[i] for i in range(len(combo))}
            sku_suffix = "-".join(str(val).upper().replace(" ", "") for val in combo)
            variant_sku = f"{item.item_code}-{sku_suffix}"
            variant_name = f"{item.item_name} ({', '.join(combo)})"

            # Check if variant exists
            existing_var = (
                await session.execute(
                    select(ItemVariant).where(ItemVariant.variant_sku == variant_sku)
                )
            ).scalars().first()

            if not existing_var:
                mrp_val = Decimal(str(req.base_mrp if req.base_mrp is not None else item.mrp))
                selling_val = Decimal(str(req.base_selling_price if req.base_selling_price is not None else item.selling_price))
                cost_val = Decimal(str(req.base_cost_price if req.base_cost_price is not None else item.cost_price))

                var = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_sku=variant_sku,
                    variant_name=variant_name,
                    attributes_json=attr_dict,
                    mrp=mrp_val,
                    selling_price=selling_val,
                    cost_price=cost_val,
                    is_active=True,
                )
                session.add(var)
                await session.flush()

                if req.auto_generate_barcodes:
                    bc_val = f"890{uuid.uuid4().int % 10000000000:010d}"
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            item_id=item.id,
                            variant_id=var.id,
                            barcode=bc_val,
                            barcode_type="EAN13",
                            is_primary=True,
                        )
                    )

                created_variants.append(var)
                item.variants.append(var)

        await session.commit()
        return created_variants

    @classmethod
    async def resolve_item_by_barcode_or_sku(
        cls,
        session: AsyncSession,
        query_str: str,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Optional[ItemResolutionResponse]:
        """
        Fast 5-Tier Universal Scanner Resolver:
        Tier 1: Exact Barcode Match
        Tier 2: Variant SKU Match
        Tier 3: Customer / Buyer Article Code Match (customer_article_mappings)
        Tier 4: Item Code Match
        Tier 5: Serial Number Match
        Enforces 5-bucket inventory and temporal contract-governed pricing.
        """
        q = query_str.strip()
        if not q:
            return None

        # 1. Tier 1: Barcode Match
        bc_stmt = (
            select(ItemBarcode)
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant),
            )
            .where(ItemBarcode.barcode == q, ItemBarcode.is_deleted == False)
        )
        bc_match = (await session.execute(bc_stmt)).scalars().first()
        if bc_match and bc_match.item:
            item = bc_match.item
            variant = bc_match.variant
            cam = None
            if variant:
                cam_stmt = select(CustomerArticleMapping).where(
                    CustomerArticleMapping.variant_id == variant.id,
                    CustomerArticleMapping.is_active == True,
                    CustomerArticleMapping.is_deleted == False,
                    or_(customer_id == None, CustomerArticleMapping.customer_id == customer_id)
                ).limit(1)
                cam = (await session.execute(cam_stmt)).scalars().first()

            attrs = variant.attributes_json if variant and variant.attributes_json else {}
            mrp_val = float(variant.mrp if (variant and variant.mrp and variant.mrp > 0) else (item.mrp or 0.00))
            selling_val = float(variant.selling_price if (variant and variant.selling_price and variant.selling_price > 0) else (item.selling_price or 0.00))
            tax_rate_val = float(variant.tax_rate if (variant and variant.tax_rate is not None) else (item.tax_rate or 0.00))

            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=cam,
                customer_id=customer_id,
                base_mrp=mrp_val,
                selling_price=selling_val,
                tax_rate=tax_rate_val,
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return ItemResolutionResponse(
                matched_by="BARCODE",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                barcode=bc_match.barcode,
                hsn_code=(cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                tax_rate=tax_rate_val,
                mrp=mrp_val,
                selling_price=selling_val,
                cost_price=float(variant.cost_price if (variant and variant.cost_price and variant.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
                color=attrs.get("color"),
                size=attrs.get("size"),
                attributes_json=attrs,
                customer_article=cam.customer_article if cam else None,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam.customer_style_description if cam else None,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets,
                pricing_audit=pricing_eval["pricing_audit"],
            )

        # 2. Tier 2: Variant SKU Match
        var_stmt = (
            select(ItemVariant)
            .options(
                selectinload(ItemVariant.item),
                selectinload(ItemVariant.barcodes),
            )
            .where(ItemVariant.variant_sku.ilike(q), ItemVariant.is_deleted == False)
        )
        var_match = (await session.execute(var_stmt)).scalars().first()
        if var_match and var_match.item:
            item = var_match.item
            primary_bc = next((b.barcode for b in var_match.barcodes if b.is_primary and not b.is_deleted), None) or (var_match.barcodes[0].barcode if var_match.barcodes else None)
            cam = None
            cam_stmt = select(CustomerArticleMapping).where(
                CustomerArticleMapping.variant_id == var_match.id,
                CustomerArticleMapping.is_active == True,
                CustomerArticleMapping.is_deleted == False,
                or_(customer_id == None, CustomerArticleMapping.customer_id == customer_id)
            ).limit(1)
            cam = (await session.execute(cam_stmt)).scalars().first()

            attrs = var_match.attributes_json or {}
            mrp_val = float(var_match.mrp if (var_match.mrp and var_match.mrp > 0) else (item.mrp or 0.00))
            selling_val = float(var_match.selling_price if (var_match.selling_price and var_match.selling_price > 0) else (item.selling_price or 0.00))
            tax_rate_val = float(var_match.tax_rate if var_match.tax_rate is not None else (item.tax_rate or 0.00))

            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=cam,
                customer_id=customer_id,
                base_mrp=mrp_val,
                selling_price=selling_val,
                tax_rate=tax_rate_val,
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=var_match.id,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=var_match.variant_sku,
            )

            return ItemResolutionResponse(
                matched_by="VARIANT_SKU",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=var_match.id,
                variant_sku=var_match.variant_sku,
                barcode=primary_bc,
                hsn_code=(cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                tax_rate=tax_rate_val,
                mrp=mrp_val,
                selling_price=selling_val,
                cost_price=float(var_match.cost_price if (var_match.cost_price and var_match.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
                color=attrs.get("color"),
                size=attrs.get("size"),
                attributes_json=attrs,
                customer_article=cam.customer_article if cam else None,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam.customer_style_description if cam else None,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets,
                pricing_audit=pricing_eval["pricing_audit"],
            )

        # 3. Tier 3: Customer / Buyer Article Code Match
        cam_stmt = (
            select(CustomerArticleMapping)
            .options(
                selectinload(CustomerArticleMapping.item),
                selectinload(CustomerArticleMapping.variant),
            )
            .where(
                CustomerArticleMapping.customer_article == q,
                CustomerArticleMapping.is_active == True,
                CustomerArticleMapping.is_deleted == False,
            )
            .order_by(
                case((CustomerArticleMapping.customer_id == customer_id, 1), else_=2) if customer_id else CustomerArticleMapping.id
            )
        )
        cam_match = (await session.execute(cam_stmt)).scalars().first()
        if cam_match and cam_match.item and cam_match.variant:
            item = cam_match.item
            variant = cam_match.variant
            attrs = variant.attributes_json or {}
            mrp_val = float(cam_match.base_mrp if (cam_match.base_mrp and cam_match.base_mrp > 0) else (variant.mrp or item.mrp or 0.00))
            selling_val = float(variant.selling_price if (variant.selling_price and variant.selling_price > 0) else (item.selling_price or 0.00))
            tax_rate_val = float(variant.tax_rate if variant.tax_rate is not None else (item.tax_rate or 0.00))

            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=cam_match,
                customer_id=customer_id,
                base_mrp=mrp_val,
                selling_price=selling_val,
                tax_rate=tax_rate_val,
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku,
            )

            return ItemResolutionResponse(
                matched_by="BUYER_CODE",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=variant.id,
                variant_sku=variant.variant_sku,
                barcode=cam_match.barcode,
                hsn_code=cam_match.buyer_hsn or item.hsn_code,
                tax_rate=tax_rate_val,
                mrp=mrp_val,
                selling_price=selling_val,
                cost_price=float(variant.cost_price if (variant.cost_price and variant.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
                color=cam_match.color or attrs.get("color"),
                size=cam_match.size or attrs.get("size"),
                attributes_json=attrs,
                customer_article=cam_match.customer_article,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam_match.customer_style_description,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets,
                pricing_audit=pricing_eval["pricing_audit"],
            )

        # 4. Tier 4: Item Code Match
        item_stmt = (
            select(Item)
            .options(
                selectinload(Item.variants),
                selectinload(Item.barcodes),
            )
            .where(Item.item_code.ilike(q), Item.is_deleted == False)
        )
        item_match = (await session.execute(item_stmt)).scalars().first()
        if item_match:
            primary_bc = next((b.barcode for b in item_match.barcodes if b.is_primary and not b.is_deleted), None) or (item_match.barcodes[0].barcode if item_match.barcodes else None)
            var0 = item_match.variants[0] if item_match.variants else None
            attrs = var0.attributes_json if var0 and var0.attributes_json else {}
            mrp_val = float(item_match.mrp or 0.00)
            selling_val = float(item_match.selling_price or 0.00)
            tax_rate_val = float(item_match.tax_rate or 0.00)

            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=None,
                customer_id=customer_id,
                base_mrp=mrp_val,
                selling_price=selling_val,
                tax_rate=tax_rate_val,
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item_match.id,
                variant_id=var0.id if var0 else None,
                branch_id=branch_id,
                item_code=item_match.item_code,
                variant_sku=var0.variant_sku if var0 else None,
            )

            return ItemResolutionResponse(
                matched_by="ITEM_CODE",
                item_id=item_match.id,
                item_code=item_match.item_code,
                item_name=item_match.item_name,
                variant_id=var0.id if var0 else None,
                variant_sku=var0.variant_sku if var0 else None,
                barcode=primary_bc,
                hsn_code=item_match.hsn_code,
                tax_rate=tax_rate_val,
                mrp=mrp_val,
                selling_price=selling_val,
                cost_price=float(item_match.cost_price or 0.00),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item_match.primary_uom,
                category=item_match.category,
                brand=item_match.brand,
                color=attrs.get("color"),
                size=attrs.get("size"),
                attributes_json=attrs,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets,
                pricing_audit=pricing_eval["pricing_audit"],
            )

        # 5. Tier 5: Serial Number Match
        serial_stmt = (
            select(ItemSerial)
            .options(
                selectinload(ItemSerial.item),
                selectinload(ItemSerial.variant),
            )
            .where(ItemSerial.serial_number == q)
        )
        serial_match = (await session.execute(serial_stmt)).scalars().first()
        if serial_match and serial_match.item:
            item = serial_match.item
            variant = serial_match.variant
            attrs = variant.attributes_json if variant and variant.attributes_json else {}
            mrp_val = float(variant.mrp if variant and variant.mrp else (item.mrp or 0.00))
            selling_val = float(variant.selling_price if variant and variant.selling_price else (item.selling_price or 0.00))
            tax_rate_val = float(item.tax_rate or 0.00)

            pricing_eval = await cls._evaluate_pricing_contract(
                session=session,
                cam=None,
                customer_id=customer_id,
                base_mrp=mrp_val,
                selling_price=selling_val,
                tax_rate=tax_rate_val,
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await cls._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return ItemResolutionResponse(
                matched_by="SERIAL",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                serial_number=serial_match.serial_number,
                hsn_code=item.hsn_code,
                tax_rate=tax_rate_val,
                mrp=mrp_val,
                selling_price=selling_val,
                cost_price=float(variant.cost_price if variant and variant.cost_price else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
                color=attrs.get("color"),
                size=attrs.get("size"),
                attributes_json=attrs,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets,
                pricing_audit=pricing_eval["pricing_audit"],
            )

        return None

    @classmethod
    async def create_batch(
        cls,
        session: AsyncSession,
        item_id: str,
        b_data: ItemBatchItem,
    ) -> ItemBatch:
        """Registers an inventory batch with manufacturing and expiration dates."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        batch = ItemBatch(
            id=f"batch_{uuid.uuid4().hex[:12]}",
            item_id=item.id,
            variant_id=b_data.variant_id or (item.variants[0].id if item.variants else None),
            batch_number=b_data.batch_number,
            mrp=Decimal(str(b_data.mrp or item.mrp)),
            cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
            is_active=b_data.is_active,
        )
        session.add(batch)
        item.batches.append(batch)
        await session.commit()
        return batch

    @classmethod
    async def register_serial_numbers(
        cls,
        session: AsyncSession,
        item_id: str,
        serial_items: List[ItemSerialItem],
    ) -> List[ItemSerial]:
        """Registers a collection of serialized unit IDs."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        created = []
        for s_data in serial_items:
            ser = ItemSerial(
                id=f"ser_{uuid.uuid4().hex[:12]}",
                item_id=item.id,
                variant_id=s_data.variant_id or (item.variants[0].id if item.variants else None),
                serial_number=s_data.serial_number,
                status=s_data.status,
                warehouse_id=s_data.warehouse_id,
            )
            session.add(ser)
            item.serials.append(ser)
            created.append(ser)

        await session.commit()
        return created

    @classmethod
    async def get_legacy_product_view(
        cls,
        session: AsyncSession,
        item_id: str,
    ) -> Optional[LegacyProductAdapterResponse]:
        """Compatibility adapter: Projects Universal Item as a legacy Product object."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            return None

        return LegacyProductAdapterResponse(
            id=item.id,
            sku=item.item_code,
            name=item.item_name,
            category=item.category,
            brand=item.brand,
            hsn_code=item.hsn_code,
            tax_rate=float(item.tax_rate),
            price=float(item.selling_price),
            cost=float(item.cost_price),
            mrp=float(item.mrp),
            uom=item.primary_uom,
            is_active=item.status == "ACTIVE",
        )
