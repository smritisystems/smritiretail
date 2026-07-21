"""v630_supplier_scorecard_engine

Revision ID: v630_supplier_scorecard
Revises: v620_quality_inspection
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'v630_supplier_scorecard'
down_revision = 'v620_quality_inspection'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add performance_rating and tier_classification to suppliers
    op.add_column('suppliers', sa.Column('performance_rating', sa.Numeric(5, 2), nullable=True))
    op.add_column('suppliers', sa.Column('tier_classification', sa.String(30), nullable=True))  # PREFERRED, APPROVED, CONDITIONAL, SUSPENDED

    # 2. Create supplier_scorecards table
    op.create_table(
        'supplier_scorecards',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scorecard_no', sa.String(), nullable=False),
        sa.Column('evaluation_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('days_window', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('otif_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('quality_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('price_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('rfq_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('composite_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('grade', sa.String(5), nullable=False, server_default='F'),  # A, B, C, D, F
        sa.Column('tier_classification', sa.String(30), nullable=False, server_default='APPROVED'),  # PREFERRED, APPROVED, CONDITIONAL, SUSPENDED
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.UniqueConstraint('scorecard_no')
    )
    op.create_index('ix_supplier_scorecards_supplier_id', 'supplier_scorecards', ['supplier_id'])

    # 3. Create supplier_scorecard_metrics table
    op.create_table(
        'supplier_scorecard_metrics',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('scorecard_id', sa.String(), sa.ForeignKey('supplier_scorecards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('metric_type', sa.String(50), nullable=False),  # OTIF, QUALITY, PRICE, RFQ
        sa.Column('raw_value', sa.Numeric(10, 4), nullable=False),
        sa.Column('weight', sa.Numeric(5, 2), nullable=False),
        sa.Column('weighted_score', sa.Numeric(5, 2), nullable=False),
        sa.Column('details_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )


def downgrade() -> None:
    op.drop_table('supplier_scorecard_metrics')
    op.drop_table('supplier_scorecards')
    op.drop_column('suppliers', 'tier_classification')
    op.drop_column('suppliers', 'performance_rating')
