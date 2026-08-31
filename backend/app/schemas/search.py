"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# SEARCH SCHEMAS
# ============================================================================

class UniversalSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    domains: Optional[List[str]] = Field(
        default=None,
        description="Filter specific domains: ITEMS, PARTIES, BARCODES, DOCUMENTS, WAREHOUSES, TRANSACTIONS",
    )
    limit_per_domain: int = Field(5, ge=1, le=50)
    branch_id: Optional[str] = None


class SearchResultItem(BaseModel):
    id: str
    domain: str  # ITEMS, PARTIES, BARCODES, DOCUMENTS, WAREHOUSES, TRANSACTIONS
    type: str    # PRODUCT, VARIANT, CUSTOMER, VENDOR, INVOICE, PO, DISPATCH, PAYMENT
    title: str
    subtitle: Optional[str] = None
    badge: Optional[str] = None
    score: int = 50
    metadata: Dict[str, Any] = Field(default_factory=dict)
    navigation_url: Optional[str] = None


class UniversalSearchResponse(BaseModel):
    query: str
    total_hits: int
    domains_searched: List[str]
    results_by_domain: Dict[str, List[SearchResultItem]]
    items: List[SearchResultItem]
    latency_ms: float = 0.0


class BarcodeQuickScanRequest(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=64)
    warehouse_id: Optional[str] = None


class BarcodeQuickScanResponse(BaseModel):
    found: bool
    scan_type: str  # EXACT_BARCODE, ITEM_CODE, SKU, NOT_FOUND
    item_id: Optional[str] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    variant_id: Optional[str] = None
    sku: Optional[str] = None
    barcode: str
    uom: Optional[str] = "NOS"
    mrp: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    hsn_sac: Optional[str] = None
    tax_rate: Optional[Decimal] = Decimal("18.00")
    current_stock: Optional[Decimal] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchDomainListResponse(BaseModel):
    available_domains: List[Dict[str, Any]]
