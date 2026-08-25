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
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...api.deps import get_company_db, get_current_user
from ...models.pricing import PriceBook, CustomerPriceTier, PriceBookEntry
from ...services.pricing_engine import PricingEngine
from ...schemas.pricing import (
    PriceBookCreateRequest,
    PriceBookResponse,
    PriceBookEntryCreateRequest,
    PriceBookEntryResponse,
    CustomerPriceTierCreateRequest,
    CustomerPriceTierResponse,
    PricingResolutionRequest,
    PricingResolutionResponse,
    BulkPricingRequest,
    BulkPricingResponse,
    PricingSnapshot,
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
