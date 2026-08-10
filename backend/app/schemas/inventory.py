"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class ProductVendorCreate(BaseModel):
    supplier_id: str = Field(..., description="Supplier ID reference")
    supplier_product_code: Optional[str] = Field(None, max_length=100)
    supplier_barcode: Optional[str] = Field(None, max_length=100)
    purchase_uom_id: Optional[str] = Field(None, max_length=50)
    currency_id: str = "INR"
    cost_price: Decimal = Decimal("0.00")
    last_purchase_price: Decimal = Decimal("0.00")
    last_purchase_date: Optional[datetime] = None
    discount_percentage: Decimal = Decimal("0.00")
    tax_inclusive: bool = False
    minimum_order_qty: Decimal = Decimal("1.00")
    maximum_order_qty: Optional[Decimal] = None
    lead_time_days: int = 1
    supplier_warranty_days: int = 0
    priority: int = 1
    is_preferred: bool = False
    approval_status: str = "Approved"


class ProductVendorResponse(ProductVendorCreate):
    id: str
    product_id: str
    company_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProductTaxProfileCreate(BaseModel):
    hsn_code: Optional[str] = Field(None, max_length=20)
    gst_rate: Decimal = Decimal("18.00")
    cess_rate: Decimal = Decimal("0.00")
    is_inclusive_tax: bool = False
    tax_group_id: Optional[str] = None
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    effective_to: Optional[datetime] = None


class ProductTaxProfileResponse(ProductTaxProfileCreate):
    id: str
    product_id: str
    model_config = ConfigDict(from_attributes=True)


class ProductInventoryPolicyCreate(BaseModel):
    is_batch_tracked: bool = False
    is_serial_tracked: bool = False
    is_expiry_required: bool = False
    is_qc_required: bool = False
    allow_negative_stock: bool = False


class ProductInventoryPolicyResponse(ProductInventoryPolicyCreate):
    id: str
    product_id: str
    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    price: Decimal = Decimal("0.00")
    stock: int = 0
    category: str = Field(..., max_length=100)
    is_favorite: bool = False
    barcode: str = Field(..., max_length=100)
    secondary_barcodes: List[str] = []
    brand: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    size_scale_id: Optional[str] = Field(None, max_length=50)
    sourcing_mode_override: Optional[str] = Field(None, max_length=30)
    mrp: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = None
    style_code: Optional[str] = Field(None, max_length=100)
    cost_price: Optional[Decimal] = None
    sku: Optional[str] = Field(None, max_length=100)
    hsn_code: Optional[str] = Field(None, max_length=15)
    pricing_mode: str = "Fixed"
    tracking_mode: str = "Standard"
    variant_template_id: Optional[str] = Field(None, max_length=50)
    weight_grams: Decimal = Decimal("0.00")
    cbm_m3: Optional[Decimal] = None  # Phase E10: typed CBM (cubic metres)
    attributes: Dict[str, Any] = {}
    primary_image_url: Optional[str] = Field(None, max_length=512)
    gallery_images: List[str] = []
    vendors: List[ProductVendorCreate] = []
    tax_profiles: List[ProductTaxProfileCreate] = []
    inventory_policy: Optional[ProductInventoryPolicyCreate] = None


class ProductCreate(ProductBase):
    # F-004: id is now Optional — when omitted, BaseEntity uuid4 default applies on the DB side.
    # Clients that supply a stable client-generated UUID (e.g. offline scenarios) are still honoured.
    id: Optional[str] = Field(None, max_length=50)
    category_code: Optional[str] = Field(None, max_length=50)  # Phase E1: set by PVE
    # F-002: lifecycle fields — map from frontend status (Active/Inactive/Draft/Blocked/Discontinued)
    workflow_status: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None  # None → BaseEntity default (True) applies


