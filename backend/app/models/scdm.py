"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM — SMRITI Channel Distribution Management (Platform Capability)
               Database Models v1.0
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SCDM Architecture:
  ┌──────────────────────────────────────────────────────────────┐
  │  SCDM — SMRITI Channel Distribution Management              │
  │                                                              │
  │  Customer → ChannelLocation (Store / DC / Department)        │
  │  SalesInvoice.posted → ChannelDispatch (auto, event-driven)  │
  │  ChannelDispatch → ChannelDispatchLine (per item)            │
  │  All movements → ChannelStockMovement (immutable audit trail) │
  │  Projection = SUM(movements) — computed, never stored        │
  │  SellOutImport → SellOutImportLine (Excel/CSV/API/EDI/…)     │
  └──────────────────────────────────────────────────────────────┘

Design Principles (Rule AOP-004, GR-002, GR-011):
  - ADDITIVE ONLY: No existing table is modified here.
    Customer.channel_tracking_enabled and .supply_model and .sellout_source
    are added via Alembic migration in a separate script.
  - SOURCE OF TRUTH = ChannelStockMovement (immutable, append-only).
    Stock balance is ALWAYS computed from movements, never stored in a
    mutable running-total column. This mirrors the warehouse StockMovement pattern.
  - ZERO WRITE PATH to warehouse stock or accounting tables.
  - Multi-company and multi-branch scoped via tenant_id / company_id / branch_id.
