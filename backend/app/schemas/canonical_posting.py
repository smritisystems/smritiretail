"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Sales Posting Contract Schema (Phase 2C Step 1)
"""

from decimal import Decimal
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CanonicalPostingContext(BaseModel):
    """
    Immutable operational context supplied by POS, B2B, or order ingress adapters.
    """
    model_config = ConfigDict(frozen=True, from_attributes=True)

    company_id: str = Field(..., description="Tenant Company ID")
    branch_id: str = Field(..., description="Branch or Store ID")
    warehouse_id: Optional[str] = Field(None, description="Fulfillment Warehouse ID")
    dispatch_from_location_id: Optional[str] = Field(None, description="Physical Dispatch / Godown Location ID")
    shift_id: Optional[str] = Field(None, description="POS Shift ID (mandatory for POS_RETAIL)")
    cashier_id: Optional[str] = Field(None, description="Operating Cashier / Operator User ID")
    terminal_id: Optional[str] = Field(None, description="Physical Counter / Terminal Identifier")
    counter_id: Optional[str] = Field(None, description="Counter register identifier")
    idempotency_key: str = Field(..., min_length=8, max_length=128, description="Mandatory idempotency key")
    client_invoice_no: Optional[str] = Field(None, description="Offline or client-generated invoice number")
    source_channel: str = Field("POS_RETAIL", description="POS_RETAIL, B2B_WHOLESALE, CUSTOMER_PO, SALES_ORDER, ECOMMERCE")
    allow_negative_stock: bool = Field(False, description="Governed override allowing negative stock if permitted by store policy")
    supervisor_override_code: Optional[str] = Field(None, description="Supervisor authorization code for price/credit override")


class CanonicalPostingLineItem(BaseModel):
    """
    Line item input before canonical tax and inventory resolution.
    """
    model_config = ConfigDict(frozen=True, from_attributes=True)

    code: str = Field(..., description="Barcode, SKU, or legacy product code")
    quantity: Decimal = Field(..., gt=Decimal("0.0000"), description="Quantity to bill")
    unit_price: Decimal = Field(..., ge=Decimal("0.00"), description="Gross selling price or base rate")
    name: Optional[str] = Field(None, description="Item / Variant display name")
    variant_id: Optional[str] = Field(None, description="Canonical item_variants.id")
    product_id: Optional[str] = Field(None, description="Legacy products.id")
    item_id: Optional[str] = Field(None, description="Canonical items.id")
    batch_no: Optional[str] = Field(None, description="Batch number (if batch tracking or manual assignment)")
    gst_rate: Optional[Decimal] = Field(None, description="Statutory GST slab percentage (e.g. 5.0, 12.0, 18.0)")
    hsn_code: Optional[str] = Field(None, description="Statutory HSN / SAC Code")
    disc_pct: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"), description="Line discount percentage")
    disc_amt: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"), description="Line discount fixed amount")
    is_tax_inclusive: Optional[bool] = Field(None, description="True=MRP inclusive; False=Base exclusive; None=derive from channel")
    is_fee_line: bool = Field(False, description="True for delivery charges, round-off, or non-stock fee items")
    mrp: Optional[Decimal] = Field(None, description="Statutory Maximum Retail Price")
    customer_po_line_id: Optional[str] = Field(None, description="Traceability link to customer_purchase_order_lines.id")
    source_line_type: Optional[str] = Field(None, description="DIRECT, CUSTOMER_PO, SALES_ORDER")
    source_line_id: Optional[str] = Field(None, description="ID of source document line")


class CanonicalTenderItem(BaseModel):
    """
    Payment tender allocation applied to this invoice.
    """
    model_config = ConfigDict(frozen=True, from_attributes=True)

    tender_type: str = Field(..., description="CASH, CARD, UPI, CREDIT, WALLET, GIFT_VOUCHER, LOYALTY_POINTS")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Payment tender amount")
    reference_no: Optional[str] = Field(None, description="Card last 4, UPI UTR, or voucher code")
    notes: Optional[str] = Field(None, description="Tender notes or gateway transaction reference")


class CanonicalPostingRequest(BaseModel):
    """
    Universal Request Schema for Canonical Sales / Billing Posting.
    All channels (POS, B2B Tax Invoice, Customer PO, Sales Orders) submit to this schema.
    """
    model_config = ConfigDict(from_attributes=True)

    context: CanonicalPostingContext = Field(..., description="Operational & tenant context")
    items: List[CanonicalPostingLineItem] = Field(..., min_length=1, description="Billable line items")
    tenders: List[CanonicalTenderItem] = Field(default_factory=list, description="Payment tenders")
    customer_id: Optional[str] = Field(None, description="Customer entity identifier")
    customer_name: Optional[str] = Field("Walk-in Customer", description="Billing customer name")
    customer_phone: Optional[str] = Field(None, description="Customer phone number")
    customer_gstin: Optional[str] = Field(None, description="Customer GSTIN for B2B invoices")
    billing_address: Optional[str] = Field(None, description="Registered billing address")
    billing_location_id: Optional[str] = Field(None, description="Registered billing location identifier")
    billing_store_code: Optional[str] = Field(None, description="Registered billing store code")
    shipping_address: Optional[str] = Field(None, description="Delivery / shipping address")
    delivery_location_id: Optional[str] = Field(None, description="Registered delivery location identifier")
    delivery_store_code: Optional[str] = Field(None, description="Registered delivery store code")
    delivery_gstin: Optional[str] = Field(None, description="Delivery location GSTIN")
    delivery_location_snapshot: Optional[Dict[str, Any]] = Field(None, description="Immutable delivery location snapshot")
    dispatch_from_location_id: Optional[str] = Field(None, description="Physical Dispatch Location ID override")
    place_of_supply: Optional[str] = Field(None, description="2-digit state code or state name")
    reverse_charge: bool = Field(False, description="Whether reverse charge mechanism applies")
    notes: Optional[str] = Field(None, description="Invoice remarks or public notes")
    po_reference_no: Optional[str] = Field(None, description="Customer PO reference number")
    customer_po_id: Optional[str] = Field(None, description="Upstream customer_purchase_orders.id")
    so_reference_no: Optional[str] = Field(None, description="Sales Order reference number")
    payment_mode: Optional[str] = Field(None, description="Payment mode override (e.g. CASH, CARD, UPI, CREDIT, SPLIT)")


class CanonicalPostingLineResult(BaseModel):
    """
    Computed and committed financial line item result.
    """
    model_config = ConfigDict(from_attributes=True)

    line_no: int
    variant_id: Optional[str]
    item_id: Optional[str]
    product_id: Optional[str]
    code: str
    name: str
    quantity: Decimal
    unit_price: Decimal
    discount_amount: Decimal
    taxable_value: Decimal
    gst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    batch_no: Optional[str] = None
    hsn_code: Optional[str] = None
    mrp: Optional[Decimal] = None


class CanonicalPostingResult(BaseModel):
    """
    Immutable Financial Result returned by Canonical Sales Posting Authority.
    """
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    invoice_id: str
    invoice_no: str
    invoice_date: date
    gross_amount: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tax_total: Decimal
    round_off: Decimal
    net_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    change_amount: Decimal
    is_replayed: bool = False
    items_count: int
    outbox_event_id: Optional[str] = None
    shift_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    lines: List[CanonicalPostingLineResult] = Field(default_factory=list)
