"""add workflow_events table

Revision ID: g3h4i5j6k7l8
Revises: 5a24b31e30db
Create Date: 2026-07-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g3h4i5j6k7l8'
down_revision = '5a24b31e30db'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'workflow_events',
        sa.Column('id',                sa.String(50),  primary_key=True),
        sa.Column('doc_type',          sa.String(50),  nullable=False),
        sa.Column('doc_id',            sa.String(50),  nullable=False),
        sa.Column('action',            sa.String(50),  nullable=False),
        sa.Column('from_status',       sa.String(50),  nullable=True),
        sa.Column('to_status',         sa.String(50),  nullable=False),
        sa.Column('performed_by_id',   sa.String(50),  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('performed_by_name', sa.String(150), nullable=True),
        sa.Column('company_id',        sa.String(50),  nullable=False),
        sa.Column('branch_id',         sa.String(50),  nullable=False),
        sa.Column('notes',             sa.Text,        nullable=True),
        sa.Column('created_at',        sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_workflow_events_doc',     'workflow_events', ['doc_type', 'doc_id'])
    op.create_index('ix_workflow_events_company', 'workflow_events', ['company_id', 'branch_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_workflow_events_company', table_name='workflow_events')
    op.drop_index('ix_workflow_events_doc',     table_name='workflow_events')
    op.drop_table('workflow_events')
