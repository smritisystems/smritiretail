"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Description  : Level 1 Inventory Kernel Core Entities (InventoryLocation, InventoryIdentity, InventoryLedger, ReservationLedger, CostLayerLedger, InventorySnapshot, DocumentPostingProfile).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from ..db.base import BaseEntity, RowSecuredMixin
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Index, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship, foreign

class InventoryLocationNode(RowSecuredMixin, BaseEntity):
    """
    InventoryLocationNode — Finite node in the hierarchical inventory network graph.
    Supports parent-child tree hierarchy (ParentLocation, Children, TreePath, Depth).
    """
    __tablename__ = "inventory_location_nodes"

    code            = Column(String(50), nullable=False, index=True)
    name            = Column(String(200), nullable=False)
    location_type   = Column(String(50), nullable=False, index=True)  # WAREHOUSE, STORE, RETAIL_CHAIN, DISTRIBUTOR, FRANCHISE, MARKETPLACE, SUPPLIER, FACTORY, TRANSIT, REPAIR_CENTER
    ownership_type  = Column(String(50), nullable=False, default="COMPANY", index=True)  # COMPANY, PARTNER, CONSIGNMENT, MARKETPLACE, SUPPLIER, CUSTOMER, THIRD_PARTY
    parent_id       = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=True, index=True)
    tree_path       = Column(String(512), nullable=False, default="/", index=True)
    depth           = Column(Integer, nullable=False, default=0)
    roles           = Column(ARRAY(String), server_default="{}", default=list)  # DISTRIBUTION, FULFILLMENT, SALES, REPLENISHMENT, SERVICE, RETURNS, PRODUCTION
    capabilities    = Column(ARRAY(String), server_default="{}", default=list)  # CAN_SELL, CAN_RECEIVE, CAN_DISPATCH, CAN_MANUFACTURE, CAN_REPAIR, CAN_HOLD_CONSIGNMENT, CAN_FULFILL_MARKETPLACE, CAN_ACCEPT_RETURNS
    territory_path  = Column(String(255), nullable=True)  # Global/India/Western Region/Maharashtra/Mumbai
    address         = Column(Text, nullable=True)
    is_active       = Column(Boolean, nullable=False, default=True)
    kpis            = Column(JSONB, server_default="'{}'::jsonb", default=dict)

    # Relationships
    parent          = relationship("InventoryLocationNode", remote_side="InventoryLocationNode.id", backref="children", lazy="selectin")

    __table_args__ = (
        Index("idx_inv_loc_tree_path", "tree_path"),
        Index("idx_inv_loc_type_owner", "location_type", "ownership_type"),
    )


class InventoryIdentityRecord(RowSecuredMixin, BaseEntity):
    """
    InventoryIdentityRecord — Centralized SKU, Batch, Serial, Lot, and Variant Identity.
    Rule IIR-007: Identity attributes are immutable once created.
    """
    __tablename__ = "inventory_identity_records"

    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False, index=True)
    batch_no            = Column(String(100), nullable=True, index=True)
    serial_no           = Column(String(100), nullable=True, index=True)
    lot_no              = Column(String(100), nullable=True)
    variant_attributes  = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    uom                 = Column(String(30), nullable=False, default="PCS")
    packaging_profile   = Column(String(50), nullable=True)
    primary_barcode     = Column(String(100), nullable=True, index=True)
    rfid_tag            = Column(String(100), nullable=True, index=True)
    manufacturing_date  = Column(DateTime(timezone=True), nullable=True)
    expiry_date         = Column(DateTime(timezone=True), nullable=True, index=True)
    is_quarantined      = Column(Boolean, nullable=False, default=False)
    compliance_status   = Column(String(50), nullable=False, default="PASSED")

    product             = relationship("Product", lazy="selectin")

    __table_args__ = (
        Index("idx_inv_identity_sku_batch", "sku", "batch_no"),
        Index("idx_inv_identity_serial", "serial_no"),
    )


