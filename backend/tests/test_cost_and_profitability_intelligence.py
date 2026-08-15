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
from datetime import datetime, timezone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot, InvoiceProfitabilityLedger

def test_multi_valuation_cost_price_engine():
    """Verify multi-valuation cost price engine data structure."""
    pcv = ProductCostValuation(
        product_id="prod_1001",
        purchase_cost=500.00,
        weighted_average_cost=520.00,
        last_purchase_cost=530.00,
        fifo_cost=515.00,
        landed_cost=550.00,  # + Freight ₹30, Handling ₹20
        standard_cost=500.00,
        mrp=1000.00,
        selling_price=800.00
    )
    assert pcv.landed_cost == 550.00
    assert pcv.weighted_average_cost == 520.00

def test_transaction_cogs_snapshot_and_gross_profit():
    """Verify immutable COGS snapshot and gross profit calculation for 10 units sold @ ₹800 each with WAC cost ₹520."""
    qty = 10.0
    cost_per_unit = 520.00
    selling_price = 800.00

    total_gross_sales = qty * selling_price  # ₹8,000
    total_cogs = qty * cost_per_unit         # ₹5,200
    gross_profit = total_gross_sales - total_cogs  # ₹2,800

    snapshot = TransactionCostSnapshot(
        sales_invoice_id="inv_100125",
        sales_invoice_item_id="item_001",
        product_id="prod_1001",
        valuation_method_used="WEIGHTED_AVERAGE",
        quantity=qty,
        cost_per_unit=cost_per_unit,
        total_cogs=total_cogs,
        selling_price_per_unit=selling_price,
        total_gross_sales=total_gross_sales,
        gross_profit=gross_profit
    )
    assert snapshot.total_gross_sales == 8000.00
    assert snapshot.total_cogs == 5200.00
    assert snapshot.gross_profit == 2800.00

def test_invoice_net_contribution_calculation():
    """
    Verify Net Contribution Waterfall Formula:
    Gross Sales (₹10,000) - COGS (₹6,000) = Gross Profit (₹4,000)
    Gross Profit (₹4,000) - Sales Comm (₹200) - Driver Comm (₹50) - Promo Disc (₹500) - Loyalty (₹100) - Referral (₹100) - Delivery (₹50)
    = Net Contribution (₹3,000) (30% Net Margin)
    """
    gross_sales = 10000.00
    cogs = 6000.00
    gross_profit = gross_sales - cogs  # ₹4,000

    sp_comm = 200.00
    driver_comm = 50.00
    promo_disc = 500.00
    loyalty_cost = 100.00
    referral_cost = 100.00
    delivery_cost = 50.00

    total_deductions = sp_comm + driver_comm + promo_disc + loyalty_cost + referral_cost + delivery_cost  # ₹1,000
    net_contrib = gross_profit - total_deductions  # ₹3,000
    net_margin_pct = (net_contrib / gross_sales) * 100.0  # 30.0%

    ledger = InvoiceProfitabilityLedger(
        sales_invoice_id="inv_100125",
        gross_sales_amount=gross_sales,
        total_cogs=cogs,
        gross_profit=gross_profit,
        salesperson_commission=sp_comm,
        driver_commission=driver_comm,
        promotion_discount=promo_disc,
        loyalty_cost=loyalty_cost,
        referral_cost=referral_cost,
        delivery_cost=delivery_cost,
        net_contribution=net_contrib,
        net_margin_percent=net_margin_pct
    )
    assert ledger.gross_profit == 4000.00
    assert ledger.net_contribution == 3000.00
    assert ledger.net_margin_percent == 30.00

def test_cost_profitability_co_location_in_smriti001():
    """Verify profitability tables reside in smriti001 without separate databases."""
    profitability_tables = [
        ProductCostValuation.__tablename__,
        TransactionCostSnapshot.__tablename__,
        InvoiceProfitabilityLedger.__tablename__
    ]
    expected = [
        "product_cost_valuations", "transaction_cost_snapshots", "invoice_profitability_ledgers"
    ]
    assert profitability_tables == expected
