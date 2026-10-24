"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.17.0
* Created    : 2026-10-22
* Modified   : 2026-10-22
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Target     : Centralized Report Field Metadata & Dynamic Aggregation Engine
* Classification: Internal
"""

from enum import Enum
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass


class FieldSemanticType(str, Enum):
    DIMENSION = "DIMENSION"
    ADDITIVE_MEASURE = "ADDITIVE_MEASURE"
    NON_ADDITIVE_MEASURE = "NON_ADDITIVE_MEASURE"
    COUNT_MEASURE = "COUNT_MEASURE"
    SNAPSHOT_BALANCE = "SNAPSHOT_BALANCE"


class AggregationFunction(str, Enum):
    SUM = "SUM"
    COUNT = "COUNT"
    COUNT_DISTINCT = "COUNT_DISTINCT"
    AVG = "AVG"
    WEIGHTED_AVG = "WEIGHTED_AVG"
    MIN = "MIN"
    MAX = "MAX"
    LATEST = "LATEST"
    NONE = "NONE"


@dataclass
class ReportFieldMeta:
    key: str
    label: str
    category: str
    semantic_type: FieldSemanticType
    default_aggregation: AggregationFunction
    datatype: str  # text, number, currency, date, badge
    weight_field_key: Optional[str] = None  # for weighted average (e.g. quantity)
    is_grouping_key: bool = False
    description: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Canonical Catalog of Field Metadata across Retail Domains
# ─────────────────────────────────────────────────────────────────────────────
REPORT_FIELD_REGISTRY: Dict[str, Dict[str, ReportFieldMeta]] = {
    # ── Purchase Domain ──────────────────────────────────────────────────────
    "Purchase": {
        "supplier": ReportFieldMeta(
            key="supplier",
            label="Supplier",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier legal trade name",
        ),
        "supplier_code": ReportFieldMeta(
            key="supplier_code",
            label="Supplier Code",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier alphanumeric code",
        ),
        "supplier_city": ReportFieldMeta(
            key="supplier_city",
            label="City",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier operational city",
        ),
        "city": ReportFieldMeta(
            key="city",
            label="City",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier operational city alias",
        ),
        "po_no": ReportFieldMeta(
            key="po_no",
            label="PO No",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Purchase order number",
        ),
        "po_date": ReportFieldMeta(
            key="po_date",
            label="PO Date",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="date",
            is_grouping_key=True,
            description="Purchase order issue date",
        ),
        "invoice_no": ReportFieldMeta(
            key="invoice_no",
            label="Invoice No",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier commercial invoice / bill number",
        ),
        "article_sku": ReportFieldMeta(
            key="article_sku",
            label="Article / SKU",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Item article or style SKU code",
        ),
        "color": ReportFieldMeta(
            key="color",
            label="Color",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product color variant",
        ),
        "size": ReportFieldMeta(
            key="size",
            label="Size",
            category="Purchase",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",  # Classified as dimension, NOT additive number!
            is_grouping_key=True,
            description="Product size variant (must NOT be summed as a measure)",
        ),
        "quantity": ReportFieldMeta(
            key="quantity",
            label="Quantity",
            category="Purchase",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="number",
            is_grouping_key=False,
            description="Total purchased unit quantity",
        ),
        "net_amount": ReportFieldMeta(
            key="net_amount",
            label="Net Amount",
            category="Purchase",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Total purchase line net monetary amount",
        ),
    },

    # ── Sales Domain ─────────────────────────────────────────────────────────
    "Sales": {
        "sale_invoice_no": ReportFieldMeta(
            key="sale_invoice_no",
            label="Invoice No",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Sales invoice number",
        ),
        "sale_date": ReportFieldMeta(
            key="sale_date",
            label="Invoice Date",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="date",
            is_grouping_key=True,
            description="Sales invoice date",
        ),
        "customer_name": ReportFieldMeta(
            key="customer_name",
            label="Customer",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Customer name",
        ),
        "staff_name": ReportFieldMeta(
            key="staff_name",
            label="Sales Staff",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Staff / cashier handling the sale",
        ),
        "article_sku": ReportFieldMeta(
            key="article_sku",
            label="Article / SKU",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product SKU sold",
        ),
        "color": ReportFieldMeta(
            key="color",
            label="Color",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product color sold",
        ),
        "size": ReportFieldMeta(
            key="size",
            label="Size",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product size sold",
        ),
        "payment_mode": ReportFieldMeta(
            key="payment_mode",
            label="Payment Mode",
            category="Sales",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="badge",
            is_grouping_key=True,
            description="Primary payment tender",
        ),
        "quantity": ReportFieldMeta(
            key="quantity",
            label="Quantity",
            category="Sales",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="number",
            is_grouping_key=False,
            description="Units sold",
        ),
        "gross_total": ReportFieldMeta(
            key="gross_total",
            label="Gross Total",
            category="Sales",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Gross sales value before tax/discounts",
        ),
        "tax_amount": ReportFieldMeta(
            key="tax_amount",
            label="Tax Amount",
            category="Sales",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="GST tax liability",
        ),
        "net_total": ReportFieldMeta(
            key="net_total",
            label="Net Total",
            category="Sales",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Net invoice value",
        ),
    },

    # ── Inventory Domain ─────────────────────────────────────────────────────
    "Inventory": {
        "warehouse": ReportFieldMeta(
            key="warehouse",
            label="Warehouse",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Warehouse or branch godown",
        ),
        "item_code": ReportFieldMeta(
            key="item_code",
            label="Item Code",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Master item code",
        ),
        "item_category": ReportFieldMeta(
            key="item_category",
            label="Category",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product category taxonomy",
        ),
        "brand": ReportFieldMeta(
            key="brand",
            label="Brand",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product brand label",
        ),
        "color": ReportFieldMeta(
            key="color",
            label="Color",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Color variant",
        ),
        "size": ReportFieldMeta(
            key="size",
            label="Size",
            category="Inventory",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Size variant",
        ),
        "stock_on_hand": ReportFieldMeta(
            key="stock_on_hand",
            label="Stock On Hand",
            category="Inventory",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="number",
            is_grouping_key=False,
            description="Physical stock on hand quantity",
        ),
        "reserved_qty": ReportFieldMeta(
            key="reserved_qty",
            label="Reserved Qty",
            category="Inventory",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="number",
            is_grouping_key=False,
            description="Stock allocated to active orders",
        ),
        "available_qty": ReportFieldMeta(
            key="available_qty",
            label="Available Qty",
            category="Inventory",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="number",
            is_grouping_key=False,
            description="Stock freely available for sale",
        ),
        "reorder_level": ReportFieldMeta(
            key="reorder_level",
            label="Reorder Level",
            category="Inventory",
            semantic_type=FieldSemanticType.NON_ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.MAX,
            datatype="number",
            is_grouping_key=False,
            description="Replenishment trigger threshold",
        ),
        "valuation_cost": ReportFieldMeta(
            key="valuation_cost",
            label="Valuation Cost",
            category="Inventory",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Current asset inventory valuation",
        ),
    },

    # ── Items Domain ─────────────────────────────────────────────────────────
    "Items": {
        "item_code": ReportFieldMeta(
            key="item_code",
            label="Item Code",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product unique item code",
        ),
        "item_name": ReportFieldMeta(
            key="item_name",
            label="Item Name",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product descriptive name",
        ),
        "item_category": ReportFieldMeta(
            key="item_category",
            label="Category",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product category",
        ),
        "brand": ReportFieldMeta(
            key="brand",
            label="Brand",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product brand",
        ),
        "color": ReportFieldMeta(
            key="color",
            label="Color",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product color",
        ),
        "size": ReportFieldMeta(
            key="size",
            label="Size",
            category="Items",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Product size",
        ),
        "mrp": ReportFieldMeta(
            key="mrp",
            label="MRP",
            category="Items",
            semantic_type=FieldSemanticType.NON_ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.AVG,
            datatype="currency",
            is_grouping_key=False,
            description="Maximum Retail Price (non-additive rate)",
        ),
        "standard_cost": ReportFieldMeta(
            key="standard_cost",
            label="Standard Cost",
            category="Items",
            semantic_type=FieldSemanticType.NON_ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.AVG,
            datatype="currency",
            is_grouping_key=False,
            description="Standard acquisition cost",
        ),
        "selling_price": ReportFieldMeta(
            key="selling_price",
            label="Selling Price",
            category="Items",
            semantic_type=FieldSemanticType.NON_ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.AVG,
            datatype="currency",
            is_grouping_key=False,
            description="Effective retail selling price",
        ),
    },

    # ── Customers Domain ─────────────────────────────────────────────────────
    "Customers": {
        "customer_code": ReportFieldMeta(
            key="customer_code",
            label="Customer Code",
            category="Customers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Customer identifier",
        ),
        "crm_name": ReportFieldMeta(
            key="crm_name",
            label="Customer Name",
            category="Customers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Customer primary name",
        ),
        "phone": ReportFieldMeta(
            key="phone",
            label="Phone",
            category="Customers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=False,
            description="Primary contact number",
        ),
        "city": ReportFieldMeta(
            key="city",
            label="City",
            category="Customers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Billing or operational city",
        ),
        "outstanding_balance": ReportFieldMeta(
            key="outstanding_balance",
            label="Outstanding Balance",
            category="Customers",
            semantic_type=FieldSemanticType.SNAPSHOT_BALANCE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Current unpaid ledger exposure",
        ),
    },

    # ── Suppliers Domain ─────────────────────────────────────────────────────
    "Suppliers": {
        "supplier_code": ReportFieldMeta(
            key="supplier_code",
            label="Supplier Code",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Vendor code",
        ),
        "sup_full_name": ReportFieldMeta(
            key="sup_full_name",
            label="Supplier Name",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier legal name",
        ),
        "supplier": ReportFieldMeta(
            key="supplier",
            label="Supplier",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier alias",
        ),
        "supplier_gstin": ReportFieldMeta(
            key="supplier_gstin",
            label="GSTIN",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=False,
            description="Supplier GSTIN compliance identifier",
        ),
        "supplier_city": ReportFieldMeta(
            key="supplier_city",
            label="City",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Supplier headquarters city",
        ),
        "city": ReportFieldMeta(
            key="city",
            label="City",
            category="Suppliers",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="City alias",
        ),
        "supplier_balance": ReportFieldMeta(
            key="supplier_balance",
            label="Current Balance",
            category="Suppliers",
            semantic_type=FieldSemanticType.SNAPSHOT_BALANCE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Payable ledger balance",
        ),
    },

    # ── Finance Domain ───────────────────────────────────────────────────────
    "Finance": {
        "account_code": ReportFieldMeta(
            key="account_code",
            label="Account Code",
            category="Finance",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Chart of Accounts code",
        ),
        "account_name": ReportFieldMeta(
            key="account_name",
            label="Account Name",
            category="Finance",
            semantic_type=FieldSemanticType.DIMENSION,
            default_aggregation=AggregationFunction.NONE,
            datatype="text",
            is_grouping_key=True,
            description="Ledger account name",
        ),
        "debit_total": ReportFieldMeta(
            key="debit_total",
            label="Debit Total",
            category="Finance",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Cumulative debit side entries",
        ),
        "credit_total": ReportFieldMeta(
            key="credit_total",
            label="Credit Total",
            category="Finance",
            semantic_type=FieldSemanticType.ADDITIVE_MEASURE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Cumulative credit side entries",
        ),
        "closing_balance": ReportFieldMeta(
            key="closing_balance",
            label="Closing Balance",
            category="Finance",
            semantic_type=FieldSemanticType.SNAPSHOT_BALANCE,
            default_aggregation=AggregationFunction.SUM,
            datatype="currency",
            is_grouping_key=False,
            description="Net closing ledger balance",
        ),
    },
}


class ReportFieldRegistry:
    """
    Centralized metadata service to query field semantics, identify grouping dimensions,
    and resolve aggregation functions without hardcoded assumptions.
    """

    @classmethod
    def get_field_meta(cls, category: str, field_key: str) -> Optional[ReportFieldMeta]:
        norm_cat = (category or "Purchase").capitalize()
        # Direct lookup
        if norm_cat in REPORT_FIELD_REGISTRY and field_key in REPORT_FIELD_REGISTRY[norm_cat]:
            return REPORT_FIELD_REGISTRY[norm_cat][field_key]
        # Cross-domain fallback
        for cat_meta in REPORT_FIELD_REGISTRY.values():
            if field_key in cat_meta:
                return cat_meta[field_key]
        return None

    @classmethod
    def is_dimension(cls, category: str, field_key: str) -> bool:
        meta = cls.get_field_meta(category, field_key)
        if meta:
            return meta.semantic_type == FieldSemanticType.DIMENSION
        # Safe fallback: known measures are NOT dimensions
        known_measures = {
            "quantity", "net_amount", "gross_total", "tax_amount", "net_total",
            "stock_on_hand", "reserved_qty", "available_qty", "valuation_cost",
            "debit_total", "credit_total", "outstanding_balance", "supplier_balance",
            "mrp", "standard_cost", "selling_price"
        }
        return field_key not in known_measures

    @classmethod
    def is_additive_measure(cls, category: str, field_key: str) -> bool:
        meta = cls.get_field_meta(category, field_key)
        if meta:
            return meta.semantic_type in (FieldSemanticType.ADDITIVE_MEASURE, FieldSemanticType.SNAPSHOT_BALANCE)
        known_additives = {
            "quantity", "net_amount", "gross_total", "tax_amount", "net_total",
            "stock_on_hand", "reserved_qty", "available_qty", "valuation_cost",
            "debit_total", "credit_total", "outstanding_balance", "supplier_balance"
        }
        return field_key in known_additives

    @classmethod
    def get_aggregation_type(cls, category: str, field_key: str) -> AggregationFunction:
        meta = cls.get_field_meta(category, field_key)
        if meta:
            return meta.default_aggregation
        if cls.is_additive_measure(category, field_key):
            return AggregationFunction.SUM
        return AggregationFunction.NONE

    @classmethod
    def partition_columns(
        cls, category: str, column_keys: List[str]
    ) -> Dict[str, List[str]]:
        """
        Partitions an input list of column keys into:
        - 'dimensions': Grouping dimensions to include in GROUP BY.
        - 'additive_measures': Measures to SUM.
        - 'non_additive_measures': Measures to AVG/WEIGHTED_AVG.
        """
        dimensions: List[str] = []
        additive_measures: List[str] = []
        non_additive_measures: List[str] = []

        for key in column_keys:
            clean_key = key.strip()
            if not clean_key:
                continue
            meta = cls.get_field_meta(category, clean_key)
            if meta:
                if meta.semantic_type == FieldSemanticType.DIMENSION:
                    dimensions.append(clean_key)
                elif meta.semantic_type in (FieldSemanticType.ADDITIVE_MEASURE, FieldSemanticType.SNAPSHOT_BALANCE):
                    additive_measures.append(clean_key)
                elif meta.semantic_type == FieldSemanticType.NON_ADDITIVE_MEASURE:
                    non_additive_measures.append(clean_key)
                else:
                    dimensions.append(clean_key)
            else:
                if cls.is_additive_measure(category, clean_key):
                    additive_measures.append(clean_key)
                else:
                    dimensions.append(clean_key)

        return {
            "dimensions": dimensions,
            "additive_measures": additive_measures,
            "non_additive_measures": non_additive_measures,
        }
