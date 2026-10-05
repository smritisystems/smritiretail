"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-08-25
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

UniversalItemMasterService (Backward-Compatibility Facade)
──────────────────────────────────────────────────────────
This module re-exports UniversalItemMasterService and decomposed sub-services
from the new modular package: app.services.item

Decomposed Architecture:
  app.services.item.ItemCatalogService        — CRUD & catalog lifecycle
  app.services.item.BarcodeResolverService    — 5-tier barcode/SKU resolution
  app.services.item.VariantMatrixService      — Cartesian variant matrix generator
  app.services.item.ItemPricingService        — Contract-governed pricing & GST
  app.services.item.ItemTrackingService       — 5-bucket ATP & batch/serial tracking
"""

from .item import (
    UniversalItemMasterService,
    ItemCatalogService,
    BarcodeResolverService,
    VariantMatrixService,
    ItemPricingService,
    ItemTrackingService,
)

__all__ = [
    "UniversalItemMasterService",
    "ItemCatalogService",
    "BarcodeResolverService",
    "VariantMatrixService",
    "ItemPricingService",
    "ItemTrackingService",
]