"""

from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, Text,
    ForeignKey, Date, DateTime, Index, UniqueConstraint, Enum, text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity, RowSecuredMixin
import enum


# ---------------------------------------------------------------------------
# Enum constants (kept inline for clarity; use DB-level enums for production)
# ---------------------------------------------------------------------------

class SupplyModel(str, enum.Enum):
    NORMAL        = "Normal"
    MODERN_TRADE  = "ModernTrade"
    DISTRIBUTOR   = "Distributor"
    FRANCHISE     = "Franchise"
    INSTITUTIONAL = "Institutional"

class SellOutSource(str, enum.Enum):
    MANUAL   = "Manual"
    EXCEL    = "Excel"
    CSV      = "CSV"
    API      = "API"
    EDI      = "EDI"
    POS_FEED = "POSFeed"
    FTP      = "FTP"
    SFTP     = "SFTP"
    WEBHOOK  = "Webhook"

class ChannelDispatchStatus(str, enum.Enum):
    DRAFT             = "Draft"
    POSTED            = "Posted"
    PARTIALLY_SETTLED = "PartiallySettled"
    FULLY_SETTLED     = "FullySettled"
    CANCELLED         = "Cancelled"
    ARCHIVED          = "Archived"

class ChannelMovementType(str, enum.Enum):
    DISPATCH    = "Dispatch"
    SELLOUT     = "SellOut"
    RETURN      = "Return"
    DAMAGE      = "Damage"
    ADJUSTMENT  = "Adjustment"
    REVERSAL    = "Reversal"
    CANCELLATION = "Cancellation"

class ImportStatus(str, enum.Enum):
    PENDING    = "Pending"
    PROCESSING = "Processing"
    DONE       = "Done"
    ERROR      = "Error"
    PARTIAL    = "Partial"


# ---------------------------------------------------------------------------
# 1. ChannelLocation — Customer → DC → Store → Department hierarchy
# ---------------------------------------------------------------------------

class ChannelLocation(RowSecuredMixin, BaseEntity):
    """
    Represents a physical location within a customer's distribution network.

    Hierarchy (self-referential via parent_id):
        Customer (Reliance Retail)
          └─ DC (Mumbai Distribution Centre)
               └─ Store (Store 102, Andheri)
                    └─ Department (Food & Beverages)

    This allows dispatch tracking at store or DC level for Modern Trade chains.
    """
    __tablename__ = "scdm_channel_locations"

    customer_id   = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    parent_id     = Column(String(50), ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True, index=True)

    code          = Column(String(50), nullable=False, index=True)
    name          = Column(String(255), nullable=False)
    location_type = Column(String(30), nullable=False, default="Store")
    # Store | DC | Department | Region | Hub

    address_line1 = Column(String(255), nullable=True)
    address_city  = Column(String(100), nullable=True)
    address_state = Column(String(100), nullable=True)
    address_pin   = Column(String(10), nullable=True)
    gst_number    = Column(String(15), nullable=True)

    is_active     = Column(Boolean, default=True, nullable=False)
    notes         = Column(Text, nullable=True)

    # Relationships
    customer   = relationship("Customer", foreign_keys=[customer_id])
    parent     = relationship("ChannelLocation", remote_side="ChannelLocation.id", foreign_keys=[parent_id])
    children   = relationship("ChannelLocation", back_populates="parent", foreign_keys=[parent_id])
    dispatches = relationship("ChannelDispatch", back_populates="channel_location")

    __table_args__ = (
        Index("ix_scdm_location_customer_code", "customer_id", "code"),
        {"comment": "SCDM: Customer distribution location hierarchy (DC/Store/Dept)"}
    )


# ---------------------------------------------------------------------------
# 2. ChannelDispatch — Auto-generated on SalesInvoice.posted
# ---------------------------------------------------------------------------

class ChannelDispatch(RowSecuredMixin, BaseEntity):
    """
    Channel Dispatch document — auto-created when a SalesInvoice is posted
    for a customer with channel_tracking_enabled=True.

    IMPORTANT: This is a VISIBILITY document only.
    - It does NOT create stock movements in the warehouse.
    - It does NOT create accounting entries.
    - It references the SalesInvoice read-only (invoice_id FK).

    Status lifecycle:
        Draft → Posted → PartiallySettled → FullySettled → Archived
                     ↘ Cancelled (on invoice cancellation)
    """
    __tablename__ = "scdm_channel_dispatches"

    dispatch_no          = Column(String(80), nullable=False, unique=True, index=True)
    invoice_id           = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id          = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    channel_location_id  = Column(String(50), ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True, index=True)

    dispatch_date        = Column(Date, nullable=False, default=date.today)
    status               = Column(String(30), nullable=False, default=ChannelDispatchStatus.DRAFT.value)
    billing_policy       = Column(String(30), nullable=False, default="InvoiceOnDispatch", server_default="InvoiceOnDispatch")
    # Snapshot of the customer policy at dispatch time for audit/reconciliation.

    # Value fields for reconciliation (Qty + Value model per user review)
    total_dispatch_qty   = Column(Numeric(15, 4), nullable=False, default=Decimal("0.0000"))
    total_mrp_value      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_cost_value     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_invoice_value  = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    # Settlement tracking
    total_sellout_qty    = Column(Numeric(15, 4), nullable=False, default=Decimal("0.0000"))
    total_return_qty     = Column(Numeric(15, 4), nullable=False, default=Decimal("0.0000"))
    total_damage_qty     = Column(Numeric(15, 4), nullable=False, default=Decimal("0.0000"))
    settlement_value     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    notes                = Column(Text, nullable=True)
    metadata_json        = Column(JSONB, server_default=text("'{}'"), default=dict)
    # Stores: auto_created_by_event, event_payload_ref, import_source etc.

    # Relationships
    invoice          = relationship("SalesInvoice")
    customer         = relationship("Customer", foreign_keys=[customer_id])
    channel_location = relationship("ChannelLocation", back_populates="dispatches")
    lines            = relationship("ChannelDispatchLine", back_populates="dispatch", cascade="all, delete-orphan", lazy="selectin")
    movements        = relationship("ChannelStockMovement", back_populates="dispatch")

    __table_args__ = (
        Index("ix_scdm_dispatch_customer_date", "customer_id", "dispatch_date"),
        Index("ix_scdm_dispatch_status", "status"),
        {"comment": "SCDM: Channel dispatch auto-created from posted SalesInvoice"}
    )


# ---------------------------------------------------------------------------
# 3. ChannelDispatchLine — Line items per dispatch
# ---------------------------------------------------------------------------

class ChannelDispatchLine(BaseEntity):
    """
    Individual product line within a ChannelDispatch.
    Mirrors SalesInvoiceItem quantities at point of dispatch for SCDM tracking.
    Does NOT modify any warehouse or accounting record.
    """
    __tablename__ = "scdm_channel_dispatch_lines"

    dispatch_id      = Column(String(50), ForeignKey("scdm_channel_dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id       = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_item_id  = Column(Integer, nullable=True)  # ref to sales_invoice_items.id (read-only)

    code             = Column(String(50), nullable=False, default="")
    name             = Column(String(255), nullable=False, default="")
    hsn_code         = Column(String(15), nullable=True)
    batch_no         = Column(String(50), nullable=True)
    serial_no        = Column(String(100), nullable=True)

    dispatch_qty     = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    unit             = Column(String(30), nullable=True, default="Pcs")

    # Value fields (Qty + Value reconciliation per user review)
    mrp              = Column(Numeric(15, 2), nullable=True)
    cost_price       = Column(Numeric(15, 2), nullable=True)
    invoice_rate     = Column(Numeric(15, 2), nullable=True)
    line_invoice_value = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    line_mrp_value   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    # Running settlement (updated as sell-outs / returns are recorded)
    sellout_qty      = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    return_qty       = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    damage_qty       = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))

    # Relationships
    dispatch = relationship("ChannelDispatch", back_populates="lines")
    product  = relationship("Product")

    __table_args__ = (
        Index("ix_scdm_dispatch_line_product", "dispatch_id", "product_id"),
        {"comment": "SCDM: Channel dispatch line items (product-level dispatch detail)"}
    )


# ---------------------------------------------------------------------------
# 4. ChannelStockMovement — IMMUTABLE audit trail / source of truth
# ---------------------------------------------------------------------------

class ChannelStockMovement(RowSecuredMixin, BaseEntity):
    """
    IMMUTABLE append-only movement ledger — the canonical source of truth for
    channel stock. Stock balance = SUM(qty WHERE type=Dispatch) -
    SUM(qty WHERE type IN [SellOut, Return, Damage]).

    This mirrors the warehouse StockMovement pattern exactly.
    NEVER update or delete rows — only append. Mark corrections as Adjustment
    or Reversal movement types.

    Projection (current balance per customer+product+location) is computed via
    DB view v_scdm_stock_projection (see Alembic migration).
    """
    __tablename__ = "scdm_channel_stock_movements"

    customer_id         = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    channel_location_id = Column(String(50), ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Source reference
    dispatch_id         = Column(String(50), ForeignKey("scdm_channel_dispatches.id", ondelete="SET NULL"), nullable=True, index=True)
    sellout_import_id   = Column(String(50), ForeignKey("scdm_sellout_imports.id", ondelete="SET NULL"), nullable=True, index=True)
    reference_type      = Column(String(50), nullable=True)   # SalesInvoice | SellOutImport | Manual | Adjustment
    reference_id        = Column(String(50), nullable=True)

    movement_type       = Column(String(30), nullable=False)  # ChannelMovementType enum values
    movement_date       = Column(Date, nullable=False, default=date.today)

    batch_no            = Column(String(50), nullable=True)
    serial_no           = Column(String(100), nullable=True)

    # Quantity (signed: positive = stock IN, negative = stock OUT)
    # Dispatch: +qty / SellOut: -qty / Return: +qty / Damage: -qty / Reversal: negation
    qty                 = Column(Numeric(12, 4), nullable=False)

    # Value fields (MRP, Cost, Sales Value, Settlement Value)
    mrp_value           = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    cost_value          = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    sales_value         = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    settlement_value    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    narration           = Column(String(500), nullable=True)
    created_by_user_id  = Column(String(50), nullable=True)

    # Relationships
    customer         = relationship("Customer", foreign_keys=[customer_id])
    product          = relationship("Product")
    dispatch         = relationship("ChannelDispatch", back_populates="movements")
    channel_location = relationship("ChannelLocation", foreign_keys=[channel_location_id])

    __table_args__ = (
        Index("ix_scdm_movement_customer_product", "customer_id", "product_id", "movement_date"),
        Index("ix_scdm_movement_dispatch", "dispatch_id"),
        Index("ix_scdm_movement_type_date", "movement_type", "movement_date"),
        {"comment": "SCDM: Immutable channel stock movement ledger — source of truth for all channel inventory balances"}
    )


# ---------------------------------------------------------------------------
# 5. SellOutImport — Import job header (Excel/CSV/API/EDI/POS/FTP/Webhook…)
# ---------------------------------------------------------------------------

class SellOutImport(RowSecuredMixin, BaseEntity):
    """
    Tracks a sell-out data import job from any supported source.
    Supported sources: Manual, Excel, CSV, API, EDI, POSFeed, FTP, SFTP, Webhook.
    After validation, each accepted line creates a ChannelStockMovement (SellOut type).
    """
    __tablename__ = "scdm_sellout_imports"

    import_no         = Column(String(80), nullable=False, unique=True, index=True)
    customer_id       = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    channel_location_id = Column(String(50), ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True)

    import_source     = Column(String(30), nullable=False, default=SellOutSource.MANUAL.value)
    # Manual | Excel | CSV | API | EDI | POSFeed | FTP | SFTP | Webhook

    import_date       = Column(Date, nullable=False, default=date.today)
    period_from       = Column(Date, nullable=True)
    period_to         = Column(Date, nullable=True)

    status            = Column(String(20), nullable=False, default=ImportStatus.PENDING.value)
    # Pending | Processing | Done | Error | Partial

    file_name         = Column(String(512), nullable=True)
    file_path         = Column(String(512), nullable=True)  # stored in object store / local FS

    total_lines       = Column(Integer, nullable=False, default=0)
    accepted_lines    = Column(Integer, nullable=False, default=0)
    rejected_lines    = Column(Integer, nullable=False, default=0)
    duplicate_lines   = Column(Integer, nullable=False, default=0)

    error_summary     = Column(JSONB, server_default=text("'[]'"), default=list)
    # [{line: 3, product: "SKU001", error: "Item not mapped"}]

    imported_by_user_id = Column(String(50), nullable=True)
    processed_at      = Column(DateTime(timezone=True), nullable=True)
    notes             = Column(Text, nullable=True)

    # Relationships
    customer  = relationship("Customer", foreign_keys=[customer_id])
    lines     = relationship("SellOutImportLine", back_populates="import_job", cascade="all, delete-orphan")
    movements = relationship("ChannelStockMovement", back_populates=None,
                             primaryjoin="SellOutImport.id == foreign(ChannelStockMovement.sellout_import_id)")

    __table_args__ = (
        Index("ix_scdm_sellout_import_customer_date", "customer_id", "import_date"),
        {"comment": "SCDM: Sell-out import job tracking (Excel/CSV/API/EDI/POS/FTP/Webhook)"}
    )


# ---------------------------------------------------------------------------
# 6. SellOutImportLine — Individual line per import (barcode → product mapping)
# ---------------------------------------------------------------------------

class SellOutImportLine(BaseEntity):
    """
    Individual sell-out record from an import job.
    Supports barcode-to-product mapping and item-level error tracking.
    Accepted lines auto-create a ChannelStockMovement (SellOut).
    """
    __tablename__ = "scdm_sellout_import_lines"

    import_id         = Column(String(50), ForeignKey("scdm_sellout_imports.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id        = Column(String(50), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    # nullable: product may not be mapped yet at import time

    source_barcode    = Column(String(100), nullable=True)  # barcode from import file
    source_sku        = Column(String(100), nullable=True)  # SKU from import file
    source_item_name  = Column(String(255), nullable=True)  # item name from import file

    batch_no          = Column(String(50), nullable=True)
    qty_sold          = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    mrp               = Column(Numeric(15, 2), nullable=True)
    selling_price     = Column(Numeric(15, 2), nullable=True)
    sales_value       = Column(Numeric(15, 2), nullable=True)
    transaction_date  = Column(Date, nullable=True)

    line_status       = Column(String(20), nullable=False, default="Pending")
    # Pending | Mapped | Unmapped | Duplicate | Error | Accepted | Rejected

    error_message     = Column(String(500), nullable=True)
    movement_id       = Column(String(50), nullable=True)
    # FK to scdm_channel_stock_movements.id after acceptance (soft ref)

    # Relationships
    import_job = relationship("SellOutImport", back_populates="lines")
    product    = relationship("Product")

    __table_args__ = (
        Index("ix_scdm_import_line_status", "import_id", "line_status"),
        {"comment": "SCDM: Individual sell-out import line with barcode/SKU mapping"}
    )
