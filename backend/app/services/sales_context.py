"""
SalesContext — shared execution context for Sales orchestration.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass(frozen=True)
class SalesContext:
    tenant_id: str
    company_id: str
    branch_id: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    warehouse: Optional[str] = None
    currency: str = "INR"
    channel: str = "Retail"
    pricing_policy: Optional[str] = None
    tax_policy: Optional[str] = None
    document_type: Optional[str] = None
    document_id: Optional[str] = None
    date: Optional[date] = None
    is_interstate: bool = False
    sales_person_id: Optional[str] = None

    def with_document(self, document_type: str, document_id: Optional[str] = None) -> "SalesContext":
        return SalesContext(
            tenant_id=self.tenant_id,
            company_id=self.company_id,
            branch_id=self.branch_id,
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            warehouse=self.warehouse,
            currency=self.currency,
            channel=self.channel,
            pricing_policy=self.pricing_policy,
            tax_policy=self.tax_policy,
            date=self.date,
            is_interstate=self.is_interstate,
            sales_person_id=self.sales_person_id,
            document_type=document_type,
            document_id=document_id,
        )
