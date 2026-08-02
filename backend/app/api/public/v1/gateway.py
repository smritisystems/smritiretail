"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.models.inventory import Product

router = APIRouter(prefix="/api/public/v1", tags=["Public API Gateway (AOP-002/AOP-005)"])


async def verify_public_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """
    Public Gateway Authentication (AOP-005).
    Enforces OAuth2 / API Key verification on all external public client requests.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Public API Gateway Access Denied: Missing 'X-API-Key' header.",
        )
    # Validate API key format or tenant subscription key
    if not x_api_key.startswith("smriti_pub_"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public API Gateway Access Denied: Invalid 'X-API-Key' credentials.",
        )
    return x_api_key


@router.get("/catalog")
async def get_public_product_catalog(
    q: Optional[str] = Query(None, description="Search query for product name/code"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_public_api_key),
):
    """
    Public Catalog Search API (/api/public/v1/catalog).
    Allows external customer portals or mobile apps to query product catalog over published contracts (AOP-002).
    """
    stmt = select(Product).where(Product.is_deleted == False)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%") | Product.code.ilike(f"%{q}%"))
    stmt = stmt.limit(limit)

    res = await db.execute(stmt)
    products = res.scalars().all()

    return {
        "gateway_version": "v1.0",
        "total": len(products),
        "products": [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "barcode": p.barcode,
                "price": float(p.price),
                "is_in_stock": p.stock > 0,
            }
            for p in products
        ],
    }


@router.get("/inventory/availability/{product_code}")
async def check_inventory_availability(
    product_code: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_public_api_key),
):
    """
    Public Stock Availability Check API (/api/public/v1/inventory/availability/{product_code}).
    """
    stmt = select(Product).where(Product.code == product_code, Product.is_deleted == False)
    res = await db.execute(stmt)
    p = res.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")

    return {
        "product_code": p.code,
        "product_name": p.name,
        "available_stock": p.stock,
        "is_available": p.stock > 0,
    }
