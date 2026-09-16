"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.29.0
Created      : 2026-08-15
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Commerce & Sales Promotion Engine Models
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from ..db.base import Base, BaseEntity


# =============================================================================
# 1. CANONICAL SMRITI PROMOTION ENGINE MODELS (PostgreSQL 15+ DDL v6.29.0)
# =============================================================================

class SmritiPromotion(BaseEntity):
    """Permanent identity and metadata for a sales promotion scheme."""
    __tablename__ = "smriti_promotions"

    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_code = Column(String(50), nullable=False)
    promotion_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String(20), nullable=False, default="ITEM_LEVEL") # ITEM_LEVEL | BILL_LEVEL
    status = Column(String(20), nullable=False, default="DRAFT") # DRAFT | PENDING_APPROVAL | APPROVED | PUBLISHED | PAUSED | EXPIRED | ARCHIVED
    priority = Column(Integer, nullable=False, default=10) # Lower number = higher priority
    is_exclusive = Column(Boolean, nullable=False, default=False)
    allow_stacking = Column(Boolean, nullable=False, default=False)
    max_stacked_discount_pct = Column(Numeric(5, 2), nullable=False, default=50.00)
    start_at = Column(DateTime(timezone=True), nullable=False)
    end_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "promotion_code", name="uq_smriti_promotions_tenant_code"),
        Index("idx_smriti_promotions_active_lookup", "tenant_id", "status", "is_active", "start_at", "end_at"),
    )


class SmritiPromotionVersion(BaseEntity):
    """Immutable versioned definition of rules, conditions, and rewards."""
    __tablename__ = "smriti_promotion_versions"

    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_no = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="DRAFT")
    effective_from = Column(DateTime(timezone=True), nullable=False)
    effective_to = Column(DateTime(timezone=True), nullable=False)
    definition_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    definition_hash = Column(String(64), nullable=False) # SHA-256 integrity hash
    change_summary = Column(Text, nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "promotion_id", "version_no", name="uq_smriti_promo_versions_tenant_ver"),
        Index("idx_smriti_promo_versions_lookup", "tenant_id", "promotion_id", "status", "effective_from", "effective_to"),
    )


class SmritiPromotionRule(Base):
    """Individual rule logic building blocks within a promotion version."""
    __tablename__ = "smriti_promotion_rules"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_no = Column(Integer, nullable=False, default=1)
    rule_type = Column(String(50), nullable=False) # BUY_QUANTITY, BUY_VALUE, BASKET_VALUE, QUANTITY_SLAB, etc.
    operator = Column(String(20), nullable=False, default="AND")
    threshold_quantity = Column(Numeric(12, 3), default=1.000)
    threshold_value = Column(Numeric(15, 2), default=0.00)
    configuration_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "promotion_version_id", "rule_no", name="uq_smriti_promo_rules_seq"),
    )


class SmritiPromotionCondition(Base):
    """Atomic matching conditions (SKU, brand, category, time, customer group)."""
    __tablename__ = "smriti_promotion_conditions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_rule_id = Column(String(50), ForeignKey("smriti_promotion_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_no = Column(Integer, nullable=False, default=1)
    field_name = Column(String(100), nullable=False)
    operator = Column(String(30), nullable=False, default="EQUALS")
    value_text = Column(String(255), nullable=True)
    value_numeric = Column(Numeric(15, 4), nullable=True)
    value_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "promotion_rule_id", "sequence_no", name="uq_smriti_promo_conditions_seq"),
    )


