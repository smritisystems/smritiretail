"""add_v325_enterprise_tables_and_customer_code

Revision ID: v1334_add_v325_enterprise
Revises: v1333_add_reserved_stock
Create Date: 2026-08-15 16:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v1334_add_v325_enterprise'
down_revision: Union[str, Sequence[str], None] = 'v1333_add_reserved_stock'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    # 1. Align customers.code column
    if 'customers' in existing_tables:
        cust_cols = [c['name'] for c in inspector.get_columns('customers')]
        if 'code' not in cust_cols:
            op.add_column('customers', sa.Column('code', sa.String(50), nullable=True))

    # 2. Create required v3.25.0 enterprise tables using SQLAlchemy Metadata DDL
    from app.models.commission import (
        CommissionParticipant, CommissionProgram, CommissionRule, CommissionLedger
    )
    from app.models.referral import ReferralProgram, ReferralRelationship, ReferralReward
    from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyRule, LoyaltyPointsLedger
    from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
    from app.models.fulfillment import (
        PackingSlip, PackingSlipItem, Dispatch, DispatchItem, ReverseLogisticsReturn, DeliveryCommissionSettlement
    )
    from app.models.profitability import TransactionCostSnapshot, ProductCostValuation, InvoiceProfitabilityLedger
    from app.models.reporting import ReportDefinition, ReportSavedView, Dashboard, DashboardWidget
    from app.models.ui_control_plane import SmritiWorkspaceProfile, SmritiTheme, SmritiThemeVariant

    target_tables = [
        CommissionParticipant.__table__,
        CommissionProgram.__table__,
        CommissionRule.__table__,
        CommissionLedger.__table__,
        ReferralProgram.__table__,
        ReferralRelationship.__table__,
        ReferralReward.__table__,
        LoyaltyTier.__table__,
        LoyaltyMember.__table__,
        LoyaltyRule.__table__,
        LoyaltyPointsLedger.__table__,
        PromotionCampaign.__table__,
        PromotionRule.__table__,
        Coupon.__table__,
        PromotionRedemption.__table__,
        PackingSlip.__table__,
        PackingSlipItem.__table__,
        Dispatch.__table__,
        DispatchItem.__table__,
        ReverseLogisticsReturn.__table__,
        DeliveryCommissionSettlement.__table__,
        TransactionCostSnapshot.__table__,
        ProductCostValuation.__table__,
        InvoiceProfitabilityLedger.__table__,
        ReportDefinition.__table__,
        ReportSavedView.__table__,
        Dashboard.__table__,
        DashboardWidget.__table__,
        SmritiWorkspaceProfile.__table__,
        SmritiTheme.__table__,
        SmritiThemeVariant.__table__,
    ]

    for table in target_tables:
        if table.name not in existing_tables:
            table.create(bind=conn, checkfirst=True)

def downgrade() -> None:
    pass
