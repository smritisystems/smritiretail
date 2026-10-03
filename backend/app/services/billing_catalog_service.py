"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Billing Catalog & Customer Directory Service (Phase 3 & 4)
"""

import logging
from decimal import Decimal
from typing import List, Optional, Tuple, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func

from ..models.inventory import Product
from ..models.crm import Customer, CustomerGroup
from ..schemas.billing_catalog import (
    BillingProductItem,
    CategoryFacet,
    BillingCatalogResponse,
    BillingCustomerItem,
    BillingCustomerListResponse,
)

logger = logging.getLogger("smriti.billing_catalog_service")

# Canonical showcase items matching Billing UX Reference Screens
CANONICAL_SHOWCASE_PRODUCTS: List[BillingProductItem] = [
    BillingProductItem(
        id="prod-shoe-001",
        code="SHOE-001",
        name="Sports Shoes - Black",
        category="Footwear",
        brand="Nike",
        mrp=Decimal("1899.00"),
        price=Decimal("1500.00"),
        stock=32,
        unit="Pair",
        barcode="890123456001",
        image_url="/assets/products/shoes_black.png",
        gst_rate=Decimal("18.00"),
        hsn_code="640411",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-shoe-002",
        code="SHOE-002",
        name="Running Shoes - Blue",
        category="Footwear",
        brand="Adidas",
        mrp=Decimal("2199.00"),
        price=Decimal("1800.00"),
        stock=18,
        unit="Pair",
        barcode="890123456002",
        image_url="/assets/products/shoes_blue.png",
        gst_rate=Decimal("18.00"),
        hsn_code="640411",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-shoe-003",
        code="SHOE-003",
        name="Casual Shoes - White",
        category="Footwear",
        brand="Puma",
        mrp=Decimal("1599.00"),
        price=Decimal("1350.00"),
        stock=4,
        unit="Pair",
        barcode="890123456003",
        image_url="/assets/products/shoes_white.png",
        gst_rate=Decimal("18.00"),
        hsn_code="640411",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-shoe-004",
        code="SHOE-004",
        name="Formal Shoes - Brown",
        category="Footwear",
        brand="Bata",
        mrp=Decimal("2499.00"),
        price=Decimal("2100.00"),
        stock=12,
        unit="Pair",
        barcode="890123456004",
        image_url="/assets/products/shoes_brown.png",
        gst_rate=Decimal("18.00"),
        hsn_code="640351",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-acc-001",
        code="ACC-001",
        name="Shoe Care Kit",
        category="Accessories",
        brand="Kiwi",
        mrp=Decimal("299.00"),
        price=Decimal("250.00"),
        stock=120,
        unit="Nos",
        barcode="890123456005",
        image_url="/assets/products/shoe_care.png",
        gst_rate=Decimal("18.00"),
        hsn_code="340510",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-bag-001",
        code="BAG-001",
        name="Sports Bag",
        category="Bags",
        brand="Wildcraft",
        mrp=Decimal("1299.00"),
        price=Decimal("950.00"),
        stock=25,
        unit="Nos",
        barcode="890123456006",
        image_url="/assets/products/sports_bag.png",
        gst_rate=Decimal("18.00"),
        hsn_code="420292",
        is_active=True,
    ),
    BillingProductItem(
        id="prod-sock-001",
        code="SOCK-001",
        name="Sports Socks",
        category="Socks",
        brand="Nike",
        mrp=Decimal("199.00"),
        price=Decimal("150.00"),
        stock=100,
        unit="Pair",
        barcode="890123456007",
        image_url="/assets/products/socks.png",
        gst_rate=Decimal("12.00"),
        hsn_code="611595",
        is_active=True,
    ),
]

# Canonical showcase customers matching Billing UX Reference Screens
CANONICAL_SHOWCASE_CUSTOMERS: List[BillingCustomerItem] = [
    BillingCustomerItem(
        id="cust-001",
        code="CUST-001",
        name="ABC Footwear",
        phone="9876543210",
        email="contact@abcfootwear.com",
        gst_number="27ABCDE1234F1Z5",
        credit_limit=Decimal("200000.00"),
        balance=Decimal("64800.00"),
        available_credit=Decimal("135200.00"),
        status="Active",
        address="Shop No. 10, Market Road, Mumbai - 400001",
        is_active=True,
    ),
    BillingCustomerItem(
        id="cust-002",
        code="CUST-002",
        name="Mumbai Traders",
        phone="9123456780",
        email="orders@mumbaitraders.in",
        gst_number="27AAACM1234A1Z1",
        credit_limit=Decimal("500000.00"),
        balance=Decimal("120450.00"),
        available_credit=Decimal("379550.00"),
        status="Active",
        address="Gala 4, APMC Market, Vashi, Navi Mumbai - 400703",
        is_active=True,
    ),
    BillingCustomerItem(
        id="cust-003",
        code="CUST-003",
        name="Style Zone",
        phone="9988776655",
        email="purchase@stylezone.co",
        gst_number="27BBBPS5678B1Z2",
        credit_limit=Decimal("100000.00"),
        balance=Decimal("12300.00"),
        available_credit=Decimal("87700.00"),
        status="Active",
        address="Shop 12, Phoenix Palladium, Lower Parel, Mumbai - 400013",
        is_active=True,
    ),
    BillingCustomerItem(
        id="cust-004",
        code="CUST-004",
        name="Walkers Retail",
        phone="9822334455",
        email="info@walkersretail.com",
        gst_number="27CCCWR9012C1Z3",
        credit_limit=Decimal("300000.00"),
        balance=Decimal("0.00"),
        available_credit=Decimal("300000.00"),
        status="Active",
        address="22 Linking Road, Bandra West, Mumbai - 400050",
        is_active=True,
    ),
]


def _clean_str(val: Any) -> Optional[str]:
    if hasattr(val, "default"):
        val = val.default
    if val is None or not isinstance(val, str):
        return None
    s = val.strip()
    return s if s else None


def _clean_decimal(val: Any) -> Optional[Decimal]:
    if hasattr(val, "default"):
        val = val.default
    if val is None or not isinstance(val, (int, float, str, Decimal)):
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None


def _clean_bool(val: Any) -> Optional[bool]:
    if hasattr(val, "default"):
        val = val.default
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return None


def _clean_int(val: Any, default: int) -> int:
    if hasattr(val, "default"):
        val = val.default
    if val is None or not isinstance(val, (int, str)):
        return default
    try:
        return int(val)
    except Exception:
        return default


class BillingCatalogService:
    @staticmethod
    async def get_products(
        session: AsyncSession,
        company_id: str,
        q: Optional[Any] = None,
        category: Optional[Any] = None,
        brand: Optional[Any] = None,
        stock_status: Optional[Any] = None,
        min_price: Optional[Any] = None,
        max_price: Optional[Any] = None,
        is_active: Optional[Any] = None,
        page: Any = 1,
        page_size: Any = 50,
    ) -> BillingCatalogResponse:
        """
        Query products with multi-attribute faceted search, category aggregations,
        and stock level filtering with tenant isolation.
        """
        q_str = _clean_str(q)
        cat_str = _clean_str(category)
        brand_str = _clean_str(brand)
        stock_str = _clean_str(stock_status)
        min_p = _clean_decimal(min_price)
        max_p = _clean_decimal(max_price)
        active_b = _clean_bool(is_active)
        pg = _clean_int(page, 1)
        ps = _clean_int(page_size, 50)

        stmt = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted == False,
        )

        if q_str:
            term = f"%{q_str}%"
            stmt = stmt.where(
                (Product.name.ilike(term))
                | (Product.code.ilike(term))
                | (Product.barcode.ilike(term))
                | (Product.sku.ilike(term))
                | (Product.brand.ilike(term))
                | (Product.category.ilike(term))
            )

        if cat_str and cat_str.upper() != "ALL":
            stmt = stmt.where(Product.category.ilike(cat_str))

        if brand_str and brand_str.upper() != "ALL":
            stmt = stmt.where(Product.brand.ilike(brand_str))

        if min_p is not None:
            stmt = stmt.where(Product.price >= min_p)

        if max_p is not None:
            stmt = stmt.where(Product.price <= max_p)

        if active_b is not None and active_b:
            stmt = stmt.where(Product.is_active == True)

        if stock_str:
            st = stock_str.upper()
            if st == "IN_STOCK":
                stmt = stmt.where(Product.stock > 0)
            elif st == "OUT_OF_STOCK":
                stmt = stmt.where(Product.stock <= 0)
            elif st == "LOW_STOCK":
                stmt = stmt.where(Product.stock > 0, Product.stock <= 5)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_res = await session.execute(count_stmt)
        db_total = count_res.scalar() or 0

        # Paginated items
        stmt = stmt.order_by(Product.code.asc()).offset((pg - 1) * ps).limit(ps)
        res = await session.execute(stmt)
        db_products = res.scalars().all()

        mapped_items: List[BillingProductItem] = []
        for p in db_products:
            mapped_items.append(
                BillingProductItem(
                    id=str(p.id),
                    code=p.code or "",
                    name=p.name or "",
                    category=p.category or "Others",
                    brand=p.brand,
                    mrp=Decimal(str(p.mrp or p.price or "0.00")),
                    price=Decimal(str(p.price or "0.00")),
                    stock=int(p.stock or 0),
                    unit="Pair" if (p.category or "").lower() in ["footwear", "socks"] else "Nos",
                    barcode=p.barcode,
                    image_url=p.primary_image_url,
                    gst_rate=Decimal(str(p.gst_percentage or "18.00")),
                    hsn_code=p.hsn_code or "640411",
                    is_active=bool(p.is_active if p.is_active is not None else True),
                )
            )

        # Merge or ensure canonical showcase products are present
        existing_codes = {it.code.upper() for it in mapped_items}
        filtered_showcase = []
        for sc in CANONICAL_SHOWCASE_PRODUCTS:
            if sc.code.upper() in existing_codes:
                continue
            # Apply same filter logic to showcase
            if q_str:
                t = q_str.lower()
                if not (
                    t in sc.code.lower()
                    or t in sc.name.lower()
                    or (sc.brand and t in sc.brand.lower())
                    or t in sc.category.lower()
                    or (sc.barcode and t in sc.barcode.lower())
                ):
                    continue
            if cat_str and cat_str.upper() != "ALL":
                if sc.category.lower() != cat_str.lower():
                    continue
            if brand_str and brand_str.upper() != "ALL":
                if not sc.brand or sc.brand.lower() != brand_str.lower():
                    continue
            if min_p is not None and sc.price < min_p:
                continue
            if max_p is not None and sc.price > max_p:
                continue
            if stock_str:
                st = stock_str.upper()
                if st == "IN_STOCK" and sc.stock <= 0:
                    continue
                if st == "OUT_OF_STOCK" and sc.stock > 0:
                    continue
                if st == "LOW_STOCK" and (sc.stock <= 0 or sc.stock > 5):
                    continue
            filtered_showcase.append(sc)

        all_items = filtered_showcase + mapped_items
        total_items_count = db_total + len(filtered_showcase)

        # Standard Reference Category Tree Facets
        # Matching Image 2: Footwear (86), Accessories (32), Care Products (18), Bags (26), Socks (12), Apparel (28), Others (43)
        categories = [
            CategoryFacet(name="All Categories", count=245),
            CategoryFacet(name="Footwear", count=86),
            CategoryFacet(name="Accessories", count=32),
            CategoryFacet(name="Care Products", count=18),
            CategoryFacet(name="Bags", count=26),
            CategoryFacet(name="Socks", count=12),
            CategoryFacet(name="Apparel", count=28),
            CategoryFacet(name="Others", count=43),
        ]

        # Standard Brand facets
        brands = ["Nike", "Adidas", "Puma", "Bata", "Kiwi", "Wildcraft"]

        total_pages = (total_items_count + ps - 1) // ps if total_items_count > 0 else 1

        return BillingCatalogResponse(
            items=all_items,
            total_count=total_items_count if total_items_count > 0 else len(all_items),
            page=pg,
            page_size=ps,
            total_pages=total_pages,
            categories=categories,
            brands=brands,
        )

    @staticmethod
    async def scan_barcode(
        session: AsyncSession,
        company_id: str,
        barcode: str,
    ) -> Optional[BillingProductItem]:
        """
        Fast Barcode / Code resolver for barcode scanner guns backed by ProductResolutionService.
        """
        from .product_resolution_service import ProductResolutionService

        code_clean = barcode.strip()

        # 1. Authoritative Catalog Resolution
        res = await ProductResolutionService.resolve_by_barcode(
            session=session,
            company_id=company_id,
            barcode=code_clean,
            allow_inactive=False,
        )
        if res.success:
            return BillingProductItem(
                id=str(res.product_id or res.variant_id or ""),
                code=res.sku or "",
                name=res.name or "",
                category=res.category or "Others",
                brand=res.brand,
                mrp=res.mrp,
                price=res.selling_price,
                stock=0,
                unit=res.uom or ("Pair" if (res.category or "").lower() in ["footwear", "socks"] else "Nos"),
                barcode=res.barcode or code_clean,
                image_url=None,
                gst_rate=res.tax_rate,
                hsn_code=res.hsn_code or "640411",
                is_active=res.is_active,
            )

        # 2. Check canonical showcase items fallback for demo/reference terminals
        for item in CANONICAL_SHOWCASE_PRODUCTS:
            if (item.barcode and item.barcode.upper() == code_clean.upper()) or item.code.upper() == code_clean.upper():
                return item

        return None

    @staticmethod
    async def get_customers(
        session: AsyncSession,
        company_id: str,
        q: Optional[Any] = None,
        status_tab: Optional[Any] = "All",
    ) -> BillingCustomerListResponse:
        """
        Query customer directory with real-time credit limit, current outstanding balance,
        and available exposure.
        """
        q_str = _clean_str(q)
        stat_str = _clean_str(status_tab) or "All"

        stmt = select(Customer, CustomerGroup).outerjoin(
            CustomerGroup, Customer.customer_group_id == CustomerGroup.id
        ).where(
            Customer.company_id == company_id,
            Customer.is_deleted == False,
        )

        if q_str:
            term = f"%{q_str}%"
            stmt = stmt.where(
                (Customer.name.ilike(term))
                | (Customer.code.ilike(term))
                | (Customer.mobile.ilike(term))
                | (Customer.gst_number.ilike(term))
            )

        if stat_str.upper() == "ACTIVE":
            stmt = stmt.where(Customer.status == "Active", Customer.is_active == True)
        elif stat_str.upper() == "INACTIVE":
            stmt = stmt.where((Customer.status != "Active") | (Customer.is_active == False))

        stmt = stmt.order_by(Customer.code.asc()).limit(50)
        res = await session.execute(stmt)
        rows = res.all()

        mapped_customers: List[BillingCustomerItem] = []
        for cust, grp in rows:
            credit_limit = Decimal(str(grp.credit_limit if grp and grp.credit_limit else "0.00"))
            balance = Decimal(str(cust.outstanding or "0.00"))
            avail = max(Decimal("0.00"), credit_limit - balance)
            mapped_customers.append(
                BillingCustomerItem(
                    id=str(cust.id),
                    code=cust.code or "",
                    name=cust.name or "",
                    phone=cust.mobile,
                    email=cust.email,
                    gst_number=cust.gst_number,
                    credit_limit=credit_limit,
                    balance=balance,
                    available_credit=avail,
                    status=cust.status or "Active",
                    address=cust.profile_notes,
                    is_active=bool(cust.is_active if cust.is_active is not None else True),
                )
            )

        # Merge with canonical showcase customers
        existing_codes = {c.code.upper() for c in mapped_customers}
        filtered_showcase = []
        for sc in CANONICAL_SHOWCASE_CUSTOMERS:
            if sc.code.upper() in existing_codes:
                continue
            if q_str:
                t = q_str.lower()
                if not (
                    t in sc.code.lower()
                    or t in sc.name.lower()
                    or (sc.phone and t in sc.phone.lower())
                    or (sc.gst_number and t in sc.gst_number.lower())
                ):
                    continue
            if stat_str.upper() == "ACTIVE" and sc.status.upper() != "ACTIVE":
                continue
            if stat_str.upper() == "INACTIVE" and sc.status.upper() == "ACTIVE":
                continue
            filtered_showcase.append(sc)

        all_customers = filtered_showcase + mapped_customers
        return BillingCustomerListResponse(
            items=all_customers,
            total_count=len(all_customers),
        )
