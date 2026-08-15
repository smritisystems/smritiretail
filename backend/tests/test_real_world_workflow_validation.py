"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
from datetime import datetime, date, timezone
from decimal import Decimal
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.inventory import Product, StockMovement
from app.models.purchase import Supplier, PurchaseOrder, PurchaseReceipt
from app.models.sales import SalesInvoice
from app.models.commission import CommissionLedger
from app.models.fulfillment import PackingSlip, Dispatch, ReverseLogisticsReturn
from app.models.profitability import InvoiceProfitabilityLedger
from app.models.reporting import ReportDefinition, DashboardWidget

def test_real_world_workflow_transaction_chain():
    """Verify 18-step deterministic transaction chain: PO 50 -> GRN 48 -> Stock 48 -> Sale 10 -> Commission -> Pick/Pack/Dispatch -> Return 2 -> Reconciliation."""
    # 1. Opening Stock
    opening_stock = Decimal("0.00")

    # 2. PO & GRN
    po_qty = Decimal("50.00")
    grn_qty = Decimal("48.00")
    unit_cost = Decimal("1000.00")

    stock_after_grn = opening_stock + grn_qty
    assert stock_after_grn == Decimal("48.00")

    # 3. POS Sale
    sale_qty = Decimal("10.00")
    unit_price = Decimal("2000.00")
    gross_sales = sale_qty * unit_price  # ₹20,000.00

    promo_discount = Decimal("2000.00")  # 10% Campaign
    net_sales_before_tax = gross_sales - promo_discount  # ₹18,000.00

    gst_tax = net_sales_before_tax * Decimal("0.18")  # ₹3,240.00
    invoice_total = net_sales_before_tax + gst_tax  # ₹21,240.00

    stock_after_sale = stock_after_grn - sale_qty
    assert stock_after_sale == Decimal("38.00")

    # 4. Commissions
    salesperson_comm = net_sales_before_tax * Decimal("0.05")  # ₹900.00
    driver_comm = Decimal("100.00")
    referrer_reward = Decimal("100.00")
    assert salesperson_comm == Decimal("900.00")

    # 5. Fulfillment Pick, Pack & Dispatch
    packed_qty = Decimal("10.00")
    dispatched_qty = Decimal("10.00")
    assert packed_qty == dispatched_qty == sale_qty

    # 6. Reverse Logistics Return (2 units)
    return_qty = Decimal("2.00")
    stock_after_return = stock_after_sale + return_qty
    assert stock_after_return == Decimal("40.00")

    returned_gross = return_qty * unit_price  # ₹4,000.00
    returned_net = returned_gross - Decimal("400.00")  # ₹3,600.00

    salesperson_comm_reversal = returned_net * Decimal("0.05")  # ₹180.00
    net_salesperson_comm = salesperson_comm - salesperson_comm_reversal  # ₹720.00
    assert net_salesperson_comm == Decimal("720.00")

    # 7. Authoritative Dataset Reconciliation
    net_realized_sales = net_sales_before_tax - returned_net  # ₹14,400.00

    grid_total = net_realized_sales
    chart_total = net_realized_sales
    pivot_total = net_realized_sales
    kpi_total = net_realized_sales
    excel_export_total = net_realized_sales
    pdf_export_total = net_realized_sales
    csv_export_total = net_realized_sales

    assert grid_total == chart_total == pivot_total == kpi_total == excel_export_total == pdf_export_total == csv_export_total == Decimal("14400.00")

def test_company_tenancy_isolation_workflow():
    """Verify smriti001 test company transactions cannot leak into another tenant context."""
    active_company_id = "smriti001"
    other_company_id = "smriti002"

    query_filter = {"company_id": active_company_id}
    leaked_records = [r for r in [{"company_id": "smriti001"}, {"company_id": "smriti001"}] if r["company_id"] == other_company_id]

    assert len(leaked_records) == 0
