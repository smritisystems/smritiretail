from typing import List, Optional

from backend.app.modules.sales.quotation.domain import Quotation, QuotationItem, calculate_total, create_quotation
from backend.app.modules.sales.quotation.repository import InMemoryQuotationRepository

__all__ = [
    "Quotation",
    "QuotationItem",
    "calculate_total",
    "create_quotation",
    "save_quotation",
    "get_quotation",
    "list_quotations",
    "delete_quotation",
    "clear_quotations",
    "InMemoryQuotationRepository",
]

_quotation_repository = InMemoryQuotationRepository()


def save_quotation(quotation: Quotation) -> Quotation:
    return _quotation_repository.save(quotation)


def get_quotation(quotation_id: str) -> Optional[Quotation]:
    return _quotation_repository.get(quotation_id)


def list_quotations() -> List[Quotation]:
    return _quotation_repository.list()


def delete_quotation(quotation_id: str) -> bool:
    return _quotation_repository.delete(quotation_id)


def clear_quotations() -> None:
    _quotation_repository.clear()