class SmritiPromotionReward(Base):
    """Execution reward specification (discount %, flat ₹, free item, fixed combo)."""
    __tablename__ = "smriti_promotion_rewards"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_rule_id = Column(String(50), ForeignKey("smriti_promotion_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_type = Column(String(50), nullable=False) # PERCENT_DISCOUNT, FIXED_AMOUNT_DISCOUNT, FREE_SAME_ITEM, FREE_DIFFERENT_ITEM
    reward_quantity = Column(Numeric(12, 3), nullable=False, default=1.000)
    discount_percent = Column(Numeric(5, 2), default=0.00)
    discount_amount = Column(Numeric(15, 2), default=0.00)
    fixed_price = Column(Numeric(15, 2), nullable=True)
    max_discount_cap = Column(Numeric(15, 2), nullable=True)
    max_reward_quantity = Column(Numeric(12, 3), nullable=True)
    applied_on = Column(String(30), nullable=False, default="LOWEST_PRICE")
    reward_scope_id = Column(String(50), nullable=True) # Independent scope for cross-item offers
    tax_treatment = Column(String(50), nullable=False, default="PRE_TAX_TRADE_DISCOUNT")
    configuration_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionScope(Base):
    """Categorical, brand, or SKU scope definition."""
    __tablename__ = "smriti_promotion_scopes"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    scope_type = Column(String(50), nullable=False) # ITEM_SKU, ITEM_BARCODE, CATEGORY, BRAND, STORE_BRANCH
    scope_name = Column(String(100), nullable=False)
    is_inclusive = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionScopeItem(Base):
    """High-density relational SKU/barcode lookup table for large merchandising lists."""
    __tablename__ = "smriti_promotion_scope_items"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_scope_id = Column(String(50), ForeignKey("smriti_promotion_scopes.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=True)
    barcode_id = Column(String(50), ForeignKey("item_barcodes.id", ondelete="CASCADE"), nullable=True)
    barcode = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "promotion_scope_id", "barcode", name="uq_smriti_scope_items_barcode"),
        Index("idx_smriti_scope_items_pos_lookup", "tenant_id", "barcode", "promotion_scope_id"),
    )


class SmritiPromotionQualification(Base):
    """Real-time POS cart qualification event log."""
    __tablename__ = "smriti_promotion_qualifications"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="RESTRICT"), nullable=False)
    sales_session_id = Column(String(100), nullable=False, index=True)
    sales_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    qualification_status = Column(String(20), nullable=False, default="QUALIFIED") # QUALIFIED, REDEEMED, DECLINED, EXPIRED
    potential_discount = Column(Numeric(15, 2), nullable=False, default=0.00)
    qualified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    trigger_snapshot_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)


class SmritiPromotionRedemption(Base):
    """Immutable transactional ledger of redeemed discounts on sales invoices."""
    __tablename__ = "smriti_promotion_redemptions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="RESTRICT"), nullable=False)
    sales_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    reward_type = Column(String(50), nullable=False)
    discount_amount = Column(Numeric(15, 2), nullable=False)
    reward_quantity = Column(Numeric(12, 3), nullable=False, default=1.000)
    tax_treatment = Column(String(50), nullable=False, default="PRE_TAX_TRADE_DISCOUNT")
    conflict_strategy = Column(String(50), nullable=False, default="BEST_BENEFIT")
    calculation_snapshot = Column(JSONB, nullable=False) # Complete reproducible audit calculation receipt
    redeemed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionRedemptionItem(Base):
    """Item-level line discount attribution (Trigger vs Reward)."""
    __tablename__ = "smriti_promotion_redemption_items"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    redemption_id = Column(String(50), ForeignKey("smriti_promotion_redemptions.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_invoice_item_id = Column(String(50), ForeignKey("sales_invoice_items.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="RESTRICT"), nullable=True)
    barcode = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False) # TRIGGER | REWARD
    allocated_quantity = Column(Numeric(12, 3), nullable=False, default=1.000)
    unit_price = Column(Numeric(15, 2), nullable=False)
    discount_allocated = Column(Numeric(15, 2), nullable=False, default=0.00)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionDecline(Base):
    """Counter decline tracking for qualified promotions."""
    __tablename__ = "smriti_promotion_declines"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="RESTRICT"), nullable=False)
    sales_session_id = Column(String(100), nullable=False, index=True)
    sales_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True)
    cashier_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    decline_reason_code = Column(String(50), nullable=False, default="CUSTOMER_DECLINED")
    decline_reason_text = Column(String(255), nullable=True)
    unclaimed_potential_savings = Column(Numeric(15, 2), nullable=False, default=0.00)
    declined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionOverride(Base):
    """Supervisor manual discount authorization audit."""
    __tablename__ = "smriti_promotion_overrides"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_invoice_item_id = Column(String(50), ForeignKey("sales_invoice_items.id", ondelete="SET NULL"), nullable=True)
    requested_by = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    approved_by = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    original_discount = Column(Numeric(15, 2), nullable=False, default=0.00)
    requested_discount = Column(Numeric(15, 2), nullable=False)
    approved_discount = Column(Numeric(15, 2), nullable=False)
    reason_code = Column(String(50), nullable=False)
    reason_text = Column(String(255), nullable=True)
    authorization_method = Column(String(50), nullable=False, default="SUPERVISOR_PIN")
    auth_token_digest = Column(String(64), nullable=True)
    approved_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionAudit(Base):
    """Immutable configuration audit trail."""
    __tablename__ = "smriti_promotion_audit"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="CASCADE"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)
    actor_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(100), nullable=True)
    before_snapshot = Column(JSONB, nullable=True)
    after_snapshot = Column(JSONB, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    client_terminal = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionImport(Base):
    """Bulk SKU merchandising import staging header."""
    __tablename__ = "smriti_promotion_imports"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="CASCADE"), nullable=False, index=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False)
    total_rows = Column(Integer, nullable=False, default=0)
    valid_rows = Column(Integer, nullable=False, default=0)
    invalid_rows = Column(Integer, nullable=False, default=0)
    duplicate_rows = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="PENDING")
    error_summary = Column(JSONB, nullable=True)
    uploaded_by = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)


