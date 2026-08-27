"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Governed Metric Dictionary (v1.0.0-GA).
Single Source of Truth for all Retail & Financial KPI Mathematical Definitions.
Enforces Invariant 2: No KPI defines its own formula outside this dictionary.
"""

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, Any, Optional, List, Callable
from pydantic import BaseModel, Field


class MetricCategory(str, Enum):
    SALES = "SALES"
    DISCOUNT = "DISCOUNT"
    TAX = "TAX"
    PROFITABILITY = "PROFITABILITY"
    INVENTORY = "INVENTORY"
    CUSTOMER_BASKET = "CUSTOMER_BASKET"
    STAFF = "STAFF"


class MetricDataType(str, Enum):
    CURRENCY = "CURRENCY"
    QUANTITY = "QUANTITY"
    PERCENTAGE = "PERCENTAGE"
    RATIO = "RATIO"
    COUNT = "COUNT"
    INTEGER = "INTEGER"


class GovernedMetric(BaseModel):
    metric_id: str = Field(..., description="Unique immutable metric identifier e.g. MTR_NET_SALES")
    name: str = Field(..., description="Business-friendly metric title")
    category: MetricCategory
    datatype: MetricDataType
    unit: str = Field("₹", description="Unit symbol (₹, %, units, etc.)")
    formula_expression: str = Field(..., description="Canonical algebraic formula representation")
    description: str = Field(..., description="Authoritative definition and business meaning")
    version: str = Field("v1.0", description="Metric governance version")
    is_financial_sensitive: bool = Field(False, description="True if requires elevated role (e.g., Margin, Cost)")


# ---------------------------------------------------------------------------
# Pure Calculation Utilities (Deterministic Decimal Precision)
# ---------------------------------------------------------------------------

def _d(val: Any) -> Decimal:
    """Safe Decimal conversion with zero fallback."""
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def _round2(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_net_sales(
    gross_sales: Any,
    line_discounts: Any,
    header_concessions: Any,
    sales_returns: Any,
    taxable_adjustments: Any = 0
) -> Decimal:
    """
    Canonical Net Sales Formula:
    Net Sales = Gross Sales - Line Discounts - Header Concessions - Sales Returns + Taxable Adjustments
    """
    g = _d(gross_sales)
    ld = _d(line_discounts)
    hc = _d(header_concessions)
    sr = _d(sales_returns)
    ta = _d(taxable_adjustments)
    return _round2(g - ld - hc - sr + ta)


def calculate_abv(net_sales: Any, total_invoices: Any) -> Decimal:
    """
    Average Basket Value (ABV) = Net Sales / Total Invoices
    """
    ns = _d(net_sales)
    cnt = _d(total_invoices)
    if cnt <= 0:
        return Decimal("0.00")
    return _round2(ns / cnt)


def calculate_upt(total_units_sold: Any, total_invoices: Any) -> Decimal:
    """
    Units Per Transaction (UPT) = Total Net Units Sold / Total Invoices
    """
    units = _d(total_units_sold)
    cnt = _d(total_invoices)
    if cnt <= 0:
        return Decimal("0.00")
    return (units / cnt).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_gross_margin_amt(net_sales: Any, cogs: Any) -> Decimal:
    """
    Gross Margin (₹) = Net Sales - Cost of Goods Sold (COGS)
    """
    ns = _d(net_sales)
    cost = _d(cogs)
    return _round2(ns - cost)


def calculate_gross_margin_pct(net_sales: Any, cogs: Any) -> Decimal:
    """
    Gross Margin (%) = ((Net Sales - COGS) / Net Sales) * 100
    """
    ns = _d(net_sales)
    cost = _d(cogs)
    if ns <= 0:
        return Decimal("0.00")
    margin_amt = ns - cost
    return _round2((margin_amt / ns) * Decimal("100.00"))


def calculate_gmroi(gross_margin_amt: Any, avg_inventory_cost: Any) -> Decimal:
    """
    Gross Margin Return on Investment (GMROI) = Gross Margin (₹) / Average Inventory Cost (₹)
    """
    gm = _d(gross_margin_amt)
    inv = _d(avg_inventory_cost)
    if inv <= 0:
        return Decimal("0.00")
    return _round2(gm / inv)


def calculate_sell_through_pct(units_sold: Any, starting_stock_units: Any) -> Decimal:
    """
    Sell-Through (%) = (Units Sold / Starting Stock Units) * 100
    """
    sold = _d(units_sold)
    start = _d(starting_stock_units)
    if start <= 0:
        return Decimal("0.00")
    return _round2((sold / start) * Decimal("100.00"))


def calculate_stock_aging_bucket(days: int) -> str:
    """
    Standard Retail Stock Aging Partition.
    """
    if days <= 30:
        return "0-30 Days"
    elif days <= 60:
        return "31-60 Days"
    elif days <= 90:
        return "61-90 Days"
    else:
        return "90+ Days (Aged)"


# ---------------------------------------------------------------------------
# GOVERNED METRIC CATALOG (Master Single Source of Truth)
# ---------------------------------------------------------------------------

GOVERNED_METRICS: Dict[str, GovernedMetric] = {
    # --- SALES METRICS ---
    "MTR_GROSS_SALES": GovernedMetric(
        metric_id="MTR_GROSS_SALES",
        name="Gross Sales Volume",
        category=MetricCategory.SALES,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(item_qty * unit_rate_or_mrp)",
        description="Total gross value of merchandise billed before line discounts, concessions, and returns.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_LINE_DISCOUNT": GovernedMetric(
        metric_id="MTR_LINE_DISCOUNT",
        name="Line Item Discounts",
        category=MetricCategory.DISCOUNT,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(item_discount_amount)",
        description="Total item-level discount concessions applied across all billed lines.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_HEADER_CONCESSION": GovernedMetric(
        metric_id="MTR_HEADER_CONCESSION",
        name="Bill Header Concessions",
        category=MetricCategory.DISCOUNT,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(invoice_discount_amount)",
        description="Total bill-level concessions or coupons applied to invoice totals.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_SALES_RETURNS": GovernedMetric(
        metric_id="MTR_SALES_RETURNS",
        name="Sales Returns & Refunds",
        category=MetricCategory.SALES,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(return_item_net_amount)",
        description="Total value of merchandise returned and credit notes issued.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_NET_SALES": GovernedMetric(
        metric_id="MTR_NET_SALES",
        name="Net Sales Realization",
        category=MetricCategory.SALES,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="Gross_Sales - Line_Discounts - Header_Concessions - Sales_Returns + Taxable_Adjustments",
        description="Authoritative Net Revenue generated from commercial transactions.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_INVOICE_COUNT": GovernedMetric(
        metric_id="MTR_INVOICE_COUNT",
        name="Total Bills Cut",
        category=MetricCategory.SALES,
        datatype=MetricDataType.COUNT,
        unit="bills",
        formula_expression="COUNT(DISTINCT invoice_id)",
        description="Total count of unique finalized commercial invoices generated.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_UNITS_SOLD": GovernedMetric(
        metric_id="MTR_UNITS_SOLD",
        name="Total Units Sold",
        category=MetricCategory.SALES,
        datatype=MetricDataType.QUANTITY,
        unit="units",
        formula_expression="SUM(item_qty) - SUM(return_item_qty)",
        description="Net physical merchandise pieces or units sold.",
        version="v1.0",
        is_financial_sensitive=False,
    ),

    # --- TAX & COMPLIANCE METRICS ---
    "MTR_TAXABLE_AMOUNT": GovernedMetric(
        metric_id="MTR_TAXABLE_AMOUNT",
        name="GST Taxable Value",
        category=MetricCategory.TAX,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(taxable_base_value)",
        description="Assessable value for GST computation across B2B, B2CL, B2CS.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_CGST_AMOUNT": GovernedMetric(
        metric_id="MTR_CGST_AMOUNT",
        name="Central GST (CGST)",
        category=MetricCategory.TAX,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(cgst_amount)",
        description="Total Central Goods and Services Tax collected.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_SGST_AMOUNT": GovernedMetric(
        metric_id="MTR_SGST_AMOUNT",
        name="State GST (SGST)",
        category=MetricCategory.TAX,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(sgst_amount)",
        description="Total State Goods and Services Tax collected.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_IGST_AMOUNT": GovernedMetric(
        metric_id="MTR_IGST_AMOUNT",
        name="Integrated GST (IGST)",
        category=MetricCategory.TAX,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(igst_amount)",
        description="Total Integrated Goods and Services Tax collected for interstate sales.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_TAX_TOTAL": GovernedMetric(
        metric_id="MTR_TAX_TOTAL",
        name="Total GST Liability",
        category=MetricCategory.TAX,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="CGST + SGST + IGST + Cess",
        description="Total combined tax liability collected on behalf of revenue authorities.",
        version="v1.0",
        is_financial_sensitive=False,
    ),

    # --- BASKET & OFFTAKE METRICS ---
    "MTR_ABV": GovernedMetric(
        metric_id="MTR_ABV",
        name="Average Basket Value (ABV)",
        category=MetricCategory.CUSTOMER_BASKET,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="Net_Sales / Total_Invoices",
        description="Average commercial ticket spend per finalized customer invoice.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_UPT": GovernedMetric(
        metric_id="MTR_UPT",
        name="Units Per Transaction (UPT)",
        category=MetricCategory.CUSTOMER_BASKET,
        datatype=MetricDataType.RATIO,
        unit="items/bill",
        formula_expression="Total_Units_Sold / Total_Invoices",
        description="Average number of merchandise units purchased per basket.",
        version="v1.0",
        is_financial_sensitive=False,
    ),

    # --- PROFITABILITY & MARGIN METRICS ---
    "MTR_COGS": GovernedMetric(
        metric_id="MTR_COGS",
        name="Cost of Goods Sold (COGS)",
        category=MetricCategory.PROFITABILITY,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(item_qty * landed_unit_cost)",
        description="Acquisition and landed cost of merchandise sold.",
        version="v1.0",
        is_financial_sensitive=True,
    ),
    "MTR_GROSS_MARGIN_AMT": GovernedMetric(
        metric_id="MTR_GROSS_MARGIN_AMT",
        name="Gross Profit (₹)",
        category=MetricCategory.PROFITABILITY,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="Net_Sales - COGS",
        description="Absolute commercial gross margin contribution.",
        version="v1.0",
        is_financial_sensitive=True,
    ),
    "MTR_GROSS_MARGIN_PCT": GovernedMetric(
        metric_id="MTR_GROSS_MARGIN_PCT",
        name="Gross Margin (%)",
        category=MetricCategory.PROFITABILITY,
        datatype=MetricDataType.PERCENTAGE,
        unit="%",
        formula_expression="((Net_Sales - COGS) / Net_Sales) * 100",
        description="Gross profit percentage on net revenue.",
        version="v1.0",
        is_financial_sensitive=True,
    ),
    "MTR_GMROI": GovernedMetric(
        metric_id="MTR_GMROI",
        name="Gross Margin Return on Investment (GMROI)",
        category=MetricCategory.PROFITABILITY,
        datatype=MetricDataType.RATIO,
        unit="x",
        formula_expression="Gross_Margin_Amt / Average_Inventory_Cost",
        description="Productivity metric evaluating gross profit generated for every rupee of inventory held.",
        version="v1.0",
        is_financial_sensitive=True,
    ),

    # --- INVENTORY & VALUATION METRICS ---
    "MTR_STOCK_ON_HAND_QTY": GovernedMetric(
        metric_id="MTR_STOCK_ON_HAND_QTY",
        name="Stock on Hand (Quantity)",
        category=MetricCategory.INVENTORY,
        datatype=MetricDataType.QUANTITY,
        unit="units",
        formula_expression="Opening_Stock + Inward_Qty - Outward_Qty +/- Adjustments",
        description="Physical units available in store / warehouse inventory.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
    "MTR_STOCK_VALUATION_AMT": GovernedMetric(
        metric_id="MTR_STOCK_VALUATION_AMT",
        name="Inventory Valuation (Cost)",
        category=MetricCategory.INVENTORY,
        datatype=MetricDataType.CURRENCY,
        unit="₹",
        formula_expression="SUM(stock_on_hand_qty * unit_landed_cost)",
        description="Financial balance sheet valuation of inventory on hand.",
        version="v1.0",
        is_financial_sensitive=True,
    ),
    "MTR_SELL_THROUGH_PCT": GovernedMetric(
        metric_id="MTR_SELL_THROUGH_PCT",
        name="Sell-Through Rate (%)",
        category=MetricCategory.INVENTORY,
        datatype=MetricDataType.PERCENTAGE,
        unit="%",
        formula_expression="(Units_Sold / Starting_Stock_Units) * 100",
        description="Percentage of inventory intake sold within a given sales cycle.",
        version="v1.0",
        is_financial_sensitive=False,
    ),
}


class GovernedMetricDictionary:
    """Master registry lookup and formula validation engine."""

    @classmethod
    def get_metric(cls, metric_id: str) -> GovernedMetric:
        metric = GOVERNED_METRICS.get(metric_id)
        if not metric:
            raise KeyError(f"Metric '{metric_id}' is not defined in the Governed Metric Dictionary.")
        return metric

    @classmethod
    def list_metrics(cls, category: Optional[MetricCategory] = None) -> List[GovernedMetric]:
        if category:
            return [m for m in GOVERNED_METRICS.values() if m.category == category]
        return list(GOVERNED_METRICS.values())

    @classmethod
    def validate_measures(cls, measure_ids: List[str]) -> List[GovernedMetric]:
        validated = []
        for mid in measure_ids:
            validated.append(cls.get_metric(mid))
        return validated