class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    price: Optional[Decimal] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None
    barcode: Optional[str] = None
    secondary_barcodes: Optional[List[str]] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    size_scale_id: Optional[str] = None
    sourcing_mode_override: Optional[str] = None
    mrp: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = None
    style_code: Optional[str] = None
    cost_price: Optional[Decimal] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    pricing_mode: Optional[str] = None
    tracking_mode: Optional[str] = None
    variant_template_id: Optional[str] = None
    weight_grams: Optional[Decimal] = None
    cbm_m3: Optional[Decimal] = None  # Phase E10: typed CBM
    attributes: Optional[Dict[str, Any]] = None
    primary_image_url: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    vendors: Optional[List[ProductVendorCreate]] = None
    tax_profiles: Optional[List[ProductTaxProfileCreate]] = None
    inventory_policy: Optional[ProductInventoryPolicyCreate] = None
    # F-002: allow lifecycle update via PUT
    workflow_status: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    category_code: Optional[str] = None  # Phase E1
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    vendors: List[ProductVendorResponse] = []
    tax_profiles: List[ProductTaxProfileResponse] = []
    inventory_policy: Optional[ProductInventoryPolicyResponse] = None
    # F-002: expose lifecycle fields so frontend can derive status from authoritative backend columns
    workflow_status: Optional[str] = None
    is_active: Optional[bool] = True

    model_config = ConfigDict(from_attributes=True)



class ProductBarcodeBase(BaseModel):
    product_id: str
    barcode: str
    is_primary: bool = False


class ProductBarcodeResponse(ProductBarcodeBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


class StockMovementBase(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: float
    movement_type: str = "IN"
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    reference_id: Optional[str] = None
    warehouse: Optional[str] = None
    bin: Optional[str] = None
    batch: Optional[str] = None
    serial: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    remarks: Optional[str] = None
    user: Optional[str] = None
    device: Optional[str] = None
    branch: Optional[str] = None
    source_module: Optional[str] = None
    approval: Optional[str] = None
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementResponse(StockMovementBase):
    id: str
    created_at: Optional[datetime] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class StockLedgerEntryResponse(BaseModel):
    """
    Canonical Stock Ledger API response derived from inventory_ledger_entries.

    Option A (Phase 0 Decision): inventory_ledger_entries is the authoritative
    ledger. GET /inventory/ledger reads from ILE, not stock_movements.

    Quantity semantics:
      - quantity is ALWAYS positive (ILE Rule).
      - Direction encoded by from_location_id / to_location_id nullity.
      - quantity_in  = +quantity when to_location_id is set (inbound).
      - quantity_out = +quantity when from_location_id is set (outbound).
      - For transfers (both set): quantity_in = quantity_out = quantity.

    Balance:
      - balance_after is the cumulative network balance for (company, product)
        at the time of this entry, ordered by posting_timestamp + entry_no.
      - Transfer is NET ZERO at company level (in and out cancel).
      - Computed as a SQL window function in the API layer.
    """
    # ILE identity
    id: str
    entry_no: str
    transaction_id: str
    document_no: Optional[str] = None

    # Product
    product_id: str
    product_name: Optional[str] = None       # JOINed from products.name
    sku: str

    # Quantity (always positive; direction via location semantics)
    quantity: float
    quantity_in: float = 0.0                 # backend-computed
    quantity_out: float = 0.0                # backend-computed

    # Movement
    movement_type: str
    ownership_type: str = "COMPANY"
    is_reversal: bool = False
    reversal_entry_id: Optional[str] = None

    # Locations (canonical)
    from_location_id: Optional[str] = None
    from_location_name: Optional[str] = None # JOINed from inventory_location_nodes.name
    to_location_id: Optional[str] = None
    to_location_name: Optional[str] = None   # JOINed from inventory_location_nodes.name

    # Batch / Serial
    batch_no: Optional[str] = None
    serial_no: Optional[str] = None

    # Cost
    unit_cost: Optional[Decimal] = None

    # Metadata
    remarks: Optional[str] = None
    posting_timestamp: Optional[datetime] = None
    created_at: Optional[datetime] = None    # = posting_timestamp (backward compat alias)
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    # Running balance (Phase 2)
    balance_after: Optional[float] = None    # None = not computed / not applicable

    # Backward-compatibility shims for frontend StockLedgerTab.tsx
    warehouse: Optional[str] = None          # = to_location_name or from_location_name
    reference_doc_id: Optional[str] = None   # = document_no

    model_config = ConfigDict(from_attributes=False)
