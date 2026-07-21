"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.9.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.purchase import (
    ProcurementRFQ, ProcurementRFQItem, ProcurementRFQVendor,
    VendorQuotation, VendorQuotationItem, Supplier
)
from app.schemas.purchase import (
    RFQCreate, RFQResponse,
    VendorQuotationCreate, VendorQuotationResponse,
    QuotationAwardRequest, QuotationEvaluationResponse
)
from app.procurement.engine.matrix_builder import MatrixBuilder
from app.procurement.engine.evaluation_engine import EvaluationEngine
from app.procurement.engine.ranking_engine import RankingEngine
from app.procurement.engine.award_engine import AwardEngine

router = APIRouter(prefix="/purchase/rfqs", tags=["Procurement RFQ & Bidding"])


@router.post("", response_model=RFQResponse, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    rfq_in: RFQCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a new Request for Quotation (RFQ) aggregate with items and invited vendors.
    """
    rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"
    rfq_code = f"RFQ-2026-{uuid.uuid4().hex[:4].upper()}"

    rfq_obj = ProcurementRFQ(
        id=rfq_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        rfq_code=rfq_code,
        title=rfq_in.title,
        description=rfq_in.description,
        submission_deadline=rfq_in.submission_deadline,
        evaluation_profile=rfq_in.evaluation_profile,
        status="Draft"
    )
    db.add(rfq_obj)

    # Add RFQ items
    for item in rfq_in.items:
        rfq_item = ProcurementRFQItem(
            id=f"rfqi-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            rfq_id=rfq_id,
            product_id=item.product_id,
            required_quantity=item.required_quantity,
            target_unit_price=item.target_unit_price,
            target_delivery_date=item.target_delivery_date
        )
        db.add(rfq_item)

    # Add Invited Vendors
    for supplier_id in rfq_in.invited_vendors:
        # Validate supplier
        sup_stmt = select(Supplier).where(Supplier.id == supplier_id)
        sup = (await db.execute(sup_stmt)).scalars().first()
        if not sup:
            raise HTTPException(status_code=404, detail=f"Invited vendor '{supplier_id}' not found")

        rfq_vendor = ProcurementRFQVendor(
            id=f"rfqv-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            rfq_id=rfq_id,
            supplier_id=supplier_id,
            invitation_status="Invited",
            invited_at=datetime.now(timezone.utc)
        )
        db.add(rfq_vendor)

    await db.commit()
    await db.refresh(rfq_obj)

    # Eager fetch items and vendors for serialization
    items_stmt = select(ProcurementRFQItem).where(ProcurementRFQItem.rfq_id == rfq_id)
    rfq_obj.items = list((await db.execute(items_stmt)).scalars().all())

    vendors_stmt = select(ProcurementRFQVendor).where(ProcurementRFQVendor.rfq_id == rfq_id)
    rfq_obj.invited_vendors = list((await db.execute(vendors_stmt)).scalars().all())

    return rfq_obj


@router.get("", response_model=List[RFQResponse])
async def list_rfqs(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all RFQs in the tenant's context.
    """
    stmt = select(ProcurementRFQ).where(
        ProcurementRFQ.company_id == tenant.company_id,
        ProcurementRFQ.is_deleted == False
    )
    rfqs = list((await db.execute(stmt)).scalars().all())
    for r in rfqs:
        it_stmt = select(ProcurementRFQItem).where(ProcurementRFQItem.rfq_id == r.id)
        r.items = list((await db.execute(it_stmt)).scalars().all())

        vn_stmt = select(ProcurementRFQVendor).where(ProcurementRFQVendor.rfq_id == r.id)
        r.invited_vendors = list((await db.execute(vn_stmt)).scalars().all())

    return rfqs


@router.get("/{rfq_id}", response_model=RFQResponse)
async def get_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves an RFQ by ID.
    """
    stmt = select(ProcurementRFQ).where(
        ProcurementRFQ.id == rfq_id,
        ProcurementRFQ.company_id == tenant.company_id,
        ProcurementRFQ.is_deleted == False
    )
    rfq = (await db.execute(stmt)).scalars().first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    it_stmt = select(ProcurementRFQItem).where(ProcurementRFQItem.rfq_id == rfq.id)
    rfq.items = list((await db.execute(it_stmt)).scalars().all())

    vn_stmt = select(ProcurementRFQVendor).where(ProcurementRFQVendor.rfq_id == rfq.id)
    rfq.invited_vendors = list((await db.execute(vn_stmt)).scalars().all())

    return rfq


@router.post("/{rfq_id}/publish", response_model=RFQResponse)
async def publish_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Publishes the RFQ, moving its status to Bidding Open.
    """
    stmt = select(ProcurementRFQ).where(
        ProcurementRFQ.id == rfq_id,
        ProcurementRFQ.company_id == tenant.company_id,
        ProcurementRFQ.is_deleted == False
    )
    rfq = (await db.execute(stmt)).scalars().first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    rfq.status = "Bidding Open"
    db.add(rfq)
    await db.commit()
    await db.refresh(rfq)

    it_stmt = select(ProcurementRFQItem).where(ProcurementRFQItem.rfq_id == rfq.id)
    rfq.items = list((await db.execute(it_stmt)).scalars().all())

    vn_stmt = select(ProcurementRFQVendor).where(ProcurementRFQVendor.rfq_id == rfq.id)
    rfq.invited_vendors = list((await db.execute(vn_stmt)).scalars().all())

    return rfq


@router.post("/{rfq_id}/quotations", response_model=VendorQuotationResponse, status_code=status.HTTP_201_CREATED)
async def submit_quotation(
    rfq_id: str,
    quote_in: VendorQuotationCreate,
    supplier_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Submits a vendor quotation for the RFQ.
    If a quotation already exists for the vendor on this RFQ, it amends it (version increment v1 -> v2)
    and archives/revises the previous quotation.
    """
    rfq_stmt = select(ProcurementRFQ).where(
        ProcurementRFQ.id == rfq_id,
        ProcurementRFQ.company_id == tenant.company_id,
        ProcurementRFQ.is_deleted == False
    )
    rfq = (await db.execute(rfq_stmt)).scalars().first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if rfq.status not in ["Published", "Bidding Open"]:
        raise HTTPException(status_code=400, detail=f"Cannot submit quotation when RFQ status is '{rfq.status}'")

    # Check for existing quote by same supplier on same RFQ
    exist_stmt = select(VendorQuotation).where(
        VendorQuotation.rfq_id == rfq_id,
        VendorQuotation.supplier_id == supplier_id,
        VendorQuotation.status == "Submitted",
        VendorQuotation.is_deleted == False
    )
    old_quote = (await db.execute(exist_stmt)).scalars().first()

    version_number = 1
    parent_id = None
    if old_quote:
        old_quote.status = "Revised"
        db.add(old_quote)
        version_number = old_quote.version_number + 1
        parent_id = old_quote.id

    quote_id = f"vq-{uuid.uuid4().hex[:12]}"
    total_val = Decimal("0.00")

    # Construct items first to sum total value
    item_objs = []
    for item in quote_in.items:
        qty = Decimal(str(item.offered_quantity))
        price = Decimal(str(item.offered_unit_price))
        disc = Decimal(str(item.discount_percentage))
        net_price = price * (Decimal("1.00") - disc / Decimal("100.00"))
        line_tot = net_price * qty
        total_val += line_tot

        vqi = VendorQuotationItem(
            id=f"vqi-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            quotation_id=quote_id,
            product_id=item.product_id,
            offered_quantity=qty,
            offered_unit_price=price,
            discount_percentage=disc,
            net_unit_price=net_price.quantize(Decimal("0.01")),
            line_total=line_tot.quantize(Decimal("0.01"))
        )
        item_objs.append(vqi)

    quote_obj = VendorQuotation(
        id=quote_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        rfq_id=rfq_id,
        supplier_id=supplier_id,
        quotation_code=quote_in.quotation_code,
        version_number=version_number,
        parent_quotation_id=parent_id,
        currency_id=quote_in.currency_id,
        offered_lead_time_days=quote_in.offered_lead_time_days,
        payment_terms=quote_in.payment_terms,
        quote_validity_date=quote_in.quote_validity_date,
        total_quote_value=total_val.quantize(Decimal("0.01")),
        status="Submitted"
    )
    db.add(quote_obj)
    db.add_all(item_objs)

    await db.commit()
    await db.refresh(quote_obj)
    quote_obj.items = item_objs
    return quote_obj


@router.get("/{rfq_id}/compare", response_model=Dict[str, Any])
async def compare_rfq_quotations(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Generates the structured multi-vendor comparison matrix.
    If the RFQ is still open/unevaluated, it computes scoring and ranking dynamically.
    """
    # 1. Fetch RFQ
    rfq_stmt = select(ProcurementRFQ).where(
        ProcurementRFQ.id == rfq_id,
        ProcurementRFQ.company_id == tenant.company_id,
        ProcurementRFQ.is_deleted == False
    )
    rfq = (await db.execute(rfq_stmt)).scalars().first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    # 2. Fetch all submitted quotes
    quote_stmt = select(VendorQuotation).where(
        VendorQuotation.rfq_id == rfq_id,
        VendorQuotation.status.in_(["Submitted", "Evaluated", "Awarded"]),
        VendorQuotation.is_deleted == False
    )
    quotes = list((await db.execute(quote_stmt)).scalars().all())

    # 3. Dynamic evaluation and ranking if not awarded
    if rfq.status != "Awarded" and quotes:
        quotes_data = []
        for q in quotes:
            sup_stmt = select(Supplier).where(Supplier.id == q.supplier_id)
            sup = (await db.execute(sup_stmt)).scalars().first()
            # Fetch rating or default to 80
            rating = 80.0
            if sup and sup.custom_attributes:
                rating = float(sup.custom_attributes.get("rating", 80.0))

            quotes_data.append({
                "quote_id": q.id,
                "total_value": float(q.total_quote_value),
                "lead_time_days": q.offered_lead_time_days,
                "vendor_rating": rating,
                "quote_obj": q
            })

        # Score quotes
        EvaluationEngine.evaluate_quotes(quotes_data, profile_name=rfq.evaluation_profile)

        # Apply computed scores back to ORM objects
        for qd in quotes_data:
            qd["quote_obj"].score = Decimal(str(qd["score"]))
            qd["quote_obj"].status = "Evaluated"

        # Rank quotes
        ranking_engine = RankingEngine(db, tenant)
        await ranking_engine.rank_quotations(quotes)
        await db.commit()

    # 4. Build Matrix response
    matrix_builder = MatrixBuilder(db, tenant)
    return await matrix_builder.build_matrix(rfq_id)


@router.post("/{rfq_id}/award", response_model=QuotationEvaluationResponse)
async def award_rfq(
    rfq_id: str,
    award_req: QuotationAwardRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Awards an RFQ to a winning quotation.
    Executes conversion strategy (Purchase Order or Vendor Contract) and snapshots evaluation matrix.
    """
    award_engine = AwardEngine(db, tenant)
    return await award_engine.award_rfq(
        rfq_id=rfq_id,
        quotation_id=award_req.quotation_id,
        awarded_by=award_req.awarded_by,
        award_notes=award_req.award_notes,
        convert_to=award_req.convert_to
    )
