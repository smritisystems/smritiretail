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
from typing import Any, Dict, List, Optional
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
    tax_total:       Decimal
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
    sku_code:     str
    barcode:      Optional[str] = None
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


# ---------------------------------------------------------------------------
# Sprint 23 P2 Schemas -- Shoper9 Full Parity
# Sh9 EXE: SR202000 (RPT-TAX-005), SR202100 (RPT-OPS-001), SR214100 (RPT-MRC-003), SR236300 (RPT-MRC-001)
# ---------------------------------------------------------------------------

class BillWiseItemsLine(BaseModel):
    invoice_number: str
    invoice_date:   str
    customer_name:  Optional[str] = None
    line_no:        int = 1
    product_code:   str
    sku_code:       str
    barcode:        Optional[str] = None
    product_name:   str
    hsn_code:       Optional[str] = None
    quantity:       Decimal
    unit_price:     Decimal
    discount:       Decimal = Decimal("0.00")
    gst_rate:       Decimal = Decimal("18.00")
    tax_amount:     Decimal = Decimal("0.00")
    line_total:     Decimal


class BillWiseItemsReport(BaseModel):
    """RPT-TAX-005 -- Shoper9 SR202000 Bill-wise Items Detail."""
    from_date:       str
    to_date:         str
    generated_at:    str
    total_invoices:  int
    total_lines:     int
    total_quantity:  Decimal
    total_amount:    Decimal
    lines:           List[BillWiseItemsLine]


class DiscountSummaryLine(BaseModel):
    invoice_number:   str
    invoice_date:     str
    salesperson_name: Optional[str] = None
    customer_name:    Optional[str] = None
    gross_amount:     Decimal
    discount_amount:  Decimal
    net_amount:       Decimal
    discount_pct:     Decimal
    remarks:          Optional[str] = None


class DiscountSummaryReport(BaseModel):
    """RPT-OPS-001 -- Shoper9 SR202100 Discount Given Summary."""
    from_date:          str
    to_date:            str
    generated_at:       str
    total_bills:        int
    total_gross:        Decimal
    total_discount:     Decimal
    total_net:          Decimal
    overall_discount_pct: Decimal
    lines:              List[DiscountSummaryLine]


class ItemWiseReturnsLine(BaseModel):
    return_number:   str
    return_date:     str
    original_inv_no: str
    product_code:    str
    product_name:    str
    quantity:        Decimal
    unit_price:      Decimal
    tax_amount:      Decimal = Decimal("0.00")
    total_amount:    Decimal
    reason:          Optional[str] = None


class ItemWiseReturnsReport(BaseModel):
    """RPT-MRC-003 -- Shoper9 SR214100 Item-wise Sales Returns."""
    from_date:        str
    to_date:          str
    generated_at:     str
    total_returns:    int
    total_qty:        Decimal
    total_amount:     Decimal
    lines:            List[ItemWiseReturnsLine]


class AttributeSizeSalesLine(BaseModel):
    product_code:   Optional[str] = None
    product_name:   Optional[str] = None
    style_code:     Optional[str] = None
    category:       str
    brand:          Optional[str] = None
    color:          Optional[str] = None
    size:           Optional[str] = None
    qty_sold:       Decimal
    gross_revenue:  Decimal
    discount:       Decimal = Decimal("0.00")
    net_revenue:    Decimal


class AttributeSizeSalesReport(BaseModel):
    """RPT-MRC-001 -- Shoper9 SR236300 Attribute+Size wise Sales."""
    from_date:       str
    to_date:         str
    generated_at:    str
    total_groups:    int
    total_qty:       Decimal
    total_net:       Decimal
    lines:           List[AttributeSizeSalesLine]


# ---------------------------------------------------------------------------
# SMRITI Standard Statutory Tax Invoices & Footwear Matrix Schemas
# ---------------------------------------------------------------------------