class InventoryLedgerEntry(RowSecuredMixin, BaseEntity):
    """
    InventoryLedgerEntry — Immutable append-only physical stock movement ledger.
    Rule LIM-006: Ledger entries are append-only. Corrections require compensating reversal movements.
    """
    __tablename__ = "inventory_ledger_entries"

    entry_no            = Column(String(100), nullable=False, unique=True, index=True)
    transaction_id      = Column(String(100), nullable=False, index=True)
    document_no         = Column(String(100), nullable=True, index=True)
    from_location_id    = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=True, index=True)
    to_location_id      = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=True, index=True) # NULL for Exit (Sale)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False, index=True)
    quantity            = Column(Numeric(12, 4), nullable=False) # Positive value
    batch_no            = Column(String(100), nullable=True)
    serial_no           = Column(String(100), nullable=True)
    unit_cost           = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    movement_type       = Column(String(50), nullable=False) # CHANNEL_DISPATCH, CHANNEL_SALE, CONSIGNMENT_DISPATCH, TRANSFER, POS_SALE, GRN
    ownership_type      = Column(String(50), nullable=False, default="COMPANY")
    posting_profile_id  = Column(String(50), nullable=True)
    posting_timestamp   = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    is_reversal         = Column(Boolean, nullable=False, default=False)
    reversal_entry_id   = Column(String(50), nullable=True)
    remarks             = Column(Text, nullable=True)

    from_location       = relationship("InventoryLocationNode", foreign_keys=[from_location_id], lazy="selectin")
    to_location         = relationship("InventoryLocationNode", foreign_keys=[to_location_id], lazy="selectin")
    product             = relationship("Product", lazy="selectin")

    __table_args__ = (
        Index("idx_inv_ledger_loc_prod", "to_location_id", "from_location_id", "product_id"),
        Index("idx_inv_ledger_timestamp", "posting_timestamp"),
    )


class ReservationLedgerEntry(RowSecuredMixin, BaseEntity):
    """
    ReservationLedgerEntry — Immutable append-only ATP reservation ledger.
    Tracks reservation, partial release, allocation, and expiry history.
    """
    __tablename__ = "reservation_ledger_entries"

    entry_no            = Column(String(100), nullable=False, unique=True, index=True)
    reservation_id      = Column(String(100), nullable=False, index=True)
    location_id         = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False)
    channel_id          = Column(String(50), nullable=True)
    reserved_qty        = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    released_qty        = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    allocated_qty       = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    event_type          = Column(String(50), nullable=False) # RESERVE, RELEASE, ALLOCATE, EXPIRE
    status              = Column(String(30), nullable=False, default="ACTIVE") # ACTIVE, RELEASED, FULFILLED, EXPIRED
    expires_at          = Column(DateTime(timezone=True), nullable=True)
    posting_timestamp   = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    location            = relationship("InventoryLocationNode", lazy="selectin")
    product             = relationship("Product", lazy="selectin")


class CostLayerLedgerEntry(RowSecuredMixin, BaseEntity):
    """
    CostLayerLedgerEntry — Dedicated cost layer ledger for FIFO, Moving Average, and Batch valuation.
    """
    __tablename__ = "cost_layer_ledger_entries"

    entry_no            = Column(String(100), nullable=False, unique=True, index=True)
    location_id         = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False)
    costing_method      = Column(String(30), nullable=False, default="FIFO") # FIFO, MOVING_AVERAGE, WEIGHTED_AVERAGE, STANDARD_COST
    unit_cost           = Column(Numeric(15, 2), nullable=False)
    original_qty        = Column(Numeric(12, 4), nullable=False)
    remaining_qty       = Column(Numeric(12, 4), nullable=False)
    batch_no            = Column(String(100), nullable=True)
    posting_timestamp   = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    location            = relationship("InventoryLocationNode", lazy="selectin")
    product             = relationship("Product", lazy="selectin")


class InventorySnapshotRecord(RowSecuredMixin, BaseEntity):
    """
    InventorySnapshotRecord — Periodic read-only cached balance snapshot for high-speed queries.
    Snapshots are read-only cached projections and MUST NEVER be manually edited.
    """
    __tablename__ = "inventory_snapshot_records"

    snapshot_code       = Column(String(100), nullable=False, unique=True, index=True)
    snapshot_date       = Column(DateTime(timezone=True), nullable=False, index=True)
    snapshot_type       = Column(String(30), nullable=False, default="DAILY") # DAILY, MONTHLY
    location_id         = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False)
    on_hand_qty         = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    reserved_qty        = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    available_qty       = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    unit_cost           = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_inventory_val = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    location            = relationship("InventoryLocationNode", lazy="selectin")
    product             = relationship("Product", lazy="selectin")

    __table_args__ = (
        Index("idx_inv_snap_loc_date", "location_id", "snapshot_date"),
    )


