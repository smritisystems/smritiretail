"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-11
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional, Tuple
from sqlalchemy import cast, func, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.inventory import Product
from .base import BaseRepository
from ..api.deps import TenantContext


class ProductRepository(BaseRepository[Product]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Product, db, tenant_ctx)

    async def get_by_barcode(self, barcode: str) -> Optional[Product]:
        """
        Fetch product details matching barcode.
        """
        stmt = select(Product).filter(Product.barcode == barcode, Product.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(
        self, q: Optional[str] = None, category: Optional[str] = None,
        skip: int = 0, limit: int = 50
    ) -> List[Product]:
        """
        Search products with optional query on name/code/barcode/attributes and category match.
        """
        stmt = select(Product).filter(Product.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        if q:
            stmt = stmt.filter(
                (Product.name.ilike(f"%{q}%")) |
                (Product.code.ilike(f"%{q}%")) |
                (Product.barcode.ilike(f"%{q}%")) |
                (cast(Product.attributes, String).ilike(f"%{q}%"))
            )
        if category:
            stmt = stmt.filter(Product.category == category)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 25,
        q: Optional[str] = None,
        category: Optional[str] = None,
        sort: str = "name",
        order: str = "asc"
    ) -> Tuple[List[Product], int]:
        """
        Server-side paginated product query with deterministic sorting, search, category filter, and tenant isolation.
        """
        base_stmt = select(Product).filter(Product.is_deleted == False)
        base_stmt = self._apply_tenant_filter(base_stmt)

        # Apply search query across real DB columns
        if q and q.strip():
            term = f"%{q.strip()}%"
            base_stmt = base_stmt.filter(
                (Product.name.ilike(term)) |
                (Product.code.ilike(term)) |
                (Product.barcode.ilike(term)) |
                (Product.sku.ilike(term)) |
                (Product.brand.ilike(term)) |
                (Product.category.ilike(term))
            )

        # Apply category filter
        if category and category.strip() and category != "ALL":
            base_stmt = base_stmt.filter(Product.category == category.strip())

        # Count total matching records before pagination
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        count_res = await self.db.execute(count_stmt)
        total = count_res.scalar() or 0

        # Sort allowlist to prevent SQL injection and unsafe orderings
        SORT_COLUMNS = {
            "name": Product.name,
            "code": Product.code,
            "price": Product.price,
            "stock": Product.stock,
            "category": Product.category,
            "barcode": Product.barcode,
            "sku": Product.sku,
            "created_at": Product.created_at,
            "modified_at": Product.modified_at,
        }

        sort_key = sort.lower().strip() if sort else "name"
        sort_col = SORT_COLUMNS.get(sort_key, Product.name)
        direction = order.lower().strip() if order else "asc"

        if direction == "desc":
            order_expr = sort_col.desc()
        else:
            order_expr = sort_col.asc()

        # Deterministic secondary sort on primary key id
        query_stmt = base_stmt.order_by(order_expr, Product.id.asc())

        # Offset / limit
        skip = (page - 1) * page_size
        query_stmt = query_stmt.offset(skip).limit(page_size)

        res = await self.db.execute(query_stmt)
        items = list(res.scalars().all())

        return items, total
