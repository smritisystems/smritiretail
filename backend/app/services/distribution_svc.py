"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, and_, or_, desc, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.distribution import (
    DistributionTerritory,
    DealerAssignment,
    DistributionRoute,
    RouteStop,
    DistributionOrder,
    DistributionOrderItem,
    LoadingSheet,
    LoadingSheetItem,
    DistributionClaim,
    DistributionSettlement,
)
from ..models.party import Party, PartyRole
from ..models.item_master import Item, ItemVariant
from ..models.inventory import Product, StockMovement
from ..services.pricing_engine import PricingEngine
from ..services.governed_rules import GovernedRuleEngine
from ..services.tx_reproduce_svc import TransactionReproducibilityService
from ..schemas.distribution import (
    RouteCreateReq,
    RouteStopReq,
    LoadingSheetCreateReq,
    ClaimSubmitReq,
    ClaimReviewReq,
    SettlementCreateReq,
)


class DistributionService:
    """
    Distribution Engine Service (Section 8).
    Handles Primary/Secondary distribution orders, dealer territorial assignments,
    delivery routes & stops, vehicle loading sheets, claims workflows, and route trip settlements.
    """

    # -----------------------------------------------------------------------
    # 1. Territories & Dealer Assignments
    # -----------------------------------------------------------------------
    @classmethod
    async def create_territory(
        cls,
        session: AsyncSession,
        code: str,
        name: str,
        region: str = "WEST",
        parent_code: Optional[str] = None
    ) -> DistributionTerritory:
        """Creates or returns a distribution territory."""
        stmt = select(DistributionTerritory).where(DistributionTerritory.code == code)
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            return existing

        territory = DistributionTerritory(
            id=f"terr_{uuid.uuid4().hex[:12]}",
            code=code,
            name=name,
            region=region,
            parent_territory_code=parent_code,
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(territory)
        await session.flush()
        return territory

    @classmethod
    async def assign_dealer(
        cls,
        session: AsyncSession,
        party_id: str,
        territory_code: str,
        salesman_id: Optional[str] = None,
        credit_limit: Decimal = Decimal("50000.00"),
        credit_days: int = 30
    ) -> DealerAssignment:
        """Assigns a dealer/distributor Party to a geographic territory."""
        stmt = select(DealerAssignment).where(
            DealerAssignment.party_id == party_id,
            DealerAssignment.territory_code == territory_code
        )
        assignment = (await session.execute(stmt)).scalars().first()
        if not assignment:
            assignment = DealerAssignment(
                id=f"da_{uuid.uuid4().hex[:12]}",
                party_id=party_id,
                territory_code=territory_code,
                salesman_id=salesman_id,
                credit_limit=credit_limit,
                credit_days=credit_days,
                is_active=True,
                is_deleted=False,
            )
            session.add(assignment)
        else:
            assignment.salesman_id = salesman_id
            assignment.credit_limit = credit_limit
            assignment.credit_days = credit_days
            assignment.is_active = True

        await session.flush()
        return assignment

    # -----------------------------------------------------------------------
    # 2. Delivery Routes & Retailer Stops
    # -----------------------------------------------------------------------
    @classmethod
    async def create_route(
        cls,
        session: AsyncSession,
        company_id: str,
        req: RouteCreateReq,
        user_id: Optional[str] = None,
    ) -> DistributionRoute:
        route_id = f"drt_{uuid.uuid4().hex[:12]}"
        route = DistributionRoute(
            id=route_id,
            company_id=company_id,
            route_code=req.route_code,
            name=req.name,
            territory_code=req.territory_code,
            assigned_salesman_id=req.assigned_salesman_id,
            assigned_driver_id=req.assigned_driver_id,
            vehicle_number=req.vehicle_number,
            status="ACTIVE",
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(route)
        await session.flush()

        if req.stops:
            for s in req.stops:
                stop = RouteStop(
                    id=f"rst_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    route_id=route.id,
                    party_id=s.party_id,
                    stop_sequence=s.stop_sequence,
                    planned_time=s.planned_time,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(stop)
            await session.flush()

        await session.commit()
        await session.refresh(route)
        return route

    @classmethod
    async def add_route_stop(
        cls,
        session: AsyncSession,
        company_id: str,
        route_id: str,
        req: RouteStopReq,
    ) -> RouteStop:
        stmt = select(DistributionRoute).where(
            DistributionRoute.company_id == company_id,
            DistributionRoute.id == route_id,
            DistributionRoute.is_deleted == False,
        )
        route = (await session.execute(stmt)).scalars().first()
        if not route:
            raise ValueError(f"Route '{route_id}' not found.")

        stop = RouteStop(
            id=f"rst_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            route_id=route.id,
            party_id=req.party_id,
            stop_sequence=req.stop_sequence,
            planned_time=req.planned_time,
            is_active=True,
            is_deleted=False,
        )
        session.add(stop)
        await session.commit()
        await session.refresh(stop)
        return stop

    # -----------------------------------------------------------------------
    # 3. Distribution Orders (Primary & Secondary)
    # -----------------------------------------------------------------------
    @classmethod
    async def create_distribution_order(
        cls,
        session: AsyncSession,
        party_id: str,
        order_type: str = "PRIMARY",
        territory_code: Optional[str] = None,
        salesman_id: Optional[str] = None,
        route_id: Optional[str] = None,
        delivery_route: Optional[str] = None,
        line_items_data: Optional[List[Dict[str, Any]]] = None,
        supplier_state: str = "27",
        recipient_state: str = "27",
        price_book_code: Optional[str] = None,
        company_id: str = "COMP-001",
    ) -> DistributionOrder:
        """
        Creates a canonical Distribution Order with priced lines, statutory GST,
        and embedded governance version snapshot (P1.5).
        """
        if not line_items_data:
            raise ValueError("Distribution order must contain at least one line item.")

        # 1. Verify Party
        party_stmt = select(Party).options(selectinload(Party.roles)).where(Party.id == party_id)
        party = (await session.execute(party_stmt)).scalars().first()
        if not party:
            raise ValueError(f"Party '{party_id}' does not exist.")

        # 2. Build snapshot
        snapshot = TransactionReproducibilityService.create_governance_snapshot(
            rule_versions={"PRICING_ENGINE": 1, "POLICY_GST_STANDARD": 1},
            policy_versions={"POLICY_GST_STANDARD": 1}
        )

        order_no = f"DO-{uuid.uuid4().hex[:8].upper()}"
        order = DistributionOrder(
            id=f"do_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            order_no=order_no,
            party_id=party.id,
            order_type=order_type.upper(),
            status="DRAFT",
            territory_code=territory_code,
            salesman_id=salesman_id,
            route_id=route_id,
            delivery_route=delivery_route,
            governance_snapshot_id=snapshot["snapshot_id"],
            rule_snapshots=snapshot,
            is_active=True,
            is_deleted=False,
        )
        session.add(order)
        await session.flush()

        # 3. Calculate line items with PricingEngine
        gst_lines = []
        order_items = []
        for line in line_items_data:
            item_id = line["item_id"]
            variant_id = line.get("variant_id")
            qty = Decimal(str(line.get("quantity", 1.0)))

            # Evaluate effective unit price
            pricing_res = await PricingEngine.calculate_effective_price(
                session=session,
                item_id=item_id,
                variant_id=variant_id,
                quantity=qty,
                price_book_code=price_book_code
            )

            unit_price = Decimal(str(pricing_res["effective_unit_price"]))
            line_subtotal = (unit_price * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Get item tax rate
            item_stmt = select(Item).where(Item.id == item_id)
            item_obj = (await session.execute(item_stmt)).scalars().first()
            tax_rate = item_obj.tax_rate if item_obj else Decimal("18.00")

            gst_lines.append({
                "item_id": item_id,
                "quantity": float(qty),
                "unit_price": float(unit_price),
                "discount_amount": 0,
                "tax_rate": float(tax_rate)
            })

            order_item = DistributionOrderItem(
                id=f"doi_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                order_id=order.id,
                item_id=item_id,
                variant_id=variant_id,
                quantity=qty,
                unit_price=unit_price,
                discount_amount=Decimal("0.00"),
                tax_rate=tax_rate,
                tax_amount=Decimal("0.00"),
                line_total=line_subtotal,
                is_active=True,
                is_deleted=False,
            )
            order_item.order = order
            session.add(order_item)
            order_items.append(order_item)

        # 4. Evaluate Statutory GST Tax Policy
        gst_calc = GovernedRuleEngine.evaluate_gst_tax_policy(
            line_items=gst_lines,
            supplier_state_code=supplier_state,
            recipient_state_code=recipient_state
        )

        order.taxable_amount = gst_calc["taxable_total"]
        order.tax_total = (gst_calc["cgst_total"] + gst_calc["sgst_total"] + gst_calc["igst_total"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        order.grand_total = gst_calc["grand_total"]

        for idx, doi in enumerate(order_items):
            line_tax_info = gst_calc["line_items"][idx]
            doi.tax_amount = (Decimal(str(line_tax_info["cgst_amount"])) + Decimal(str(line_tax_info["sgst_amount"])) + Decimal(str(line_tax_info["igst_amount"]))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            doi.line_total = doi.line_total + doi.tax_amount

        await session.commit()
        await session.refresh(order)
        return order

    @classmethod
    async def dispatch_distribution_order(
        cls,
        session: AsyncSession,
        order_id: str,
        delivery_challan_no: Optional[str] = None
    ) -> DistributionOrder:
        """
        Dispatches distribution order, assigns delivery challan, and records authoritative stock movement.
        """
        stmt = select(DistributionOrder).options(
            selectinload(DistributionOrder.lines)
        ).where(DistributionOrder.id == order_id)
        order = (await session.execute(stmt)).scalars().first()
        if not order:
            raise ValueError(f"Distribution order '{order_id}' not found.")

        order.status = "DISPATCHED"
        order.delivery_challan_no = delivery_challan_no or f"DC-{uuid.uuid4().hex[:8].upper()}"

        # Record authoritative Stock Movements (OUTWARD)
        for line in order.lines:
            item_stmt = select(Item).where(Item.id == line.item_id)
            item_obj = (await session.execute(item_stmt)).scalars().first()
            item_code = item_obj.item_code if item_obj else "ITEM"
            item_name = item_obj.item_name if item_obj else "Item Name"

            prod_stmt = select(Product).where((Product.id == line.item_id) | (Product.sku == item_code) | (Product.code == item_code))
            prod_obj = (await session.execute(prod_stmt)).scalars().first()
            if not prod_obj:
                prod_obj = Product(
                    id=line.item_id,
                    company_id=order.company_id,
                    code=item_code,
                    name=item_name,
                    sku=item_code,
                    barcode=item_code,
                    category=item_obj.category if item_obj else "GENERAL",
                    hsn_code=getattr(item_obj, "hsn_code", "5208") or "5208",
                    price=line.unit_price,
                    mrp=line.unit_price,
                    stock=0
                )
                session.add(prod_obj)
                await session.flush()

            mov = StockMovement(
                id=f"sm_{uuid.uuid4().hex[:12]}",
                company_id=order.company_id,
                movement_type="OUTWARD_SALE",
                reference_doc_type="DISTRIBUTION_ORDER",
                reference_doc_id=order.order_no,
                product_id=prod_obj.id,
                product_name=item_name,
                sku=item_code,
                quantity=line.quantity,
                unit_cost=line.unit_price,
                remarks=f"Distribution Dispatch for Order {order.order_no}",
                is_active=True,
                is_deleted=False,
            )
            session.add(mov)

        await session.commit()
        await session.refresh(order)
        return order

    # -----------------------------------------------------------------------
    # 4. Loading Sheet Workflow
    # -----------------------------------------------------------------------
    @classmethod
    async def create_loading_sheet(
        cls,
        session: AsyncSession,
        company_id: str,
        req: LoadingSheetCreateReq,
        user_id: Optional[str] = None,
    ) -> LoadingSheet:
        sheet_no = f"LS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        sheet_id = f"ls_{uuid.uuid4().hex[:12]}"

        # Fetch orders
        stmt_o = select(DistributionOrder).options(selectinload(DistributionOrder.lines)).where(
            DistributionOrder.company_id == company_id,
            DistributionOrder.id.in_(req.order_ids),
            DistributionOrder.is_deleted == False,
        )
        orders = (await session.execute(stmt_o)).scalars().all()
        if not orders:
            raise ValueError("No valid distribution orders found for loading sheet.")

        total_val = sum(o.grand_total for o in orders)
        sheet = LoadingSheet(
            id=sheet_id,
            company_id=company_id,
            sheet_no=sheet_no,
            route_id=req.route_id,
            vehicle_number=req.vehicle_number,
            driver_name=req.driver_name,
            dispatch_date=req.dispatch_date or date.today(),
            status="LOADED",
            total_orders_count=len(orders),
            total_boxes=len(orders) * 2,
            total_value=total_val,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(sheet)
        await session.flush()

        for o in orders:
            o.status = "LOADED"
            for line in o.lines:
                item_row = LoadingSheetItem(
                    id=f"lsi_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    loading_sheet_id=sheet.id,
                    order_id=o.id,
                    item_id=line.item_id,
                    loaded_quantity=line.quantity,
                    returned_quantity=Decimal("0.0000"),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(item_row)

        await session.commit()
        await session.refresh(sheet)
        return sheet

    # -----------------------------------------------------------------------
    # 5. Claims Management Workflow
    # -----------------------------------------------------------------------
    @classmethod
    async def submit_claim(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ClaimSubmitReq,
        user_id: Optional[str] = None,
    ) -> DistributionClaim:
        claim_no = f"CLM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        claim_id = f"clm_{uuid.uuid4().hex[:12]}"

        claim = DistributionClaim(
            id=claim_id,
            company_id=company_id,
            claim_no=claim_no,
            party_id=req.party_id,
            claim_type=req.claim_type.upper(),
            reference_order_no=req.reference_order_no,
            claim_amount=req.claim_amount,
            status="SUBMITTED",
            remarks=req.remarks,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(claim)
        await session.commit()
        await session.refresh(claim)
        return claim

    @classmethod
    async def review_claim(
        cls,
        session: AsyncSession,
        company_id: str,
        claim_id: str,
        req: ClaimReviewReq,
        user_id: Optional[str] = None,
    ) -> DistributionClaim:
        stmt = select(DistributionClaim).where(
            DistributionClaim.company_id == company_id,
            DistributionClaim.id == claim_id,
            DistributionClaim.is_deleted == False,
        )
        claim = (await session.execute(stmt)).scalars().first()
        if not claim:
            raise ValueError(f"Claim '{claim_id}' not found.")

        claim.status = req.status.upper()
        claim.approved_amount = req.approved_amount if req.status.upper() == "APPROVED" else Decimal("0.00")
        claim.reviewed_by = user_id
        if req.status.upper() == "APPROVED":
            claim.settlement_credit_note_id = f"CN-{uuid.uuid4().hex[:8].upper()}"
        if req.remarks:
            claim.remarks = f"{claim.remarks or ''} | Review: {req.remarks}"

        await session.commit()
        await session.refresh(claim)
        return claim

    # -----------------------------------------------------------------------
    # 6. Route Trip Settlement
    # -----------------------------------------------------------------------
    @classmethod
    async def settle_route_trip(
        cls,
        session: AsyncSession,
        company_id: str,
        req: SettlementCreateReq,
        user_id: Optional[str] = None,
    ) -> DistributionSettlement:
        settlement_no = f"SET-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        settle_id = f"stl_{uuid.uuid4().hex[:12]}"

        stmt_ls = select(LoadingSheet).where(
            LoadingSheet.company_id == company_id,
            LoadingSheet.id == req.loading_sheet_id,
            LoadingSheet.is_deleted == False,
        )
        ls = (await session.execute(stmt_ls)).scalars().first()
        if not ls:
            raise ValueError(f"Loading sheet '{req.loading_sheet_id}' not found.")

        total_collected = (
            req.cash_collected
            + req.cheques_collected
            + req.upi_collected
            + req.credit_extended
            + req.returned_stock_value
        )
        shortage_excess = total_collected - Decimal(str(ls.total_value))

        settlement = DistributionSettlement(
            id=settle_id,
            company_id=company_id,
            settlement_no=settlement_no,
            loading_sheet_id=ls.id,
            route_id=req.route_id or ls.route_id,
            driver_id=req.driver_id,
            salesman_id=req.salesman_id,
            total_sales_value=ls.total_value,
            cash_collected=req.cash_collected,
            cheques_collected=req.cheques_collected,
            upi_collected=req.upi_collected,
            credit_extended=req.credit_extended,
            returned_stock_value=req.returned_stock_value,
            shortage_excess_amount=shortage_excess,
            status="RECONCILED",
            settled_at=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(settlement)
        ls.status = "RECONCILED"

        await session.commit()
        await session.refresh(settlement)
        return settlement
