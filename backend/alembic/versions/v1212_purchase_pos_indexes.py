"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : DB Migration — Purchase & POS Index Optimizations
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 12.12.0
Created      : 2026-07-28

Revision ID: v1212_purchase_pos_indexes
Revises: v1211_financial_year
Create Date: 2026-07-28 14:00:00

DBP Reference: SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.6 & §2.7
Health Matrix Remediation: Added missing indexes to Tier-1 tables
- purchase_orders (supplier_id, status)
- pos_sessions (status)
- pos_transactions (session_id)
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1212_purchase_pos_indexes'
down_revision = 'v1211_financial_year'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Purchase Order indexes
    op.create_index('ix_purchase_orders_supplier_id', 'purchase_orders', ['supplier_id'], unique=False)
    op.create_index('ix_purchase_orders_status', 'purchase_orders', ['status'], unique=False)

    # POS Session & Transaction indexes
    op.create_index('ix_pos_sessions_status', 'pos_sessions', ['status'], unique=False)
    op.create_index('ix_pos_transactions_session_id', 'pos_transactions', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_pos_transactions_session_id', table_name='pos_transactions')
    op.drop_index('ix_pos_sessions_status', table_name='pos_sessions')
    op.drop_index('ix_purchase_orders_status', table_name='purchase_orders')
    op.drop_index('ix_purchase_orders_supplier_id', table_name='purchase_orders')