class DocumentPostingProfileRecord(RowSecuredMixin, BaseEntity):
    """
    DocumentPostingProfileRecord — Declarative document-to-movement profile mapping.
    """
    __tablename__ = "document_posting_profiles"

    profile_code        = Column(String(50), nullable=False, unique=True, index=True)
    document_type       = Column(String(50), nullable=False, index=True) # PURCHASE_RECEIPT, SALES_INVOICE, TRANSFER_ORDER, RELIANCE_DISPATCH, RELIANCE_SALE
    from_location_role  = Column(String(50), nullable=True)
    to_location_role    = Column(String(50), nullable=True)
    movement_type       = Column(String(50), nullable=False)
    ownership_type      = Column(String(50), nullable=False, default="COMPANY")
    is_active           = Column(Boolean, nullable=False, default=True)
    description         = Column(Text, nullable=True)


class InventoryLockRecord(RowSecuredMixin, BaseEntity):
    """
    InventoryLockRecord — Operational stock lock registry (Audit, Recall, Quarantine, Legal Hold).
    Excluded from Available-to-Promise (ATP).
    """
    __tablename__ = "inventory_lock_records"

    lock_code           = Column(String(100), nullable=False, unique=True, index=True)
    lock_type           = Column(String(50), nullable=False, index=True) # CYCLE_COUNT, STOCK_AUDIT, QUALITY_HOLD, BATCH_RECALL, LEGAL_HOLD, QUARANTINE, PHYSICAL_DAMAGE, SYSTEM_MAINTENANCE
    lock_scope          = Column(String(50), nullable=False, index=True) # LOCATION, BIN, SKU, BATCH, SERIAL
    target_id           = Column(String(100), nullable=False, index=True) # Location ID, Bin ID, SKU, Batch No, or Serial No
    location_id         = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=True, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)
    locked_qty          = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"))
    reason              = Column(Text, nullable=False)
    status              = Column(String(30), nullable=False, default="ACTIVE", index=True) # ACTIVE, RELEASED, EXPIRED
    effective_from      = Column(DateTime(timezone=True), nullable=False, index=True)
    effective_until     = Column(DateTime(timezone=True), nullable=True)
    released_by         = Column(String(50), nullable=True)
    released_at         = Column(DateTime(timezone=True), nullable=True)
    release_reason      = Column(Text, nullable=True)


class PlatformIdempotencyRecord(RowSecuredMixin, BaseEntity):
    """
    PlatformIdempotencyRecord — Shared Platform Idempotency & Replay Protection Service.
    Guarantees deduplication across POS offline sync, Marketplace retries, and API gateways.
    """
    __tablename__ = "platform_idempotency_records"

    idempotency_key     = Column(String(128), nullable=False, unique=True, index=True)
    request_hash        = Column(String(64), nullable=False, index=True)
    source_system       = Column(String(50), nullable=False, index=True) # POS, MARKETPLACE_SHOPIFY, MARKETPLACE_AMAZON, EDI, API_GATEWAY
    correlation_id      = Column(String(100), nullable=True, index=True)
    external_reference  = Column(String(100), nullable=True, index=True)
    response_payload    = Column(JSONB, nullable=True)
    status              = Column(String(30), nullable=False, default="COMPLETED", index=True) # PROCESSING, COMPLETED, FAILED
    expires_at          = Column(DateTime(timezone=True), nullable=True, index=True)


class InventoryCheckpointRecord(RowSecuredMixin, BaseEntity):
    """
    InventoryCheckpointRecord — Certified Recovery Point Checkpoint Engine.
    Enables high-performance fast-replay starting from the latest certified checkpoint.
    """
    __tablename__ = "inventory_checkpoint_records"

    checkpoint_code     = Column(String(100), nullable=False, unique=True, index=True)
    checkpoint_timestamp= Column(DateTime(timezone=True), nullable=False, index=True)
    last_entry_id       = Column(String(50), ForeignKey("inventory_ledger_entries.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id         = Column(String(50), ForeignKey("inventory_location_nodes.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    sku                 = Column(String(100), nullable=False)
    certified_on_hand   = Column(Numeric(12, 4), nullable=False)
    certified_unit_cost = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    checksum            = Column(String(64), nullable=False)
    is_certified        = Column(Boolean, nullable=False, default=True)

