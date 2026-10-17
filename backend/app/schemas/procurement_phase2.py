"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Version      : 1.0.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# 1. Purchase Requisition (PR)
# ─────────────────────────────────────────────────────────────────────────────

class RequisitionItemCreate(BaseModel):
    product_id:         str
    item_id:            Optional[str] = None
    variant_id:         Optional[str] = None
    code:               str
    name:               str
    quantity_requested: Decimal = Field(..., gt=0)
    estimated_cost:     Decimal = Field(default=Decimal("0.00"), ge=0)
    notes:              Optional[str] = None


class RequisitionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                 str
    requisition_id:     str
    product_id:         str
    item_id:            Optional[str] = None
    variant_id:         Optional[str] = None
    code:               str
    name:               str
    quantity_requested: Decimal
    quantity_approved:  Decimal
    quantity_ordered:   Decimal
    estimated_cost:     Decimal
    line_total:         Decimal
    notes:              Optional[str] = None


class RequisitionCreate(BaseModel):
    requisition_no:     Optional[str] = None  # Auto-generated if not provided
    requisition_date:   date = Field(default_factory=date.today)
    required_by_date:   date
    department:         Optional[str] = None
    priority:           str = "NORMAL"  # LOW, NORMAL, HIGH, URGENT
    justification:      str
    notes:              Optional[str] = None
    items:              List[RequisitionItemCreate]


class RequisitionApprovalAction(BaseModel):
    approved_quantities: Optional[Dict[str, Decimal]] = None  # item_id -> approved_qty
    notes:               Optional[str] = None


class RequisitionRejectAction(BaseModel):
    reason: str


class RequisitionConvertToPORequest(BaseModel):
    supplier_id:         str
    payment_terms:       Optional[str] = None
    delivery_date:       Optional[date] = None
    notes:               Optional[str] = None


class RequisitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                  str
    company_id:          Optional[str] = None
    branch_id:           Optional[str] = None
    requisition_no:      str
    requisition_date:    date
    required_by_date:    date
    department:          Optional[str] = None
    priority:            str
    status:              str
    justification:       str
    notes:               Optional[str] = None
    estimated_total:     Decimal
    approved_total:      Decimal
    submitted_by:        Optional[str] = None
    submitted_at:        Optional[datetime] = None
    approved_by:         Optional[str] = None
    approved_at:         Optional[datetime] = None
    rejected_by:         Optional[str] = None
    rejected_at:         Optional[datetime] = None
    rejection_reason:    Optional[str] = None
    cancelled_by:        Optional[str] = None
    cancelled_at:        Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    po_id:               Optional[str] = None
    po_no:               Optional[str] = None
    items:               List[RequisitionItemResponse] = []
    created_at:          datetime


# ─────────────────────────────────────────────────────────────────────────────
# 2. Supplier Request for Quotation (RFQ)
# ─────────────────────────────────────────────────────────────────────────────

class RfqItemCreate(BaseModel):
    product_id:         str
    item_id:            Optional[str] = None
    variant_id:         Optional[str] = None
    code:               str
    name:               str
    target_quantity:    Decimal = Field(..., gt=0)
    target_cost:        Optional[Decimal] = None
    specifications:     Optional[str] = None


class RfqItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                 str
    rfq_id:             str
    product_id:         str
    item_id:            Optional[str] = None
    variant_id:         Optional[str] = None
    code:               str
    name:               str
    target_quantity:    Decimal
    target_cost:        Optional[Decimal] = None
    specifications:     Optional[str] = None


class RfqCreate(BaseModel):
    rfq_no:             Optional[str] = None  # Auto-generated if not provided
    rfq_date:           date = Field(default_factory=date.today)
    due_date:           date
    requisition_id:     Optional[str] = None
    title:              str
    notes:              Optional[str] = None
    terms_conditions:   Optional[str] = None
    items:              List[RfqItemCreate]


class RfqResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                   str
    company_id:           Optional[str] = None
    branch_id:            Optional[str] = None
    rfq_no:               str
    rfq_date:             date
    due_date:             date
    requisition_id:       Optional[str] = None
    title:                str
    status:               str
    notes:                Optional[str] = None
    terms_conditions:     Optional[str] = None
    awarded_quotation_id: Optional[str] = None
    awarded_supplier_id:  Optional[str] = None
    awarded_notes:        Optional[str] = None
    awarded_at:           Optional[datetime] = None
    awarded_by:           Optional[str] = None
    items:                List[RfqItemResponse] = []
    quotations_count:     int = 0
    created_at:           datetime


# ─────────────────────────────────────────────────────────────────────────────
# 3. Supplier Quotation & Landed Cost Comparison
# ─────────────────────────────────────────────────────────────────────────────

class QuotationItemCreate(BaseModel):
    rfq_item_id:        Optional[str] = None
    product_id:         str
    item_id:            Optional[str] = None
    variant_id:         Optional[str] = None
    code:               str
    name:               str
    quoted_quantity:    Decimal = Field(..., gt=0)
    unit_price:         Decimal = Field(..., ge=0)
    discount_percent:   Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    tax_rate:           Decimal = Field(default=Decimal("18.00"), ge=0)
    freight_allocation: Decimal = Field(default=Decimal("0.00"), ge=0)


class QuotationItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                       str
    quotation_id:             str
    rfq_item_id:              Optional[str] = None
    product_id:               str
    item_id:                  Optional[str] = None
    variant_id:               Optional[str] = None
    code:                     str
    name:                     str
    quoted_quantity:          Decimal
    unit_price:               Decimal
    discount_percent:         Decimal
    discount_amount:          Decimal
    tax_rate:                 Decimal
    tax_amount:               Decimal
    freight_allocation:       Decimal
    net_landed_cost_per_unit: Decimal
    line_total:               Decimal


class QuotationCreate(BaseModel):
    quotation_no:       str
    rfq_id:             Optional[str] = None
    supplier_id:        str
    quotation_date:     date = Field(default_factory=date.today)
    valid_until:        date
    payment_terms:      Optional[str] = None
    delivery_timeline:  Optional[str] = None
    freight_charges:    Decimal = Field(default=Decimal("0.00"), ge=0)
    other_charges:      Decimal = Field(default=Decimal("0.00"), ge=0)
    items:              List[QuotationItemCreate]


class QuotationSelectAction(BaseModel):
    selection_justification: str
    evaluation_score:        Optional[Decimal] = None
    evaluation_notes:        Optional[str] = None


class QuotationConvertToPORequest(BaseModel):
    notes:         Optional[str] = None
    delivery_date: Optional[date] = None


class QuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                      str
    company_id:              Optional[str] = None
    branch_id:               Optional[str] = None
    quotation_no:            str
    rfq_id:                  Optional[str] = None
    supplier_id:             str
    supplier_name:           Optional[str] = None
    quotation_date:          date
    valid_until:             date
    status:                  str
    payment_terms:           Optional[str] = None
    delivery_timeline:       Optional[str] = None
    subtotal:                Decimal
    tax_total:               Decimal
    freight_charges:         Decimal
    other_charges:           Decimal
    total_landed_cost:       Decimal
    rank:                    Optional[int] = None
    evaluation_score:        Optional[Decimal] = None
    evaluation_notes:        Optional[str] = None
    selection_justification: Optional[str] = None
    selected_by:             Optional[str] = None
    selected_at:             Optional[datetime] = None
    po_id:                   Optional[str] = None
    po_no:                   Optional[str] = None
    items:                   List[QuotationItemResponse] = []
    created_at:              datetime


class QuotationComparisonItemMatrix(BaseModel):
    product_id:                str
    item_name:                 str
    code:                      str
    target_quantity:           Decimal
    quotes:                    Dict[str, Dict[str, Any]] # supplier_id -> {unit_price, net_landed_unit, line_total, rank}


class QuotationComparisonMatrixResponse(BaseModel):
    rfq_id:             str
    rfq_no:             str
    title:              str
    quotations:         List[QuotationResponse]
    item_comparisons:   List[QuotationComparisonItemMatrix]
    lowest_landed_cost_supplier_id: Optional[str] = None