class SmritiPromotionImportRow(Base):
    """Staged line item for bulk SKU lists."""
    __tablename__ = "smriti_promotion_import_rows"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    import_id = Column(String(50), ForeignKey("smriti_promotion_imports.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    raw_barcode = Column(String(100), nullable=False)
    resolved_item_id = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    resolved_barcode_id = Column(String(50), ForeignKey("item_barcodes.id", ondelete="SET NULL"), nullable=True)
    is_valid = Column(Boolean, nullable=False, default=False)
    error_code = Column(String(50), nullable=True)
    error_message = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "import_id", "row_number", name="uq_smriti_import_rows_seq"),
    )


class SmritiPromotionSimulation(Base):
    """Headless simulation scenario header."""
    __tablename__ = "smriti_promotion_simulations"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="SET NULL"), nullable=True)
    promotion_version_id = Column(String(50), ForeignKey("smriti_promotion_versions.id", ondelete="SET NULL"), nullable=True)
    scenario_name = Column(String(255), nullable=False)
    input_cart_snapshot = Column(JSONB, nullable=False)
    total_gross_amount = Column(Numeric(15, 2), nullable=False)
    total_discount_computed = Column(Numeric(15, 2), nullable=False)
    total_net_amount = Column(Numeric(15, 2), nullable=False)
    explainability_log = Column(JSONB, server_default=text("'[]'::jsonb"), nullable=False)
    is_passed = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SmritiPromotionConflict(Base):
    """Conflict arbitration record."""
    __tablename__ = "smriti_promotion_conflicts"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False)
    tenant_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    competing_promotions = Column(JSONB, nullable=False)
    arbitration_strategy = Column(String(50), nullable=False, default="BEST_BENEFIT")
    winning_promotion_id = Column(String(50), ForeignKey("smriti_promotions.id", ondelete="RESTRICT"), nullable=False)
    winning_discount_amount = Column(Numeric(15, 2), nullable=False)
    forgone_discount_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    explainability_rationale = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# =============================================================================
# 2. LEGACY & BACKWARD-COMPATIBLE SCHEMAS
# =============================================================================

class PromotionCampaign(BaseEntity):
    """Legacy Commercial Growth Engine Promotion Campaign Master."""
    __tablename__ = "promotion_campaigns"

    name = Column(String(100), nullable=False, unique=True)
    promo_code = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    min_order_amount = Column(Numeric(15, 2), default=0.00)
    max_discount_amount = Column(Numeric(15, 2), nullable=True)
    usage_limit = Column(Integer, nullable=True)
    per_customer_limit = Column(Integer, default=1)
    applicable_stores = Column(JSONB, server_default=text("'[]'"), default=list)
    applicable_channels = Column(JSONB, server_default=text("'[]'"), default=list)
    customer_eligibility = Column(JSONB, server_default=text("'{}'"), default=dict)

    priority = Column(Integer, default=10)
    is_exclusive = Column(Boolean, default=False)
    allow_stacking = Column(Boolean, default=False)
    max_stacked_discount_percent = Column(Numeric(5, 2), default=50.00)
    allow_combine_with_loyalty = Column(Boolean, default=True)
    allow_combine_with_referral = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)


class PromotionRule(BaseEntity):
    """Legacy Promotion Calculation Rules."""
    __tablename__ = "promotion_rules"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_type = Column(String(50), nullable=False)
    discount_percent = Column(Numeric(5, 2), default=0.00)
    discount_fixed_amount = Column(Numeric(15, 2), default=0.00)
    special_price = Column(Numeric(15, 2), default=0.00)
    buy_quantity = Column(Integer, default=1)
    get_quantity = Column(Integer, default=0)
    bundle_offer_details = Column(JSONB, server_default=text("'{}'"), default=dict)
    product_eligibility = Column(JSONB, server_default=text("'{}'"), default=dict)
    is_active = Column(Boolean, default=True)


class Coupon(BaseEntity):
    """Legacy Promo Codes & Discount Coupons."""
    __tablename__ = "coupons"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    usage_limit = Column(Integer, default=100)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class PromotionRedemption(BaseEntity):
    """Legacy Transactional Redemption Ledger."""
    __tablename__ = "promotion_redemptions"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    coupon_id = Column(String(50), ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(50), nullable=True, index=True)
    reference_invoice_id = Column(String(50), nullable=False, index=True)
    discount_applied = Column(Numeric(15, 2), nullable=False)
    conflict_resolution_strategy = Column(String(50), default="BEST_BENEFIT")
    evaluated_campaigns_snapshot = Column(JSONB, server_default=text("'[]'"), default=list)
    rule_snapshot = Column(JSONB, server_default=text("'{}'"), default=dict)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
