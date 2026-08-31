"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from ..models.payment_ledger import PaymentTransaction, PaymentAllocation
from ..models.numbering import DocumentSeries, NumberingAuditLog
from ..models.item_master import Item, ItemVariant
from ..models.inventory import Product
from ..models.crm import Customer


def _quantize(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class UnifiedPricingPaymentService:
    """
    Authoritative Pricing Resolution, Document Numbering, and Multi-Tender Payment Service.
    Enforces deterministic price book resolution, gapless locked document sequencing,
    and idempotent split-tender payment settlements.
    """

    # =========================================================================
    # 1. HIERARCHICAL PRICING RESOLUTION
    # =========================================================================
    @classmethod
    async def resolve_pricing(
        cls,
        session: AsyncSession,
        item_id: str,
        quantity: float = 1.0,
        variant_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        price_book_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resolves effective selling price and MRP through a 4-level deterministic hierarchy:
        1. Explicit Price Book Override
        2. Customer Segment / Tier Price Book
        3. Default Active Price Book
        4. Base Item / Product Master Catalog
        """
        qty = Decimal(str(quantity))
        resolved_pb_id = price_book_id

        # 1. Check Customer Tier if no explicit price book is requested
        if not resolved_pb_id and customer_id:
            cust_stmt = select(Customer).where(Customer.id == customer_id)
            cust = (await session.execute(cust_stmt)).scalar_one_or_none()
            if cust and getattr(cust, "price_group_id", None):
                # Map price group to tier
                tier_stmt = select(CustomerPriceTier).where(
                    CustomerPriceTier.id == cust.price_group_id,
                    CustomerPriceTier.is_active == True,
                    CustomerPriceTier.is_deleted == False
                )
                tier = (await session.execute(tier_stmt)).scalar_one_or_none()
                if tier and tier.price_book_id:
                    resolved_pb_id = tier.price_book_id

        # 2. Check Default Active Price Book if still unassigned
        if not resolved_pb_id:
            def_pb_stmt = select(PriceBook).where(
                PriceBook.is_default == True,
                PriceBook.status == "ACTIVE",
                PriceBook.is_deleted == False
            )
            def_pb = (await session.execute(def_pb_stmt)).scalar_one_or_none()
            if def_pb:
                resolved_pb_id = def_pb.id

        # 3. Lookup Price Book Entry with Volume Break (min_quantity <= qty)
        if resolved_pb_id:
            pbe_stmt = (
                select(PriceBookEntry)
                .where(
                    PriceBookEntry.price_book_id == resolved_pb_id,
                    PriceBookEntry.item_id == item_id,
                    PriceBookEntry.min_quantity <= qty,
                    PriceBookEntry.is_deleted == False
                )
                .order_by(desc(PriceBookEntry.min_quantity))
            )
            if variant_id:
                pbe_stmt = pbe_stmt.where(PriceBookEntry.variant_id == variant_id)

            pbe = (await session.execute(pbe_stmt)).scalars().first()
            if pbe:
                return {
                    "item_id": item_id,
                    "variant_id": variant_id,
                    "quantity": float(qty),
                    "selling_price": _quantize(pbe.selling_price),
                    "mrp": _quantize(pbe.mrp),
                    "cost_price": _quantize(pbe.cost_price or 0.00),
                    "discount_applied": Decimal("0.00"),
                    "pricing_source": f"PRICE_BOOK:{resolved_pb_id}",
                    "volume_break_min_qty": float(pbe.min_quantity)
                }

        # 4. Fallback to Item Master Catalog
        item_stmt = select(Item).where(Item.id == item_id, Item.is_deleted == False)
        item = (await session.execute(item_stmt)).scalar_one_or_none()
        if item:
            return {
                "item_id": item_id,
                "variant_id": variant_id,
                "quantity": float(qty),
                "selling_price": _quantize(item.selling_price),
                "mrp": _quantize(item.mrp),
                "cost_price": _quantize(item.cost_price or 0.00),
                "discount_applied": Decimal("0.00"),
                "pricing_source": "ITEM_MASTER",
                "volume_break_min_qty": 1.0
            }

        # 5. Fallback to Legacy Product Master
        prod_stmt = select(Product).where(Product.id == item_id, Product.is_deleted == False)
        prod = (await session.execute(prod_stmt)).scalar_one_or_none()
        if prod:
            return {
                "item_id": item_id,
                "variant_id": variant_id,
                "quantity": float(qty),
                "selling_price": _quantize(prod.price),
                "mrp": _quantize(prod.mrp or prod.price),
                "cost_price": _quantize(prod.cost_price or 0.00),
                "discount_applied": Decimal("0.00"),
                "pricing_source": "PRODUCT_MASTER",
                "volume_break_min_qty": 1.0
            }

        raise ValueError(f"Item/Product with ID '{item_id}' not found in master catalog.")

    # =========================================================================
    # 2. ATOMIC DOCUMENT NUMBERING SEQUENCE ENGINE
    # =========================================================================
    @classmethod
    async def allocate_document_number(
        cls,
        session: AsyncSession,
        company_id: str,
        document_type: str,
        financial_year: str = "2026-27",
        prefix: Optional[str] = None,
        branch_id: str = "BR-001",
        operator: str = "SYSTEM"
    ) -> str:
        """
        Allocates the next gapless, row-locked document number within the specified financial year,
        writing an immutable entry to numbering_audit_logs.
        """
        clean_doc_type = document_type.strip().upper()
        default_prefix = prefix or clean_doc_type[:3]

        # Row-lock document series
        stmt = (
            select(DocumentSeries)
            .where(
                DocumentSeries.document_type == clean_doc_type,
                DocumentSeries.financial_year == financial_year,
                DocumentSeries.is_deleted == False
            )
            .with_for_update()
        )
        series = (await session.execute(stmt)).scalar_one_or_none()

        if not series:
            series = DocumentSeries(
                id=f"seq_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                name=f"{clean_doc_type} Series {financial_year}",
                document_type=clean_doc_type,
                prefix=default_prefix,
                running_length=4,
                current_number=0,
                financial_year=financial_year,
                is_active=True,
                is_deleted=False
            )
            session.add(series)
            await session.flush()

        old_num = series.current_number
        series.current_number += 1
        new_num = series.current_number

        formatted_seq = str(new_num).zfill(series.running_length or 4)
        doc_no = f"{series.prefix}/{financial_year}/{formatted_seq}"

        # Write audit log
        audit = NumberingAuditLog(
            id=f"nal_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            series_id=series.id,
            series_name=series.name,
            action="ALLOCATE",
            document_no=doc_no,
            old_value=str(old_num),
            new_value=str(new_num),
            details=f"Allocated {clean_doc_type} number for FY {financial_year}",
            operator=operator,
            is_active=True,
            is_deleted=False
        )
        session.add(audit)
        await session.commit()

        return doc_no

    # =========================================================================
    # 3. IDEMPOTENT MULTI-TENDER PAYMENT SETTLEMENT
    # =========================================================================
    @classmethod
    async def record_payment_settlement(
        cls,
        session: AsyncSession,
        company_id: str,
        reference_doc_type: str,
        reference_doc_id: str,
        party_id: Optional[str],
        tenders: List[Dict[str, Any]],
        idempotency_key: str,
        branch_id: str = "BR-001"
    ) -> List[PaymentTransaction]:
        """
        Records multi-tender payment allocations atomically, guaranteeing idempotency
        to prevent duplicate charges or settlements.
        """
        clean_key = idempotency_key.strip()

        # Idempotency Check
        stmt = (
            select(PaymentTransaction)
            .where(
                or_(
                    PaymentTransaction.idempotency_key == clean_key,
                    PaymentTransaction.idempotency_key.like(f"{clean_key}_%")
                ),
                PaymentTransaction.is_deleted == False
            )
            .options(selectinload(PaymentTransaction.allocations))
        )
        existing = (await session.execute(stmt)).scalars().all()
        if existing:
            return list(existing)

        results: List[PaymentTransaction] = []

        for idx, tender in enumerate(tenders, start=1):
            tender_type = str(tender.get("tender_type", "CASH")).upper()
            amt = Decimal(str(tender.get("amount", 0.00)))
            gateway_ref = tender.get("gateway_reference")

            tx_id = f"pay_{uuid.uuid4().hex[:12]}"
            tx_no = f"PAY-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            sub_idempotency_key = f"{clean_key}_{idx}" if len(tenders) > 1 else clean_key

            tx = PaymentTransaction(
                id=tx_id,
                company_id=company_id,
                branch_id=branch_id,
                transaction_no=tx_no,
                reference_doc_type=reference_doc_type,
                reference_doc_id=reference_doc_id,
                party_id=party_id,
                tender_type=tender_type,
                amount=amt,
                currency="INR",
                idempotency_key=sub_idempotency_key,
                status="SUCCESS",
                gateway_reference=gateway_ref,
                is_active=True,
                is_deleted=False
            )
            session.add(tx)

            alloc = PaymentAllocation(
                id=f"pal_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                payment_id=tx_id,
                invoice_id=reference_doc_id,
                allocated_amount=amt,
                discount_allowed=Decimal("0.00"),
                is_active=True,
                is_deleted=False
            )
            session.add(alloc)
            results.append(tx)

        await session.commit()

        # Re-fetch with loaded allocations
        tx_ids = [t.id for t in results]
        refetch_stmt = (
            select(PaymentTransaction)
            .where(PaymentTransaction.id.in_(tx_ids))
            .options(selectinload(PaymentTransaction.allocations))
        )
        return list((await session.execute(refetch_stmt)).scalars().all())