class TaxInvoiceMasterRegisterLine(BaseModel):
    """RPT-TAX-006 Line -- Master Statutory Tax Invoice Ledger Line."""
    invoice_id: str
    bill_no:            Optional[int] = None
    invoice_number:     str
    invoice_date:       str
    status:             str
    document_type:      str = "TAX INVOICE"
    sis_code:           Optional[str] = None
    supplier_name:      str = "Tattly Threads"
    supplier_gstin:     str = "27AAXFT2508H1ZR"
    supplier_state:     str = "Maharashtra (27)"
    customer_name:      Optional[str] = None
    customer_gstin:     Optional[str] = None
    place_of_supply:    str
    supply_type:        str
    reverse_charge:     str = "No"
    po_reference:       Optional[str] = None
    eway_bill_no:       Optional[str] = None
    irn:                Optional[str] = None
    site_name:          Optional[str] = None
    billing_address:    Optional[str] = None
    shipping_address:   Optional[str] = None
    items_count:        int
    total_quantity:     Decimal
    taxable_value:      Decimal
    gst_rate:           Decimal = Decimal("5.00")
    cgst_amount:        Decimal = Decimal("0.00")
    sgst_amount:        Decimal = Decimal("0.00")
    igst_amount:        Decimal = Decimal("0.00")
    total_tax:          Decimal
    round_off:          Decimal = Decimal("0.00")
    grand_total:        Decimal
    amount_in_words:    str


class TaxInvoiceMasterRegisterReport(BaseModel):
    """RPT-TAX-006 -- Statutory GST Tax Invoices Master Register."""
    from_date:          str
    to_date:            str
    generated_at:       str
    total_invoices:     int
    completed_count:    int
    cancelled_count:    int
    total_quantity:     Decimal
    total_taxable:      Decimal
    total_cgst:         Decimal
    total_sgst:         Decimal
    total_igst:         Decimal
    total_tax:          Decimal
    total_grand_total:  Decimal
    lines:              List[TaxInvoiceMasterRegisterLine]


class ArticleColorSizeMatrixRow(BaseModel):
    """RPT-MRC-005 Row -- Cross-tabulated variant curve row."""
    article:        str
    color:          str
    size_36:        Decimal = Decimal("0")
    size_37:        Decimal = Decimal("0")
    size_38:        Decimal = Decimal("0")
    size_39:        Decimal = Decimal("0")
    size_40:        Decimal = Decimal("0")
    size_41:        Decimal = Decimal("0")
    size_42:        Decimal = Decimal("0")
    total_units:    Decimal
    taxable_value:  Decimal
    tax_amount:     Decimal
    gross_total:    Decimal


class ArticleColorSizeMatrixReport(BaseModel):
    """RPT-MRC-005 -- Article, Color & Size Variant Curve Matrix Report."""
    from_date:       str
    to_date:         str
    generated_at:    str
    total_variants:  int
    total_units:     Decimal
    total_taxable:   Decimal
    total_tax:       Decimal
    total_gross:     Decimal
    rows:            List[ArticleColorSizeMatrixRow]


class StoreWiseSummaryLine(BaseModel):
    """RPT-OPS-006 Line -- Store/SIS Code Summary."""
    sis_code:        str
    site_name:       Optional[str] = None
    total_invoices:  int
    completed_count: int
    cancelled_count: int
    total_quantity:  Decimal
    taxable_value:   Decimal
    tax_amount:      Decimal
    grand_total:     Decimal


class StoreWiseSummaryReport(BaseModel):
    """RPT-OPS-006 -- Store-Wise SIS Tax Invoice & Distribution Register."""
    from_date:       str
    to_date:         str
    generated_at:    str
    total_stores:    int
    total_invoices:  int
    total_units:     Decimal
    total_taxable:   Decimal
    total_tax:       Decimal
    total_grand:     Decimal
    lines:           List[StoreWiseSummaryLine]


# ── Sales Orders Reports (RPT-SO-001 to RPT-SO-007) ──────────────────────────

class SalesOrderSummaryLine(BaseModel):
    order_no:           str
    po_number:          Optional[str] = None
    customer_name:      str
    date:               str
    delivery_date:      Optional[str] = None
    site_code:          Optional[str] = None
    total_qty:          Decimal
    basic_total:        Decimal
    tax_total:          Decimal
    grand_total:        Decimal
    billed_value:       Decimal
    pending_value:      Decimal
    fulfillment_status: str


