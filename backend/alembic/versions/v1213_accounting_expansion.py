"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : DB Migration — Accounting Expansion (Bank Accounts, Cost Centers, TDS, GST Return Locks)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 12.13.0
Created      : 2026-07-28

Revision ID: v1213_accounting_expansion
Revises: v1212_purchase_pos_indexes
Create Date: 2026-07-28 14:10:00

DBP Reference: SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.10 — Accounting
Milestone 2 Task B-1, B-5, B-6, B-9
- bank_accounts
- cost_centers
- tds_entries
- gst_return_locks
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1213_accounting_expansion'
down_revision = 'v1212_purchase_pos_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. bank_accounts
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('account_name', sa.String(length=255), nullable=False),
        sa.Column('account_number', sa.String(length=100), nullable=False),
        sa.Column('bank_name', sa.String(length=255), nullable=False),
        sa.Column('branch_name', sa.String(length=255), nullable=True),
        sa.Column('ifsc_code', sa.String(length=20), nullable=False),
        sa.Column('swift_code', sa.String(length=20), nullable=True),
        sa.Column('account_type', sa.String(length=50), nullable=False, server_default='CURRENT'),
        sa.Column('opening_balance', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('current_balance', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='INR'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('gl_account_code', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_bank_accounts_company_id', 'bank_accounts', ['company_id'], unique=False)

    # 2. cost_centers
    op.create_table(
        'cost_centers',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_cost_centers_company_id', 'cost_centers', ['company_id'], unique=False)

    # 3. tds_entries
    op.create_table(
        'tds_entries',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('deduction_date', sa.Date(), nullable=False),
        sa.Column('section_code', sa.String(length=20), nullable=False),
        sa.Column('vendor_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=True),
        sa.Column('invoice_ref_no', sa.String(length=100), nullable=False),
        sa.Column('gross_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('tds_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('tds_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='DEDUCTED'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tds_entries_company_id', 'tds_entries', ['company_id'], unique=False)

    # 4. gst_return_locks
    op.create_table(
        'gst_return_locks',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('return_type', sa.String(length=20), nullable=False),
        sa.Column('return_period', sa.String(length=20), nullable=False),
        sa.Column('filed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('filed_by', sa.String(length=100), nullable=True),
        sa.Column('arn_number', sa.String(length=100), nullable=True),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_gst_return_locks_company_id', 'gst_return_locks', ['company_id'], unique=False)


def downgrade() -> None:
    op.drop_table('gst_return_locks')
    op.drop_table('tds_entries')
    op.drop_table('cost_centers')
    op.drop_table('bank_accounts')
