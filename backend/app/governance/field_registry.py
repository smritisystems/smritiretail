"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance — Canonical Field Registry SSOT

SMRITI Canonical UX Field Registry (TDB-v2.0 & Field-Gov-v1.0)
══════════════════════════════════════════════════════════════
Governs the single source of truth for all business fields across SMRITI:

    ONE FIELD → ONE CANONICAL DEFINITION → ONE AUTHORITATIVE DB MAPPING → MANY UX REFERENCES

All UX screens, master configs, forms, grids, and API schemas MUST reference
the canonical field IDs defined here instead of independently owning business metadata.
"""

import re
import hashlib
from enum import Enum
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass, field, asdict

# Ensure app.db.ownership is accessible
from app.db.ownership import TABLE_OWNERSHIP, TableOwner, is_tenant_table, is_control_plane_table

CFOC_REGISTRY_VERSION = "3.45.0"


class FieldRegistryViolation(RuntimeError):
    """Raised when a field definition violates registry uniqueness or boundary invariants."""
    pass


class FieldLifecycle(str, Enum):
    """
    SMRITI Canonical Field Lifecycle State Machine.
    DRAFT      - In development/staging; blocked from production UX.
    ACTIVE     - General availability; standard operational use in UI and APIs.
    DEPRECATED - Scheduled for retirement; blocked from being added to new screens.
    RETIRED    - Fully decommissioned; CI fails if referenced anywhere.
    LEGACY     - Historical field; permitted only with an active exception baseline record.
    """
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    DEPRECATED = "DEPRECATED"
    RETIRED = "RETIRED"
    LEGACY = "LEGACY"


@dataclass(frozen=True)
class CanonicalFieldDef:
    """
    Authoritative definition of a single business field in SMRITI.
    Strictly separates:
      1. FIELD DEFINITION (Logical identity, label, validation, lifecycle)
      2. DATABASE MAPPING (db_table, db_column, ownership)
      3. API CONTRACT (api_key, api_endpoint)
    """
    field_id: str                      # e.g. "customer.mobile", "product.barcode" (UNIQUE)
    entity_id: str                     # e.g. "customer", "product", "supplier"
    db_table: str                      # e.g. "customers", "products"
    db_column: str                     # e.g. "mobile", "barcode"
    data_type: str                     # STRING | INTEGER | DECIMAL | BOOLEAN | DATE | DATETIME | JSON
    field_type: str                    # TEXT | NUMBER | DATE | SELECT | BOOLEAN | LOOKUP | CURRENCY | BARCODE
    label: str                         # Canonical display label
    help_text: Optional[str] = None    # Help / tooltip text
    placeholder: Optional[str] = None  # Canonical input placeholder
    required: bool = False             # Is field mandatory by business rule
    editable: bool = True              # Can user modify this field in UI
    searchable: bool = True            # Included in default search filters
    filterable: bool = True            # Available in column / facet filters
    sortable: bool = True              # Supports ORDER BY in grids
    readonly: bool = False             # Read-only display field
    max_length: Optional[int] = None   # Maximum character length
    min_value: Optional[float] = None  # Minimum numeric value
    max_value: Optional[float] = None  # Maximum numeric value
    validation_rule: Optional[str] = None  # e.g. "MOBILE_INDIA", "GSTIN_15", "EMAIL"
    option_source: Optional[str] = None    # Lookup group or options endpoint
    status: str = "ACTIVE"             # FieldLifecycle status
    lifecycle: str = "ACTIVE"          # DRAFT | ACTIVE | DEPRECATED | RETIRED | LEGACY
    ownership: str = "TENANT"          # TENANT | CONTROL_PLANE | SHARED_REFERENCE
    version: int = 1
    aliases: Tuple[str, ...] = ()      # Allowed UX or API aliases
    api_key: Optional[str] = None      # Explicit DTO / API serialization key
    api_endpoint: Optional[str] = None # Canonical REST endpoint


# ---------------------------------------------------------------------------
# Canonical Field Catalog (SSOT)
# ---------------------------------------------------------------------------

CANONICAL_FIELDS: Dict[str, CanonicalFieldDef] = {
    # ── CUSTOMER MASTER (customers) ─────────────────────────────────────────
    "customer.id": CanonicalFieldDef(
        field_id="customer.id", entity_id="customer", db_table="customers", db_column="id",
        data_type="STRING", field_type="TEXT", label="Customer ID", readonly=True, required=True,
        max_length=50, aliases=("customerId", "customer_id")
    ),
    "customer.code": CanonicalFieldDef(
        field_id="customer.code", entity_id="customer", db_table="customers", db_column="code",
        data_type="STRING", field_type="TEXT", label="Customer Code", required=True, max_length=50,
        aliases=("customerCode", "code")
    ),
    "customer.name": CanonicalFieldDef(
        field_id="customer.name", entity_id="customer", db_table="customers", db_column="name",
        data_type="STRING", field_type="TEXT", label="Customer Name", required=True, max_length=200,
        placeholder="e.g. Acme Enterprise / Rahul Sharma", aliases=("customer_name", "customerName")
    ),
    "customer.mobile": CanonicalFieldDef(
        field_id="customer.mobile", entity_id="customer", db_table="customers", db_column="mobile",
        data_type="STRING", field_type="TEXT", label="Mobile Number", required=True, max_length=15,
        placeholder="10-digit mobile number", validation_rule="MOBILE_INDIA",
        aliases=("phone", "contact", "mobile_number", "customer_mobile", "customerMobile")
    ),
    "customer.email": CanonicalFieldDef(
        field_id="customer.email", entity_id="customer", db_table="customers", db_column="email",
        data_type="STRING", field_type="TEXT", label="Email Address", max_length=150,
        placeholder="customer@domain.com", validation_rule="EMAIL",
        aliases=("customer_email", "customerEmail")
    ),
    "customer.gst_number": CanonicalFieldDef(
        field_id="customer.gst_number", entity_id="customer", db_table="customers", db_column="gst_number",
        data_type="STRING", field_type="TEXT", label="GSTIN Number", max_length=15,
        placeholder="15-character GSTIN", validation_rule="GSTIN_15",
        aliases=("gstNumber", "gstin", "customer_gstin", "tax_number")
    ),
    "customer.pan_number": CanonicalFieldDef(
        field_id="customer.pan_number", entity_id="customer", db_table="customers", db_column="pan_number",
        data_type="STRING", field_type="TEXT", label="PAN Number", max_length=10,
        placeholder="10-character PAN", validation_rule="PAN_10",
        aliases=("pan", "panNumber", "pan_no")
    ),
    "customer.customer_group_id": CanonicalFieldDef(
        field_id="customer.customer_group_id", entity_id="customer", db_table="customers", db_column="customer_group_id",
        data_type="STRING", field_type="SELECT", label="Customer Group", option_source="/api/v1/customer-groups",
        aliases=("customerGroupId", "group_id", "group")
    ),
    "customer.pricing_basis": CanonicalFieldDef(
        field_id="customer.pricing_basis", entity_id="customer", db_table="customers", db_column="pricing_basis",
        data_type="STRING", field_type="SELECT", label="Pricing Basis", required=True,
        option_source="PRICING_BASIS_OPTIONS", aliases=("pricingBasis",)
    ),
    "customer.is_tax_inclusive": CanonicalFieldDef(
        field_id="customer.is_tax_inclusive", entity_id="customer", db_table="customers", db_column="is_tax_inclusive",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Tax Inclusive",
        aliases=("isTaxInclusive", "tax_inclusive")
    ),
    "customer.outstanding": CanonicalFieldDef(
        field_id="customer.outstanding", entity_id="customer", db_table="customers", db_column="outstanding",
        data_type="DECIMAL", field_type="CURRENCY", label="Outstanding Balance", readonly=True,
        aliases=("outstandingBalance", "balance", "credit_limit")
    ),
    "customer.status": CanonicalFieldDef(
        field_id="customer.status", entity_id="customer", db_table="customers", db_column="status",
        data_type="STRING", field_type="SELECT", label="Customer Status", option_source="STATUS_ACTIVE_INACTIVE",
        aliases=("customerStatus",)
    ),
    "customer.notes": CanonicalFieldDef(
        field_id="customer.notes", entity_id="customer", db_table="customers", db_column="profile_notes",
        data_type="STRING", field_type="TEXT", label="Profile Notes",
        aliases=("profile_notes", "profileNotes", "remarks")
    ),
    "customer.date_of_birth": CanonicalFieldDef(
        field_id="customer.date_of_birth", entity_id="customer", db_table="customers", db_column="date_of_birth",
        data_type="DATE", field_type="DATE", label="Date of Birth", aliases=("dob", "birthDate")
    ),
    "customer.wedding_anniversary": CanonicalFieldDef(
        field_id="customer.wedding_anniversary", entity_id="customer", db_table="customers", db_column="wedding_anniversary",
        data_type="DATE", field_type="DATE", label="Wedding Anniversary", aliases=("anniversary", "anniversaryDate")
    ),
    "customer.gender": CanonicalFieldDef(
        field_id="customer.gender", entity_id="customer", db_table="customers", db_column="gender",
        data_type="STRING", field_type="SELECT", label="Gender", option_source="GENDER_OPTIONS",
        aliases=("sex",)
    ),
    "customer.is_active": CanonicalFieldDef(
        field_id="customer.is_active", entity_id="customer", db_table="customers", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── CUSTOMER GROUP (customer_groups) ────────────────────────────────────
    "customer_group.id": CanonicalFieldDef(
        field_id="customer_group.id", entity_id="customer_group", db_table="customer_groups", db_column="id",
        data_type="STRING", field_type="TEXT", label="Group ID", readonly=True, required=True
    ),
    "customer_group.name": CanonicalFieldDef(
        field_id="customer_group.name", entity_id="customer_group", db_table="customer_groups", db_column="name",
        data_type="STRING", field_type="TEXT", label="Group Name", required=True, max_length=100,
        aliases=("group_name", "groupName")
    ),
    "customer_group.credit_limit": CanonicalFieldDef(
        field_id="customer_group.credit_limit", entity_id="customer_group", db_table="customer_groups", db_column="credit_limit",
        data_type="DECIMAL", field_type="CURRENCY", label="Credit Limit", min_value=0.0,
        aliases=("creditLimit",)
    ),
    "customer_group.credit_days": CanonicalFieldDef(
        field_id="customer_group.credit_days", entity_id="customer_group", db_table="customer_groups", db_column="credit_days",
        data_type="INTEGER", field_type="NUMBER", label="Credit Days", min_value=0.0,
        aliases=("creditDays",)
    ),
    "customer_group.max_discount_percent": CanonicalFieldDef(
        field_id="customer_group.max_discount_percent", entity_id="customer_group", db_table="customer_groups", db_column="max_discount_percent",
        data_type="DECIMAL", field_type="NUMBER", label="Max Discount %", min_value=0.0, max_value=100.0,
        aliases=("discount", "discount_percentage", "discountPercentage")
    ),
    "customer_group.is_active": CanonicalFieldDef(
        field_id="customer_group.is_active", entity_id="customer_group", db_table="customer_groups", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── ITEM CATALOG (items) ────────────────────────────────────────────────
    "item.id": CanonicalFieldDef(
        field_id="item.id", entity_id="item", db_table="items", db_column="id",
        data_type="STRING", field_type="TEXT", label="Item ID", readonly=True, required=True,
        aliases=("itemId", "item_id")
    ),
    "item.item_code": CanonicalFieldDef(
        field_id="item.item_code", entity_id="item", db_table="items", db_column="item_code",
        data_type="STRING", field_type="TEXT", label="Stock No / SKU", required=True, max_length=50,
        aliases=("code", "sku", "itemCode", "stock_no")
    ),
    "item.item_name": CanonicalFieldDef(
        field_id="item.item_name", entity_id="item", db_table="items", db_column="item_name",
        data_type="STRING", field_type="TEXT", label="Item Name", required=True, max_length=200,
        aliases=("name", "itemName", "product_name", "productName")
    ),
    "item.brand": CanonicalFieldDef(
        field_id="item.brand", entity_id="item", db_table="items", db_column="brand",
        data_type="STRING", field_type="SELECT", label="Brand", option_source="BRANDS",
        aliases=("brand_name", "brandName")
    ),
    "item.category": CanonicalFieldDef(
        field_id="item.category", entity_id="item", db_table="items", db_column="category",
        data_type="STRING", field_type="SELECT", label="Category", option_source="CATEGORIES",
        aliases=("category_name", "categoryName")
    ),
    "item.department": CanonicalFieldDef(
        field_id="item.department", entity_id="item", db_table="items", db_column="department",
        data_type="STRING", field_type="SELECT", label="Department", option_source="DEPARTMENTS"
    ),
    "item.hsn_code": CanonicalFieldDef(
        field_id="item.hsn_code", entity_id="item", db_table="items", db_column="hsn_code",
        data_type="STRING", field_type="TEXT", label="HSN Code", max_length=15,
        aliases=("hsn", "hsnCode", "hsn_sac_code")
    ),
    "item.cost_price": CanonicalFieldDef(
        field_id="item.cost_price", entity_id="item", db_table="items", db_column="cost_price",
        data_type="DECIMAL", field_type="CURRENCY", label="Cost Price", required=True, min_value=0.0,
        aliases=("costPrice", "cost")
    ),
    "item.buying_price": CanonicalFieldDef(
        field_id="item.buying_price", entity_id="item", db_table="items", db_column="buying_price",
        data_type="DECIMAL", field_type="CURRENCY", label="Buying Price", required=True, min_value=0.0,
        aliases=("buyingPrice",)
    ),
    "item.selling_price": CanonicalFieldDef(
        field_id="item.selling_price", entity_id="item", db_table="items", db_column="selling_price",
        data_type="DECIMAL", field_type="CURRENCY", label="Selling Price", required=True, min_value=0.0,
        aliases=("sellingPrice", "price", "sale_price", "salePrice", "item.sale_price")
    ),
    "item.mrp": CanonicalFieldDef(
        field_id="item.mrp", entity_id="item", db_table="items", db_column="mrp",
        data_type="DECIMAL", field_type="CURRENCY", label="Maximum Retail Price (MRP)", required=True, min_value=0.0,
        aliases=("maxRetailPrice",)
    ),
    "item.tax_rate": CanonicalFieldDef(
        field_id="item.tax_rate", entity_id="item", db_table="items", db_column="tax_rate",
        data_type="DECIMAL", field_type="NUMBER", label="GST Tax Rate %", required=True, min_value=0.0, max_value=100.0,
        aliases=("taxRate", "gst_rate", "gstRate", "gst_percentage")
    ),
    "item.status": CanonicalFieldDef(
        field_id="item.status", entity_id="item", db_table="items", db_column="status",
        data_type="STRING", field_type="SELECT", label="Item Status", required=True, option_source="STATUS_ACTIVE_INACTIVE"
    ),
    "item.is_active": CanonicalFieldDef(
        field_id="item.is_active", entity_id="item", db_table="items", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── PHYSICAL SKU PRODUCT (products) ─────────────────────────────────────
    "product.id": CanonicalFieldDef(
        field_id="product.id", entity_id="product", db_table="products", db_column="id",
        data_type="STRING", field_type="TEXT", label="Product ID", readonly=True, required=True,
        aliases=("productId", "product_id")
    ),
    "product.code": CanonicalFieldDef(
        field_id="product.code", entity_id="product", db_table="products", db_column="code",
        data_type="STRING", field_type="TEXT", label="Product Code", required=True, max_length=50,
        aliases=("product_code", "productCode", "item.code")
    ),
    "product.name": CanonicalFieldDef(
        field_id="product.name", entity_id="product", db_table="products", db_column="name",
        data_type="STRING", field_type="TEXT", label="Product Name", required=True, max_length=200,
        aliases=("productName", "description", "item.name")
    ),
    "product.barcode": CanonicalFieldDef(
        field_id="product.barcode", entity_id="product", db_table="products", db_column="barcode",
        data_type="STRING", field_type="BARCODE", label="Barcode", required=True, max_length=50,
        validation_rule="BARCODE", aliases=("ean", "upc", "sku_barcode", "scan_code", "item.barcode")
    ),
    "product.sku": CanonicalFieldDef(
        field_id="product.sku", entity_id="product", db_table="products", db_column="sku",
        data_type="STRING", field_type="TEXT", label="SKU Identifier", max_length=50,
        aliases=("sku_id", "skuId")
    ),
    "product.category": CanonicalFieldDef(
        field_id="product.category", entity_id="product", db_table="products", db_column="category",
        data_type="STRING", field_type="SELECT", label="Category", required=True, option_source="CATEGORIES",
        aliases=("category_name", "categoryName", "item.category")
    ),
    "product.brand": CanonicalFieldDef(
        field_id="product.brand", entity_id="product", db_table="products", db_column="brand",
        data_type="STRING", field_type="SELECT", label="Brand", option_source="BRANDS"
    ),
    "product.buying_price": CanonicalFieldDef(
        field_id="product.buying_price", entity_id="product", db_table="products", db_column="buying_price",
        data_type="DECIMAL", field_type="CURRENCY", label="Buying Price", min_value=0.0,
        aliases=("buyingPrice", "item.buying_price")
    ),
    "product.cost_price": CanonicalFieldDef(
        field_id="product.cost_price", entity_id="product", db_table="products", db_column="cost_price",
        data_type="DECIMAL", field_type="CURRENCY", label="Cost Price", min_value=0.0,
        aliases=("costPrice", "cost", "item.cost_price")
    ),
    "product.price": CanonicalFieldDef(
        field_id="product.price", entity_id="product", db_table="products", db_column="price",
        data_type="DECIMAL", field_type="CURRENCY", label="Selling Price", required=True, min_value=0.0,
        aliases=("selling_price", "sellingPrice", "sale_price", "salePrice", "item.selling_price", "item.sale_price")
    ),
    "product.mrp": CanonicalFieldDef(
        field_id="product.mrp", entity_id="product", db_table="products", db_column="mrp",
        data_type="DECIMAL", field_type="CURRENCY", label="MRP", required=True, min_value=0.0,
        aliases=("item.mrp",)
    ),
    "product.stock": CanonicalFieldDef(
        field_id="product.stock", entity_id="product", db_table="products", db_column="stock",
        data_type="INTEGER", field_type="NUMBER", label="Available Stock", required=True, min_value=0.0,
        aliases=("quantity", "stock_qty", "inventory", "item.stock")
    ),
    "product.gst_percentage": CanonicalFieldDef(
        field_id="product.gst_percentage", entity_id="product", db_table="products", db_column="gst_percentage",
        data_type="DECIMAL", field_type="NUMBER", label="GST %", required=True, min_value=0.0, max_value=100.0,
        aliases=("gst_rate", "gstRate", "tax_rate", "item.tax_rate")
    ),
    "product.hsn_code": CanonicalFieldDef(
        field_id="product.hsn_code", entity_id="product", db_table="products", db_column="hsn_code",
        data_type="STRING", field_type="TEXT", label="HSN Code", max_length=15,
        aliases=("hsnCode", "hsn", "item.hsn_code")
    ),
    "product.is_active": CanonicalFieldDef(
        field_id="product.is_active", entity_id="product", db_table="products", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active", "status", "item.is_active")
    ),

    # ── SUPPLIER / VENDOR (suppliers) ───────────────────────────────────────
    "supplier.id": CanonicalFieldDef(
        field_id="supplier.id", entity_id="supplier", db_table="suppliers", db_column="id",
        data_type="STRING", field_type="TEXT", label="Supplier ID", readonly=True, required=True,
        aliases=("supplierId", "vendor_id")
    ),
    "supplier.code": CanonicalFieldDef(
        field_id="supplier.code", entity_id="supplier", db_table="suppliers", db_column="code",
        data_type="STRING", field_type="TEXT", label="Supplier Code", required=True, max_length=50,
        aliases=("supplier_code", "vendor_code", "supplierCode")
    ),
    "supplier.name": CanonicalFieldDef(
        field_id="supplier.name", entity_id="supplier", db_table="suppliers", db_column="name",
        data_type="STRING", field_type="TEXT", label="Supplier Name", required=True, max_length=200,
        aliases=("supplier_name", "vendor_name", "supplierName")
    ),
    "supplier.mobile": CanonicalFieldDef(
        field_id="supplier.mobile", entity_id="supplier", db_table="suppliers", db_column="mobile",
        data_type="STRING", field_type="TEXT", label="Mobile Number", max_length=15,
        validation_rule="MOBILE_INDIA", aliases=("mobile_number", "phone", "contact", "supplier_mobile")
    ),
    "supplier.email": CanonicalFieldDef(
        field_id="supplier.email", entity_id="supplier", db_table="suppliers", db_column="email",
        data_type="STRING", field_type="TEXT", label="Email Address", max_length=150,
        validation_rule="EMAIL", aliases=("email_address", "supplier_email")
    ),
    "supplier.gst_number": CanonicalFieldDef(
        field_id="supplier.gst_number", entity_id="supplier", db_table="suppliers", db_column="gst_number",
        data_type="STRING", field_type="TEXT", label="GSTIN Number", max_length=15,
        validation_rule="GSTIN_15", aliases=("gst_identification_number", "gstNumber", "gstin", "supplier_gstin")
    ),
    "supplier.address": CanonicalFieldDef(
        field_id="supplier.address", entity_id="supplier", db_table="suppliers", db_column="address",
        data_type="STRING", field_type="TEXT", label="Registered Address", max_length=300
    ),
    "supplier.city": CanonicalFieldDef(
        field_id="supplier.city", entity_id="supplier", db_table="suppliers", db_column="city",
        data_type="STRING", field_type="TEXT", label="City", max_length=100
    ),
    "supplier.state": CanonicalFieldDef(
        field_id="supplier.state", entity_id="supplier", db_table="suppliers", db_column="state",
        data_type="STRING", field_type="TEXT", label="State", max_length=100
    ),
    "supplier.pincode": CanonicalFieldDef(
        field_id="supplier.pincode", entity_id="supplier", db_table="suppliers", db_column="pincode",
        data_type="STRING", field_type="TEXT", label="Pincode", max_length=10
    ),
    "supplier.outstanding": CanonicalFieldDef(
        field_id="supplier.outstanding", entity_id="supplier", db_table="suppliers", db_column="outstanding",
        data_type="DECIMAL", field_type="CURRENCY", label="Current Payables", min_value=0.0,
        aliases=("current_balance", "payables", "balance")
    ),
    "supplier.is_active": CanonicalFieldDef(
        field_id="supplier.is_active", entity_id="supplier", db_table="suppliers", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── SALES ORDER (sales_orders) ──────────────────────────────────────────
    "sales_order.id": CanonicalFieldDef(
        field_id="sales_order.id", entity_id="sales_order", db_table="sales_orders", db_column="id",
        data_type="STRING", field_type="TEXT", label="Order ID", readonly=True, required=True
    ),
    "sales_order.order_no": CanonicalFieldDef(
        field_id="sales_order.order_no", entity_id="sales_order", db_table="sales_orders", db_column="order_no",
        data_type="STRING", field_type="TEXT", label="Order Number", required=True, max_length=50,
        aliases=("order_number", "orderNo")
    ),
    "sales_order.customer_id": CanonicalFieldDef(
        field_id="sales_order.customer_id", entity_id="sales_order", db_table="sales_orders", db_column="customer_id",
        data_type="STRING", field_type="LOOKUP", label="Customer", required=True, option_source="/api/v1/crm/customers",
        aliases=("customerId",)
    ),
    "sales_order.basic_total": CanonicalFieldDef(
        field_id="sales_order.basic_total", entity_id="sales_order", db_table="sales_orders", db_column="basic_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Basic Subtotal", required=True, min_value=0.0,
        aliases=("subtotal", "subTotal")
    ),
    "sales_order.tax_total": CanonicalFieldDef(
        field_id="sales_order.tax_total", entity_id="sales_order", db_table="sales_orders", db_column="tax_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Total Tax", required=True, min_value=0.0,
        aliases=("taxAmount", "tax_amount")
    ),
    "sales_order.grand_total": CanonicalFieldDef(
        field_id="sales_order.grand_total", entity_id="sales_order", db_table="sales_orders", db_column="grand_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Grand Total", required=True, min_value=0.0,
        aliases=("total", "orderTotal", "total_amount")
    ),
    "sales_order.status": CanonicalFieldDef(
        field_id="sales_order.status", entity_id="sales_order", db_table="sales_orders", db_column="status",
        data_type="STRING", field_type="SELECT", label="Order Status", required=True, option_source="SALES_ORDER_STATUSES"
    ),

    # ── SALES INVOICE (sales_invoices) ──────────────────────────────────────
    "sales_invoice.id": CanonicalFieldDef(
        field_id="sales_invoice.id", entity_id="sales_invoice", db_table="sales_invoices", db_column="id",
        data_type="STRING", field_type="TEXT", label="Invoice ID", readonly=True, required=True
    ),
    "sales_invoice.invoice_no": CanonicalFieldDef(
        field_id="sales_invoice.invoice_no", entity_id="sales_invoice", db_table="sales_invoices", db_column="invoice_no",
        data_type="STRING", field_type="TEXT", label="Invoice Number", required=True, max_length=50,
        aliases=("invoice_number", "invoiceNo", "bill_no")
    ),
    "sales_invoice.customer_id": CanonicalFieldDef(
        field_id="sales_invoice.customer_id", entity_id="sales_invoice", db_table="sales_invoices", db_column="customer_id",
        data_type="STRING", field_type="LOOKUP", label="Customer", required=True, option_source="/api/v1/crm/customers",
        aliases=("customerId",)
    ),
    "sales_invoice.taxable_value": CanonicalFieldDef(
        field_id="sales_invoice.taxable_value", entity_id="sales_invoice", db_table="sales_invoices", db_column="taxable_value",
        data_type="DECIMAL", field_type="CURRENCY", label="Taxable Subtotal", required=True, min_value=0.0,
        aliases=("subtotal", "subTotal", "taxableValue")
    ),
    "sales_invoice.tax_total": CanonicalFieldDef(
        field_id="sales_invoice.tax_total", entity_id="sales_invoice", db_table="sales_invoices", db_column="tax_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Total Tax", required=True, min_value=0.0
    ),
    "sales_invoice.grand_total": CanonicalFieldDef(
        field_id="sales_invoice.grand_total", entity_id="sales_invoice", db_table="sales_invoices", db_column="grand_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Grand Total", required=True, min_value=0.0,
        aliases=("invoiceTotal", "total_amount")
    ),
    "sales_invoice.status": CanonicalFieldDef(
        field_id="sales_invoice.status", entity_id="sales_invoice", db_table="sales_invoices", db_column="status",
        data_type="STRING", field_type="SELECT", label="Invoice Status", required=True, option_source="SALES_INVOICE_STATUSES"
    ),

    # ── PURCHASE ORDER (purchase_orders) ────────────────────────────────────
    "purchase_order.id": CanonicalFieldDef(
        field_id="purchase_order.id", entity_id="purchase_order", db_table="purchase_orders", db_column="id",
        data_type="STRING", field_type="TEXT", label="PO ID", readonly=True, required=True
    ),
    "purchase_order.order_no": CanonicalFieldDef(
        field_id="purchase_order.order_no", entity_id="purchase_order", db_table="purchase_orders", db_column="order_no",
        data_type="STRING", field_type="TEXT", label="PO Number", required=True, max_length=50,
        aliases=("po_no", "poNumber", "po_number")
    ),
    "purchase_order.supplier_id": CanonicalFieldDef(
        field_id="purchase_order.supplier_id", entity_id="purchase_order", db_table="purchase_orders", db_column="supplier_id",
        data_type="STRING", field_type="LOOKUP", label="Supplier", required=True, option_source="/api/v1/purchase/vendors",
        aliases=("vendor_id", "supplierId")
    ),
    "purchase_order.subtotal": CanonicalFieldDef(
        field_id="purchase_order.subtotal", entity_id="purchase_order", db_table="purchase_orders", db_column="subtotal",
        data_type="DECIMAL", field_type="CURRENCY", label="Subtotal", required=True, min_value=0.0
    ),
    "purchase_order.tax_total": CanonicalFieldDef(
        field_id="purchase_order.tax_total", entity_id="purchase_order", db_table="purchase_orders", db_column="tax_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Tax Total", required=True, min_value=0.0
    ),
    "purchase_order.grand_total": CanonicalFieldDef(
        field_id="purchase_order.grand_total", entity_id="purchase_order", db_table="purchase_orders", db_column="grand_total",
        data_type="DECIMAL", field_type="CURRENCY", label="Total Amount", required=True, min_value=0.0,
        aliases=("total", "total_amount")
    ),
    "purchase_order.status": CanonicalFieldDef(
        field_id="purchase_order.status", entity_id="purchase_order", db_table="purchase_orders", db_column="status",
        data_type="STRING", field_type="SELECT", label="PO Status", required=True, option_source="PO_STATUSES"
    ),

    # ── DOCUMENT SERIES (document_series) ───────────────────────────────────
    "document_series.id": CanonicalFieldDef(
        field_id="document_series.id", entity_id="document_series", db_table="document_series", db_column="id",
        data_type="STRING", field_type="TEXT", label="Series ID", readonly=True, required=True
    ),
    "document_series.name": CanonicalFieldDef(
        field_id="document_series.name", entity_id="document_series", db_table="document_series", db_column="name",
        data_type="STRING", field_type="TEXT", label="Series Name", required=True, max_length=100,
        aliases=("seriesName", "series_code", "series")
    ),
    "document_series.document_type": CanonicalFieldDef(
        field_id="document_series.document_type", entity_id="document_series", db_table="document_series", db_column="document_type",
        data_type="STRING", field_type="SELECT", label="Document Type", required=True, max_length=50,
        aliases=("documentType", "doc_type")
    ),
    "document_series.prefix": CanonicalFieldDef(
        field_id="document_series.prefix", entity_id="document_series", db_table="document_series", db_column="prefix",
        data_type="STRING", field_type="TEXT", label="Prefix", required=True, max_length=20
    ),
    "document_series.current_number": CanonicalFieldDef(
        field_id="document_series.current_number", entity_id="document_series", db_table="document_series", db_column="current_number",
        data_type="INTEGER", field_type="NUMBER", label="Current Number", required=True, min_value=0.0,
        aliases=("currentNumber", "current_no")
    ),
    "document_series.running_length": CanonicalFieldDef(
        field_id="document_series.running_length", entity_id="document_series", db_table="document_series", db_column="running_length",
        data_type="INTEGER", field_type="NUMBER", label="Running Digits", required=True, min_value=1.0, max_value=12.0,
        aliases=("runningLength", "digits")
    ),
    "document_series.reset_rule": CanonicalFieldDef(
        field_id="document_series.reset_rule", entity_id="document_series", db_table="document_series", db_column="reset_rule",
        data_type="STRING", field_type="SELECT", label="Reset Rule", required=True,
        option_source="RESET_RULES", aliases=("resetRule",)
    ),
    "document_series.is_active": CanonicalFieldDef(
        field_id="document_series.is_active", entity_id="document_series", db_table="document_series", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── POS PROFILE / CASH REGISTERS (cash_registers) ───────────────────────
    "pos_profile.id": CanonicalFieldDef(
        field_id="pos_profile.id", entity_id="pos_profile", db_table="cash_registers", db_column="id",
        data_type="STRING", field_type="TEXT", label="Profile ID", readonly=True, required=True
    ),
    "pos_profile.code": CanonicalFieldDef(
        field_id="pos_profile.code", entity_id="pos_profile", db_table="cash_registers", db_column="code",
        data_type="STRING", field_type="TEXT", label="Terminal Code", required=True, max_length=50,
        aliases=("profile_code", "register_code")
    ),
    "pos_profile.name": CanonicalFieldDef(
        field_id="pos_profile.name", entity_id="pos_profile", db_table="cash_registers", db_column="name",
        data_type="STRING", field_type="TEXT", label="Terminal / Counter Name", required=True, max_length=200,
        aliases=("profile_name", "register_name")
    ),
    "pos_profile.cashier": CanonicalFieldDef(
        field_id="pos_profile.cashier", entity_id="pos_profile", db_table="cash_registers", db_column="cashier",
        data_type="STRING", field_type="TEXT", label="Default Cashier Operator", max_length=100
    ),
    "pos_profile.warehouse": CanonicalFieldDef(
        field_id="pos_profile.warehouse", entity_id="pos_profile", db_table="cash_registers", db_column="warehouse",
        data_type="STRING", field_type="TEXT", label="Store / Warehouse Name", max_length=100,
        aliases=("warehouse_name",)
    ),
    "pos_profile.warehouse_id": CanonicalFieldDef(
        field_id="pos_profile.warehouse_id", entity_id="pos_profile", db_table="cash_registers", db_column="warehouse_id",
        data_type="STRING", field_type="LOOKUP", label="Warehouse", max_length=50
    ),
    "pos_profile.is_locked": CanonicalFieldDef(
        field_id="pos_profile.is_locked", entity_id="pos_profile", db_table="cash_registers", db_column="is_locked",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Shift Lock", aliases=("isLocked",)
    ),
    "pos_profile.is_active": CanonicalFieldDef(
        field_id="pos_profile.is_active", entity_id="pos_profile", db_table="cash_registers", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── APPROVAL POLICY (approval_policies) ─────────────────────────────────
    "approval_policy.id": CanonicalFieldDef(
        field_id="approval_policy.id", entity_id="approval_policy", db_table="approval_policies", db_column="id",
        data_type="STRING", field_type="TEXT", label="Policy ID", readonly=True, required=True
    ),
    "approval_policy.name": CanonicalFieldDef(
        field_id="approval_policy.name", entity_id="approval_policy", db_table="approval_policies", db_column="name",
        data_type="STRING", field_type="TEXT", label="Rule Name", required=True, max_length=200,
        aliases=("policy_name", "policyName")
    ),
    "approval_policy.code": CanonicalFieldDef(
        field_id="approval_policy.code", entity_id="approval_policy", db_table="approval_policies", db_column="code",
        data_type="STRING", field_type="TEXT", label="Rule Code", required=True, max_length=50,
        aliases=("policy_code", "policyCode")
    ),
    "approval_policy.document_type": CanonicalFieldDef(
        field_id="approval_policy.document_type", entity_id="approval_policy", db_table="approval_policies", db_column="document_type",
        data_type="STRING", field_type="SELECT", label="Document Type", required=True,
        option_source="DOCUMENT_TYPES", aliases=("documentType", "doc_type")
    ),
    "approval_policy.min_amount": CanonicalFieldDef(
        field_id="approval_policy.min_amount", entity_id="approval_policy", db_table="approval_policies", db_column="min_amount",
        data_type="DECIMAL", field_type="CURRENCY", label="Minimum Amount", min_value=0.0
    ),
    "approval_policy.max_amount": CanonicalFieldDef(
        field_id="approval_policy.max_amount", entity_id="approval_policy", db_table="approval_policies", db_column="max_amount",
        data_type="DECIMAL", field_type="CURRENCY", label="Maximum Amount", min_value=0.0
    ),
    "approval_policy.status": CanonicalFieldDef(
        field_id="approval_policy.status", entity_id="approval_policy", db_table="approval_policies", db_column="status",
        data_type="STRING", field_type="SELECT", label="Approval Status", required=True
    ),
    "approval_policy.is_active": CanonicalFieldDef(
        field_id="approval_policy.is_active", entity_id="approval_policy", db_table="approval_policies", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── TERMS CLAUSE (terms_clauses) ────────────────────────────────────────
    "terms_clause.id": CanonicalFieldDef(
        field_id="terms_clause.id", entity_id="terms_clause", db_table="terms_clauses", db_column="id",
        data_type="STRING", field_type="TEXT", label="Clause ID", readonly=True, required=True
    ),
    "terms_clause.code": CanonicalFieldDef(
        field_id="terms_clause.code", entity_id="terms_clause", db_table="terms_clauses", db_column="code",
        data_type="STRING", field_type="TEXT", label="Clause Reference Code", required=True, max_length=50,
        aliases=("clause_code", "clauseCode")
    ),
    "terms_clause.title": CanonicalFieldDef(
        field_id="terms_clause.title", entity_id="terms_clause", db_table="terms_clauses", db_column="title",
        data_type="STRING", field_type="TEXT", label="Clause Title", required=True, max_length=200,
        aliases=("clause_title", "clauseTitle")
    ),
    "terms_clause.category": CanonicalFieldDef(
        field_id="terms_clause.category", entity_id="terms_clause", db_table="terms_clauses", db_column="category",
        data_type="STRING", field_type="SELECT", label="Category", required=True, max_length=50
    ),
    "terms_clause.content": CanonicalFieldDef(
        field_id="terms_clause.content", entity_id="terms_clause", db_table="terms_clauses", db_column="content",
        data_type="STRING", field_type="TEXT", label="Clause Legal Body", required=True
    ),
    "terms_clause.status": CanonicalFieldDef(
        field_id="terms_clause.status", entity_id="terms_clause", db_table="terms_clauses", db_column="status",
        data_type="STRING", field_type="SELECT", label="Status", required=True
    ),
    "terms_clause.language": CanonicalFieldDef(
        field_id="terms_clause.language", entity_id="terms_clause", db_table="terms_clauses", db_column="language",
        data_type="STRING", field_type="SELECT", label="Language", required=True, max_length=10
    ),
    "terms_clause.is_active": CanonicalFieldDef(
        field_id="terms_clause.is_active", entity_id="terms_clause", db_table="terms_clauses", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active")
    ),

    # ── MASTER VALUE (master_values) ────────────────────────────────────────
    "master_value.id": CanonicalFieldDef(
        field_id="master_value.id", entity_id="master_value", db_table="master_values", db_column="id",
        data_type="STRING", field_type="TEXT", label="Value ID", readonly=True, required=True
    ),
    "master_value.master_type_id": CanonicalFieldDef(
        field_id="master_value.master_type_id", entity_id="master_value", db_table="master_values", db_column="master_type_id",
        data_type="STRING", field_type="SELECT", label="Lookup Type ID", required=True,
        aliases=("type_code", "typeCode", "lookup_type")
    ),
    "master_value.code": CanonicalFieldDef(
        field_id="master_value.code", entity_id="master_value", db_table="master_values", db_column="code",
        data_type="STRING", field_type="TEXT", label="Value Code", required=True, max_length=50,
        aliases=("value_code", "valueCode")
    ),
    "master_value.name": CanonicalFieldDef(
        field_id="master_value.name", entity_id="master_value", db_table="master_values", db_column="name",
        data_type="STRING", field_type="TEXT", label="Value Name", required=True, max_length=200,
        aliases=("value_name", "valueName")
    ),
    "master_value.active": CanonicalFieldDef(
        field_id="master_value.active", entity_id="master_value", db_table="master_values", db_column="active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("is_active", "isActive")
    ),

    # ── USER & OPERATOR CONTROL PLANE (users) ───────────────────────────────
    "user.id": CanonicalFieldDef(
        field_id="user.id", entity_id="user", db_table="users", db_column="id",
        data_type="STRING", field_type="TEXT", label="User ID", readonly=True, required=True,
        ownership="CONTROL_PLANE"
    ),
    "user.username": CanonicalFieldDef(
        field_id="user.username", entity_id="user", db_table="users", db_column="username",
        data_type="STRING", field_type="TEXT", label="Username", required=True, max_length=50,
        ownership="CONTROL_PLANE"
    ),
    "user.full_name": CanonicalFieldDef(
        field_id="user.full_name", entity_id="user", db_table="users", db_column="full_name",
        data_type="STRING", field_type="TEXT", label="Full Name", required=True, max_length=150,
        ownership="CONTROL_PLANE", aliases=("fullName", "name")
    ),
    "user.email": CanonicalFieldDef(
        field_id="user.email", entity_id="user", db_table="users", db_column="email",
        data_type="STRING", field_type="TEXT", label="Email", max_length=150,
        ownership="CONTROL_PLANE"
    ),
    "user.mobile": CanonicalFieldDef(
        field_id="user.mobile", entity_id="user", db_table="users", db_column="mobile",
        data_type="STRING", field_type="TEXT", label="Mobile Number", max_length=15,
        ownership="CONTROL_PLANE"
    ),
    "user.role": CanonicalFieldDef(
        field_id="user.role", entity_id="user", db_table="users", db_column="role",
        data_type="STRING", field_type="SELECT", label="System Role", required=True,
        ownership="CONTROL_PLANE"
    ),
    "user.department": CanonicalFieldDef(
        field_id="user.department", entity_id="user", db_table="users", db_column="department",
        data_type="STRING", field_type="TEXT", label="Department", max_length=100,
        ownership="CONTROL_PLANE"
    ),
    "user.designation": CanonicalFieldDef(
        field_id="user.designation", entity_id="user", db_table="users", db_column="designation",
        data_type="STRING", field_type="TEXT", label="Designation", max_length=100,
        ownership="CONTROL_PLANE"
    ),
    "user.branch": CanonicalFieldDef(
        field_id="user.branch", entity_id="user", db_table="users", db_column="branch",
        data_type="STRING", field_type="TEXT", label="Assigned Branch", max_length=100,
        ownership="CONTROL_PLANE", aliases=("branch_id",)
    ),
    "user.is_active": CanonicalFieldDef(
        field_id="user.is_active", entity_id="user", db_table="users", db_column="is_active",
        data_type="BOOLEAN", field_type="BOOLEAN", label="Active", aliases=("isActive", "active", "status"),
        ownership="CONTROL_PLANE"
    ),
}


# ---------------------------------------------------------------------------
# Invariant Assertions & Lookup Helpers
# ---------------------------------------------------------------------------

def assert_registry_invariants() -> None:
    """
    Validates canonical registry invariants at module load time:
    1. field_id is UNIQUE and follows '<entity_key>.<field_name>' format.
    2. (entity_id, db_table, db_column) is UNIQUE across all definitions.
    3. db_table exists in TABLE_OWNERSHIP.
    4. Table ownership aligns with declared field ownership.
    """
    seen_ids: Set[str] = set()
    seen_mappings: Dict[Tuple[str, str, str], str] = {}

    for fid, fdef in CANONICAL_FIELDS.items():
        # 1. Key matches definition ID
        if fid != fdef.field_id:
            raise FieldRegistryViolation(
                f"Dictionary key '{fid}' does not match definition field_id '{fdef.field_id}'."
            )

        # 2. Syntax format: entity_key.field_name
        if not re.fullmatch(r"[a-z0-9_]+\.[a-z0-9_]+", fid):
            raise FieldRegistryViolation(
                f"Invalid field_id format: '{fid}'. Must match '[a-z0-9_]+.[a-z0-9_]+'."
            )

        # 3. Uniqueness of field_id
        if fid in seen_ids:
            raise FieldRegistryViolation(f"Duplicate field_id detected: '{fid}'.")
        seen_ids.add(fid)

        # 4. Uniqueness of (entity_id, db_table, db_column)
        mapping_key = (fdef.entity_id, fdef.db_table, fdef.db_column)
        if mapping_key in seen_mappings:
            existing_fid = seen_mappings[mapping_key]
            raise FieldRegistryViolation(
                f"Duplicate physical DB mapping detected: {mapping_key} is already mapped to '{existing_fid}', "
                f"conflicting with '{fid}'. Each column per entity must map to exactly one canonical field_id."
            )
        seen_mappings[mapping_key] = fid

        # 5. Table ownership verification
        if fdef.db_table not in TABLE_OWNERSHIP:
            raise FieldRegistryViolation(
                f"Table '{fdef.db_table}' in field '{fid}' is not declared in TABLE_OWNERSHIP."
            )

        # 6. Lifecycle validity
        valid_lifecycles = {l.value for l in FieldLifecycle}
        if fdef.lifecycle not in valid_lifecycles:
            raise FieldRegistryViolation(
                f"Invalid lifecycle '{fdef.lifecycle}' for field '{fid}'. Must be one of {valid_lifecycles}."
            )


# Run invariants on import
assert_registry_invariants()


# ---------------------------------------------------------------------------
# Deterministic Registry Fingerprint
# ---------------------------------------------------------------------------

def compute_registry_fingerprint(fields_dict: Optional[Dict[str, CanonicalFieldDef]] = None) -> str:
    """
    Computes a deterministic SHA-256 fingerprint from canonical field definitions
    in strict alphabetical order of field_id.
    Includes all authoritative metadata:
      field_id, entity_id, db_table, db_column, data_type, field_type, label,
      required, editable, searchable, filterable, sortable, readonly,
      max_length, min_value, max_value, validation_rule, option_source,
      lifecycle, ownership, version, aliases, api_key, api_endpoint.
    Excludes volatile timestamps, system paths, or machine-dependent attributes.
    """
    targets = fields_dict if fields_dict is not None else CANONICAL_FIELDS
    hasher = hashlib.sha256()

    for fid in sorted(targets.keys()):
        f = targets[fid]
        canonical_tokens = [
            f.field_id,
            f.entity_id,
            f.db_table,
            f.db_column,
            f.data_type,
            f.field_type,
            f.label,
            str(f.required),
            str(f.editable),
            str(f.searchable),
            str(f.filterable),
            str(f.sortable),
            str(f.readonly),
            str(f.max_length),
            str(f.min_value),
            str(f.max_value),
            str(f.validation_rule),
            str(f.option_source),
            f.lifecycle,
            f.ownership,
            str(f.version),
            ",".join(sorted(f.aliases)),
            str(f.api_key),
            str(f.api_endpoint),
        ]
        entry_payload = "|".join(canonical_tokens) + "\n"
        hasher.update(entry_payload.encode("utf-8"))

    return hasher.hexdigest()


CFOC_REGISTRY_FINGERPRINT: str = compute_registry_fingerprint()
CFOC_REGISTRY_FIELDS: int = len(CANONICAL_FIELDS)


# ---------------------------------------------------------------------------
# Public Query Helpers
# ---------------------------------------------------------------------------

def get_field(field_id: str) -> Optional[CanonicalFieldDef]:
    """Retrieves canonical field by exact field_id."""
    return CANONICAL_FIELDS.get(field_id)


def resolve_field_by_alias(entity_id: str, field_name_or_alias: str) -> Optional[CanonicalFieldDef]:
    """
    Resolves a field by entity_id and either canonical name or registered alias.
    """
    target = field_name_or_alias.strip()

    # 1. Exact field_id check: "customer.mobile"
    if "." in target:
        if target in CANONICAL_FIELDS:
            return CANONICAL_FIELDS[target]
    else:
        full_id = f"{entity_id}.{target}"
        if full_id in CANONICAL_FIELDS:
            return CANONICAL_FIELDS[full_id]

    # 2. Check aliases across entity fields
    lower_target = target.lower()
    for f in CANONICAL_FIELDS.values():
        if f.entity_id == entity_id:
            if f.db_column.lower() == lower_target:
                return f
            for alias in f.aliases:
                if alias.lower() == lower_target:
                    return f

    return None


def get_fields_for_entity(entity_id: str) -> List[CanonicalFieldDef]:
    """Returns all canonical fields registered for a given business entity."""
    return [f for f in CANONICAL_FIELDS.values() if f.entity_id == entity_id]


def get_fields_for_table(db_table: str) -> List[CanonicalFieldDef]:
    """Returns all canonical fields mapped to a specific physical table."""
    return [f for f in CANONICAL_FIELDS.values() if f.db_table == db_table]
