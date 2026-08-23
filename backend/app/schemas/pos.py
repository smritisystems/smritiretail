"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-11
Modified     : 2026-07-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel



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
    id:              str
    register_id:     str
    opening_balance: Decimal = Decimal("0.00")


class CashDenominationBreakdown(BaseModel):
    notes_2000: int = 0
    notes_500:  int = 0
    notes_200:  int = 0
    notes_100:  int = 0
    notes_50:   int = 0
    notes_20:   int = 0
    notes_10:   int = 0
    notes_5:    int = 0
    notes_2:    int = 0
    notes_1:    int = 0
    coins_total: Decimal = Decimal("0.00")

    def calculate_total(self) -> Decimal:
        return (
            Decimal(str(self.notes_2000 * 2000)) +
            Decimal(str(self.notes_500 * 500)) +
            Decimal(str(self.notes_200 * 200)) +
            Decimal(str(self.notes_100 * 100)) +
            Decimal(str(self.notes_50 * 50)) +
            Decimal(str(self.notes_20 * 20)) +
            Decimal(str(self.notes_10 * 10)) +
            Decimal(str(self.notes_5 * 5)) +
            Decimal(str(self.notes_2 * 2)) +
            Decimal(str(self.notes_1 * 1)) +
            self.coins_total
        ).quantize(Decimal("0.01"))


class ShiftCashDropRequest(BaseModel):
    amount:            Decimal
    target_account_id: Optional[str] = None  # Defaults to 1020 (Bank) or 1010 vault
    reason:            str


class ShiftTillExpenseRequest(BaseModel):
    amount:             Decimal
    expense_account_id: Optional[str] = None  # Defaults to 5000 (Expenses)
    reason:             str
    receipt_ref:        Optional[str] = None


class ShiftCashTransactionResponse(BaseModel):
    id:               str
    shift_id:         str
    transaction_type: str
    amount:           Decimal
    account_id:       Optional[str] = None
    reason:           str
    performed_by:     str
    gl_voucher_id:    Optional[str] = None
    gl_voucher_no:    Optional[str] = None
    receipt_ref:      Optional[str] = None
    created_at:       datetime
    model_config = {"from_attributes": True}


class ShiftClose(BaseModel):
    closing_balance: Optional[Decimal] = None
    denominations:   Optional[CashDenominationBreakdown] = None
    closing_notes:   Optional[str] = None


class ShiftResponse(BaseModel):
    id:                  str
    register_id:         str
    cashier_id:          str
    status:              str
    opened_at:           datetime
    closed_at:           Optional[datetime] = None
    opening_balance:     Decimal
    cash_sales_total:    Decimal
    card_sales_total:    Decimal
    upi_sales_total:     Decimal
    total_sales:         Decimal
    total_invoices:      str
    cash_drops_total:    Decimal = Decimal("0.00")
    till_expenses_total: Decimal = Decimal("0.00")
    cash_in_total:       Decimal = Decimal("0.00")
    closing_balance:     Optional[Decimal] = None
    expected_cash:       Optional[Decimal] = None
    variance:            Optional[Decimal] = None
    denominations:       Optional[Dict[str, Any]] = None
    closing_notes:       Optional[str] = None
    company_id:          Optional[str] = None
    branch_id:           Optional[str] = None
    model_config = {"from_attributes": True}


class POSZReportResponse(BaseModel):
    shift_id:            str
    register_id:         str
    cashier_id:          str
    status:              str
    opened_at:           datetime
    closed_at:           Optional[datetime] = None
    opening_balance:     Decimal
    cash_sales_total:    Decimal
    card_sales_total:    Decimal
    upi_sales_total:     Decimal
    total_sales:         Decimal
    total_invoices:      int
    cash_drops_total:    Decimal = Decimal("0.00")
    till_expenses_total: Decimal = Decimal("0.00")
    cash_in_total:       Decimal = Decimal("0.00")
    expected_cash:       Decimal
    closing_balance:     Decimal
    variance:            Decimal
    denominations:       Optional[Dict[str, Any]] = None
    closing_notes:       Optional[str] = None
    gl_voucher_id:       Optional[str] = None
    gl_voucher_no:       Optional[str] = None
    company_id:          Optional[str] = None
    branch_id:           Optional[str] = None
    cash_movements:      Optional[List[ShiftCashTransactionResponse]] = None
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
