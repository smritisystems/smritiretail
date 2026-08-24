"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.inventory import Product
from .outbox_service import OutboxService


class EcomInventoryReservationService:
    """
    Authoritative E-Commerce Inventory Reservation Service.
    Enforces strongly consistent inventory reservation directly inside Smritibus_<CompanyCode>
    to eliminate overselling risk before online order confirmation.
    """

    @classmethod
    async def reserve_stock_for_ecom_order(
        cls,
        session: AsyncSession,
        sku: str,
        quantity: Decimal,
        ecom_order_id: str,
        correlation_id: str
    ) -> Dict[str, Any]:
        """
        Transactionally reserves stock in Smritibus_<CompanyCode>.
        Atomic Flow:
          1. Locks product row for update.
          2. Checks available stock (quantity_on_hand - reserved_stock).
          3. Increments reserved_stock in Smritibus_<CC>.
          4. Emits Transactional Outbox Event for E-commerce state sync.
        """
        stmt = select(Product).where(Product.sku == sku).with_for_update()
        result = await session.execute(stmt)
        product = result.scalar_one_or_none()

        if not product:
            return {
                "success": False,
                "error": f"SKU '{sku}' not found in business inventory.",
                "reserved_qty": Decimal("0.0000")
            }

        available = Decimal(str(getattr(product, "stock", 0) or 0)) - Decimal(str(getattr(product, "reserved_stock", 0) or 0))

        if available < quantity:
            return {
                "success": False,
                "error": f"Insufficient stock for SKU '{sku}'. Available: {available}, Requested: {quantity}.",
                "reserved_qty": Decimal("0.0000")
            }

        # Authoritative reservation update in Smritibus_<CompanyCode>
        current_reserved = Decimal(str(getattr(product, "reserved_stock", 0) or 0))
        product.reserved_stock = current_reserved + quantity

        # Record outbox event atomically within same transaction
        await OutboxService.record_event(
            session=session,
            target_channel="ECOM_QUEUE",
            payload={
                "action": "INVENTORY_RESERVED",
                "ecom_order_id": ecom_order_id,
                "sku": sku,
                "reserved_qty": str(quantity),
                "remaining_available": str(available - quantity)
            },
            correlation_id=correlation_id,
            causation_id=ecom_order_id
        )

        return {
            "success": True,
            "product_id": product.id,
            "sku": sku,
            "reserved_qty": Decimal(str(quantity)),
            "message": f"Successfully reserved {quantity} units for order '{ecom_order_id}'."
        }
