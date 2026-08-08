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

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class QuotationItem:
    item_code: str
    description: str
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    tax_percent: float = 0.0


@dataclass
class Quotation:
    id: str
    customer_code: str
    quotation_date: str
    valid_until: str
    currency: str = "INR"
    items: Optional[List[QuotationItem]] = None
    status: str = "draft"


def calculate_total(quotation: Quotation) -> float:
    total = 0.0
    for item in quotation.items or []:
        discounted = item.unit_price * (1 - item.discount_percent / 100)
        taxed = discounted * (1 + item.tax_percent / 100)
        total += taxed * item.quantity
    return round(total, 2)


def create_quotation(
    customer_code: str,
    items: Optional[List[QuotationItem]] = None,
    quotation_id: Optional[str] = None,
    quotation_date: Optional[str] = None,
    valid_until: Optional[str] = None,
    currency: str = "INR",
    status: str = "draft",
) -> Quotation:
    return Quotation(
        id=quotation_id or "SQ-001",
        customer_code=customer_code,
        quotation_date=quotation_date or "2026-08-01",
        valid_until=valid_until or "2026-08-31",
        currency=currency,
        items=items or [],
        status=status,
    )
