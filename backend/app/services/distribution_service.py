"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.distribution import (
    DistributionTerritory,
    DealerAssignment,
    DistributionOrder,
    DistributionOrderItem,
)
from ..models.party import Party, PartyRole
from ..models.item_master import Item, ItemVariant
from ..models.inventory import Product, StockMovement
from ..services.pricing_engine import PricingEngine
from ..services.governed_rule_engine import GovernedRuleEngine
from ..services.transaction_reproducibility_service import TransactionReproducibilityService


class DistributionService:
    """
    Distribution Engine Service (Section 8).
    Handles Primary/Secondary distribution orders, dealer territorial assignments,
    stock movement dispatching, and governance snapshot recording.
    """

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
            status="ACTIVE"
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
        credit_limit: Decimal = Decimal("500000.00"),
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
                is_active=True
            )
            session.add(assignment)
        else:
            assignment.salesman_id = salesman_id
            assignment.credit_limit = credit_limit
            assignment.credit_days = credit_days
            assignment.is_active = True

        await session.flush()
        return assignment

    @classmethod
    async def create_distribution_order(
        cls,
        session: AsyncSession,
        party_id: str,
        order_type: str = "PRIMARY",
        territory_code: Optional[str] = None,
        salesman_id: Optional[str] = None,
        delivery_route: Optional[str] = None,
        line_items_data: Optional[List[Dict[str, Any]]] = None,
        supplier_state: str = "27",
        recipient_state: str = "27",
        price_book_code: Optional[str] = None
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
            order_no=order_no,
            party_id=party.id,
            order_type=order_type,
            status="DRAFT",
            territory_code=territory_code,
            salesman_id=salesman_id,
            delivery_route=delivery_route,
            governance_snapshot_id=snapshot["snapshot_id"],
            rule_snapshots=snapshot
        )
        session.add(order)
        await session.flush()

        # 3. Calculate line items with PricingEngine
        taxable_total = Decimal("0.00")
        tax_total = Decimal("0.00")
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
                order_id=order.id,
                item_id=item_id,
                variant_id=variant_id,
                quantity=qty,
                unit_price=unit_price,
                discount_amount=Decimal("0.00"),
                tax_rate=tax_rate,
                tax_amount=Decimal("0.00"),  # populated by GST policy below
                line_total=line_subtotal
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

        # Populate individual line tax amounts
        for idx, doi in enumerate(order_items):
            line_tax_info = gst_calc["line_items"][idx]
            doi.tax_amount = (Decimal(str(line_tax_info["cgst_amount"])) + Decimal(str(line_tax_info["sgst_amount"])) + Decimal(str(line_tax_info["igst_amount"]))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            doi.line_total = doi.line_total + doi.tax_amount

        await session.flush()
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

            # Find matching product or create stub product for stock tracking
            prod_stmt = select(Product).where((Product.id == line.item_id) | (Product.sku == item_code) | (Product.code == item_code))
            prod_obj = (await session.execute(prod_stmt)).scalars().first()
            if not prod_obj:
                prod_obj = Product(
                    id=line.item_id,
                    code=item_code,
                    name=item_name,
                    sku=item_code,
                    barcode=item_code,
                    category=item_obj.category if item_obj else "GENERAL",
                    price=line.unit_price,
                    mrp=line.unit_price,
                    stock=0
                )
                session.add(prod_obj)
                await session.flush()

            mov = StockMovement(
                id=f"sm_{uuid.uuid4().hex[:12]}",
                movement_type="OUTWARD_SALE",
                reference_doc_type="DISTRIBUTION_ORDER",
                reference_doc_id=order.order_no,
                product_id=prod_obj.id,
                product_name=item_name,
                sku=item_code,
                quantity=line.quantity,
                unit_cost=line.unit_price,
                remarks=f"Distribution Dispatch for Order {order.order_no}"
            )
            session.add(mov)

        await session.flush()
        return order
