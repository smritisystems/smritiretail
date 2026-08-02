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

"""Inventory kernel namespace.

This package holds the canonical inventory engine implementations for the RC2
frozen kernel. The backend remains engine-owned while the frontend composes the
workspace experience.

The legacy `InventoryService` class and helper are kept as compatibility aliases
so older modules and the existing regression tests continue to work while the
kernel remains frozen and engine-first.
"""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from .state_engine import InventoryStateService
from .availability_engine import InventoryAvailabilityService
from .reservation_engine import InventoryReservationService
from .trace_engine import InventoryTraceService
from .timeline_engine import InventoryTimelineService


def _build_sku(p) -> str:
    sku = getattr(p, "sku", None)
    if sku and str(sku).strip():
        return str(sku).strip()
    parts = [
        getattr(p, "style_code", None),
        getattr(p, "color", None),
        getattr(p, "size", None),
    ]
    filled = [str(x).strip() for x in parts if x is not None and str(x).strip()]
    return "-".join(filled) if filled else ""

_legacy_inventory_spec = spec_from_file_location(
    "app.services.inventory_legacy",
    Path(__file__).resolve().parents[1] / "inventory.py",
)
if _legacy_inventory_spec and _legacy_inventory_spec.loader:
    _legacy_inventory_module = module_from_spec(_legacy_inventory_spec)
    _legacy_inventory_spec.loader.exec_module(_legacy_inventory_module)
    InventoryService = _legacy_inventory_module.InventoryService
else:
    raise ImportError("Unable to import legacy InventoryService compatibility shim")

__all__ = [
    "_build_sku",
    "InventoryService",
    "InventoryStateService",
    "InventoryAvailabilityService",
    "InventoryReservationService",
    "InventoryTraceService",
    "InventoryTimelineService",
]
