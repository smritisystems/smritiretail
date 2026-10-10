"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.33.0
* Created    : 2026-09-19
* Modified   : 2026-09-19
* Copyright  : © SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Optional, List, Any, Dict
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class InwardCostComponentTypeResponse(BaseModel):
    id: str
    code: str
    name: str
    category: str
    is_capitalizable: bool
    default_allocation_method: str
    requires_document: bool
    requires_transporter: bool
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InwardCostComponentCreate(BaseModel):
    id: Optional[str] = None
    component_type: str = Field(..., description="Cost code (e.g. FREIGHT, CARTAGE, LOADING, INSURANCE)")
    description: Optional[str] = None
    amount: Decimal = Field(..., description="Component amount before tax or gross depending on ITC")
    taxable_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = Decimal("0.00")
    tax_rate: Optional[Decimal] = Decimal("0.00")
    total_amount: Optional[Decimal] = None
    itc_eligible: Optional[bool] = True
    is_capitalizable: Optional[bool] = True
    allocation_method: Optional[str] = "VALUE"  # VALUE, QUANTITY, WEIGHT
    allocation_scope: Optional[str] = "DOCUMENT"
    scope_reference_id: Optional[str] = None
    transporter_name: Optional[str] = None
    document_type: Optional[str] = None
    document_no: Optional[str] = None
    document_date: Optional[date] = None
    vehicle_no: Optional[str] = None


class InwardCostComponentResponse(BaseModel):
    id: str
    grn_id: str
    component_type: str
    description: Optional[str] = None
    amount: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    tax_rate: Decimal
    itc_eligible: bool
    is_capitalizable: bool
    allocation_method: str
    allocation_scope: str
    scope_reference_id: Optional[str] = None
    transporter_name: Optional[str] = None
    document_type: Optional[str] = None
    document_no: Optional[str] = None
    document_date: Optional[date] = None
    vehicle_no: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    model_config = {"from_attributes": True}


class InwardCostAllocationResponse(BaseModel):
    id: str
    grn_id: str
    grn_item_id: str
    cost_component_id: str
    product_id: str
    allocation_method: str
    basis_value: Decimal
    allocated_amount: Decimal
    allocated_per_unit: Decimal
    rounding_adjustment: Decimal
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CostAllocationPreviewLine(BaseModel):
    grn_item_id: Optional[str] = None
    product_id: str
    item_id: Optional[str] = None
    sku: str
    product_name: str
    quantity: Decimal
    accepted_qty: Optional[Decimal] = None
    rate: Decimal
    purchase_rate: Optional[Decimal] = None
    purchase_value: Decimal
    share_percent: Decimal
    allocated_amount: Decimal
    allocated_cost: Optional[Decimal] = None
    allocated_per_unit: Decimal
    addon_per_unit: Optional[Decimal] = None
    net_landed_cost_per_unit: Decimal
    landed_cost: Optional[Decimal] = None


class CostAllocationPreviewResponse(BaseModel):
    component_type: str
    allocation_method: str
    total_component_amount: Decimal
    total_addon_cost: Optional[Decimal] = None
    total_purchase_value: Optional[Decimal] = None
    final_inventory_cost: Optional[Decimal] = None
    reconciled_total: Decimal
    reconciled_allocated_cost: Optional[Decimal] = None
    is_balanced: bool
    variance: Decimal
    lines: List[CostAllocationPreviewLine]
    allocations: Optional[List[Dict[str, Any]]] = None


class LandedCostComponentLineBreakdown(BaseModel):
    component_id: Optional[str] = None
    component_type: str
    component_name: str
    allocated_amount: Decimal
    allocated_per_unit: Decimal
    allocation_method: str
    document_no: Optional[str] = None
    document_date: Optional[date] = None
    transporter_name: Optional[str] = None


class WhyThisCostBreakdownResponse(BaseModel):
    grn_id: str
    grn_no: Optional[str] = None
    grn_item_id: str
    product_id: str
    sku: str
    product_name: str
    po_rate: Decimal
    invoice_rate: Decimal
    variance_rate: Decimal
    trade_discount_per_unit: Decimal
    net_purchase_rate: Decimal
    quantity: Decimal
    total_addon_per_unit: Decimal
    final_landed_cost: Decimal
    mrp: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None
    components: List[LandedCostComponentLineBreakdown]


class InwardCostAdjustmentCreate(BaseModel):
    total_adjustment_amount: Decimal
    reason: str
    adjustment_no: Optional[str] = None
    component_type: Optional[str] = "FREIGHT"
    transporter_name: Optional[str] = None
    document_no: Optional[str] = None


class InwardCostAdjustmentResponse(BaseModel):
    id: str
    adjustment_no: str
    grn_id: str
    total_adjustment_amount: Decimal
    reason: str
    status: str
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    model_config = {"from_attributes": True}
