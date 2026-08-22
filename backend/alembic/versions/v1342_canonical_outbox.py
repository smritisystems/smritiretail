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

"""consolidate canonical transactional outbox schema

Revision ID: v1342_canonical_outbox
Revises: v1341_add_stock_audit_tables
Create Date: 2026-08-23 02:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1342_canonical_outbox'
down_revision = 'v1341_add_stock_audit_tables'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Ensure integration_outbox_events exists with base columns if not present
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'integration_outbox_events' not in tables:
        op.create_table(
            'integration_outbox_events',
            sa.Column('outbox_id', sa.String(length=50), primary_key=True),
            sa.Column('source_event_id', sa.String(length=100), nullable=False, unique=True),
            sa.Column('correlation_id', sa.String(length=100), nullable=False),
            sa.Column('causation_id', sa.String(length=100), nullable=True),
            sa.Column('event_type', sa.String(length=100), nullable=True),
            sa.Column('aggregate_type', sa.String(length=50), nullable=True),
            sa.Column('aggregate_id', sa.String(length=50), nullable=True),
            sa.Column('company_id', sa.String(length=50), nullable=True),
            sa.Column('branch_id', sa.String(length=50), nullable=True),
            sa.Column('event_schema_version', sa.String(length=20), server_default='1.0', nullable=False),
            sa.Column('target_channel', sa.String(length=50), server_default='GENERAL_OUTBOX', nullable=False),
            sa.Column('payload_json', sa.dialects.postgresql.JSONB, nullable=False),
            sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
            sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('claim_expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
            sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=True)
        )
        op.create_index('idx_outbox_channel_status', 'integration_outbox_events', ['target_channel', 'status'])
        op.create_index('idx_outbox_aggregate', 'integration_outbox_events', ['aggregate_type', 'aggregate_id'])
        op.create_index('idx_outbox_retry_schedule', 'integration_outbox_events', ['status', 'next_attempt_at'])
    else:
        # Table exists: add missing columns safely
        existing_cols = [c['name'] for c in inspector.get_columns('integration_outbox_events')]

        if 'event_type' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('event_type', sa.String(length=100), nullable=True))
            op.create_index('idx_outbox_event_type', 'integration_outbox_events', ['event_type'])

        if 'aggregate_type' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('aggregate_type', sa.String(length=50), nullable=True))

        if 'aggregate_id' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('aggregate_id', sa.String(length=50), nullable=True))

        if 'company_id' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('company_id', sa.String(length=50), nullable=True))
            op.create_index('idx_outbox_company', 'integration_outbox_events', ['company_id'])

        if 'branch_id' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('branch_id', sa.String(length=50), nullable=True))

        if 'error_message' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('error_message', sa.Text(), nullable=True))

        if 'last_attempt_at' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True))

        if 'next_attempt_at' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True))
            op.create_index('idx_outbox_next_attempt', 'integration_outbox_events', ['next_attempt_at'])

        if 'claim_expires_at' not in existing_cols:
            op.add_column('integration_outbox_events', sa.Column('claim_expires_at', sa.DateTime(timezone=True), nullable=True))
            op.create_index('idx_outbox_claim_expires', 'integration_outbox_events', ['claim_expires_at'])

        existing_indexes = [i['name'] for i in inspector.get_indexes('integration_outbox_events')]
        if 'idx_outbox_aggregate' not in existing_indexes:
            op.create_index('idx_outbox_aggregate', 'integration_outbox_events', ['aggregate_type', 'aggregate_id'])
        if 'idx_outbox_retry_schedule' not in existing_indexes:
            op.create_index('idx_outbox_retry_schedule', 'integration_outbox_events', ['status', 'next_attempt_at'])

    # 2. Cleanup legacy/duplicate outbox_events table if present
    if 'outbox_events' in tables:
        op.drop_table('outbox_events')


def downgrade():
    """
    Downgrade policy: Forward-only schema evolution.
    Drops added columns and indexes.
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'integration_outbox_events' in tables:
        existing_cols = [c['name'] for c in inspector.get_columns('integration_outbox_events')]
        if 'claim_expires_at' in existing_cols:
            op.drop_column('integration_outbox_events', 'claim_expires_at')
        if 'next_attempt_at' in existing_cols:
            op.drop_column('integration_outbox_events', 'next_attempt_at')
        if 'last_attempt_at' in existing_cols:
            op.drop_column('integration_outbox_events', 'last_attempt_at')
        if 'error_message' in existing_cols:
            op.drop_column('integration_outbox_events', 'error_message')
        if 'branch_id' in existing_cols:
            op.drop_column('integration_outbox_events', 'branch_id')
        if 'company_id' in existing_cols:
            op.drop_column('integration_outbox_events', 'company_id')
        if 'aggregate_id' in existing_cols:
            op.drop_column('integration_outbox_events', 'aggregate_id')
        if 'aggregate_type' in existing_cols:
            op.drop_column('integration_outbox_events', 'aggregate_type')
        if 'event_type' in existing_cols:
            op.drop_column('integration_outbox_events', 'event_type')