class SalesOrderSummaryReport(BaseModel):
    """RPT-SO-001 -- Sales Order Summary."""
    report_id:          str = "RPT-SO-001"
    report_name:        str = "Sales Order Summary"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_orders:       int
    total_ordered_qty:  Decimal
    total_order_value:  Decimal
    total_billed_value: Decimal
    total_pending_value: Decimal
    status_counts:      dict = {}
    lines:              List[SalesOrderSummaryLine] = []
    rows:               List[SalesOrderSummaryLine] = []


class PendingOrderLine(BaseModel):
    order_no:           str
    po_number:          Optional[str] = None
    customer_name:      str
    po_date:            Optional[str] = None
    delivery_date:      Optional[str] = None
    site_code:          Optional[str] = None
    total_qty:          Decimal
    billed_qty:         Decimal
    pending_qty:        Decimal
    grand_total:        Decimal
    billed_value:       Decimal
    pending_value:      Decimal
    fulfillment_status: str


class PendingOrdersReport(BaseModel):
    """RPT-SO-002 -- Pending Orders."""
    report_id:          str = "RPT-SO-002"
    report_name:        str = "Pending Orders"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_pending_orders: int
    total_pending_qty:   Decimal
    total_pending_value: Decimal
    lines:              List[PendingOrderLine] = []
    rows:               List[PendingOrderLine] = []


class BilledVsPendingOrderLine(BaseModel):
    order_no:           str
    po_number:          Optional[str] = None
    customer_name:      str
    date:               str
    grand_total:        Decimal
    billed_value:       Decimal
    pending_value:      Decimal
    billing_pct:        Decimal
    pending_pct:        Decimal = Decimal("0.00")
    fulfillment_status: str


class BilledVsPendingOrdersReport(BaseModel):
    """RPT-SO-003 -- Billed vs Pending Orders."""
    report_id:          str = "RPT-SO-003"
    report_name:        str = "Billed vs Pending Orders"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_orders:       int
    total_order_value:  Decimal
    total_billed_value: Decimal
    total_pending_value: Decimal
    overall_billing_pct: Decimal
    lines:              List[BilledVsPendingOrderLine] = []
    rows:               List[BilledVsPendingOrderLine] = []


class CustomerWiseOrderLine(BaseModel):
    customer_name:      str
    customer_gstin:     Optional[str] = None
    order_count:        int
    total_qty:          Decimal
    total_value:        Decimal
    billed_value:       Decimal
    pending_value:      Decimal
    avg_order_value:    Decimal


class CustomerWiseOrdersReport(BaseModel):
    """RPT-SO-004 -- Customer-wise Orders."""
    report_id:          str = "RPT-SO-004"
    report_name:        str = "Customer-wise Orders"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_customers:    int
    total_orders:       int
    total_value:        Decimal
    total_billed_value: Decimal
    total_pending_value: Decimal
    lines:              List[CustomerWiseOrderLine] = []
    rows:               List[CustomerWiseOrderLine] = []


class ProductWiseOrderedQuantityLine(BaseModel):
    product_id:         Optional[str] = None
    article_no:         Optional[str] = None
    vendor_style:       Optional[str] = None
    name:               str
    color:              Optional[str] = None
    size:               Optional[str] = None
    uom:                str = "EA"
    ordered_qty:        Decimal
    billed_qty:         Decimal = Decimal("0.0000")
    pending_qty:        Decimal = Decimal("0.0000")
    avg_cost:           Decimal
    total_value:        Decimal
    order_count:        int


class ProductWiseOrderedQuantityReport(BaseModel):
    """RPT-SO-005 -- Product-wise Ordered Quantity."""
    report_id:          str = "RPT-SO-005"
    report_name:        str = "Product-wise Ordered Quantity"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_products:     int
    total_ordered_qty:  Decimal
    total_value:        Decimal
    lines:              List[ProductWiseOrderedQuantityLine] = []
    rows:               List[ProductWiseOrderedQuantityLine] = []


class OrderFulfillmentStatusGroup(BaseModel):
    status:             str
    order_count:        int
    total_qty:          Decimal
    total_value:        Decimal
    billed_value:       Decimal
    pending_value:      Decimal


