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

from typing import Dict, List, Optional

from .domain import Quotation


class InMemoryQuotationRepository:
    """Lightweight in-memory persistence for Sales Quotations.

    This repository is intended as a domain-level implementation example and
    a stable hook for future persistence adapters.
    """

    def __init__(self) -> None:
        self._store: Dict[str, Quotation] = {}

    def save(self, quotation: Quotation) -> Quotation:
        self._store[quotation.id] = quotation
        return quotation

    def get(self, quotation_id: str) -> Optional[Quotation]:
        return self._store.get(quotation_id)

    def list(self) -> List[Quotation]:
        return list(self._store.values())

    def delete(self, quotation_id: str) -> bool:
        return self._store.pop(quotation_id, None) is not None

    def clear(self) -> None:
        self._store.clear()
