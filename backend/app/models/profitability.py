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

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity

class ProductCostValuation(BaseEntity):
    """SMRITI Retail OS - Multi-Valuation Cost Price Engine."""
    __tablename__ = "product_cost_valuations"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    purchase_cost = Column(Numeric(15, 2), default=0.00)
    weighted_average_cost = Column(Numeric(15, 2), default=0.00)
    last_purchase_cost = Column(Numeric(15, 2), default=0.00)
    fifo_cost = Column(Numeric(15, 2), default=0.00)
    landed_cost = Column(Numeric(15, 2), default=0.00)  # Purchase cost + freight + handling + duties
    standard_cost = Column(Numeric(15, 2), default=0.00)
    mrp = Column(Numeric(15, 2), default=0.00)
    selling_price = Column(Numeric(15, 2), default=0.00)
    transfer_cost = Column(Numeric(15, 2), default=0.00)
    replacement_cost = Column(Numeric(15, 2), default=0.00)
    updated_at = Column(DateTime, default=datetime.utcnow)

class TransactionCostSnapshot(BaseEntity):
    """Immutable COGS & Cost Valuation Snapshot per Invoice Item Line."""
    __tablename__ = "transaction_cost_snapshots"

    sales_invoice_id = Column(String(50), nullable=False, index=True)
    sales_invoice_item_id = Column(String(50), nullable=False, index=True)
    product_id = Column(String(50), nullable=False, index=True)
    valuation_method_used = Column(String(30), default="WEIGHTED_AVERAGE")  # WAC, FIFO, LANDED_COST, LAST_PURCHASE
    quantity = Column(Numeric(12, 3), nullable=False)
    cost_per_unit = Column(Numeric(15, 2), nullable=False)
    total_cogs = Column(Numeric(15, 2), nullable=False)
    selling_price_per_unit = Column(Numeric(15, 2), nullable=False)
    total_gross_sales = Column(Numeric(15, 2), nullable=False)
    gross_profit = Column(Numeric(15, 2), nullable=False)  # Gross Sales - COGS
    timestamp = Column(DateTime, default=datetime.utcnow)

class InvoiceProfitabilityLedger(BaseEntity):
    """True Transaction-Level Net Contribution & Profitability Ledger."""
    __tablename__ = "invoice_profitability_ledgers"

    sales_invoice_id = Column(String(50), nullable=False, unique=True, index=True)
    gross_sales_amount = Column(Numeric(15, 2), nullable=False)
    total_cogs = Column(Numeric(15, 2), nullable=False)
    gross_profit = Column(Numeric(15, 2), nullable=False)  # Gross Sales - COGS
    salesperson_commission = Column(Numeric(15, 2), default=0.00)
    driver_commission = Column(Numeric(15, 2), default=0.00)
    promotion_discount = Column(Numeric(15, 2), default=0.00)
    loyalty_cost = Column(Numeric(15, 2), default=0.00)
    referral_cost = Column(Numeric(15, 2), default=0.00)
    delivery_cost = Column(Numeric(15, 2), default=0.00)
    net_contribution = Column(Numeric(15, 2), nullable=False)  # Gross Profit - Commissions - Discounts - Loyalty - Referral - Delivery
    net_margin_percent = Column(Numeric(5, 2), default=0.00)
    timestamp = Column(DateTime, default=datetime.utcnow)
