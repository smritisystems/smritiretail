"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class EcomChannel(BaseEntity):
    """
    eCommerce Marketplace & Web Store Connector Configuration.
    Supports: SHOPIFY, WOOCOMMERCE, AMAZON, FLIPKART, INTERNAL_STORE, CUSTOMER_PORTAL.
    """
    __tablename__ = "ecom_channels"

    channel_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    channel_type = Column(String(50), nullable=False)  # SHOPIFY, WOOCOMMERCE, AMAZON, FLIPKART, INTERNAL_STORE, CUSTOMER_PORTAL
    store_url = Column(String(255), nullable=True)
    api_version = Column(String(20), default="2026-01")
    credential_ref = Column(String(100), nullable=True)  # Reference key in IntegrationCredentialReference
    is_active = Column(Boolean, default=True)
    sync_inventory = Column(Boolean, default=True)
    sync_pricing = Column(Boolean, default=True)
    auto_converge_orders = Column(Boolean, default=True)
    webhook_secret = Column(String(255), nullable=True)
    settings = Column(JSONB, server_default=text("'{}'::jsonb"), default=dict)


class EcomSkuMapping(BaseEntity):
    """
    Mapping between External Marketplace SKU and SMRITI Item / Variant SKU.
    """
    __tablename__ = "ecom_sku_mappings"
    __table_args__ = (
        UniqueConstraint("channel_code", "external_sku", name="uq_ecom_channel_sku"),
    )

    channel_code = Column(String(50), nullable=False, index=True)
    external_sku = Column(String(100), nullable=False, index=True)
    external_product_id = Column(String(100), nullable=True)
    smriti_sku = Column(String(100), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)


class EcomOrderImport(BaseEntity):
    """
    Inbound eCommerce order import ledger with deduplication and convergence tracking.
    """
    __tablename__ = "ecom_order_imports"
    __table_args__ = (
        UniqueConstraint("channel_code", "external_order_id", name="uq_ecom_channel_order"),
    )

    channel_code = Column(String(50), nullable=False, index=True)
    external_order_id = Column(String(100), nullable=False, index=True)
    external_order_number = Column(String(100), nullable=True)
    order_status = Column(String(50), default="PENDING")  # PENDING, RESERVED, CONVERGED, FAILED, DLQ
    idempotency_key = Column(String(100), nullable=True, unique=True, index=True)
    
    customer_email = Column(String(255), nullable=True)
    customer_mobile = Column(String(30), nullable=True)
    customer_name = Column(String(255), nullable=True)
    
    currency = Column(String(10), default="INR")
    gross_amount = Column(Numeric(15, 2), default=0.00)
    tax_amount = Column(Numeric(15, 2), default=0.00)
    shipping_amount = Column(Numeric(15, 2), default=0.00)
    discount_amount = Column(Numeric(15, 2), default=0.00)
    net_amount = Column(Numeric(15, 2), default=0.00)
    
    payload = Column(JSONB, server_default=text("'{}'::jsonb"), default=dict)
    converged_invoice_id = Column(String(50), nullable=True, index=True)
    converged_order_id = Column(String(50), nullable=True, index=True)
    
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    last_retry_at = Column(DateTime, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)


class EcomStockSyncLog(BaseEntity):
    """
    Outbound inventory availability broadcast audit log per external marketplace channel.
    """
    __tablename__ = "ecom_stock_sync_logs"

    channel_code = Column(String(50), nullable=False, index=True)
    external_sku = Column(String(100), nullable=False, index=True)
    smriti_sku = Column(String(100), nullable=False, index=True)
    quantity_synced = Column(Numeric(12, 4), default=0.0000)
    status = Column(String(30), default="SUCCESS")  # SUCCESS, FAILED, THROTTLED
    response_payload = Column(JSONB, nullable=True)
    synced_at = Column(DateTime, default=datetime.utcnow)


class EcomReconciliation(BaseEntity):
    """
    Channel vs SMRITI transaction and revenue settlement reconciliation report.
    """
    __tablename__ = "ecom_reconciliations"

    reconciliation_no = Column(String(50), nullable=False, unique=True, index=True)
    channel_code = Column(String(50), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    channel_order_count = Column(Integer, default=0)
    channel_gross_revenue = Column(Numeric(15, 2), default=0.00)
    smriti_order_count = Column(Integer, default=0)
    smriti_gross_revenue = Column(Numeric(15, 2), default=0.00)
    variance_amount = Column(Numeric(15, 2), default=0.00)
    
    status = Column(String(30), default="RECONCILED")  # RECONCILED, DISCREPANCY, UNDER_INVESTIGATION
    discrepancy_details = Column(JSONB, nullable=True)
    reconciled_at = Column(DateTime, default=datetime.utcnow)
