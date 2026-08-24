"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.14.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import date
from typing import List, Optional
from pydantic import BaseModel


# ── Stock Valuation ──────────────────────────────────────────────────────────

class StockValuationLine(BaseModel):
    product_id:   str
    code:         str
    name:         str
    stock:        Decimal
    cost_price:   Decimal
    stock_value:  Decimal   # stock × cost_price
    model_config = {"from_attributes": True}


class StockValuationReport(BaseModel):
    generated_at:    str
    total_items:     int
    total_value:     Decimal
    lines:           List[StockValuationLine]


# ── Daily Sales ───────────────────────────────────────────────────────────────

class DailySalesSummary(BaseModel):
    report_date:     date
    total_invoices:  int
    total_sales:     Decimal
    cash_sales:      Decimal
    card_sales:      Decimal
    upi_sales:       Decimal
    credit_sales:    Decimal
    shift_breakdown: List[dict]   # {shift_id, cashier_id, total, invoices}


# ── Supplier Ledger ───────────────────────────────────────────────────────────

class SupplierLedgerEntry(BaseModel):
    entry_type:    str   # "PURCHASE" | "PAYMENT"
    date:          str
    reference:     str
    amount:        Decimal
    balance_after: Decimal


class SupplierLedger(BaseModel):
    supplier_id:   str
    supplier_name: str
    opening_balance: Decimal
    total_purchased: Decimal
    total_paid:      Decimal
    closing_balance: Decimal
    entries:         List[SupplierLedgerEntry]


# ── Purchase Summary ──────────────────────────────────────────────────────────

class PurchaseSummaryLine(BaseModel):
    supplier_id:   str
    supplier_name: str
    po_count:      int
    grn_count:     int
    total_ordered: Decimal
    total_received: Decimal
    outstanding:   Decimal

# ---------------------------------------------------------------------------
# Sprint 8a P1 Schemas -- Tax & Compliance (Shoper9 parity)
# Sh9 EXE: SR202400 SR202200 SR202300 SR210200 SR238400
# ---------------------------------------------------------------------------

class BillWiseSalesLine(BaseModel):
    invoice_id:     str
    invoice_number: str
    invoice_date:   str
    customer_name:  Optional[str] = None
    payment_mode:   Optional[str] = None
    gross_amount:   Decimal
    discount:       Decimal
    net_amount:     Decimal
    tax_amount:     Decimal
    items_count:    int

class BillWiseSalesReport(BaseModel):
    """RPT-TAX-002 -- Shoper9 SR202400 Bill-wise Sales."""
    from_date:      str
    to_date:        str
    generated_at:   str
    total_bills:    int
    total_gross:    Decimal
    total_discount: Decimal
    total_net:      Decimal
    total_tax:      Decimal
    lines:          List[BillWiseSalesLine]

class ItemWiseSalesLine(BaseModel):
    product_id:   str
    product_code: str
    product_name: str
    hsn_code:     Optional[str] = None
    qty_sold:     Decimal
    gross_amount: Decimal
    discount:     Decimal
    net_amount:   Decimal
    tax_amount:   Decimal
    return_qty:   Decimal = Decimal("0")

class ItemWiseSalesReport(BaseModel):
    """RPT-TAX-003 -- Shoper9 SR202200 Item-wise Sales."""
    from_date:    str
    to_date:      str
    generated_at: str
    total_items:  int
    total_qty:    Decimal
    total_net:    Decimal
    lines:        List[ItemWiseSalesLine]

class TaxRegisterLine(BaseModel):
    invoice_number: str
    invoice_date:   str
    customer_name:  Optional[str] = None
    taxable_amount: Decimal
    cgst_rate:      Decimal = Decimal("0")
    cgst_amount:    Decimal = Decimal("0")
    sgst_rate:      Decimal = Decimal("0")
    sgst_amount:    Decimal = Decimal("0")
    igst_rate:      Decimal = Decimal("0")
    igst_amount:    Decimal = Decimal("0")
    total_tax:      Decimal
    net_amount:     Decimal

class TaxRegisterReport(BaseModel):
    """RPT-TAX-001 -- Shoper9 SR202300 Tax Register."""
    from_date:      str
    to_date:        str
    generated_at:   str
    total_invoices: int
    total_taxable:  Decimal
    total_cgst:     Decimal
    total_sgst:     Decimal
    total_igst:     Decimal
    total_tax:      Decimal
    lines:          List[TaxRegisterLine]

class CancelledBillLine(BaseModel):
    invoice_number:  str
    invoice_date:    str
    cancelled_at:    Optional[str] = None
    cancelled_by:    Optional[str] = None
    cancel_reason:   Optional[str] = None
    original_amount: Decimal
    customer_name:   Optional[str] = None

class CancelledBillsReport(BaseModel):
    """RPT-TAX-004 -- Shoper9 SR210200 Cancelled Bills."""
    from_date:          str
    to_date:            str
    generated_at:       str
    total_cancelled:    int
    total_value_voided: Decimal
    lines:              List[CancelledBillLine]

class SalespersonDiscountLine(BaseModel):
    salesperson_name: str
    total_bills:      int
    total_sales:      Decimal
    total_discount:   Decimal
    discount_pct:     Decimal

class SalespersonDiscountReport(BaseModel):
    """RPT-MIS-005 -- Shoper9 SR238400 Salesperson-wise Discount."""
    from_date:          str
    to_date:            str
    generated_at:       str
    total_salespersons: int
    total_discount:     Decimal
    lines:              List[SalespersonDiscountLine]
