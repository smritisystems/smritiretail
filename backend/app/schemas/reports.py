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
