"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, model_validator


class CashRegisterCreate(BaseModel):
    id:        str
    name:      str
    code:      str
    notes:     Optional[str] = None
    cashier:   Optional[str] = None
    warehouse: Optional[str] = None


class CashRegisterResponse(BaseModel):
    id:         str
    name:       str
    code:       str
    notes:      Optional[str] = None
    is_active:  bool
    is_locked:  bool = False
    cashier:    Optional[str] = None
    warehouse:  Optional[str] = None
    company_id: Optional[str] = None
    branch_id:  Optional[str] = None
    model_config = {"from_attributes": True}


# ─── POS Profile aliases (frontend POSProfile concept = CashRegister in FastAPI) ─

class POSProfileCreate(BaseModel):
    """Maps the frontend PosProfilesTab create form to CashRegister fields."""
    name:      str
    cashier:   str
    warehouse: str
    notes:     Optional[str] = None


class POSProfileResponse(BaseModel):
    """Frontend-facing view of a CashRegister as a POS Profile."""
    id:        str
    name:      str
    cashier:   Optional[str] = None
    warehouse: Optional[str] = None
    isActive:  bool
    isLocked:  bool
    model_config = {"from_attributes": True}

    @classmethod
    def from_register(cls, reg: "CashRegister") -> "POSProfileResponse":  # type: ignore[name-defined]
        return cls(
            id=reg.id,
            name=reg.name,
            cashier=reg.cashier,
            warehouse=reg.warehouse,
            isActive=reg.is_active,
            isLocked=reg.is_locked,
        )


class ShiftOpen(BaseModel):
    id:              Optional[str] = None
    register_id:     Optional[str] = None
    opening_balance: Decimal = Decimal("0.00")

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # 1. Map register_id / profileId
            if "profileId" in values and not values.get("register_id"):
                values["register_id"] = values["profileId"]
            # 2. Map opening_balance / openingBalance
            if "openingBalance" in values and not values.get("opening_balance"):
                values["opening_balance"] = values["openingBalance"]
            # 3. Generate id if not provided
            if not values.get("id"):
                import uuid as uuid_lib
                values["id"] = f"sh-{uuid_lib.uuid4().hex[:8]}"
        return values



class ShiftClose(BaseModel):
    closing_balance: Decimal
    closing_notes:   Optional[str] = None


class ShiftResponse(BaseModel):
    id:               str
    register_id:      str
    cashier_id:       str
    status:           str
    opened_at:        datetime
    closed_at:        Optional[datetime] = None
    opening_balance:  Decimal
    cash_sales_total: Decimal
    card_sales_total: Decimal
    upi_sales_total:  Decimal
    total_sales:      Decimal
    total_invoices:   str
    closing_balance:  Optional[Decimal] = None
    expected_cash:    Optional[Decimal] = None
    variance:         Optional[Decimal] = None
    closing_notes:    Optional[str] = None
    company_id:       Optional[str] = None
    branch_id:        Optional[str] = None
    model_config = {"from_attributes": True}


# ─────────────────────────── POS Checkout ───────────────────────────

class POSCheckoutItem(BaseModel):
    """
    A single line item in a POS sale.
    Mirrors the SalesInvoiceItem shape so the same stock-deduction
    logic in POSService can be reused without conversion.
    """
    product_id: str
    code:       str
    name:       str
    quantity:   Decimal
    price:      Decimal
    hsn_code:   Optional[str]     = None
    gst_rate:   Decimal           = Decimal("0.00")


class POSCheckoutRequest(BaseModel):
    """
    Full POS checkout payload.

    invoice_no is the client-generated document number and also acts as
    the idempotency key — submitting the same invoice_no twice returns
    the existing record without creating a duplicate or deducting stock again.
    """
    invoice_no:           str
    shift_id:             str
    items:                List[POSCheckoutItem]
    payment_mode:         str                  = "CASH"   # CASH | CARD | UPI | CREDIT
    grand_total:          Decimal                          # client display total; server re-computes
    customer_id:          Optional[str]        = None
    customer_name:        Optional[str]        = None
    bill_discount_val:    Optional[Decimal]    = None
    bill_discount_type:   Optional[str]        = None     # "percent" | "flat"
    loyalty_redeem_points: Optional[int]       = None


class POSCheckoutResponse(BaseModel):
    """
    Returned after every successful checkout call.
    cached=True means the invoice_no was already in the database —
    idempotency path, no stock was deducted a second time.
    """
    success:      bool
    cached:       bool    = False
    invoice_no:   str
    invoice_id:   str
    grand_total:  Decimal
    tax_total:    Decimal
    payment_mode: str
    shift_id:     Optional[str] = None
    model_config = {"from_attributes": True}
