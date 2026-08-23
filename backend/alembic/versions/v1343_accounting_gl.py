"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""authoritative double-entry general ledger schema

Revision ID: v1343_accounting_gl
Revises: v1342_canonical_outbox
Create Date: 2026-08-23 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1343_accounting_gl'
down_revision = 'v1342_canonical_outbox'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Accounts Table (Chart of Accounts)
    if 'accounts' not in tables:
        op.create_table(
            'accounts',
            sa.Column('id', sa.String(length=50), primary_key=True),
            sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
            sa.Column('company_id', sa.String(length=50), nullable=False, index=True),
            sa.Column('branch_id', sa.String(length=50), nullable=True),
            sa.Column('account_code', sa.String(length=50), nullable=False, index=True),
            sa.Column('account_name', sa.String(length=200), nullable=False),
            sa.Column('account_type', sa.String(length=30), nullable=False),
            sa.Column('root_type', sa.String(length=30), nullable=False),
            sa.Column('parent_account_id', sa.String(length=50), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True),
            sa.Column('is_group', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('party_type', sa.String(length=30), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('created_by', sa.String(length=100), nullable=True),
            sa.Column('updated_by', sa.String(length=100), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('deleted_by', sa.String(length=100), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.UniqueConstraint('company_id', 'account_code', name='uq_accounts_company_code')
        )
        op.create_index('idx_accounts_company_type', 'accounts', ['company_id', 'account_type'])
        op.create_index('idx_accounts_parent', 'accounts', ['company_id', 'parent_account_id'])
    else:
        existing_cols = [c['name'] for c in inspector.get_columns('accounts')]
        if 'modified_at' not in existing_cols:
            op.add_column('accounts', sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True))
        if 'created_by' not in existing_cols:
            op.add_column('accounts', sa.Column('created_by', sa.String(length=100), nullable=True))
        if 'updated_by' not in existing_cols:
            op.add_column('accounts', sa.Column('updated_by', sa.String(length=100), nullable=True))
        if 'deleted_at' not in existing_cols:
            op.add_column('accounts', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        if 'deleted_by' not in existing_cols:
            op.add_column('accounts', sa.Column('deleted_by', sa.String(length=100), nullable=True))
        if 'version' not in existing_cols:
            op.add_column('accounts', sa.Column('version', sa.Integer(), server_default='1', nullable=True))

    # 2. Journal Vouchers Table
    if 'journal_vouchers' not in tables:
        op.create_table(
            'journal_vouchers',
            sa.Column('id', sa.String(length=50), primary_key=True),
            sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
            sa.Column('company_id', sa.String(length=50), nullable=False, index=True),
            sa.Column('branch_id', sa.String(length=50), nullable=True),
            sa.Column('voucher_no', sa.String(length=100), nullable=False, index=True),
            sa.Column('voucher_type', sa.String(length=50), nullable=False),
            sa.Column('voucher_date', sa.Date(), nullable=False),
            sa.Column('posting_date', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('reference_doc_type', sa.String(length=50), nullable=True),
            sa.Column('reference_doc_id', sa.String(length=50), nullable=True, index=True),
            sa.Column('reference_doc_no', sa.String(length=100), nullable=True),
            sa.Column('narration', sa.Text(), nullable=True),
            sa.Column('total_debit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('total_credit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('is_posted', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('is_cancelled', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('posted_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
            sa.Column('created_by', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('updated_by', sa.String(length=100), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('deleted_by', sa.String(length=100), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.UniqueConstraint('company_id', 'voucher_no', name='uq_journal_vouchers_company_no')
        )
        op.create_index('idx_jv_company_type_date', 'journal_vouchers', ['company_id', 'voucher_type', 'voucher_date'])
        op.create_index('idx_jv_reference_doc', 'journal_vouchers', ['company_id', 'reference_doc_type', 'reference_doc_id'])
    else:
        existing_cols = [c['name'] for c in inspector.get_columns('journal_vouchers')]
        if 'is_active' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
        if 'modified_at' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True))
        if 'created_by' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('created_by', sa.String(length=100), nullable=True))
        if 'updated_by' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('updated_by', sa.String(length=100), nullable=True))
        if 'deleted_at' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        if 'deleted_by' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('deleted_by', sa.String(length=100), nullable=True))
        if 'version' not in existing_cols:
            op.add_column('journal_vouchers', sa.Column('version', sa.Integer(), server_default='1', nullable=True))

    # 3. General Ledger Entries Table
    if 'general_ledger_entries' not in tables:
        op.create_table(
            'general_ledger_entries',
            sa.Column('id', sa.String(length=50), primary_key=True),
            sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
            sa.Column('company_id', sa.String(length=50), nullable=False, index=True),
            sa.Column('branch_id', sa.String(length=50), nullable=True),
            sa.Column('voucher_id', sa.String(length=50), sa.ForeignKey('journal_vouchers.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('account_id', sa.String(length=50), sa.ForeignKey('accounts.id', ondelete='RESTRICT'), nullable=False, index=True),
            sa.Column('party_id', sa.String(length=50), nullable=True, index=True),
            sa.Column('entry_date', sa.Date(), nullable=False),
            sa.Column('posting_date', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('debit_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('credit_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
            sa.Column('against_account_id', sa.String(length=50), nullable=True),
            sa.Column('against_account_name', sa.String(length=200), nullable=True),
            sa.Column('reference_doc_type', sa.String(length=50), nullable=True),
            sa.Column('reference_doc_id', sa.String(length=50), nullable=True),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('created_by', sa.String(length=100), nullable=True),
            sa.Column('updated_by', sa.String(length=100), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('deleted_by', sa.String(length=100), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False)
        )
        op.create_index('idx_gl_company_account_date', 'general_ledger_entries', ['company_id', 'account_id', 'posting_date'])
        op.create_index('idx_gl_company_party', 'general_ledger_entries', ['company_id', 'party_id'])
        op.create_index('idx_gl_voucher_id', 'general_ledger_entries', ['voucher_id'])
    else:
        existing_cols = [c['name'] for c in inspector.get_columns('general_ledger_entries')]
        if 'is_active' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
        if 'modified_at' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True))
        if 'created_by' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('created_by', sa.String(length=100), nullable=True))
        if 'updated_by' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('updated_by', sa.String(length=100), nullable=True))
        if 'deleted_at' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        if 'deleted_by' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('deleted_by', sa.String(length=100), nullable=True))
        if 'version' not in existing_cols:
            op.add_column('general_ledger_entries', sa.Column('version', sa.Integer(), server_default='1', nullable=True))

    # 4. Account Balance Snapshots Table
    if 'account_balance_snapshots' not in tables:
        op.create_table(
            'account_balance_snapshots',
            sa.Column('id', sa.String(length=50), primary_key=True),
            sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
            sa.Column('company_id', sa.String(length=50), nullable=False, index=True),
            sa.Column('branch_id', sa.String(length=50), nullable=True),
            sa.Column('account_id', sa.String(length=50), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('period_date', sa.Date(), nullable=False),
            sa.Column('opening_debit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('opening_credit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('closing_debit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('closing_credit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('net_balance', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('created_by', sa.String(length=100), nullable=True),
            sa.Column('updated_by', sa.String(length=100), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('deleted_by', sa.String(length=100), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.UniqueConstraint('company_id', 'account_id', 'period_date', name='uq_account_balance_period')
        )
        op.create_index('idx_snapshot_company_date', 'account_balance_snapshots', ['company_id', 'period_date'])
    else:
        existing_cols = [c['name'] for c in inspector.get_columns('account_balance_snapshots')]
        if 'is_active' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
        if 'modified_at' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True))
        if 'created_by' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('created_by', sa.String(length=100), nullable=True))
        if 'updated_by' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('updated_by', sa.String(length=100), nullable=True))
        if 'deleted_at' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        if 'deleted_by' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('deleted_by', sa.String(length=100), nullable=True))
        if 'version' not in existing_cols:
            op.add_column('account_balance_snapshots', sa.Column('version', sa.Integer(), server_default='1', nullable=True))




def downgrade():
    """
    Symmetrical downgrade dropping accounting tables in reverse dependency order.
    """
    op.execute("DROP TABLE IF EXISTS account_balance_snapshots CASCADE;")
    op.execute("DROP TABLE IF EXISTS general_ledger_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS journal_vouchers CASCADE;")
    op.execute("DROP TABLE IF EXISTS accounts CASCADE;")

