"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ============================================================================
# PRICE BOOK & ENTRY SCHEMAS
# ============================================================================

class PriceBookCreateRequest(BaseModel):
    name: str = Field(..., max_length=200, description="Price book title e.g. 'Wholesale Tier 1'")
    code: str = Field(..., max_length=50, description="Unique code e.g. 'PB-WHOLESALE-01'")
    currency: str = Field("INR", max_length=10)
    channel: str = Field("RETAIL", description="Sales channel: RETAIL, WHOLESALE, B2B, ECOMMERCE, POS")
    is_default: bool = False
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: str = Field("ACTIVE", description="ACTIVE, INACTIVE, ARCHIVED")
    description: Optional[str] = None


class PriceBookUpdateRequest(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    is_default: Optional[bool] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None


class PriceBookEntryCreateRequest(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    min_quantity: float = Field(1.0, ge=0.0001, description="Minimum order quantity threshold")
    selling_price: float = Field(..., ge=0.0, description="Designated price point for this tier")
    mrp: float = Field(..., ge=0.0, description="Maximum Retail Price baseline")
    cost_price: Optional[float] = Field(None, ge=0.0)


class PriceBookEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    price_book_id: str
    item_id: str
    variant_id: Optional[str] = None
    min_quantity: float
    selling_price: float
    mrp: float
    cost_price: Optional[float] = None


class PriceBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    currency: str
    is_default: bool
    status: str
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    description: Optional[str] = None
    entries_count: Optional[int] = 0


# ============================================================================
# CUSTOMER PRICE TIER SCHEMAS
# ============================================================================

class CustomerPriceTierCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    price_book_id: Optional[str] = None
    discount_percentage: float = Field(0.0, ge=0.0, le=100.0)
    description: Optional[str] = None


class CustomerPriceTierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    price_book_id: Optional[str] = None
    discount_percentage: float
    description: Optional[str] = None


class CustomerPriceAssignmentCreateRequest(BaseModel):
    customer_id: str
    price_tier_id: str
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    notes: Optional[str] = None


class CustomerPriceAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    price_tier_id: str
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: str
    notes: Optional[str] = None


# ============================================================================
# PRICING RESOLUTION & CALCULATION SCHEMAS
# ============================================================================

class PricingResolutionRequest(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float = Field(1.0, ge=0.0001)
    price_book_code: Optional[str] = None
    customer_tier_code: Optional[str] = None
    channel: Optional[str] = None
    as_of_date: Optional[datetime] = None
    company_id: Optional[str] = None


class PricingResolutionResponse(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float
    base_mrp: float
    base_selling_price: float
    effective_unit_price: float
    line_subtotal: float
    applied_price_book: Optional[str] = None
    applied_tier: Optional[str] = None
    discount_percentage: float
    pricing_source: str = Field(..., description="PRICE_BOOK_VOLUME, CUSTOMER_TIER, VARIANT_MASTER, ITEM_MASTER, PRODUCT_MASTER, PRICE_REVISION_HISTORY")
    rule_version: int = 1


class BulkPricingLineItem(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float = Field(1.0, ge=0.0001)
    custom_discount_percentage: Optional[float] = 0.0


class BulkPricingRequest(BaseModel):
    items: List[BulkPricingLineItem]
    price_book_code: Optional[str] = None
    customer_tier_code: Optional[str] = None
    channel: Optional[str] = None
    as_of_date: Optional[datetime] = None
    company_id: Optional[str] = None


class BulkPricingResponse(BaseModel):
    lines: List[PricingResolutionResponse]
    total_quantity: float
    total_mrp: float
    total_subtotal: float
    total_savings: float
    applied_price_book: Optional[str] = None
    applied_customer_tier: Optional[str] = None


class PricingSnapshot(BaseModel):
    pricing_engine_version: int = 1
    calculation_timestamp: str
    applied_price_book: Optional[str] = None
    applied_tier: Optional[str] = None
    lines: List[PricingResolutionResponse]
    total_subtotal: float
    total_savings: float


# ============================================================================
# TEMPORAL PRICE REVISION SCHEMAS
# ============================================================================

class PriceRevisionCreateRequest(BaseModel):
    item_id: Optional[str] = None
    variant_id: str = Field(..., description="Target ItemVariant ID")
    price_book_id: Optional[str] = Field(None, description="Target PriceBook ID (or default if null)")
    revised_mrp: float = Field(..., ge=0.0, description="New Maximum Retail Price ceiling")
    revised_selling_price: float = Field(..., ge=0.0, description="New Commercial Selling Price")
    revised_distributor_price: Optional[float] = Field(None, ge=0.0, description="New Distributor/Wholesale Price")
    revised_cost_price: Optional[float] = Field(None, ge=0.0, description="New Inward Cost Price (Permanently Read-Only)")
    effective_from: Optional[datetime] = Field(None, description="Timestamp when revision activates (UTC)")
    effective_to: Optional[datetime] = Field(None, description="Timestamp when revision expires (optional)")
    reason_code: str = Field("MANUAL_REVISION", description="Reason classification code")
    justification: Optional[str] = Field(None, description="Business justification notes")
    auto_approve_if_eligible: bool = Field(True, description="Attempt auto-approval if within policy thresholds")


class PriceRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    branch_id: Optional[str] = None
    item_id: str
    variant_id: str
    item_code: Optional[str] = None
    variant_sku: Optional[str] = None
    item_name: Optional[str] = None
    price_book_id: Optional[str] = None
    price_book_code: Optional[str] = None
    currency: str = "INR"
    previous_mrp: float
    revised_mrp: float
    previous_selling_price: float
    revised_selling_price: float
    previous_distributor_price: Optional[float] = None
    revised_distributor_price: Optional[float] = None
    previous_cost_price: Optional[float] = None
    revised_cost_price: Optional[float] = None
    margin_pct: Optional[float] = None
    effective_from: datetime
    effective_to: Optional[datetime] = None
    status: str
    reason_code: str
    justification: Optional[str] = None
    approval_required: bool = False
    approval_request_id: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    source: str = "MANUAL"
    batch_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None


class PriceRevisionApprovalDecision(BaseModel):
    action: str = Field(..., description="APPROVE or REJECT")
    rejection_reason: Optional[str] = Field(None, description="Mandatory when action is REJECT")
    supervisor_pin: Optional[str] = Field(None, description="Supervisor auth credential / PIN")


class PriceRevisionBulkItem(BaseModel):
    sku_or_barcode: str
    revised_mrp: Optional[float] = Field(None, ge=0.0)
    revised_selling_price: Optional[float] = Field(None, ge=0.0)
    revised_distributor_price: Optional[float] = Field(None, ge=0.0)
    revised_cost_price: Optional[float] = None  # Read-only in bulk revision workflow
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    reason_code: Optional[str] = "BULK_IMPORT"
    justification: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_aliases_and_ceiling(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Alias mapping for revised_selling_price
            if "revised_selling_price" not in data or data["revised_selling_price"] is None:
                for alias in ("revised_sp", "selling_price", "sp", "new_selling_price", "new_sp"):
                    if alias in data and data[alias] is not None:
                        data["revised_selling_price"] = data[alias]
                        break

            # 2. Alias mapping for revised_mrp
            if "revised_mrp" not in data or data["revised_mrp"] is None:
                for alias in ("mrp", "new_mrp"):
                    if alias in data and data[alias] is not None:
                        data["revised_mrp"] = data[alias]
                        break

            # 3. Alias mapping for revised_distributor_price
            if "revised_distributor_price" not in data or data["revised_distributor_price"] is None:
                for alias in ("distributor_price", "revised_wholesale_price", "wholesale_price", "dp", "wp", "new_distributor_price"):
                    if alias in data and data[alias] is not None:
                        data["revised_distributor_price"] = data[alias]
                        break

            # 4. Strictly ignore revised_cost_price (Cost Price is permanently read-only)
            if "revised_cost_price" in data or "cost_price" in data or "cp" in data:
                data["revised_cost_price"] = None

            # 5. Statutory Invariant Check: SP <= MRP
            sp = data.get("revised_selling_price")
            mrp = data.get("revised_mrp")
            if sp is not None and mrp is not None:
                try:
                    f_sp = float(sp)
                    f_mrp = float(mrp)
                    if f_sp > f_mrp:
                        raise ValueError(f"SMRITI-PRICE-001: Selling price (₹{f_sp:.2f}) cannot exceed statutory MRP (₹{f_mrp:.2f}).")
                except (ValueError, TypeError) as e:
                    if "SMRITI-PRICE-001" in str(e):
                        raise

            # 6. Distributor Price Validation: DP <= SP
            dp = data.get("revised_distributor_price")
            if dp is not None and sp is not None:
                try:
                    f_dp = float(dp)
                    f_sp = float(sp)
                    if f_dp > f_sp:
                        raise ValueError(f"SMRITI-PRICE-002: Distributor price (₹{f_dp:.2f}) cannot exceed retail selling price (₹{f_sp:.2f}).")
                except (ValueError, TypeError) as e:
                    if "SMRITI-PRICE-002" in str(e):
                        raise
        return data


class PriceRevisionBulkRequest(BaseModel):
    price_book_id: Optional[str] = None
    batch_id: Optional[str] = None
    items: List[PriceRevisionBulkItem]


class PriceRevisionBulkResponse(BaseModel):
    batch_id: str
    total_rows: int
    approved_count: int
    pending_count: int
    error_count: int
    errors: List[Dict[str, Any]]
    revisions: List[PriceRevisionResponse]


# ============================================================================
# BULK ITEM SELECTION & FILTERING SCHEMAS
# ============================================================================

class BulkItemFilterRequest(BaseModel):
    style_code: Optional[str] = None
    article_no: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    colors: Optional[List[str]] = None
    size: Optional[str] = None
    sizes: Optional[List[str]] = None
    supplier_code: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    query: Optional[str] = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)

    @model_validator(mode="before")
    @classmethod
    def map_search_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("query"):
                for alias in ("search_text", "search", "q", "filter_text"):
                    if data.get(alias):
                        data["query"] = data[alias]
                        break
        return data


class BulkItemCandidate(BaseModel):
    item_id: str
    variant_id: str
    style_code: Optional[str] = None
    article_no: Optional[str] = None
    item_code: Optional[str] = None
    item_name: str
    variant_sku: str
    barcode: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    vendor_code: Optional[str] = None
    current_mrp: float
    current_selling_price: float
    current_distributor_price: Optional[float] = None
    current_cost_price: float
    status: str = "ACTIVE"


class BulkItemFilterResponse(BaseModel):
    total_count: int
    total_styles: int
    items: List[BulkItemCandidate]
    available_brands: List[str]
    available_categories: List[str]
    available_colors: List[str]
    available_sizes: List[str]
    available_suppliers: List[str]
