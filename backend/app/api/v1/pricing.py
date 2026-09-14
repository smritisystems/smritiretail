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

import traceback
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...api.deps import get_company_db, get_current_user
from ...models.pricing import PriceBook, CustomerPriceTier, PriceBookEntry, CustomerPriceAssignment, SalesFactor
from ...models.crm import Customer
from ...services.pricing_engine import PricingEngine
from ...schemas.pricing import (
    PriceBookCreateRequest,
    PriceBookResponse,
    PriceBookEntryCreateRequest,
    PriceBookEntryResponse,
    CustomerPriceTierCreateRequest,
    CustomerPriceTierResponse,
    CustomerPriceAssignmentCreateRequest,
    CustomerPriceAssignmentResponse,
    PricingResolutionRequest,
    PricingResolutionResponse,
    BulkPricingRequest,
    BulkPricingResponse,
    PricingSnapshot,
)
from ...schemas.sales_factor import (
    SalesFactorDTO,
    SalesFactorUpsertRequest,
    SalesFactorEvaluationRequest,
    SalesFactorEvaluationResponse,
    EvaluatedFactorItem,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


# ============================================================================
# PRICE BOOK MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/books", response_model=PriceBookResponse, status_code=status.HTTP_201_CREATED, summary="Create Price Book")
async def create_price_book(
    req: PriceBookCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a new Price Book header with date validity and currency configuration."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        pb = await PricingEngine.create_price_book(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return PriceBookResponse(
            id=pb.id,
            code=pb.code,
            name=pb.name,
            currency=pb.currency,
            is_default=pb.is_default,
            status=pb.status,
            valid_from=pb.valid_from,
            valid_to=pb.valid_to,
            description=pb.description,
            entries_count=0,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/books", response_model=List[PriceBookResponse], summary="List Price Books")
async def list_price_books(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists Price Books for the tenant."""
    stmt = select(PriceBook)
    if status_filter:
        stmt = stmt.where(PriceBook.status == status_filter.upper())
    books = (await db.execute(stmt)).scalars().all()

    res = []
    for b in books:
        res.append(
            PriceBookResponse(
                id=b.id,
                code=b.code,
                name=b.name,
                currency=b.currency,
                is_default=b.is_default,
                status=b.status,
                valid_from=b.valid_from,
                valid_to=b.valid_to,
                description=b.description,
            )
        )
    return res


@router.post("/books/{book_id}/entries", response_model=PriceBookEntryResponse, status_code=status.HTTP_201_CREATED, summary="Add Price Book Entry")
async def add_price_book_entry(
    book_id: str,
    req: PriceBookEntryCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Adds a volume break or item price point to a specified Price Book."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        entry = await PricingEngine.add_price_book_entry(
            session=db,
            company_id=company_id,
            price_book_id=book_id,
            req=req,
            created_by=user_id,
        )
        return PriceBookEntryResponse(
            id=entry.id,
            price_book_id=entry.price_book_id,
            item_id=entry.item_id,
            variant_id=entry.variant_id,
            min_quantity=float(entry.min_quantity),
            selling_price=float(entry.selling_price),
            mrp=float(entry.mrp),
            cost_price=float(entry.cost_price) if entry.cost_price is not None else None,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CUSTOMER PRICE TIER ENDPOINTS
# ============================================================================

@router.post("/tiers", response_model=CustomerPriceTierResponse, status_code=status.HTTP_201_CREATED, summary="Create Customer Price Tier")
async def create_customer_tier(
    req: CustomerPriceTierCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a Customer Price Tier with default percentage discount or Price Book link."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        tier = await PricingEngine.create_customer_tier(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return CustomerPriceTierResponse(
            id=tier.id,
            code=tier.code,
            name=tier.name,
            price_book_id=tier.price_book_id,
            discount_percentage=float(tier.discount_percentage),
            description=tier.description,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiers", response_model=List[CustomerPriceTierResponse], summary="List Customer Price Tiers")
async def list_customer_tiers(
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists all customer price tiers."""
    stmt = select(CustomerPriceTier)
    tiers = (await db.execute(stmt)).scalars().all()
    return [
        CustomerPriceTierResponse(
            id=t.id,
            code=t.code,
            name=t.name,
            price_book_id=t.price_book_id,
            discount_percentage=float(t.discount_percentage),
            description=t.description,
        )
        for t in tiers
    ]


@router.post("/customer-assignments", response_model=CustomerPriceAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_customer_price_tier(
    req: CustomerPriceAssignmentCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Create or replace the active price-tier assignment for a customer."""
    company_id, user_id = _extract_user_info(current_user)
    customer = (await db.execute(select(Customer).where(
        Customer.id == req.customer_id,
        Customer.company_id == company_id,
        Customer.is_deleted == False,
    ))).scalar_one_or_none()
    tier = (await db.execute(select(CustomerPriceTier).where(
        CustomerPriceTier.id == req.price_tier_id,
        CustomerPriceTier.company_id == company_id,
        CustomerPriceTier.is_deleted == False,
    ))).scalar_one_or_none()
    if not customer or not tier:
        raise HTTPException(status_code=404, detail="Customer or price tier not found for this company.")

    assignment = (await db.execute(select(CustomerPriceAssignment).where(
        CustomerPriceAssignment.customer_id == req.customer_id,
        CustomerPriceAssignment.is_deleted == False,
    ))).scalar_one_or_none()
    if assignment:
        assignment.price_tier_id = req.price_tier_id
        assignment.valid_from = req.valid_from
        assignment.valid_to = req.valid_to
        assignment.notes = req.notes
        assignment.status = "ACTIVE"
        assignment.modified_at = datetime.now(timezone.utc)
    else:
        assignment = CustomerPriceAssignment(
            id=f"cpa-{uuid.uuid4().hex[:10]}",
            customer_id=req.customer_id,
            price_tier_id=req.price_tier_id,
            valid_from=req.valid_from,
            valid_to=req.valid_to,
            notes=req.notes,
            status="ACTIVE",
            company_id=company_id,
            created_by=user_id,
        )
        db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


# ============================================================================
# PRICING RESOLUTION & SNAPSHOT ENDPOINTS
# ============================================================================

@router.post("/resolve", response_model=PricingResolutionResponse, summary="Resolve Effective Item Price")
async def resolve_pricing(
    req: PricingResolutionRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Calculates hierarchical price resolution for a single item."""
    try:
        res = await PricingEngine.calculate_effective_price(
            session=db,
            item_id=req.item_id,
            variant_id=req.variant_id,
            quantity=Decimal(str(req.quantity)),
            price_book_code=req.price_book_code,
            customer_tier_code=req.customer_tier_code,
            as_of_date=req.as_of_date,
        )
        return PricingResolutionResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resolve/bulk", response_model=BulkPricingResponse, summary="Resolve Bulk Cart/Order Pricing")
async def resolve_bulk_pricing(
    req: BulkPricingRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Calculates multi-line item prices and order subtotals."""
    try:
        return await PricingEngine.calculate_bulk_pricing(session=db, req=req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/snapshot", response_model=PricingSnapshot, summary="Generate Transaction Pricing Snapshot")
async def generate_pricing_snapshot(
    req: BulkPricingRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Generates an immutable pricing snapshot for storing in sales orders/invoices."""
    try:
        return await PricingEngine.generate_pricing_snapshot(session=db, req=req)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SALES FACTOR MASTER ENDPOINTS (Add-ons, Deductions, Price Factors, Round-Off)
# ============================================================================

@router.get("/sales-factors", response_model=List[SalesFactorDTO], summary="List Sales Factors")
async def list_sales_factors(
    is_active: Optional[bool] = Query(True),
    price_group_code: Optional[str] = Query(None),
    factor_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists catalogued sales factors with optional price group and factor type filters."""
    stmt = select(SalesFactor)
    if is_active is not None:
        stmt = stmt.where(SalesFactor.is_active == is_active)
    if factor_type:
        stmt = stmt.where(SalesFactor.factor_type == factor_type)
    if price_group_code:
        stmt = stmt.where(
            (SalesFactor.price_group_code == price_group_code)
            | (SalesFactor.factor_category == "ALL_CUSTOMERS")
        )
    factors = (await db.execute(stmt)).scalars().all()
    return [
        SalesFactorDTO(
            id=f.id,
            code=f.code,
            description=f.description,
            factor_type=f.factor_type,
            factor_category=f.factor_category,
            customer_id=f.customer_id,
            price_group_code=f.price_group_code,
            applicable_categories=f.applicable_categories or [],
            applicable_brands=f.applicable_brands or [],
            computation_timing=f.computation_timing,
            computed_on=f.computed_on,
            rate_or_amount=f.rate_or_amount,
            value=float(f.value or 0.0),
            is_variable=bool(f.is_variable),
            min_bill_value=float(f.min_bill_value) if f.min_bill_value else None,
            max_bill_value=float(f.max_bill_value) if f.max_bill_value else None,
            valid_from=f.valid_from,
            valid_to=f.valid_to,
            applicable_days=f.applicable_days or [],
            is_active=bool(f.is_active),
            created_at=f.created_at.isoformat() if hasattr(f, "created_at") and f.created_at else None,
            updated_at=f.updated_at.isoformat() if hasattr(f, "updated_at") and f.updated_at else None,
        )
        for f in factors
    ]


@router.post("/sales-factors", response_model=SalesFactorDTO, status_code=status.HTTP_201_CREATED, summary="Upsert Sales Factor")
async def upsert_sales_factor(
    req: SalesFactorUpsertRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates or updates a sales factor in PostgreSQL."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        factor = None
        if req.id:
            stmt = select(SalesFactor).where(SalesFactor.id == req.id)
            factor = (await db.execute(stmt)).scalars().first()
        if not factor:
            stmt = select(SalesFactor).where(SalesFactor.code == req.code)
            factor = (await db.execute(stmt)).scalars().first()

        val_dec = Decimal(str(req.value or 0.0))
        min_b = Decimal(str(req.min_bill_value)) if req.min_bill_value is not None else None
        max_b = Decimal(str(req.max_bill_value)) if req.max_bill_value is not None else None

        if not factor:
            factor_id = req.id or f"sf_{uuid.uuid4().hex[:12]}"
            factor = SalesFactor(
                id=factor_id,
                company_id=company_id,
                code=req.code,
                description=req.description,
                factor_type=req.factor_type,
                factor_category=req.factor_category,
                customer_id=req.customer_id,
                price_group_code=req.price_group_code,
                applicable_categories=req.applicable_categories,
                applicable_brands=req.applicable_brands,
                computation_timing=req.computation_timing,
                computed_on=req.computed_on,
                rate_or_amount=req.rate_or_amount,
                value=val_dec,
                is_variable=req.is_variable,
                min_bill_value=min_b,
                max_bill_value=max_b,
                valid_from=req.valid_from,
                valid_to=req.valid_to,
                applicable_days=req.applicable_days,
                is_active=req.is_active,
                created_by=user_id,
            )
            db.add(factor)
        else:
            factor.description = req.description
            factor.factor_type = req.factor_type
            factor.factor_category = req.factor_category
            factor.customer_id = req.customer_id
            factor.price_group_code = req.price_group_code
            factor.applicable_categories = req.applicable_categories
            factor.applicable_brands = req.applicable_brands
            factor.computation_timing = req.computation_timing
            factor.computed_on = req.computed_on
            factor.rate_or_amount = req.rate_or_amount
            factor.value = val_dec
            factor.is_variable = req.is_variable
            factor.min_bill_value = min_b
            factor.max_bill_value = max_b
            factor.valid_from = req.valid_from
            factor.valid_to = req.valid_to
            factor.applicable_days = req.applicable_days
            factor.is_active = req.is_active

        await db.commit()
        await db.refresh(factor)

        return SalesFactorDTO(
            id=factor.id,
            code=factor.code,
            description=factor.description,
            factor_type=factor.factor_type,
            factor_category=factor.factor_category,
            customer_id=factor.customer_id,
            price_group_code=factor.price_group_code,
            applicable_categories=factor.applicable_categories or [],
            applicable_brands=factor.applicable_brands or [],
            computation_timing=factor.computation_timing,
            computed_on=factor.computed_on,
            rate_or_amount=factor.rate_or_amount,
            value=float(factor.value or 0.0),
            is_variable=bool(factor.is_variable),
            min_bill_value=float(factor.min_bill_value) if factor.min_bill_value else None,
            max_bill_value=float(factor.max_bill_value) if factor.max_bill_value else None,
            valid_from=factor.valid_from,
            valid_to=factor.valid_to,
            applicable_days=factor.applicable_days or [],
            is_active=bool(factor.is_active),
            created_at=factor.created_at.isoformat() if hasattr(factor, "created_at") and factor.created_at else None,
            updated_at=factor.updated_at.isoformat() if hasattr(factor, "updated_at") and factor.updated_at else None,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sales-factors/{factor_id}", status_code=status.HTTP_200_OK, summary="Delete Sales Factor")
async def delete_sales_factor(
    factor_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Deactivates a sales factor in PostgreSQL."""
    try:
        stmt = select(SalesFactor).where(SalesFactor.id == factor_id)
        factor = (await db.execute(stmt)).scalars().first()
        if not factor:
            stmt = select(SalesFactor).where(SalesFactor.code == factor_id)
            factor = (await db.execute(stmt)).scalars().first()
        if not factor:
            raise HTTPException(status_code=404, detail="Sales factor not found.")

        factor.is_active = False
        await db.commit()
        return {"status": "SUCCESS", "success": True, "message": f"Sales factor {factor_id} deactivated."}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