class OrderFulfillmentStatusReport(BaseModel):
    """RPT-SO-006 -- Order Fulfillment Status."""
    report_id:          str = "RPT-SO-006"
    report_name:        str = "Order Fulfillment Status"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_orders:       int
    total_value:        Decimal
    groups:             List[OrderFulfillmentStatusGroup] = []
    lines:              List[SalesOrderSummaryLine] = []
    rows:               List[SalesOrderSummaryLine] = []


class InvoiceAllocationReportLine(BaseModel):
    id:                 str
    order_no:           str
    po_number:          Optional[str] = None
    invoice_no:         str
    invoice_date:       str
    po_quantity:        Decimal
    po_value:           Decimal
    billed_quantity:    Decimal
    billed_value:       Decimal
    pending_quantity:   Decimal
    pending_value:      Decimal
    status:             str


class InvoiceAllocationReportModel(BaseModel):
    """RPT-SO-007 -- Invoice Allocation Report."""
    report_id:          str = "RPT-SO-007"
    report_name:        str = "Invoice Allocation Report"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_allocations:  int
    total_po_quantity:  Decimal
    total_po_value:     Decimal
    total_billed_qty:   Decimal
    total_billed_value: Decimal
    total_pending_qty:  Decimal
    total_pending_value: Decimal
    lines:              List[InvoiceAllocationReportLine] = []
    rows:               List[InvoiceAllocationReportLine] = []


class SalesOrderDetailLine(BaseModel):
    """RPT-SO-008 Line -- Detailed Sales Order Line-Item Record."""
    order_id:           str
    item_id:            str
    order_no:           str
    po_number:          Optional[str] = None
    po_date:            Optional[str] = None
    order_date:         str
    delivery_date:      Optional[str] = None
    customer_id:        Optional[str] = None
    customer_name:      str = "Reliance Retail Limited"
    customer_gstin:     Optional[str] = None
    site_code:          Optional[str] = None
    destination_state:  Optional[str] = None
    place_of_supply:    Optional[str] = None
    item_code:          Optional[str] = None
    item_description:   str
    hsn_code:           str = "64041990"
    category:           Optional[str] = None
    ordered_qty:        Decimal
    unit_price:         Decimal
    mrp:                Decimal
    discount_pct:       Decimal = Decimal("0.00")
    taxable_value:      Decimal
    gst_rate:           Decimal = Decimal("5.00")
    cgst_amount:        Decimal = Decimal("0.00")
    sgst_amount:        Decimal = Decimal("0.00")
    igst_amount:        Decimal = Decimal("0.00")
    total_tax:          Decimal
    total_amount:       Decimal
    billed_qty:         Decimal = Decimal("0.0000")
    pending_qty:        Decimal = Decimal("0.0000")
    billed_value:       Decimal = Decimal("0.00")
    pending_value:      Decimal = Decimal("0.00")
    fulfillment_status: str = "UNFULFILLED"
    linked_invoice_nos: List[str] = []
    linked_invoice_dates: List[str] = []
    eway_bill_no:       Optional[str] = None


class SalesOrderDetailReport(BaseModel):
    """RPT-SO-008 -- Detailed Line-Item Sales Orders Register & Fulfillment Trace."""
    report_id:          str = "RPT-SO-008"
    report_name:        str = "Detailed Sales Orders Register"
    from_date:          str
    to_date:            str
    generated_at:       str
    filters:            Dict[str, Any] = {}
    summary:            Dict[str, Any] = {}
    totals:             Dict[str, Any] = {}
    total_orders:       int
    total_lines:        int
    total_ordered_qty:  Decimal
    total_taxable_value: Decimal
    total_tax_amount:   Decimal
    total_grand_amount: Decimal
    total_billed_qty:   Decimal
    total_pending_qty:  Decimal
    total_billed_value: Decimal
    total_pending_value: Decimal
    fulfillment_rate_pct: Decimal = Decimal("0.00")
    lines:              List[SalesOrderDetailLine] = []
    rows:               List[SalesOrderDetailLine] = []




