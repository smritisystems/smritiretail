"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

item/
    __init__.py                 — Public re-export facade (backward compat shim)
    item_catalog_svc.py         — CRUD: create_item, get_item_by_id, get_item_by_code, list_items
    variant_matrix_svc.py       — generate_matrix_variants (Cartesian SKU generator)
    barcode_resolver_svc.py     — lookup_by_barcode, resolve_item_by_barcode_or_sku (5-tier resolver)
    item_pricing_svc.py         — _evaluate_pricing_contract, GST split logic
    item_tracking_svc.py        — create_batch, register_serial_numbers, _compute_inventory_buckets
"""

# Re-export all public names for backward compatibility.
# Any existing import of `UniversalItemMasterService` from `item_master_svc`
# continues to work unchanged via this shim.

from .item_catalog_svc import ItemCatalogService
from .barcode_resolver_svc import BarcodeResolverService
from .variant_matrix_svc import VariantMatrixService
from .item_pricing_svc import ItemPricingService
from .item_tracking_svc import ItemTrackingService
from .legacy_reconciliation_svc import LegacyProductReconciliationService
from .item_review_triage_svc import ItemReviewTriageService
from .item_pricing_sync_svc import ItemPricingSyncService
from .item_attribute_sync_svc import ItemAttributeSyncService
from .item_tracking_sync_svc import ItemTrackingSyncService


class UniversalItemMasterService(
    ItemCatalogService,
    BarcodeResolverService,
    VariantMatrixService,
    ItemPricingService,
    ItemTrackingService,
    LegacyProductReconciliationService,
    ItemReviewTriageService,
    ItemPricingSyncService,
    ItemAttributeSyncService,
    ItemTrackingSyncService,
):
    """
    Unified facade: inherits all sub-service capabilities.

    Consumers import this class exactly as before:
        from app.services.item import UniversalItemMasterService

    Internal code should prefer importing the specific sub-service directly
    for clarity and testability.
    """
    pass


__all__ = [
    "UniversalItemMasterService",
    "ItemCatalogService",
    "BarcodeResolverService",
    "VariantMatrixService",
    "ItemPricingService",
    "ItemTrackingService",
    "LegacyProductReconciliationService",
    "ItemReviewTriageService",
    "ItemPricingSyncService",
    "ItemAttributeSyncService",
    "ItemTrackingSyncService",
]
